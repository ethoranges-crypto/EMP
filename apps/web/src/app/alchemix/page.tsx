import type { Metadata } from "next";
import Link from "next/link";
import { Spectral, Montserrat } from "next/font/google";
import { AlchemixMark, AlchemixWordmark } from "./AlchemixMarks";

export const metadata: Metadata = {
  title: "Alchemix × EMP — Stay up to date",
  description: "Link any wallet to your Telegram once and hear from the Alchemix team on your terms.",
};

// This page's own fonts, scoped to this route only via the className below
// (next/font variables cascade through the tree they're applied to — they
// don't need to sit on <html>/<body>). The shared app keeps Space
// Grotesk/JetBrains Mono via the root layout; nothing here touches that.
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--alx-font-spectral",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--alx-font-montserrat",
  display: "swap",
});

const ACCENT = "#F5C09A";
const INK = "rgba(212,212,212,.86)";

function Bullet({ lead, rest }: { lead?: string; rest: string }) {
  return (
    <li style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
      <span style={{ marginTop: 7, width: 5, height: 5, flex: "0 0 5px", background: ACCENT, transform: "rotate(45deg)" }} />
      <span style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(212,212,212,.82)" }}>
        {lead && <strong style={{ color: "#fff", fontWeight: 600 }}>{lead}: </strong>}
        {rest}
      </span>
    </li>
  );
}

function AlertCard({
  label,
  message,
  time,
  highlighted = false,
}: {
  label: string;
  message: string;
  time: string;
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        borderLeft: `2px solid ${highlighted ? ACCENT : "rgba(212,212,212,.3)"}`,
        background: highlighted ? "rgba(245,192,154,.07)" : "rgba(212,212,212,.04)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <span style={{ fontSize: 10, letterSpacing: ".16em", fontWeight: 600, color: highlighted ? ACCENT : "rgba(212,212,212,.7)" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: highlighted ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.88)" }}>
        {message}
      </span>
      <span style={{ fontSize: 11, color: "rgba(212,212,212,.68)" }}>{time}</span>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: "var(--alx-font-spectral), Georgia, serif", fontSize: 13, color: ACCENT }}>
        {n} - {text}
      </span>
    </div>
  );
}

/**
 * Alchemix partner landing — served at alchemix.emp-protocol.xyz's root via
 * src/middleware.ts rewriting "/" to this route on that host only. Fully
 * self-contained: inline styles + this page's own next/font instances, no
 * Tailwind classes and no shared EMP design tokens (tailwind.config.ts,
 * globals.css) referenced anywhere below — recreates the Claude Design
 * handoff's look without touching the system the rest of the app draws
 * from.
 *
 * Copy deviates from the CD handoff per explicit instruction — no
 * "OFFICIAL PARTNERSHIP" badge, no "How it works"/"FAQ" nav links, reworded
 * headline/subhead/bullets, no "~40 seconds" CTA caption, reordered +
 * reworded footer steps (now matching the real /user flow order: connect →
 * interests → Telegram), no footer legal line, reworded alert-preview cards
 * and privacy line. See AlchemixMarks.tsx: the logo/mark are placeholders,
 * not Alchemix's real brand assets (never supplied to this session).
 */
