const MARKER_RE = /\[\[OPS_PREVIEW:([0-9a-fA-F]{64})\]\]/;
const LABEL_RE = /Mã xem trước:\s*`?([0-9a-fA-F]{64})`?/i;
const HEX64_RE = /\b([0-9a-fA-F]{64})\b/;

/** Pull Ops Agent preview token from bot reply text. */
export function extractPreviewToken(text: string | null | undefined): string | null {
  if (!text) return null;
  const marker = text.match(MARKER_RE);
  if (marker) return marker[1].toLowerCase();
  const labeled = text.match(LABEL_RE);
  if (labeled) return labeled[1].toLowerCase();
  if (/xem trước|preview_token|preview token|ops agent/i.test(text)) {
    const bare = text.match(HEX64_RE);
    if (bare) return bare[1].toLowerCase();
  }
  return null;
}

/** Remove machine marker so chat stays human-readable. */
export function stripPreviewMarkers(text: string): string {
  return text.replace(/\s*\[\[OPS_PREVIEW:[0-9a-fA-F]{64}\]\]\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
