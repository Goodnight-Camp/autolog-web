import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHashToken } from "./token.ts";
import { ApiError, getSession, resolveApiBase, submitTrips } from "./api.ts";
import {
  MEMO_MAX,
  confirmFormReducer,
  initForm,
  toSubmissionItems,
} from "./confirmForm.ts";
import { formatTime } from "./format.ts";
import type { PhoneSession } from "./types.ts";

const session: PhoneSession = {
  sessionId: "s1",
  vehicle: { plate: "12가3456", company: "테스트" },
  people: [
    { id: "u1", name: "김현대", dept: "영업" },
    { id: "u2", name: "이기아", dept: "총무" },
  ],
  trips: [
    {
      id: 1, startedAt: "2026-11-11T23:30:00Z", endedAt: "2026-11-12T00:10:00Z",
      distanceKm: 12.34, from: "집", to: "회사", suggested: "COMMUTE", userId: "u1", memo: null,
    },
    {
      id: 2, startedAt: "2026-11-12T02:00:00Z", endedAt: "2026-11-12T03:00:00Z",
      distanceKm: 30, from: null, to: null, suggested: "UNKNOWN", userId: "ghost", memo: "메모",
    },
    {
      id: 3, startedAt: "2026-11-12T05:00:00Z", endedAt: "2026-11-12T06:00:00Z",
      distanceKm: 5, from: "회사", to: "거래처", suggested: "BUSINESS", userId: null, memo: null,
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

test("initForm: 제안 목적·기본 이용자·보냄 제외", () => {
  const s = initForm(session);
  assert.deepEqual(s[1], { purpose: "COMMUTE", userId: "u1", memo: "", include: true });
  // 미분류는 목적 미선택, people 에 없는 userId 는 null
  assert.deepEqual(s[2], { purpose: null, userId: null, memo: "메모", include: true });
  assert.equal(s[3].include, false);
  // 목적 없는 2번, 이미 보낸 3번은 제외
  assert.deepEqual(toSubmissionItems(s, session.trips).map((i) => i.tripId), [1]);
});

test("reducer: 목적 선택 시 포함, 메모 길이 제한, 재제출", () => {
  let s = initForm(session);
  s = confirmFormReducer(s, { type: "purpose", tripId: 2, purpose: "PERSONAL" });
  s = confirmFormReducer(s, { type: "memo", tripId: 1, memo: "가".repeat(300) });
  s = confirmFormReducer(s, { type: "include", tripId: 3, include: true });
  s = confirmFormReducer(s, { type: "user", tripId: 3, userId: "u2" });
  assert.equal(s[1].memo.length, MEMO_MAX);
  const items = toSubmissionItems(s, session.trips);
  assert.deepEqual(items.map((i) => [i.tripId, i.purpose, i.userId]), [
    [1, "COMMUTE", "u1"],
    [2, "PERSONAL", null],
    [3, "BUSINESS", "u2"],
  ]);
  assert.equal(items[1].memo, "메모");
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
  const items = [{ tripId: 1, purpose: "BUSINESS" as const, userId: "u1", memo: null }];
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

test("suggested 가 null(서버 미분류)이면 목적 미선택", () => {
  const s = initForm({
    ...session,
    trips: [{ ...session.trips[0], suggested: null }],
    submittedTripIds: [],
  });
  assert.equal(s[1].purpose, null);
});
