import { NIFTY_LOT_SIZE, FNO_STOCKS } from '../data/marketConstants.js';

/**
 * OrderBook - Manages order placement, validation, and execution
 */
class OrderBook {
  constructor() {
    this.orders = new Map(); // orderId -> order
    this.nextOrderId = 1;
    this.listeners = new Map();

    // Slippage percentages for market orders
    this.slippageRates = {
      NIFTY_SPOT: 0.0002, // 0.02%
      NIFTY_FUT: 0.0002,  // 0.02%
      NIFTY_OPT: 0.0005,  // 0.05%
      STOCK: 0.0002,      // 0.02%
      STOCK_OPT: 0.0005   // 0.05%
    };

    // Available instruments
    this.availableInstruments = {
      NIFTY_SPOT: { symbol: 'NIFTY', lotSize: NIFTY_LOT_SIZE },
      NIFTY_FUT: { symbol: 'NIFTY', lotSize: NIFTY_LOT_SIZE },
      NIFTY_OPT: { symbol: 'NIFTY', lotSize: NIFTY_LOT_SIZE },
      ...FNO_STOCKS.reduce((acc, stock) => {
        acc[`STOCK_${stock.symbol}`] = { symbol: stock.symbol, lotSize: stock.lotSize };
        acc[`STOCK_OPT_${stock.symbol}`] = { symbol: stock.symbol, lotSize: stock.lotSize };
        return acc;
      }, {})
    };
  }

