"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 상단 관리자 메뉴. 폰 화면(/s/..., 코드 입력 /c)에서는 숨긴다. */
export default function TopNav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/s/") || pathname === "/c") return null;
  return (
    <nav className="topnav" aria-label="주 메뉴">
      <Link href="/admin">운행기록부</Link>
    </nav>
  );
}
