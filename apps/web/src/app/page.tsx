export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="bg-gradient-to-r from-pulse-cyan to-pulse-violet bg-clip-text text-5xl font-bold text-transparent shadow-glow">
        EMP
      </h1>
      <p className="max-w-md text-slate-400">
        A signal burst to blockchain users. Link your wallet and Telegram to start receiving curated
        DeFi opportunities — or connect a protocol wallet to reach them.
      </p>
      <div className="flex gap-4">
        <a
          href="/user"
          className="rounded-full border border-pulse-cyan/40 px-6 py-2 text-pulse-cyan transition hover:shadow-glow"
        >
          I&apos;m a user
        </a>
        <a
          href="/protocol"
          className="rounded-full border border-pulse-violet/40 px-6 py-2 text-pulse-violet transition hover:shadow-[0_0_24px_rgba(162,89,255,0.35)]"
        >
          I&apos;m a protocol
        </a>
      </div>
    </main>
  );
}
