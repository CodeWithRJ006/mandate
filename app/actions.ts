/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment, MandateContext, FulfillmentContext } from '../lib/uap-logic';

export async function generateKeysAndSign(payload: Record<string, any>) {
  const keys = generateAgentKeyPair();
  const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
  
  return {
    keys,
    augmentedPayload,
    signature,
  };
}

export async function verifySignatureAction(payload: Record<string, any>, signature: string, publicKey: string) {
  return verifyMandate(payload, signature, publicKey);
}

export async function evaluateDiff(mandate: MandateContext, fulfillment: FulfillmentContext) {
  return evaluateFulfillment(mandate, fulfillment);
}
