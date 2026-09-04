/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { POLICY_CONFIG } from './config';

export interface AgentKeys {
  publicKey: string;
  privateKey: string; // Server-side only. Never forwarded to the client — see app/actions.ts.
}

export const nonceStore = new Set<string>();

// Key Management: Load DEMO_PRIVATE_KEY from environment variables only.
// The matching public key is DERIVED from the private key — never stored separately —
// eliminating any configuration mismatch risk.
// In local dev (no env var), an ephemeral keypair is generated per cold start.
let _privKey = process.env.DEMO_PRIVATE_KEY;
let _pubKey: string;

if (_privKey) {
  // Derive public key from the supplied private key to guarantee correspondence
  const keyObj = crypto.createPrivateKey(_privKey);
  _pubKey = keyObj.export({ type: 'spki', format: 'pem' }) as string;
} else {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  _privKey = privateKey;
  _pubKey = publicKey;
}

export const DEMO_PUBLIC_KEY = _pubKey;
export const DEMO_PRIVATE_KEY = _privKey as string;

// The registry is seeded strictly from the runtime-derived identity. No hardcoded legacy keys.
export const keyRegistry = new Set<string>([
  DEMO_PUBLIC_KEY,
]);

export function generateAgentKeyPair(): AgentKeys {
  // Returns the server-side static identity. The private key is used only for signing
  // inside server actions and is never exposed in API responses to the browser.
  return {
    publicKey: DEMO_PUBLIC_KEY,
    privateKey: DEMO_PRIVATE_KEY,
  };
}

export function deterministicStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(deterministicStringify).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  const res = keys.map((key) => `${JSON.stringify(key)}:${deterministicStringify(obj[key])}`);
  return `{${res.join(',')}}`;
}

export function signMandate(payload: Record<string, any>, privateKeyPem: string): { augmentedPayload: any; signature: string; canonicalString: string } {
  const augmentedPayload = {
    nonce: crypto.randomUUID(),
    expiry: Date.now() + POLICY_CONFIG.mandateTtlMs,
    ...payload,
  };

  const canonicalString = deterministicStringify(augmentedPayload);
  const sign = crypto.createSign('SHA256');
  sign.update(canonicalString);
  sign.end();
  
  const signature = sign.sign(privateKeyPem, 'base64');
  return { augmentedPayload, signature, canonicalString };
}

export interface MandateVerificationResult {
  isValid: boolean;
  reason?: string;
}

export function verifyMandate(payload: Record<string, any>, signature: string, publicKeyPem: string): MandateVerificationResult {
  if (!keyRegistry.has(publicKeyPem)) {
    return { isValid: false, reason: 'UNREGISTERED_PUBLIC_KEY' };
  }

  if (payload.expiry && Date.now() > payload.expiry) {
    return { isValid: false, reason: 'MANDATE_EXPIRED' };
  }
  
  // Only checks if reused. Does NOT consume the nonce. Consumption happens on approval.
  if (nonceStore.has(payload.nonce)) {
    return { isValid: false, reason: 'NONCE_REUSED' };
  }
  
  const payloadString = deterministicStringify(payload);
  const verify = crypto.createVerify('SHA256');
  verify.update(payloadString);
  verify.end();
  
  if (!verify.verify(publicKeyPem, signature, 'base64')) {
    return { isValid: false, reason: 'SIGNATURE_INVALID' };
  }
  
  return { isValid: true };
}

export function consumeNonce(nonce: string): void {
  nonceStore.add(nonce);
}

export interface MandateContext {
  authorized_amount: number;
  sku: string;
  quantity?: number;
  [key: string]: any;
}

export interface FulfillmentContext {
  actual_amount: number;
  sku: string;
  quantity?: number;
  [key: string]: any;
}

export interface EvaluationResult {
  status: 'APPROVED' | 'REJECTED';
  reason?: 'SKU_MISMATCH' | 'AMOUNT_EXCEEDED' | 'QUANTITY_MISMATCH' | 'SKU_NUMERIC_DOWNGRADE' | 'SKU_TIER_DOWNGRADE';
}

export interface PolicyConfig {
  tolerancePct?: number;
  similarityThreshold?: number;
}

export function getSimilarity(s1: string, s2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const norm1 = normalize(s1);
  const norm2 = normalize(s2);
  
  if (norm1 === norm2) return 1;
  if (norm1.length < 2 || norm2.length < 2) return 0;
  
  const bg1 = getBigrams(norm1);
  const bg2 = getBigrams(norm2);
  let intersection = 0;
  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++;
  }
  return (2.0 * intersection) / (bg1.size + bg2.size);
}

export function evaluateFulfillment(
  mandate: MandateContext,
  fulfillment: FulfillmentContext,
  config: PolicyConfig = {}
): EvaluationResult {
  const mandateQty = mandate.quantity ?? 1;
  const fulfillmentQty = fulfillment.quantity ?? 1;
  
  if (mandateQty <= 0 || fulfillmentQty <= 0 || !Number.isInteger(mandateQty) || !Number.isInteger(fulfillmentQty)) {
    return { status: 'REJECTED', reason: 'QUANTITY_MISMATCH' };
  }
  
  if (mandateQty !== fulfillmentQty) {
    return { status: 'REJECTED', reason: 'QUANTITY_MISMATCH' };
  }

  if (
    typeof mandate.authorized_amount !== 'number' || 
    typeof fulfillment.actual_amount !== 'number' ||
    isNaN(mandate.authorized_amount) || 
    isNaN(fulfillment.actual_amount) ||
    mandate.authorized_amount < 0 ||
    fulfillment.actual_amount < 0
  ) {
    return { status: 'REJECTED', reason: 'AMOUNT_EXCEEDED' };
  }

  const auth_total = mandate.authorized_amount * mandateQty;
  const actual_total = fulfillment.actual_amount * fulfillmentQty;

  const tol = config.tolerancePct ?? POLICY_CONFIG.tolerancePct;
  const sim = config.similarityThreshold ?? POLICY_CONFIG.similarityThreshold;

  const maxAllowedAmount = auth_total * (1 + tol);
  if (actual_total > maxAllowedAmount) {
    return { status: 'REJECTED', reason: 'AMOUNT_EXCEEDED' };
  }

  // 3. Numeric Downgrade Guard (Version/Tier protection)
  const extractNumbers = (str: string): string[] => (str.match(/\d+/g) || []);
  const mandateNums = extractNumbers(mandate.sku || "");
  const fulfillmentNums = extractNumbers(fulfillment.sku || "");
  
  const isNumericDowngrade = mandateNums.some(num => !fulfillmentNums.includes(num));
  if (isNumericDowngrade) {
    return { status: 'REJECTED', reason: 'SKU_NUMERIC_DOWNGRADE' };
  }

  // 4. Tier Downgrade Guard
  const tierKeywords = ['pro', 'max', 'ultra', 'plus', 'premium'];
  const mLower = (mandate.sku || "").toLowerCase();
  const fLower = (fulfillment.sku || "").toLowerCase();
  
  const isTierDowngrade = tierKeywords.some(tier => 
    mLower.includes(tier) && !fLower.includes(tier)
  );
  if (isTierDowngrade) {
    return { status: 'REJECTED', reason: 'SKU_TIER_DOWNGRADE' };
  }

  // 5. Native Sørensen-Dice Similarity
  const similarity = getSimilarity(mandate.sku || "", fulfillment.sku || "");

  if (similarity < (config.similarityThreshold ?? sim)) {
    return { status: 'REJECTED', reason: 'SKU_MISMATCH' };
  }

  return { status: 'APPROVED' };
}
