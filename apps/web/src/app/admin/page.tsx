// TODO: admin SIWE login -> protocol approvals, campaign moderation queue,
// category CRUD, cost/token settings (SPEC §4.5). API routes already wired:
// /api/admin/protocols/:id/approve, /api/admin/campaigns/:id/moderate.
export default function AdminPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-slate-400">
      <h1 className="text-2xl font-semibold text-slate-200">Admin console</h1>
      <p>Protocol approvals, moderation queue, and settings UI goes here.</p>
    </main>
  );
}
