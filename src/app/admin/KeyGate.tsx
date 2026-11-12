"use client";

import { useState } from "react";

interface Props {
  notice?: string | null;
  onSubmit: (key: string) => void;
}

/** 관리자 키 입력 폼 */
export function KeyGate({ notice, onSubmit }: Props) {
  const [value, setValue] = useState("");
  return (
    <main className="container">
      <h1>관리자</h1>
      <div className="panel" style={{ marginTop: 12 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          관리자 키를 입력하세요. 이 탭을 닫으면 키는 지워집니다.
        </p>
        {notice && (
          <div className="alert alert-error" role="alert">
            {notice}
          </div>
        )}
        <form
          className="key-form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = value.trim();
            if (v) onSubmit(v);
          }}
        >
          <input
            className="input"
            type="password"
            autoComplete="off"
            aria-label="관리자 키"
            placeholder="관리자 키"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            확인
          </button>
        </form>
      </div>
    </main>
  );
}
