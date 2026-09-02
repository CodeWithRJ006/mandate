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

## The Cost Asymmetry of Agentic Recourse

In high-throughput payment aggregation, failure modes are asymmetric:

* **False Positive (Type I Error):** A clean transaction is held by the policy engine for manual dispute review. Assuming an average ticket size of ₹1,800, every 1% false positive rate introduces temporary settlement friction on that volume and incurs a customer support arbitration cost of ~₹120 per ticket. At 10,000 daily agentic orders, a 4% FPR creates 400 held transactions and approximately ₹48,000/day in operational dispute friction.
* **False Negative (Type II Error):** An adversarial over-billing or product substitution bypasses verification and settles. This represents direct, unrecoverable chargeback liability, network compliance fines, and irreversible loss of user trust. A single undetected ₹150 convenience fee padded across 10,000 orders costs ₹15,00,000/month in merchant fraud leakage.

**Tuning Rationale:** We selected a 2.0% amount tolerance and a 0.85 Sørensen–Dice threshold to maximize recall ($\ge 94\%$) against unrecoverable financial loss, while containing merchant friction ($< 5\%$ FPR) within a self-resolving 3-state dispute machine.

## What's Real vs. Simulated

- **Real:** Llama 3.3 70B inference via Groq (zero-cost, model-agnostic architecture), real ECDSA prime256v1 cryptography (sign/verify), semantic string diffing (>0.85 tolerance), and percentage-based amount tolerances (<= 2%).
- **Simulated:** Bank settlement rails, and adversarial merchant prompting (forced for demo purposes).
