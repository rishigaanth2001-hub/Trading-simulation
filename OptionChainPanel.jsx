import React, { useState, useMemo, useCallback, memo } from 'react';
import { NIFTY_LOT_SIZE } from '../data/marketConstants.js';

// Quick Order Modal Component
const QuickOrderModal = ({ option, spot, onClose, onPlaceOrder }) => {
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState('MARKET');
  const [limitPrice, setLimitPrice] = useState(option.price.toFixed(2));
  const [side, setSide] = useState('BUY');

  const handleConfirm = () => {
    const order = {
      instrument: 'NIFTY_OPT',
      symbol: 'NIFTY',
      orderType: orderType,
      direction: side,
      quantity: qty * NIFTY_LOT_SIZE,
      strike: option.strike,
      optionType: option.type
    };

    if (orderType === 'LIMIT') {
      order.price = parseFloat(limitPrice);
    }

    onPlaceOrder(order);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-600 min-w-96">
        <h3 className="text-white text-lg mb-4 font-mono">Quick Order</h3>

        <div className="mb-4">
          <div className="text-gray-300 text-sm">Instrument: {option.symbol}</div>
          <div className="text-white font-mono">Current Price: ₹{option.price.toFixed(2)}</div>
        </div>

        <div className="mb-4">
          <label className="text-gray-300 text-sm block mb-2">Quantity (Lots) — 1 lot = {NIFTY_LOT_SIZE} units</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
            className="bg-gray-700 text-white px-3 py-2 rounded w-full font-mono"
            min="1"
          />
        </div>

        <div className="mb-4">
          <label className="text-gray-300 text-sm block mb-2">Side</label>
          <div className="flex space-x-2">
            <button
              className={`px-4 py-2 rounded font-mono ${side === 'BUY' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}
              onClick={() => setSide('BUY')}
            >
              BUY
            </button>
            <button
              className={`px-4 py-2 rounded font-mono ${side === 'SELL' ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'}`}
              onClick={() => setSide('SELL')}
            >
              SELL
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="text-gray-300 text-sm block mb-2">Order Type</label>
          <div className="flex space-x-2 mb-2">
            <button
              className={`px-4 py-2 rounded font-mono ${orderType === 'MARKET' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
              onClick={() => setOrderType('MARKET')}
            >
              MARKET
            </button>
            <button
              className={`px-4 py-2 rounded font-mono ${orderType === 'LIMIT' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
              onClick={() => setOrderType('LIMIT')}
            >
              LIMIT
            </button>
          </div>
          {orderType === 'LIMIT' && (
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded w-full font-mono"
              step="0.01"
            />
          )}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-mono flex-1"
          >
            Confirm Order
          </button>
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded font-mono"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Tooltip Component
const GreekTooltip = ({ option, visible, style }) => {
  if (!visible) return null;

  return (
    <div style={style} className="absolute bg-gray-900 text-white p-2 rounded border border-gray-600 text-xs font-mono z-10">
      <div>Theta: {option.theta?.toFixed(4) || 'N/A'}</div>
      <div>Vega: {option.vega?.toFixed(4) || 'N/A'}</div>
      <div>Gamma: {option.gamma?.toFixed(4) || 'N/A'}</div>
    </div>
  );
};

const OptionChainPanel = ({ optionChain, spot, onPlaceOrder, atmIV, pcr, maxPain }) => {
  const [modalOption, setModalOption] = useState(null);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [expiry, setExpiry] = useState('WEEKLY');

  // Find ATM strike (closest to spot)
  const atmStrike = useMemo(() => {
    if (!optionChain || optionChain.length === 0) return null;
    return optionChain.reduce((prev, curr) =>
      Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev
    )?.strike;
  }, [optionChain, spot]);

  const handlePriceClick = useCallback((option) => {
    setModalOption(option);
  }, []);

  const handleRowHover = useCallback((option, event) => {
    setHoveredOption(option);
    setTooltipPos({ x: event.clientX + 10, y: event.clientY + 10 });
  }, []);

  const handleRowLeave = useCallback(() => {
    setHoveredOption(null);
  }, []);

  const getRowClass = useCallback((strike) => {
    const isATM = strike === atmStrike;
    const isITM = (strike < spot && 'ce') || (strike > spot && 'pe'); // Simplified

    let classes = 'border-b border-gray-700 hover:bg-gray-800 transition-colors';

    if (isATM) {
      classes += ' border-amber-500 bg-amber-900 bg-opacity-20';
    } else if (isITM) {
      classes += ' bg-opacity-30';
    } else {
      classes += ' bg-opacity-10';
    }

    return classes;
  }, [atmStrike, spot]);

  return (
    <div className="option-chain-panel bg-gray-900 p-4 rounded-lg h-full flex flex-col">
      {/* Top Info */}
      <div className="flex justify-between items-center mb-4 text-sm">
        <div className="flex space-x-6 text-gray-300 font-mono">
          <span>ATM IV: {atmIV?.toFixed(2) || 'N/A'}%</span>
          <span>PCR: {pcr?.toFixed(2) || 'N/A'}</span>
          <span>Max Pain: {maxPain || 'N/A'}</span>
        </div>
        <div className="flex">
          <button
            className={`px-3 py-1 mr-2 rounded font-mono text-sm ${
              expiry === 'WEEKLY' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            onClick={() => setExpiry('WEEKLY')}
          >
            WEEKLY
          </button>
          <button
            className={`px-3 py-1 rounded font-mono text-sm ${
              expiry === 'MONTHLY' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            onClick={() => setExpiry('MONTHLY')}
          >
            MONTHLY
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="text-gray-400 border-b border-gray-600">
              <th className="px-2 py-2 text-right bg-blue-900 bg-opacity-20">CE OI</th>
              <th className="px-2 py-2 text-right bg-blue-900 bg-opacity-20">CE Vol</th>
              <th className="px-2 py-2 text-right bg-blue-900 bg-opacity-20">CE IV</th>
              <th className="px-2 py-2 text-right bg-blue-900 bg-opacity-20">CE Δ</th>
              <th className="px-2 py-2 text-right bg-blue-900 bg-opacity-20">CE Price</th>
              <th className="px-2 py-2 text-center bg-gray-800">STRIKE</th>
              <th className="px-2 py-2 text-left bg-red-900 bg-opacity-20">PE Price</th>
              <th className="px-2 py-2 text-left bg-red-900 bg-opacity-20">PE Δ</th>
              <th className="px-2 py-2 text-left bg-red-900 bg-opacity-20">PE IV</th>
              <th className="px-2 py-2 text-left bg-red-900 bg-opacity-20">PE Vol</th>
              <th className="px-2 py-2 text-left bg-red-900 bg-opacity-20">PE OI</th>
            </tr>
          </thead>
          <tbody>
            {optionChain.map((row, index) => (
              <tr
                key={row.strike}
                className={getRowClass(row.strike)}
                onMouseEnter={(e) => handleRowHover(row.ce, e)}
                onMouseLeave={handleRowLeave}
              >
                <td className="px-2 py-1 text-right text-gray-300 bg-blue-900 bg-opacity-10">
                  {row.ce?.oi?.toLocaleString() || '-'}
                </td>
                <td className="px-2 py-1 text-right text-gray-300 bg-blue-900 bg-opacity-10">
                  {row.ce?.volume?.toLocaleString() || '-'}
                </td>
                <td className="px-2 py-1 text-right text-gray-300 bg-blue-900 bg-opacity-10">
                  {row.ce?.iv ? (row.ce.iv * 100).toFixed(1) + '%' : '-'}
                </td>
                <td className="px-2 py-1 text-right text-gray-300 bg-blue-900 bg-opacity-10">
                  {row.ce?.delta?.toFixed(3) || '-'}
                </td>
                <td
                  className="px-2 py-1 text-right text-green-400 cursor-pointer hover:bg-gray-700 bg-blue-900 bg-opacity-10"
                  onClick={() => handlePriceClick({
                    symbol: `NIFTY${row.strike}CE`,
                    price: row.ce?.price || 0,
                    strike: row.strike,
                    type: 'CE'
                  })}
                >
                  {row.ce?.price?.toFixed(2) || '-'}
                </td>
                <td className="px-2 py-1 text-center text-white font-bold bg-gray-800">
                  {row.strike}
                </td>
                <td
                  className="px-2 py-1 text-left text-red-400 cursor-pointer hover:bg-gray-700 bg-red-900 bg-opacity-10"
                  onClick={() => handlePriceClick({
                    symbol: `NIFTY${row.strike}PE`,
                    price: row.pe?.price || 0,
                    strike: row.strike,
                    type: 'PE'
                  })}
                >
                  {row.pe?.price?.toFixed(2) || '-'}
                </td>
                <td className="px-2 py-1 text-left text-gray-300 bg-red-900 bg-opacity-10">
                  {row.pe?.delta?.toFixed(3) || '-'}
                </td>
                <td className="px-2 py-1 text-left text-gray-300 bg-red-900 bg-opacity-10">
                  {row.pe?.iv ? (row.pe.iv * 100).toFixed(1) + '%' : '-'}
                </td>
                <td className="px-2 py-1 text-left text-gray-300 bg-red-900 bg-opacity-10">
                  {row.pe?.volume?.toLocaleString() || '-'}
                </td>
                <td className="px-2 py-1 text-left text-gray-300 bg-red-900 bg-opacity-10">
                  {row.pe?.oi?.toLocaleString() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      <GreekTooltip
        option={hoveredOption}
        visible={!!hoveredOption}
        style={{ left: tooltipPos.x, top: tooltipPos.y }}
      />

      {/* Modal */}
      {modalOption && (
        <QuickOrderModal
          option={modalOption}
          spot={spot}
          onClose={() => setModalOption(null)}
          onPlaceOrder={onPlaceOrder}
        />
      )}
    </div>
  );
};

export default memo(OptionChainPanel);