import { NIFTY_LOT_SIZE, FNO_STOCKS } from '../data/marketConstants.js';

/**
 * Portfolio - Manages trading positions, P&L, and portfolio state
 */
class Portfolio {
  constructor(config = {}) {
    this.initialCapital = config.initialCapital || 500000; // ₹5 lakhs
    this.cash = this.initialCapital;
    this.positions = new Map(); // positionKey -> position
    this.tradeLog = []; // Array of completed trades
    this.realizedPnl = 0;
    this.unrealizedPnl = 0;

    // Margin requirements
    this.marginRates = {
      NIFTY_FUT: 0.10, // 10% of contract value
      STOCK_FUT: 0.10, // 10% of contract value
      NIFTY_OPT: 1.0,  // Full premium
      STOCK_OPT: 1.0   // Full premium
    };

    // Only restore if explicitly asked
    if (config.restoreFromStorage === true) {
      this.loadFromLocalStorage();
    }
  }

  /**
   * Generate position key for grouping same positions
   * @private
   */
  _getPositionKey(order) {
    const { instrument, symbol, strike, optionType } = order;
    return `${instrument}_${symbol}_${strike || 0}_${optionType || ''}`;
  }

  /**
   * Get lot size for instrument
   * @private
   */
  _getLotSize(instrument, symbol) {
    if (instrument.includes('NIFTY')) {
      return NIFTY_LOT_SIZE;
    }

    const stock = FNO_STOCKS.find(s => s.symbol === symbol);
    return stock ? stock.lotSize : 1;
  }

  /**
   * Calculate margin requirement for order
   * @private
   */
  _calculateMargin(order, fillPrice) {
    const lotSize = this._getLotSize(order.instrument, order.symbol);
    const contractValue = fillPrice * lotSize * order.quantity;

    const marginRate = this.marginRates[order.instrument] || 0.10;
    return contractValue * marginRate;
  }

  /**
   * Handle order fill event
   * @param {object} orderEvent - { order, fillPrice, timestamp }
   */
  onOrderFilled(orderEvent) {
    const { order, fillPrice } = orderEvent;
    const positionKey = this._getPositionKey(order);
    const existingPosition = this.positions.get(positionKey);

    if (existingPosition && existingPosition.direction !== order.direction) {
      // Closing trade — no margin deduction, closePosition handles cash
      this.closePosition(positionKey, fillPrice);
      return true;
    }

    // Opening or adding to position — check and deduct margin
    const marginRequired = this._calculateMargin(order, fillPrice);
    if (this.cash < marginRequired) {
      console.warn('Insufficient margin for order:', order.id);
      return false;
    }
    this.cash -= marginRequired;

    if (existingPosition) {
      // Same direction = averaging/adding
      this._addToPosition(existingPosition, order, fillPrice);
    } else {
      this._createPosition(order, fillPrice);
    }

    return true;
  }

  /**
   * Add to existing position
   * @private
   */
  _addToPosition(position, order, fillPrice) {
    const lotSize = this._getLotSize(order.instrument, order.symbol);
    const newQuantity = position.quantity + order.quantity;
    const newTotalValue = (position.avgPrice * position.quantity * lotSize) +
                         (fillPrice * order.quantity * lotSize);
    const newAvgPrice = newTotalValue / (newQuantity * lotSize);

    position.quantity = newQuantity;
    position.avgPrice = newAvgPrice;
  }

  /**
   * Create new position
   * @private
   */
  _createPosition(order, fillPrice) {
    const lotSize = this._getLotSize(order.instrument, order.symbol);

    const position = {
      instrument: order.instrument,
      symbol: order.symbol,
      strike: order.strike || null,
      optionType: order.optionType || null,
      direction: order.direction,
      quantity: order.quantity,
      avgPrice: fillPrice,
      currentPrice: fillPrice,
      unrealizedPnl: 0,
      realizedPnl: 0,
      entryTime: Date.now()
    };

    const positionKey = this._getPositionKey(order);
    this.positions.set(positionKey, position);
  }

