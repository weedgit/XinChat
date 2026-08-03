/** Group invite QR payload helpers (JD join-via-QR; has no group QR). */

const JOIN_PREFIX = "xinchat://join/";
const LEGACY_JOIN_PREFIX = "qchat://join/";

/** Encode a group public_id into a scannable invite payload. */
export function encodeGroupJoinPayload(publicId: string): string {
  const id = publicId.trim();
  if (!id) return "";
  return `${JOIN_PREFIX}${id}`;
}

/**
 * Extract a group public_id from typed/pasted/scanned text.
 * Accepts raw IDs (Gxxxxxxxx) or xinchat://join/… (also legacy qchat://join/…).
 */
export function parseGroupJoinPayload(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  for (const prefix of [JOIN_PREFIX, LEGACY_JOIN_PREFIX]) {
    if (text.startsWith(prefix)) {
      const id = text.slice(prefix.length).trim();
      return id || null;
    }
  }
  try {
    const url = new URL(text);
    if (
      (url.protocol === "xinchat:" || url.protocol === "qchat:") &&
      url.hostname === "join"
    ) {
      const id = url.pathname.replace(/^\//, "").trim();
      return id || null;
    }
  } catch {
    /* not a URL */
  }
  // Raw public_id e.g. Gxxxxxxxx
  if (/^G[A-Za-z0-9]+$/i.test(text)) return text;
  return null;
}
