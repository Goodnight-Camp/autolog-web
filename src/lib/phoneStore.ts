/**
 * 폰 브라우저 localStorage 래퍼. 계정이 없으므로 '내 이름·부서'와 '이 폰에서 보낸 신고'만 이 기기에 둔다.
 * 사생활 모드·저장소 차단 등으로 접근이 막혀도 앱이 멈추지 않게 모든 읽기·쓰기를 감싼다.
 */

import type { Purpose } from "./types.ts";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const PROFILE_KEY = "autolog.profile.v1";
export const HISTORY_KEY = "autolog.history.v1";
export const HISTORY_MAX = 50;
export const PROFILE_FIELD_MAX = 40;
/** 같은 탭에서 저장했을 때 알리는 이벤트(다른 탭은 storage 이벤트) */
export const PHONE_STORE_EVENT = "autolog:phone-store";

export interface Profile {
  name: string;
  dept: string;
}

export interface HistoryEntry {
  /** 신고 시각(ISO) */
  at: string;
  sessionId: string;
  plate: string | null;
  purpose: Purpose;
  userName: string | null;
  code: string | null;
}

const PURPOSE_SET = new Set<string>(["COMMUTE", "BUSINESS", "PERSONAL"]);

export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(store: StorageLike | null, key: string): unknown {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(store: StorageLike | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
    notify();
    return true;
  } catch {
    return false;
  }
}

function notify() {
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(PHONE_STORE_EVENT));
  } catch {
    /* 알림 실패는 무시 */
  }
}

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, PROFILE_FIELD_MAX) : "";
}

/** 저장된 내 정보. 이름이 없으면 null. */
export function parseProfile(v: unknown): Profile | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const name = clean(o.name);
  if (!name) return null;
  return { name, dept: clean(o.dept) };
}

export function loadProfile(store: StorageLike | null = browserStorage()): Profile | null {
  return parseProfile(readJson(store, PROFILE_KEY));
}

/** 이름이 비면 삭제와 같다. */
export function saveProfile(p: Profile, store: StorageLike | null = browserStorage()): boolean {
  const parsed = parseProfile(p);
  return writeJson(store, PROFILE_KEY, parsed);
}

export function clearProfile(store: StorageLike | null = browserStorage()): boolean {
  return writeJson(store, PROFILE_KEY, null);
}

function parseEntry(v: unknown): HistoryEntry | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== "string" || Number.isNaN(Date.parse(o.at))) return null;
  if (typeof o.purpose !== "string" || !PURPOSE_SET.has(o.purpose)) return null;
  const str = (x: unknown) => (typeof x === "string" && x ? x : null);
  return {
    at: o.at,
    sessionId: typeof o.sessionId === "string" ? o.sessionId : "",
    plate: str(o.plate),
    purpose: o.purpose as Purpose,
    userName: str(o.userName),
    code: str(o.code),
  };
}

/** 보낸 신고 내역, 최근순 */
export function loadHistory(store: StorageLike | null = browserStorage()): HistoryEntry[] {
  const v = readJson(store, HISTORY_KEY);
  if (!Array.isArray(v)) return [];
  return v
    .map(parseEntry)
    .filter((x): x is HistoryEntry => x !== null)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** 내역 추가(같은 세션 재신고는 최신 것으로 교체), 최대 HISTORY_MAX건 */
export function addHistory(entries: HistoryEntry[], store: StorageLike | null = browserStorage()): boolean {
  const ids = new Set(entries.map((e) => e.sessionId));
  const next = [...entries, ...loadHistory(store).filter((e) => !ids.has(e.sessionId))]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, HISTORY_MAX);
  return writeJson(store, HISTORY_KEY, next);
}

export function clearHistory(store: StorageLike | null = browserStorage()): boolean {
  return writeJson(store, HISTORY_KEY, null);
}

/** 사용자 칩용 이니셜(첫 글자) */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? "";
}
