import React, { useMemo, useState, useEffect } from 'react';
import { loadDayHistory } from '../utils/persistence.js';

const HistoryPanel = ({ onLoadSession }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadDayHistory());
  }, []);

  const sortedHistory = useMemo(() => [...history].sort((a, b) => new Date(b.date) - new Date(a.date)), [history]);

  const stats = useMemo(() => {
    const totalDays = sortedHistory.length;
    const wins = sortedHistory.filter(item => item.totalPnl > 0).length;
    const totalPnl = sortedHistory.reduce((sum, item) => sum + (item.totalPnl || 0), 0);
    const avgPnl = totalDays > 0 ? totalPnl / totalDays : 0;
    const bestDay = totalDays > 0 ? Math.max(...sortedHistory.map(item => item.totalPnl || 0)) : 0;
    const worstDay = totalDays > 0 ? Math.min(...sortedHistory.map(item => item.totalPnl || 0)) : 0;

    return {
      totalDays,
      winRate: totalDays > 0 ? (wins / totalDays) * 100 : 0,
      avgPnl,
      bestDay,
      worstDay
    };
  }, [sortedHistory]);

  const handleRowClick = (entry) => {
    onLoadSession?.(entry);
  };

  return (
    <div className="panel history-panel-content">
      <div className="panel-header">
        <h3>History</h3>
        <div className="panel-info">Last {sortedHistory.length} days</div>
      </div>
      <div className="panel-content p-0 overflow-hidden">
        <div className="history-summary bg-[#10131a] border-b border-[#2a2d33] p-3 text-xs text-gray-300 font-mono">
          <div className="flex flex-wrap gap-4">
            <span>Win Rate: {stats.winRate.toFixed(1)}%</span>
            <span>Avg Daily P&L: ₹{stats.avgPnl.toFixed(2)}</span>
            <span>Best Day: ₹{stats.bestDay.toFixed(2)}</span>
            <span>Worst Day: ₹{stats.worstDay.toFixed(2)}</span>
          </div>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full text-sm font-mono text-gray-200">
            <thead className="bg-[#161a21] sticky top-0">
              <tr className="text-gray-400 uppercase text-[10px] tracking-[0.08em]">
                <th className="px-3 py-2 text-left">Seed/Date</th>
                <th className="px-3 py-2 text-left">Strategy</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">Win Rate</th>
                <th className="px-3 py-2 text-right">P&L</th>
                <th className="px-3 py-2 text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              {sortedHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-6 text-center text-gray-500">No simulated days found.</td>
                </tr>
              ) : (
                sortedHistory.map((entry, index) => (
                  <tr
                    key={`${entry.seed}-${entry.date}-${index}`}
                    className="cursor-pointer border-t border-[#2a2d33] hover:bg-[#1e2230]"
                    onClick={() => handleRowClick(entry)}
                  >
                    <td className="px-3 py-2 text-white">{entry.seed} / {new Date(entry.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-gray-200">{entry.strategy || 'Manual'}</td>
                    <td className="px-3 py-2 text-right">{entry.trades ?? '-'}</td>
                    <td className="px-3 py-2 text-right">{entry.winRate?.toFixed(1) ?? '-'}%</td>
                    <td className={`px-3 py-2 text-right ${entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.totalPnl >= 0 ? '+' : ''}₹{entry.totalPnl?.toFixed(2) ?? '0.00'}
                    </td>
                    <td className="px-3 py-2 text-center">{entry.totalPnl >= 0 ? 'Win' : 'Loss'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
