import SeededRandom from '../utils/seededRandom.js';

/**
 * RegimeController - Manages market regime transitions
 * Regimes drift, volatility, and duration follow stochastic patterns
 */
class RegimeController {
  constructor(seed) {
    this.random = new SeededRandom(seed);

    // Define market regimes
    this.regimes = {
      TRENDING_UP: {
        name: 'TRENDING_UP',
        drift: 0.0008,
        volMultiplier: 0.9,
        minDurationSeconds: 1200,
        maxDurationSeconds: 5400
      },
      TRENDING_DOWN: {
        name: 'TRENDING_DOWN',
        drift: -0.0008,
        volMultiplier: 1.1,
        minDurationSeconds: 900,
        maxDurationSeconds: 3600
      },
      CHOPPY: {
        name: 'CHOPPY',
        drift: 0,
        volMultiplier: 0.6,
        minDurationSeconds: 1800,
        maxDurationSeconds: 7200
      },
      HIGH_VOL: {
        name: 'HIGH_VOL',
        drift: 0,
        volMultiplier: 3.0,
        minDurationSeconds: 300,
        maxDurationSeconds: 900
      },
      FLASH_CRASH: {
        name: 'FLASH_CRASH',
        drift: -0.003,
        volMultiplier: 5.0,
        minDurationSeconds: 60,
        maxDurationSeconds: 180
      }
    };

    // Start in CHOPPY regime
    this.currentRegimeName = 'CHOPPY';
    this.currentRegime = this.regimes[this.currentRegimeName];
    this.regimeDuration =
      this.random.next() *
        (this.currentRegime.maxDurationSeconds - this.currentRegime.minDurationSeconds) +
      this.currentRegime.minDurationSeconds;
    this.elapsedInRegime = 0;

    // Transition probabilities
    this.transitionProbs = {
      TRENDING_UP: 0.25,
      TRENDING_DOWN: 0.20,
      CHOPPY: 0.40,
      HIGH_VOL: 0.12,
      FLASH_CRASH: 0.03
    };
  }

  getCurrentRegime() {
    return this.currentRegime;
  }

  /**
   * Check if regime should transition; if yes, pick next regime probabilistically
   * @param {number} elapsedSeconds - Seconds elapsed since last tick
   * @returns {boolean} - True if regime changed, false otherwise
   */
  tick(elapsedSeconds) {
    this.elapsedInRegime += elapsedSeconds;

    if (this.elapsedInRegime >= this.regimeDuration) {
      // Regime transition
      const r = this.random.next();
      let nextRegimeName;

      // Pick next regime based on cumulative probabilities
      if (r < 0.25) {
        nextRegimeName = 'TRENDING_UP';
      } else if (r < 0.45) {
        // 0.25 + 0.20
        nextRegimeName = 'TRENDING_DOWN';
      } else if (r < 0.85) {
        // 0.45 + 0.40
        nextRegimeName = 'CHOPPY';
      } else if (r < 0.97) {
        // 0.85 + 0.12
        nextRegimeName = 'HIGH_VOL';
      } else {
        nextRegimeName = 'FLASH_CRASH';
      }

      this.currentRegimeName = nextRegimeName;
      this.currentRegime = this.regimes[nextRegimeName];

      // Sample new duration for this regime
      this.regimeDuration =
        this.random.next() *
          (this.currentRegime.maxDurationSeconds - this.currentRegime.minDurationSeconds) +
        this.currentRegime.minDurationSeconds;

      this.elapsedInRegime = 0;

      return true;
    }

    return false;
  }

  getVolMultiplier() {
    return this.currentRegime.volMultiplier;
  }

  getDrift() {
    return this.currentRegime.drift;
  }
}

export default RegimeController;
