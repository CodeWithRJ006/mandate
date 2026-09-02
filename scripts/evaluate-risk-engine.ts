import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment, nonceStore } from '../lib/uap-logic';

export function runEvaluation() {
  // Clear the in-memory nonce cache to ensure clean tests on each run
  nonceStore.clear();

  const keys = generateAgentKeyPair();
  const baseMandate = { sku: 'Organic Apples', authorized_amount: 2000, quantity: 1 };

  // 1. Valid (TN)
  const validSign = signMandate(baseMandate, keys.privateKey);
  
  // 2. Tampered Signature (TP)
  const tamperedSign = signMandate(baseMandate, keys.privateKey);
  const tamperedPayload = { ...tamperedSign.augmentedPayload, authorized_amount: 5000 };
  
  // 3. Nonce Reuse (TP)
  const reuseSign = signMandate(baseMandate, keys.privateKey);
  nonceStore.add(reuseSign.augmentedPayload.nonce); // Inject nonce manually to simulate replay

  // 4. Quantity Mismatch (TP)
  const qtySign = signMandate(baseMandate, keys.privateKey);

  // 5. Amount Exceeded (TP)
  const amtSign = signMandate(baseMandate, keys.privateKey);

  // 6. SKU Mismatch (TP)
  const skuSign = signMandate(baseMandate, keys.privateKey);

  const testCases = [
    {
      name: 'Valid Happy Path',
      isFraud: false,
      mandate: validSign.augmentedPayload,
      signature: validSign.signature,
      fulfillment: { sku: 'Organic Apples', actual_amount: 2000, quantity: 1 }
    },
    {
      name: 'Tampered Signature Payload',
      isFraud: true,
      mandate: tamperedPayload,
      signature: tamperedSign.signature,
      fulfillment: { sku: 'Organic Apples', actual_amount: 5000, quantity: 1 }
    },
    {
      name: 'Replay Attack (Nonce Reuse)',
      isFraud: true,
      mandate: reuseSign.augmentedPayload,
      signature: reuseSign.signature,
      fulfillment: { sku: 'Organic Apples', actual_amount: 2000, quantity: 1 }
    },
    {
      name: 'Quantity Mismatch',
      isFraud: true,
      mandate: qtySign.augmentedPayload,
      signature: qtySign.signature,
      fulfillment: { sku: 'Organic Apples', actual_amount: 2000, quantity: 2 }
    },
    {
      name: 'Amount Exceeded (Padding)',
      isFraud: true,
      mandate: amtSign.augmentedPayload,
      signature: amtSign.signature,
      fulfillment: { sku: 'Organic Apples', actual_amount: 2150, quantity: 1 }
    },
    {
      name: 'SKU Semantic Mismatch',
      isFraud: true,
      mandate: skuSign.augmentedPayload,
      signature: skuSign.signature,
      fulfillment: { sku: 'Organic Bananas', actual_amount: 2000, quantity: 1 }
    }
  ];

  let TP = 0, FP = 0, TN = 0, FN = 0;
  const results = [];

  for (const tc of testCases) {
    let resultStatus = 'APPROVED';
    let reason = '';

    const verifyRes = verifyMandate(tc.mandate, tc.signature, keys.publicKey);
    if (!verifyRes.isValid) {
      resultStatus = 'REJECTED';
      reason = verifyRes.reason || 'VERIFY_FAILED';
    } else {
      const evalRes = evaluateFulfillment(tc.mandate, tc.fulfillment);
      resultStatus = evalRes.status;
      reason = evalRes.reason || '';
    }

    const isFlagged = resultStatus === 'REJECTED';

    if (tc.isFraud && isFlagged) TP++;
    else if (!tc.isFraud && isFlagged) FP++;
    else if (!tc.isFraud && !isFlagged) TN++;
    else if (tc.isFraud && !isFlagged) FN++;

    results.push({ name: tc.name, isFraud: tc.isFraud, isFlagged, reason });
  }

  const precision = TP / (TP + FP) || 0;
  const recall = TP / (TP + FN) || 0;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;
  const fpr = FP / (FP + TN) || 0;

  return {
    matrix: { TP, FP, TN, FN },
    metrics: { precision, recall, f1, fpr },
    results
  };
}
