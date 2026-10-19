import assert from 'node:assert/strict';
import { forecastSeries, backtestSeries, predictWithMethod } from '../js/forecasting.js';

assert.equal(predictWithMethod([10, 20, 30], 'mean-3'), 20);
assert.equal(predictWithMethod([0, 0, 30], 'median-3'), 0);
assert.equal(predictWithMethod([10, 20, 30], 'weighted-3'), 23);
assert.equal(predictWithMethod(Array.from({ length: 12 }, (_, i) => i + 1), 'seasonal-naive'), 1);
const steady = forecastSeries([100, 100, 100, 100, 100, 100]);
assert.equal(steady.value, 100);
assert.equal(steady.mae, 0);
assert.ok(steady.backtestCount >= 3);
const empty = forecastSeries([]);
assert.equal(empty.value, 0);
assert.equal(empty.dataCoverage, 'insufficient');
const tests = backtestSeries([100, 120, 110, 130, 125, 140]);
assert.ok(tests.some((x) => x.method === 'mean-3' && x.n >= 3));
console.log('Forecasting unit tests passed.');
