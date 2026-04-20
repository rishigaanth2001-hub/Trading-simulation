import { NIFTY_LOT_SIZE } from '../data/marketConstants.js';

function parseTime(value) {
  if (!value) return null;
  const normalized = value.toString().slice(0, 5);
  const [hour, minute] = normalized.split(':').map(Number);
  return isNaN(hour) || isNaN(minute) ? null : hour * 60 + minute;
}

function formatTime(value) {
  const minutes = parseTime(value);
  if (minutes === null) return value;
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function roundToStrike(price, step = 50) {
  return Math.round(price / step) * step;
}

class StrategyRunner {
  constructor(config = {}) {
    this.orderBook = config.orderBook;
    this.portfolio = config.portfolio;
    this.optionChainGenerator = config.optionChainGenerator;
    this.clock = config.clock;
    this.strategies = (config.strategies || []).map(strategy => ({
      ...strategy,
      enabled: strategy.enabled !== false,
      state: {
        hasTraded: false,
        entryPremium: null,
        entryPrice: null,
        activeOrderIds: [],
        activePositions: [],
        tradeLog: [],
        history: [],
        breakoutHigh: null
      }
    }));

    this.orderBook?.on('orderFilled', this._handleOrderFilled.bind(this));
    this.orderBook?.on('orderCancelled', this._handleOrderCancelled.bind(this));
  }

  getStrategies() {
    return this.strategies;
  }

  toggleStrategy(strategyName, enabled) {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (strategy) {
      strategy.enabled = enabled;
    }
  }

  _handleOrderFilled(event) {
    const { order, fillPrice, timestamp } = event;
    const strategy = this.strategies.find(s => s.name === order.strategyName);
    if (!strategy) return;

    const state = strategy.state;
    state.tradeLog.push({
      time: new Date(timestamp).toLocaleTimeString(),
      action: order.direction === 'BUY' ? 'ENTRY' : 'EXIT',
      instrument: order.instrument,
      symbol: order.symbol,
      strike: order.strike,
      optionType: order.optionType,
      price: fillPrice,
      orderType: order.orderType,
      quantity: order.quantity
    });

    if (!state.hasTraded) {
      state.hasTraded = true;
    }

    if (order.entryType === 'STRATEGY_ENTRY') {
      state.activeOrderIds.push(order.id);
      if (order.instrument === 'NIFTY_OPT' && order.optionType) {
        state.entryPremium = (state.entryPremium || 0) + fillPrice;
      }
      if (!state.entryPrice) {
        state.entryPrice = fillPrice;
      }
    }

    if (order.entryType === 'STRATEGY_EXIT') {
      state.activeOrderIds = state.activeOrderIds.filter(id => id !== order.id);
    }
  }

  _handleOrderCancelled(event) {
    const { order } = event;
    const strategy = this.strategies.find(s => s.name === order.strategyName);
    if (!strategy) return;
    const state = strategy.state;
    state.activeOrderIds = state.activeOrderIds.filter(id => id !== order.id);
    state.history.push({ time: new Date(event.timestamp).toLocaleTimeString(), action: 'CANCELLED', order });
  }

  processTick(marketSnapshot) {
    const snapshot = {
      ...marketSnapshot,
      timeMinutes: parseTime(marketSnapshot.time || ''),
      options: marketSnapshot.options || this._generateOptionChains(marketSnapshot)
    };

    this.strategies.forEach(strategy => {
      if (strategy.enabled) {
        this._evaluateStrategy(strategy, snapshot);
      }
    });
  }

  _generateOptionChains(marketSnapshot) {
    const daysToExpiry = marketSnapshot.futures?.daysToExpiry || 7;
    const chain = this.optionChainGenerator?.getChain(marketSnapshot.spot, daysToExpiry) || [];
    return { NIFTY: chain };
  }

  _evaluateStrategy(strategy, marketSnapshot) {
    const { name, state, riskParams } = strategy;
    const currentSpot = marketSnapshot.spot;
    const currentTime = marketSnapshot.time;
    const minutes = marketSnapshot.timeMinutes;
    const atmStrike = roundToStrike(currentSpot);
    const chain = marketSnapshot.options?.NIFTY || [];

    switch (name) {
      case 'SHORT_STRADDLE':
        if (!state.hasTraded && this._timeMatches(minutes, '09:20')) {
          this._enterShortStraddle(strategy, atmStrike);
        }

        if (state.hasTraded && this._timeMatchesOrAfter(minutes, '15:15')) {
          this._exitShortStraddle(strategy, chain);
        } else if (state.hasTraded && state.entryPremium !== null) {
          const currentPremium = this._sumOptionPremium(chain, atmStrike, ['CE', 'PE']);
          if (currentPremium >= state.entryPremium * 1.5) {
            this._exitShortStraddle(strategy, chain);
          }
        }
        break;

      case 'LONG_STRANGLE':
        if (!state.hasTraded) {
          const iv = this._getOptionIV(chain, atmStrike);
          if (iv !== null && iv < 0.12) {
            this._enterLongStrangle(strategy, atmStrike, riskParams.optionDistance || 200);
          }
        } else {
          const currentPremium = this._sumOptionPremium(chain, atmStrike, ['CE', 'PE'], riskParams.optionDistance || 200);
          if (state.entryPremium !== null) {
            const pnlPct = (currentPremium - state.entryPremium) / Math.max(state.entryPremium, 1);
            if (pnlPct >= 0.30 || pnlPct <= -0.50) {
              this._exitLongStrangle(strategy, chain, riskParams.optionDistance || 200);
            }
          }
        }
        break;

      case 'TREND_FOLLOW':
        // Capture opening price on very first tick
        if (!state.openingPrice) {
          state.openingPrice = currentSpot;
        }
        if (!state.hasTraded && this._timeMatchesOrAfter(minutes, '09:45')) {
          const changeRatio = (currentSpot - state.openingPrice) / state.openingPrice;
          if (changeRatio >= (riskParams.thresholdPct || 0.003) && currentSpot > state.openingPrice) {
            this._enterTrendFollow(strategy, atmStrike);
          }
        }

        if (state.hasTraded && this._timeMatchesOrAfter(minutes, '15:15')) {
          this._exitTrendFollow(strategy, chain, atmStrike);
        }
        break;

      case 'SCALP_NIFTY_FUT':
        this._updateBreakoutHigh(strategy, marketSnapshot);
        if (!state.hasTraded && state.breakoutHigh !== null && currentSpot > state.breakoutHigh) {
          this._enterScalpFut(strategy);
        }
        if (state.hasTraded) {
          const entryPrice = state.entryPrice || currentSpot;
          const profit = currentSpot - entryPrice;
          if (profit >= (riskParams.profitTarget || 15) || profit <= -(riskParams.stopLoss || 10)) {
            this._exitScalpFut(strategy, currentSpot);
          }
        }
        break;

      case 'BULL_CALL_SPREAD':
        if (!state.hasTraded && this._timeMatches(minutes, '09:20')) {
          this._enterBullCallSpread(strategy, atmStrike, riskParams.spreadWidth || 100);
        }
        break;

      default:
        break;
    }
  }

  _timeMatches(minutes, timeValue) {
    const target = parseTime(timeValue);
    return target !== null && minutes === target;
  }

  _timeMatchesOrAfter(minutes, timeValue) {
    const target = parseTime(timeValue);
    return target !== null && minutes >= target;
  }

  _getOpeningPrice() {
    return this.clock?.initialSpot || this.clock?.baseNiftyPrice || 0;
  }

  _getOptionIV(chain, atmStrike) {
    const atmOption = chain.find(row => row.strike === atmStrike);
    return atmOption ? atmOption.ce.iv : null;
  }

  _sumOptionPremium(chain, atmStrike, parts, offset = 0) {
    const strike = atmStrike + offset;
    const target = chain.find(row => row.strike === strike);
    if (!target) return 0;
    return parts.reduce((sum, side) => {
      if (side === 'CE') return sum + (target.ce?.price || 0);
      if (side === 'PE') return sum + (target.pe?.price || 0);
      return sum;
    }, 0);
  }

  _enterShortStraddle(strategy, atmStrike) {
    const orders = [
      this._buildOptionOrder('SELL', atmStrike, 'CE', strategy),
      this._buildOptionOrder('SELL', atmStrike, 'PE', strategy)
    ];
    this._placeOrders(orders, strategy);
    strategy.state.hasTraded = true;
  }

  _exitShortStraddle(strategy, chain) {
    const strike = this._findPositionStrike(strategy, 'CE') || this._findPositionStrike(strategy, 'PE') || (chain[0]?.strike || 0);
    if (!strike) return;

    const orders = [
      this._buildOptionOrder('BUY', strike, 'CE', strategy, 'STRATEGY_EXIT'),
      this._buildOptionOrder('BUY', strike, 'PE', strategy, 'STRATEGY_EXIT')
    ];
    this._placeOrders(orders, strategy);
  }

  _enterLongStrangle(strategy, atmStrike, offset) {
    const orders = [
      this._buildOptionOrder('BUY', atmStrike + offset, 'CE', strategy),
      this._buildOptionOrder('BUY', atmStrike - offset, 'PE', strategy)
    ];
    this._placeOrders(orders, strategy);
    strategy.state.hasTraded = true;
  }

  _exitLongStrangle(strategy, chain, offset) {
    const baseStrike = chain[Math.floor(chain.length / 2)]?.strike || 0;
    const strikeCE = this._findPositionStrike(strategy, 'CE') || baseStrike + offset;
    const strikePE = this._findPositionStrike(strategy, 'PE') || baseStrike - offset;

    const orders = [
      this._buildOptionOrder('SELL', roundToStrike(strikeCE), 'CE', strategy, 'STRATEGY_EXIT'),
      this._buildOptionOrder('SELL', roundToStrike(strikePE), 'PE', strategy, 'STRATEGY_EXIT')
    ];
    this._placeOrders(orders, strategy);
  }

  _enterTrendFollow(strategy, atmStrike) {
    const order = this._buildOptionOrder('BUY', atmStrike, 'CE', strategy);
    this._placeOrders([order], strategy);
    strategy.state.hasTraded = true;
  }

  _exitTrendFollow(strategy, chain, atmStrike) {
    const order = this._buildOptionOrder('SELL', atmStrike, 'CE', strategy, 'STRATEGY_EXIT');
    this._placeOrders([order], strategy);
  }

  _updateBreakoutHigh(strategy, marketSnapshot) {
    const window = strategy.riskParams?.lookbackMinutes || 5;
    strategy.state.history.push(marketSnapshot.spot);
    if (strategy.state.history.length > window) {
      strategy.state.history.shift();
    }
    strategy.state.breakoutHigh = Math.max(...strategy.state.history);
  }

  _enterScalpFut(strategy) {
    const order = this._buildFuturesOrder('BUY', strategy, 'STRATEGY_ENTRY');
    this._placeOrders([order], strategy);
    strategy.state.hasTraded = true;
  }

  _exitScalpFut(strategy, price) {
    const order = this._buildFuturesOrder('SELL', strategy, 'STRATEGY_EXIT');
    this._placeOrders([order], strategy);
  }

  _enterBullCallSpread(strategy, atmStrike, width) {
    const buyOrder = this._buildOptionOrder('BUY', atmStrike, 'CE', strategy);
    const sellOrder = this._buildOptionOrder('SELL', atmStrike + width, 'CE', strategy);
    this._placeOrders([buyOrder, sellOrder], strategy);
    strategy.state.hasTraded = true;
  }

  _findPositionStrike(strategy, optionType) {
    const positions = this.portfolio?.getPositions() || [];
    const match = positions.find(position => position.optionType === optionType && position.instrument === 'NIFTY_OPT');
    return match?.strike;
  }

  _buildOrderBase(direction, instrument, strategy, entryType = 'STRATEGY_ENTRY') {
    return {
      instrument,
      symbol: 'NIFTY',
      orderType: 'MARKET',
      direction,
      quantity: NIFTY_LOT_SIZE,
      strategyName: strategy.name,
      entryType,
      createdBy: 'StrategyRunner'
    };
  }

  _buildOptionOrder(direction, strike, optionType, strategy, entryType = 'STRATEGY_ENTRY') {
    return {
      ...this._buildOrderBase(direction, 'NIFTY_OPT', strategy, entryType),
      strike,
      optionType
    };
  }

  _buildFuturesOrder(direction, strategy, entryType = 'STRATEGY_ENTRY') {
    return {
      ...this._buildOrderBase(direction, 'NIFTY_FUT', strategy, entryType)
    };
  }

  _placeOrders(orders, strategy) {
    orders.forEach(order => {
      const orderId = this.orderBook?.placeOrder(order);
      if (orderId) {
        strategy.state.activeOrderIds.push(orderId);
      }
    });
  }
}

export default StrategyRunner;
