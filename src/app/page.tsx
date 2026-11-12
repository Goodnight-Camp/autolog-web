import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <h1>운행일지, 폰으로 30초 확인</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          차량이 기록한 운행의 이용자와 목적만 확인하면 회사 차량 장부에 반영됩니다.
        </p>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="qr-box">
          <div className="qr-icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#002C5F" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2" />
            </svg>
          </div>
          <div>
            <strong style={{ fontSize: 18, color: "var(--navy)" }}>차량 화면의 QR을 스캔하세요</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              폰 카메라로 QR을 비추면 확인 화면이 열립니다.
            </p>
          </div>
        </div>
        <ol className="steps muted">
          <li>차량을 켜면 화면에 QR이 나타납니다.</li>
          <li>운행마다 목적(출퇴근·업무·개인)과 이용자를 확인합니다.</li>
          <li>&ldquo;차량에 보내기&rdquo;를 누르면 차량이 P 상태일 때 장부에 반영됩니다.</li>
        </ol>
      </section>

      <p style={{ marginTop: 24 }}>
        <Link href="/admin" className="btn btn-small">
          관리자 화면
        </Link>
      </p>
    </main>
  );
}
