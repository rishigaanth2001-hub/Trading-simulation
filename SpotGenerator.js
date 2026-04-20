import SeededRandom from '../utils/seededRandom.js';

/**
 * SpotGenerator - Generates realistic Nifty spot prices using GBM + GARCH(1,1)
 */
class SpotGenerator {
  constructor(config = {}) {
    this.basePrice = config.basePrice || 23500;
    this.seed = config.seed || 1;
    this.regimeController = config.regimeController;

    // Initialize random number generator
    this.random = new SeededRandom(this.seed);

    // Price state
    this.currentPrice = this.basePrice;
    this.prevPrice = this.basePrice;

    // GARCH(1,1) parameters
    this.garchOmega = 0.000001;
    this.garchAlpha = 0.1;
    this.garchBeta = 0.88;
    this.garchVariance = 0.0001;
    this.prevReturn = 0;

    // OHLC tracking for current candle
    this.candleSeconds = config.candleSeconds || 60; // 1-min candles by default
    this.candleElapsed = 0;
    this.candleOpen = this.basePrice;
    this.candleHigh = this.basePrice;
    this.candleLow = this.basePrice;

    // For Box-Muller: store spare normal random when generating pairs
    this.hasSpareNormal = false;
    this.spareNormal = 0;

    // Time tracking (in seconds from 9:15 AM)
    this.secondsFromMarketOpen = 0;

    // Intraday volatility schedule (seconds from 9:15 AM as key)
    this.intradayVolMultipliers = [
      { minSeconds: 0, maxSeconds: 1800, multiplier: 2.5 }, // 9:15–9:45
      { minSeconds: 1800, maxSeconds: 8100, multiplier: 1.0 }, // 9:45–11:30
      { minSeconds: 8100, maxSeconds: 15300, multiplier: 0.6 }, // 11:30–1:30 PM
      { minSeconds: 15300, maxSeconds: 21600, multiplier: 1.2 }, // 1:30–3:00 PM
      { minSeconds: 21600, maxSeconds: 22500, multiplier: 2.0 } // 3:00–3:30 PM
    ];
  }

  /**
   * Get intraday volatility multiplier based on time of day
   */
  getIntradayVolMultiplier() {
    const schedule = this.intradayVolMultipliers;
    for (let i = 0; i < schedule.length; i++) {
      const { minSeconds, maxSeconds, multiplier } = schedule[i];
      if (this.secondsFromMarketOpen >= minSeconds && this.secondsFromMarketOpen < maxSeconds) {
        return multiplier;
      }
    }
    return 1.0; // Fallback
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
   * Advance time by elapsedSeconds and generate new price
   * @param {number} secondsElapsed - Seconds elapsed since last tick
   * @returns {object} - { price, timestamp, regime }
   */
  nextTick(secondsElapsed) {
    this.secondsFromMarketOpen += secondsElapsed;
    this.candleElapsed += secondsElapsed;

    // Get regime parameters
    const regime = this.regimeController.getCurrentRegime();
    const drift = regime.drift;
    const regimeVolMult = this.regimeController.getVolMultiplier();

    // Update GARCH variance: σ²_t = ω + α*r²_{t-1} + β*σ²_{t-1}
    const returnSquared = this.prevReturn * this.prevReturn;
    this.garchVariance =
      this.garchOmega + this.garchAlpha * returnSquared + this.garchBeta * this.garchVariance;

    // Calculate volatility with all multipliers
    const baseVol = Math.sqrt(this.garchVariance);
    const intradayMult = this.getIntradayVolMultiplier();
    const totalVol = baseVol * intradayMult * regimeVolMult;

    // GBM step: dS = μ*S*dt + σ*S*√dt*Z
    // dt = secondsElapsed / 86400 (seconds in trading day)
    // S_t = S_{t-1} * exp(μ*dt + σ*√dt*Z)
    const dt = secondsElapsed / 86400;
    const sqrtDt = Math.sqrt(dt);
    const z = this.nextNormalRandom();

    const logReturn = drift * dt + totalVol * sqrtDt * z;
    const newPrice = this.currentPrice * Math.exp(logReturn);

    // Track return for next GARCH step
    this.prevReturn = Math.log(newPrice / this.currentPrice);

    // Update price
    this.prevPrice = this.currentPrice;
    this.currentPrice = newPrice;

    // Update OHLC
    if (this.candleElapsed === secondsElapsed) {
      // First tick of new candle
      this.candleOpen = newPrice;
      this.candleHigh = newPrice;
      this.candleLow = newPrice;
    } else {
      this.candleHigh = Math.max(this.candleHigh, newPrice);
      this.candleLow = Math.min(this.candleLow, newPrice);
    }

    return {
      price: newPrice,
      timestamp: this.secondsFromMarketOpen,
      regime: regime.name
    };
  }

  /**
   * Get completed candle if candleSeconds has elapsed
   * @returns {object|null} - { open, high, low, close, timestamp } or null if candle not complete
   */
  getCandle() {
    if (this.candleElapsed >= this.candleSeconds) {
      const candle = {
        open: this.candleOpen,
        high: this.candleHigh,
        low: this.candleLow,
        close: this.currentPrice,
        timestamp: this.secondsFromMarketOpen
      };

      // Reset candle tracking
      this.candleElapsed = 0;
      this.candleOpen = this.currentPrice;
      this.candleHigh = this.currentPrice;
      this.candleLow = this.currentPrice;

      return candle;
    }

    return null;
  }

  /**
   * Get current price state
   */
  getCurrentPrice() {
    return this.currentPrice;
  }

  /**
   * Get current GARCH variance
   */
  getGarchVariance() {
    return this.garchVariance;
  }
}

export default SpotGenerator;
