/**
 * Market Constants - Updated for April 2026
 */

export const NIFTY_LOT_SIZE = 65; // Revised effective Jan 2026
export const NIFTY_TICK_SIZE = 0.05;

export const MARKET_OPEN = { hour: 9, minute: 15 };
export const MARKET_CLOSE = { hour: 15, minute: 30 };
export const TRADING_SECONDS = 22500; // (6h 15m)

export const FNO_STOCKS = [
  { symbol: 'RELIANCE', beta: 0.85, basePrice: 2900, lotSize: 250, tickSize: 0.05 },
  { symbol: 'HDFCBANK', beta: 0.90, basePrice: 1700, lotSize: 550, tickSize: 0.05 },
  { symbol: 'INFY', beta: 1.10, basePrice: 1800, lotSize: 400, tickSize: 0.05 },
  { symbol: 'TATAMOTORS', beta: 1.25, basePrice: 950, lotSize: 1425, tickSize: 0.05 },
  { symbol: 'ICICIBANK', beta: 0.95, basePrice: 1350, lotSize: 700, tickSize: 0.05 },
  { symbol: 'SBIN', beta: 1.05, basePrice: 820, lotSize: 1500, tickSize: 0.05 },
  { symbol: 'AXISBANK', beta: 1.00, basePrice: 1360, lotSize: 625, tickSize: 0.05 },
  { symbol: 'WIPRO', beta: 1.05, basePrice: 510, lotSize: 1500, tickSize: 0.05 },
  { symbol: 'KOTAKBANK', beta: 0.88, basePrice: 1950, lotSize: 400, tickSize: 0.05 },
  { symbol: 'BAJFINANCE', beta: 1.15, basePrice: 7600, lotSize: 125, tickSize: 0.05 },
  { symbol: 'MARUTI', beta: 0.80, basePrice: 13200, lotSize: 50, tickSize: 0.05 },
  { symbol: 'LT', beta: 0.90, basePrice: 3850, lotSize: 150, tickSize: 0.05 },
  { symbol: 'NTPC', beta: 0.75, basePrice: 390, lotSize: 2250, tickSize: 0.05 },
  { symbol: 'ONGC', beta: 0.70, basePrice: 280, lotSize: 3850, tickSize: 0.05 },
  { symbol: 'POWERGRID', beta: 0.72, basePrice: 350, lotSize: 3600, tickSize: 0.05 }
];

// NIFTY spot is ~24,200 as of April 2026; strike range covers wide OTM/ITM
export const NIFTY_STRIKES = Array.from(
  { length: (27000 - 21000) / 50 + 1 },
  (_, i) => 21000 + i * 50
);

// Effective Sept 2025: NIFTY Expiry moved to Tuesday
export const WEEKLY_EXPIRY_DAYS = [2]; // Tuesday = 2 in JS Date.getDay()

/**
 * Logic for Monthly Expiry: Last Tuesday of the month
 */
export const getMonthlyExpiry = (year, month) => {
  let lastDay = new Date(year, month + 1, 0); // Last day of month
  while (lastDay.getDay() !== 2) { // 2 = Tuesday
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
};
