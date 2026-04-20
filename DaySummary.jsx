import React from 'react';

const colorClass = (value) => {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-200';
};

const DaySummary = ({ summary, onTradeAgain, onReviewTrades, onClose }) => {
  if (!summary) return null;

  const { totalPnl, dailyStats, dayRange, regime, strategyPerformance = [] } = summary;
  const strategySummary = strategyPerformance.filter((item) => item.enabled);
  const strategyEnabled = strategySummary.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-slate-950 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-8 py-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-300 text-xs uppercase tracking-[0.3em] font-semibold">Day Summary</p>
              <h2 className="text-white text-3xl font-semibold mt-2">Market close review</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-8 bg-slate-950">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-gray-400 text-sm uppercase tracking-[0.2em] mb-3">Total P&L</p>
            <div className={`text-5xl font-semibold font-mono ${colorClass(totalPnl)}`}>
              {totalPnl >= 0 ? '₹' : '-₹'}{Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-gray-400 mt-3">Realized and unrealized P&L across today's positions.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div>
              <p className="text-gray-400 uppercase tracking-[0.2em] text-xs">Trades</p>
              <p className="text-white text-2xl font-semibold">{dailyStats.tradesCount}</p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-[0.2em] text-xs">Win Rate</p>
              <p className="text-white text-2xl font-semibold">{dailyStats.winRate.toFixed(1)}%</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
                <p className="text-gray-400 uppercase tracking-[0.2em] text-xs">Best trade</p>
                <p className="text-white text-xl font-semibold">₹{dailyStats.bestTrade.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
                <p className="text-gray-400 uppercase tracking-[0.2em] text-xs">Worst trade</p>
                <p className="text-white text-xl font-semibold">₹{dailyStats.worstTrade.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-950">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-gray-400 uppercase tracking-[0.2em] text-xs mb-3">Nifty range</p>
            <div className="text-white text-2xl font-semibold">₹{dayRange.high.toFixed(2)} - ₹{dayRange.low.toFixed(2)}</div>
            <p className="text-gray-400 mt-3 text-sm">Range: ₹{(dayRange.high - dayRange.low).toFixed(2)}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-gray-400 uppercase tracking-[0.2em] text-xs mb-3">Dominant regime</p>
            <div className="text-white text-2xl font-semibold">{regime}</div>
            <p className="text-gray-400 mt-3 text-sm">Market behavior recorded during the session.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-gray-400 uppercase tracking-[0.2em] text-xs mb-3">Strategy performance</p>
            {strategyEnabled ? (
              strategySummary.map((strategy) => (
                <div key={strategy.name} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">{strategy.displayName || strategy.name}</span>
                    <span className="text-amber-300 text-sm">{strategy.trades} trades</span>
                  </div>
                  <p className="text-gray-400 text-sm">{strategy.hasTraded ? 'Activated' : 'No trades'}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No auto strategy was enabled today.</p>
            )}
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-900 border-t border-slate-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-gray-400 text-sm">Review the session outcome or continue trading with a new setup.</div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onReviewTrades}
              className="rounded-2xl px-6 py-3 text-sm font-mono text-amber-300 border border-amber-500 hover:bg-amber-500/10"
            >
              Review Trades
            </button>
            <button
              onClick={onTradeAgain}
              className="rounded-2xl px-6 py-3 text-sm font-mono bg-amber-400 text-black font-semibold hover:bg-amber-300"
            >
              Trade Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DaySummary;
