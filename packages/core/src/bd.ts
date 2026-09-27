/**
 * Bangladeshi phone numbers, human-quotable references and coordinates.
 */

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/**
 * Normalises to E.164 for Bangladesh: +8801XXXXXXXXX.
 *
 * Bangladeshi users type local numbers many ways -- 01712345678,
 * 8801712345678, +8801712345678, 01712-345678, and with spaces. All of them
 * must resolve to one identity, otherwise the same person registers twice and
 * verification badges become meaningless.
 *
 * Operator prefixes are not validated beyond the 013-019 range because
 * allocations shift; over-strict validation locks out real customers.
 */
export function normalizeBdPhone(input: string): string | null {
  if (!input) return null;

  // Keep digits only; drop +, -, spaces, parentheses and dots.
  let digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;

  // Strip a leading 00 international prefix.
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Already has the country code.
  if (digits.startsWith("880")) {
    digits = digits.slice(3);
  }

  // Local format: 10 digits starting 013-019, or 11 digits starting 0.
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10) return null;
  if (!/^1[3-9]\d{8}$/.test(digits)) return null;

  return `+880${digits}`;
}

/** 01712345678 -> 01712 345678, the way it is written in Bangladesh. */
export function formatBdPhone(phone: string): string {
  const e164 = normalizeBdPhone(phone);
  if (!e164) return phone;
  // e164 is "+880" + 10 national digits. Bangladeshi numbers are dialled
  // nationally as those 10 digits behind a leading 0, so it must be restored.
  const national = `0${e164.slice(4)}`;
  return `${national.slice(0, 5)} ${national.slice(5)}`;
}

export function isValidBdPhone(input: string): boolean {
  return normalizeBdPhone(input) !== null;
}

/**
 * Partial mask for provider phone numbers shown in admin and on provider cards.
 * Support staff can see the full number through an audited endpoint, but a
 * public provider card must not harvest customer phone numbers.
 */
export function maskPhone(phone: string): string {
  const e164 = normalizeBdPhone(phone);
  if (!e164) return "••••••••";
  return `+880${e164.slice(4, 6)} ••••••${e164.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

/**
 * Alphabet with no ambiguous characters: no O/0, I/1, S/5, Z/2, B/8. A
 * reference is read aloud over the phone to support staff, so "O" vs "0" is a
 * real support cost.
 */
const REFERENCE_ALPHABET = "2345679ACDEFGHJKLMNPQRTUVWXY";
const REFERENCE_LENGTH = 6;

/**
 * Random reference. Uniqueness is enforced by a unique index and retried on
 * conflict, so collisions are handled by the database rather than by a check
 * that could race.
 */
export function generateReference(prefix: string, random: () => number = Math.random): string {
  let body = "";
  for (let i = 0; i < REFERENCE_LENGTH; i += 1) {
    body += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}

export const REFERENCE_PREFIXES = {
  booking: "FB",
  complaint: "CMP",
  ticket: "TKT",
  payout: "PO",
  refund: "RF",
  referral: "REF",
} as const;

export function generateBookingReference(random?: () => number): string {
  return generateReference(REFERENCE_PREFIXES.booking, random);
}

export function generateComplaintReference(random?: () => number): string {
  return generateReference(REFERENCE_PREFIXES.complaint, random);
}

export function generateTicketReference(random?: () => number): string {
  return generateReference(REFERENCE_PREFIXES.ticket, random);
}

export function generatePayoutReference(random?: () => number): string {
  return generateReference(REFERENCE_PREFIXES.payout, random);
}

export function generateReferralCode(random: () => number = Math.random): string {
  return generateReference("FB", random);
}

/** URL-safe slug from Bangla or English text. */
export function slugify(input: string, fallback = "item"): string {
  const slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0980-\u09FF]/g, "") // Bangla has no Latin transliteration here
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

/** Slug that keeps Bangla, for Bangla-first URLs. */
export function slugifyBangla(input: string, fallback = "item"): string {
  const slug = input
    .normalize("NFC")
    .toLowerCase()
    // \p{M} keeps Bangla dependent vowel signs; without it every word loses
    // its vowels and "ঢাকা উত্তর" collapses to "ঢ-ক-উত-তর".
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Haversine distance in kilometres.
 *
 * Straight-line distance is deliberately not a road distance. FixBondhu's
 * service areas are defined as radii around a locality, and a customer
 * understands "within 5 km of Banani" as straight-line. Pretending to know the
 * driving route would overstate precision the platform does not have.
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidCoordinate(coord: Partial<LatLng> | null | undefined): coord is LatLng {
  return (
    !!coord &&
    typeof coord.latitude === "number" &&
    typeof coord.longitude === "number" &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude) &&
    coord.latitude >= -90 &&
    coord.latitude <= 90 &&
    coord.longitude >= -180 &&
    coord.longitude <= 180
  );
}

/** Asia/Dhaka has no daylight saving, so this is a fixed +06:00 offset. */
export const DHAKA_OFFSET_MINUTES = 6 * 60;
export const DHAKA_TIMEZONE = "Asia/Dhaka";
