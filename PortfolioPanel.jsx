import React, { useState } from 'react';

// Topbar Widget Component
const PortfolioTopbar = ({ portfolio }) => {
  const availableCash = portfolio?.cash || 0;
  const unrealizedPnl = portfolio?.unrealizedPnl || 0;
  const realizedPnl = portfolio?.realizedPnl || 0;

  return (
    <div className="portfolio-topbar flex space-x-4 mb-4">
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-600 flex-1">
        <div className="text-gray-400 text-xs font-mono">Available Cash</div>
        <div className="text-white text-lg font-mono">₹{availableCash.toLocaleString()}</div>
      </div>
      <div className={`p-3 rounded-lg border flex-1 ${unrealizedPnl >= 0 ? 'bg-green-900 border-green-600' : 'bg-red-900 border-red-600'}`}>
        <div className="text-gray-400 text-xs font-mono">Unrealized P&L</div>
        <div className={`text-lg font-mono ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {unrealizedPnl >= 0 ? '+' : ''}₹{unrealizedPnl.toLocaleString()}
        </div>
      </div>
      <div className={`p-3 rounded-lg border flex-1 ${realizedPnl >= 0 ? 'bg-green-900 border-green-600' : 'bg-red-900 border-red-600'}`}>
        <div className="text-gray-400 text-xs font-mono">Realized P&L</div>
        <div className={`text-lg font-mono ${realizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {realizedPnl >= 0 ? '+' : ''}₹{realizedPnl.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

// Positions Tab
const PositionsTab = ({ portfolio, onExitAll, onExitPosition }) => {
  const positions = portfolio?.positions || [];

  const totalUnrealized = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
  const totalRealized = portfolio?.realizedPnl || 0;
  const netPnl = totalUnrealized + totalRealized;

  return (
    <div className="positions-tab">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-lg font-mono">Positions</h3>
        <button
          onClick={onExitAll}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-mono text-sm"
        >
          Exit All
        </button>
      </div>

      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm font-mono">
          <thead className="bg-gray-800">
            <tr className="text-gray-400 border-b border-gray-600">
              <th className="px-3 py-2 text-left">Instrument</th>
              <th className="px-3 py-2 text-left">Direction</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Avg Price</th>
              <th className="px-3 py-2 text-right">LTP</th>
              <th className="px-3 py-2 text-right">P&L</th>
              <th className="px-3 py-2 text-right">P&L%</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, index) => {
              const pnlPercent = pos.avgPrice ? ((pos.unrealizedPnl || 0) / (pos.avgPrice * pos.quantity)) * 100 : 0;
              return (
                <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                  <td className="px-3 py-2 text-white">{pos.symbol}</td>
                  <td className="px-3 py-2 text-white">{pos.direction}</td>
                  <td className="px-3 py-2 text-right text-white">{pos.quantity}</td>
                  <td className="px-3 py-2 text-right text-white">₹{pos.avgPrice?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-white">₹{pos.currentPrice?.toFixed(2) || "-"}</td>
                  <td className={`px-3 py-2 text-right font-bold ${(pos.unrealizedPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}₹{(pos.unrealizedPnl || 0).toFixed(2)}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onExitPosition(pos)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs font-mono"
                    >
                      Exit
                    </button>
                  </td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr className="bg-gray-800 border-t-2 border-gray-600">
              <td className="px-3 py-2 text-white font-bold" colSpan="5">TOTAL</td>
              <td className={`px-3 py-2 text-right font-bold ${netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {netPnl >= 0 ? '+' : ''}₹{netPnl.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right text-gray-400" colSpan="2">
                Unrealized: ₹{totalUnrealized.toFixed(2)} | Realized: ₹{totalRealized.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Orders Tab
const OrdersTab = ({ orders, onCancelOrder }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-600 text-yellow-100';
      case 'FILLED': return 'bg-green-600 text-green-100';
      case 'CANCELLED': return 'bg-gray-600 text-gray-100';
      case 'REJECTED': return 'bg-red-600 text-red-100';
      default: return 'bg-gray-600 text-gray-100';
    }
  };

  return (
    <div className="orders-tab">
      <h3 className="text-white text-lg font-mono mb-4">Orders</h3>

      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm font-mono">
          <thead className="bg-gray-800">
            <tr className="text-gray-400 border-b border-gray-600">
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Instrument</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Direction</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => (
              <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                <td className="px-3 py-2 text-white">{order.timestamp ? new Date(order.timestamp).toLocaleTimeString() : "-"}</td>
                <td className="px-3 py-2 text-white">{order.symbol}</td>
                <td className="px-3 py-2 text-white">{order.orderType}</td>
                <td className="px-3 py-2 text-white">{order.direction}</td>
                <td className="px-3 py-2 text-right text-white">{order.quantity}</td>
                <td className="px-3 py-2 text-right text-white">
                  {order.orderType === 'MARKET' ? 'MKT' : `₹${order.fillPrice?.toFixed(2) || order.price?.toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-mono ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {order.status === 'PENDING' && (
                    <button
                      onClick={() => onCancelOrder(order.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-mono"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Trade Log Tab
const TradeLogTab = ({ portfolio }) => {
  const tradeLog = portfolio?.tradeLog || []; // Assume tradeLog is in portfolio

  const totalTrades = tradeLog.length;
  const winningTrades = tradeLog.filter(trade => trade.pnl > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const bestTrade = tradeLog.length > 0 ? Math.max(...tradeLog.map(t => t.pnl)) : 0;
  const worstTrade = tradeLog.length > 0 ? Math.min(...tradeLog.map(t => t.pnl)) : 0;
  const totalPnl = tradeLog.reduce((sum, trade) => sum + trade.pnl, 0);

  const exportCSV = () => {
    const headers = ['Entry Time', 'Exit Time', 'Instrument', 'Direction', 'Qty', 'Entry Price', 'Exit Price', 'P&L', 'Duration'];
    const rows = tradeLog.map(trade => [
      trade.entryTime,
      trade.exitTime,
      trade.symbol,
      trade.direction,
      trade.quantity,
      trade.entryPrice,
      trade.exitPrice,
      trade.pnl,
      "-"
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trade_log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="trade-log-tab">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white text-lg font-mono">Trade Log</h3>
        <button
          onClick={exportCSV}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-mono text-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm font-mono">
          <thead className="bg-gray-800">
            <tr className="text-gray-400 border-b border-gray-600">
              <th className="px-3 py-2 text-left">Entry Time</th>
              <th className="px-3 py-2 text-left">Exit Time</th>
              <th className="px-3 py-2 text-left">Instrument</th>
              <th className="px-3 py-2 text-left">Direction</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Entry Price</th>
              <th className="px-3 py-2 text-right">Exit Price</th>
              <th className="px-3 py-2 text-right">P&L</th>
              <th className="px-3 py-2 text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {tradeLog.map((trade, index) => (
              <tr key={index} className="border-b border-gray-700 hover:bg-gray-800">
                <td className="px-3 py-2 text-white">{trade.entryTime ? new Date(trade.entryTime).toLocaleTimeString() : "-"}</td>
                <td className="px-3 py-2 text-white">{trade.exitTime ? new Date(trade.exitTime).toLocaleTimeString() : "-"}</td>
                <td className="px-3 py-2 text-white">{trade.symbol}</td>
                <td className="px-3 py-2 text-white">{trade.direction}</td>
                <td className="px-3 py-2 text-right text-white">{trade.quantity}</td>
                <td className="px-3 py-2 text-right text-white">₹{trade.entryPrice?.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-white">₹{trade.exitPrice?.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.pnl >= 0 ? '+' : ''}₹{trade.pnl.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-white">-</td>
              </tr>
            ))}
            {/* Summary Row */}
            <tr className="bg-gray-800 border-t-2 border-gray-600">
              <td className="px-3 py-2 text-white font-bold" colSpan="7">SUMMARY</td>
              <td className={`px-3 py-2 text-right font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right text-gray-400" colSpan="1">
                {totalTrades} trades | {winRate.toFixed(1)}% win rate
              </td>
            </tr>
            <tr className="bg-gray-800">
              <td className="px-3 py-2 text-gray-400 text-xs" colSpan="9">
                Best: ₹{bestTrade.toFixed(2)} | Worst: ₹{worstTrade.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PortfolioPanel = ({ portfolio, orders, onCancelOrder, onExitAll, onExitPosition }) => {
  const [activeTab, setActiveTab] = useState('POSITIONS');

  const tabs = [
    { id: 'POSITIONS', label: 'Positions' },
    { id: 'ORDERS', label: 'Orders' },
    { id: 'TRADE_LOG', label: 'Trade Log' }
  ];

  return (
    <div className="portfolio-panel bg-gray-900 p-4 rounded-lg h-full flex flex-col">
      <PortfolioTopbar portfolio={portfolio} />

      {/* Tabs */}
      <div className="flex mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 mr-2 rounded font-mono text-sm ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'POSITIONS' && (
          <PositionsTab portfolio={portfolio} onExitAll={onExitAll} onExitPosition={onExitPosition} />
        )}
        {activeTab === 'ORDERS' && (
          <OrdersTab orders={orders} onCancelOrder={onCancelOrder} />
        )}
        {activeTab === 'TRADE_LOG' && (
          <TradeLogTab portfolio={portfolio} />
        )}
      </div>
    </div>
  );
};

export default PortfolioPanel;