import { TUNING_SET, HELD_OUT_SET } from '../scripts/evaluate-risk-engine';
import stringSimilarity from 'string-similarity';

function getMetrics(set: any[], thresh: number) {
  let FP=0, TN=0;
  set.forEach(tc => {
    if(tc.expected === 'REJECT') return;
    let flagged = false;
    if(tc.expectedReason === 'NONCE_REUSED' || tc.expectedReason === 'MANDATE_EXPIRED' || tc.expectedReason === 'SIGNATURE_INVALID') flagged = true;
    else {
      const act = tc.fulfillment.actual_amount * (tc.fulfillment.quantity || 1);
      const auth = tc.mandate.authorized_amount * (tc.mandate.quantity || 1);
      if(tc.mandate.quantity !== tc.fulfillment.quantity) flagged = true;
      else if(act > auth * 1.02 || act < auth * 0.98) flagged = true;
      else if(tc.mandate.sku && tc.fulfillment.sku && stringSimilarity.compareTwoStrings(tc.mandate.sku, tc.fulfillment.sku) < thresh) flagged = true;
    }
    if(flagged) FP++;
    else TN++;
  });
  return FP / (FP + TN);
}
console.log('Tuning FPR:', getMetrics(TUNING_SET, 0.60));
console.log('Held-Out FPR:', getMetrics(HELD_OUT_SET, 0.60));
