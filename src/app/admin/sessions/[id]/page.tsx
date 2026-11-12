"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, adminGetSession } from "@/lib/api";
import { PURPOSE_LABEL, formatDate, formatDateTime, formatTime } from "@/lib/format";
import { KeyGate } from "../../KeyGate";
import { useAdminKey, usePolling } from "../../useAdmin";

export default function AdminSessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const [key, setKey] = useAdminKey();
  const [notice, setNotice] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const onUnauthorized = useCallback(() => {
    setKey(null);
    setNotice("관리자 키가 올바르지 않습니다.");
  }, [setKey]);

  const { data, error, updatedAt } = usePolling(
    notFound ? null : key,
    async (k, signal) => {
      try {
        return await adminGetSession(k, sessionId, { signal });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        throw e;
      }
    },
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

  const back = (
    <Link href="/admin/sessions" className="btn btn-small">
      ← QR 세션 목록
    </Link>
  );

  if (notFound) {
    return (
      <main className="container wide">
        {back}
        <div className="center-state panel" style={{ marginTop: 16 }}>
          <h1>세션을 찾을 수 없습니다</h1>
          <p className="muted mono">{sessionId}</p>
        </div>
      </main>
    );
  }

  const nameOf = (id: string | null) => {
    if (!id) return "-";
    const p = data?.people.find((x) => x.id === id);
    return p ? `${p.name}${p.dept ? ` (${p.dept})` : ""}` : id;
  };

  const submissions = data ? [...data.submissions].sort((a, b) => b.seq - a.seq) : [];

  return (
    <main className="container wide">
      <div className="toolbar">
        {back}
        <span className="muted">
          5초마다 자동 새로고침{updatedAt ? ` · ${formatDateTime(updatedAt.toISOString())}` : ""}
        </span>
      </div>
      <h1>세션 상세</h1>
      <p className="muted mono" style={{ marginTop: 0 }}>
        {sessionId}
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {!data ? (
        !error && <p className="muted">불러오는 중…</p>
      ) : (
        <>
          <dl className="kv">
            <div>
              <dt>차량</dt>
              <dd>{data.vehicle?.plate ?? "-"}</dd>
            </div>
            <div>
              <dt>생성</dt>
              <dd>{formatDateTime(data.createdAt)}</dd>
            </div>
            <div>
              <dt>만료</dt>
              <dd>
                {formatDateTime(data.expiresAt)}{" "}
                {data.expired ? (
                  <span className="badge badge-muted">만료</span>
                ) : (
                  <span className="badge badge-ok">유효</span>
                )}
              </dd>
            </div>
          </dl>

          <h2>운행 ({data.trips.length})</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="num">ID</th>
                  <th>날짜</th>
                  <th>시각</th>
                  <th>차량 측 이용자</th>
                </tr>
              </thead>
              <tbody>
                {data.trips.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted" style={{ textAlign: "center" }}>
                      운행이 없습니다.
                    </td>
                  </tr>
                ) : (
                  data.trips.map((t) => (
                    <tr key={t.id}>
                      <td className="num">{t.id}</td>
                      <td>{formatDate(t.startedAt)}</td>
                      <td>
                        {formatTime(t.startedAt)}–{formatTime(t.endedAt)}
                      </td>
                      <td>{nameOf(t.userId)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2>제출 이력 ({submissions.length})</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th className="num">운행 ID</th>
                  <th>목적</th>
                  <th>이용자</th>
                  <th>비고</th>
                  <th>제출 시각</th>
                  <th>차량 반영</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: "center" }}>
                      아직 제출이 없습니다.
                    </td>
                  </tr>
                ) : (
                  submissions.map((s) => (
                    <tr key={s.seq}>
                      <td className="num">{s.seq}</td>
                      <td className="num">{s.tripId}</td>
                      <td>
                        <span className="badge badge-navy">{PURPOSE_LABEL[s.purpose] ?? s.purpose}</span>
                      </td>
                      <td>{nameOf(s.userId)}</td>
                      <td style={{ maxWidth: 280, wordBreak: "break-word" }}>{s.memo || "-"}</td>
                      <td>{formatDateTime(s.submittedAt)}</td>
                      <td>
                        {s.acked ? (
                          <span className="badge badge-ok" title={formatDateTime(s.ackedAt)}>
                            반영 {formatTime(s.ackedAt)}
                          </span>
                        ) : (
                          <span className="badge badge-warn">대기</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
