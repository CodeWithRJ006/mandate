import { TUNING_SET } from '../scripts/evaluate-risk-engine';
import stringSimilarity from 'string-similarity';

function evalSet(sim: number) {
  let TP=0, FP=0, TN=0, FN=0;
  for (const tc of TUNING_SET) {
    let isFlagged = false;
    if (tc.expectedReason === 'NONCE_REUSED' || tc.expectedReason === 'MANDATE_EXPIRED' || tc.expectedReason === 'SIGNATURE_INVALID') {
      isFlagged = true;
    } else {
      const authTotal = tc.mandate.authorized_amount * (tc.mandate.quantity || 1);
      const actTotal = tc.fulfillment.actual_amount * (tc.fulfillment.quantity || 1);
      const t = 0.02;
      
      if (tc.mandate.quantity !== tc.fulfillment.quantity) isFlagged = true;
      else if (actTotal > authTotal * (1+t) || actTotal < authTotal * (1-t)) isFlagged = true;
      else if (stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku) < sim) isFlagged = true;
    }

    const isFraud = tc.expected === 'REJECT';
    if (isFraud && isFlagged) TP++;
    else if (!isFraud && isFlagged) FP++;
    else if (!isFraud && !isFlagged) TN++;
    else if (isFraud && !isFlagged) FN++;
  }
  const fpr = FP / (FP + TN);
  console.log(`Sim: ${sim}, FP: ${FP}, TN: ${TN}, FPR: ${(fpr*100).toFixed(1)}%`);
}

evalSet(0.85);
evalSet(0.80);
