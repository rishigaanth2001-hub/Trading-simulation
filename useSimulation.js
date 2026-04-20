import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import SimulationClock from '../engine/SimulationClock.js';
import OrderBook from '../engine/OrderBook.js';
import Portfolio from '../engine/Portfolio.js';
import OptionChainGenerator from '../engine/OptionChainGenerator.js';
import VolatilitySurface from '../engine/VolatilitySurface.js';
import StrategyRunner from '../engine/StrategyRunner.js';
import { PREBUILT_STRATEGIES } from '../data/strategies.js';

/**
 * useSimulation - Custom React hook for trading simulation
 * Bridges simulation engine with React UI
 */
export function useSimulation(config = {}) {
  const {
    seed = 20240419,
    speed = 1,
    daysToExpiry = 7,
    baseNiftyPrice = 23500,
    initialCapital = 500000,
    strategy = null,
    scenario = 'AUTO',
    onMarketClose = null,
    carryForward = false
  } = config;

  // Engine instances (useRef to avoid re-renders)
  const simulationClockRef = useRef(null);
  const orderBookRef = useRef(null);
  const portfolioRef = useRef(null);
  const optionChainGenRef = useRef(null);
  const stockChainGeneratorsRef = useRef({});
  const stockOptionChainCacheRef = useRef({});
  const volSurfaceRef = useRef(null);
  const strategyRunnerRef = useRef(null);

  // Display state
  const [spotPrice, setSpotPrice] = useState(baseNiftyPrice);
  const [futuresPrice, setFuturesPrice] = useState(baseNiftyPrice);
  const [stocks, setStocks] = useState([]);
  const [optionChain, setOptionChain] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [regime, setRegime] = useState('CHOPPY');
  const [currentTime, setCurrentTime] = useState('9:15:00');
  const [isRunning, setIsRunning] = useState(false);
  const [candles, setCandles] = useState([]);
  const [tickRate, setTickRate] = useState(0);
  const [dayHigh, setDayHigh] = useState(baseNiftyPrice);
  const [dayLow, setDayLow] = useState(baseNiftyPrice);
  const dayHighRef = useRef(baseNiftyPrice);
  const dayLowRef = useRef(baseNiftyPrice);
  const regimeRef = useRef('CHOPPY');

  const optionChainCacheRef = useRef({ spot: baseNiftyPrice, daysToExpiry, chain: [] });
  const lastOptionChainTimestampRef = useRef(Date.now());
  const tickRateCounterRef = useRef(0);
  const candlesRef = useRef([]);
  const candleStateUpdateCounterRef = useRef(0);
  const OPTION_CHAIN_UPDATE_THRESHOLD = 0.001; // 0.1%
  const OPTION_CHAIN_UPDATE_SECONDS = 5000; // 5 sec

  // Throttling for option chain updates
  const tickCounterRef = useRef(0);
  const OPTION_CHAIN_UPDATE_INTERVAL = 5; // Update every 5 ticks

  // Initialize engines
  const initializeEngines = useCallback(() => {
    // Create volatility surface
    volSurfaceRef.current = new VolatilitySurface({
      baseIV: 0.14,
      seed: seed,
      regimeController: null // Will be set after clock creation
    });

    // Create simulation clock
    simulationClockRef.current = new SimulationClock({
      seed: seed,
      speedMultiplier: speed,
      daysToExpiry: daysToExpiry,
      baseNiftyPrice: baseNiftyPrice
    });

    // Set regime controller in vol surface
    volSurfaceRef.current.regimeController = simulationClockRef.current.regimeController;

    // Create option chain generator
    optionChainGenRef.current = new OptionChainGenerator({
      volSurface: volSurfaceRef.current,
      strikesAroundATM: 10,
      strikeStep: 50,
      seed: seed
    });

    // Initialize option chain from the base price so the panel has data immediately
    const initialChain = optionChainGenRef.current.getChain(baseNiftyPrice, daysToExpiry);
    optionChainCacheRef.current.chain = initialChain;
    optionChainCacheRef.current.spot = baseNiftyPrice;
    setOptionChain(initialChain);

    // Create stock option chain generators once
    const majorStocks = ['RELIANCE', 'HDFCBANK', 'INFY'];
    stockChainGeneratorsRef.current = majorStocks.reduce((acc, symbol) => {
      acc[symbol] = new OptionChainGenerator({
        volSurface: volSurfaceRef.current,
        strikesAroundATM: 5,
        strikeStep: 50,
        seed: seed + symbol.charCodeAt(0)
      });
      return acc;
    }, {});

    // Create order book
    orderBookRef.current = new OrderBook();

    // Create portfolio
    portfolioRef.current = new Portfolio({
      initialCapital: initialCapital,
      restoreFromStorage: carryForward
    });

    // Create strategy runner
    const strategiesToUse = PREBUILT_STRATEGIES.map((strategyConfig) => ({
      ...strategyConfig,
      enabled: strategy ? strategyConfig.name === strategy : false
    }));

    strategyRunnerRef.current = new StrategyRunner({
      orderBook: orderBookRef.current,
      portfolio: portfolioRef.current,
      optionChainGenerator: optionChainGenRef.current,
      clock: simulationClockRef.current,
      strategies: strategiesToUse
    });

    // Set up event listeners
    setupEventListeners();

    // Initial portfolio state
    setPortfolio(portfolioRef.current.getSummary());
  }, [seed, speed, daysToExpiry, baseNiftyPrice, initialCapital]);

  // Set up event listeners
  const setupEventListeners = useCallback(() => {
    const clock = simulationClockRef.current;
    const orderBook = orderBookRef.current;
    const portfolio = portfolioRef.current;

    // Tick event handler
    clock.on('tick', (data) => {
      tickRateCounterRef.current++;

      // Update basic state
      setSpotPrice(data.spot);
      setFuturesPrice(data.futures.price);
      setStocks(data.stocks);
      setRegime(data.regime);
      // Update volatility surface dynamics each tick
      if (volSurfaceRef.current) {
        volSurfaceRef.current.tick(data.spot, 1, data.regime);
      }
      regimeRef.current = data.regime;
      setCurrentTime(data.time);
      setDayHigh((prev) => {
        const next = Math.max(prev, data.spot);
        dayHighRef.current = next;
        return next;
      });
      setDayLow((prev) => {
        const next = Math.min(prev, data.spot);
        dayLowRef.current = next;
        return next;
      });
      setIsRunning(true);

      const currentOptions = generateOptionChains(data.spot, data.futures.daysToExpiry, data.stocks);
      setOptionChain((prevChain) => prevChain === currentOptions.NIFTY ? prevChain : currentOptions.NIFTY);

      // Update portfolio prices
      portfolio.updatePrices({
        spot: data.spot,
        futures: data.futures,
        stocks: data.stocks,
        options: currentOptions
      });
      setPortfolio(portfolio.getSummary());

      // Process strategy logic before order execution
      strategyRunnerRef.current?.processTick({
        spot: data.spot,
        futures: data.futures,
        stocks: data.stocks,
        options: currentOptions,
        time: data.time,
        regime: data.regime
      });

      // Process pending orders
      orderBook.processTick({
        spot: data.spot,
        futures: data.futures,
        stocks: data.stocks,
        options: currentOptions
      });

      // Update candles
      updateCandles(data);
    });

    // Candle event handler
    clock.on('candle', (candleData) => {
      if (candleData.symbol === 'NIFTY') {
        const candle = {
          open: candleData.ohlc.open,
          high: candleData.ohlc.high,
          low: candleData.ohlc.low,
          close: candleData.ohlc.close,
          time: candleData.second
        };
        candlesRef.current.push(candle);
        if (candlesRef.current.length > 390) {
          candlesRef.current.splice(0, candlesRef.current.length - 390);
        }
        setCandles([...candlesRef.current]);
      }
    });

    // Regime change handler
    clock.on('regimeChange', (regimeData) => {
      setRegime(regimeData.to);
    });

    // Market close handler
    clock.on('marketClose', () => {
      setIsRunning(false);
      const portfolioSnapshot = portfolio.getSummary();
      const dailyStatsSnapshot = portfolio.getDailyStats();
      const strategyPerformance = strategyRunnerRef.current?.strategies.map((strategy) => ({
        name: strategy.name,
        displayName: strategy.displayName,
        enabled: strategy.enabled,
        trades: strategy.state.tradeLog.length,
        hasTraded: strategy.state.hasTraded,
        tradeLog: strategy.state.tradeLog || []
      })) || [];

      const summary = {
        totalPnl: portfolio.getTotalPnl(),
        dailyStats: dailyStatsSnapshot,
        portfolio: portfolioSnapshot,
        dayRange: {
          high: dayHighRef.current,
          low: dayLowRef.current
        },
        regime: regimeRef.current,
        strategyPerformance
      };

      onMarketClose?.(summary);
    });

    // Order filled handler
    orderBook.on('orderFilled', (orderEvent) => {
      portfolio.onOrderFilled(orderEvent);
      setPortfolio(portfolio.getSummary());
    });
  }, []);

  // Generate option chains for all instruments
  const generateOptionChains = useCallback((spot, daysToExpiry, marketStocks) => {
    tickCounterRef.current += 1;
    const skipComputation = tickCounterRef.current < OPTION_CHAIN_UPDATE_INTERVAL && optionChainCacheRef.current.chain.length > 0;
    if (skipComputation) {
      const fallbackChains = { NIFTY: optionChainCacheRef.current.chain };
      const majorStocks = ['RELIANCE', 'HDFCBANK', 'INFY'];
      majorStocks.forEach((symbol) => {
        const cachedChain = stockOptionChainCacheRef.current[symbol];
        if (cachedChain) {
          fallbackChains[symbol] = cachedChain;
        }
      });
      return fallbackChains;
    }

    tickCounterRef.current = 0;
    const now = Date.now();
    const cache = optionChainCacheRef.current;
    const spotMove = cache.spot > 0 ? Math.abs(spot - cache.spot) / cache.spot : Infinity;
    const shouldRefresh =
      spotMove > OPTION_CHAIN_UPDATE_THRESHOLD ||
      daysToExpiry !== cache.daysToExpiry ||
      now - lastOptionChainTimestampRef.current >= OPTION_CHAIN_UPDATE_SECONDS ||
      !cache.chain.length;

    const chains = {};
    if (shouldRefresh) {
      const freshChain = optionChainGenRef.current.getChain(spot, daysToExpiry);
      cache.chain = freshChain;
      cache.spot = spot;
      cache.daysToExpiry = daysToExpiry;
      lastOptionChainTimestampRef.current = now;
      chains.NIFTY = freshChain;
    } else {
      chains.NIFTY = cache.chain;
    }

    // Stock options (simplified - only generate for a few stocks)
    const majorStocks = ['RELIANCE', 'HDFCBANK', 'INFY'];
    majorStocks.forEach(symbol => {
      const stockData = marketStocks.find(s => s.symbol === symbol);
      const generator = stockChainGeneratorsRef.current[symbol];
      if (stockData && generator) {
        const stockChain = generator.getChain(stockData.price, daysToExpiry);
        chains[symbol] = stockChain;
        stockOptionChainCacheRef.current[symbol] = stockChain;
      }
    });

    return chains;
  }, [seed]);

  // Update candles array without state churn
  const updateCandles = useCallback((tickData) => {
    // Candles handled by clock 'candle' event
  }, []);

  // Exposed methods
  const start = useCallback(() => {
    if (simulationClockRef.current) {
      simulationClockRef.current.start();
    }
  }, []);

  const pause = useCallback(() => {
    if (simulationClockRef.current) {
      simulationClockRef.current.pause();
      setIsRunning(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (simulationClockRef.current) {
      simulationClockRef.current.resume();
      setIsRunning(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (simulationClockRef.current) {
      simulationClockRef.current.stop();
      setIsRunning(false);
    }
  }, []);

  const setSpeed = useCallback((newSpeed) => {
    if (simulationClockRef.current) {
      simulationClockRef.current.setSpeed(newSpeed);
    }
  }, []);

  const placeOrder = useCallback((orderConfig) => {
    if (orderBookRef.current) {
      return orderBookRef.current.placeOrder(orderConfig);
    }
    return null;
  }, []);

  const cancelOrder = useCallback((orderId) => {
    if (orderBookRef.current) {
      return orderBookRef.current.cancelOrder(orderId);
    }
    return false;
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeEngines();

    const interval = setInterval(() => {
      setTickRate(tickRateCounterRef.current);
      tickRateCounterRef.current = 0;
    }, 1000);

    return () => {
      clearInterval(interval);
      if (simulationClockRef.current) {
        simulationClockRef.current.stop();
      }
      if (portfolioRef.current) {
        portfolioRef.current.saveToLocalStorage();
      }
    };
  }, [initializeEngines]);

  const dailyStats = useMemo(() => {
    if (!portfolio) {
      return { tradesCount: 0, winRate: 0, bestTrade: 0, worstTrade: 0, totalPnl: 0 };
    }
    return portfolio.getDailyStats();
  }, [portfolio]);

  // Return hook interface
  return {
    // State
    spotPrice,
    futuresPrice,
    stocks,
    optionChain,
    portfolio,
    dailyStats,
    regime,
    currentTime,
    isRunning,
    candles,
    tickRate,
    dayHigh,
    dayLow,

    // Methods
    placeOrder,
    cancelOrder,
    start,
    pause,
    resume,
    stop,
    setSpeed,

    // Engine access (for advanced usage)
    simulationClock: simulationClockRef.current,
    orderBook: orderBookRef.current,
    portfolioManager: portfolioRef.current,
    strategyRunner: strategyRunnerRef.current
  };
}

export default useSimulation;
