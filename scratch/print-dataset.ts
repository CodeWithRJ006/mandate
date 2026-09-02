import { DATASET } from '../scripts/evaluate-risk-engine';
console.table(DATASET.filter(c => c.category === 'fee_padding').map(c => ({
  desc: c.description, expected: c.expected
})));
