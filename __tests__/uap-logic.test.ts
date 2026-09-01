import { generateAgentKeyPair, signMandate, verifyMandate, evaluateFulfillment } from '../lib/uap-logic';
import assert from 'assert';

async function runTests() {
  console.log('--- Running Tests for UAP Logic (ECDSA) ---');
  let exitCode = 0;

  try {
    // 1. Generate keys
    const keys = generateAgentKeyPair();
    assert.ok(keys.publicKey.includes('BEGIN PUBLIC KEY'), 'Public key should be PEM');
    assert.ok(keys.privateKey.includes('BEGIN PRIVATE KEY'), 'Private key should be PEM');
    console.log('✅ generateAgentKeyPair() created valid ECDSA prime256v1 keys');

    // 2. ECDSA signature successfully verifies
    const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
    const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
    assert.ok(augmentedPayload.nonce, 'Nonce should be injected');
    assert.ok(augmentedPayload.expiry, 'Expiry should be injected');
    
    const isValid = verifyMandate(augmentedPayload, signature, keys.publicKey);
    assert.strictEqual(isValid, true, 'ECDSA signature should verify');
    
    // Tampered payload verification failure
    const tamperedPayload = { ...augmentedPayload, authorized_amount: 3000 };
    const isTamperedValid = verifyMandate(tamperedPayload, signature, keys.publicKey);
    assert.strictEqual(isTamperedValid, false, 'Tampered payload should fail verification');
    console.log('✅ signMandate() and verifyMandate() passed');

    // 3. String matcher accepts minor SKU typos (>0.85 similarity)
    const typoEval = evaluateFulfillment(
      { sku: 'Organic Apples', authorized_amount: 100 },
      { sku: 'Organic Apple', actual_amount: 100 }
    );
    assert.strictEqual(typoEval.status, 'APPROVED', 'Minor typo should be accepted');
    
    const badSkuEval = evaluateFulfillment(
      { sku: 'Organic Apples', authorized_amount: 100 },
      { sku: 'Bananas', actual_amount: 100 }
    );
    assert.strictEqual(badSkuEval.status, 'REJECTED', 'Completely different SKU should be rejected');
    assert.strictEqual(badSkuEval.reason, 'SKU_MISMATCH', 'Reason should be SKU_MISMATCH');
    console.log('✅ Semantic string matcher correctly handles typos and mismatches');

    // 4. Amount tolerance checker accepts differences <= 2%
    const toleranceUnder = evaluateFulfillment(
      { sku: 'Apples', authorized_amount: 100 },
      { sku: 'Apples', actual_amount: 98.5 } // 1.5% diff
    );
    assert.strictEqual(toleranceUnder.status, 'APPROVED', 'Should accept 1.5% under');

    const toleranceOver = evaluateFulfillment(
      { sku: 'Apples', authorized_amount: 100 },
      { sku: 'Apples', actual_amount: 101.5 } // 1.5% diff
    );
    assert.strictEqual(toleranceOver.status, 'APPROVED', 'Should accept 1.5% over');
    console.log('✅ Amount tolerance checker accepts <= 2% variations');

    // 5. Deterministic diff accurately rejects malicious payloads
    const maliciousEval = evaluateFulfillment(
      { sku: 'Apples', authorized_amount: 2000 },
      { sku: 'Apples', actual_amount: 2150 } // >2% diff
    );
    assert.strictEqual(maliciousEval.status, 'REJECTED', 'Should reject malicious padding');
    assert.strictEqual(maliciousEval.reason, 'AMOUNT_EXCEEDED', 'Reason should be AMOUNT_EXCEEDED');
    console.log('✅ Deterministic diff rejects malicious payloads (> 2%)');

  } catch (error) {
    console.error('❌ Test failed:', error);
    exitCode = 1;
  }

  process.exit(exitCode);
}

runTests();
