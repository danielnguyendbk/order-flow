import Link from "next/link";
import { Panel } from "@/components/ui";

export default function ForbiddenPage() {
  return (
    <div className="flex justify-center py-16">
      <Panel className="w-full max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl font-extrabold text-red-600">
          !
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-ink">Không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-muted">Tài khoản của bạn không có quyền thực hiện thao tác này.</p>
        <Link href="/dashboard" className="btn mt-6">Quay lại tổng quan</Link>
      </Panel>
    </div>
  );
}
