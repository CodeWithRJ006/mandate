import crypto from 'crypto';
import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment, nonceStore } from '../lib/uap-logic';
import { POLICY_CONFIG } from '../lib/config';

export type ExpectedOutcome = "APPROVE" | "REJECT";
export type RejectReason = 
  | "AMOUNT_EXCEEDED" 
  | "SKU_MISMATCH" 
  | "QUANTITY_MISMATCH" 
  | "MANDATE_EXPIRED" 
  | "NONCE_REUSED" 
  | "SIGNATURE_INVALID" 
  | null;

export interface TestCase {
  id: string;
  category: string;
  description: string;
  mandate: {
    sku: string;
    quantity: number;
    authorized_amount: number;
    nonce: string;
    expiry: number;
    signature: string;
    publicKeyPem: string;
  };
  fulfillment: {
    sku: string;
    quantity: number;
    actual_amount: number;
  };
  expected: ExpectedOutcome;
  expectedReason: RejectReason;
}

const keys = generateAgentKeyPair();
const now = Date.now();
const FUTURE = now + 24 * 60 * 60 * 1000;
const PAST = now - 60 * 1000;

function createSignedMandate(overrides: Record<string, unknown> = {}) {
  const payload = {
    sku: "Organic Apples",
    quantity: 1,
    authorized_amount: 2000,
    ...overrides,
  };
  const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
  return {
    ...augmentedPayload,
    signature,
    publicKeyPem: keys.publicKey,
  } as any;
}

