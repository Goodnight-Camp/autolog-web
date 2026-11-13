import type {
  AdminSessionDetail,
  AdminSessionSummary,
  LedgerFilters,
  LedgerResponse,
  PhoneSession,
  SubmissionItem,
  VehicleReport,
} from "./types.ts";
import { fileNameFrom, ledgerQuery } from "./ledger.ts";

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

/** 운행기록부(차량·운행별 최신 행) */
export function adminLedger(
  key: string,
  filters: LedgerFilters,
  opts?: RequestOptions,
): Promise<LedgerResponse> {
  return request(`/api/admin/trips${ledgerQuery(filters)}`, { headers: adminHeaders(key) }, opts);
}

/** 한 행의 보고 이력(최신순) */
export function adminTripReports(
  key: string,
  row: { vehicleId: string; kind: string; tripId: number },
  opts?: RequestOptions,
): Promise<{ reports: VehicleReport[] }> {
  const q = new URLSearchParams({ vehicleId: row.vehicleId, kind: row.kind, tripId: String(row.tripId) });
  return request(`/api/admin/reports?${q}`, { headers: adminHeaders(key) }, opts);
}

/**
 * 운행기록부 파일(CSV/XLSX). 관리자 키를 헤더로 보내야 하므로 링크 대신 fetch → Blob 으로 받는다.
 * format: "nts"(기본) 국세청 별지 서식 배치, "raw" 화면 필터를 적용한 관리자 원본 표.
 */
export async function adminDownloadLedger(
  key: string,
  type: "csv" | "xlsx",
  filters: LedgerFilters,
  opts: RequestOptions & { format?: "nts" | "raw" } = {},
): Promise<{ blob: Blob; fileName: string }> {
  const base = opts.base ?? apiBase();
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    const q = ledgerQuery(filters);
    const fmt = opts.format === "raw" ? `${q ? "&" : "?"}format=raw` : "";
    res = await doFetch(`${base}/api/admin/ledger.${type}${q}${fmt}`, {
      headers: adminHeaders(key),
      cache: "no-store",
      signal: opts.signal,
    });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ApiError(0, "서버에 연결할 수 없어요. 네트워크를 확인해 주세요.");
  }
  if (!res.ok) {
    let msg = `내려받기에 실패했어요 (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error) msg = body.error;
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, msg);
  }
  return {
    blob: await res.blob(),
    fileName: fileNameFrom(res.headers.get("content-disposition"), `ledger.${type}`),
  };
}
