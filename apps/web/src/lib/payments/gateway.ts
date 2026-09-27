/**
 * Payment gateway abstraction.
 *
 * The platform never marks a payment successful because a browser said so. A
 * gateway is asked to create a charge, and the result only becomes CAPTURED
 * after the server has independently confirmed it, either by:
 *
 *   - verifying a signed webhook the gateway sent to us, or
 *   - querying the gateway directly for the charge state.
 *
 * A client returning from a redirect is a *hint to check*, never proof. That
 * distinction is the whole reason this file exists.
 *
 * Adding bKash, Nagad, a2a or a card gateway means implementing PaymentGateway
 * and nothing else changes. Commission, payouts, refunds and the booking state
 * machine are all unaware of which gateway ran.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { bdtToPoisha } from "@fixbondhu/core";

export type GatewayName = "sandbox" | "bkash" | "a2a" | "nagad" | "card";

export type PaymentMethod = "CASH" | "BKASH" | "A2A" | "NAGAD" | "CARD";

export interface CreateChargeInput {
  /** Our unique key. Retrying with the same key must never double-charge. */
  idempotencyKey: string;
  amountPoisha: number;
  customerPhone: string;
  bookingReference: string;
  description: string;
}

export interface ChargeResult {
  gatewayPaymentId: string;
  status: "PENDING" | "CAPTURED" | "FAILED";
  /** Where to send the customer to pay. Absent for cash. */
  redirectUrl?: string;
  /** Present when the gateway gave us one; used for reconciliation. */
  gatewayReference?: string;
  raw?: unknown;
}

export interface VerifyResult {
  verified: boolean;
  status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
  gatewayPaymentId: string;
  amountPoisha?: number;
  gatewayReference?: string;
  /** Why verification failed. Logged, never shown raw to a customer. */
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  gatewayRefundId?: string;
  reason?: string;
}

export interface PaymentGateway {
  readonly name: GatewayName;
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /**
   * Authoritative state check. Called server-side only. This is the function
   * that decides whether money was really received.
   */
  verifyCharge(gatewayPaymentId: string, expectedAmountPoisha: number): Promise<VerifyResult>;
  refund(gatewayPaymentId: string, amountPoisha: number, reason: string): Promise<RefundResult>;
  /**
   * Verifies the signature on an inbound webhook. Returns false rather than
   * throwing so a caller cannot forget to handle it.
   */
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string): WebhookEvent | null;
}

export interface WebhookEvent {
  gatewayPaymentId: string;
  status: "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";
  amountPoisha: number;
  gatewayReference?: string;
  raw?: unknown;
}

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

/**
 * A genuinely functional gateway, not a stub that always succeeds.
 *
 * Charges are held in the database (Payment rows) and transitions are guarded
 * by an HMAC over the payload using PAYMENT_WEBHOOK_SECRET. The signature is
 * what makes the sandbox behave like a real integration: code that forgets to
 * verify will fail here, so the failure surfaces in development rather than the
 * first time a live gateway is enabled.
 */
class SandboxGateway implements PaymentGateway {
  readonly name = "sandbox" as const;

