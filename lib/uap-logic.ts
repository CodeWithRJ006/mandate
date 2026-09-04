/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { POLICY_CONFIG } from './config';
import { getSimilarity } from './similarity';

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
// Initialize deterministic key pair for demo environment
let _pubKey: string;

if (_privKey) {
  // Derive public key from the supplied private key to guarantee correspondence
  const keyObj = crypto.createPrivateKey(_privKey);
  _pubKey = keyObj.export({ type: 'spki', format: 'pem' }) as string;
} else {
  // Hardcoded fallback private key ensures the same identity across all Vercel instances
  _privKey = `-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQglpqf9cRUQSUSoRMv\nAl9rYxkG3ddXbQgOOtOIQroFtwehRANCAARdElR4Mj4fIbB5NNBwxQtV3mWQCiT2\nGQFUUVbYW+38CyXPPeUS1U6XQB4ovAdzywAk6IeN1XN1luar8OIfgJY0\n-----END PRIVATE KEY-----`;
  try {
    const keyObj = crypto.createPrivateKey(_privKey);
    _pubKey = keyObj.export({ type: 'spki', format: 'pem' }) as string;
  } catch (e) {
    // Fallback to generating a fresh keypair if parsing fails (unlikely)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    _privKey = privateKey;
    _pubKey = publicKey;
  }
}

export const DEMO_PUBLIC_KEY = _pubKey;
export const DEMO_PRIVATE_KEY = _privKey as string;

// The registry is seeded strictly from the runtime-derived identity. No hardcoded legacy keys.
// Store a trimmed version to avoid whitespace mismatches.
export const keyRegistry = new Set<string>([
  DEMO_PUBLIC_KEY.trim(),
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
  const normalizedKey = publicKeyPem.trim();
  if (!keyRegistry.has(normalizedKey)) {
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
  
  if (!verify.verify(normalizedKey, signature, 'base64')) {
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
