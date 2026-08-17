import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMP — End-user Messaging Protocol",
  description: "A signal burst to blockchain users.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