// 45 Test Cases Across 8 Categories
export const DATASET: TestCase[] = [
  // 1. Clean Match (8 cases)
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `clean-${i + 1}`,
    category: "clean_match",
    description: "Exact match between authorized mandate and merchant fulfillment",
    mandate: createSignedMandate({ authorized_amount: 1000 + i * 200 }),
    fulfillment: { sku: "Organic Apples", quantity: 1, actual_amount: 1000 + i * 200 },
    expected: "APPROVE" as const,
    expectedReason: null,
  })),

  // 2. Legitimate SKU Naming Variance (8 cases)
  ...[
    ["IPHONE-15-PRO", "IPHONE15-PRO-BLK"],
    ["Organic Apples", "Organic Apples (1kg)"],
    ["Red T-Shirt L", "Red Tshirt Large"],
    ["USB-C Cable 1m", "USB C Cable, 1 Meter"],
    ["Notebook A5", "A5 Notebook"],
    ["Wireless Mouse", "Wireless  Mouse"],
    ["Coffee 250g", "Coffee - 250g Pack"],
    ["Bluetooth Speaker", "BT Speaker 5.0"],
  ].map(([mSku, fSku], i) => ({
    id: `variance-${i + 1}`,
    category: "legit_sku_variance",
    description: `Semantic naming variance: "${mSku}" vs "${fSku}"`,
    mandate: createSignedMandate({ sku: mSku, authorized_amount: 800 }),
    fulfillment: { sku: fSku, quantity: 1, actual_amount: 800 },
    expected: "APPROVE" as const,
    expectedReason: null,
  })),

  // 3. Boundary Cases at Threshold (6 cases)
  ...[
    { pct: 0.005, exp: "APPROVE", reason: null },
    { pct: 0.015, exp: "APPROVE", reason: null },
    { pct: 0.019, exp: "APPROVE", reason: null },
    { pct: 0.021, exp: "REJECT", reason: "AMOUNT_EXCEEDED" },
    { pct: 0.025, exp: "REJECT", reason: "AMOUNT_EXCEEDED" },
    { pct: 0.030, exp: "REJECT", reason: "AMOUNT_EXCEEDED" },
  ].map((b, i) => {
    const auth = 2000;
    const actual = Math.round(auth * (1 + b.pct));
    return {
      id: `boundary-${i + 1}`,
      category: "boundary_threshold",
      description: `Boundary check: ${(b.pct * 100).toFixed(1)}% overage`,
      mandate: createSignedMandate({ authorized_amount: auth }),
      fulfillment: { sku: "Organic Apples", quantity: 1, actual_amount: actual },
      expected: b.exp as ExpectedOutcome,
      expectedReason: b.reason as RejectReason,
    };
  }),

  // 4. Fee Padding Beyond Tolerance (8 cases)
  ...Array.from({ length: 8 }, (_, i) => {
    const auth = 1000 + i * 250;
    const actual = Math.round(auth * (1.04 + i * 0.015)); // 4% to 14.5% over
    return {
      id: `padding-${i + 1}`,
      category: "fee_padding",
      description: `Unauthorized fee padding: ${((actual / auth - 1) * 100).toFixed(1)}% overage`,
      mandate: createSignedMandate({ authorized_amount: auth }),
      fulfillment: { sku: "Organic Apples", quantity: 1, actual_amount: actual },
      expected: "REJECT" as const,
      expectedReason: "AMOUNT_EXCEEDED" as const,
    };
  }),

  // 5. SKU Substitution / Numeric Version Downgrade (8 cases)
  ...[
    ["Organic Apples", "Bananas Cavendish"],
    ["iPhone 15 Pro", "iPhone 13 Mini"],
    ["Large Pepperoni Pizza", "Garlic Breadsticks"],
    ["Cotton Crew Shirt", "Polyester Windbreaker"],
    ["Full Cream Milk 1L", "Almond Beverage 200ml"],
    // Hard Version Downgrade Vectors (Added based on strict audit)
    ["iPhone 15 Pro Max", "iPhone 11 Pro Max"],
    ["Samsung Galaxy S24 Ultra", "Samsung Galaxy S21 Ultra"],
    ["MacBook Pro 16-inch", "MacBook Pro 13-inch"]
  ].map((pair, i) => ({
    id: `sku-sub-${i + 1}`,
    category: "sku_substitution",
    description: `Substituted ${pair[0]} with ${pair[1]}`,
    mandate: createSignedMandate({ sku: pair[0], authorized_amount: 800 }),
    fulfillment: { sku: pair[1], quantity: 1, actual_amount: 800 },
    expected: "REJECT" as const,
    expectedReason: "SKU_MISMATCH" as const, // Or SKU_NUMERIC_DOWNGRADE
  })),

  // 6. Quantity Manipulation (4 cases)
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `qty-${i + 1}`,
    category: "quantity_manipulation",
    description: `Unit mismatch: authorized ${1 + i}, fulfilled ${2 + i}`,
    mandate: createSignedMandate({ quantity: 1 + i, authorized_amount: 500 }),
    fulfillment: { sku: "Organic Apples", quantity: 2 + i, actual_amount: 500 },
    expected: "REJECT" as const,
    expectedReason: "QUANTITY_MISMATCH" as const,
  })),

  // 7. Expired Mandate (3 cases)
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `expired-${i + 1}`,
    category: "expired_mandate",
    description: "Fulfillment submitted after mandate TTL has lapsed",
    mandate: createSignedMandate({ expiry: PAST, authorized_amount: 1500 }),
    fulfillment: { sku: "Organic Apples", quantity: 1, actual_amount: 1500 },
    expected: "REJECT" as const,
    expectedReason: "MANDATE_EXPIRED" as const,
  })),

  // 8. Nonce Replay (3 cases)
  ...Array.from({ length: 3 }, (_, i) => {
    const replayNonce = `replayed-nonce-fixture-${i}`;
    return {
      id: `replay-${i + 1}`,
      category: "nonce_replay",
      description: "Pre-consumed cryptographic nonce replayed by merchant",
      mandate: createSignedMandate({ nonce: replayNonce, authorized_amount: 1200 }),
      fulfillment: { sku: "Organic Apples", quantity: 1, actual_amount: 1200 },
      expected: "REJECT" as const,
      expectedReason: "NONCE_REUSED" as const,
    };
  })
];

