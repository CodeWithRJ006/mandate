import { generateAgentKeyPair, signMandate } from '../lib/uap-logic';


const API_URL = 'http://localhost:3000/api/verify';

async function runSecurityTests() {
  console.log("=== Running API Security Verification Tests ===\n");
  
  // 1. Generate Valid Mandate
  const keys = generateAgentKeyPair();
  const mandatePayload = {
    sku: "Secure Item",
    authorized_amount: 5000,
    quantity: 1,
    nonce: `test-nonce-${Date.now()}`,
    expiry: Date.now() + 60000
  };
  const { augmentedPayload, signature } = signMandate(mandatePayload, keys.privateKey);

  const fulfillmentPayload = {
    sku: "Secure Item",
    actual_amount: 5000,
    quantity: 1
  };

  // Test 1: Unsigned Payload (Missing Signature)
  console.log("[Test 1] Submitting unsigned payload...");
  const res1 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandate: augmentedPayload, // No signature attached
      fulfillment: fulfillmentPayload
    })
  });
  console.log(`Expected: 401, Got: ${res1.status}`);
  const data1 = await res1.json();
  console.log(`Response: ${JSON.stringify(data1)}\n`);

  // Test 2: Tampered Payload (Modified SKU)
  console.log("[Test 2] Submitting tampered payload (signature invalid)...");
  const tamperedMandate = { ...augmentedPayload, sku: "Hacked Item" };
  const res2 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandate: {
        ...tamperedMandate,
        signature,
        publicKeyPem: keys.publicKey
      },
      fulfillment: fulfillmentPayload
    })
  });
  console.log(`Expected: 403, Got: ${res2.status}`);
  const data2 = await res2.json();
  console.log(`Response: ${JSON.stringify(data2)}\n`);

  // Test 3: Valid Payload
  console.log("[Test 3] Submitting fully valid and signed payload...");
  const res3 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mandate: {
        ...augmentedPayload,
        signature,
        publicKeyPem: keys.publicKey
      },
      fulfillment: fulfillmentPayload
    })
  });
  console.log(`Expected: 200, Got: ${res3.status}`);
  const data3 = await res3.json();
  console.log(`Response: ${JSON.stringify(data3)}\n`);
}

runSecurityTests().catch(console.error);
