export interface ICancelledBannerProps {
  /** Why the bill was cancelled, as the owner typed it. */
  cancelReason: string | null;
  /** When it was cancelled (an ISO timestamp), or null if unknown. */
  cancelledAt: string | null;
}
