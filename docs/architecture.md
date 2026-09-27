# FixBondhu production architecture

## Platform boundaries

| Interface | Audience | Server-side scope |
| --- | --- | --- |
| `fixbondhu.com` | customer | discovery, addresses, bookings, chat, payments, reviews, support |
| `pro.fixbondhu.com` | provider | onboarding, verification submission, services, availability, request actions, job updates, earnings |
| `admin.fixbondhu.com` | operations roles | controlled operational, financial, support, verification, content, and analytical actions |

All three applications use the same versioned API. The browser is never the authority for a role or verification badge.

## Booking invariants

`REQUESTED → ACCEPTED → ON_THE_WAY → ARRIVED → IN_PROGRESS → COMPLETED`

- Terminal / exceptional statuses: `CANCELLED`, `REJECTED`, `DISPUTED`, `NO_SHOW`.
- Every transition is executed in a database transaction, checked against an allowed transition table, and creates a `BookingStatusHistory` row.
- `AdditionalCharge` begins as `REQUESTED`; only customer approval permits it to become `APPROVED`. It is separately auditable.
- Reviews may be created only by the booking customer once, after a completed booking.

## Payment invariant

Create a `Payment` intent server-side. Mark it paid only when a configured provider's signed webhook is independently verified. Maintain raw provider event IDs idempotently. Refunds and payouts are ledger operations, never UI-only state changes.

## Async processing

Use Redis-backed workers and an outbox table. Transaction commit writes the domain event + outbox row; workers dispatch notifications, matching, receipts, reminders, analytics, and retries. This prevents a successful booking update from being lost when a notification service fails.

## Bangladesh launch strategy

Represent division, city, thana/upazila, and neighbourhood as structured location fields while retaining formatted address and latitude/longitude. Start with configured service zones and only expose a provider where their approved service area, availability, and published service intersect the requested location.

## API groups

- `/v1/auth`, `/v1/me`, `/v1/addresses`, `/v1/search`, `/v1/categories`
- `/v1/providers`, `/v1/provider/*`, `/v1/bookings`, `/v1/conversations`
- `/v1/payments`, `/v1/reviews`, `/v1/complaints`, `/v1/support`
- `/v1/admin/*` protected by an explicit permission guard and audit interceptor

Apply schema validation at API ingress, ownership checks per resource, file-content scanning for uploads, rate limits on auth/search/payment endpoints, and structured security/audit logs.
