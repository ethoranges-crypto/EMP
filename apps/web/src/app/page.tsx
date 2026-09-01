import Link from "next/link";
import { getChains } from "@emp/config";
import { PAYMENT_TOKENS } from "@emp/config/paymentTokens";
import { EmpMark } from "./EmpMark";

function StatColumn({
  label,
  value,
  sub,
  bordered = true,
}: {
  label: string;
  value: string;
  sub: string;
  bordered?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 p-8 ${bordered ? "border-r border-white/[.06]" : ""}`}>
      <div className="font-mono text-[9.5px] tracking-[.2em] text-ink-5">{label}</div>
      <div className="text-[15px] font-medium">{value}</div>
      <div className="text-[12.5px] leading-[1.45] text-ink-3">{sub}</div>
    </div>
  );
}

/**
 * The Claude Design handoff's landing page ("01 — Landing /"), recreated with
 * our shared tokens rather than the mockup's literal inline styles — every
 * colour here is an existing pulse-x/ink-x/void/surface token, and the two
 * pulse animations (rings, breathing dot) reuse empPulse/empBreathe, not
 * bespoke keyframes.
 *
 * Flagged deviations from the design (flag, don't fake):
 *  - CHAINS/accepted-tokens are real, not the mockup's literal
 *    "Ethereum · Arbitrum · OP · Base" / "USDC, USDT, ETH accepted." —
 *    pulled from getChains() (only chains with a configured RPC — SPEC
 *    "config-driven chains") and PAYMENT_TOKENS. ETH is dropped: CLAUDE.md
 *    is explicit that ETH isn't an accepted payment token.
 *  - Header nav ("how it works" / "pricing" / "docs" / "connect wallet")
 *    removed entirely — they were inert placeholders with no destination;
 *    entry is via the "I'm a user" / "I'm a protocol" cards below.
 *  - Dropped the mockup's rotating dashed ring with orbiting coloured
 *    dots around the hero orb — pure ornament with no real state behind
 *    the three dot colours, and it would've needed a new bespoke
 *    keyframe for a single one-off use.
 *  - No page-specific responsive/mobile layout — matches the rest of
 *    this app (fixed-width rails throughout protocol/admin), not a new
 *    gap introduced here.
 */
export default function HomePage() {
  const chainNames = getChains().map((c) => c.displayName);
  const chainsValue = chainNames.length > 0 ? chainNames.join(" · ") : "Configuring…";
  const tokensSub = `${PAYMENT_TOKENS.join(", ")} accepted.`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-void text-ink-1">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(900px 520px at 78% 34%, rgba(53,230,242,.10), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)",
          backgroundSize: "62px 62px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-[1240px] flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[.07] px-12">
          <div className="flex items-center gap-3.5">
            <EmpMark size={22} />
            <span className="text-[17px] font-semibold tracking-[.06em]">EMP</span>
            <span className="h-4 w-px bg-white/[.14]" />
            <span className="font-mono text-[10.5px] uppercase tracking-[.13em] text-ink-5">
              end-user messaging protocol
            </span>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-[634px_1fr] items-center gap-8 px-12">
          <div className="flex flex-col py-10">
            <div className="mb-6 flex items-center gap-2.5">
              <span className="motion-safe:animate-empBreathe h-[5px] w-[5px] rounded-full bg-pulse-cyan" />
              <span className="font-mono text-[10.5px] uppercase tracking-[.28em] text-pulse-cyan">
                the signal layer for defi
              </span>
            </div>
            <h1 className="text-[56px] font-medium leading-[1.0] tracking-[-.035em]">
              Fire a pulse.
              <br />
              Reach only the
              <br />
              wallets that <span className="text-pulse-cyan">asked</span>.
            </h1>
            <p className="mt-6 max-w-[472px] text-[16.5px] leading-[1.6] text-ink-3">
              Users link a wallet and Telegram, then pick what they want to hear about with total
              privacy. Protocols create campaigns to target audiences without receiving user
              information.
            </p>

            <div className="mt-8 grid max-w-[538px] grid-cols-2 gap-[18px]">
              <Link
                href="/user"
                className="flex flex-col gap-3 border border-pulse-cyan/30 px-[22px] py-5 transition hover:border-pulse-cyan"
                style={{ background: "linear-gradient(180deg, rgba(53,230,242,.07), rgba(53,230,242,.015))" }}
              >
                <span className="font-mono text-[10px] tracking-[.2em] text-pulse-cyan">RECEIVE</span>
                <span className="text-[21px] font-medium tracking-[-.01em]">I&apos;m a user</span>
                <span className="text-[13.5px] leading-[1.55] text-ink-3">
                  Link wallet + Telegram, choose your categories, get curated opportunities. Free.
                </span>
                <span className="mt-1.5 flex items-center gap-2 font-mono text-[11.5px] tracking-[.08em] text-pulse-cyan">
                  register <span className="text-[13px]">→</span>
                </span>
              </Link>
              <Link
                href="/protocol"
                className="flex flex-col gap-3 border border-pulse-violet/30 px-[22px] py-5 transition hover:border-pulse-violet"
                style={{ background: "linear-gradient(180deg, rgba(154,123,255,.07), rgba(154,123,255,.015))" }}
              >
                <span className="font-mono text-[10px] tracking-[.2em] text-pulse-violet">TRANSMIT</span>
                <span className="text-[21px] font-medium tracking-[-.01em]">I&apos;m a protocol</span>
                <span className="text-[13.5px] leading-[1.55] text-ink-3">
                  Target by interest, send custom messages &amp; track CTR.
                </span>
                <span className="mt-1.5 flex items-center gap-2 font-mono text-[11.5px] tracking-[.08em] text-pulse-violet">
                  apply <span className="text-[13px]">→</span>
                </span>
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="relative flex h-[400px] w-[400px] items-center justify-center">
              <div className="motion-safe:animate-empPulse absolute h-[400px] w-[400px] rounded-full border border-pulse-cyan/50" />
              <div
                className="motion-safe:animate-empPulse absolute h-[400px] w-[400px] rounded-full border border-pulse-cyan/40"
                style={{ animationDelay: "1.1s" }}
              />
              <div
                className="motion-safe:animate-empPulse absolute h-[400px] w-[400px] rounded-full border border-pulse-violet/35"
                style={{ animationDelay: "2.2s" }}
              />
              <div
                className="motion-safe:animate-empPulse absolute h-[400px] w-[400px] rounded-full border border-pulse-cyan/20"
                style={{ animationDelay: "3.3s" }}
              />
              <div
                className="relative flex h-[118px] w-[118px] items-center justify-center rounded-full border border-pulse-cyan/55"
                style={{
                  background: "radial-gradient(circle, rgba(53,230,242,.22), rgba(6,8,10,.9) 70%)",
                  boxShadow: "0 0 60px rgba(53,230,242,.25)",
                }}
              >
                <span className="font-mono text-[12px] tracking-[.24em] text-pulse-cyan">EMP</span>
              </div>
            </div>
            <div className="absolute bottom-8 right-0 flex max-w-[280px] flex-col items-end gap-1.5">
              <span className="text-right font-mono text-[10px] leading-[1.5] tracking-[.16em] text-ink-5">
                All protocols &amp; outbound messages pre-approved to avoid spam or malicious activity.
              </span>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-4 border-t border-white/[.07]">
          <StatColumn label="PRIVACY BOUNDARY" value="Aggregates only" sub="No addresses, no handles, ever." />
          <StatColumn label="ANTI-SYBIL" value="1 wallet ↔ 1 Telegram" sub="Audience ≈ distinct humans." />
          <StatColumn label="METRICS" value="Delivered % · click %" sub="Honest signals, no fake reads." />
          <StatColumn label="CHAINS" value={chainsValue} sub={tokensSub} bordered={false} />
        </div>
      </div>
    </main>
  );
}
