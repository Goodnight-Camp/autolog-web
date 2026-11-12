import Link from "next/link";

/** 관리자 화면 탭: 운행기록부(주) · QR 세션(보조) */
export function AdminNav({ active }: { active: "ledger" | "sessions" }) {
  return (
    <nav className="admin-nav" aria-label="관리자 메뉴">
      <Link href="/admin" aria-current={active === "ledger" ? "page" : undefined}>
        운행기록부
      </Link>
      <Link href="/admin/sessions" aria-current={active === "sessions" ? "page" : undefined}>
        QR 세션
      </Link>
    </nav>
  );
}
