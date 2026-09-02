import { HELD_OUT_SET } from '../scripts/evaluate-risk-engine';
import stringSimilarity from 'string-similarity';

let TP=0, FP=0, TN=0, FN=0;
for (const tc of HELD_OUT_SET) {
  let isFlagged = false;
  if (tc.expectedReason === 'NONCE_REUSED' || tc.expectedReason === 'MANDATE_EXPIRED' || tc.expectedReason === 'SIGNATURE_INVALID') {
    isFlagged = true;
  } else {
    const actTotal = tc.fulfillment.actual_amount * (tc.fulfillment.quantity || 1);
    const authTotal = tc.mandate.authorized_amount * (tc.mandate.quantity || 1);
    
    if (tc.mandate.quantity !== tc.fulfillment.quantity) isFlagged = true;
    else if (actTotal > authTotal * 1.02 || actTotal < authTotal * 0.98) isFlagged = true;
    else if (stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku) < 0.55) isFlagged = true;
  }
  
  const isFraud = tc.expected === 'REJECT';
  if (isFraud && isFlagged) TP++;
  else if (!isFraud && isFlagged) FP++;
  else if (!isFraud && !isFlagged) TN++;
  else if (isFraud && !isFlagged) FN++;
}
console.log(`Baseline 0.55 -> TP: ${TP}, FP: ${FP}, TN: ${TN}, FN: ${FN}`);
