import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const StrategyPanel = ({
  strategies = [],
  selectedStrategyName: selectedNameProp,
  onSelectStrategy,
  onToggleStrategy,
  strategyLogs = [],
  performanceData = []
}) => {
  const [selectedStrategyName, setSelectedStrategyName] = useState(selectedNameProp || strategies[0]?.name || '');

  const selectedStrategy = useMemo(
    () => strategies.find(s => s.name === (selectedNameProp || selectedStrategyName)) || strategies[0] || null,
    [strategies, selectedNameProp, selectedStrategyName]
  );

  const handleSelection = (event) => {
    const name = event.target.value;
    setSelectedStrategyName(name);
    onSelectStrategy?.(name);
  };

  const toggleAuto = () => {
    if (!selectedStrategy) return;
    onToggleStrategy?.(selectedStrategy.name, !selectedStrategy.enabled);
  };

  const displayLog = strategyLogs.filter(log => log.strategyName === selectedStrategy?.name);

  return (
    <div className="strategy-panel bg-gray-900 p-4 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white text-lg font-mono">Strategy Runner</h3>
          <p className="text-gray-400 text-sm">Auto-execute rules and monitor strategy performance.</p>
        </div>
        <button
          onClick={toggleAuto}
          className={`px-4 py-2 rounded font-mono text-sm ${selectedStrategy?.enabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}
        >
          {selectedStrategy?.enabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      <div className="flex items-center mb-4 space-x-3">
        <select
          value={selectedStrategy?.name || ''}
          onChange={handleSelection}
          className="bg-gray-800 text-white px-3 py-2 rounded font-mono flex-1"
        >
          {strategies.map(strategy => (
            <option key={strategy.name} value={strategy.name}>{strategy.displayName || strategy.name}</option>
          ))}
        </select>
      </div>

      {selectedStrategy && (
        <div className="mb-4 text-sm text-gray-300 font-mono">
          <div className="mb-2 text-white font-semibold">{selectedStrategy.displayName}</div>
          <div className="mb-3 text-gray-400">{selectedStrategy.description}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Entry Rules</div>
              <ul className="list-disc list-inside space-y-1">
                {selectedStrategy.entryRules.map((rule, index) => (
                  <li key={`entry-${index}`} className="text-gray-200">{rule.label}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Exit Rules</div>
              <ul className="list-disc list-inside space-y-1">
                {selectedStrategy.exitRules.map((rule, index) => (
                  <li key={`exit-${index}`} className="text-gray-200">{rule.label}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 p-3 rounded-lg mb-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm uppercase tracking-wider">P&L Performance</span>
          <span className="text-gray-300 text-xs">Last {performanceData.length} ticks</span>
        </div>
        {performanceData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={performanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#999', fontSize: 10 }} />
              <YAxis tick={{ fill: '#999', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
              <Line type="monotone" dataKey="pnl" stroke="#00d4aa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-500 text-xs h-44 flex items-center justify-center">No strategy performance data available yet.</div>
        )}
      </div>

      <div className="bg-gray-800 p-3 rounded-lg max-h-72 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 uppercase text-[10px] tracking-wider">Live Trade Log</span>
          <span className="text-gray-500 text-xs">{displayLog.length} entries</span>
        </div>
        {displayLog.length > 0 ? (
          <table className="w-full text-xs font-mono text-gray-200">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 text-left">Time</th>
                <th className="py-2 text-left">Action</th>
                <th className="py-2 text-left">Instrument</th>
                <th className="py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {displayLog.map((entry, index) => (
                <tr key={index} className="border-b border-gray-700 hover:bg-gray-900">
                  <td className="py-2 text-gray-300">{entry.time}</td>
                  <td className="py-2 text-gray-200">{entry.action}</td>
                  <td className="py-2 text-gray-200">{entry.symbol}{entry.strike ? ` ${entry.strike}${entry.optionType || ''}` : ''}</td>
                  <td className="py-2 text-right text-gray-200">₹{entry.price?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500 text-xs">Strategy log is empty. Enable auto-execution to track orders.</div>
        )}
      </div>
    </div>
  );
};

export default StrategyPanel;
