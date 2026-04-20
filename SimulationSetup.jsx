import React, { useMemo, useState } from 'react';
import { PREBUILT_STRATEGIES } from '../data/strategies.js';

const scenarioOptions = [
  { value: 'AUTO', label: 'Auto (seed-driven)' },
  { value: 'BULL_DAY', label: 'Bull Day' },
  { value: 'BEAR_DAY', label: 'Bear Day' },
  { value: 'VOLATILE_DAY', label: 'Volatile Day' },
  { value: 'EXPIRY_DAY', label: 'Expiry Day' }
];

const capitalOptions = [
  { value: 100000, label: '₹1L' },
  { value: 200000, label: '₹2L' },
  { value: 500000, label: '₹5L' },
  { value: 1000000, label: '₹10L' }
];

const speedOptions = [
  { value: 1, label: '1x' },
  { value: 10, label: '10x' },
  { value: 60, label: '60x' },
  { value: 390, label: '390x' }
];

const daysToExpiryOptions = [1, 2, 3, 4, 7, 14, 30];

const SimulationSetup = ({ onStart, onClose }) => {
  const todaySeed = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return Number(`${year}${month}${day}`);
  }, []);

  const [seed, setSeed] = useState(todaySeed);
  const [startingPrice, setStartingPrice] = useState(23500);
  const [daysToExpiry, setDaysToExpiry] = useState(7);
  const [capital, setCapital] = useState(500000);
  const [customCapital, setCustomCapital] = useState('');
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState('AUTO');
  const [selectedStrategy, setSelectedStrategy] = useState('MANUAL_ONLY');
  const [carryForward, setCarryForward] = useState(false);

  const strategyOptions = useMemo(() => [
    { value: 'MANUAL_ONLY', label: 'Manual Only' },
    ...PREBUILT_STRATEGIES.map(strategy => ({ value: strategy.name, label: strategy.displayName || strategy.name }))
  ], []);

  const seedSummary = useMemo(() => {
    if (!seed) return 'No seed entered';
    const scenarioLabel = scenarioOptions.find(option => option.value === scenario)?.label || 'Auto';
    const trend = scenario === 'BULL_DAY' ? 'strong uptrend' : scenario === 'BEAR_DAY' ? 'mild downtrend' : scenario === 'VOLATILE_DAY' ? 'high volatility' : scenario === 'EXPIRY_DAY' ? 'expiry pressure' : 'moderate volatility';
    return `Seed ${seed} → ${trend}, ${scenarioLabel.toLowerCase()} expected.`;
  }, [seed, scenario]);

  const handleStart = () => {
    const capitalValue = Number(customCapital) > 0 ? Number(customCapital) : capital;
    onStart?.({
      seed,
      startingPrice,
      daysToExpiry,
      initialCapital: capitalValue,
      speed,
      scenario,
      strategy: selectedStrategy === 'MANUAL_ONLY' ? null : selectedStrategy,
      carryForward
    });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-[#07080c] border border-[#443e1b] shadow-2xl shadow-amber-500/20 rounded-3xl overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          <div className="lg:w-1/2 bg-[#0d1016] p-8 space-y-6">
            <div>
              <p className="text-amber-300 uppercase tracking-[0.2em] text-xs mb-2">Simulation Setup</p>
              <h2 className="text-white text-3xl font-semibold">Launch Your Trading Day</h2>
              <p className="text-gray-400 mt-3">Configure the market seed, capital, scenario, and strategy before the first tick.</p>
            </div>

            <div className="space-y-5">
              <label className="block text-gray-300 text-sm">Day Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="w-full bg-[#11141b] border border-[#333] rounded-xl px-4 py-3 text-white font-mono"
              />
            </div>

            <div className="space-y-5">
              <label className="block text-gray-300 text-sm">Starting Nifty Price</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="20000"
                  max="27000"
                  step="50"
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-amber-300 font-mono">₹{startingPrice}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-gray-300 text-sm">Days to Expiry</label>
                <select
                  value={daysToExpiry}
                  onChange={(e) => setDaysToExpiry(Number(e.target.value))}
                  className="w-full bg-[#11141b] border border-[#333] rounded-xl px-4 py-3 text-white font-mono"
                >
                  {daysToExpiryOptions.map(day => (
                    <option key={day} value={day}>{day} day{day > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-300 text-sm">Market Scenario Override</label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full bg-[#11141b] border border-[#333] rounded-xl px-4 py-3 text-white font-mono"
                >
                  {scenarioOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-gray-300 text-sm">Enable Strategy</label>
              <select
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="w-full bg-[#11141b] border border-[#333] rounded-xl px-4 py-3 text-white font-mono"
              >
                {strategyOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-gray-300 text-sm">Portfolio</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCarryForward(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-mono transition-colors ${
                    !carryForward ? 'bg-amber-500 text-black' : 'bg-[#11141b] text-gray-300 border border-[#333]'
                  }`}
                >
                  Fresh Start
                </button>
                <button
                  type="button"
                  onClick={() => setCarryForward(true)}
                  className={`rounded-xl px-4 py-3 text-sm font-mono transition-colors ${
                    carryForward ? 'bg-amber-500 text-black' : 'bg-[#11141b] text-gray-300 border border-[#333]'
                  }`}
                >
                  Carry Forward
                </button>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                {carryForward ? 'Restore positions from previous session' : 'Start with fresh portfolio'}
              </p>
            </div>
          </div>

          <div className="lg:w-1/2 bg-[#090b11] p-8 border-l border-[#443e1b]">
            <div className="space-y-6">
              <div className="rounded-3xl bg-[#111418] border border-[#2e2b1a] p-5">
                <p className="text-gray-400 uppercase tracking-[0.2em] text-xs mb-3">Starting Capital</p>
                <div className="grid grid-cols-2 gap-3">
                  {capitalOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setCapital(option.value); setCustomCapital(''); }}
                      className={`rounded-2xl px-4 py-3 text-sm font-mono ${capital === option.value ? 'bg-amber-500 text-black' : 'bg-[#11141b] text-gray-200 border border-[#333]'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    placeholder="Custom"
                    value={customCapital}
                    onChange={(e) => setCustomCapital(e.target.value)}
                    className="rounded-2xl bg-[#11141b] border border-[#333] px-4 py-3 text-white font-mono"
                  />
                </div>
              </div>

              <div className="rounded-3xl bg-[#111418] border border-[#2e2b1a] p-5">
                <p className="text-gray-400 uppercase tracking-[0.2em] text-xs mb-3">Simulation Speed</p>
                <div className="grid grid-cols-4 gap-3">
                  {speedOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSpeed(option.value)}
                      className={`rounded-2xl px-3 py-3 text-sm font-mono ${speed === option.value ? 'bg-amber-500 text-black' : 'bg-[#11141b] text-gray-200 border border-[#333]'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-[#111418] border border-[#2e2b1a] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 uppercase tracking-[0.2em] text-xs">Day Preview</p>
                    <h3 className="text-white text-xl font-semibold">What the market may look like</h3>
                  </div>
                  <span className="text-amber-300 font-bold font-mono">{scenario}</span>
                </div>
                <p className="text-gray-300 leading-6">{seedSummary}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-300">
                  <div className="rounded-2xl bg-[#0e1118] p-4 border border-[#222]">
                    <p className="text-gray-400 uppercase text-[10px] tracking-[0.2em] mb-2">Seed repeatability</p>
                    <p>Same seed always generates the same market day.</p>
                  </div>
                  <div className="rounded-2xl bg-[#0e1118] p-4 border border-[#222]">
                    <p className="text-gray-400 uppercase text-[10px] tracking-[0.2em] mb-2">Strategy mode</p>
                    <p>{selectedStrategy === 'MANUAL_ONLY' ? 'Manual only trading' : `Auto strategy: ${selectedStrategy}`}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#090b11] border-t border-[#443e1b] p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-gray-400 text-sm font-mono">Review your configuration and start the simulation with a controlled setup.</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={onClose}
              className="rounded-2xl px-6 py-3 text-sm font-mono text-gray-300 bg-[#11141b] border border-[#333] hover:bg-[#1b1f29]"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              className="rounded-2xl px-6 py-3 text-sm font-mono bg-amber-400 text-black font-semibold shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:bg-amber-300"
            >
              START SIMULATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationSetup;
