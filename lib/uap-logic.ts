/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { POLICY_CONFIG } from './config';

export interface AgentKeys {
  publicKey: string;
  privateKey: string;
}

export const nonceStore = new Set<string>();
export const DEMO_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEH76QNhVw2kWdqIxJapNQoAE4jnbS\nS+L4wvluQOtY5TwJ07OmE64mKNdPKs4/4kFP0W9KGHKTbdV1u2U4BUx5gA==\n-----END PUBLIC KEY-----\n";

export const DEMO_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgCiJs8Wgb0DLzKcnX\nWUrKMhUoH+Zbc8l2Oqw783LAUUuhRANCAAQfvpA2FXDaRZ2ojElqk1CgATiOdtJL\n4vjC+W5A61jlPAnTs6YTriYo108qzj/iQU/Rb0oYcpNt1XW7ZTgFTHmA\n-----END PRIVATE KEY-----\n";

export const keyRegistry = new Set<string>([
  DEMO_PUBLIC_KEY,
  "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2ngOmg6UfV/a80UmQ5Y/1DI4FW0G\nP7zd7ReKCorRrNkmHTS/9I347smuOWoK/sxMM6OKnMdzhnfidzx77NxA7A==\n-----END PUBLIC KEY-----\n"
]);

export function generateAgentKeyPair(): AgentKeys {
  // Hackathon Prototype Limitation Fix: 
  // Returning a static keypair instead of crypto.generateKeyPairSync() 
  // so that concurrent Vercel instances don't hit UNREGISTERED_PUBLIC_KEY errors
  // due to the in-memory keyRegistry not syncing across warm instances.
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
  
  if (nonceStore.has(payload.nonce)) {
    return { isValid: false, reason: 'NONCE_REUSED' };
  }
  
  const payloadString = deterministicStringify(payload);
  const verify = crypto.createVerify('SHA256');
  verify.update(payloadString);
  verify.end();
  
  const isValidSig = verify.verify(publicKeyPem, signature, 'base64');
  if (!isValidSig) {
    return { isValid: false, reason: 'SIGNATURE_INVALID' };
  }
  
  nonceStore.add(payload.nonce);
  return { isValid: true };
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
  reason?: 'SKU_MISMATCH' | 'AMOUNT_EXCEEDED' | 'QUANTITY_MISMATCH';
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
  // Fraudsters exploit string similarity by keeping brand words ("Pro Max") but changing the version number ("15" -> "11").
  const extractNumbers = (str: string) => (str.match(/\d+/g) || []);
  const mandateNums = extractNumbers(mandate.sku || "");
  const fulfillmentNums = extractNumbers(fulfillment.sku || "");
  
  // If the mandate specified numeric versions (e.g., "15", "256"), the fulfillment MUST preserve them.
  const isNumericDowngrade = mandateNums.some(num => !fulfillmentNums.includes(num));
  if (isNumericDowngrade) {
    return { status: 'REJECTED', reason: 'SKU_NUMERIC_DOWNGRADE' };
  }

  // 4. Native Sørensen-Dice Similarity (Zero-dependency, Case/Whitespace Normalized)
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const normMandate = normalize(mandate.sku || "");
  const normFulfill = normalize(fulfillment.sku || "");
  
  let similarity = 0;
  if (normMandate === normFulfill) {
    similarity = 1;
  } else if (normMandate.length > 1 && normFulfill.length > 1) {
    const bg1 = getBigrams(normMandate);
    const bg2 = getBigrams(normFulfill);
    let intersection = 0;
    for (const bg of bg1) {
      if (bg2.has(bg)) intersection++;
    }
    similarity = (2.0 * intersection) / (bg1.size + bg2.size);
  }

  if (similarity < (config.similarityThreshold ?? sim)) {
    return { status: 'REJECTED', reason: 'SKU_MISMATCH' };
  }

  return { status: 'APPROVED' };
}
