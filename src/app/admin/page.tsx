"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { adminListSessions } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { KeyGate } from "./KeyGate";
import { useAdminKey, usePolling } from "./useAdmin";

export default function AdminPage() {
  const router = useRouter();
  const [key, setKey] = useAdminKey();
  const [notice, setNotice] = useState<string | null>(null);

  const onUnauthorized = useCallback(() => {
    setKey(null);
    setNotice("관리자 키가 올바르지 않습니다.");
  }, [setKey]);

  const { data, error, updatedAt } = usePolling(
    key,
    (k, signal) => adminListSessions(k, { signal }),
    onUnauthorized,
  );

  if (key === undefined) return null;
  if (!key) {
    return (
      <KeyGate
        notice={notice}
        onSubmit={(k) => {
          setNotice(null);
          setKey(k);
        }}
      />
    );
  }

  const sessions = data?.sessions ?? [];

  return (
    <main className="container wide">
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>QR 세션 현황</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="muted">
            5초마다 자동 새로고침{updatedAt ? ` · ${formatDateTime(updatedAt.toISOString())}` : ""}
          </span>
          <button type="button" className="btn btn-small" onClick={() => setKey(null)}>
            키 지우기
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {!data && !error ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>생성 시각</th>
                <th>차량번호</th>
                <th className="num">운행</th>
                <th className="num">제출</th>
                <th className="num">대기</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 32 }}>
                    아직 생성된 세션이 없습니다.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const href = `/admin/sessions/${encodeURIComponent(s.sessionId)}`;
                  return (
                    <tr
                      key={s.sessionId}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => router.push(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(href);
                      }}
                    >
                      <td>{formatDateTime(s.createdAt)}</td>
                      <td>{s.vehicle?.plate ?? "-"}</td>
                      <td className="num">{s.tripCount}</td>
                      <td className="num">{s.submissionCount}</td>
                      <td className="num">
                        {s.pendingCount > 0 ? (
                          <span className="badge badge-warn">{s.pendingCount}</span>
                        ) : (
                          s.pendingCount
                        )}
                      </td>
                      <td>
                        {s.expired ? (
                          <span className="badge badge-muted">만료</span>
                        ) : (
                          <span className="badge badge-ok">유효</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 8 }}>
        대기 = 폰에서 제출했지만 아직 차량이 반영(ack)하지 않은 건수
      </p>
    </main>
  );
}
