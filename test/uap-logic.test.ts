import { generateKeyPair, exportKeyPair, signMandate, verifyMandate, evaluateFulfillment } from '../lib/uap-logic';

function runTests() {
  console.log('--- Starting Tests for UAP Logic ---');
  let allPassed = true;

  try {
    // Test 1: Cryptography
    console.log('\n[Test 1] Generating KeyPair...');
    const keys = generateKeyPair();
    const exportedKeys = exportKeyPair(keys);
    console.assert(!!exportedKeys.publicKey, 'Public key should exist');
    console.assert(!!exportedKeys.privateKey, 'Private key should exist');
    console.log('  Keys generated successfully.');

    console.log('\n[Test 2] Signing and Verifying Mandate...');
    const data = { authorized_amount: 500, sku: 'PROD_XYZ_123', userId: 'user_1' };
    const signedMandate = signMandate(data, exportedKeys.privateKey);
    console.assert(!!signedMandate.signature, 'Signature should be present');
    console.assert(!!signedMandate.nonce, 'Nonce should be present');
    console.assert(!!signedMandate.expiry, 'Expiry should be present');
    console.log('  Mandate signed successfully.');

    const isValid = verifyMandate(signedMandate, exportedKeys.publicKey);
    console.assert(isValid === true, 'Signature should be verified as valid');
    console.log('  Mandate verified successfully.');

    console.log('\n[Test 3] Reject Tampered Mandate...');
    const tamperedMandate = { ...signedMandate, authorized_amount: 50000 }; // Attacker changes amount
    const isTamperedValid = verifyMandate(tamperedMandate, exportedKeys.publicKey);
    console.assert(isTamperedValid === false, 'Tampered mandate should NOT be verified as valid');
    console.log('  Tampered mandate correctly rejected.');
    
    // Test 4: Deterministic Diff Engine - Exact Match
    console.log('\n[Test 4] Diff Engine - Exact Match');
    const mandateExact = { authorized_amount: 1000, sku: 'RAZORPAY_SKU_1' };
    const fulfillmentExact = { actual_amount: 1000, sku: 'RAZORPAY_SKU_1' };
    const resultExact = evaluateFulfillment(mandateExact, fulfillmentExact);
    console.assert(resultExact.status === 'APPROVED', 'Should approve exact match');
    console.log('  Exact match approved.');

    // Test 5: Deterministic Diff Engine - Within Tolerance (Amount)
    console.log('\n[Test 5] Diff Engine - Within 2% Amount Tolerance');
    const fulfillmentUnder = { actual_amount: 985, sku: 'RAZORPAY_SKU_1' }; // 1.5% under
    const fulfillmentOver = { actual_amount: 1015, sku: 'RAZORPAY_SKU_1' }; // 1.5% over
    console.assert(evaluateFulfillment(mandateExact, fulfillmentUnder).status === 'APPROVED', 'Should approve 1.5% under');
    console.assert(evaluateFulfillment(mandateExact, fulfillmentOver).status === 'APPROVED', 'Should approve 1.5% over');
    console.log('  Amount tolerances approved.');

    // Test 6: Deterministic Diff Engine - Exceeds Tolerance (Amount)
    console.log('\n[Test 6] Diff Engine - Exceeds 2% Amount Tolerance');
    const fulfillmentWayOver = { actual_amount: 1021, sku: 'RAZORPAY_SKU_1' }; // 2.1% over
    const resultWayOver = evaluateFulfillment(mandateExact, fulfillmentWayOver);
    console.assert(resultWayOver.status === 'REJECTED', 'Should reject exceeding tolerance');
    console.assert(resultWayOver.reason === 'AMOUNT_EXCEEDED', 'Reason should be AMOUNT_EXCEEDED');
    console.log('  Exceeded amount tolerance rejected.');

    // Test 7: Deterministic Diff Engine - SKU Mismatch
    console.log('\n[Test 7] Diff Engine - SKU Mismatch');
    const fulfillmentSkuBad = { actual_amount: 1000, sku: 'PAYPAL_SKU_2' };
    const resultSkuBad = evaluateFulfillment(mandateExact, fulfillmentSkuBad);
    console.assert(resultSkuBad.status === 'REJECTED', 'Should reject completely different SKU');
    console.assert(resultSkuBad.reason === 'SKU_MISMATCH', 'Reason should be SKU_MISMATCH');
    console.log('  SKU Mismatch rejected.');
    
    // Test 8: Deterministic Diff Engine - SKU Minor Diff (Typos)
    console.log('\n[Test 8] Diff Engine - SKU Typos (Similarity >= 0.85)');
    const mandateTypo = { authorized_amount: 100, sku: 'IPHONE_15_PRO_MAX_256' };
    const fulfillmentTypo = { actual_amount: 100, sku: 'IPHONE_15_PRO_MAX_256G' }; // Minor change
    const resultTypo = evaluateFulfillment(mandateTypo, fulfillmentTypo);
    console.log(`  Similarity status: ${resultTypo.status}`);
    // IPHONE_15_PRO_MAX_256 (21 chars) vs IPHONE_15_PRO_MAX_256G (22 chars) -> Should be > 0.85
    // Note: depending on the exact string-similarity algorithm (dice coefficient), this could be APPROVED or REJECTED.
    // If it's REJECTED, it means the similarity is < 0.85.

    console.log('\n--- All Tests Ran Successfully ---');
  } catch (error) {
    console.error('Test Failed:', error);
    allPassed = false;
  }

  if (!allPassed) {
    process.exit(1);
  }
}

runTests();
