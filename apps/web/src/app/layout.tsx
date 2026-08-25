import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "EMP — End-user Messaging Protocol",
  description: "A signal burst to blockchain users.",
};

// The design system's two typefaces (SPEC §13 + the design-token handoff):
// Space Grotesk for UI/headings, JetBrains Mono for data/numerals/labels.
// Exposed as CSS variables so tailwind.config.ts's fontFamily.sans/mono can
// reference them — next/font self-hosts + subsets automatically, no
// render-blocking Google Fonts request.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
