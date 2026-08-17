import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { readSessionTokens } from "@/lib/server-api";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { accessToken } = await readSessionTokens();
  if (!accessToken) {
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
