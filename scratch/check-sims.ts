import { DATASET } from '../scripts/evaluate-risk-engine';
import stringSimilarity from 'string-similarity';

console.log("--- LEGIT SKU VARIANCE (Negative Class / Approve) ---");
for (const tc of DATASET) {
  if (tc.category === 'legit_sku_variance') {
    const sim = stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku);
    console.log(`${sim.toFixed(3)} | ${tc.mandate.sku} -> ${tc.fulfillment.sku}`);
  }
}

console.log("\n--- SKU SUBSTITUTION (Positive Class / Reject) ---");
for (const tc of DATASET) {
  if (tc.category === 'sku_substitution') {
    const sim = stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku);
    console.log(`${sim.toFixed(3)} | ${tc.mandate.sku} -> ${tc.fulfillment.sku}`);
  }
}
