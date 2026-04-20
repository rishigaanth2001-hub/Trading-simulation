# NiftySim Portal

A comprehensive trading simulation platform for Nifty 50 options and futures, built with React + Vite.

## Features

### 🎯 Core Simulation Engine
- **Realistic Price Generation**: GBM + GARCH(1,1) volatility modeling
- **Market Regimes**: TRENDING_UP, TRENDING_DOWN, CHOPPY, HIGH_VOL, FLASH_CRASH
- **Correlated Assets**: 15 FNO stocks with beta-weighted correlation
- **Options Pricing**: Black-Scholes with Greeks, realistic IV surfaces
- **Intraday Patterns**: Time-of-day volatility multipliers

### 📊 Trading Interface
- **Live Dashboard**: Dark terminal aesthetic with real-time updates
- **Order Management**: MARKET, LIMIT, SL_MARKET, SL_LIMIT orders
- **Portfolio Tracking**: P&L, margin utilization, trade history
- **Speed Control**: 1x to 390x simulation speed
- **Option Chains**: Real-time strikes with Greeks and OI

### 🛠 Technical Architecture
- **Engine Classes**: Modular simulation components
- **React Integration**: Custom hooks for state management
- **Performance**: Optimized updates, throttled calculations
- **Persistence**: localStorage for portfolio data

## Project Structure

```
src/
├── components/
│   └── Dashboard.jsx          # Main layout component
├── engine/                    # Simulation core
│   ├── SimulationClock.js     # Master orchestrator
│   ├── RegimeController.js    # Market regime transitions
│   ├── SpotGenerator.js       # Nifty price generation
│   ├── FuturesGenerator.js    # Futures pricing
│   ├── StockGenerator.js      # Stock price correlation
│   ├── OptionPricer.js        # Black-Scholes calculations
│   ├── VolatilitySurface.js   # IV surface modeling
│   ├── OptionChainGenerator.js # Option chain creation
│   ├── OrderBook.js           # Order management
│   └── Portfolio.js           # P&L and position tracking
├── hooks/
│   └── useSimulation.js       # React bridge hook
└── data/
    └── marketConstants.js     # Market data and constants
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages
npm run build && npm run preview
```

## Configuration

The simulation can be configured via the `useSimulation` hook:

```javascript
const simulation = useSimulation({
  seed: 20260419,        // Random seed for reproducibility
  speed: 60,             // Simulation speed multiplier
  daysToExpiry: 7,       // Days to options expiry
  baseNiftyPrice: 24200, // Starting Nifty price
  initialCapital: 500000 // Starting capital (₹)
});
```

## Trading Features

### Order Types
- **MARKET**: Execute immediately at current price ± slippage
- **LIMIT**: Execute when price reaches specified level
- **SL_MARKET**: Stop-loss with market execution on trigger
- **SL_LIMIT**: Stop-loss with limit execution on trigger

### Instruments
- **NIFTY_SPOT**: Nifty 50 cash index
- **NIFTY_FUT**: Nifty futures contracts
- **NIFTY_OPT**: Nifty options (CE/PE)
- **STOCK**: Individual FNO stocks
- **STOCK_OPT**: Stock options

### Risk Management
- **Margin Requirements**: Options (premium), Futures (10% of value)
- **Position Limits**: Lot size validation
- **P&L Tracking**: Realized and unrealized gains/losses

## Simulation Realism

### Price Dynamics
- **Geometric Brownian Motion**: Drift + volatility components
- **GARCH(1,1) Volatility**: Conditional heteroskedasticity
- **Regime Shifts**: Market condition transitions
- **Intraday Patterns**: Opening/closing volatility spikes

### Options Modeling
- **Black-Scholes Pricing**: European options with Greeks
- **Volatility Surface**: Smile, skew, and term structure
- **IV Dynamics**: Mean-reverting with regime shocks
- **Synthetic OI/Volume**: Realistic market depth

## Development

### Adding New Features
1. Extend engine classes in `/src/engine/`
2. Update `useSimulation` hook for new state
3. Add UI components in `/src/components/`
4. Update Dashboard layout as needed

### Performance Considerations
- Option chain updates throttled to every 5 ticks
- Candle history limited to 390 entries
- Efficient React re-renders with proper state management

## License

MIT License - Free for educational and personal use.

## Disclaimer

This is a simulation tool for educational purposes only. Not intended for actual trading decisions. Past performance does not guarantee future results.