  /**
   * Subscribe to events
   * @param {string} event - Event name ('orderFilled', 'orderCancelled', 'orderRejected')
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Emit event to subscribers
   * @private
   */
  _emit(event, data) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in ${event} listener:`, err);
      }
    });
  }

  /**
   * Generate unique order ID
   * @private
   */
  _generateOrderId() {
    return `ORD_${Date.now()}_${this.nextOrderId++}`;
  }

  /**
   * Validate order parameters
   * @param {object} order - Order configuration
   * @returns {object} - { isValid: boolean, errors: array }
   */
  validateOrder(order) {
    const errors = [];

    // Required fields
    const requiredFields = ['instrument', 'symbol', 'orderType', 'direction', 'quantity'];
    for (const field of requiredFields) {
      if (!order[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) return { isValid: false, errors };

    // Instrument validation
    const instrumentKey = order.instrument === 'STOCK' ? `STOCK_${order.symbol}` :
                         order.instrument === 'STOCK_OPT' ? `STOCK_OPT_${order.symbol}` :
                         order.instrument;

    if (!this.availableInstruments[instrumentKey]) {
      errors.push(`Invalid instrument: ${order.instrument} for symbol ${order.symbol}`);
    }

    // Symbol validation for options
    if (order.instrument.includes('OPT')) {
      if (!order.strike || !order.optionType) {
        errors.push('Options require strike and optionType');
      }
      if (!['CE', 'PE'].includes(order.optionType)) {
        errors.push('optionType must be CE or PE');
      }
    }

    // Order type validation
    const validOrderTypes = ['MARKET', 'LIMIT', 'SL_MARKET', 'SL_LIMIT'];
    if (!validOrderTypes.includes(order.orderType)) {
      errors.push(`Invalid orderType: ${order.orderType}`);
    }

    // Direction validation
    if (!['BUY', 'SELL'].includes(order.direction)) {
      errors.push(`Invalid direction: ${order.direction}`);
    }

    // Quantity validation
    if (order.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    // Lot size validation
    const instrument = this.availableInstruments[instrumentKey];
    if (instrument && order.quantity % instrument.lotSize !== 0) {
      errors.push(`Quantity must be multiple of lot size (${instrument.lotSize})`);
    }

    // Price validation for limit orders
    if (['LIMIT', 'SL_LIMIT'].includes(order.orderType)) {
      if (!order.price || order.price <= 0) {
        errors.push('Limit orders require positive price');
      }
    }

    // Stop loss validation
    if (order.orderType.startsWith('SL_')) {
      if (!order.triggerPrice || order.triggerPrice <= 0) {
        errors.push('Stop loss orders require triggerPrice');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Place a new order
   * @param {object} orderConfig - Order configuration
   * @returns {string} - Order ID if successful, null if validation failed
   */
  placeOrder(orderConfig) {
    const validation = this.validateOrder(orderConfig);
    if (!validation.isValid) {
      console.warn('Order validation failed:', validation.errors);
      this._emit('orderRejected', {
        order: orderConfig,
        errors: validation.errors,
        timestamp: Date.now()
      });
      return null;
    }

    const orderId = this._generateOrderId();
    const order = {
      id: orderId,
      ...orderConfig,
      status: 'PENDING',
      timestamp: Date.now(),
      fillPrice: null,
      fillTimestamp: null
    };

    this.orders.set(orderId, order);
    return orderId;
  }

  /**
   * Cancel a pending order
   * @param {string} orderId - Order ID to cancel
   * @returns {boolean} - True if cancelled, false if not found or not pending
   */
  cancelOrder(orderId) {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'PENDING') {
      return false;
    }

    order.status = 'CANCELLED';
    this._emit('orderCancelled', {
      order: order,
      timestamp: Date.now()
    });
    return true;
  }

  /**
   * Process pending orders against current market snapshot
   * @param {object} marketSnapshot - Current market prices and data
   */
  processTick(marketSnapshot) {
    const pendingOrders = Array.from(this.orders.values())
      .filter(order => order.status === 'PENDING');

    pendingOrders.forEach(order => {
      this._processOrder(order, marketSnapshot);
    });
  }

  /**
   * Process individual order
   * @private
   */
  _processOrder(order, marketSnapshot) {
    const currentPrice = this._getCurrentPrice(order, marketSnapshot);
    if (!currentPrice) return; // No price available

    let shouldFill = false;
    let fillPrice = currentPrice;

    switch (order.orderType) {
      case 'MARKET':
        // Fill immediately with slippage
        const slippageRate = this.slippageRates[order.instrument] || 0.0002;
        const slippage = currentPrice * slippageRate;
        fillPrice = order.direction === 'BUY' ?
          currentPrice + slippage :
          currentPrice - slippage;
        shouldFill = true;
        break;

      case 'LIMIT':
        if (order.direction === 'BUY' && currentPrice <= order.price) {
          fillPrice = Math.min(currentPrice, order.price);
          shouldFill = true;
        } else if (order.direction === 'SELL' && currentPrice >= order.price) {
          fillPrice = Math.max(currentPrice, order.price);
          shouldFill = true;
        }
        break;

      case 'SL_MARKET':
        // Check if trigger price is hit
        if (order.direction === 'BUY' && currentPrice >= order.triggerPrice) {
          // Buy stop loss triggered - fill at market with slippage
          const slippageRate = this.slippageRates[order.instrument] || 0.0002;
          const slippage = currentPrice * slippageRate;
          fillPrice = currentPrice + slippage;
          shouldFill = true;
        } else if (order.direction === 'SELL' && currentPrice <= order.triggerPrice) {
          // Sell stop loss triggered - fill at market with slippage
          const slippageRate = this.slippageRates[order.instrument] || 0.0002;
          const slippage = currentPrice * slippageRate;
          fillPrice = currentPrice - slippage;
          shouldFill = true;
        }
        break;

      case 'SL_LIMIT':
        // Check if trigger price is hit, then fill at limit price
        if (order.direction === 'BUY' && currentPrice >= order.triggerPrice) {
          fillPrice = order.price; // Fill at limit price
          shouldFill = true;
        } else if (order.direction === 'SELL' && currentPrice <= order.triggerPrice) {
          fillPrice = order.price; // Fill at limit price
          shouldFill = true;
        }
        break;
    }

    if (shouldFill) {
      this._fillOrder(order, fillPrice);
    }
  }

  /**
   * Get current market price for an order
   * @private
   */
  _getCurrentPrice(order, marketSnapshot) {
    // Extract price based on instrument type
    switch (order.instrument) {
      case 'NIFTY_SPOT':
        return marketSnapshot.spot;

      case 'NIFTY_FUT':
        return marketSnapshot.futures?.price;

      case 'NIFTY_OPT':
        // Find option in chain
        const niftyChain = marketSnapshot.options?.NIFTY;
        if (niftyChain) {
          const option = niftyChain.find(opt =>
            opt.strike === order.strike && opt.symbol === order.symbol
          );
          if (option) {
            return order.optionType === 'CE' ? option.ce.price : option.pe.price;
          }
        }
        break;

      case 'STOCK':
        const stock = marketSnapshot.stocks?.find(s => s.symbol === order.symbol);
        return stock?.price;

      case 'STOCK_OPT':
        // Find stock option in chain
        const stockChain = marketSnapshot.options?.[order.symbol];
        if (stockChain) {
          const option = stockChain.find(opt =>
            opt.strike === order.strike && opt.symbol === order.symbol
          );
          if (option) {
            return order.optionType === 'CE' ? option.ce.price : option.pe.price;
          }
        }
        break;
    }

    return null; // No price available
  }

  /**
   * Fill an order
   * @private
   */
  _fillOrder(order, fillPrice) {
    order.status = 'FILLED';
    order.fillPrice = fillPrice;
    order.fillTimestamp = Date.now();

    this._emit('orderFilled', {
      order: order,
      fillPrice: fillPrice,
      timestamp: order.fillTimestamp
    });
  }

  /**
   * Get orders with optional filter
   * @param {object} filter - Filter criteria { status, instrument, symbol, direction }
   * @returns {array} - Array of matching orders
   */
  getOrders(filter = {}) {
    let orders = Array.from(this.orders.values());

    if (filter.status) {
      orders = orders.filter(order => order.status === filter.status);
    }

    if (filter.instrument) {
      orders = orders.filter(order => order.instrument === filter.instrument);
    }

    if (filter.symbol) {
      orders = orders.filter(order => order.symbol === filter.symbol);
    }

    if (filter.direction) {
      orders = orders.filter(order => order.direction === filter.direction);
    }

    return orders;
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {object|null} - Order object or null
   */
  getOrder(orderId) {
    return this.orders.get(orderId) || null;
  }

  /**
   * Get order statistics
   * @returns {object} - Statistics about orders
   */
  getStats() {
    const orders = Array.from(this.orders.values());
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      filled: orders.filter(o => o.status === 'FILLED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
      rejected: orders.filter(o => o.status === 'REJECTED').length
    };

    return stats;
  }

  /**
   * Clear all orders (for testing/reset)
   */
  clear() {
    this.orders.clear();
    this.nextOrderId = 1;
  }
}

export default OrderBook;
