import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { readSessionTokens } from "@/lib/server-api";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { accessToken } = await readSessionTokens();
  if (!accessToken) {
    redirect("/login");
  }
  return <AppShell>{children}</AppShell>;
}
