import { evaluateFulfillment, verifyMandate, generateAgentKeyPair, signMandate } from '../lib/uap-logic';

async function runTests() {
  console.log("Starting Adversarial Stress Tests...");
  let passed = 0;
  let failed = 0;

  const assertReject = (name: string, result: any, expectedReason?: string) => {
    if (result.status === "REJECTED" || result.isValid === false) {
      if (expectedReason && result.reason !== expectedReason) {
         console.log(`❌ [${name}] Failed: Expected reason ${expectedReason} but got ${result.reason}`);
         failed++;
      } else {
         console.log(`✅ [${name}] Passed: Gracefully rejected.`);
         passed++;
      }
    } else {
      console.log(`❌ [${name}] Failed: Engine allowed adversarial payload!`, result);
      failed++;
    }
  };

  // 1. Division by Zero
  try {
    const res = evaluateFulfillment({ sku: "A", authorized_amount: 0, quantity: 1 } as any, { sku: "A", actual_amount: 10, quantity: 1 } as any);
    assertReject("Div by Zero", res);
  } catch (e: any) {
    console.log(`❌ [Div by Zero] Crashed engine! ${e.message}`);
    failed++;
  }

  // 2. Negative amounts
  try {
    const res = evaluateFulfillment({ sku: "A", authorized_amount: -100, quantity: 1 } as any, { sku: "A", actual_amount: -100, quantity: 1 } as any);
    assertReject("Negative Authorized Amount", res);
  } catch(e: any) {
    console.log(`❌ [Negative Amount] Crashed engine! ${e.message}`);
    failed++;
  }

  // 3. Missing Fields
  try {
    const res = evaluateFulfillment({ sku: "A", quantity: 1 } as any, { sku: "A", actual_amount: 10, quantity: 1 } as any);
    assertReject("Missing Authorized Amount", res);
  } catch(e: any) {
    console.log(`❌ [Missing Fields] Crashed engine! ${e.message}`);
    failed++;
  }

  // 4. Crypto Tampering (Bad Signature string)
  try {
    const keys = generateAgentKeyPair();
    const { augmentedPayload, signature } = signMandate({ sku: "A", authorized_amount: 100, quantity: 1 }, keys.privateKey);
    const tamperedSignature = signature.substring(0, signature.length - 5) + "ABCDE";
    const res = verifyMandate(augmentedPayload, tamperedSignature, keys.publicKey);
    assertReject("Tampered Signature", res, "SIGNATURE_INVALID");
  } catch (e: any) {
    console.log(`❌ [Crypto Tampering] Crashed engine! ${e.message}`);
    failed++;
  }
  
  // 5. Crypto Tampering (Payload Mutation)
  try {
    const keys = generateAgentKeyPair();
    const { augmentedPayload, signature } = signMandate({ sku: "A", authorized_amount: 100, quantity: 1 }, keys.privateKey);
    augmentedPayload.authorized_amount = 9999;
    const res = verifyMandate(augmentedPayload, signature, keys.publicKey);
    assertReject("Mutated Payload", res, "SIGNATURE_INVALID");
  } catch(e: any) {
    console.log(`❌ [Payload Mutation] Crashed engine! ${e.message}`);
    failed++;
  }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
}
runTests();
