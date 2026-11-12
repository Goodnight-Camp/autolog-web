import type { Purpose, SuggestedPurpose } from "./types.ts";

export const TZ = "Asia/Seoul";

export const PURPOSES: readonly Purpose[] = ["COMMUTE", "BUSINESS", "PERSONAL"];

export const PURPOSE_LABEL: Record<SuggestedPurpose, string> = {
  COMMUTE: "출퇴근",
  BUSINESS: "업무",
  PERSONAL: "개인",
  UNKNOWN: "미분류",
};

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  month: "long",
  day: "numeric",
  weekday: "short",
});

const timeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 예: "11월 12일 (목)" */
export function formatDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? dateFmt.format(d) : "-";
}

/** 예: "08:42" */
export function formatTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? timeFmt.format(d) : "-";
}

/** 예: "2026. 11. 12. 08:42:10" */
export function formatDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? dateTimeFmt.format(d) : "-";
}

/** 예: 12.345 → "12.3 km" */
export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return "- km";
  return `${km.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} km`;
}

export function routeLabel(from: string | null, to: string | null): string {
  return `${from?.trim() || "알 수 없음"} → ${to?.trim() || "알 수 없음"}`;
}

/** 추천 목적을 정규화한다. null·UNKNOWN·알 수 없는 값은 null. */
export function suggestedPurpose(s: string | null | undefined): Purpose | null {
  return (PURPOSES as readonly string[]).includes(s ?? "") ? (s as Purpose) : null;
}

/** 추천 목적 배지 문구. 예: "업무", 없으면 "미분류" */
export function suggestedLabel(s: string | null | undefined): string {
  const p = suggestedPurpose(s);
  return p ? PURPOSE_LABEL[p] : PURPOSE_LABEL.UNKNOWN;
}
