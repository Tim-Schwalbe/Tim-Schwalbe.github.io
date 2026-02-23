// REMOVED IMPORT: simulatePortfolio from ./simulator.js
// DEPENDENCIES: window.simulatePortfolio

/**
 * Find the Safe Withdrawal Rate using Bisection Search.
 * @param {number} targetOdds - Target success probability (e.g., 0.95)
 * @param {object} marketData - Pre-generated market paths
 * @param {object} configs - Simulation configurations
 * @returns {number} - Optimized SWR as a decimal
 */
window.findSWR = async function (targetOdds, marketData, configs) {
    let low = 0.001;
    let high = 0.30;
    let best = 0.001;

    // V6 Fix: Dynamic Safety Margin based on Allocation Volatility
    // Users with high-vol assets (Crypto) need larger margins for Monte Carlo stability.
    // Scale: 0.5% (Stocks/Bonds) -> 4.0% (100% Crypto)
    const allocC = Config.getConfig(configs, 'ALLOC_CRYPTO', 0); // 0-100
    const baseMargin = 0.005;
    const cryptoMarginAdder = (allocC / 100) * 0.035; // Adds up to 3.5%
    const safetyMargin = baseMargin + cryptoMarginAdder;

    // Cap at reasonable max (e.g., don't require > 99.9%)
    const requiredSuccess = Math.min(0.999, targetOdds + safetyMargin);

    for (let i = 0; i < 25; i++) {
        if (i > 0 && i % 5 === 0 && typeof setTimeout !== 'undefined') await new Promise(r => setTimeout(r, 0));
        let mid = (low + high) / 2;
        let res = window.simulatePortfolio(mid, marketData, { ...configs, SILENT: true });
        const actualSuccess = res.successRate;

        // Use dynamic safety margin
        if (actualSuccess >= requiredSuccess) {
            best = mid;
            low = mid;
        } else {
            high = mid;
        }

        if (high - low < 0.0001) break;
    }
    return best;
}