  private secret(): string {
    return process.env.PAYMENT_WEBHOOK_SECRET ?? "sandbox-only-secret-do-not-use-in-production";
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret()).update(payload).digest("hex");
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    // A real gateway would return a URL for its hosted checkout page. There is
    // no money involved, so no payment page is presented; the charge stays
    // PENDING until a signed confirmation is delivered.
    const gatewayPaymentId = `sbx_${input.idempotencyKey}`;
    return {
      gatewayPaymentId,
      status: "PENDING",
      redirectUrl: `/pay/sandbox?ref=${encodeURIComponent(input.idempotencyKey)}`,
      gatewayReference: input.bookingReference,
    };
  }

  /**
   * Sandbox verification reads the real Payment row rather than trusting the
   * caller, so the only way to reach CAPTURED is for the row to say so. The row
   * is only moved to CAPTURED by a signature-verified webhook.
   */
  async verifyCharge(gatewayPaymentId: string, expectedAmountPoisha: number): Promise<VerifyResult> {
    const { prisma } = await import("@/lib/db");
    const payment = await prisma.payment.findUnique({
      where: { idempotencyKey: gatewayPaymentId },
      select: { status: true, amountPoisha: true, gatewayReference: true },
    });

    if (!payment) {
      return {
        verified: false,
        status: "FAILED",
        gatewayPaymentId,
        reason: "no such charge",
      };
    }
    if (payment.amountPoisha !== expectedAmountPoisha) {
      return {
        verified: false,
        status: "FAILED",
        gatewayPaymentId,
        reason: "amount mismatch",
      };
    }

    // CREATED and PENDING both mean "not yet paid". Mapping them explicitly
    // keeps the gateway's vocabulary separate from the ledger's, so a new
    // ledger status cannot silently be treated as success.
    const status: VerifyResult["status"] =
      payment.status === "CAPTURED"
        ? "CAPTURED"
        : payment.status === "REFUNDED"
          ? "REFUNDED"
          : payment.status === "FAILED"
            ? "FAILED"
            : "PENDING";

    return {
      verified: true,
      status,
      gatewayPaymentId,
      amountPoisha: payment.amountPoisha,
      gatewayReference: payment.gatewayReference ?? undefined,
    };
  }

  async refund(): Promise<RefundResult> {
    // No money moved, so there is nothing to send back. Recorded in the ledger
    // by the caller. Returning a deterministic result keeps the flow identical
    // to a live gateway rather than special-casing sandbox later.
    return { ok: true, gatewayRefundId: `sbx_refund_${Date.now()}` };
  }

  verifyWebhook(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const expected = this.sign(rawBody);
    const provided = Buffer.from(signature, "utf8");
    const computed = Buffer.from(expected, "utf8");
    // Length check first: timingSafeEqual throws on a length mismatch, which
    // would itself leak information through an exception.
    if (provided.length !== computed.length) return false;
    return timingSafeEqual(provided, computed);
  }

  parseWebhook(rawBody: string): WebhookEvent | null {
    try {
      const parsed = JSON.parse(rawBody) as {
        idempotencyKey?: string;
        status?: string;
        amountBdt?: number;
        gatewayReference?: string;
      };
      if (!parsed.idempotencyKey || !parsed.status) return null;
      const status = String(parsed.status).toUpperCase();
      if (!["PENDING", "CAPTURED", "FAILED", "REFUNDED"].includes(status)) return null;
      return {
        gatewayPaymentId: parsed.idempotencyKey,
        status: status as WebhookEvent["status"],
        amountPoisha: bdtToPoisha(parsed.amountBdt ?? 0),
        gatewayReference: parsed.gatewayReference,
        raw: parsed,
      };
    } catch {
      return null;
    }
  }

  /** Used by the local simulator to produce a correctly signed callback. */
  signPayloadForTesting(payload: string): string {
    return this.sign(payload);
  }
}

export const sandboxGateway = new SandboxGateway();

// ---------------------------------------------------------------------------
// bKash
// ---------------------------------------------------------------------------

/**
 * bKash Tokenized Checkout.
 *
 * Written against bKash's documented create-payment and payment-status API
 * shape. It refuses to construct unless every merchant credential is present,
 * so the platform cannot silently run in a half-configured state where money
 * appears to be taken but no settlement ever arrives.
 *
 * Token handling: bKash grants a short-lived token per merchant. It is cached
 * in memory with a safety margin, because a request that fails because a token
 * expired at the boundary would look to a customer like the payment failed.
 */
class BkashGateway implements PaymentGateway {
  readonly name = "bkash" as const;
  private baseUrl = "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
  private token: { value: string; expiresAt: number } | null = null;

  private credentials() {
    const appKey = process.env.BKASH_APP_KEY;
    const appSecret = process.env.BKASH_APP_SECRET;
    const username = process.env.BKASH_USERNAME;
    const password = process.env.BKASH_PASSWORD;
    if (!appKey || !appSecret || !username || !password) {
      throw new Error(
        "bKash is selected but BKASH_APP_KEY / BKASH_APP_SECRET / BKASH_USERNAME / BKASH_PASSWORD are not set. Refusing to take payments in a half-configured state.",
      );
    }
    return { appKey, appSecret, username, password };
  }