// Seeded Deterministic Shuffle for 70/30 Split
function seededShuffle<T>(array: T[], seed = 42): T[] {
  const copy = [...array];
  let m = copy.length;
  let s = seed;
  while (m) {
    s = (s * 9301 + 49297) % 233280;
    const i = Math.floor((s / 233280) * m--);
    [copy[m], copy[i]] = [copy[i], copy[m]];
  }
  return copy;
}

// Stratified split: guarantees ~30% of EACH category lands in held-out
function stratifiedSplit(dataset: TestCase[], seed = 42): { tuning: TestCase[]; heldOut: TestCase[] } {
  const byCategory: Record<string, TestCase[]> = {};
  for (const tc of dataset) {
    if (!byCategory[tc.category]) byCategory[tc.category] = [];
    byCategory[tc.category].push(tc);
  }
  const tuning: TestCase[] = [];
  const heldOut: TestCase[] = [];
  for (const cat of Object.keys(byCategory).sort()) {
    const shuffled = seededShuffle(byCategory[cat], seed);
    const holdCount = Math.max(1, Math.round(shuffled.length * 0.30));
    heldOut.push(...shuffled.slice(0, holdCount));
    tuning.push(...shuffled.slice(holdCount));
  }
  return { tuning: seededShuffle(tuning, seed), heldOut: seededShuffle(heldOut, seed) };
}

const { tuning: TUNING_SET_RAW, heldOut: HELD_OUT_SET_RAW } = stratifiedSplit(DATASET);
export const TUNING_SET = TUNING_SET_RAW;
export const HELD_OUT_SET = HELD_OUT_SET_RAW;

export function runEvaluation() {
  // --- 1. TUNING SET SWEEP ---
  const tuningSweep = [];
  const baseTol = POLICY_CONFIG.tolerancePct;
  const baseSim = POLICY_CONFIG.similarityThreshold;
  const tolerances = [baseTol - 0.01, baseTol, baseTol + 0.01, baseTol + 0.02, baseTol + 0.03].filter(t => t > 0);
  const similarities = [baseSim + 0.35, baseSim + 0.30, baseSim + 0.25, baseSim + 0.20, baseSim + 0.15, baseSim + 0.10, baseSim + 0.05, baseSim, baseSim - 0.05, baseSim - 0.10, baseSim - 0.15, baseSim - 0.20].filter(s => s > 0 && s <= 1);

  for (const tol of tolerances) {
    for (const sim of similarities) {
      let TP = 0, FP = 0, TN = 0, FN = 0;
      for (const tc of TUNING_SET) {
        nonceStore.clear();
        if (tc.category === 'nonce_replay') nonceStore.add(tc.mandate.nonce);
        
        let resultStatus = 'APPROVED';
        
        // Extract signature from payload so canonical stringification matches exactly
        const { signature, publicKeyPem, ...pureMandate } = tc.mandate;
        const verifyRes = verifyMandate(pureMandate, tc.mandate.signature, keys.publicKey);
        if (!verifyRes.isValid) {
          resultStatus = 'REJECTED';
        } else {
          const evalRes = evaluateFulfillment(tc.mandate as any, tc.fulfillment as any, { tolerancePct: tol, similarityThreshold: sim });
          resultStatus = evalRes.status;
        }

        const isFraud = tc.expected === 'REJECT';
        const isFlagged = resultStatus === 'REJECTED';

        if (isFraud && isFlagged) TP++;
        else if (!isFraud && isFlagged) FP++;
        else if (!isFraud && !isFlagged) TN++;
        else if (isFraud && !isFlagged) FN++;
      }
      const precision = TP / (TP + FP) || 0;
      const recall = TP / (TP + FN) || 0;
      const f1 = 2 * (precision * recall) / (precision + recall) || 0;
      const fpr = FP / (FP + TN) || 0;
      tuningSweep.push({ tol, sim, TP, FP, TN, FN, precision, recall, f1, fpr });
    }
  }

  // --- 2. HELD OUT SET EVALUATION (Live Baseline) ---
  let TP = 0, FP = 0, TN = 0, FN = 0;
  const results = [];

  for (const tc of HELD_OUT_SET) {
    nonceStore.clear();
    if (tc.category === 'nonce_replay') {
      nonceStore.add(tc.mandate.nonce);
    }
    
    let resultStatus = 'APPROVED';
    let reason = '';

    const { signature, publicKeyPem, ...pureMandate } = tc.mandate;
    const verifyRes = verifyMandate(pureMandate, tc.mandate.signature, keys.publicKey);
    if (!verifyRes.isValid) {
      resultStatus = 'REJECTED';
      reason = verifyRes.reason || 'VERIFY_FAILED';
    } else {
      const evalRes = evaluateFulfillment(pureMandate as any, tc.fulfillment as any, POLICY_CONFIG);
      resultStatus = evalRes.status;
      reason = evalRes.reason || '';
    }

    const isFraud = tc.expected === 'REJECT';
    const isFlagged = resultStatus === 'REJECTED';

    if (isFraud && isFlagged) TP++;
    else if (!isFraud && isFlagged) FP++;
    else if (!isFraud && !isFlagged) TN++;
    else if (isFraud && !isFlagged) FN++;

    results.push({ 
      name: `[${tc.category}] ${tc.description}`, 
      isFraud, 
      isFlagged, 
      reason,
      expectedReason: tc.expectedReason
    });
  }

  const precision = TP / (TP + FP) || 0;
  const recall = TP / (TP + FN) || 0;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;
  const fpr = FP / (FP + TN) || 0;

  return {
    matrix: { TP, FP, TN, FN },
    metrics: { precision, recall, f1, fpr },
    tuningSweep,
    results,
    rawDataset: HELD_OUT_SET
  };
}

