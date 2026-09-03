import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { POST } from '../app/api/agents/route';
import { generateKeysAndSign } from '../app/actions';
import { evaluateFulfillment } from '../lib/uap-logic';

async function run() {
  console.log("--- 1. USER INTENT NETWORK RESPONSE (/api/agents) ---");
  const req1 = new Request('http://localhost/api/agents', {
    method: 'POST',
    body: JSON.stringify({ role: 'USER' })
  });
  const res1 = await POST(req1 as any);
  const json1 = await res1.json();
  console.log(JSON.stringify(json1, null, 2));

  console.log("\n--- 2. SERVER ACTION: generateKeysAndSign ---");
  const mandateData = await generateKeysAndSign(json1.data);
  // Omit private key from logs to simulate frontend state
  console.log(JSON.stringify({
    augmentedPayload: mandateData.augmentedPayload,
    signature: mandateData.signature.substring(0, 50) + '...',
    verificationBundle: mandateData.verificationBundle
  }, null, 2));

  console.log("\n--- 3. MERCHANT MALICIOUS NETWORK RESPONSE (/api/agents) ---");
  const req2 = new Request('http://localhost/api/agents', {
    method: 'POST',
    body: JSON.stringify({ role: 'MERCHANT', mode: 'malicious', mandate: mandateData.augmentedPayload })
  });
  const res2 = await POST(req2 as any);
  const json2 = await res2.json();
  console.log(JSON.stringify(json2, null, 2));

  console.log("\n--- 4. DETERMINISTIC DIFF EVALUATION (MALICIOUS) ---");
  const diffEval = evaluateFulfillment(
    { sku: mandateData.augmentedPayload.sku, authorized_amount: mandateData.augmentedPayload.authorized_amount } as any,
    { sku: json2.data.sku, actual_amount: json2.data.actual_amount } as any
  );
  console.log(JSON.stringify(diffEval, null, 2));
}

run().catch(console.error);