export default function AlchemixLandingPage() {
  return (
    <main
      className={`${spectral.variable} ${montserrat.variable}`}
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(120% 90% at 78% -10%, #0a3b57 0%, #072a3e 32%, #14171a 68%, #181819 100%)",
        fontFamily: "var(--alx-font-montserrat), Helvetica, Arial, sans-serif",
        color: "#D4D4D4",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(245,192,154,.08) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          right: -180,
          top: -220,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,192,154,.16) 0%, rgba(245,192,154,0) 65%)",
          pointerEvents: "none",
        }}
      />

      <header
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "26px 56px 0 56px",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <AlchemixWordmark height={22} />
          <div style={{ width: 1, height: 22, background: "rgba(212,212,212,.25)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--alx-font-spectral), Georgia, serif", fontSize: 15, color: "rgba(212,212,212,.5)" }}>×</span>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: ".22em", color: "#F5F5F5" }}>EMP</span>
          </div>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 34, fontSize: 13, letterSpacing: ".04em" }}>
          <a href="#privacy" style={{ color: "rgba(212,212,212,.72)" }}>
            Privacy
          </a>
          <Link
            href="/user"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 38,
              padding: "0 22px",
              border: "1px solid rgba(245,192,154,.55)",
              borderRadius: 2,
              color: ACCENT,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: ".06em",
            }}
          >
            REGISTER
          </Link>
        </nav>
      </header>

      <div
        style={{
          position: "relative",
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 424px",
          gap: 56,
          alignItems: "center",
          padding: "40px 56px",
        }}
      >
        <section style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--alx-font-spectral), Georgia, serif",
              fontWeight: 400,
              fontSize: 52,
              lineHeight: 1.1,
              letterSpacing: "-.015em",
              color: "#FFFFFF",
              maxWidth: 640,
            }}
          >
            Stay up to date with the latest opportunities
          </h1>

          <p style={{ margin: 0, maxWidth: 560, fontSize: 16, lineHeight: 1.62, color: INK }}>
            Link any wallet to your Telegram once, choose the topics you want to hear about and receive messages
            from the Alchemix team directly to your TG.
          </p>

          <ul style={{ margin: "4px 0 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 13, maxWidth: 560 }}>
            <Bullet lead="Private by design" rest="Your wallet address and your Telegram handle are never linked or passed over to any protocol." />
            <Bullet rest="Only receive messages about topics you want to hear about." />
            <Bullet lead="Sign in with Ethereum" rest="Prove you're onchain with any wallet, no need to use your main or active wallets." />
          </ul>

          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 8 }}>
            <Link
              href="/user"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 52,
                padding: "0 42px",
                background: ACCENT,
                color: "#05344E",
                borderRadius: 2,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: ".12em",
              }}
            >
              REGISTER
            </Link>
          </div>
        </section>

        <aside
          style={{
            position: "relative",
            border: "1px solid rgba(212,212,212,.14)",
            borderRadius: 4,
            background: "rgba(24,24,25,.72)",
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            boxShadow: "0 30px 70px rgba(0,0,0,.45)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid rgba(212,212,212,.1)" }}>
            <AlchemixMark size={30} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Alchemix Alerts</span>
              <span style={{ fontSize: 11, color: "rgba(212,212,212,.5)" }}>via EMP · Telegram</span>
            </div>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: ACCENT,
                animation: "alxPulse 2.4s ease-in-out infinite",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AlertCard label="YIELD UPDATE" message="alETH fixed yields are now 6% APY!" time="2m ago" highlighted />
            <AlertCard label="NEW PRODUCT" message="A new lending market is available in our ecosystem page" time="1h ago" />
            <AlertCard label="OPPORTUNITY" message="alETH fixed yield term has been dropped to 5 months" time="Yesterday" />
          </div>

          <div id="privacy" style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingTop: 14, borderTop: "1px solid rgba(212,212,212,.1)" }}>
            <span style={{ fontFamily: "var(--alx-font-spectral), Georgia, serif", fontSize: 16, color: ACCENT, lineHeight: 1 }}>◇</span>
            <span style={{ fontSize: 11, lineHeight: 1.55, color: "rgba(212,212,212,.6)" }}>
              Service provided in partnership with{" "}
              <a href="https://emp-protocol.xyz" style={{ color: ACCENT }}>
                EMP (emp-protocol.xyz)
              </a>
            </span>
          </div>
        </aside>
      </div>

      <footer
        style={{
          position: "relative",
          borderTop: "1px solid rgba(212,212,212,.12)",
          background: "rgba(5,52,78,.35)",
          padding: "20px 56px",
          display: "flex",
          alignItems: "center",
          gap: 44,
          flexWrap: "wrap",
        }}
      >
        <Step n="01" text="Sign in with any wallet" />
        <Step n="02" text="Choose your interests" />
        <Step n="03" text="Link the EMP bot with a one-time code" />
      </footer>

      <style>{`@keyframes alxPulse { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.35); } }`}</style>
    </main>
  );
}
