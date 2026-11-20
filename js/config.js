// Shared rules and numbers in one place, so a calculation never carries its own private copy.
// Changing a value here changes it everywhere it is used.

// Investments: the selling fee assumed for a breakeven price when a token has no trades of its own to learn it from (0.1%),
// and the highest fee rate ever learned from trades (5%), so one odd entry cannot distort a breakeven.
export const DEFAULT_SELL_FEE = 0.001;
export const MAX_LEARNED_FEE = 0.05;

// Investments: the graph ranges, label and number of days (0 = everything).
export const INV_RANGES = [['1M', 30], ['3M', 91], ['1Y', 365], ['All', 0]];
