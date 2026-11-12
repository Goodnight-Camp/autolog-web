"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 상단 관리자 메뉴. QR로 여는 폰 운행 확인 화면(/s/...)에서는 숨긴다. */
export default function TopNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/s/")) return null;
  return (
    <nav className="topnav" aria-label="주 메뉴">
      <Link href="/admin">운행기록부</Link>
    </nav>
  );
}
