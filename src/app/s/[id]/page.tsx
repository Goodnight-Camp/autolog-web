"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError, getSession, submitTrips } from "@/lib/api";
import { parseHashToken } from "@/lib/token";
import {
  MEMO_MAX,
  confirmFormReducer,
  toSubmissionItems,
  type TripDraft,
} from "@/lib/confirmForm";
import {
  PURPOSES,
  PURPOSE_LABEL,
  formatDate,
  formatKm,
  formatTime,
  routeLabel,
  suggestedLabel,
  suggestedPurpose,
} from "@/lib/format";
import type { Person, PhoneSession, Purpose, Trip } from "@/lib/types";

type View =
  | { kind: "loading" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "ready"; session: PhoneSession }
  | { kind: "done"; accepted: number; session: PhoneSession };

function isExpiredError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 404);
}

export default function ConfirmPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [form, dispatch] = useReducer(confirmFormReducer, {});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 토큰은 URL 해시(#t=...)에서만 읽는다. 해시는 서버로 전송되지 않는다.
  useEffect(() => {
    const read = () => setToken(parseHashToken(window.location.hash));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (token === undefined) return;
    if (!token || !sessionId) {
      setView({ kind: "expired" });
      return;
    }
    const ac = new AbortController();
    setView({ kind: "loading" });
    getSession(sessionId, token, { signal: ac.signal })
      .then((session) => {
        dispatch({ type: "reset", session });
        setView({ kind: "ready", session });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        if (isExpiredError(e)) setView({ kind: "expired" });
        else setView({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => ac.abort();
  }, [sessionId, token, reloadKey]);

  const session = view.kind === "ready" ? view.session : null;
  const items = useMemo(
    () => (session ? toSubmissionItems(form, session.trips) : []),
    [form, session],
  );

  const onSubmit = useCallback(async () => {
    if (!session || !token || items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitTrips(session.sessionId, token, items);
      setView({ kind: "done", accepted: res?.accepted ?? items.length, session });
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (isExpiredError(e)) setView({ kind: "expired" });
      else setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [session, token, items]);

  if (view.kind === "loading") {
    return (
      <main className="container">
        <div className="center-state" role="status">
          <p className="muted">운행 정보를 불러오는 중…</p>
        </div>
      </main>
    );
  }

  if (view.kind === "expired") {
    return (
      <main className="container">
        <div className="center-state panel" style={{ marginTop: 24 }}>
          <h1>QR이 만료됐어요</h1>
          <p className="muted">차량 화면에서 QR을 다시 띄워주세요.</p>
        </div>
      </main>
    );
  }

  if (view.kind === "error") {
    return (
      <main className="container">
        <div className="center-state panel" style={{ marginTop: 24 }}>
          <h1>불러오지 못했어요</h1>
          <p className="muted">{view.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (view.kind === "done") {
    return (
      <main className="container">
        <div className="center-state panel" style={{ marginTop: 24 }}>
          <div className="badge badge-ok" style={{ fontSize: 15 }}>
            {view.accepted}건 전송 완료
          </div>
          <h1 style={{ marginTop: 16 }}>차량으로 보냈어요</h1>
          <p className="muted">차량이 P 상태일 때 장부에 반영됩니다.</p>
          <button type="button" className="btn" onClick={() => setReloadKey((k) => k + 1)}>
            운행 목록으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  const s = view.session;
  const submitted = new Set(s.submittedTripIds ?? []);

  return (
    <main className="container">
      <h1>운행 확인</h1>
      <p className="muted" style={{ margin: 0 }}>
        {s.vehicle ? `${s.vehicle.plate} · ${s.vehicle.company}` : "차량 정보 없음"}
        {" · 만료 "}
        {formatTime(s.expiresAt)}
      </p>

      {s.trips.length === 0 ? (
        <div className="center-state panel" style={{ marginTop: 20 }}>
          <h1>확인할 운행이 없습니다</h1>
          <p className="muted">새 운행이 기록되면 차량 화면에 다시 QR이 나타납니다.</p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            운행마다 목적과 이용자를 확인해 주세요. 추천 목적이 미리 선택되어 있어요.
          </p>
          <div className="trip-list">
            {s.trips.map((trip) => {
              const draft = form[trip.id];
              if (!draft) return null;
              return (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  people={s.people}
                  draft={draft}
                  sent={submitted.has(trip.id)}
                  onPurpose={(p) => dispatch({ type: "purpose", tripId: trip.id, purpose: p })}
                  onUser={(u) => dispatch({ type: "user", tripId: trip.id, userId: u })}
                  onMemo={(m) => dispatch({ type: "memo", tripId: trip.id, memo: m })}
                  onInclude={(v) => dispatch({ type: "include", tripId: trip.id, include: v })}
                />
              );
            })}
          </div>

          <div className="submit-bar">
            <div className="submit-bar-inner">
              {submitError && (
                <div className="alert alert-error" role="alert" style={{ marginTop: 0 }}>
                  {submitError}
                </div>
              )}
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={items.length === 0 || submitting}
                onClick={onSubmit}
              >
                {submitting
                  ? "보내는 중…"
                  : items.length === 0
                    ? "보낼 운행을 선택하세요"
                    : `${items.length}건 차량에 보내기`}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

interface TripCardProps {
  trip: Trip;
  people: Person[];
  draft: TripDraft;
  sent: boolean;
  onPurpose: (p: Purpose) => void;
  onUser: (u: string | null) => void;
  onMemo: (m: string) => void;
  onInclude: (v: boolean) => void;
}

function TripCard({ trip, people, draft, sent, onPurpose, onUser, onMemo, onInclude }: TripCardProps) {
  const userSelectId = `user-${trip.id}`;
  const memoId = `memo-${trip.id}`;
  const excluded = !draft.include;
  const cls = ["trip-card", sent ? "is-sent" : "", excluded ? "is-excluded" : ""].join(" ").trim();

  return (
    <article className={cls} aria-label={`${formatDate(trip.startedAt)} 운행`}>
      <div className="trip-head">
        <div>
          <div className="trip-when">{formatDate(trip.startedAt)}</div>
          <div className="trip-meta">
            {formatTime(trip.startedAt)}–{formatTime(trip.endedAt)} · {formatKm(trip.distanceKm)}
          </div>
        </div>
        <div className="trip-badges">
          {sent && <span className="badge badge-ok">보냄</span>}
          <span className={suggestedPurpose(trip.suggested) ? "badge" : "badge badge-muted"}>
            추천 {suggestedLabel(trip.suggested)}
          </span>
        </div>
      </div>
      <div className="trip-route">{routeLabel(trip.from, trip.to)}</div>

      <span className="field-label" id={`purpose-${trip.id}`}>
        목적
      </span>
      <div className="seg" role="group" aria-labelledby={`purpose-${trip.id}`}>
        {PURPOSES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={draft.purpose === p}
            onClick={() => onPurpose(p)}
          >
            {PURPOSE_LABEL[p]}
            {suggestedPurpose(trip.suggested) === p && <span className="hint">추천</span>}
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor={userSelectId}>
        이용자
      </label>
      <select
        id={userSelectId}
        className="select"
        value={draft.userId ?? ""}
        onChange={(e) => onUser(e.target.value || null)}
      >
        <option value="">선택 안 함</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.dept ? ` (${p.dept})` : ""}
          </option>
        ))}
      </select>

      <label className="field-label" htmlFor={memoId}>
        비고 (선택)
      </label>
      <textarea
        id={memoId}
        className="textarea"
        maxLength={MEMO_MAX}
        placeholder="예: 거래처 미팅"
        value={draft.memo}
        onChange={(e) => onMemo(e.target.value)}
      />
      <div className="counter">
        {draft.memo.length}/{MEMO_MAX}
      </div>

      {(sent || excluded) && (
        <div className="resend-row">
          <span>
            {sent
              ? excluded
                ? "이미 차량에 보낸 운행입니다."
                : "수정한 내용으로 다시 보냅니다."
              : draft.purpose
                ? "이번에 보내지 않습니다."
                : "목적을 선택하면 함께 보냅니다."}
          </span>
          {excluded ? (
            <button type="button" className="btn btn-small" onClick={() => onInclude(true)}>
              {sent ? "다시 보내기" : "포함"}
            </button>
          ) : (
            <button type="button" className="btn btn-small" onClick={() => onInclude(false)}>
              보내지 않기
            </button>
          )}
        </div>
      )}
    </article>
  );
}
