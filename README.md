# Razorpay UAP Recourse Layer

A deterministic dispute resolution and recourse layer addressing the post-transaction liability gap for NPCI's Unified Agent Protocol (UAP). As AI agents increasingly handle autonomous purchasing and fulfillment, this system provides mathematical and cryptographic guarantees to settle disputes without human intervention.

## Architecture Flow

```text
[User Agent] 
     │
     ▼ (1. Generate Intent)
[AP2 Mandate: ECDSA Signed + Nonce + Expiry]
     │
     ▼ (2. Transmit Mandate)
[Merchant Agent (Zepto)]
     │
     ▼ (3. Fulfill Order / Generate Payload)
[Fulfillment Payload]
     │
     ▼ (4. Evaluate & Diff)
[Deterministic Diff Engine] ──> (SKU Match >85%, Amount Tolerance <=2%)
     │
     ├──> [Match] ──> [Razorpay Settlement: APPROVED]
     │
     └──> [Mismatch] ──> [Razorpay Recourse: FLAGGED (AUTO-REFUND)]
```

## Setup Instructions

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
   *(Note: If the `GROQ_API_KEY` is omitted, the app will gracefully fall back to mock JSON payloads so the UI demo never breaks.)*

## What's Real vs. Simulated

- **Real:** Llama 3.3 70B inference via Groq (zero-cost, model-agnostic architecture), real ECDSA prime256v1 cryptography (sign/verify), semantic string diffing (>0.85 tolerance), and percentage-based amount tolerances (<= 2%).
- **Simulated:** Bank settlement rails, and adversarial merchant prompting (forced for demo purposes).
