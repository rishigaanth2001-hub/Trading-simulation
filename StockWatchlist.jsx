import React, { useState, useMemo, useCallback, memo } from 'react';

// Mini Sparkline Component
const MiniSparkline = ({ data, width = 30, height = 20 }) => {
  if (!data || data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke="#00d4aa"
        strokeWidth="1"
        points={points}
      />
    </svg>
  );
};

// Stock Chip Component
const StockChip = memo(({ stock, isSelected, onClick, onPlaceOrder }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const changePercent = stock.changePercent || 0;
  const change = stock.change || 0;

  // Color logic
  let bgColor = 'bg-gray-800';
  let textColor = 'text-white';
  let glowClass = '';

  if (changePercent > 1) {
    bgColor = 'bg-green-600';
    textColor = 'text-white';
    glowClass = 'shadow-lg shadow-green-500/50';
  } else if (changePercent > 0) {
    bgColor = 'bg-green-900';
    textColor = 'text-green-300';
  } else if (changePercent > -1) {
    bgColor = 'bg-red-900';
    textColor = 'text-red-300';
  } else {
    bgColor = 'bg-red-600';
    textColor = 'text-white';
    glowClass = 'shadow-lg shadow-red-500/50';
  }

  const handleClick = useCallback(() => {
    onClick(stock);
    setShowDropdown((prev) => !prev);
  }, [onClick, stock]);

  const handleOrder = useCallback((instrument, direction) => {
    const order = {
      instrument: instrument,
      symbol: stock.symbol,
      orderType: 'MARKET',
      direction: direction,
      quantity: 1
    };
    onPlaceOrder(order);
    setShowDropdown(false);
  }, [onPlaceOrder, stock.symbol]);

  return (
    <div className="relative inline-block mr-2">
      <div
        className={`stock-chip ${bgColor} ${textColor} ${glowClass} p-2 rounded-lg cursor-pointer border border-gray-600 hover:border-gray-400 transition-all duration-200 min-w-32`}
        onClick={handleClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-bold text-sm font-mono">{stock.symbol}</div>
            <div className="text-xs font-mono">₹{stock.price?.toFixed(2)}</div>
            <div className={`text-xs font-mono flex items-center ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? '↑' : '↓'} {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
            </div>
          </div>
          <div className="ml-2">
            <MiniSparkline data={stock.priceHistory} />
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 min-w-32">
          <button
            onClick={() => handleOrder('STOCK', 'BUY')}
            className="block w-full text-left px-3 py-2 text-sm font-mono text-green-400 hover:bg-gray-700"
          >
            Buy Stock
          </button>
          <button
            onClick={() => handleOrder('STOCK_OPT', 'BUY')}
            className="block w-full text-left px-3 py-2 text-sm font-mono text-green-400 hover:bg-gray-700"
          >
            Buy CE
          </button>
          <button
            onClick={() => handleOrder('STOCK_OPT', 'BUY')}
            className="block w-full text-left px-3 py-2 text-sm font-mono text-green-400 hover:bg-gray-700"
          >
            Buy PE
          </button>
          <button
            onClick={() => handleOrder('STOCK', 'SELL')}
            className="block w-full text-left px-3 py-2 text-sm font-mono text-red-400 hover:bg-gray-700"
          >
            Sell Stock
          </button>
        </div>
      )}
    </div>
  );
});

// Heatmap Popup Component
const HeatmapPopup = ({ stocks, onClose }) => {
  const getHeatmapColor = (changePercent) => {
    if (changePercent > 1) return 'bg-green-600';
    if (changePercent > 0) return 'bg-green-400';
    if (changePercent > -1) return 'bg-red-400';
    return 'bg-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-600 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-xl font-mono">NIFTY HEATMAP</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {stocks.map((stock) => (
            <div
              key={stock.symbol}
              className={`${getHeatmapColor(stock.changePercent)} p-3 rounded text-center text-white font-mono text-sm`}
            >
              <div className="font-bold">{stock.symbol}</div>
              <div className="text-xs">{stock.changePercent?.toFixed(2)}%</div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-gray-400 text-xs">
          Green: Gainers | Red: Losers
        </div>
      </div>
    </div>
  );
};

const StockWatchlist = ({ stocks, onStockSelect, onPlaceOrder }) => {
  const [selectedStock, setSelectedStock] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  const handleStockClick = useCallback((stock) => {
    setSelectedStock(stock);
    onStockSelect && onStockSelect(stock);
  }, [onStockSelect]);

  const stockCards = useMemo(() => stocks.map((stock) => (
    <StockChip
      key={stock.symbol}
      stock={stock}
      isSelected={selectedStock?.symbol === stock.symbol}
      onClick={handleStockClick}
      onPlaceOrder={onPlaceOrder}
    />
  )), [stocks, selectedStock, handleStockClick, onPlaceOrder]);

  return (
    <div className="stock-watchlist bg-gray-900 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-lg font-mono">Stock Watchlist</h3>
        <button
          onClick={() => setShowHeatmap(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-mono text-sm"
        >
          NIFTY HEATMAP
        </button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex space-x-2 min-w-max">
          {stockCards}
        </div>
      </div>

      {/* Heatmap Popup */}
      {showHeatmap && (
        <HeatmapPopup
          stocks={stocks}
          onClose={() => setShowHeatmap(false)}
        />
      )}
    </div>
  );
};

export default memo(StockWatchlist);