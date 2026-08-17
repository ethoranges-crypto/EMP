// TODO: SIWE connect -> application form -> (once approved) campaign
// create/compose/submit + dashboard (SPEC §4.2-4.4). API routes already
// wired: /api/auth/siwe/*, /api/protocol/audience-count,
// /api/protocol/campaigns/:id/metrics.
export default function ProtocolJourneyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-slate-400">
      <h1 className="text-2xl font-semibold text-pulse-violet">Protocol dashboard</h1>
      <p>Application, campaign composer, and metrics dashboard UI goes here.</p>
    </main>
  );
}
