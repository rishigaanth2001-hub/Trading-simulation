import React, { useMemo, memo } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

// Custom candlestick shape function
const CandlestickShape = (props) => {
  const { payload, x, y, width, height } = props;
  if (!payload) return null;

  const { open, high, low, close } = payload;
  const isGreen = close > open;
  const bodyTop = Math.min(open, close);
  const bodyBottom = Math.max(open, close);
  const bodyHeight = Math.abs(close - open);

  // Scale factors (assuming y is top, height is down)
  // Guard against divide-by-zero on doji candles where high === low
  const range = (high - low) || 1;
  const scaleY = (value) => y + (high - value) / range * height;
  const wickTop = scaleY(high);
  const wickBottom = scaleY(low);
  const bodyY = scaleY(bodyTop);
  const bodyH = (bodyHeight / range) * height;

  const color = isGreen ? '#00d4aa' : '#ff4d6d';

  return (
    <g>
      {/* Wick */}
      <line
        x1={x + width / 2}
        y1={wickTop}
        x2={x + width / 2}
        y2={wickBottom}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + width * 0.1}
        y={bodyY}
        width={width * 0.8}
        height={bodyH || 1} // Minimum height for doji
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#1a1a1a', color: '#fff', padding: '10px', border: '1px solid #333' }}>
        <p>{`Time: ${label}`}</p>
        <p>{`Open: ${data.open.toFixed(2)}`}</p>
        <p>{`High: ${data.high.toFixed(2)}`}</p>
        <p>{`Low: ${data.low.toFixed(2)}`}</p>
        <p>{`Close: ${data.close.toFixed(2)}`}</p>
      </div>
    );
  }
  return null;
};

const ChartPanel = ({ candles, currentPrice, symbol, onSymbolChange, dayHigh, dayLow }) => {
  const visibleCandles = useMemo(() => candles.slice(-60), [candles]);

  const { change, changePercent, highOfDay, lowOfDay, yMin, yMax } = useMemo(() => {
    const prevClose = candles.length > 0 ? candles[candles.length - 1].close : currentPrice;
    const computedChange = currentPrice - prevClose;
    const computedChangePercent = prevClose !== 0 ? (computedChange / prevClose) * 100 : 0;
    const highOfDayValue = dayHigh || (candles.length > 0 ? Math.max(...candles.map(c => c.high)) : currentPrice);
    const lowOfDayValue = dayLow || (candles.length > 0 ? Math.min(...candles.map(c => c.low)) : currentPrice);
    const prices = visibleCandles.flatMap(c => [c.open, c.high, c.low, c.close]);
    const minPrice = prices.length ? Math.min(...prices) : currentPrice;
    const maxPrice = prices.length ? Math.max(...prices) : currentPrice;
    const range = Math.max(maxPrice - minPrice, 1);
    return {
      change: computedChange,
      changePercent: computedChangePercent,
      highOfDay: highOfDayValue,
      lowOfDay: lowOfDayValue,
      yMin: minPrice - range * 0.05,
      yMax: maxPrice + range * 0.05
    };
  }, [candles, currentPrice, visibleCandles]);

  // Format time for X-axis
  const formatTime = (time) => {
    // Assuming time is a string like '09:15' or Date
    return typeof time === 'string' ? time : new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const instruments = ['NIFTY', 'RELIANCE', 'HDFCBANK', 'TATAMOTORS'];

  return (
    <div className="chart-panel bg-gray-900 p-4 rounded-lg h-full flex flex-col">
      {/* Top info */}
      <div className="flex justify-between items-center mb-4 text-sm">
        <div className="flex space-x-4">
          <span className="text-white font-mono">
            {symbol} {currentPrice.toFixed(2)}
          </span>
          <span className={`font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
          </span>
        </div>
        <div className="flex space-x-4 text-gray-400 font-mono">
          <span>H: {highOfDay.toFixed(2)}</span>
          <span>L: {lowOfDay.toFixed(2)}</span>
        </div>
      </div>

      {/* Instrument tabs */}
      <div className="flex mb-4">
        {instruments.map((inst) => (
          <button
            key={inst}
            className={`px-3 py-1 mr-2 rounded font-mono text-sm ${
              inst === symbol ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            onClick={() => onSymbolChange && onSymbolChange(inst)}
          >
            {inst}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visibleCandles} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              interval={9} // Every 10th tick (0-based)
              axisLine={{ stroke: '#666' }}
              tickLine={{ stroke: '#666' }}
              tick={{ fill: '#ccc', fontSize: 12 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              axisLine={{ stroke: '#666' }}
              tickLine={{ stroke: '#666' }}
              tick={{ fill: '#ccc', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={currentPrice} stroke="#fff" strokeDasharray="5 5" />
            <Bar dataKey="close" shape={CandlestickShape} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default memo(ChartPanel);