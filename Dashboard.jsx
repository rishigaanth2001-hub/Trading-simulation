import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './Dashboard.css';
import ChartPanel from './ChartPanel';
import OptionChainPanel from './OptionChainPanel';
import PortfolioPanel from './PortfolioPanel';
import StrategyPanel from './StrategyPanel';
import StockWatchlist from './StockWatchlist';
import HistoryPanel from './HistoryPanel';
import Settings from './Settings';
import ErrorBoundary from './ErrorBoundary';

/**
 * Dashboard - Main layout component for the trading simulation
 * Dark terminal aesthetic with grid-based responsive layout
 */
function Dashboard({
  spotPrice,
  futuresPrice,
  stocks,
  optionChain,
  portfolio,
  regime,
  currentTime,
  isRunning,
  candles,
  placeOrder,
  cancelOrder,
  start,
  pause,
  resume,
  stop,
  setSpeed,
  simulationClock,
  orderBook,
  onLoadSession,
  onSettingsChange,
  onClearAllData,
  dayHigh,
  dayLow,
  strategyRunner
}) {
  const [prevSpotPrice, setPrevSpotPrice] = useState(spotPrice);
  const [priceColor, setPriceColor] = useState('#f0b429');

  // Update price color based on change
  useEffect(() => {
    if (spotPrice > prevSpotPrice) {
      setPriceColor('#00d4aa'); // Green for up
    } else if (spotPrice < prevSpotPrice) {
      setPriceColor('#ff4d6d'); // Red for down
    } else {
      setPriceColor('#f0b429'); // Gold for no change
    }
    setPrevSpotPrice(spotPrice);
  }, [spotPrice, prevSpotPrice]);

  // Get regime display info
  const getRegimeInfo = (regime) => {
    const regimeMap = {
      TRENDING_UP: { label: 'TRENDING UP', color: '#00d4aa' },
      TRENDING_DOWN: { label: 'TRENDING DOWN', color: '#ff4d6d' },
      CHOPPY: { label: 'CHOPPY', color: '#f0b429' },
      HIGH_VOL: { label: 'HIGH VOL', color: '#ff6b35' },
      FLASH_CRASH: { label: 'FLASH CRASH', color: '#ff4d6d' }
    };
    return regimeMap[regime] || { label: regime, color: '#f0b429' };
  };

  const regimeInfo = useMemo(() => getRegimeInfo(regime), [regime]);

  // Aggregate strategy logs from all strategies
  const aggregatedStrategyLogs = useMemo(() => {
    if (!strategyRunner?.strategies) return [];
    const logs = [];
    strategyRunner.strategies.forEach(strategy => {
      if (strategy.state?.tradeLog) {
        strategy.state.tradeLog.forEach(log => {
          logs.push({
            strategyName: strategy.name,
            ...log
          });
        });
      }
    });
    return logs;
  }, [strategyRunner?.strategies]);

  // Calculate option chain metrics
  const metrics = useMemo(() => {
    if (!optionChain || optionChain.length === 0) return { atmIV: null, pcr: null, maxPain: null };

    const atmStrike = optionChain.reduce((prev, curr) =>
      Math.abs(curr.strike - spotPrice) < Math.abs(prev.strike - spotPrice) ? curr : prev
    );

    const atmIV = atmStrike?.ce?.iv || atmStrike?.pe?.iv || null;

    const totalCeOi = optionChain.reduce((sum, row) => sum + (row.ce?.oi || 0), 0);
    const totalPeOi = optionChain.reduce((sum, row) => sum + (row.pe?.oi || 0), 0);
    const pcr = totalPeOi > 0 ? totalCeOi / totalPeOi : null;

    const maxPainStrike = optionChain.reduce((max, row) => {
      const totalOi = (row.ce?.oi || 0) + (row.pe?.oi || 0);
      return totalOi > (max.oi || 0) ? { strike: row.strike, oi: totalOi } : max;
    }, {}).strike;

    return { atmIV, pcr, maxPain: maxPainStrike };
  }, [optionChain, spotPrice]);

  // Handle speed change
  const handleSpeedChange = useCallback((speed) => {
    setSpeed(speed);
  }, [setSpeed]);

  // Handle new day (reset simulation)
  const handleNewDay = useCallback(() => {
    stop();
    // Reset would need to be implemented in the hook
    setTimeout(() => start(), 100);
  }, [stop, start]);

  // Handle strategy selection
  const handleSelectStrategy = useCallback((strategyName) => {
    // Strategy selection is handled via component state in StrategyPanel
    console.log('Selected strategy:', strategyName);
  }, []);

  // Handle strategy toggle
  const handleToggleStrategy = useCallback((strategyName, enabled) => {
    if (strategyRunner) {
      strategyRunner.toggleStrategy(strategyName, enabled);
    }
  }, [strategyRunner]);

  return (
    <div className="dashboard">
      {/* Top Bar */}
      <div className="topbar">
        <div className="logo">
          <h1>NIFTY SIM</h1>
        </div>

        <div className="price-display">
          <div className="nifty-price" style={{ color: priceColor }}>
            {spotPrice?.toFixed(2) || '0.00'}
          </div>
          <div className="price-label">NIFTY 50</div>
        </div>

        <div className="time-display">
          <div className="current-time">{currentTime}</div>
          <div className="regime-badge" style={{ backgroundColor: regimeInfo.color }}>
            {regimeInfo.label}
          </div>
        </div>

        <div className="controls">
          <div className="speed-controls">
            <button
              className="speed-btn"
              onClick={() => handleSpeedChange(1)}
            >
              1x
            </button>
            <button
              className="speed-btn"
              onClick={() => handleSpeedChange(5)}
            >
              5x
            </button>
            <button
              className="speed-btn"
              onClick={() => handleSpeedChange(10)}
            >
              10x
            </button>
            <button
              className="speed-btn"
              onClick={() => handleSpeedChange(60)}
            >
              60x
            </button>
            <button
              className="speed-btn"
              onClick={() => handleSpeedChange(390)}
            >
              390x
            </button>
          </div>

          <div className="playback-controls">
            {!isRunning ? (
              <button className="control-btn play" onClick={start}>
                ▶ PLAY
              </button>
            ) : (
              <button className="control-btn pause" onClick={pause}>
                ⏸ PAUSE
              </button>
            )}
            <button className="control-btn stop" onClick={stop}>
              ⏹ STOP
            </button>
            <button className="control-btn new-day" onClick={handleNewDay}>
              🔄 NEW DAY
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="main-content">
        {/* Chart Panel */}
        <div className="chart-panel">
          <ErrorBoundary fallback="Chart panel failed to load.">
            <ChartPanel
              candles={candles}
              currentPrice={spotPrice}
              symbol="NIFTY"
              dayHigh={dayHigh}
              dayLow={dayLow}
            />
          </ErrorBoundary>
        </div>

        {/* Option Chain Panel */}
        <div className="option-chain-panel">
          <ErrorBoundary fallback="Option chain panel failed to load.">
            <OptionChainPanel
              optionChain={optionChain}
              spot={spotPrice}
              onPlaceOrder={placeOrder}
              atmIV={metrics.atmIV}
              pcr={metrics.pcr}
              maxPain={metrics.maxPain}
            />
          </ErrorBoundary>
        </div>

        {/* Stock Watchlist */}
        <div className="stock-watchlist">
          <StockWatchlist
            stocks={stocks}
            onStockSelect={(stock) => console.log('Selected stock:', stock)} // TODO: Integrate with chart panel
            onPlaceOrder={placeOrder}
          />
        </div>

        {/* Portfolio Panel */}
        <div className="portfolio-panel">
          <PortfolioPanel
            portfolio={portfolio}
            orders={orderBook ? Array.from(orderBook.orders?.values() || []) : []}
            onCancelOrder={cancelOrder}
            onExitAll={() => {}}
            onExitPosition={() => {}}
          />
        </div>

        {/* Strategy Panel */}
        <div className="strategy-panel">
          <ErrorBoundary fallback="Strategy panel failed to load.">
            <StrategyPanel
              strategies={strategyRunner?.strategies || []}
              onSelectStrategy={handleSelectStrategy}
              onToggleStrategy={handleToggleStrategy}
              strategyLogs={aggregatedStrategyLogs}
              performanceData={[]}
            />
          </ErrorBoundary>
        </div>

        {/* History Panel */}
        <div className="history-panel">
          <HistoryPanel onLoadSession={onLoadSession} />
        </div>

        {/* Settings Panel */}
        <div className="settings-panel">
          <Settings onChange={onSettingsChange} onClearAll={onClearAllData} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
