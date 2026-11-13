"use client";

import { useState } from "react";
import { PROFILE_FIELD_MAX, clearHistory, clearProfile, saveProfile } from "@/lib/phoneStore";
import { useHistory, useProfile } from "../usePhoneStore";

/** 설정: 내 이름·부서(이 폰에만 저장)와 개인정보 안내 */
export default function SettingsPage() {
  const profile = useProfile();
  const history = useHistory();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="settings">
      <h1 className="phone-title">설정</h1>
      <p className="phone-sub">신고할 때 이용자 이름이 자동으로 채워져요</p>

      {profile === undefined ? (
        <p className="muted" role="status">
          불러오는 중…
        </p>
      ) : (
        <ProfileForm key={profile ? `${profile.name}|${profile.dept}` : "none"} name={profile?.name ?? ""} dept={profile?.dept ?? ""} saved={!!profile} msg={msg} onMsg={setMsg} />
      )}

      <section className="panel settings-section">
        <h2>개인정보 안내</h2>
        <ul className="privacy-list">
          <li>이름·부서와 신고 내역은 <b>이 휴대폰 브라우저에만</b> 저장돼요. 오토로그 서버에 계정을 만들지 않아요.</li>
          <li>신고할 때는 입력한 <b>이용자 이름과 목적만</b> 차로 보내요. 부서는 보내지 않아요.</li>
          <li>브라우저 데이터를 지우면 함께 지워져요.</li>
        </ul>
        <button
          type="button"
          className="btn btn-small"
          disabled={!history || history.length === 0}
          onClick={() => {
            if (window.confirm("이 휴대폰의 신고 내역을 모두 지울까요?")) clearHistory();
          }}
        >
          신고 내역 지우기{history && history.length > 0 ? ` (${history.length}건)` : ""}
        </button>
      </section>
    </div>
  );
}

interface ProfileFormProps {
  name: string;
  dept: string;
  saved: boolean;
  msg: string | null;
  onMsg: (m: string | null) => void;
}

/** 저장·삭제하면 key가 바뀌어 새로 그려지므로 안내 문구는 상위에서 들고 있는다. */
function ProfileForm({ name: name0, dept: dept0, saved, msg, onMsg: setMsg }: ProfileFormProps) {
  const [name, setName] = useState(name0);
  const [dept, setDept] = useState(dept0);
  const dirty = name.trim() !== name0 || dept.trim() !== dept0;

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMsg(saveProfile({ name, dept }) ? "저장했어요." : "이 브라우저에서는 저장할 수 없어요(사생활 보호 모드 등).");
  }

  return (
    <form className="panel settings-section" onSubmit={onSave}>
      <h2>내 정보</h2>
      <label className="field-label" htmlFor="me-name">
        이름
      </label>
      <input
        id="me-name"
        className="input"
        autoComplete="name"
        maxLength={PROFILE_FIELD_MAX}
        placeholder="예: 김민수"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setMsg(null);
        }}
      />
      <label className="field-label" htmlFor="me-dept">
        부서 <span className="optional">(선택)</span>
      </label>
      <input
        id="me-dept"
        className="input"
        autoComplete="organization-title"
        maxLength={PROFILE_FIELD_MAX}
        placeholder="예: 영업팀"
        value={dept}
        onChange={(e) => {
          setDept(e.target.value);
          setMsg(null);
        }}
      />
      {msg && (
        <p className="field-help" role="status">
          {msg}
        </p>
      )}
      <div className="settings-actions">
        <button type="submit" className="btn btn-primary" disabled={!name.trim() || !dirty}>
          저장
        </button>
        {saved && (
          <button
            type="button"
            className="btn"
            onClick={() => setMsg(clearProfile() ? "삭제했어요." : "이 브라우저에서는 지울 수 없어요.")}
          >
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
