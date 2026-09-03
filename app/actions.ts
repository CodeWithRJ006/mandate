/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment, MandateContext, FulfillmentContext } from '../lib/uap-logic';
import { globalLedger } from '../lib/ledger';

export interface AgentExecutionTelemetry {
  systemPrompt: string;
  userPrompt: string;
  rawOutput: string;
  latencyMs: number;
  provider: 'Groq (Llama 3.3 70B)' | 'Mock Fallback';
  retriesUsed?: number;
}

export interface MandateVerificationBundle {
  canonicalString: string;
  signature: string;
  publicKeyPem: string;
  nonce: string;
  expiry: number;
  isValid: boolean;
}

export async function generateKeysAndSign(payload: Record<string, any>) {
  const keys = generateAgentKeyPair();
  const { augmentedPayload, signature, canonicalString } = signMandate(payload, keys.privateKey);
  
  const verificationBundle: MandateVerificationBundle = {
    canonicalString,
    signature,
    publicKeyPem: keys.publicKey,
    nonce: augmentedPayload.nonce,
    expiry: augmentedPayload.expiry,
    isValid: true
  };

  return {
    keys,
    augmentedPayload,
    signature,
    verificationBundle
  };
}

export async function verifySignatureAction(payload: Record<string, any>, signature: string, publicKey: string) {
  return verifyMandate(payload, signature, publicKey);
}

export async function evaluateDiff(mandate: any, fulfillment: any, signature: string, publicKeyPem: string) {
  const verification = verifyMandate(mandate, signature, publicKeyPem);
  if (!verification.isValid) {
    const res = { status: 'REJECTED', reason: verification.reason || 'SIGNATURE_INVALID' };
    globalLedger.addBlock(mandate.nonce || 'UNKNOWN_NONCE', res.status, res.reason);
    return res;
  }
  const evalResult = evaluateFulfillment(mandate, fulfillment);
  globalLedger.addBlock(mandate.nonce, evalResult.status, evalResult.reason || null);
  return evalResult;
}

export async function getLedgerChain() {
  return globalLedger.getChain();
}

export async function tamperLedgerAction(index: number, newVerdict: string) {
  globalLedger.tamperWithBlock(index, newVerdict);
  return globalLedger.getChain();
}

export async function verifyLedgerAction() {
  return globalLedger.verifyChainIntegrity();
}
