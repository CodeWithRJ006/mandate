import crypto from 'crypto';
import stringSimilarity from 'string-similarity';

// --- AP2 Cryptography Layer ---

export interface MandatePayload {
  [key: string]: unknown;
  nonce?: string;
  expiry?: number;
  signature?: string;
}

/**
 * Generates an asymmetric RSA keypair for mandate signing and verification.
 */
export function generateKeyPair(): crypto.KeyPairKeyObjectResult {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
}

/**
 * Exports keys to PEM strings for storage/transmission
 */
export function exportKeyPair(keys: crypto.KeyPairKeyObjectResult) {
  return {
    publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

/**
 * Deterministically stringifies an object to ensure signature consistency.
 */
function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(deterministicStringify).join(',')}]`;
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const res = keys.map((key) => `${JSON.stringify(key)}:${deterministicStringify(record[key])}`);
  return `{${res.join(',')}}`;
}

/**
 * Adds a signature, a unique nonce, and an expiry timestamp to the JSON payload.
 */
export function signMandate(data: Record<string, unknown>, privateKey: string): MandatePayload {
  const payload = {
    ...data,
    nonce: crypto.randomUUID(),
    expiry: Date.now() + 5 * 60 * 1000, // 5 minutes validity
  };
  
  const payloadString = deterministicStringify(payload);
  const sign = crypto.createSign('SHA256');
  sign.update(payloadString);
  sign.end();
  
  const signature = sign.sign(privateKey, 'base64');
  return { ...payload, signature };
}

/**
 * Validates the mandate payload (nonce, expiry, and signature) using a public key.
 */
export function verifyMandate(mandate: MandatePayload, publicKey: string): boolean {
  const { signature, ...payload } = mandate;
  
  if (!signature) return false;
  if (payload.expiry && Date.now() > payload.expiry) return false;
  
  const payloadString = deterministicStringify(payload);
  const verify = crypto.createVerify('SHA256');
  verify.update(payloadString);
  verify.end();
  
  return verify.verify(publicKey, signature, 'base64');
}


// --- Deterministic Diff Engine ---

export interface MandateContext {
  authorized_amount: number;
  sku: string;
}

export interface FulfillmentContext {
  actual_amount: number;
  sku: string;
}

export interface EvaluationResult {
  status: 'APPROVED' | 'REJECTED';
  reason?: 'SKU_MISMATCH' | 'AMOUNT_EXCEEDED';
}

/**
 * Evaluates whether the fulfillment meets the mandate criteria based on sku similarity and amount tolerances.
 */
export function evaluateFulfillment(
  mandate: MandateContext,
  fulfillment: FulfillmentContext
): EvaluationResult {
  // Check amount tolerance (2%)
  const maxAllowedAmount = mandate.authorized_amount * 1.02;
  const minAllowedAmount = mandate.authorized_amount * 0.98;
  
  if (
    fulfillment.actual_amount > maxAllowedAmount ||
    fulfillment.actual_amount < minAllowedAmount
  ) {
    return { status: 'REJECTED', reason: 'AMOUNT_EXCEEDED' };
  }

  // Check SKU similarity
  const similarity = stringSimilarity.compareTwoStrings(mandate.sku, fulfillment.sku);
  if (similarity < 0.85) {
    return { status: 'REJECTED', reason: 'SKU_MISMATCH' };
  }

  return { status: 'APPROVED' };
}
