"use client";

import Link from "next/link";
import { PURPOSE_LABEL, formatDateTimeShort } from "@/lib/format";
import { useHistory } from "../usePhoneStore";

/** 내 운행: 계정이 없으므로 이 폰 브라우저에서 보낸 신고 내역만 최근순으로 보여 준다. */
export default function MyTripsPage() {
  const history = useHistory();

  return (
    <div className="my-trips">
      <h1 className="phone-title">내 운행</h1>
      <p className="phone-sub">이 휴대폰에서 보낸 운전자 신고예요</p>

      {history === undefined ? (
        <p className="muted" role="status">
          불러오는 중…
        </p>
      ) : history.length === 0 ? (
        <div className="center-state panel">
          <h1>아직 보낸 신고가 없어요</h1>
          <p className="muted">차 화면의 QR을 찍어 이번 운행의 운전자로 신고해 보세요.</p>
          <Link href="/scan" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            QR 스캔
          </Link>
        </div>
      ) : (
        <ul className="history-list">
          {history.map((h, i) => (
            <li key={`${h.sessionId}-${h.at}-${i}`} className="history-item">
              <div className="history-top">
                <span className="history-when">{formatDateTimeShort(h.at)}</span>
                <span className="badge badge-navi">{PURPOSE_LABEL[h.purpose]}</span>
              </div>
              <div className="history-body">
                <strong>{h.plate ?? "차량번호 없음"}</strong>
                <span className="muted">{h.userName ? `${h.userName} 이름으로 신고` : "차에 기록된 이용자로 신고"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="muted small-note">
        장부에 최종으로 남은 내용(거리·출발·도착)은 차와 관리자 운행기록부에서 확인할 수 있어요. 이 목록은 이 브라우저에만
        저장돼요.
      </p>
    </div>
  );
}
