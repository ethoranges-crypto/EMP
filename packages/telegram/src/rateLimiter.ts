/**
 * In-process token bucket. The bulk-send throttle is primarily enforced by
 * BullMQ's queue-level `limiter` option in apps/worker (SPEC §8: ~30 msg/s
 * global) — this is a lighter-weight safety net for any direct bot.api call
 * (e.g. apps/bot's linking flow) that doesn't go through that queue.
 */
export class TokenBucketLimiter {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly maxTokensPerSecond: number,
  ) {
    this.tokens = maxTokensPerSecond;
    this.lastRefillAt = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillAt) / 1000;
    this.tokens = Math.min(this.maxTokensPerSecond, this.tokens + elapsedSeconds * this.maxTokensPerSecond);
    this.lastRefillAt = now;
  }

  /** Resolves once a token is available, consuming it. */
  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = ((1 - this.tokens) / this.maxTokensPerSecond) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
