import SeededRandom from '../utils/seededRandom.js';

/**
 * StockGenerator - Generates correlated stock prices based on Nifty returns + idiosyncratic noise
 */
class StockGenerator {
  constructor(config = {}) {
    this.stocks = config.stocks || [];
    this.seed = config.seed || 1;
    this.candleSeconds = config.candleSeconds || 60; // 1-min candles by default

    // Initialize random number generator
    this.random = new SeededRandom(this.seed);

    // For Box-Muller: store spare normal random when generating pairs
    this.hasSpareNormal = false;
    this.spareNormal = 0;

    // Initialize stock state tracking
    this.stockStates = {};
    this.stocks.forEach((stock, idx) => {
      this.stockStates[stock.symbol] = {
        symbol: stock.symbol,
        basePrice: stock.basePrice,
        beta: stock.beta,
        currentPrice: stock.basePrice,
        prevPrice: stock.basePrice,
        change: 0,
        changePercent: 0,
        // OHLC tracking for current candle
        candleOpen: stock.basePrice,
        candleHigh: stock.basePrice,
        candleLow: stock.basePrice,
        candleClose: stock.basePrice,
        candleElapsed: 0
      };
    });
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
   * Advance all stock prices based on Nifty return and idiosyncratic noise
   * @param {number} niftyReturn - Return of Nifty spot (new - prev) / prev
   * @param {number} secondsElapsed - Seconds elapsed since last tick
   * @returns {array} - Array of { symbol, price, change, changePercent, ohlc }
   */
  nextTick(niftyReturn, secondsElapsed) {
    const result = [];

    for (const symbol of Object.keys(this.stockStates)) {
      const state = this.stockStates[symbol];

      // Generate idiosyncratic noise: Normal(0, 0.0003) per second
      // Total noise = Normal(0, 0.0003 * √secondsElapsed)
      const idioNoiseStdDev = 0.0003 * Math.sqrt(secondsElapsed);
      const idioNoise = idioNoiseStdDev * this.nextNormalRandom();

      // Stock return = beta × niftyReturn + idiosyncraticNoise
      const stockReturn = state.beta * niftyReturn + idioNoise;

      // Update price: price = price × (1 + stockReturn)
      let newPrice = state.currentPrice * (1 + stockReturn);

      // Clamp price to [50% basePrice, 300% basePrice]
      const minPrice = state.basePrice * 0.5;
      const maxPrice = state.basePrice * 3.0;
      newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

      // Update state
      state.prevPrice = state.currentPrice;
      state.currentPrice = newPrice;
      state.change = newPrice - state.basePrice;
      state.changePercent = (state.change / state.basePrice) * 100;

      // Update OHLC for current candle
      state.candleElapsed += secondsElapsed;

      if (state.candleElapsed === secondsElapsed) {
        // First tick of new candle
        state.candleOpen = newPrice;
        state.candleHigh = newPrice;
        state.candleLow = newPrice;
      } else {
        state.candleHigh = Math.max(state.candleHigh, newPrice);
        state.candleLow = Math.min(state.candleLow, newPrice);
      }
      state.candleClose = newPrice;

      // Check if candle is complete
      let ohlc = null;
      if (state.candleElapsed >= this.candleSeconds) {
        ohlc = {
          open: state.candleOpen,
          high: state.candleHigh,
          low: state.candleLow,
          close: state.candleClose
        };

        // Reset candle tracking
        state.candleElapsed = 0;
        state.candleOpen = newPrice;
        state.candleHigh = newPrice;
        state.candleLow = newPrice;
      }

      result.push({
        symbol: symbol,
        price: newPrice,
        change: state.change,
        changePercent: state.changePercent,
        ohlc: ohlc
      });
    }

    return result;
  }

  /**
   * Get snapshot of all stock prices and state
   * @returns {array} - Array of all stocks with current prices
   */
  getSnapshot() {
    return Object.keys(this.stockStates).map((symbol) => {
      const state = this.stockStates[symbol];
      return {
        symbol: state.symbol,
        price: state.currentPrice,
        change: state.change,
        changePercent: state.changePercent,
        basePrice: state.basePrice,
        beta: state.beta
      };
    });
  }

  /**
   * Get single stock state by symbol
   * @param {string} symbol - Stock symbol (e.g., 'RELIANCE')
   * @returns {object} - Stock state or null if not found
   */
  getStockBySymbol(symbol) {
    const state = this.stockStates[symbol];
    if (!state) return null;

    return {
      symbol: state.symbol,
      price: state.currentPrice,
      change: state.change,
      changePercent: state.changePercent,
      basePrice: state.basePrice,
      beta: state.beta,
      prevPrice: state.prevPrice
    };
  }

  /**
   * Get all stocks with full state
   * @returns {object} - Map of symbol -> state
   */
  getAllStocks() {
    return this.stockStates;
  }
}

export default StockGenerator;
