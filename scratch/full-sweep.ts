import { TUNING_SET } from '../scripts/evaluate-risk-engine';
import stringSimilarity from 'string-similarity';

const thresholds = [0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60];
console.log("Threshold | TP | FN | FP | TN | Recall | FPR");
console.log("-------------------------------------------------");

thresholds.forEach(sim => {
  let TP=0, FP=0, TN=0, FN=0;
  for (const tc of TUNING_SET) {
    let isFlagged = false;
    
    if (tc.expectedReason === 'NONCE_REUSED' || tc.expectedReason === 'MANDATE_EXPIRED' || tc.expectedReason === 'SIGNATURE_INVALID') {
      isFlagged = true;
    } else {
      const actTotal = tc.fulfillment.actual_amount * (tc.fulfillment.quantity || 1);
      const authTotal = tc.mandate.authorized_amount * (tc.mandate.quantity || 1);
      
      if (tc.mandate.quantity !== tc.fulfillment.quantity) isFlagged = true;
      else if (actTotal > authTotal * 1.02 || actTotal < authTotal * 0.98) isFlagged = true;
      else if (stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku) < sim) isFlagged = true;
    }
    
    const isFraud = tc.expected === 'REJECT';
    if (isFraud && isFlagged) TP++;
    else if (!isFraud && isFlagged) FP++;
    else if (!isFraud && !isFlagged) TN++;
    else if (isFraud && !isFlagged) FN++;
  }
  
  const recall = TP / (TP + FN);
  const fpr = FP / (FP + TN);
  console.log(`${sim.toFixed(2)}      | ${TP} | ${FN}  | ${FP}  | ${TN} | ${(recall*100).toFixed(1)}% | ${(fpr*100).toFixed(1)}%`);
});
