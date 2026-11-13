"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPhonePath } from "@/lib/scan";
import TopNav from "./TopNav";

/** 관리자·소개 화면의 상단 바. 폰 셸 화면에서는 폰 전용 머리글을 쓰므로 숨긴다. */
export default function SiteHeader() {
  const pathname = usePathname();
  if (isPhonePath(pathname)) return null;
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        Autolog
      </Link>
      <TopNav />
    </header>
  );
}