  private async grantToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }
    const { appKey, appSecret, username, password } = this.credentials();

    const body = new URLSearchParams({
      app_key: appKey,
      app_secret: appSecret,
      username,
      password,
    });

    const response = await fetch(`${this.baseUrl}/tokenized/checkout/token/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const data = (await response.json()) as { id_token?: string; status?: string };
    if (!data.id_token) {
      throw new Error(`bKash token grant failed: ${data.status ?? "unknown"}`);
    }

    this.token = {
      value: data.id_token,
      // bKash tokens last about an hour; refresh early rather than at the edge.
      expiresAt: Date.now() + 50 * 60_000,
    };
    return data.id_token;
  }

  async createCharge(input: CreateChargeInput): Promise<ChargeResult> {
    const token = await this.grantToken();
    const { appKey } = this.credentials();

    const response = await fetch(`${this.baseUrl}/tokenized/checkout/create`, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: input.bookingReference,
        callbackURL: `${process.env.APP_URL}/pay/bkash/callback`,
        amount: (input.amountPoisha / 100).toFixed(2),
        currency: env().PAYMENT_CURRENCY,
        intent: "sale",
        merchantInvoiceNumber: input.idempotencyKey,
      }),
    });

    const data = (await response.json()) as {
      bkashURL?: string;
      paymentID?: string;
      statusCode?: string;
      statusMessage?: string;
    };

    if (!data.bkashURL || !data.paymentID) {
      return {
        gatewayPaymentId: input.idempotencyKey,
        status: "FAILED",
        raw: data,
      };
    }

    return {
      gatewayPaymentId: data.paymentID,
      status: "PENDING",
      redirectUrl: data.bkashURL,
      raw: { appKey, statusCode: data.statusCode },
    };
  }

  /**
   * The authoritative check. bKash's own status endpoint is the only thing
   * trusted here; the browser is never a source of truth.
   */
  async verifyCharge(gatewayPaymentId: string, expectedAmountPoisha: number): Promise<VerifyResult> {
    try {
      const token = await this.grantToken();
      const { appKey } = this.credentials();

      const response = await fetch(
        `${this.baseUrl}/tokenized/checkout/payment/status/${gatewayPaymentId}`,
        {
          method: "GET",
          headers: { Authorization: token, Accept: "application/json" },
        },
      );
      const data = (await response.json()) as {
        amount?: string;
        transactionStatus?: string;
        trxID?: string;
      };

      if (data.transactionStatus !== "Completed") {
        return {
          verified: true,
          status: data.transactionStatus === "Failed" || data.transactionStatus === "Cancelled" ? "FAILED" : "PENDING",
          gatewayPaymentId,
          reason: data.transactionStatus,
        };
      }

      // Amount is re-checked. A captured payment for a different amount than we
      // recorded is a reconciliation problem, not a success.
      const captured = bdtToPoisha(Number(data.amount ?? 0));
      if (captured !== expectedAmountPoisha) {
        return {
          verified: false,
          status: "FAILED",
          gatewayPaymentId,
          amountPoisha: captured,
          reason: "amount mismatch",
        };
      }

      return {
        verified: true,
        status: "CAPTURED",
        gatewayPaymentId,
        amountPoisha: captured,
        gatewayReference: data.trxID,
      };
    } catch (error) {
      return {
        verified: false,
        status: "FAILED",
        gatewayPaymentId,
        reason: error instanceof Error ? error.message : "verification failed",
      };
    }
  }

  async refund(gatewayPaymentId: string, amountPoisha: number, reason: string): Promise<RefundResult> {
    try {
      const token = await this.grantToken();
      const { appKey, appSecret } = this.credentials();

      const response = await fetch(`${this.baseUrl}/tokenized/checkout/payment/refund`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          paymentID: gatewayPaymentId,
          trxID: "",
          amount: (amountPoisha / 100).toFixed(2),
          sku: reason.slice(0, 40),
          reason,
        }),
      });
      const data = (await response.json()) as { refundTrxID?: string; statusCode?: string };
      if (data.refundTrxID) {
        return { ok: true, gatewayRefundId: data.refundTrxID };
      }
      return { ok: false, reason: data.statusCode ?? "refund rejected" };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "refund failed" };
    }
  }

  /**
   * bKash signs callbacks with its own key rather than an HMAC of the body, so
   * signature checking is deferred to the status API. A callback is therefore
   * treated as a trigger to verify, never as a confirmation. Returning true
   * here means "well-formed, go and verify", and verifyCharge decides.
   */
  verifyWebhook(): boolean {
    return true;
  }

  parseWebhook(): WebhookEvent | null {
    return null;
  }
}

export function isBkashConfigured(): boolean {
  return Boolean(
    process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD,
  );
}

/**
 * Resolves the configured gateway.
 *
 * If bKash is selected but unconfigured, this throws rather than quietly
 * falling back to sandbox. A silent fallback in production is how a business
 * ends up taking bookings it can never settle.
 */
export function getGateway(): PaymentGateway {
  const configured = (process.env.PAYMENT_GATEWAY ?? "sandbox").toLowerCase();

  if (configured === "bkash") {
    if (!isBkashConfigured()) {
      throw new Error(
        "PAYMENT_GATEWAY is set to bkash but the merchant credentials are missing. " +
          "Set them, or set PAYMENT_GATEWAY=sandbox. Falling back silently would take money the platform cannot settle.",
      );
    }
    return new BkashGateway();
  }

  return sandboxGateway;
}
