import { FNO_STOCKS, MARKET_OPEN, TRADING_SECONDS } from '../data/marketConstants.js';
import RegimeController from './RegimeController.js';
import SpotGenerator from './SpotGenerator.js';
import FuturesGenerator from './FuturesGenerator.js';
import StockGenerator from './StockGenerator.js';

/**
 * SimulationClock - Master orchestrator for the entire market simulation
 * Coordinates price generation, regime transitions, and event emission
 */
class SimulationClock {
  constructor(config = {}) {
    this.seed = config.seed || 20240415;
    this.speedMultiplier = config.speedMultiplier || 1; // 1, 5, 10, 60, 390
    this.daysToExpiry = config.daysToExpiry || 7;
    this.baseNiftyPrice = config.baseNiftyPrice || 23500;
    this.initialSpot = this.baseNiftyPrice;

    // Initialize component generators with shared seed
    this.regimeController = new RegimeController(this.seed);
    this.spotGenerator = new SpotGenerator({
      basePrice: this.baseNiftyPrice,
      seed: this.seed,
      regimeController: this.regimeController
    });
    this.futuresGenerator = new FuturesGenerator({
      spotGenerator: this.spotGenerator,
      daysToExpiry: this.daysToExpiry,
      riskFreeRate: 0.065,
      noiseSeed: this.seed * 13
    });
    this.stockGenerator = new StockGenerator({
      stocks: FNO_STOCKS,
      seed: this.seed * 17,
      candleSeconds: 60
    });

    // State tracking
    this.currentSecond = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.intervalId = null;

    // Previous price for return calculation
    this.prevSpot = this.baseNiftyPrice;

    // Event listeners
    this.listeners = new Map();

    // For regime change detection
    this.prevRegimeName = this.regimeController.getCurrentRegime().name;
  }

  /**
   * Start the simulation with setInterval based on speed multiplier
   */
  start() {
    if (this.isRunning) {
      console.warn('Simulation already running');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.currentSecond = 0;
    this.prevSpot = this.baseNiftyPrice;

    // Interval in milliseconds: 1000 / speedMultiplier
    const intervalMs = 1000 / this.speedMultiplier;

    // Emit market open event
    this._emit('marketOpen', { second: 0, time: this.getCurrentTime() });

    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this._tick();
      }
    }, intervalMs);
  }

  /**
   * Pause the simulation
   */
  pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    this._emit('pause', { second: this.currentSecond });
  }

  /**
   * Resume the simulation
   */
  resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this._emit('resume', { second: this.currentSecond });
  }

  /**
   * Stop the simulation and reset state
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    this.currentSecond = 0;
    this._emit('marketClose', { second: this.currentSecond });
  }

  /**
   * Change simulation speed mid-run
   * @param {number} multiplier - 1, 5, 10, 60, or 390
   */
  setSpeed(multiplier) {
    if (![1, 5, 10, 60, 390].includes(multiplier)) {
      console.warn('Invalid speed multiplier. Use: 1, 5, 10, 60, or 390');
      return;
    }

    this.speedMultiplier = multiplier;

    if (this.isRunning) {
      // Restart interval with new speed
      clearInterval(this.intervalId);
      const intervalMs = 1000 / this.speedMultiplier;
      this.intervalId = setInterval(() => {
        if (!this.isPaused) {
          this._tick();
        }
      }, intervalMs);
    }
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name ('tick', 'candle', 'regimeChange', 'marketOpen', 'marketClose')
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} callback - Callback to remove
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event to all subscribers
   * @private
   */
  _emit(event, data) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in ${event} listener:`, err);
      }
    });
  }

  /**
   * Internal tick function (called by setInterval)
   * @private
   */
  _tick() {
    // Check if market is closed
    if (this.currentSecond >= TRADING_SECONDS) {
      this.stop();
      return;
    }

    // Advance simulation by 1 second
    this.currentSecond += 1;

    // Tick regime controller
    this.regimeController.tick(1);

    // Tick spot generator
    const spotTick = this.spotGenerator.nextTick(1);
    const currentSpot = spotTick.price;

    // Calculate Nifty return for stock correlation
    const niftyReturn = (currentSpot - this.prevSpot) / this.prevSpot;
    this.prevSpot = currentSpot;

    // Tick futures
    const futuresTick = this.futuresGenerator.nextTick(currentSpot, 1);

    // Tick stocks
    const stockUpdates = this.stockGenerator.nextTick(niftyReturn, 1);

    // Check for regime change
    const currentRegimeName = this.regimeController.getCurrentRegime().name;
    if (currentRegimeName !== this.prevRegimeName) {
      this._emit('regimeChange', {
        from: this.prevRegimeName,
        to: currentRegimeName,
        second: this.currentSecond
      });
      this.prevRegimeName = currentRegimeName;
    }

    // Emit tick event
    this._emit('tick', {
      second: this.currentSecond,
      time: this.getCurrentTime(),
      spot: currentSpot,
      futures: {
        price: futuresTick.futuresPrice,
        basis: futuresTick.basis,
        daysToExpiry: futuresTick.daysToExpiry
      },
      stocks: stockUpdates,
      regime: currentRegimeName,
      timestamp: this.currentSecond
    });

    // Emit candle events for completed candles
    stockUpdates.forEach((update) => {
      if (update.ohlc) {
        this._emit('candle', {
          symbol: update.symbol,
          ohlc: update.ohlc,
          second: this.currentSecond
        });
      }
    });

    // Check spot candles
    const spotCandle = this.spotGenerator.getCandle();
    if (spotCandle) {
      this._emit('candle', {
        symbol: 'NIFTY',
        ohlc: spotCandle,
        second: this.currentSecond
      });
    }

    // Check futures candles (use inner candle tracking if available)
    // For now, just emit spot candles as primary
  }

  /**
   * Get current time as HH:MM:SS (9:15:00 + currentSecond)
   * @returns {string} - Time in HH:MM:SS format
   */
  getCurrentTime() {
    // Market open is 9:15 AM
    const marketOpenSeconds = MARKET_OPEN.hour * 3600 + MARKET_OPEN.minute * 60;
    const totalSeconds = marketOpenSeconds + this.currentSecond;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Get full simulation state snapshot
   * @returns {object} - Complete state object
   */
  getState() {
    const spotPrice = this.spotGenerator.getCurrentPrice();
    const futuresPrice = this.futuresGenerator.getFuturesPrice();

    return {
      second: this.currentSecond,
      time: this.getCurrentTime(),
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      speedMultiplier: this.speedMultiplier,
      spot: {
        price: spotPrice,
        garchVariance: this.spotGenerator.getGarchVariance()
      },
      futures: {
        price: futuresPrice,
        spread: this.futuresGenerator.getSpread(),
        daysToExpiry: this.futuresGenerator.getDaysToExpiry()
      },
      stocks: this.stockGenerator.getSnapshot(),
      regime: {
        name: this.regimeController.getCurrentRegime().name,
        drift: this.regimeController.getDrift(),
        volMultiplier: this.regimeController.getVolMultiplier()
      }
    };
  }

  /**
   * Get single stock state
   * @param {string} symbol - Stock symbol
   * @returns {object} - Stock state
   */
  getStock(symbol) {
    return this.stockGenerator.getStockBySymbol(symbol);
  }
}

export default SimulationClock;
