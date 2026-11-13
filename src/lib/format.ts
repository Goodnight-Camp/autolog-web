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


/** 예: "11월 12일 (목) 08:12" (확인 완료 화면·내 운행) */
export function formatDateTimeShort(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? `${dateFmt.format(d)} ${timeFmt.format(d)}` : "-";
}