// Allow script to execute and log output if run via CLI
if (typeof process !== 'undefined' && process.argv.some(arg => arg.endsWith('evaluate-risk-engine.ts'))) {
  console.log("==================================================");
  console.log("   RAZORPAY UAP - AI RISK MANAGER EVALUATION");
  console.log("==================================================\n");

  const data = runEvaluation();

  console.log(`--- 1. TUNING SET SWEEP RESULTS (${TUNING_SET.length} Cases) ---`);
  console.table(
    data.tuningSweep.map(s => ({
      Tolerance: `${(s.tol * 100).toFixed(0)}%`,
      Similarity: s.sim.toFixed(2),
      "F1 Score": s.f1.toFixed(3),
      Recall: s.recall.toFixed(3),
      FPR: s.fpr.toFixed(3)
    }))
  );

  console.log(`\n--- 2. HELD-OUT TEST SET RESULTS (${HELD_OUT_SET.length} Cases) ---`);
  console.log(`Baseline Evaluated At: Tolerance = ${(POLICY_CONFIG.tolerancePct * 100).toFixed(0)}%, Similarity = ${POLICY_CONFIG.similarityThreshold}\n`);
  
  console.table({
    "True Positives (Blocked)": data.matrix.TP,
    "False Positives (Friction)": data.matrix.FP,
    "True Negatives (Approved)": data.matrix.TN,
    "False Negatives (Liability)": data.matrix.FN
  });

  console.log("\nMetrics:");
  console.log(` Precision : ${(data.metrics.precision * 100).toFixed(1)}%`);
  console.log(` Recall    : ${(data.metrics.recall * 100).toFixed(1)}%`);
  console.log(` F1 Score  : ${(data.metrics.f1 * 100).toFixed(1)}%`);
  console.log(` FPR       : ${(data.metrics.fpr * 100).toFixed(1)}%`);
  console.log("\n==================================================");
}
