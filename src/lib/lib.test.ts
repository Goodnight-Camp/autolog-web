import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHashToken } from "./token.ts";
import { ApiError, getSession, resolveApiBase, submitTrips } from "./api.ts";
import {
  MEMO_MAX,
  USER_NAME_MAX,
  confirmFormReducer,
  initForm,
  toSubmissionItems,
} from "./confirmForm.ts";
import { formatTime } from "./format.ts";
import type { PhoneSession } from "./types.ts";

const session: PhoneSession = {
  sessionId: "s1",
  vehicle: { plate: "12가3456" },
  people: [
    { id: "u1", name: "김현대", dept: "영업" },
    { id: "u2", name: "이기아", dept: "총무" },
  ],
  trips: [
    {
      id: 1, startedAt: "2026-11-11T23:30:00Z", endedAt: "2026-11-12T00:10:00Z", userId: "u1",
    },
    {
      id: 2, startedAt: "2026-11-12T02:00:00Z", endedAt: "2026-11-12T03:00:00Z", userId: "ghost",
    },
    {
      id: 3, startedAt: "2026-11-12T05:00:00Z", endedAt: "2026-11-12T06:00:00Z", userId: null,
    },
  ],
  expiresAt: "2026-11-12T10:00:00Z",
  submittedTripIds: [3],
};

test("parseHashToken", () => {
  assert.equal(parseHashToken("#t=abc"), "abc");
  assert.equal(parseHashToken("#x=1&t=a%2Bb"), "a+b");
  assert.equal(parseHashToken("#t="), null);
  assert.equal(parseHashToken(""), null);
  assert.equal(parseHashToken(undefined), null);
});

test("resolveApiBase: env 우선, 없으면 같은 호스트 4000", () => {
  assert.equal(resolveApiBase("http://api.local:9000/", undefined), "http://api.local:9000");
  assert.equal(
    resolveApiBase("", { protocol: "http:", hostname: "192.168.0.5" }),
    "http://192.168.0.5:4000",
  );
});

test("initForm: 목적은 미리 고르지 않음·기본 이용자·보냄 제외", () => {
  const s = initForm(session);
  // 목적은 비워 둔다.
  assert.deepEqual(s[1], { purpose: null, userName: "김현대", memo: "", include: true });
  // people 에 없는 userId 는 null, 메모는 폰에서 다루지 않음
  assert.deepEqual(s[2], { purpose: null, userName: "", memo: "", include: true });
  assert.equal(s[3].include, false);
  // 목적을 고르기 전에는 보낼 항목이 없다.
  assert.deepEqual(toSubmissionItems(s, session.trips), []);
});

test("reducer: 직접 고른 목적만 제출, 메모 길이 제한, 재제출", () => {
  let s = initForm(session);
  s = confirmFormReducer(s, { type: "purpose", tripId: 1, purpose: "COMMUTE" });
  s = confirmFormReducer(s, { type: "purpose", tripId: 2, purpose: "PERSONAL" });
  s = confirmFormReducer(s, { type: "memo", tripId: 1, memo: "가".repeat(300) });
  s = confirmFormReducer(s, { type: "include", tripId: 3, include: true });
  s = confirmFormReducer(s, { type: "purpose", tripId: 3, purpose: "BUSINESS" });
  s = confirmFormReducer(s, { type: "user", tripId: 3, userName: "  박새로이 " });
  s = confirmFormReducer(s, { type: "user", tripId: 2, userName: "가".repeat(60) });
  assert.equal(s[2].userName.length, USER_NAME_MAX);
  s = confirmFormReducer(s, { type: "user", tripId: 2, userName: "   " });
  assert.equal(s[1].memo.length, MEMO_MAX);
  const items = toSubmissionItems(s, session.trips);
  // 이용자는 이름 텍스트로만 보낸다(공백 제거, 비우면 null → 차량에 기록된 이용자 유지).
  assert.deepEqual(items.map((i) => [i.tripId, i.purpose, i.userId, i.userName]), [
    [1, "COMMUTE", null, "김현대"],
    [2, "PERSONAL", null, null],
    [3, "BUSINESS", null, "박새로이"],
  ]);
  assert.equal(items[1].memo, null);
  assert.equal(items[2].memo, null);
});

test("formatTime: Asia/Seoul", () => {
  assert.equal(formatTime("2026-11-11T23:30:00Z"), "08:30");
});

function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.url = String(url);
    seen.init = init;
    return new Response(body == null ? "" : JSON.stringify(body), { status });
  }) as typeof fetch;
}

test("getSession: 토큰은 헤더로만, URL 에 없음", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const res = await getSession("s 1", "SECRET", {
    base: "http://x:4000",
    fetchImpl: fakeFetch(200, session, seen),
  });
  assert.equal(res.sessionId, "s1");
  assert.equal(seen.url, "http://x:4000/api/sessions/s%201");
  assert.ok(!seen.url!.includes("SECRET"));
  assert.equal((seen.init!.headers as Record<string, string>).Authorization, "Bearer SECRET");
});

test("submitTrips: 본문 형식과 400 오류 메시지", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const items = [{ tripId: 1, purpose: "BUSINESS" as const, userId: null, userName: "김현대", memo: null }];
  const ok = await submitTrips("s1", "T", items, {
    base: "http://x",
    fetchImpl: fakeFetch(201, { accepted: 1 }, seen),
  });
  assert.equal(ok.accepted, 1);
  assert.equal(seen.init!.method, "POST");
  assert.deepEqual(JSON.parse(String(seen.init!.body)), { items });

  await assert.rejects(
    submitTrips("s1", "T", items, {
      base: "http://x",
      fetchImpl: fakeFetch(400, { error: "목적이 올바르지 않습니다" }, {}),
    }),
    (e: unknown) => e instanceof ApiError && e.status === 400 && e.message === "목적이 올바르지 않습니다",
  );
});

test("네트워크 오류는 status 0", async () => {
  await assert.rejects(
    getSession("s1", "T", {
      base: "http://x",
      fetchImpl: (async () => {
        throw new TypeError("fail");
      }) as typeof fetch,
    }),
    (e: unknown) => e instanceof ApiError && e.status === 0,
  );
});

test("구버전 서버가 옛 필드(거리·장소·추천)를 보내도 목적은 미선택", () => {
  const legacyTrip = { ...session.trips[0], distanceKm: 12, from: "집", to: "회사", suggested: "COMMUTE" };
  const s = initForm({ ...session, trips: [legacyTrip], submittedTripIds: [] });
  assert.equal(s[1].purpose, null);
});

test("formatJoinCode: 대문자·영숫자만·4자리 하이픈", async () => {
  const { formatJoinCode } = await import("./api.ts");
  assert.equal(formatJoinCode("y9hh5xck"), "Y9HH-5XCK");
  assert.equal(formatJoinCode("Y9H"), "Y9H");
  assert.equal(formatJoinCode("y9hh-5x ck!!zz"), "Y9HH-5XCK");
});

test("joinByCode: POST /api/join 본문", async () => {
  const { joinByCode } = await import("./api.ts");
  const seen: { url?: string; init?: RequestInit } = {};
  const r = await joinByCode("Y9HH-5XCK", { base: "http://x", fetchImpl: fakeFetch(200, { sessionId: "s1", phoneToken: "t", path: "/s/s1#t=t", expiresAt: "z" }, seen) });
  assert.equal(r.path, "/s/s1#t=t");
  assert.equal(seen.url, "http://x/api/join");
  assert.deepEqual(JSON.parse(String(seen.init!.body)), { code: "Y9HH-5XCK" });
});
