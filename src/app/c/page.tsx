"use client";

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
    <main className="container">
      <form className="center-state panel" style={{ marginTop: 24 }} onSubmit={submit}>
        <h1 style={{ fontSize: 22, margin: 0 }}>운전자 확인 코드</h1>
        <p className="muted">차량 화면의 QR 아래 8자리 코드를 입력하세요.</p>
        <input
          aria-label="8자리 코드"
          value={code}
          onChange={(e) => setCode(formatJoinCode(e.target.value))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          placeholder="XXXX-XXXX"
          style={{ fontSize: 28, letterSpacing: 4, textAlign: "center", padding: "12px 8px", width: "100%", maxWidth: 280 }}
        />
        {error && <p role="alert" style={{ color: "var(--danger, #b42318)" }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={!ready || busy}>
          {busy ? "확인 중…" : "확인"}
        </button>
      </form>
    </main>
  );
}
