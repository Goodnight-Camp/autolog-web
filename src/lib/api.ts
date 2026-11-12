import type {
  AdminSessionDetail,
  AdminSessionSummary,
  PhoneSession,
  SubmissionItem,
} from "./types.ts";

/** HTTP 오류. status 0 은 네트워크 오류(서버에 닿지 못함)를 뜻한다. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type LocationLike = Pick<Location, "protocol" | "hostname">;

/**
 * API 베이스 URL.
 * NEXT_PUBLIC_API_URL 이 있으면 그대로, 없으면 현재 접속 호스트의 4000 포트.
 * (폰이 PC의 LAN IP:3000 으로 접속하므로 같은 호스트의 4000 이 서버)
 */
export function resolveApiBase(
  envUrl: string | undefined,
  loc: LocationLike | undefined,
): string {
  const trimmed = envUrl?.trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");
  if (loc) return `${loc.protocol}//${loc.hostname}:4000`;
  return "http://localhost:4000";
}

export function apiBase(): string {
  return resolveApiBase(
    process.env.NEXT_PUBLIC_API_URL,
    typeof window === "undefined" ? undefined : window.location,
  );
}

export interface RequestOptions {
  base?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function isAbort(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError"
  );
}

async function request<T>(
  path: string,
  init: RequestInit,
  opts: RequestOptions = {},
): Promise<T> {
  const base = opts.base ?? apiBase();
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ApiError(0, "서버에 연결할 수 없어요. 네트워크를 확인해 주세요.");
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const err =
      body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
    const msg = typeof err === "string" && err ? err : `요청에 실패했어요 (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

const enc = encodeURIComponent;

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** 폰: 세션 조회. 토큰은 Authorization 헤더로만 보낸다(URL 금지). */
export function getSession(
  sessionId: string,
  token: string,
  opts?: RequestOptions,
): Promise<PhoneSession> {
  return request<PhoneSession>(
    `/api/sessions/${enc(sessionId)}`,
    { method: "GET", headers: bearer(token) },
    opts,
  );
}

/** 폰: 확인 결과 제출 */
export function submitTrips(
  sessionId: string,
  token: string,
  items: SubmissionItem[],
  opts?: RequestOptions,
): Promise<{ accepted: number }> {
  return request<{ accepted: number }>(
    `/api/sessions/${enc(sessionId)}/submissions`,
    {
      method: "POST",
      headers: { ...bearer(token), "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    },
    opts,
  );
}

function adminHeaders(key: string): Record<string, string> {
  return { "X-Admin-Key": key };
}

export function adminListSessions(
  key: string,
  opts?: RequestOptions,
): Promise<{ sessions: AdminSessionSummary[] }> {
  return request(`/api/admin/sessions`, { headers: adminHeaders(key) }, opts);
}

export function adminGetSession(
  key: string,
  sessionId: string,
  opts?: RequestOptions,
): Promise<AdminSessionDetail> {
  return request(
    `/api/admin/sessions/${enc(sessionId)}`,
    { headers: adminHeaders(key) },
    opts,
  );
}
