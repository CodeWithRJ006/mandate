# Mandate
> Trust the intent. Verify the action.

**Razorpay UAP Track 2: AI Risk Manager / Defense-Only Application**

[![CI](https://github.com/CodeWithRJ006/razorpay-uap-recourse/actions/workflows/ci.yml/badge.svg)](https://github.com/CodeWithRJ006/razorpay-uap-recourse/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Security](https://img.shields.io/badge/Crypto-ECDSA_prime256v1-emerald)

An autonomous, cryptographically-secured recourse layer for the Unified Agent Protocol (UAP). This system enables AI agents to transact autonomously by enforcing a deterministic, tamper-proof security boundary between merchant fulfillment and user mandates.

**Core Architectural Philosophy:** *LLMs generate agent intent. Deterministic cryptographic and policy controls execute the final financial authorization.* A payment rail cannot afford hallucinated financial approvals; this project guarantees absolute mathematical boundaries on agentic spend.

---

## 🏗️ High-Level Architecture

The system operates strictly as a verifiable middle-layer between User Agents and Merchant Agents.

```mermaid
graph TD
    subgraph UA [User Agent Enclave]
        A[Intent Generation <br/> Llama 3.3 70B] --> B(Sign Mandate <br/> ECDSA prime256v1)
    end

    subgraph MA [Merchant Agent Enclave]
        C[Fulfillment Generation] 
    end

    subgraph RE [Razorpay UAP Recourse Engine]
        D{Key Registry Check}
        E{Cryptographic Verify}
        F{Policy & Diff Engine}
        G[(Hash-Chain Ledger)]
    end

    B -- W3C Signed Mandate --> C
    C -- Payload + Signature --> D
    
    D -- Valid Key --> E
    E -- Valid Signature, Nonce, Expiry --> F
    F -- Approved / Blocked --> G
    F -- Verdict --> MA
```

---

## 🛡️ The 6-Layer Security Boundary

Real-world agentic payments cannot rely on LLM discretion for financial settlement. The recourse engine executes a rigid, 6-stage verification pipeline **before** a transaction is settled.

### 1. Cryptographic Authentication
* **ECDSA prime256v1 Signatures:** Mandates are strictly signed. The backend `/api/verify` throws `401 Unauthorized` or `403 Forbidden` if the payload is altered by even a single byte post-signature.
* **Strict Identity Binding:** Signatures are cross-referenced against an in-memory `KeyRegistry`. Even mathematically perfect signatures are rejected with `UNREGISTERED_PUBLIC_KEY` if the agent is unknown to the gateway.

### 2. State & Replay Protection
* **Nonce Replay Guard:** Every mandate possesses a unique UUID. The system consumes this nonce upon `APPROVED` status. Replayed payloads instantly return `NONCE_REUSED`.
* **Temporal Expiry:** Mandates enforce a strict `timestamp`, invalidating automatically after 24 hours (`MANDATE_EXPIRED`).

### 3. Financial & Semantic Bounds
* **Amount Tolerance:** Hard ceiling of `<= 2.0%` deviation between authorized amount and actual amount.
* **Native Sørensen-Dice Semantic Matching:** Validates SKU intent without LLM latency. A threshold of `> 0.60` ensures safety against substitution while allowing benign merchant catalog formatting differences.
* **Numeric Downgrade Guard:** Extracts numerical integers to prevent version spoofing (e.g., "iPhone 15 Pro" vs "iPhone 11 Pro" mathematically parses as a downgrade, yielding `SKU_NUMERIC_DOWNGRADE`).
* **Tier Extraction Guard:** Looks for premium modifiers (`pro`, `max`, `ultra`, `premium`) in the mandate that are missing in the fulfillment, preventing premium-to-standard bait-and-switches.
* **Quantity Nullification:** A strict guard catching agents attempting `quantity: 0`, negative bounds, or non-integer injections (`QUANTITY_MISMATCH`).

---

## 🔬 The Evaluation Pipeline (Internal Flow)

```mermaid
sequenceDiagram
    participant API as /api/verify
    participant Crypto as verifyMandate()
    participant Engine as evaluateFulfillment()
    participant Ledger as globalLedger

    API->>Crypto: 1. Inject Payload
    
    alt Unregistered Key
        Crypto-->>API: 403 UNREGISTERED_PUBLIC_KEY
    else Expired
        Crypto-->>API: 403 MANDATE_EXPIRED
    else Invalid Signature
        Crypto-->>API: 403 SIGNATURE_INVALID
    else Consumed Nonce
        Crypto-->>API: 403 NONCE_REUSED
    end

    Crypto->>Engine: 2. Valid Cryptography
    
    Engine->>Engine: 3. Quantity & Amount Guards (<2.0%)
    Engine->>Engine: 4. Numeric & Tier Protection
    Engine->>Engine: 5. Sørensen-Dice Similarity (>0.60)
    
    alt Diff > Threshold
        Engine-->>API: REJECTED (e.g., SKU_MISMATCH)
    else Diff <= Threshold
        Engine->>Crypto: consumeNonce()
        Engine-->>API: APPROVED
    end

    API->>Ledger: Commit Verdict & Hash to data/ledger.json
```

---

## 🎮 The Adversarial Playground (Live UI Demo)

To empirically prove the resilience of the security boundary, the UI includes an **Adversarial Playground** containing 6 distinct, independently triggerable attack vectors. 

*(Note: The playground automatically generates a fresh cryptographic mandate behind the scenes for every click, ensuring perfect test isolation and preventing earlier tests from polluting the nonce store).*

1. **Fee Padding:** Attempts to inject a hidden ₹150 fee. -> `AMOUNT_EXCEEDED`
2. **SKU Substitution:** Swaps to a "Generic Alternative". -> `SKU_MISMATCH`
3. **Quantity Inflation:** Attempts to bill for 2 items instead of 1. -> `QUANTITY_MISMATCH`
4. **Signature Tamper:** Mutates the payload JSON after the W3C signature was generated. -> `SIGNATURE_INVALID`
5. **Replay Consumed Nonce:** Simulates a double-billing attempt by explicitly passing a consumed mandate. -> `NONCE_REUSED`
6. **Expired Mandate:** Cryptographically backdates the mandate. -> `MANDATE_EXPIRED`

---

## 📈 Evaluation Rigor & Financial Asymmetry

In high-throughput payment aggregation, failure modes are highly asymmetric. 

* **False Positive (Type I Error):** A clean transaction is held by the policy engine for manual review. Introduces temporary settlement friction.
* **False Negative (Type II Error):** An adversarial substitution bypasses verification and settles. **Unrecoverable chargeback liability.** A single undetected ₹150 fee padded across 10,000 orders costs ₹1,500,000/month.

### The 0.60 Safety Floor
We explicitly prioritize **100% Recall** against unrecoverable financial loss. We anchored our similarity threshold at **>0.60** and **2.0% price tolerance**. We intentionally accept that extreme benign edge cases (e.g., "Bluetooth Speaker" vs "BT Speaker 5.0") may fall below 0.60 and require manual review. *A strict AI risk manager owns their operational friction rather than hiding it.*

---

## 🚀 Path to Production (Scaling Beyond Prototype)

While fully functional, this prototype relies on serverless environment constraints. A true enterprise deployment at Razorpay scale requires the following infrastructural upgrades:

| Component | Current Prototype State | Enterprise Target Architecture |
| :--- | :--- | :--- |
| **Nonce Store** | Node.js In-Memory `Set` (Subject to cross-lambda resets) | **Redis `SETNX`** with a 24-hour TTL for globally atomic, millisecond replay protection. |
| **Audit Ledger** | Local file system (`data/ledger.json`) | **Apache Kafka** event stream backed by **PostgreSQL/DynamoDB** for immutable, distributed querying. |
| **Identity / Keys** | Environment Variable derived EC keypair | **Hardware Security Modules (HSMs)**, W3C Verifiable Credentials (VCs), and Decentralized Identifiers (DIDs). |
| **NLP Matching** | Lexical Sørensen-Dice (Fails on pure synonyms) | Hybrid model appending a lightweight semantic vector embedding (e.g., `text-embedding-3-small`) to resolve edge-case synonymity. |

---

## 🧪 Testing & CI

This repository maintains **100% coverage across 22 Jest test suites** focusing specifically on cryptographic boundary abuse, HTTP middleware logic, and threshold mathematics. 

```bash
# Run the test suite locally
npm run test
```
The GitHub Actions CI pipeline enforces `npm run lint`, `npx jest`, and `npm run build` on every branch push.

---

## 🛠️ Live API Verification (Bring Your Own Transaction)

To verify the policy engine is a real cryptographic service, you can run this Node.js snippet locally (requires `npm run dev` to be running):

```js
// verify-local.js — run with: node verify-local.js
const crypto = require('crypto');

// 1. Generate a fresh ECDSA keypair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// 2. Sign a mandate
const payload = {
  nonce: crypto.randomUUID(),
  expiry: Date.now() + 86_400_000,
  sku: 'Organic Apples',
  authorized_amount: 1000,
  quantity: 1,
};
const canonical = JSON.stringify(payload, Object.keys(payload).sort());
const sig = crypto.createSign('SHA256');
sig.update(canonical); sig.end();
const signature = sig.sign(privateKey, 'base64');

// 3. POST to the API (Returns 403 UNREGISTERED_PUBLIC_KEY as expected for external keys)
fetch('http://localhost:3000/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mandate: { ...payload, signature, publicKeyPem: publicKey },
    fulfillment: { sku: 'Organic Apples (1kg)', actual_amount: 1010, quantity: 1 }
  }),
}).then(r => r.json()).then(console.log);
```

---
**Hackathon Compliance:** Built explicitly for Track 2 (Defensive). The "Malicious Fulfillment" generation in the UI is strictly a mock simulator designed solely to exercise the defensive verification engine. It contains no offensive AI capabilities.