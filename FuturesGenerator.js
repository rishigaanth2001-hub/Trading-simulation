import SeededRandom from '../utils/seededRandom.js';

/**
 * FuturesGenerator - Generates realistic futures prices using cost-of-carry model
 */
class FuturesGenerator {
  constructor(config = {}) {
    this.spotGenerator = config.spotGenerator;
    this.initialDaysToExpiry = config.daysToExpiry || 7;
    this.daysToExpiry = this.initialDaysToExpiry;
    this.riskFreeRate = config.riskFreeRate || 0.065; // 6.5% annualized

    // Initialize random number generator for basis noise
    // Use a seed derived from spotGenerator's seed if available
    const noiseSeed = config.noiseSeed || (config.spotGenerator?.seed || 1) * 31 + 7;
    this.random = new SeededRandom(noiseSeed);

    // State
    this.futuresPrice = this.spotGenerator.getCurrentPrice();
    this.currentBasis = 0;
    this.fairBasis = 0;
    this.noiseBasis = 0;

    // Expiry dampening factor (when daysToExpiry < 1, basis converges to 0)
    this.expiryDampeningFactor = 0.95;

    // Seconds in a trading day
    this.TRADING_SECONDS = 22500; // 6h 15min
  }

  /**
   * Update futures price based on spot and cost-of-carry
   * @param {number} spot - Current spot price
   * @param {number} secondsElapsed - Seconds elapsed since last tick
   * @returns {object} - { futuresPrice, basis, daysToExpiry, fairBasis, noiseBasis }
   */
  nextTick(spot, secondsElapsed) {
    // Decrement days to expiry (22500 seconds = 1 trading day)
    const daysDecrement = secondsElapsed / this.TRADING_SECONDS;
    this.daysToExpiry -= daysDecrement;

    // Clamp to 0 (no negative expiry)
    if (this.daysToExpiry < 0) {
      this.daysToExpiry = 0;
    }

    // Calculate fair basis using cost-of-carry model
    // fairBasis = spot × r × (daysToExpiry / 365)
    this.fairBasis = spot * this.riskFreeRate * (this.daysToExpiry / 365);

    // Generate noise: ±0.5 points random walk
    const randomUniform = this.random.next();
    // Mean-reverting noise: pulls toward 0 while adding small random jitter
    // This keeps noiseBasis in ±3 pts range realistically
    const noiseDelta = (randomUniform - 0.5) * 0.4; // ±0.2 per tick
    this.noiseBasis = this.noiseBasis * 0.998 + noiseDelta;

    // Hard clamp: basis noise never exceeds ±8 pts
    this.noiseBasis = Math.max(-8, Math.min(8, this.noiseBasis));

    // On expiry day (daysToExpiry < 1), dampen noise toward zero
    if (this.daysToExpiry < 1) {
      this.noiseBasis *= this.expiryDampeningFactor;
    }

    // Calculate futures price
    this.futuresPrice = spot + this.fairBasis + this.noiseBasis;

    // Calculate current basis (spread)
    this.currentBasis = this.futuresPrice - spot;

    return {
      futuresPrice: this.futuresPrice,
      basis: this.currentBasis,
      daysToExpiry: Math.max(0, this.daysToExpiry),
      fairBasis: this.fairBasis,
      noiseBasis: this.noiseBasis
    };
  }

  /**
   * Get current spread (futures price - spot)
   * @returns {number} - Current basis/spread
   */
  getSpread() {
    return this.currentBasis;
  }

  /**
   * Get current futures price
   * @returns {number} - Current futures price
   */
  getFuturesPrice() {
    return this.futuresPrice;
  }

  /**
   * Get current days to expiry
   * @returns {number} - Days remaining until expiry
   */
  getDaysToExpiry() {
    return Math.max(0, this.daysToExpiry);
  }

  /**
   * Get current fair basis (theoretical)
   * @returns {number} - Fair basis from cost-of-carry
   */
  getFairBasis() {
    return this.fairBasis;
  }

  /**
   * Check if contract is expired
   * @returns {boolean} - True if daysToExpiry <= 0
   */
  isExpired() {
    return this.daysToExpiry <= 0;
  }

  /**
   * Reset for new contract or simulation
   * @param {number} newDaysToExpiry - Days to expiry for new contract
   */
  resetExpiry(newDaysToExpiry) {
    this.initialDaysToExpiry = newDaysToExpiry;
    this.daysToExpiry = newDaysToExpiry;
    this.noiseBasis = 0;
    this.currentBasis = 0;
    this.fairBasis = 0;
  }
}

export default FuturesGenerator;
