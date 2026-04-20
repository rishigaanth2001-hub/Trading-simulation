import { blackScholes } from './OptionPricer.js';
import SeededRandom from '../utils/seededRandom.js';

/**
 * OptionChainGenerator - Generates realistic Nifty option chains with synthetic OI and volume
 */
class OptionChainGenerator {
  constructor(config = {}) {
    this.volSurface = config.volSurface;
    this.pricer = config.pricer || blackScholes;
    this.strikesAroundATM = config.strikesAroundATM || 10; // 10 above + 10 below + ATM = 21 total
    this.strikeStep = config.strikeStep || 50;

    // Initialize random number generator for synthetic data
    this.seed = config.seed || 1;
    this.random = new SeededRandom(this.seed);

    // Cache for current chain
    this.currentChain = [];
    this.lastSpot = 0;
    this.lastDaysToExpiry = 0;
  }

  /**
   * Generate the full option chain for given spot and expiry
   * @param {number} spot - Current Nifty spot price
   * @param {number} daysToExpiry - Days until expiry
   * @param {number} riskFreeRate - Risk-free rate (default 0.065)
   * @returns {array} - Array of { strike, CE, PE } sorted by strike ascending
   */
  getChain(spot, daysToExpiry, riskFreeRate = 0.065) {
    // Find ATM strike: round to nearest 50
    const atmStrike = Math.round(spot / this.strikeStep) * this.strikeStep;

    // Generate strikes: ATM ± (strikesAroundATM * strikeStep)
    const strikeRange = this.strikesAroundATM * this.strikeStep;
    const strikes = [];

    for (let strike = atmStrike - strikeRange; strike <= atmStrike + strikeRange; strike += this.strikeStep) {
      strikes.push(strike);
    }

    // Generate chain
    const chain = strikes.map(strike => {
      // Get IV from volatility surface
      const iv = this.volSurface.getIV(strike, spot, daysToExpiry);

      // Calculate strikes away from ATM for OI calculation
      const strikesAway = Math.abs(strike - atmStrike) / this.strikeStep;

      // Synthetic OI: ATM has highest (1M each), reduces by 10% per strike away
      const baseOI = 1000000;
      const oiMultiplier = Math.pow(0.9, strikesAway);
      const ceOI = Math.round(baseOI * oiMultiplier);
      const peOI = Math.round(baseOI * oiMultiplier);

      // Synthetic volume: random 5-20% of OI per tick
      const volumeMultiplier = 0.05 + 0.15 * this.random.next(); // 5-20%
      const ceVolume = Math.round(ceOI * volumeMultiplier);
      const peVolume = Math.round(peOI * volumeMultiplier);

      // Calculate time to expiry in years
      const timeToExpiryYears = daysToExpiry / 365.25;

      // Price call option
      const callGreeks = this.pricer({
        spot: spot,
        strike: strike,
        timeToExpiryYears: timeToExpiryYears,
        riskFreeRate: riskFreeRate,
        iv: iv,
        optionType: 'call'
      });

      // Price put option
      const putGreeks = this.pricer({
        spot: spot,
        strike: strike,
        timeToExpiryYears: timeToExpiryYears,
        riskFreeRate: riskFreeRate,
        iv: iv,
        optionType: 'put'
      });

      return {
        strike: strike,
        ce: {
          price: callGreeks.price,
          delta: callGreeks.delta,
          gamma: callGreeks.gamma,
          theta: callGreeks.theta,
          vega: callGreeks.vega,
          iv: iv,
          oi: ceOI,
          volume: ceVolume
        },
        pe: {
          price: putGreeks.price,
          delta: putGreeks.delta,
          gamma: putGreeks.gamma,
          theta: putGreeks.theta,
          vega: putGreeks.vega,
          iv: iv,
          oi: peOI,
          volume: peVolume
        }
      };
    });

    // Cache the chain
    this.currentChain = chain;
    this.lastSpot = spot;
    this.lastDaysToExpiry = daysToExpiry;

    return chain;
  }

  /**
   * Calculate put-call ratio from current chain
   * PCR = sum(PE OI) / sum(CE OI)
   * @returns {number} - Put-call ratio
   */
  getPCR() {
    if (this.currentChain.length === 0) {
      return 1.0; // Neutral PCR
    }

    let totalCeOI = 0;
    let totalPeOI = 0;

    this.currentChain.forEach(option => {
      totalCeOI += option.ce.oi;
      totalPeOI += option.pe.oi;
    });

    return totalPeOI / totalCeOI;
  }

  /**
   * Calculate maximum pain strike
   * Max pain = strike where total intrinsic value loss is maximized
   * For each strike: loss = CE_intrinsic * CE_OI + PE_intrinsic * PE_OI
   * @returns {number} - Strike price where max pain occurs
   */
  getMaxPainStrike() {
    if (this.currentChain.length === 0) {
      return this.lastSpot; // Fallback to spot
    }

    let maxPainStrike = this.currentChain[0].strike;
    let maxPainLoss = 0;

    this.currentChain.forEach(option => {
      const strike = option.strike;
      const spot = this.lastSpot;

      // Calculate intrinsic values
      const ceIntrinsic = Math.max(spot - strike, 0);
      const peIntrinsic = Math.max(strike - spot, 0);

      // Calculate total loss at this strike
      const totalLoss = ceIntrinsic * option.ce.oi + peIntrinsic * option.pe.oi;

      if (totalLoss > maxPainLoss) {
        maxPainLoss = totalLoss;
        maxPainStrike = strike;
      }
    });

    return maxPainStrike;
  }

  /**
   * Get current chain without regenerating
   * @returns {array} - Cached option chain
   */
  getCurrentChain() {
    return this.currentChain;
  }

  /**
   * Get ATM strike from last calculation
   * @returns {number} - ATM strike price
   */
  getAtmStrike() {
    if (this.currentChain.length === 0) return 0;

    const midIndex = Math.floor(this.currentChain.length / 2);
    return this.currentChain[midIndex].strike;
  }

  /**
   * Get total OI for calls and puts
   * @returns {object} - { ceOI: number, peOI: number, totalOI: number }
   */
  getTotalOI() {
    if (this.currentChain.length === 0) {
      return { ceOI: 0, peOI: 0, totalOI: 0 };
    }

    let ceOI = 0;
    let peOI = 0;

    this.currentChain.forEach(option => {
      ceOI += option.ce.oi;
      peOI += option.pe.oi;
    });

    return {
      ceOI: ceOI,
      peOI: peOI,
      totalOI: ceOI + peOI
    };
  }

  /**
   * Get option with highest OI (usually ATM)
   * @returns {object} - { strike, CE, PE } with highest combined OI
   */
  getHighestOIStrike() {
    if (this.currentChain.length === 0) return null;

    let highestOIStrike = this.currentChain[0];
    let highestOI = highestOIStrike.ce.oi + highestOIStrike.pe.oi;

    this.currentChain.forEach(option => {
      const combinedOI = option.ce.oi + option.pe.oi;
      if (combinedOI > highestOI) {
        highestOI = combinedOI;
        highestOIStrike = option;
      }
    });

    return highestOIStrike;
  }
}

export default OptionChainGenerator;
