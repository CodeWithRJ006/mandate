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
    
    // Test 1: verifyMandate returns true for valid ECDSA signatures and false if tampered
    const payload = { sku: 'Organic Apples', authorized_amount: 2000 };
    const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);
    const isValid = verifyMandate(augmentedPayload, signature, keys.publicKey);
    assert.strictEqual(isValid, true, 'ECDSA signature should verify');
    
    const tamperedPayload = { ...augmentedPayload, authorized_amount: 3000 };
    const isTamperedValid = verifyMandate(tamperedPayload, signature, keys.publicKey);
    assert.strictEqual(isTamperedValid, false, 'Tampered payload should fail verification');
    console.log('✅ Test 1 Passed: verifyMandate handles valid and tampered ECDSA signatures.');

    // Test 2: evaluateFulfillment accepts minor SKU typos
    const typoEval = evaluateFulfillment(
      { sku: 'Apples', authorized_amount: 100 },
      { sku: 'Apple', actual_amount: 100 }
    );
    assert.strictEqual(typoEval.status, 'APPROVED', 'Minor typo ("Apples" vs "Apple") should be accepted');
    console.log('✅ Test 2 Passed: evaluateFulfillment accepts minor SKU typos (>0.85).');

    // Test 3: evaluateFulfillment accepts a 1% price variance but rejects a 5% price variance
    const variance1Percent = evaluateFulfillment(
      { sku: 'Apples', authorized_amount: 100 },
      { sku: 'Apples', actual_amount: 101 } // 1% diff
    );
    assert.strictEqual(variance1Percent.status, 'APPROVED', 'Should accept 1% price variance');

    const variance5Percent = evaluateFulfillment(
      { sku: 'Apples', authorized_amount: 100 },
      { sku: 'Apples', actual_amount: 105 } // 5% diff
    );
    assert.strictEqual(variance5Percent.status, 'REJECTED', 'Should reject 5% price variance');
    assert.strictEqual(variance5Percent.reason, 'AMOUNT_EXCEEDED', 'Reason should be AMOUNT_EXCEEDED');
    console.log('✅ Test 3 Passed: evaluateFulfillment enforces <= 2% tolerance (1% accepted, 5% rejected).');

    // Test 4: evaluateFulfillment rejects malicious payloads (hidden fees)
    const maliciousEval = evaluateFulfillment(
      { sku: 'Organic Apples', authorized_amount: 2000 },
      { sku: 'Organic Apples', actual_amount: 2150 } // 150 INR hidden fee (7.5% diff)
    );
    assert.strictEqual(maliciousEval.status, 'REJECTED', 'Should reject malicious padding');
    assert.strictEqual(maliciousEval.reason, 'AMOUNT_EXCEEDED', 'Reason should be AMOUNT_EXCEEDED');
    console.log('✅ Test 4 Passed: evaluateFulfillment accurately rejects malicious payloads.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    exitCode = 1;
  }

  process.exit(exitCode);
}

runTests();
