import type { CampaignPaymentInfo } from "./types";

/**
 * The clean "paid" state for a campaign with a verified payment — replaces
 * the "Pay to fire" instructions/treasury address/copy-address panel once
 * there's nothing left to pay. Shown by CampaignView (the normal way a
 * paid campaign is reached, per the paid-campaign routing fix) and by
 * PaymentScreen for the in-session case where a protocol is already
 * watching an AWAITING_PAYMENT campaign when the worker verifies it —
 * that screen stays open through the transition rather than bouncing
 * away, so it must never keep showing pay instructions once verified
 * either.
 */
export function PaidPanel({ payment }: { payment: CampaignPaymentInfo }) {
  const amount = Number(payment.amount);
  return (
    <div className="grid grid-cols-3 gap-4 rounded-card border border-pulse-green/30 bg-pulse-green/5 p-[18px]">
      <div className="flex flex-col gap-[7px]">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-pulse-green/80">AMOUNT</div>
        <div className="font-mono text-[22px] font-medium leading-none text-pulse-green">
          {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className="flex flex-col gap-[7px]">
        <div className="font-mono text-[9.5px] font-medium tracking-[.12em] text-pulse-green/80">TOKEN · CHAIN</div>
        <div className="text-[13px] text-ink-1">
          {payment.token} on {payment.chain}
        </div>
      </div>
      <div className="flex flex-col items-start justify-center gap-[7px] sm:items-end">
        <div className="flex items-center gap-1.5 rounded-chip bg-pulse-green/15 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-pulse-green" />
          <span className="font-mono text-[11.5px] font-medium text-pulse-green">Paid ✓</span>
        </div>
      </div>
    </div>
  );
}
