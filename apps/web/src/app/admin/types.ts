/** One row from GET /api/admin/protocols. */
export interface PendingProtocol {
  id: string;
  name: string;
  wallet: string;
  accountType: "EOA" | "SAFE";
  safeAddress: string | null;
  createdAt: string;
}
