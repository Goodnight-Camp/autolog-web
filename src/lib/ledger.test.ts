import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, adminDownloadLedger, adminLedger, adminTripReports } from "./api.ts";
import { defaultPeriod, fileNameFrom, kmCell, kstToday, ledgerQuery, monthPeriod, vehicleLabel } from "./ledger.ts";
import type { LedgerFilters, LedgerVehicle } from "./types.ts";

const vehicle: LedgerVehicle = {
  vehicleId: "7dd53871-2965-43f7-8b72-88ad5c421393", plate: "123가4567", company: "데모", bizNo: "2208162517",
  model: "IONIQ 5", fuel: "전기", fiscalStart: "2026-01-01", fiscalEnd: "2026-12-31", adminEmail: null,
  lastReportedAt: "2026-11-12T01:00:00Z", rowCount: 5,
};
const filters: LedgerFilters = { vehicleId: vehicle.vehicleId, from: "2026-01-01", to: "2026-12-31", status: "all", includeIncomplete: true };

test("ledgerQuery: 기본값은 생략, 키는 넣지 않음", () => {
  assert.equal(ledgerQuery({ ...filters, vehicleId: null, from: null, to: null }), "");
  assert.equal(ledgerQuery({ ...filters, status: "unconfirmed", includeIncomplete: false }), `?vehicleId=${vehicle.vehicleId}&from=2026-01-01&to=2026-12-31&status=unconfirmed&includeIncomplete=0`);
});

test("기간: 사업연도 우선, 없으면 이번 달(말일 포함)", () => {
  assert.deepEqual(defaultPeriod(vehicle, "2026-11-12"), { from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(defaultPeriod({ ...vehicle, fiscalStart: null }, "2026-02-12"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthPeriod("2028-02-03"), { from: "2028-02-01", to: "2028-02-29" });
  assert.equal(kstToday(new Date("2026-11-11T16:00:00Z")), "2026-11-12");
});

test("표시 헬퍼", () => {
  assert.equal(kmCell(18), "18.0");
  assert.equal(kmCell(null), "-");
  assert.equal(vehicleLabel(vehicle), "123가4567 · IONIQ 5");
  assert.equal(vehicleLabel({ ...vehicle, plate: null, model: null }), "차량 7dd53871");
  assert.equal(fileNameFrom(`attachment; filename="ledger.csv"; filename*=UTF-8''%EC%9A%B4%ED%96%89.csv`, "x"), "운행.csv");
  assert.equal(fileNameFrom(`attachment; filename="ledger.xlsx"`, "x"), "ledger.xlsx");
  assert.equal(fileNameFrom(null, "x"), "x");
});

type Seen = { url?: string; headers?: Record<string, string> };
function fake(status: number, body: BodyInit | null, seen: Seen, headers: Record<string, string> = {}) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.headers = init?.headers as Record<string, string>;
    return new Response(body, { status, headers });
  }) as typeof fetch;
}

test("관리자 조회: 키는 헤더로만", async () => {
  const seen: Seen = {};
  await adminLedger("ADMINKEY", filters, { base: "http://x:4000", fetchImpl: fake(200, "{}", seen) });
  assert.ok(seen.url!.startsWith("http://x:4000/api/admin/trips?vehicleId="));
  assert.ok(!seen.url!.includes("ADMINKEY"));
  assert.equal(seen.headers!["X-Admin-Key"], "ADMINKEY");
  await adminTripReports("K", { vehicleId: "v1", kind: "GAP", tripId: 7 }, { base: "http://x:4000", fetchImpl: fake(200, '{"reports":[]}', seen) });
  assert.equal(seen.url, "http://x:4000/api/admin/reports?vehicleId=v1&kind=GAP&tripId=7");
});

test("내려받기: Blob과 파일 이름, 오류 메시지", async () => {
  const seen: Seen = {};
  const ok = await adminDownloadLedger("K", "xlsx", filters, {
    base: "http://x:4000",
    fetchImpl: fake(200, "PK", seen, { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("운행기록부.xlsx")}` }),
  });
  assert.equal(ok.fileName, "운행기록부.xlsx");
  assert.equal(await ok.blob.text(), "PK");
  assert.ok(seen.url!.includes("/api/admin/ledger.xlsx?"));
  assert.ok(!seen.url!.includes("K&") && !seen.url!.includes("key"));
  assert.ok(!seen.url!.includes("format="));
  await adminDownloadLedger("K", "csv", filters, { base: "http://x:4000", fetchImpl: fake(200, "x", seen), format: "raw" });
  assert.ok(seen.url!.startsWith("http://x:4000/api/admin/ledger.csv?vehicleId="));
  assert.ok(seen.url!.endsWith("&format=raw"));
  await adminDownloadLedger("K", "csv", { ...filters, vehicleId: null, from: null, to: null, status: "all", includeIncomplete: true }, { base: "http://x:4000", fetchImpl: fake(200, "x", seen), format: "raw" });
  assert.equal(seen.url, "http://x:4000/api/admin/ledger.csv?format=raw");
  await assert.rejects(
    adminDownloadLedger("K", "csv", filters, { base: "http://x:4000", fetchImpl: fake(400, JSON.stringify({ error: "차량을 선택하세요." }), seen) }),
    (e: unknown) => e instanceof ApiError && e.status === 400 && e.message === "차량을 선택하세요.",
  );
});
