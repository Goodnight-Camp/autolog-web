import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraSupport, classifyCameraError, resolveScannedValue } from "./scan.ts";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  PROFILE_KEY,
  addHistory,
  clearHistory,
  clearProfile,
  initialOf,
  loadHistory,
  loadProfile,
  saveProfile,
  type HistoryEntry,
  type StorageLike,
} from "./phoneStore.ts";
import { formatDateTimeShort } from "./format.ts";
import { initForm } from "./confirmForm.ts";
import type { PhoneSession } from "./types.ts";

function memStore(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

const broken: StorageLike = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};

test("resolveScannedValue: 차량 joinUrl은 이 웹의 상대 경로로", () => {
  assert.deepEqual(resolveScannedValue("http://192.168.0.5:3000/s/AbC_12-xyz#t=tok-EN_1"), {
    ok: true,
    path: "/s/AbC_12-xyz#t=tok-EN_1",
  });
  // 다른 호스트여도 경로만 쓴다(외부로 이동하지 않음)
  assert.deepEqual(resolveScannedValue("https://evil.example/s/abcd1234#t=x"), { ok: true, path: "/s/abcd1234#t=x" });
  assert.deepEqual(resolveScannedValue(" /s/abcd1234/#x=1&t=a%2Bb "), { ok: true, path: "/s/abcd1234#t=a%2Bb" });
});

test("resolveScannedValue: 오토로그 QR이 아니면 거절", () => {
  for (const v of [
    "",
    null,
    "hello",
    "http://host/s/abcd1234",
    "http://host/s/abcd1234#t=",
    "http://host/x/abcd1234#t=a",
    "http://host/s/abcd1234/extra#t=a",
    "http://host/s/a#t=a",
    "javascript:alert(1)//s/abcd1234#t=a",
    "WIFI:S:x;T:WPA;P:y;;",
    "http://host/s/%E0%A4%A#t=a",
  ]) {
    assert.deepEqual(resolveScannedValue(v), { ok: false }, String(v));
  }
});

test("cameraSupport / classifyCameraError", () => {
  assert.equal(cameraSupport({ isSecureContext: false, hasGetUserMedia: false }), "insecure");
  assert.equal(cameraSupport({ isSecureContext: true, hasGetUserMedia: false }), "unsupported");
  assert.equal(cameraSupport({ isSecureContext: true, hasGetUserMedia: true }), null);
  assert.equal(classifyCameraError({ name: "NotAllowedError" }), "denied");
  assert.equal(classifyCameraError({ name: "NotFoundError" }), "nocamera");
  assert.equal(classifyCameraError({ name: "OverconstrainedError" }), "nocamera");
  assert.equal(classifyCameraError({ name: "NotReadableError" }), "busy");
  assert.equal(classifyCameraError(new Error("x")), "error");
  assert.equal(classifyCameraError(null), "error");
});

test("profile: 저장·읽기·삭제, 이름 없으면 null", () => {
  const s = memStore();
  assert.equal(loadProfile(s), null);
  assert.equal(saveProfile({ name: "  김민수 ", dept: " 영업팀 " }, s), true);
  assert.deepEqual(loadProfile(s), { name: "김민수", dept: "영업팀" });
  saveProfile({ name: "가".repeat(60), dept: "" }, s);
  assert.equal(loadProfile(s)?.name.length, 40);
  saveProfile({ name: "  ", dept: "영업" }, s);
  assert.equal(s.data.has(PROFILE_KEY), false);
  saveProfile({ name: "김", dept: "" }, s);
  clearProfile(s);
  assert.equal(loadProfile(s), null);
  s.data.set(PROFILE_KEY, "{not json");
  assert.equal(loadProfile(s), null);
});

test("저장소가 막혀도 예외 없이 동작", () => {
  assert.equal(loadProfile(broken), null);
  assert.equal(saveProfile({ name: "김", dept: "" }, broken), false);
  assert.deepEqual(loadHistory(broken), []);
  assert.equal(addHistory([], broken), false);
  assert.equal(loadProfile(null), null);
});

const entry = (at: string, sessionId: string): HistoryEntry => ({
  at, sessionId, plate: "12가3456", purpose: "BUSINESS", userName: "김민수", code: null,
});

test("history: 최근순, 같은 세션은 교체, 최대 건수, 잘못된 항목 무시", () => {
  const s = memStore();
  addHistory([entry("2026-11-10T00:00:00Z", "a")], s);
  addHistory([entry("2026-11-12T00:00:00Z", "b")], s);
  addHistory([{ ...entry("2026-11-13T00:00:00Z", "a"), purpose: "PERSONAL" }], s);
  const h = loadHistory(s);
  assert.deepEqual(h.map((x) => x.sessionId), ["a", "b"]);
  assert.equal(h[0].purpose, "PERSONAL");

  s.data.set(HISTORY_KEY, JSON.stringify([entry("2026-11-01T00:00:00Z", "z"), { at: "bad" }, { ...entry("2026-11-02T00:00:00Z", "y"), purpose: "X" }, 3]));
  assert.deepEqual(loadHistory(s).map((x) => x.sessionId), ["z"]);

  clearHistory(s);
  for (let i = 0; i < HISTORY_MAX + 5; i++) addHistory([entry(new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), `s${i}`)], s);
  assert.equal(loadHistory(s).length, HISTORY_MAX);
  assert.equal(loadHistory(s)[0].sessionId, `s${HISTORY_MAX + 4}`);
  clearHistory(s);
  assert.deepEqual(loadHistory(s), []);
});

test("initialOf", () => {
  assert.equal(initialOf(" 김민수"), "김");
  assert.equal(initialOf(""), "");
});

test("formatDateTimeShort: Asia/Seoul 기준", () => {
  assert.equal(formatDateTimeShort("2026-11-11T23:12:00Z"), "11월 12일 (목) 08:12");
  assert.equal(formatDateTimeShort(null), "-");
});

test("initForm: 이 폰에 저장한 이름을 이용자 기본값으로", () => {
  const session: PhoneSession = {
    sessionId: "s1",
    vehicle: { plate: "12가3456" },
    people: [{ id: "u1", name: "이기아", dept: "" }],
    trips: [{ id: 1, startedAt: "2026-11-12T00:00:00Z", endedAt: "", userId: "u1" }],
    expiresAt: "",
    submittedTripIds: [],
  };
  assert.equal(initForm(session)[1].userName, "이기아");
  assert.equal(initForm(session, " 김민수 ")[1].userName, "김민수");
  assert.equal(initForm(session, "  ")[1].userName, "이기아");
});

test("isPhonePath / phoneTabOf", async () => {
  const { isPhonePath, phoneTabOf } = await import("./scan.ts");
  for (const p of ["/s/abc", "/c", "/scan", "/trips", "/settings/"]) assert.equal(isPhonePath(p), true, p);
  for (const p of ["/", "/admin", "/admin/sessions", "/scanner", "/c/x", null]) assert.equal(isPhonePath(p), false, String(p));
  assert.equal(phoneTabOf("/trips"), "trips");
  assert.equal(phoneTabOf("/settings"), "settings");
  assert.equal(phoneTabOf("/s/abc"), "scan");
  assert.equal(phoneTabOf("/c"), "scan");
});
