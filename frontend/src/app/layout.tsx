import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Bot Tele — Admin",
    template: "%s — Bot Tele",
  },
  description: "Không gian quản trị đơn hàng, thanh toán và kho của Bot Tele.",
  applicationName: "Bot Tele Admin",
  icons: {
    icon: "/favicon.ico",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
