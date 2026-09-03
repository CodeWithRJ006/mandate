import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment, nonceStore } from '../lib/uap-logic';
import { POLICY_CONFIG } from '../lib/config';

describe('UAP Logic (ECDSA and Risk Engine)', () => {
  let keys: { publicKey: string; privateKey: string };

  beforeAll(() => {
    keys = generateAgentKeyPair();
  });

  describe('Cryptographic Signature Gating (P0)', () => {
    it('generates valid PEM keys', () => {
      expect(keys.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(keys.privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('verifyMandate returns true for valid ECDSA signatures', () => {
      const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
      const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
      
      const verification = verifyMandate(augmentedPayload, signature, keys.publicKey);
      expect(verification.isValid).toBe(true);
    });

    it('verifyMandate returns false for a tampered payload (403 SIGNATURE_INVALID)', () => {
      const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
      const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
      
      const tamperedPayload = { ...augmentedPayload, authorized_amount: 3000 };
      const verification = verifyMandate(tamperedPayload, signature, keys.publicKey);
      
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toBe('SIGNATURE_INVALID');
    });

    it('verifyMandate returns false for an empty or invalid signature format (401 CRYPTOGRAPHIC_SIGNATURE_REQUIRED)', () => {
      const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
      const { augmentedPayload } = signMandate(payload, keys.privateKey);
      
      const verification = verifyMandate(augmentedPayload, '', keys.publicKey);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toBe('SIGNATURE_INVALID');
    });

    it('verifyMandate rejects expired mandates', () => {
      const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
      const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
      
      // Tamper with expiry (must fail signature check)
      const tamperedPayload = { ...augmentedPayload, expiry: Date.now() - 10000 };
      const verification = verifyMandate(tamperedPayload, signature, keys.publicKey);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toBe('MANDATE_EXPIRED');
    });
    
    it('verifyMandate catches nonce reuse (Replay Attacks)', () => {
      const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
      const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
      
      // First verification consumes the nonce
      const firstCheck = verifyMandate(augmentedPayload, signature, keys.publicKey);
      expect(firstCheck.isValid).toBe(true);
      
      // Second verification rejects it
      const secondCheck = verifyMandate(augmentedPayload, signature, keys.publicKey);
      expect(secondCheck.isValid).toBe(false);
      expect(secondCheck.reason).toBe('NONCE_REUSED');
    });
  });

  describe('Semantic and Financial Policy Engine', () => {
    it('evaluateFulfillment accepts minor SKU typos', () => {
      const evalRes = evaluateFulfillment(
        { sku: 'Apples', authorized_amount: 100 },
        { sku: 'Apple', actual_amount: 100 },
        POLICY_CONFIG
      );
      expect(evalRes.status).toBe('APPROVED');
    });

    it('evaluateFulfillment rejects completely different SKUs (SKU substitution)', () => {
      const evalRes = evaluateFulfillment(
        { sku: 'Apples', authorized_amount: 100 },
        { sku: 'Oranges', actual_amount: 100 },
        POLICY_CONFIG
      );
      expect(evalRes.status).toBe('REJECTED');
      expect(evalRes.reason).toBe('SKU_MISMATCH');
    });

    it('evaluateFulfillment enforces quantity constraints', () => {
      const evalRes = evaluateFulfillment(
        { sku: 'Apples', authorized_amount: 100, quantity: 1 },
        { sku: 'Apples', actual_amount: 100, quantity: 2 },
        POLICY_CONFIG
      );
      expect(evalRes.status).toBe('REJECTED');
      expect(evalRes.reason).toBe('QUANTITY_MISMATCH');
    });

    it('evaluateFulfillment accepts a 1% price variance (within tolerance)', () => {
      const evalRes = evaluateFulfillment(
        { sku: 'Apples', authorized_amount: 100 },
        { sku: 'Apples', actual_amount: 101 }, // 1% diff
        POLICY_CONFIG
      );
      expect(evalRes.status).toBe('APPROVED');
    });

    it('evaluateFulfillment rejects a 5% price variance (exceeds tolerance)', () => {
      const evalRes = evaluateFulfillment(
        { sku: 'Apples', authorized_amount: 100 },
        { sku: 'Apples', actual_amount: 105 }, // 5% diff
        POLICY_CONFIG
      );
      expect(evalRes.status).toBe('REJECTED');
      expect(evalRes.reason).toBe('AMOUNT_EXCEEDED');
    });

    it('evaluateFulfillment accurately rejects malicious payloads (hidden fee padding)', () => {
      const maliciousEval = evaluateFulfillment(
        { sku: 'Organic Apples', authorized_amount: 2000 },
        { sku: 'Organic Apples', actual_amount: 2150 }, // 150 INR hidden fee (7.5% diff)
        POLICY_CONFIG
      );
      expect(maliciousEval.status).toBe('REJECTED');
      expect(maliciousEval.reason).toBe('AMOUNT_EXCEEDED');
    });
  });
});
