/**
 * A token bucket rate limiter for API requests
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;

  /**
   * Create a new rate limiter
   * @param maxTokens Maximum number of tokens the bucket can hold
   * @param refillRate Number of tokens to add per interval
   * @param refillInterval Interval in milliseconds between token refills
   */
  constructor(maxTokens: number, refillRate: number, refillInterval: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / this.refillInterval);
    
    if (intervalsElapsed > 0) {
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + (intervalsElapsed * this.refillRate)
      );
      this.lastRefill = now;
    }
  }

  /**
   * Try to acquire a token
   * @returns true if token was acquired, false otherwise
   */
  async tryAcquire(): Promise<boolean> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    
    return false;
  }

  /**
   * Wait until a token becomes available
   * @param timeout Maximum time to wait in milliseconds
   * @returns true if token was acquired, false if timeout occurred
   */
  async acquire(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.tryAcquire()) {
        return true;
      }
      
      // Wait for next refill interval
      await new Promise(resolve => setTimeout(resolve, this.refillInterval));
    }
    
    return false;
  }
} 