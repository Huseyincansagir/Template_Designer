/**
 * Single source of stable-ID generation.
 *
 * There were two generators: `Core/editor-application.ts` called
 * `crypto.randomUUID()` bare, and `Domain/factories.ts` called it behind a
 * guard with a different fallback. So one document could carry ids in two
 * formats, and the Core path threw outright wherever `crypto.randomUUID` is
 * unavailable (non-secure contexts, older engines) while the factory path
 * degraded quietly. Identity is the one thing every layer agrees on, so it is
 * generated in exactly one place.
 *
 * NOTE ON COMPOSITION — deliberately not encoded here.
 * `WIDGET_SYSTEM_QUESTIONNAIRE_V1:219` requires stable-ID generation to be
 * deterministic and collision-free. This generator is collision-free but NOT
 * deterministic, which is a known, recorded gap. It is not closed yet because
 * the *composition* the determinism would serve is still contradictory in the
 * specification: `WIDGET_SYSTEM_QUESTIONNAIRE_V1:191-203` wants Theme AND
 * Rotation identity embedded (`T01R03M0042`), `MEDIA_ASSET_BROWSER_
 * QUESTIONNAIRE_V1:113-121` argues an asset is not rotation-specific and
 * prefers `T01-A0042`, and `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:456,504`
 * records the package/ID model as explicitly undecided. Picking a scheme here
 * would be inventing a product decision and would very likely force a second
 * id migration once the firmware contract lands. See
 * `docs/PRODUCT_COMPLETION_LEDGER.md` (C10a) for the decision record.
 */
export type IdPrefix = "project" | "theme-group" | "theme" | "rotation" | "scene" | "widget" | "binding" | "asset" | "floor-mapping" | "floor-entry" | "media-item";

/** 128 bits of randomness in the same 8-4-4-4-12 shape as a UUID, without requiring one. */
function fallbackUuid(): string {
  const bytes = new Uint8Array(16);
  const source = typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function"
    ? globalThis.crypto
    : undefined;
  if (source) {
    source.getRandomValues(bytes);
  } else {
    // Last resort only: no Web Crypto at all. Still 16 bytes wide so the id
    // shape never varies between environments.
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 version/variant bits, so the value is a well-formed v4 string.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createStableId(prefix: IdPrefix): string {
  const uuid = typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : fallbackUuid();
  return `${prefix}-${uuid}`;
}