  /**
   * Update prices and recalculate unrealized P&L
   * @param {object} marketSnapshot - Current market data
   */
  updatePrices(marketSnapshot) {
    this.unrealizedPnl = 0;

    for (const [key, position] of this.positions) {
      const currentPrice = this._getCurrentPrice(position, marketSnapshot);

      if (currentPrice !== null) {
        position.currentPrice = currentPrice;

        const lotSize = this._getLotSize(position.instrument, position.symbol);
        const directionMultiplier = position.direction === 'BUY' ? 1 : -1;
        const priceDiff = currentPrice - position.avgPrice;

        position.unrealizedPnl = priceDiff * position.quantity * lotSize * directionMultiplier;
        this.unrealizedPnl += position.unrealizedPnl;
      }
    }
  }

  /**
   * Get current market price for position
   * @private
   */
  _getCurrentPrice(position, marketSnapshot) {
    switch (position.instrument) {
      case 'NIFTY_SPOT':
        return marketSnapshot.spot;

      case 'NIFTY_FUT':
        return marketSnapshot.futures?.price;

      case 'NIFTY_OPT':
        const niftyChain = marketSnapshot.options?.NIFTY;
        if (niftyChain) {
          const option = niftyChain.find(opt =>
            opt.strike === position.strike && opt.symbol === position.symbol
          );
          if (option) {
            return position.optionType === 'CE' ? option.ce.price : option.pe.price;
          }
        }
        break;

      case 'STOCK':
        const stock = marketSnapshot.stocks?.find(s => s.symbol === position.symbol);
        return stock?.price;

      case 'STOCK_OPT':
        const stockChain = marketSnapshot.options?.[position.symbol];
        if (stockChain) {
          const option = stockChain.find(opt =>
            opt.strike === position.strike && opt.symbol === position.symbol
          );
          if (option) {
            return position.optionType === 'CE' ? option.ce.price : option.pe.price;
          }
        }
        break;
    }

    return null;
  }

  /**
   * Get total P&L (realized + unrealized)
   * @returns {number} - Total portfolio P&L
   */
  getTotalPnl() {
    return this.realizedPnl + this.unrealizedPnl;
  }

  /**
   * Get current positions
   * @returns {array} - Array of open positions
   */
  getPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Get trade log (closed positions)
   * @returns {array} - Array of completed trades
   */
  getTradeLog() {
    return [...this.tradeLog];
  }

  /**
   * Get daily trading statistics
   * @returns {object} - Trading statistics
   */
  getDailyStats() {
    const trades = this.tradeLog.filter(trade =>
      new Date(trade.exitTime).toDateString() === new Date().toDateString()
    );

    if (trades.length === 0) {
      return {
        tradesCount: 0,
        winRate: 0,
        bestTrade: 0,
        worstTrade: 0,
        totalPnl: 0
      };
    }

    const winningTrades = trades.filter(trade => trade.pnl > 0);
    const winRate = (winningTrades.length / trades.length) * 100;

    const pnls = trades.map(trade => trade.pnl);
    const bestTrade = Math.max(...pnls);
    const worstTrade = Math.min(...pnls);
    const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);

