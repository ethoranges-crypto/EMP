export type ProtocolStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** Mirrors GET /api/protocol's response shape exactly. */
export interface ProtocolMe {
  wallet: string;
  name: string;
  status: ProtocolStatus;
  approvalNotes: string | null;
}
