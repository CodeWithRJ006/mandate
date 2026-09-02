import { TUNING_SET, HELD_OUT_SET } from '../scripts/evaluate-risk-engine';

const iphone = TUNING_SET.find(t => t.mandate.sku === 'iPhone 15 Pro') || HELD_OUT_SET.find(t => t.mandate.sku === 'iPhone 15 Pro');
if (iphone) {
  console.log("Found in:", TUNING_SET.includes(iphone) ? "TUNING" : "HELD-OUT");
  console.log("Auth Amount:", iphone.mandate.authorized_amount);
  console.log("Actual Amount:", iphone.fulfillment.actual_amount);
}
