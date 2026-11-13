"use client";

import Link from "next/link";

/** 상단 관리자 메뉴. 폰 셸 화면에서는 SiteHeader 전체가 숨는다. */
export default function TopNav() {
  return (
    <nav className="topnav" aria-label="주 메뉴">
      <Link href="/admin">운행기록부</Link>
    </nav>
  );
}
