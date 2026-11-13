import type { Metadata } from "next";
import PhoneShell from "./PhoneShell";

export const metadata: Metadata = {
  title: "오토로그",
};

export default function PhoneLayout({ children }: { children: React.ReactNode }) {
  return <PhoneShell>{children}</PhoneShell>;
}
