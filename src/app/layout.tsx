import type { Metadata, Viewport } from "next";
import Link from "next/link";
import TopNav from "./TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autolog",
  description: "차량 운행일지 확인 — 이용자·목적을 폰에서 확인하고 차량 장부에 반영합니다.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002C5F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            Autolog
          </Link>
          <TopNav />
        </header>
        {children}
      </body>
    </html>
  );
}
