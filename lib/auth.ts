import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Routes reachable without the dashboard password.
 * Keep this list minimal. A new public route (e.g. a bot webhook) must verify
 * the calling platform's signature itself and ship with a test here.
 */
const PUBLIC_PATHS = new Set(["/api/health"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/** Compares in constant time by hashing both sides to equal-length digests. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Validates an HTTP Basic `Authorization` header.
 * Fails closed: with no configured password nothing is ever accepted.
 */
export function checkBasicAuth(
  header: string | null,
  user: string | undefined,
  password: string | undefined,
): boolean {
  if (!password) return false;
  if (!header?.startsWith("Basic ")) return false;

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;

  // Evaluate both comparisons (no short-circuit) so timing doesn't reveal which one failed.
  const userOk = safeEqual(decoded.slice(0, sep), user || "admin");
  const passOk = safeEqual(decoded.slice(sep + 1), password);
  return userOk && passOk;
}
