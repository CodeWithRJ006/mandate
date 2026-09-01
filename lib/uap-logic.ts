/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import stringSimilarity from 'string-similarity';

export interface AgentKeys {
  publicKey: string;
  privateKey: string;
}

export function generateAgentKeyPair(): AgentKeys {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
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
    ...payload,
    nonce: crypto.randomUUID(),
    expiry: Date.now() + 24 * 60 * 60 * 1000, // + 24 hours
  };

  const canonicalString = deterministicStringify(augmentedPayload);
  const sign = crypto.createSign('SHA256');
  sign.update(canonicalString);
  sign.end();
  
  const signature = sign.sign(privateKeyPem, 'base64');
  return { augmentedPayload, signature, canonicalString };
}

export function verifyMandate(payload: Record<string, any>, signature: string, publicKeyPem: string): boolean {
  if (payload.expiry && Date.now() > payload.expiry) return false;
  
  const payloadString = deterministicStringify(payload);
  const verify = crypto.createVerify('SHA256');
  verify.update(payloadString);
  verify.end();
  
  return verify.verify(publicKeyPem, signature, 'base64');
}

export interface MandateContext {
  authorized_amount: number;
  sku: string;
  [key: string]: any;
}

export interface FulfillmentContext {
  actual_amount: number;
  sku: string;
  [key: string]: any;
}

export interface EvaluationResult {
  status: 'APPROVED' | 'REJECTED';
  reason?: 'SKU_MISMATCH' | 'AMOUNT_EXCEEDED';
}

export function evaluateFulfillment(
  mandate: MandateContext,
  fulfillment: FulfillmentContext
): EvaluationResult {
  const maxAllowedAmount = mandate.authorized_amount * 1.02;
  const minAllowedAmount = mandate.authorized_amount * 0.98;
  
  if (
    fulfillment.actual_amount > maxAllowedAmount ||
    fulfillment.actual_amount < minAllowedAmount
  ) {
    return { status: 'REJECTED', reason: 'AMOUNT_EXCEEDED' };
  }

  const similarity = stringSimilarity.compareTwoStrings(mandate.sku, fulfillment.sku);
  if (similarity < 0.85) {
    return { status: 'REJECTED', reason: 'SKU_MISMATCH' };
  }

  return { status: 'APPROVED' };
}
