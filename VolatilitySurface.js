import SeededRandom from '../utils/seededRandom.js';

/**
 * VolatilitySurface - Models realistic Nifty options IV with smile, skew, and dynamics
 */
class VolatilitySurface {
  constructor(config = {}) {
    this.baseIV = config.baseIV || 0.14; // Starting ATM IV
    this.atmIV = this.baseIV;
    this.prevAtmIV = this.baseIV;
    this.seed = config.seed || 1;
    this.regimeController = config.regimeController;

    // Initialize random number generator
    this.random = new SeededRandom(this.seed);

    // For Box-Muller: store spare normal random when generating pairs
    this.hasSpareNormal = false;
    this.spareNormal = 0;

    // Mean reversion parameters
    this.kappa = 2.0; // Mean reversion speed
    this.theta = 0.14; // Long-run mean (same as base IV)
    this.xi = 0.3; // Vol of volatility

    // Regime tracking for IV shocks
    this.prevRegimeName = this.regimeController?.getCurrentRegime().name || 'CHOPPY';
    this.regimeJumpFactor = 1.0; // Multiplier for regime shocks

    // IV bounds
    this.minIV = 0.05; // 5% minimum
    this.maxIV = 2.0; // 200% maximum
  }

  /**
   * Box-Muller transform: generates standard normal random variables
   */
  nextNormalRandom() {
    if (this.hasSpareNormal) {
      this.hasSpareNormal = false;
      return this.spareNormal;
    }

    let u1, u2, s;
    do {
      u1 = 2 * this.random.next() - 1;
      u2 = 2 * this.random.next() - 1;
      s = u1 * u1 + u2 * u2;
    } while (s >= 1 || s === 0);

    const multiplier = Math.sqrt(-2 * Math.log(s) / s);
    this.spareNormal = u2 * multiplier;
    this.hasSpareNormal = true;
    return u1 * multiplier;
  }

  /**
   * Calculate IV smile at given moneyness
   * iv(strike) = atmIV × (1 - 0.3 × moneyness + 1.5 × moneyness²)
   * @private
   */
  _calculateSmile(atmIV, moneyness) {
    const smileAdjustment = 1 - 0.3 * moneyness + 1.5 * moneyness * moneyness;
    return atmIV * smileAdjustment;
  }

  /**
   * Apply term structure effect (shorter expiry = higher IV)
   * iv(strike, dte) = iv(strike) × (1 + 0.1 × sqrt(30/dte))
   * @private
   */
  _applyTermStructure(iv, daysToExpiry) {
    if (daysToExpiry <= 0) return iv;
    const termAdjustment = 1 + 0.1 * Math.sqrt(30 / Math.max(daysToExpiry, 1));
    return iv * termAdjustment;
  }

  /**
   * Get ATM IV after regime effects
   * @private
   */
  _getEffectiveAtmIV() {
    return this.atmIV * this.regimeJumpFactor;
  }

  /**
   * Get IV for a specific strike and expiry
   * @param {number} strike - Strike price
   * @param {number} spot - Current spot price
   * @param {number} daysToExpiry - Days until expiry
   * @returns {number} - Implied volatility as decimal
   */
  getIV(strike, spot, daysToExpiry) {
    const effectiveAtmIV = this._getEffectiveAtmIV();

    // Calculate moneyness
    const moneyness = (strike - spot) / spot;

    // Apply smile
    let iv = this._calculateSmile(effectiveAtmIV, moneyness);

    // Apply term structure
    iv = this._applyTermStructure(iv, daysToExpiry);

    // Clamp to bounds
    iv = Math.max(this.minIV, Math.min(this.maxIV, iv));

    return iv;
  }

  /**
   * Get current ATM IV
   * @returns {number} - ATM IV decimal
   */
  getAtmIV() {
    return this.atmIV;
  }

  /**
   * Update ATM IV dynamics and check for regime shocks
   * @param {number} spot - Current spot (used for context, not in calculation)
   * @param {number} secondsElapsed - Seconds elapsed since last tick
   * @param {string} regime - Current regime name (from RegimeController)
   * @returns {number} - Updated ATM IV
   */
  tick(spot, secondsElapsed, regime) {
    // Convert seconds to years for mean reversion calculation
    const dt = secondsElapsed / (365.25 * 24 * 3600);

    // Check for regime change and apply shock
    if (regime !== this.prevRegimeName) {
      const prevRegime = this.prevRegimeName;
      this.prevRegimeName = regime;

      // Apply regime shock: HIGH_VOL and FLASH_CRASH increase IV by 20-50%
      if (regime === 'HIGH_VOL') {
        const shock = 1 + (0.2 + 0.3 * this.random.next()); // 20-50% increase
        this.regimeJumpFactor = shock;
      } else if (regime === 'FLASH_CRASH') {
        const shock = 1 + (0.3 + 0.2 * this.random.next()); // 30-50% increase
        this.regimeJumpFactor = shock;
      } else if (prevRegime === 'HIGH_VOL' || prevRegime === 'FLASH_CRASH') {
        // Revert from shock back to normal
        this.regimeJumpFactor = Math.max(1.0, this.regimeJumpFactor - 0.1);
      }
    }

    // Mean reversion: d(atmIV) = κ(θ - atmIV)dt + ξ√(atmIV)dW
    const driftTerm = this.kappa * (this.theta - this.atmIV) * dt;
    const volatilityTerm = this.xi * Math.sqrt(Math.max(this.atmIV, 0.01)) * Math.sqrt(dt) * this.nextNormalRandom();

    this.prevAtmIV = this.atmIV;
    this.atmIV = this.atmIV + driftTerm + volatilityTerm;

    // Clamp to bounds
    this.atmIV = Math.max(this.minIV, Math.min(this.maxIV, this.atmIV));

    return this.atmIV;
  }

  /**
   * Get VIX-like index (volatility index)
   * VIX approximation: atmIV × 100 × sqrt(252/256) ≈ atmIV × 100
   * More precisely: sqrt(365) ≈ 19.1, so atmIV × 100 × sqrt(365) / 100 ≈ atmIV × 19.1
   * But commonly: VIX = atmIV × 100 for simplicity
   * @returns {number} - VIX-like number (e.g., 20 = 20%)
   */
  getVixLike() {
    const effectiveAtmIV = this._getEffectiveAtmIV();
    // Annualized volatility index: atmIV × 100 × sqrt(365)
    return effectiveAtmIV * 100 * Math.sqrt(365);
  }

  /**
   * Get simplified VIX (atmIV × 100)
   * @returns {number} - Simplified VIX (e.g., 14 = 14%)
   */
  getVixSimple() {
    const effectiveAtmIV = this._getEffectiveAtmIV();
    return effectiveAtmIV * 100;
  }

  /**
   * Get full IV surface parameters for debugging
   * @returns {object} - Surface state
   */
  getState() {
    return {
      atmIV: this.atmIV,
      vixSimple: this.getVixSimple(),
      vixLike: this.getVixLike(),
      regimeJumpFactor: this.regimeJumpFactor,
      kappa: this.kappa,
      theta: this.theta,
      xi: this.xi
    };
  }
}

export default VolatilitySurface;
