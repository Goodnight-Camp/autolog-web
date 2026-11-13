"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, formatJoinCode, joinByCode } from "@/lib/api";

/** 카메라가 안 될 때: 차량 화면에 보이는 8자리 코드를 입력하면 그 운행 신고 화면으로 이동한다. */
export default function JoinCodePage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = code.replace(/-/g, "").length === 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await joinByCode(code);
      window.location.assign(r.path);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "시도가 너무 많아요. 1분 뒤 다시 입력해 주세요."
          : err instanceof ApiError && err.status === 404
            ? "코드가 맞지 않거나 만료됐어요. 차량 화면의 코드를 다시 확인해 주세요."
            : err instanceof Error
              ? err.message
              : "다시 시도해 주세요.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="code-entry" onSubmit={submit}>
      <h1 className="phone-title">코드 직접 입력</h1>
      <p className="phone-sub">차 화면의 QR 아래에 있는 8자리 코드를 입력해 주세요</p>

      <div className="panel code-panel">
        <label className="field-label" htmlFor="join-code">
          운전자 확인 코드
        </label>
        <input
          id="join-code"
          className="input code-input"
          value={code}
          onChange={(e) => setCode(formatJoinCode(e.target.value))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          placeholder="XXXX-XXXX"
          aria-describedby="join-code-help"
        />
        <p id="join-code-help" className="muted code-help">
          영문 대문자와 숫자 8자리예요. 하이픈(-)은 자동으로 들어가요.
        </p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={!ready || busy}>
        {busy ? "확인 중…" : "확인"}
      </button>
      <Link href="/scan" className="btn-text">
        QR로 스캔하기
      </Link>
    </form>
  );
}
