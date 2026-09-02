import { runEvaluation } from '../scripts/evaluate-risk-engine';
const { results } = runEvaluation();
console.table(results.map(r => ({ name: r.name, flagged: r.isFlagged, fraud: r.isFraud, reason: r.reason })));
