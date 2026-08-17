import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tổng quan",
  description: "Tổng quan doanh thu, đơn hàng và giao dịch dành cho quản trị viên Order Flow.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
