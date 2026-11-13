import { formatTime } from "./format.ts";
import type { NaviInfo, NaviPlace, NaviTotals } from "./types.ts";

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** 원 단위 금액: 1,800원 (값 없으면 "-") */
export function wonCell(n: number | null | undefined): string {
  return isNum(n) ? `${Math.round(n).toLocaleString("ko-KR")}원` : "-";
}

/** 분 → "32분", "1시간 5분", "2시간" */
export function minutesLabel(min: number | null | undefined): string | null {
  if (!isNum(min) || min < 0) return null;
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 거리·시간을 한 줄로: "21.4km · 32분" */
export function distanceTime(km: number | null | undefined, min: number | null | undefined): string | null {
  const parts = [isNum(km) ? `${km.toFixed(1)}km` : null, minutesLabel(min)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** 장소: 이름과 주소 중 있는 것 */
export function placeLabel(p: NaviPlace | null | undefined): string | null {
  const parts = [p?.name, p?.address].filter((x): x is string => !!x && x.trim() !== "");
  return parts.length ? parts.join(" · ") : null;
}

/** 안내 결과: 도착(시각) / 도착 전 안내 취소 / 미도착 */
export function naviOutcome(n: NaviInfo): { label: string; tone: "ok" | "warn" | "muted" } {
  if (n.arrived) return { label: n.arrivedAt ? `도착 ${formatTime(n.arrivedAt)}` : "도착", tone: "ok" };
  if (n.cancelled) return { label: "도착 전 안내 취소", tone: "warn" };
  return { label: "도착 미확인", tone: "muted" };
}

/** 행이 내비를 사용했는지 */
export function usedNavi(n: NaviInfo | null | undefined): n is NaviInfo {
  return !!n && n.used;
}

export interface NaviItem {
  label: string;
  value: string;
}

/** 펼침 상세의 내비 항목. 값이 없는 항목은 빼고 순서를 고정한다(경유지는 따로 표시). */
export function naviItems(n: NaviInfo): NaviItem[] {
  const items: Array<[string, string | null]> = [
    ["목적지", n.destination?.name ?? null],
    ["목적지 주소", n.destination?.address ?? null],
    ["경로 옵션", n.routeOption],
    ["예상 거리·시간", distanceTime(n.plannedDistanceKm, n.plannedDurationMin)],
    ["실제 안내 거리·시간", distanceTime(n.naviDistanceKm, n.naviDurationMin)],
    ["통행료", isNum(n.tollFareWon) ? wonCell(n.tollFareWon) : null],
    ["재탐색", n.rerouteCount > 0 ? `${n.rerouteCount}회` : null],
    ["안내 결과", naviOutcome(n).label],
    ["에너지 소비", isNum(n.energyConsumptionKwh) ? `${n.energyConsumptionKwh.toFixed(2)}kWh` : null],
    ["도착 예상 배터리", isNum(n.estimatedSocAtDestPct) ? `${Math.round(n.estimatedSocAtDestPct)}%` : null],
    ["교통 상황", n.trafficStatus],
  ];
  return items.filter((x): x is [string, string] => typeof x[1] === "string" && x[1].trim() !== "").map(([label, value]) => ({ label, value }));
}

/** 상단 요약 보조 문구: "도착 3 · 취소 1 · 도착률 75.0%" */
export function naviTotalsLabel(t: NaviTotals): string {
  const rate = t.arrivalRate === null ? "-" : `${t.arrivalRate.toFixed(1)}%`;
  return `도착 ${t.arrived} · 취소 ${t.cancelled} · 도착률 ${rate}`;
}
