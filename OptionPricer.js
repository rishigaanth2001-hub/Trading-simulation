/**
 * OptionPricer - Pure functions for Black-Scholes option pricing and Greeks
 * No external dependencies, all calculations built from scratch
 */

/**
 * Standard normal cumulative distribution function using Hart approximation
 * Accurate to approximately 7 decimal places
 * @param {number} x - Input value
 * @returns {number} - CDF value between 0 and 1
 */
export function normalCDF(x) {
  // Hart approximation coefficients
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  return 0.5 * (1.0 + sign * y);
}

/**
 * Standard normal probability density function
 * @param {number} x - Input value
 * @returns {number} - PDF value
 */
export function normalPDF(x) {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-(x * x) / 2.0);
}

/**
 * Black-Scholes option pricing model with Greeks
 * @param {object} params
 * @param {number} params.spot - Current spot price
 * @param {number} params.strike - Strike price
 * @param {number} params.timeToExpiryYears - Time to expiry in years
 * @param {number} params.riskFreeRate - Risk-free rate (default 0.065 = 6.5%)
 * @param {number} params.iv - Implied volatility as decimal (e.g., 0.20 = 20%)
 * @param {string} params.optionType - 'call' or 'put'
 * @returns {object} - { price, delta, gamma, theta, vega, rho }
 */
export function blackScholes(params) {
  const { spot, strike, timeToExpiryYears, riskFreeRate = 0.065, iv, optionType } = params;

  // Handle expired options (intrinsic value only)
  if (timeToExpiryYears <= 0) {
    if (optionType === 'call') {
      const intrinsic = Math.max(spot - strike, 0);
      return {
        price: intrinsic,
        delta: intrinsic > 0 ? 1 : 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
      };
    } else {
      const intrinsic = Math.max(strike - spot, 0);
      return {
        price: intrinsic,
        delta: intrinsic > 0 ? -1 : 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
      };
    }
  }

  const T = timeToExpiryYears;
  const S = spot;
  const K = strike;
  const r = riskFreeRate;
  const sigma = iv;
  const sqrtT = Math.sqrt(T);

  // Calculate d1 and d2
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const Nmd1 = normalCDF(-d1); // CDF(-d1)
  const Nmd2 = normalCDF(-d2); // CDF(-d2)
  const phid1 = normalPDF(d1); // PDF(d1)

  const discountFactor = Math.exp(-r * T);

  let price, delta, theta;

  if (optionType === 'call') {
    // Call price: C = S*N(d1) - K*e^(-r*T)*N(d2)
    price = S * Nd1 - K * discountFactor * Nd2;

    // Delta: ∂C/∂S = N(d1)
    delta = Nd1;

    // Theta (annualized, then divide by 365 for daily)
    // θ = -S*φ(d1)*σ/(2*√T) - r*K*e^(-r*T)*N(d2)
    theta = (-S * phid1 * sigma) / (2 * sqrtT) - r * K * discountFactor * Nd2;
    theta = theta / 365; // Convert to daily theta
  } else {
    // Put price: P = K*e^(-r*T)*N(-d2) - S*N(-d1)
    price = K * discountFactor * Nmd2 - S * Nmd1;

    // Delta: ∂P/∂S = N(d1) - 1
    delta = Nd1 - 1;

    // Theta (annualized, then divide by 365 for daily)
    // θ = -S*φ(d1)*σ/(2*√T) + r*K*e^(-r*T)*N(-d2)
    theta = (-S * phid1 * sigma) / (2 * sqrtT) + r * K * discountFactor * Nmd2;
    theta = theta / 365; // Convert to daily theta
  }

  // Gamma (same for call and put): ∂²C/∂S² = φ(d1) / (S*σ*√T)
  const gamma = phid1 / (S * sigma * sqrtT);

  // Vega (same for call and put): per 1% change in IV
  // V = S*φ(d1)*√T / 100
  const vega = (S * phid1 * sqrtT) / 100;

  // Rho: per 1% change in interest rate
  let rho;
  if (optionType === 'call') {
    // ρ_call = K*T*e^(-r*T)*N(d2) / 100
    rho = (K * T * discountFactor * Nd2) / 100;
  } else {
    // ρ_put = -K*T*e^(-r*T)*N(-d2) / 100
    rho = (-K * T * discountFactor * Nmd2) / 100;
  }

  return {
    price: price,
    delta: delta,
    gamma: gamma,
    theta: theta,
    vega: vega,
    rho: rho
  };
}

/**
 * Implied Volatility using Newton-Raphson iteration
 * Solves for IV given market price
 * @param {object} params
 * @param {number} params.spot - Current spot price
 * @param {number} params.strike - Strike price
 * @param {number} params.timeToExpiryYears - Time to expiry in years
 * @param {number} params.marketPrice - Market price of the option
 * @param {string} params.optionType - 'call' or 'put'
 * @param {number} params.initialGuess - Initial IV guess (default 0.20 = 20%)
 * @param {number} params.tolerance - Convergence tolerance (default 1e-6)
 * @param {number} params.maxIterations - Max iterations (default 50)
 * @returns {number} - Implied volatility as decimal (e.g., 0.15 = 15%)
 */
export function impliedVol(params) {
  const {
    spot,
    strike,
    timeToExpiryYears,
    marketPrice,
    optionType,
    initialGuess = 0.20,
    tolerance = 1e-6,
    maxIterations = 50
  } = params;

  let iv = initialGuess;
  const riskFreeRate = 0.065; // Standard 6.5%

  for (let i = 0; i < maxIterations; i++) {
    // Calculate BS price and vega at current IV
    const greeks = blackScholes({
      spot: spot,
      strike: strike,
      timeToExpiryYears: timeToExpiryYears,
      riskFreeRate: riskFreeRate,
      iv: iv,
      optionType: optionType
    });

    const bsPrice = greeks.price;
    const vega = greeks.vega;

    // Check convergence
    const error = Math.abs(bsPrice - marketPrice);
    if (error < tolerance) {
      return iv;
    }

    // Newton-Raphson: IV_new = IV_old - (BS(IV) - marketPrice) / vega
    // Vega is per 1% change, so multiply by 100 to get price sensitivity
    const vegaSensitivity = vega * 100;

    if (Math.abs(vegaSensitivity) < 1e-10) {
      // Vega too small, can't converge
      console.warn('ImpliedVol: Vega too small for convergence');
      return iv;
    }

    iv = iv - (bsPrice - marketPrice) / vegaSensitivity;

    // Clamp IV to reasonable bounds (0.001 to 3.0 = 0.1% to 300%)
    iv = Math.max(0.001, Math.min(3.0, iv));
  }

  console.warn(`ImpliedVol: Did not converge after ${maxIterations} iterations`);
  return iv;
}
