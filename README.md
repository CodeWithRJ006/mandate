# Razorpay UAP Recourse Layer 🛡️

A Deterministic Autonomous Agent Auditing system built for the Razorpay Hackathon. This project prototypes a recourse layer for the Unified Authorization Protocol (UAP), resolving disputes between AI agents autonomously using deterministic validation and cryptographic proofs.

## 🚀 Overview

As AI agents increasingly handle purchasing and fulfillment on behalf of users, we need robust recourse layers to evaluate discrepancies (e.g., an agent purchasing *Organic Apples* but the fulfillment agent padding the amount or substituting the SKU). 

This prototype simulates a user-agent authorizing a transaction, an adversarial merchant-agent (Zepto) fulfilling it, and a Razorpay auditing layer validating the transaction natively.

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router) + Tailwind CSS
- **LLM Engine**: Groq API + `llama-3.3-70b-versatile` (using OpenAI SDK)
- **Cryptography**: Node.js Native Crypto (`ECDSA prime256v1`, `SHA-256`)
- **Diff Engine**: `string-similarity` (Dice's Coefficient)

### System Components

1. **AP2 Cryptography Layer**: 
   - Generates deterministic ECDSA `prime256v1` keypairs.
   - Wraps the user's intent payload with a v4 UUID `nonce` and +24hr `expiry` timestamp.
   - Signs and verifies the data string deterministically.
2. **LLM Agent Routing**: 
   - Forces deterministic structured JSON generation via `response_format: { type: 'json_object' }`.
   - Includes intelligent retry wrappers and mock fallbacks to guarantee uptime during live demos.
3. **Deterministic Diff Engine**: 
   - **Amount Tolerance:** Allows `<= 2%` variation in price.
   - **SKU Semantic Matching:** Allows minor typos (Similarity `> 0.85`) but strictly rejects mismatched products.
4. **State Machine UI**:
   - Manages strict UI states preventing out-of-order execution.
   - Lifecycle: `IDLE` ➔ `SETTLED` / `FLAGGED (AUTO-REFUND)` ➔ `DISPUTED` ➔ `RESOLVED`.
   - Dynamically tracks Merchant Trust Scores (99 vs 85).

---

## 🔍 What's Real vs. Simulated

- **Real:** Live LLM Agent routing via Groq's high-speed inference, real `ECDSA prime256v1` cryptography (sign & verify), semantic string diffing (`string-similarity`), and exact percentage-based amount tolerances.
- **Simulated:** Actual banking rails/money movement, and the adversarial prompting (the merchant agent is explicitly prompted to cheat in "Malicious Mode" strictly for demo purposes).

---

## 💻 Getting Started (Local Development)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables. Create a `.env.local` file in the root:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser. 
   - *Note: If the `GROQ_API_KEY` is omitted, the app will gracefully fall back to mock JSON payloads so the UI demo never breaks.*

---
*Built for the Razorpay Hackathon.*
