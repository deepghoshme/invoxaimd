import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Short, random, non-sequential public id for "many" page types (opp/pay/…).
 * 9 chars of base62 (~53 bits) — guess-resistant, URL-safe. Per URL-STRUCTURE.md.
 */
export function publicId(len = 9): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
