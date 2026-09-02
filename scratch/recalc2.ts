import { TUNING_SET } from '../scripts/evaluate-risk-engine';
import stringSimilarity from 'string-similarity';

[0.90, 0.85, 0.80, 0.75].forEach(sim => {
  let FP=0, TN=0;
  for (const tc of TUNING_SET) {
    if (tc.expected === 'REJECT') continue;
    let isFlagged = false;
    const actTotal = tc.fulfillment.actual_amount * (tc.fulfillment.quantity || 1);
    const authTotal = tc.mandate.authorized_amount * (tc.mandate.quantity || 1);
    
    if (tc.mandate.quantity !== tc.fulfillment.quantity) isFlagged = true;
    else if (actTotal > authTotal * 1.02 || actTotal < authTotal * 0.98) isFlagged = true;
    else if (stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku) < sim) isFlagged = true;
    
    if (isFlagged) FP++;
    else TN++;
  }
  console.log(`Sim: ${sim}, FP: ${FP}, TN: ${TN}, FPR: ${(FP/(FP+TN)*100).toFixed(1)}%`);
});
