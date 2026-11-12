/** `#t=xxx` 형태의 해시에서 폰 토큰을 꺼낸다. 없으면 null. */
export function parseHashToken(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const v = new URLSearchParams(raw).get("t")?.trim();
  return v ? v : null;
}
