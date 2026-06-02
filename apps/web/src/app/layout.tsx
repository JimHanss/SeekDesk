import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SeekDesk",
  description: "DeepSeek-native web coding agent platform for developers."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
