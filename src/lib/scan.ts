/** 폰 QR 스캔: 읽은 값 판정과 카메라 상태 분류(순수 함수). */

import { parseHashToken } from "./token.ts";

export type ScanResult = { ok: true; path: string } | { ok: false };

/** 서버 세션 ID: base64url 문자(newSessionId는 10자). 여유 있게 4~64자. */
const SESSION_ID = /^[A-Za-z0-9_-]{4,64}$/;

/**
 * 읽은 QR 값이 오토로그 차량 QR(joinUrl: `<web>/s/<id>#t=<token>`)이면 이 웹 안의 경로를 돌려준다.
 * 호스트는 보지 않는다(폰이 LAN IP·localhost 등 다른 주소로 들어와 있어도 같은 웹으로 연다).
 * 이동은 항상 현재 웹의 상대 경로로만 하므로 다른 사이트로 나가지 않는다.
 */
export function resolveScannedValue(raw: string | null | undefined): ScanResult {
  const value = raw?.trim();
  if (!value) return { ok: false };
  let url: URL;
  try {
    url = new URL(value, "http://autolog.invalid");
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
  const m = /^\/s\/([^/]+)\/?$/.exec(url.pathname);
  if (!m) return { ok: false };
  let id: string;
  try {
    id = decodeURIComponent(m[1]);
  } catch {
    return { ok: false };
  }
  if (!SESSION_ID.test(id)) return { ok: false };
  const token = parseHashToken(url.hash);
  if (!token) return { ok: false };
  return { ok: true, path: `/s/${id}#t=${encodeURIComponent(token)}` };
}

export type CameraProblem = "insecure" | "unsupported" | "denied" | "nocamera" | "busy" | "error";

/** 카메라를 쓸 수 없는 이유(쓸 수 있으면 null). getUserMedia는 HTTPS·localhost 같은 보안 컨텍스트에서만 열린다. */
export function cameraSupport(env: { isSecureContext: boolean; hasGetUserMedia: boolean }): CameraProblem | null {
  if (!env.isSecureContext) return "insecure";
  if (!env.hasGetUserMedia) return "unsupported";
  return null;
}

/** getUserMedia 오류 이름 → 안내 종류 */
export function classifyCameraError(e: unknown): CameraProblem {
  const name = typeof e === "object" && e !== null ? (e as { name?: unknown }).name : undefined;
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "nocamera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    default:
      return "error";
  }
}

/** 폰 셸 화면(관리자 상단 바를 숨김) */
export function isPhonePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/s/") ||
    ["/c", "/scan", "/trips", "/settings"].some((p) => pathname === p || pathname === `${p}/`)
  );
}

export type PhoneTab = "trips" | "scan" | "settings";

/** 하단 탭 선택 상태: 신고(/s/)·코드 입력(/c)은 QR 스캔 흐름 */
export function phoneTabOf(pathname: string | null | undefined): PhoneTab {
  if (pathname?.startsWith("/trips")) return "trips";
  if (pathname?.startsWith("/settings")) return "settings";
  return "scan";
}
