"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError, getSession, submitTrips } from "@/lib/api";
import { parseHashToken } from "@/lib/token";
import {
  USER_NAME_MAX,
  confirmFormReducer,
  toSubmissionItems,
  type TripDraft,
} from "@/lib/confirmForm";
import { PURPOSES, PURPOSE_LABEL, formatDate, formatTime } from "@/lib/format";
import { addHistory, loadProfile } from "@/lib/phoneStore";
import type { PhoneSession, Purpose, Trip } from "@/lib/types";
import { useProfile } from "../../usePhoneStore";
import DoneView, { type DoneInfo } from "./DoneView";

type View =
  | { kind: "loading" }
  | { kind: "expired" }
  | { kind: "error"; message: string }
  | { kind: "ready"; session: PhoneSession }
  | { kind: "done"; info: DoneInfo };

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
  const profile = useProfile();

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
        // 이용자 기본값: 이 폰에 저장한 내 이름(설정 탭), 없으면 차량의 기본 이용자
        dispatch({ type: "reset", session, preferredName: loadProfile()?.name });
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
      await submitTrips(session.sessionId, token, items);
      const info: DoneInfo = {
        at: new Date().toISOString(),
        plate: session.vehicle?.plate ?? null,
        userName: items.find((it) => it.userName)?.userName ?? null,
        purposes: items.map((it) => it.purpose),
        joinCode: session.joinCode ?? null,
      };
      // 계정이 없으므로 '내 운행' 내역은 이 폰 브라우저에만 남긴다.
      addHistory(
        items.map((it) => ({
          at: info.at,
          sessionId: session.sessionId,
          plate: info.plate,
          purpose: it.purpose,
          userName: it.userName,
          code: info.joinCode,
        })),
      );
      setView({ kind: "done", info });
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
      <div className="center-state" role="status">
        <p className="muted">운행 정보를 불러오는 중…</p>
      </div>
    );
  }

  if (view.kind === "expired") {
    return (
      <div className="center-state panel">
        <h1>QR이 만료됐어요</h1>
        <p className="muted">QR은 시동마다 바뀌어요. 차 화면에 지금 나온 QR을 다시 찍어 주세요.</p>
        <Link href="/scan" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          QR 다시 스캔
        </Link>
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="center-state panel">
        <h1>불러오지 못했어요</h1>
        <p className="muted">{view.message}</p>
        <button type="button" className="btn btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
          다시 시도
        </button>
      </div>
    );
  }

  if (view.kind === "done") {
    return <DoneView info={view.info} profile={profile} />;
  }

  const s = view.session;
  const submitted = new Set(s.submittedTripIds ?? []);

  return (
    <div className="declare">
      <h1 className="phone-title">이번 운행을 확인해 주세요</h1>
      <p className="phone-sub">목적과 이용자를 고르면 차가 이 이름으로 운행을 기록해요</p>

      <dl className="info-table">
        <div>
          <dt>차량</dt>
          <dd>{s.vehicle?.plate ?? "차량번호 없음"}</dd>
        </div>
      </dl>

      {s.trips.length === 0 ? (
        <div className="center-state panel">
          <h1>시작할 운행이 없어요</h1>
          <p className="muted">차 화면에서 QR을 새로고침한 뒤 다시 찍어 주세요.</p>
        </div>
      ) : (
        <>
          <div className="trip-list">
            {s.trips.map((trip) => {
              const draft = form[trip.id];
              if (!draft) return null;
              return (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  draft={draft}
                  sent={submitted.has(trip.id)}
                  fromProfile={!!profile && draft.userName.trim() === profile.name}
                  hasProfile={!!profile}
                  onPurpose={(p) => dispatch({ type: "purpose", tripId: trip.id, purpose: p })}
                  onUser={(u) => dispatch({ type: "user", tripId: trip.id, userName: u })}
                  onInclude={(v) => dispatch({ type: "include", tripId: trip.id, include: v })}
                />
              );
            })}
          </div>

          <div className="phone-actions">
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
                  ? "목적을 선택하세요"
                  : "운행 시작"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface TripCardProps {
  trip: Trip;
  draft: TripDraft;
  sent: boolean;
  /** 이용자 칸이 설정에 저장한 내 이름과 같은지 */
  fromProfile: boolean;
  hasProfile: boolean;
  onPurpose: (p: Purpose) => void;
  onUser: (u: string) => void;
  onInclude: (v: boolean) => void;
}

function TripCard({ trip, draft, sent, fromProfile, hasProfile, onPurpose, onUser, onInclude }: TripCardProps) {
  const userInputId = `user-${trip.id}`;
  const excluded = !draft.include;
  const cls = ["trip-card", sent ? "is-sent" : "", excluded ? "is-excluded" : ""].join(" ").trim();

  return (
    <article className={cls} aria-label="이번 운행">
      {/* 운행 구분용 최소 정보만 표시. 출발·도착·거리는 차량이 GPS·계기판으로 기록한다. */}
      <div className="trip-head">
        <div className="trip-when">
          이번 운행 · {formatDate(trip.startedAt)} {formatTime(trip.startedAt)}
        </div>
        {sent && <span className="badge badge-ok">보냄</span>}
      </div>

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
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor={userInputId}>
        이용자
      </label>
      <input
        id={userInputId}
        className="input"
        type="text"
        autoComplete="name"
        maxLength={USER_NAME_MAX}
        placeholder="이름을 입력하세요"
        value={draft.userName}
        onChange={(e) => onUser(e.target.value)}
      />
      {fromProfile ? (
        <p className="field-help">설정에 저장한 내 이름이에요.</p>
      ) : (
        !hasProfile && (
          <p className="field-help">
            <Link href="/settings">설정</Link>에 내 이름을 저장하면 다음부터 자동으로 채워져요.
          </p>
        )
      )}

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
