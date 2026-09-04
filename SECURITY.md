# Security Policy

This project implements a prototype **Agentic Recourse Layer** and cryptographic boundary for the Unified Agent Protocol (UAP), developed for the Razorpay Track 2 Buildathon. 

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Threat Model & Security Posture

### What is in Scope (Defended)
1. **Unsigned/Tampered Payloads:** Any payload missing a W3C-style ECDSA prime256v1 signature, or possessing a signature that does not mathematically match the payload contents, is strictly rejected (`401` / `403`).
2. **Untrusted Agents:** Signatures must belong to a known public key registered in the `KeyRegistry`. Arbitrary keypairs are rejected.
3. **Replay Attacks:** The `nonceStore` guards against duplicated nonces for previously settled mandates.
4. **Mandate Expiry:** Mandates enforce strict temporal limits (`24 hours`). 
5. **Quantity Nullification:** Evaluates and strictly nullifies `quantity: 0` or missing quantity parameters.
6. **Amount/SKU Drift:** Protects the merchant and payment aggregator from AI hallucination by enforcing deterministic price boundaries (`<= 2.0%`) and semantic semantic thresholds (`> 0.60`).

### Known Limitations (Non-Production Prototype)
As this is a prototype, several components prioritize demonstration speed over production-grade security:
- **In-Memory Storage:** The `globalLedger`, `nonceStore`, and `keyRegistry` use Node.js memory structures (Sets/Arrays). On a serverless platform (like Vercel), these reset during cold starts. A production environment must implement persistent, atomic stores (e.g., Redis for nonces with TTL, PostgreSQL/Kafka for the ledger).
- **Ephemeral Key Generation:** For demonstration purposes, private keys are generated via a Next.js Server Action and exposed to the browser to simulate an autonomous client agent. In production, private keys must **never** be generated on the aggregator backend. They must be stored in secure hardware enclaves (HSM/KMS) or client wallets, utilizing W3C Verifiable Credentials (VCs) and Decentralized Identifiers (DIDs).
- **Shared Demo Identity (Static Keypair):** To circumvent Vercel's multi-instance synchronization limits (where concurrent lambdas lose in-memory `keyRegistry` parity), the demonstration application vends a single static ECDSA keypair to all simulated agents. While the cryptographic signature math remains strictly enforced, this shared key implies all transactions in the live demo use identical identity binding.
- **Hardcoded Identity Seed:** A hardcoded public key exists in the `keyRegistry` initialization solely to allow the `cURL` API verification step in the README to function across deployments. 

## Reporting a Vulnerability

As this is a public hackathon demonstration repository, there is no private vulnerability disclosure program. However, if you are a reviewer or judge and discover a bypass to the cryptographic verification logic that is **not** explicitly listed in the Known Limitations above, please open an Issue on this GitHub repository. 
