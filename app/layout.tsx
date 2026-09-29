import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Support",
  description: "Chat with the Hermes qa-support profile",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
