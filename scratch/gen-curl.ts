import { generateAgentKeyPair, signMandate } from '../lib/uap-logic';

const keys = generateAgentKeyPair();
const payload = {
  sku: "Organic Apples",
  authorized_amount: 1000,
  quantity: 1,
  nonce: "readme-demo-nonce-999"
  // no expiry so it doesn't expire
};

const { augmentedPayload, signature } = signMandate(payload, keys.privateKey);

const curlCmd = `curl -X POST https://razorpay-uap-recourse.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "mandate": {
      "sku": "Organic Apples",
      "authorized_amount": 1000,
      "quantity": 1,
      "nonce": "${augmentedPayload.nonce}",
      "signature": "${signature}",
      "publicKeyPem": ${JSON.stringify(keys.publicKey).replace(/\n/g, "\\n")}
    },
    "fulfillment": {
      "sku": "Organic Apples (1kg)",
      "actual_amount": 1015,
      "quantity": 1
    }
  }'`;

console.log(curlCmd);
