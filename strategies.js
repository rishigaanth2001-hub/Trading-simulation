export const PREBUILT_STRATEGIES = [
  {
    name: 'SHORT_STRADDLE',
    displayName: 'Short Straddle',
    description: 'Sell ATM CE + Sell ATM PE at 09:20 and exit at 15:15 or when combined premium moves against you by 50%.',
    entryRules: [
      { label: 'Sell ATM CE + ATM PE at 09:20', type: 'TIME', value: '09:20' }
    ],
    exitRules: [
      { label: 'Exit all legs at 15:15', type: 'TIME', value: '15:15' },
      { label: 'Exit when combined premium increases by 50%', type: 'PREMIUM_CHANGE', threshold: 0.5 }
    ],
    riskParams: {
      lotSize: 65,
      maxLossPct: 0.5,
      targetProfitPct: 0.5,
      entryCount: 1
    }
  },
  {
    name: 'LONG_STRANGLE',
    displayName: 'Long Strangle',
    description: 'Buy OTM CE + OTM PE 200 pts from ATM when IV is below 12%, exit at 30% profit or 50% loss.',
    entryRules: [
      { label: 'Buy OTM CE and PE 200 points away when IV < 12%', type: 'IV', threshold: 0.12 }
    ],
    exitRules: [
      { label: 'Exit if premium profit reaches 30%', type: 'PROFIT_TARGET', threshold: 0.30 },
      { label: 'Exit if premium loss reaches 50%', type: 'LOSS_LIMIT', threshold: 0.50 }
    ],
    riskParams: {
      lotSize: 65,
      optionDistance: 200,
      maxLossPct: 0.5,
      targetProfitPct: 0.3
    }
  },
  {
    name: 'TREND_FOLLOW',
    displayName: 'Trend Follow',
    description: 'Buy ATM CE if Nifty rises more than 0.3% in the first 30 minutes and stays above the 09:15 open, hold until 15:15.',
    entryRules: [
      { label: 'Buy ATM CE after first 30 minutes if up > 0.3% from 09:15 open', type: 'TREND', threshold: 0.003 }
    ],
    exitRules: [
      { label: 'Exit at 15:15', type: 'TIME', value: '15:15' }
    ],
    riskParams: {
      lotSize: 65,
      thresholdPct: 0.003
    }
  },
  {
    name: 'SCALP_NIFTY_FUT',
    displayName: 'Scalp Nifty Future',
    description: 'Buy futures when price breaks above the 5-minute high, exit at +15 pts or -10 pts stop loss.',
    entryRules: [
      { label: 'Buy Nifty futures on breakout above 5-min high', type: 'BREAKOUT', windowMinutes: 5 }
    ],
    exitRules: [
      { label: 'Exit at +15 pts profit', type: 'POINT_TARGET', threshold: 15 },
      { label: 'Exit at -10 pts stop loss', type: 'POINT_LIMIT', threshold: 10 }
    ],
    riskParams: {
      lotSize: 65,
      profitTarget: 15,
      stopLoss: 10,
      lookbackMinutes: 5
    }
  },
  {
    name: 'BULL_CALL_SPREAD',
    displayName: 'Bull Call Spread',
    description: 'Buy ATM CE and sell OTM+100 CE, hold the spread until expiry.',
    entryRules: [
      { label: 'Buy ATM CE and sell OTM+100 CE at market open', type: 'TIME', value: '09:20' }
    ],
    exitRules: [
      { label: 'Hold until expiry', type: 'EXPIRY' }
    ],
    riskParams: {
      lotSize: 65,
      spreadWidth: 100
    }
  }
];
