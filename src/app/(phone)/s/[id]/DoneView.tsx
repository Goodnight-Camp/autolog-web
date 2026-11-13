"use client";

import Link from "next/link";
import { useRef } from "react";
import { formatJoinCode } from "@/lib/api";
import { PURPOSE_LABEL, formatDateTimeShort } from "@/lib/format";
import type { Profile } from "@/lib/phoneStore";
import type { Purpose } from "@/lib/types";

export interface DoneInfo {
  /** 확인(제출) 시각 ISO */
  at: string;
  plate: string | null;
  userName: string | null;
  purposes: Purpose[];
  joinCode: string | null;
}

/** 운전자 확인 완료(시안 03b). 계정 시스템이 없으므로 '입력한 이름'으로 정직하게 표시한다. */
export default function DoneView({ info, profile }: { info: DoneInfo; profile: Profile | null | undefined }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const name = info.userName;
  const dept = profile && name && profile.name === name ? profile.dept : "";
  const purposes = [...new Set(info.purposes)].map((p) => PURPOSE_LABEL[p]).join(", ");

  return (
    <div className="done">
      <div className="done-check" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h1 className="phone-title done-title">운전자로 확인됐어요</h1>
      <p className="phone-sub done-sub">
        {name ? `차 화면에도 곧 ${name}님 이름이 표시돼요` : "차 화면에도 곧 신고 내용이 표시돼요"}
      </p>

      <dl className="info-table">
        <div>
          <dt>차량</dt>
          <dd>{info.plate ?? "차량번호 없음"}</dd>
        </div>
        <div>
          <dt>확인 시각</dt>
          <dd>{formatDateTimeShort(info.at)}</dd>
        </div>
        <div>
          <dt>이용자</dt>
          <dd>
            {name ? (
              <>
                {name}
                {dept && ` · ${dept}`} <span className="dd-sub">(입력한 이름)</span>
              </>
            ) : (
              <span className="dd-sub">차에 기록된 이용자 그대로</span>
            )}
          </dd>
        </div>
        <div>
          <dt>목적</dt>
          <dd>{purposes || "-"}</dd>
        </div>
        {info.joinCode && (
          <div>
            <dt>코드</dt>
            <dd className="mono-code">{formatJoinCode(info.joinCode)}</dd>
          </div>
        )}
      </dl>

      <div className="note-box">
        <LockIcon />
        <p>
          이번 운행은 {name ? `${name} 이름으로` : "차에 기록된 이용자로"} 기록돼요. 출발·도착과 거리는 차가 자동으로
          기록하고, 운행이 끝나면 고른 목적으로 장부에 남아요.
        </p>
      </div>

      <Link href="/trips" className="btn btn-primary btn-block">
        확인
      </Link>
      <button type="button" className="btn-text" onClick={() => dialogRef.current?.showModal()}>
        제가 운전하지 않아요 · 취소
      </button>

      <dialog ref={dialogRef} className="sheet" aria-labelledby="cancel-title">
        <h2 id="cancel-title">신고를 취소하고 싶나요?</h2>
        <p>이미 차로 보낸 신고는 이 휴대폰에서 취소할 수 없어요.</p>
        <ul>
          <li>운행이 끝나면 차 화면의 운행 확인에서 &lsquo;이용자 변경&rsquo;으로 바꿀 수 있어요.</li>
          <li>장부에 이미 남았다면 관리자에게 이용자 수정을 요청해 주세요.</li>
        </ul>
        <form method="dialog">
          <button type="submit" className="btn btn-primary btn-block">
            알겠어요
          </button>
        </form>
      </dialog>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
