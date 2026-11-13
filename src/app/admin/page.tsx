"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { adminDownloadLedger, adminLedger, adminTripReports } from "@/lib/api";
import { PURPOSE_LABEL, formatDateTime, formatTime } from "@/lib/format";
import {
  FIELD_LABEL,
  REASON_LABEL,
  STATUS_BADGE,
  defaultPeriod,
  kmCell,
  kstToday,
  monthPeriod,
  vehicleLabel,
} from "@/lib/ledger";
import { naviItems, naviOutcome, naviTotalsLabel, placeLabel, usedNavi, wonCell } from "@/lib/navi";
import type { LedgerFilters, LedgerRow, NaviInfo, StatusFilter, VehicleReport } from "@/lib/types";
import { AdminNav } from "./AdminNav";
import { KeyGate } from "./KeyGate";
import { useAdminKey, usePolling } from "./useAdmin";

const rowId = (r: LedgerRow) => `${r.vehicleId}|${r.kind}|${r.tripId}`;

/** 관리자 첫 화면: 차량 보고로 만든 운행기록부(국세청 서식 열 순서) */
export default function LedgerPage() {
  const [key, setKey] = useAdminKey();
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<LedgerFilters>(() => ({
    vehicleId: null,
    ...monthPeriod(kstToday()),
    status: "all",
    includeIncomplete: true,
  }));
  const [periodTouched, setPeriodTouched] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, VehicleReport[] | string>>({});
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const onUnauthorized = useCallback(() => {
    setKey(null);
    setNotice("관리자 키가 올바르지 않습니다.");
  }, [setKey]);

  const { data, error, updatedAt } = usePolling(
    key,
    (k, signal) => adminLedger(k, filters, { signal }),
    onUnauthorized,
    JSON.stringify(filters),
  );

  const vehicles = useMemo(() => data?.vehicles ?? [], [data]);
  const vehicle = vehicles.find((v) => v.vehicleId === filters.vehicleId);

  // 차량 목록이 오면 최근 보고 차량을 고르고, 기간을 그 차량의 사업연도로 맞춘다(직접 바꾸기 전까지).
  useEffect(() => {
    if (filters.vehicleId || vehicles.length === 0) return;
    const v = vehicles[0];
    setFilters((f) => ({ ...f, vehicleId: v.vehicleId, ...(periodTouched ? {} : defaultPeriod(v, kstToday())) }));
  }, [vehicles, filters.vehicleId, periodTouched]);

  const toggle = async (r: LedgerRow) => {
    const id = rowId(r);
    if (open === id) return setOpen(null);
    setOpen(id);
    if (!key) return;
    try {
      const { reports } = await adminTripReports(key, r);
      setHistory((h) => ({ ...h, [id]: reports }));
    } catch (e) {
      setHistory((h) => ({ ...h, [id]: e instanceof Error ? e.message : String(e) }));
    }
  };

  const download = async (type: "csv" | "xlsx", format: "nts" | "raw" = "nts") => {
    if (!key) return;
    setDownloading(format === "raw" ? `raw-${type}` : type);
    setDownloadError(null);
    try {
      const { blob, fileName } = await adminDownloadLedger(key, type, filters, { format });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(null);
    }
  };

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

  const setPeriod = (p: { from: string | null; to: string | null }) => {
    setPeriodTouched(true);
    setFilters((f) => ({ ...f, ...p }));
  };
  const totals = data?.totals;
  const naviTotals = totals?.navi && totals.navi.trips > 0 ? totals.navi : null;
  const rows = data?.rows ?? [];
  const fiscal = vehicle?.fiscalStart && vehicle.fiscalEnd ? `${vehicle.fiscalStart} ~ ${vehicle.fiscalEnd}` : null;

  return (
    <main className="container wide ledger-page">
      <AdminNav active="ledger" />
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>운행기록부</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted">
            5초마다 자동 새로고침{updatedAt ? ` · ${formatDateTime(updatedAt.toISOString())}` : ""}
          </span>
          <button type="button" className="btn btn-small" onClick={() => setKey(null)}>
            키 지우기
          </button>
        </div>
      </div>

      <section className="panel filters" aria-label="조회 조건">
        <label className="field">
          <span className="field-label">차량</span>
          <select
            className="select"
            value={filters.vehicleId ?? ""}
            onChange={(e) => {
              const v = vehicles.find((x) => x.vehicleId === e.target.value);
              setFilters((f) => ({ ...f, vehicleId: e.target.value || null, ...(periodTouched ? {} : defaultPeriod(v, kstToday())) }));
              setOpen(null);
            }}
          >
            {vehicles.length === 0 && <option value="">보고된 차량 없음</option>}
            {vehicles.map((v) => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {vehicleLabel(v)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">시작일</span>
          <input className="input" type="date" value={filters.from ?? ""} onChange={(e) => setPeriod({ from: e.target.value || null, to: filters.to })} />
        </label>
        <label className="field">
          <span className="field-label">종료일</span>
          <input className="input" type="date" value={filters.to ?? ""} onChange={(e) => setPeriod({ from: filters.from, to: e.target.value || null })} />
        </label>
        <div className="field">
          <span className="field-label">기간 바로가기</span>
          <div className="seg seg-compact">
            <button
              type="button"
              disabled={!fiscal}
              aria-pressed={!!fiscal && filters.from === vehicle?.fiscalStart && filters.to === vehicle?.fiscalEnd}
              onClick={() => vehicle && setPeriod({ from: vehicle.fiscalStart, to: vehicle.fiscalEnd })}
            >
              사업연도
            </button>
            <button
              type="button"
              aria-pressed={filters.from === monthPeriod(kstToday()).from && filters.to === monthPeriod(kstToday()).to}
              onClick={() => setPeriod(monthPeriod(kstToday()))}
            >
              이번 달
            </button>
            <button type="button" aria-pressed={!filters.from && !filters.to} onClick={() => setPeriod({ from: null, to: null })}>
              전체
            </button>
          </div>
        </div>
        <label className="field">
          <span className="field-label">상태</span>
          <select className="select" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))}>
            <option value="all">전체</option>
            <option value="unconfirmed">미확인</option>
            <option value="confirmed">확인</option>
            <option value="corrected">정정</option>
          </select>
        </label>
        <label className="field check">
          <input
            type="checkbox"
            checked={filters.includeIncomplete}
            onChange={(e) => setFilters((f) => ({ ...f, includeIncomplete: e.target.checked }))}
          />
          <span>미확인·누락 행 포함</span>
        </label>
      </section>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {vehicle && (
        <dl className="kv ledger-head">
          <div>
            <dt>법인명</dt>
            <dd>{vehicle.company ?? <span className="missing">누락</span>}</dd>
          </div>
          <div>
            <dt>사업자등록번호</dt>
            <dd>{vehicle.bizNo ?? <span className="missing">누락</span>}</dd>
          </div>
          <div>
            <dt>① 차종</dt>
            <dd>{vehicle.model ?? <span className="missing">누락</span>}</dd>
          </div>
          <div>
            <dt>② 자동차등록번호</dt>
            <dd>{vehicle.plate ?? <span className="missing">누락</span>}</dd>
          </div>
          <div>
            <dt>사업연도</dt>
            <dd>{fiscal ?? <span className="missing">누락</span>}</dd>
          </div>
          <div>
            <dt>관리자 이메일(보고 수신 예정)</dt>
            <dd>{vehicle.adminEmail ?? "-"}</dd>
          </div>
        </dl>
      )}

      {totals && (
        <dl className="kv ledger-totals">
          <div>
            <dt>⑪ 총주행거리</dt>
            <dd>{kmCell(totals.totalKm)} km</dd>
          </div>
          <div>
            <dt>⑫ 업무용 사용거리</dt>
            <dd>
              {kmCell(totals.workKm)} km
              <span className="muted sub"> 출퇴근 {kmCell(totals.commuteKm)} · 일반업무 {kmCell(totals.businessKm)}</span>
            </dd>
          </div>
          <div>
            <dt>⑬ 업무사용비율</dt>
            <dd>{totals.ratio.toFixed(2)}%</dd>
          </div>
          <div className={totals.incomplete > 0 ? "warn" : ""}>
            <dt>미완성</dt>
            <dd>{totals.incomplete}건</dd>
          </div>
          <div className={totals.unconfirmed > 0 ? "warn" : ""}>
            <dt>미확인</dt>
            <dd>{totals.unconfirmed}건</dd>
          </div>
          <div>
            <dt>누락 운행</dt>
            <dd>{totals.gaps}건</dd>
          </div>
          {naviTotals && (
            <>
              <div>
                <dt>내비 사용 운행</dt>
                <dd>
                  {naviTotals.trips}건<span className="muted sub">{naviTotalsLabel(naviTotals)}</span>
                </dd>
              </div>
              <div>
                <dt>통행료 합계(내비 안내)</dt>
                <dd>
                  {wonCell(naviTotals.tollWon)}
                  <span className="muted sub">유료 구간 {naviTotals.tollTrips}건 · 참고용(장부 외)</span>
                </dd>
              </div>
            </>
          )}
        </dl>
      )}

      <div className="toolbar">
        <span className="muted">
          {data
            ? `${data.shown}행 표시 · 합계는 기간 안 전체 ${totals?.rowCount ?? 0}행 기준(미확인·개인은 업무 거리 제외) · 국세청 서식 파일에는 기간 안 모든 운행이 들어갑니다`
            : ""}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-small btn-primary" disabled={!filters.vehicleId || !!downloading} onClick={() => download("csv")}>
            {downloading === "csv" ? "준비 중…" : "국세청 서식 CSV"}
          </button>
          <button type="button" className="btn btn-small btn-primary" disabled={!filters.vehicleId || !!downloading} onClick={() => download("xlsx")}>
            {downloading === "xlsx" ? "준비 중…" : "국세청 서식 Excel(XLSX)"}
          </button>
          <button
            type="button"
            className="btn btn-small"
            title="화면 필터를 적용한 관리자용 원본 표(상태·보고 이력 등 내부 열 포함)"
            disabled={!filters.vehicleId || !!downloading}
            onClick={() => download("csv", "raw")}
          >
            {downloading === "raw-csv" ? "준비 중…" : "원본 데이터 CSV"}
          </button>
        </div>
      </div>
      {downloadError && (
        <div className="alert alert-error" role="alert">
          {downloadError}
        </div>
      )}

      {!data && !error ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="table-wrap">
          <table className="data ledger">
            <thead>
              <tr>
                <th rowSpan={2}>③ 사용일자</th>
                <th colSpan={2}>④ 사용자</th>
                <th colSpan={3}>운행 내역</th>
                <th colSpan={2}>업무용 사용거리(km)</th>
                <th rowSpan={2}>⑩ 비고</th>
                <th rowSpan={2} className="num" title="플레오스 내비 안내 기준 예상 통행료(국세청 서식에는 들어가지 않음)">
                  통행료
                </th>
                <th rowSpan={2}>상태</th>
                <th rowSpan={2}>마지막 보고</th>
              </tr>
              <tr>
                <th>부서</th>
                <th>성명</th>
                <th className="num">⑤ 주행 전(km)</th>
                <th className="num">⑥ 주행 후(km)</th>
                <th className="num">⑦ 주행거리(km)</th>
                <th className="num">⑧ 출·퇴근용</th>
                <th className="num">⑨ 일반 업무용</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="muted" style={{ textAlign: "center", padding: 32 }}>
                    조건에 맞는 운행이 없습니다. 차량 앱이 운행을 마치면 자동으로 보고됩니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const id = rowId(r);
                  const isOpen = open === id;
                  const h = history[id];
                  return (
                    <Fragment key={id}>
                      <tr
                        className={`clickable${r.complete ? "" : " incomplete"}${isOpen ? " is-open" : ""}`}
                        tabIndex={0}
                        aria-expanded={isOpen}
                        onClick={() => toggle(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") toggle(r);
                        }}
                      >
                        <td className="nowrap">
                          {r.usedDate}({r.weekday})
                          <div className="muted sub">
                            {formatTime(r.startedAt)}–{formatTime(r.endedAt)}
                          </div>
                        </td>
                        <td className="person">{r.dept ?? <span className="missing">누락</span>}</td>
                        <td className="person">{r.userName ?? <span className="missing">누락</span>}</td>
                        <td className="num">{kmCell(r.odoStartKm)}</td>
                        <td className="num">{kmCell(r.odoEndKm)}</td>
                        <td className="num">{kmCell(r.distanceKm)}</td>
                        <td className="num">{kmCell(r.commuteKm)}</td>
                        <td className="num">{kmCell(r.businessKm)}</td>
                        <td className="remark">
                          {r.remark ?? <span className="missing">누락</span>}
                          <div className="tags">
                            {r.gap && <span className="badge badge-warn">누락 운행</span>}
                            {r.demo && <span className="badge badge-muted">DEMO</span>}
                            {r.purpose && <span className="badge">{PURPOSE_LABEL[r.purpose]}</span>}
                            {usedNavi(r.navi) && <NaviBadge navi={r.navi} />}
                            {!r.complete && <span className="missing">누락: {r.missing.join(", ")}</span>}
                          </div>
                        </td>
                        <td className="num nowrap">{usedNavi(r.navi) && r.navi.tollFareWon !== null ? wonCell(r.navi.tollFareWon) : "-"}</td>
                        <td>
                          <span className={STATUS_BADGE[r.status]}>{r.statusLabel}</span>
                        </td>
                        <td className="nowrap">
                          {REASON_LABEL[r.lastReason] ?? r.lastReason}
                          <div className="muted sub">{formatDateTime(r.lastReportedAt)}</div>
                          <div className="muted sub">보고 {r.reportCount}건 · rev {r.revision}</div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="history-row">
                          <td colSpan={12}>
                            {usedNavi(r.navi) && <NaviDetail navi={r.navi} />}
                            {h === undefined ? (
                              <p className="muted">보고 이력을 불러오는 중…</p>
                            ) : typeof h === "string" ? (
                              <div className="alert alert-error">{h}</div>
                            ) : (
                              <HistoryTable reports={h} />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 8 }}>
        행을 누르면 그 운행의 내비 안내 정보와 보고 이력(종료·시동 OFF·확인·정정·재전송)이 펼쳐집니다. 내비 정보는 참고용이며 국세청 서식 파일에는 들어가지 않습니다(원본 데이터 CSV에는 포함). 사용자·차량 고정값이 비면 &lsquo;누락&rsquo;으로 표시합니다.
      </p>
    </main>
  );
}

/** 표 비고 칸의 내비 배지: 도착/취소 상태를 색으로 */
function NaviBadge({ navi }: { navi: NaviInfo }) {
  const o = naviOutcome(navi);
  const cls = o.tone === "ok" ? "badge badge-navi" : o.tone === "warn" ? "badge badge-warn" : "badge badge-muted";
  const dest = placeLabel(navi.destination);
  return (
    <span className={cls} title={[dest ? `목적지 ${dest}` : null, o.label].filter(Boolean).join(" · ")}>
      내비{o.tone === "warn" ? " · 취소" : ""}
    </span>
  );
}

/** 펼침 상세: 내비 안내 정보(값 없는 항목은 숨김) */
function NaviDetail({ navi }: { navi: NaviInfo }) {
  const items = naviItems(navi);
  return (
    <section className="navi-detail" aria-label="내비 안내 정보">
      <h3 className="history-title">내비 안내 정보 <span className="muted sub">플레오스 내비 · 참고용(장부 외)</span></h3>
      <dl className="kv navi-kv">
        {items.map((it) => (
          <div key={it.label}>
            <dt>{it.label}</dt>
            <dd>{it.value}</dd>
          </div>
        ))}
      </dl>
      {navi.waypoints.length > 0 && (
        <div className="waypoints">
          <span className="waypoints-label">경유지</span>
          <ol>
            {navi.waypoints.map((w, i) => (
              <li key={i}>
                {placeLabel(w) ?? `경유지 ${i + 1}`}{" "}
                {w.arrived ? <span className="badge badge-ok">경유 완료</span> : <span className="badge badge-muted">미경유</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function HistoryTable({ reports }: { reports: VehicleReport[] }) {
  if (reports.length === 0) return <p className="muted">보고 이력이 없습니다.</p>;
  const corrections = reports.reduce((best, r) => (r.revision >= best.revision ? r : best), reports[0]).corrections;
  return (
    <div className="history">
      <table className="data inner">
        <thead>
          <tr>
            <th>받은 시각</th>
            <th>사유</th>
            <th className="num">rev</th>
            <th>상태</th>
            <th>목적</th>
            <th>사용자</th>
            <th className="num">주행거리</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.reportId}>
              <td className="nowrap">{formatDateTime(r.receivedAt)}</td>
              <td>{REASON_LABEL[r.reason] ?? r.reason}</td>
              <td className="num">{r.revision}</td>
              <td>{r.trip.status === "CONFIRMED" ? "확인" : "미확인"}</td>
              <td>{r.trip.purpose ? PURPOSE_LABEL[r.trip.purpose] : "-"}</td>
              <td>{[r.trip.dept, r.trip.userName].filter(Boolean).join(" ") || "-"}</td>
              <td className="num">{kmCell(r.trip.distanceKm)}</td>
              <td>{r.trip.memo ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {corrections.length > 0 && (
        <>
          <h3 className="history-title">정정 이력</h3>
          <ul className="corrections">
            {corrections.map((c, i) => (
              <li key={i}>
                {formatDateTime(c.at)} · {FIELD_LABEL[c.field] ?? c.field}: {display(c.field, c.oldValue)} → {display(c.field, c.newValue)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function display(field: string, v: string | null): string {
  if (v === null || v === "") return "(없음)";
  if (field === "purpose" && v in PURPOSE_LABEL) return PURPOSE_LABEL[v as keyof typeof PURPOSE_LABEL];
  return v;
}
