import crypto from 'crypto';
import stringSimilarity from 'string-similarity';
import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment, nonceStore } from '../lib/uap-logic';

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

  // 5. SKU Substitution (5 cases)
  ...[
    ["Organic Apples", "Bananas Cavendish"],
    ["iPhone 15 Pro", "iPhone 13 Mini"],
    ["Large Pepperoni Pizza", "Garlic Breadsticks"],
    ["Cotton Crew Shirt", "Polyester Windbreaker"],
    ["Full Cream Milk 1L", "Almond Beverage 200ml"],
  ].map(([mSku, fSku], i) => ({
    id: `sku-sub-${i + 1}`,
    category: "sku_substitution",
    description: `Product substitution: "${mSku}" -> "${fSku}"`,
    mandate: createSignedMandate({ sku: mSku, authorized_amount: 500 }),
    fulfillment: { sku: fSku, quantity: 1, actual_amount: 500 },
    expected: "REJECT" as const,
    expectedReason: "SKU_MISMATCH" as const,
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

const shuffled = seededShuffle(DATASET);
const splitIdx = Math.floor(DATASET.length * 0.70); // 31 tuning, 14 held-out
export const TUNING_SET = shuffled.slice(0, splitIdx);
export const HELD_OUT_SET = shuffled.slice(splitIdx);

export function runEvaluation() {
  let TP = 0, FP = 0, TN = 0, FN = 0;
  const results = [];

  // Strictly execute on the held-out 30% partition
  for (const tc of HELD_OUT_SET) {
    nonceStore.clear(); // Isolate state between tests
    
    // Inject replay nonce manually to simulate the true rejection path
    if (tc.category === 'nonce_replay') {
      nonceStore.add(tc.mandate.nonce);
    }
    
    let resultStatus = 'APPROVED';
    let reason = '';

    const verifyRes = verifyMandate(tc.mandate, tc.mandate.signature, keys.publicKey);
    if (!verifyRes.isValid) {
      resultStatus = 'REJECTED';
      reason = verifyRes.reason || 'VERIFY_FAILED';
    } else {
      const evalRes = evaluateFulfillment(tc.mandate as any, tc.fulfillment as any);
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
    results
  };
}
