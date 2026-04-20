import React, { useState, useEffect, useCallback } from 'react';
import { loadSession, saveSession, clearSession } from './utils/persistence.js';
import SimulationSetup from './components/SimulationSetup.jsx';
import Dashboard from './components/Dashboard.jsx';
import DaySummary from './components/DaySummary.jsx';
import { useSimulation } from './hooks/useSimulation.js';

const SimulationHost = ({ config, onMarketClose }) => {
  const simulation = useSimulation({ ...config, onMarketClose });
  const { start } = simulation;
  const [isReady, setIsReady] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady && !autoStarted) {
      start();
      setAutoStarted(true);
    }
  }, [isReady, autoStarted, start]);

  if (!isReady) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 text-white">
        <div className="flex flex-col items-center gap-4 px-6 py-8 rounded-3xl bg-slate-950/95 shadow-2xl border border-slate-700">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-400 border-t-transparent" />
          <div className="text-lg font-mono">Initializing simulation engine…</div>
        </div>
      </div>
    );
  }

  return <Dashboard {...simulation} />;
};

function App() {
  const [setupVisible, setSetupVisible] = useState(true);
  const [sessionConfig, setSessionConfig] = useState(null);
  const [daySummary, setDaySummary] = useState(null);

  useEffect(() => {
    const stored = loadSession();
    if (stored?.config) {
      setSessionConfig(stored.config);
      setSetupVisible(false);
    }
  }, []);

  const handleStart = useCallback((config) => {
    saveSession({ config, startedAt: Date.now() });
    setSessionConfig(config);
    setSetupVisible(false);
    setDaySummary(null);
  }, []);

  const handleCloseSetup = useCallback(() => {
    if (sessionConfig) {
      setSetupVisible(false);
    }
  }, [sessionConfig]);

  const handleSessionEnd = useCallback((summary) => {
    setDaySummary(summary);
  }, []);

  const handleTradeAgain = useCallback(() => {
    clearSession();
    setSessionConfig(null);
    setDaySummary(null);
    setSetupVisible(true);
  }, []);

  const handleReviewTrades = useCallback(() => {
    setDaySummary(null);
  }, []);

  return (
    <>
      {setupVisible && (
        <SimulationSetup onStart={handleStart} onClose={handleCloseSetup} />
      )}

      {sessionConfig && (
        <SimulationHost config={sessionConfig} onMarketClose={handleSessionEnd} />
      )}

      {daySummary && (
        <DaySummary
          summary={daySummary}
          onTradeAgain={handleTradeAgain}
          onReviewTrades={handleReviewTrades}
          onClose={handleReviewTrades}
        />
      )}
    </>
  );
}

export default App;
