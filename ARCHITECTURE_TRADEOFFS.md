# Architecture Tradeoffs & Production Scalability 🚀

This document outlines the design decisions made for the Razorpay UAP Recourse Layer prototype and how the architecture must evolve to support enterprise-grade production scale, security, and regulatory compliance.

## 1. Identity & Mandates
- **Prototype:** Uses raw `ECDSA prime256v1` keypairs stored ephemerally in memory to demonstrate the cryptographic validation loop.
- **Production Evolution:** Must adopt **W3C Verifiable Credentials (VCs)** and **Decentralized Identifiers (DIDs)**. These identifiers should be immutably mapped to verified merchant GSTIN/KYC entities on a secure registry, ensuring non-repudiation and standards-compliant identity verification across the Unified Agent Protocol (UAP).

## 2. Key Lifecycle Management
- **Prototype:** Generates and holds ephemeral cryptographic keys in the Node.js memory space for speed and simplicity during the demo.
- **Production Evolution:** Key generation and signing operations must be delegated to enterprise **Hardware Security Modules (HSMs)** or managed services like **AWS KMS / Google Cloud KMS**. All data at rest must utilize strict **envelope encryption** to protect the master keys and prevent extraction.

## 3. Reconciliation & Diff Engine
- **Prototype:** Relies on the Sørensen–Dice coefficient (`string-similarity`) enforcing a static `>0.85` threshold alongside a static `2%` hardcoded price tolerance.
- **Production Evolution:** Will transition to a fine-tuned **vector embedding model** operating within a low-latency **WebAssembly (Wasm)** or dedicated microservice sandbox. This engine will feature **dynamic, merchant-configurable tolerance matrices**, allowing variable logic based on product categories, temporal pricing, and merchant-specific risk profiles.

## 4. Resilience & High-Throughput Pipelines
- **Prototype:** Executes LLM inferences and deterministic validations synchronously via Next.js serverless API routes.
- **Production Evolution:** Real-world aggregators process tens of thousands of Transactions Per Second (TPS). Production architecture requires an asynchronous, event-driven messaging layer (e.g., **Apache Kafka** or **AWS SQS FIFO**). The system must utilize idempotent processing with strict **Dead Letter Queues (DLQs)** to handle recourse and evaluation events out-of-band, ensuring that core payment rails are never blocked by arbitration latency.

## 5. Chargeback & Dispute Arbitration
- **Prototype:** Instantly mutates state from `FLAGGED` to `DISPUTED` to `RESOLVED` to demonstrate the capability of an autonomous recourse layer.
- **Production Evolution:** Requires full alignment with existing regulatory frameworks. The state machine must be deeply integrated with **RBI and NPCI chargeback operational cycles**, strictly enforcing timeline regulations such as **T+1 presentment** and **T+7 arbitration windows**.
