import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceTime, minutesLabel, naviItems, naviOutcome, naviTotalsLabel, placeLabel, usedNavi, wonCell } from "./navi.ts";
import type { LedgerRow, LedgerTotals, NaviInfo } from "./types.ts";

const full: NaviInfo = {
  used: true,
  destination: { name: "판교 사옥", address: "경기 성남시 분당구 판교역로 1" },
  routeOption: "추천",
  plannedDistanceKm: 21.4,
  plannedDurationMin: 32,
  tollFareWon: 1800,
  rerouteCount: 2,
  waypoints: [{ name: "양재 IC", address: null, arrived: true }],
  arrived: true,
  arrivedAt: "2026-11-09T23:30:00Z",
  naviDistanceKm: 21.9,
  naviDurationMin: 65,
  cancelled: false,
  energyConsumptionKwh: 3.4,
  estimatedSocAtDestPct: 71.4,
  trafficStatus: "원활",
};

const empty: NaviInfo = {
  used: true,
  destination: { name: null, address: null },
  routeOption: null,
  plannedDistanceKm: null,
  plannedDurationMin: null,
  tollFareWon: null,
  rerouteCount: 0,
  waypoints: [],
  arrived: false,
  arrivedAt: null,
  naviDistanceKm: null,
  naviDurationMin: null,
  cancelled: false,
  energyConsumptionKwh: null,
  estimatedSocAtDestPct: null,
  trafficStatus: null,
};

test("금액·시간·거리 포매터", () => {
  assert.equal(wonCell(1800), "1,800원");
  assert.equal(wonCell(0), "0원");
  assert.equal(wonCell(null), "-");
  assert.equal(minutesLabel(32), "32분");
  assert.equal(minutesLabel(65), "1시간 5분");
  assert.equal(minutesLabel(120), "2시간");
  assert.equal(minutesLabel(null), null);
  assert.equal(minutesLabel(-1), null);
  assert.equal(distanceTime(21.4, 32), "21.4km · 32분");
  assert.equal(distanceTime(null, 32), "32분");
  assert.equal(distanceTime(null, null), null);
  assert.equal(placeLabel({ name: "판교", address: null }), "판교");
  assert.equal(placeLabel({ name: " ", address: null }), null);
});

test("안내 결과: 도착(KST 시각) / 도착 전 안내 취소 / 도착 미확인", () => {
  assert.deepEqual(naviOutcome(full), { label: "도착 08:30", tone: "ok" });
  assert.deepEqual(naviOutcome({ ...full, arrivedAt: null }), { label: "도착", tone: "ok" });
  assert.deepEqual(naviOutcome({ ...empty, cancelled: true }), { label: "도착 전 안내 취소", tone: "warn" });
  assert.deepEqual(naviOutcome(empty), { label: "도착 미확인", tone: "muted" });
});

test("상세 항목: 모든 값이 있으면 순서대로, 없는 값은 숨김", () => {
  assert.deepEqual(
    naviItems(full).map((i) => `${i.label}=${i.value}`),
    [
      "목적지=판교 사옥",
      "목적지 주소=경기 성남시 분당구 판교역로 1",
      "경로 옵션=추천",
      "예상 거리·시간=21.4km · 32분",
      "실제 안내 거리·시간=21.9km · 1시간 5분",
      "통행료=1,800원",
      "재탐색=2회",
      "안내 결과=도착 08:30",
      "에너지 소비=3.40kWh",
      "도착 예상 배터리=71%",
      "교통 상황=원활",
    ],
  );
  // 값이 하나도 없으면 안내 결과만 남는다(재탐색 0회도 숨김)
  assert.deepEqual(naviItems(empty), [{ label: "안내 결과", value: "도착 미확인" }]);
  // 통행료 0원은 값이므로 표시
  assert.ok(naviItems({ ...empty, tollFareWon: 0 }).some((i) => i.label === "통행료" && i.value === "0원"));
});

test("내비 사용 여부와 집계 문구, 타입 호환(이전 서버 응답엔 navi 없음)", () => {
  assert.equal(usedNavi(full), true);
  assert.equal(usedNavi(null), false);
  assert.equal(usedNavi(undefined), false);
  assert.equal(naviTotalsLabel({ trips: 4, arrived: 3, cancelled: 1, arrivalRate: 75, tollWon: 3600, tollTrips: 2 }), "도착 3 · 취소 1 · 도착률 75.0%");
  assert.equal(naviTotalsLabel({ trips: 0, arrived: 0, cancelled: 0, arrivalRate: null, tollWon: 0, tollTrips: 0 }), "도착 0 · 취소 0 · 도착률 -");
  const oldRow = {} as Pick<LedgerRow, "navi">;
  const oldTotals = {} as Pick<LedgerTotals, "navi">;
  assert.equal(usedNavi(oldRow.navi), false);
  assert.equal(oldTotals.navi, undefined);
});