    return {
      tradesCount: trades.length,
      winRate: winRate,
      bestTrade: bestTrade,
      worstTrade: worstTrade,
      totalPnl: totalPnl
    };
  }

  /**
   * Close a position (for manual position management)
   * @param {string} positionKey - Position key to close
   * @param {number} exitPrice - Exit price
   */
  closePosition(positionKey, exitPrice) {
    const position = this.positions.get(positionKey);
    if (!position) return false;

    // Calculate realized P&L
    const lotSize = this._getLotSize(position.instrument, position.symbol);
    const directionMultiplier = position.direction === 'BUY' ? 1 : -1;
    const priceDiff = exitPrice - position.avgPrice;
    const realizedPnl = priceDiff * position.quantity * lotSize * directionMultiplier;

    // Create trade log entry
    const trade = {
      instrument: position.instrument,
      symbol: position.symbol,
      strike: position.strike,
      optionType: position.optionType,
      direction: position.direction,
      quantity: position.quantity,
      entryPrice: position.avgPrice,
      exitPrice: exitPrice,
      pnl: realizedPnl,
      entryTime: position.entryTime,
      exitTime: Date.now()
    };

    this.tradeLog.push(trade);
    this.realizedPnl += realizedPnl;

    // Return margin
    const marginReturned = this._calculateMargin({
      instrument: position.instrument,
      symbol: position.symbol,
      quantity: position.quantity
    }, position.avgPrice);
    this.cash += marginReturned;

    // Remove position
    this.positions.delete(positionKey);

    return true;
  }

  /**
   * Get portfolio summary
   * @returns {object} - Portfolio summary
   */
  getSummary() {
    const positions = this.getPositions();
    const totalValue = positions.reduce((sum, pos) => {
      const lotSize = this._getLotSize(pos.instrument, pos.symbol);
      return sum + (pos.currentPrice * pos.quantity * lotSize);
    }, 0);

    return {
      cash: this.cash,
      positionsValue: totalValue,
      totalValue: this.cash + totalValue,
      realizedPnl: this.realizedPnl,
      unrealizedPnl: this.unrealizedPnl,
      totalPnl: this.getTotalPnl(),
      positionsCount: positions.length,
      tradesCount: this.tradeLog.length,
      positions: positions,
      tradeLog: [...this.tradeLog]
    };
  }

  /**
   * Save portfolio state to localStorage
   */
  saveToLocalStorage() {
    try {
      const state = {
        cash: this.cash,
        positions: Array.from(this.positions.entries()),
        tradeLog: this.tradeLog,
        realizedPnl: this.realizedPnl,
        unrealizedPnl: this.unrealizedPnl,
        timestamp: Date.now()
      };
      localStorage.setItem('niftySimPortfolio', JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save portfolio to localStorage:', err);
    }
  }

  /**
   * Load portfolio state from localStorage
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('niftySimPortfolio');
      if (saved) {
        const state = JSON.parse(saved);
        this.cash = state.cash || this.initialCapital;
        this.positions = new Map(state.positions || []);
        this.tradeLog = state.tradeLog || [];
        this.realizedPnl = state.realizedPnl || 0;
        this.unrealizedPnl = state.unrealizedPnl || 0;
      }
    } catch (err) {
      console.warn('Failed to load portfolio from localStorage:', err);
    }
  }

  /**
   * Reset portfolio to initial state
   */
  reset() {
    this.cash = this.initialCapital;
    this.positions.clear();
    this.tradeLog = [];
    this.realizedPnl = 0;
    this.unrealizedPnl = 0;
    this.saveToLocalStorage();
  }

  /**
   * Get margin utilization
   * @returns {object} - Margin usage statistics
   */
  getMarginUtilization() {
    let totalMarginUsed = 0;
    let totalPositionValue = 0;

    for (const position of this.positions.values()) {
      const margin = this._calculateMargin(position, position.avgPrice);
      totalMarginUsed += margin;

      const lotSize = this._getLotSize(position.instrument, position.symbol);
      totalPositionValue += position.currentPrice * position.quantity * lotSize;
    }

    const availableMargin = this.cash;
    const totalMargin = totalMarginUsed + availableMargin;
    const utilizationRate = totalMargin > 0 ? (totalMarginUsed / totalMargin) * 100 : 0;

    return {
      used: totalMarginUsed,
      available: availableMargin,
      total: totalMargin,
      utilizationRate: utilizationRate,
      positionValue: totalPositionValue
    };
  }
}

export default Portfolio;
