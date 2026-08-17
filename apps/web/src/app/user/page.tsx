// TODO: SIWE connect -> interests picker -> Telegram link deep link (SPEC §4.1).
// The API routes this page will call already exist: /api/auth/siwe/*,
// /api/user/interests, /api/user/telegram-link-request, /api/user/telegram-link.
export default function UserJourneyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-slate-400">
      <h1 className="text-2xl font-semibold text-pulse-cyan">User onboarding</h1>
      <p>Wallet connect, interests, and Telegram linking UI goes here.</p>
    </main>
  );
}
