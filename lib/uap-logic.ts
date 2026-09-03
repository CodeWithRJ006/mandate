/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import stringSimilarity from 'string-similarity';
import { POLICY_CONFIG } from './config';

export interface AgentKeys {
  publicKey: string;
  privateKey: string;
}

export const nonceStore = new Set<string>();

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

  const similarity = stringSimilarity.compareTwoStrings(mandate.sku, fulfillment.sku);
  if (similarity < sim) {
    return { status: 'REJECTED', reason: 'SKU_MISMATCH' };
  }

  return { status: 'APPROVED' };
}
