import type { LedgerFilters, LedgerStatus, LedgerVehicle, ReportReason } from "./types.ts";

export const REASON_LABEL: Record<ReportReason, string> = {
  CLOSED: "운행 종료",
  IGNITION_OFF: "시동 OFF",
  CONFIRMED: "목적 확인",
  CORRECTED: "정정",
  GAP: "누락 운행",
  RESEND: "재전송",
};

export const STATUS_BADGE: Record<LedgerStatus, string> = {
  UNCONFIRMED: "badge badge-warn",
  CONFIRMED: "badge badge-ok",
  CORRECTED: "badge badge-navy",
};

export const FIELD_LABEL: Record<string, string> = { purpose: "목적", userId: "이용자", memo: "비고" };

/** 서버 쿼리스트링. 관리자 키는 절대 넣지 않는다(헤더로만 전송). */
export function ledgerQuery(f: LedgerFilters): string {
  const p = new URLSearchParams();
  if (f.vehicleId) p.set("vehicleId", f.vehicleId);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.status !== "all") p.set("status", f.status);
  if (!f.includeIncomplete) p.set("includeIncomplete", "0");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** 한국 시간 기준 오늘 YYYY-MM-DD */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 이번 달 1일 ~ 말일 */
export function monthPeriod(today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** 기본 기간: 차량의 사업연도가 있으면 사업연도, 없으면 이번 달 */
export function defaultPeriod(v: LedgerVehicle | undefined, today: string): { from: string; to: string } {
  if (v?.fiscalStart && v.fiscalEnd) return { from: v.fiscalStart, to: v.fiscalEnd };
  return monthPeriod(today);
}

/** 표 숫자 셀: 소수 1자리 고정 */
export function kmCell(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(1) : "-";
}

/** Content-Disposition 에서 파일 이름(UTF-8 우선) */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* 아래 일반 filename 사용 */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

/** 차량 선택 목록 이름 */
export function vehicleLabel(v: LedgerVehicle): string {
  const name = [v.plate, v.model].filter(Boolean).join(" · ");
  return name || `차량 ${v.vehicleId.slice(0, 8)}`;
}
