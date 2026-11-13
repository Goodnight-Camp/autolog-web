"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initialOf } from "@/lib/phoneStore";
import { phoneTabOf, type PhoneTab } from "@/lib/scan";
import { useProfile } from "./usePhoneStore";

const TABS: { id: PhoneTab; href: string; label: string; icon: React.ReactNode }[] = [
  {
    id: "trips",
    href: "/trips",
    label: "내 운행",
    icon: (
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    ),
  },
  {
    id: "scan",
    href: "/scan",
    label: "QR 스캔",
    icon: (
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
    ),
  },
  {
    id: "settings",
    href: "/settings",
    label: "설정",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
  },
];

/** 폰 전용 화면 틀: 상단 '오토로그' + 내 정보 칩, 하단 탭 3개(내 운행 / QR 스캔 / 설정). */
export default function PhoneShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = phoneTabOf(pathname);
  const profile = useProfile();

  return (
    <div className="phone">
      <header className="phone-top">
        <Link href="/scan" className="phone-brand">
          오토로그
        </Link>
        {profile && (
          <Link href="/settings" className="user-chip" aria-label={`내 정보: ${profile.name}${profile.dept ? `, ${profile.dept}` : ""}`}>
            <span className="user-chip-initial" aria-hidden="true">
              {initialOf(profile.name)}
            </span>
            <span className="user-chip-text">
              {profile.name}
              {profile.dept && ` · ${profile.dept}`}
            </span>
          </Link>
        )}
      </header>

      <main className="phone-main">{children}</main>

      <nav className="phone-tabs" aria-label="폰 메뉴">
        {TABS.map((t) => (
          <Link key={t.id} href={t.href} className="phone-tab" aria-current={active === t.id ? "page" : undefined}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {t.icon}
            </svg>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
