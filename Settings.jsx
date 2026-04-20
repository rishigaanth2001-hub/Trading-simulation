import React, { useState } from 'react';

const Settings = ({
  resetPortfolioOnNewDay = true,
  brokerage = 20,
  defaultSpeed = 1,
  onChange,
  onClearAll
}) => {
  const [resetEachDay, setResetEachDay] = useState(resetPortfolioOnNewDay);
  const [brokerageRate, setBrokerageRate] = useState(brokerage);
  const [speed, setSpeed] = useState(defaultSpeed);

  const handleClearAll = () => {
    const confirmed = window.confirm('Clear all simulation data and history? This cannot be undone.');
    if (!confirmed) return;
    localStorage.removeItem('niftysim_session');
    localStorage.removeItem('niftysim_history');
    onClearAll?.();
  };

  const handleOptionChange = (field, value) => {
    if (field === 'resetEachDay') setResetEachDay(value);
    if (field === 'brokerageRate') setBrokerageRate(value);
    if (field === 'speed') setSpeed(value);
    onChange?.({
      resetPortfolioOnNewDay: field === 'resetEachDay' ? value : resetEachDay,
      brokerage: field === 'brokerageRate' ? value : brokerageRate,
      defaultSpeed: field === 'speed' ? value : speed,
      carryForward: field === 'resetEachDay' ? !value : !resetEachDay
    });
  };

  return (
    <div className="panel settings-panel-content">
      <div className="panel-header">
        <h3>Settings</h3>
        <div className="panel-info">Persistence · risk controls · defaults</div>
      </div>
      <div className="panel-content space-y-5">
        <div className="setting-group">
          <div className="text-gray-400 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Portfolio Behavior</div>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleOptionChange('resetEachDay', true)}
              className={`rounded-2xl px-4 py-2 text-sm font-mono ${resetEachDay ? 'bg-amber-400 text-black' : 'bg-[#11141b] text-gray-200 border border-[#333]'}`}
            >
              Reset Each Day
            </button>
            <button
              type="button"
              onClick={() => handleOptionChange('resetEachDay', false)}
              className={`rounded-2xl px-4 py-2 text-sm font-mono ${!resetEachDay ? 'bg-amber-400 text-black' : 'bg-[#11141b] text-gray-200 border border-[#333]'}`}
            >
              Carry Forward
            </button>
          </div>
        </div>

        <div className="setting-group">
          <div className="text-gray-400 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Brokerage Simulation</div>
          <div className="flex gap-3 flex-wrap">
            {[0, 20, 40].map(value => (
              <button
                key={value}
                type="button"
                onClick={() => handleOptionChange('brokerageRate', value)}
                className={`rounded-2xl px-4 py-2 text-sm font-mono ${brokerageRate === value ? 'bg-amber-400 text-black' : 'bg-[#11141b] text-gray-200 border border-[#333]'}`}
              >
                {value === 0 ? 'Zero' : `₹${value}/trade`}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-group">
          <div className="text-gray-400 text-xs uppercase tracking-[0.2em] mb-2 font-mono">Default Speed</div>
          <div className="flex gap-3 flex-wrap">
            {[1, 10, 60, 390].map(value => (
              <button
                key={value}
                type="button"
                onClick={() => handleOptionChange('speed', value)}
                className={`rounded-2xl px-4 py-2 text-sm font-mono ${speed === value ? 'bg-amber-400 text-black' : 'bg-[#11141b] text-gray-200 border border-[#333]'}`}
              >
                {value}x
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[#2a2d33] pt-4">
          <button
            type="button"
            onClick={handleClearAll}
            className="w-full rounded-2xl px-4 py-3 text-sm font-mono bg-red-600 text-white hover:bg-red-500"
          >
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
