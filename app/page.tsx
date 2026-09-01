"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MandatePayload = {
  protocol: string;
  sku: string;
  authorized_amount: number;
  currency: string;
  nonce: string;
  expiry: string;
  signature: {
    alg: string;
    curve: string;
    r: string;
    s: string;
    der: string;
  };
};

type FulfillmentPayload = {
  protocol: string;
  sku: string;
  actual_amount: number;
  currency: string;
  line_items: Array<{
    description: string;
    amount: number;
    hidden?: boolean;
  }>;
  submitted_at: string;
};

function fakeEcdsaSignature(): MandatePayload["signature"] {
  const hex = (len: number) =>
    Array.from({ length: len }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");

  const r = hex(64);
  const s = hex(64);
  return {
    alg: "ES256",
    curve: "P-256",
    r: `0x${r}`,
    s: `0x${s}`,
    der: `3045022100${r.slice(0, 64)}0220${s.slice(0, 64)}`,
  };
}

function generateMandate(): MandatePayload {
  return {
    protocol: "AP2/v1",
    sku: "Organic Apples",
    authorized_amount: 2000,
    currency: "INR",
    nonce: `nonce_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    expiry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    signature: fakeEcdsaSignature(),
  };
}

function generateMaliciousFulfillment(): FulfillmentPayload {
  return {
    protocol: "AP2/v1",
    sku: "Organic Apples",
    actual_amount: 2150,
    currency: "INR",
    line_items: [
      { description: "Organic Apples", amount: 2000 },
      { description: "convenience_fee", amount: 150, hidden: true },
    ],
    submitted_at: new Date().toISOString(),
  };
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  return (
    <div className="relative">
      {label && (
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function DiffRow({
  field,
  mandateVal,
  fulfillmentVal,
  status,
}: {
  field: string;
  mandateVal: string;
  fulfillmentVal: string;
  status: "match" | "mismatch" | "hidden";
}) {
  const statusColor =
    status === "match"
      ? "text-emerald-500"
      : status === "hidden"
        ? "text-amber-400"
        : "text-red-500";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 border-b border-zinc-800/60 py-1.5 font-mono text-[11px]">
      <span className="truncate text-zinc-400">{mandateVal || "—"}</span>
      <span className="text-zinc-600">{field}</span>
      <span className={`truncate ${statusColor}`}>{fulfillmentVal || "—"}</span>
      <span className={`text-right text-[10px] uppercase ${statusColor}`}>
        {status === "match" ? "OK" : status === "hidden" ? "HIDDEN" : "FAIL"}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [mandateLoading, setMandateLoading] = useState(false);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [mandate, setMandate] = useState<MandatePayload | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentPayload | null>(
    null
  );
  const [trustScore, setTrustScore] = useState(99);
  const [auditActive, setAuditActive] = useState(false);
  const [policyFlash, setPolicyFlash] = useState(false);

  const handleGenerateMandate = useCallback(async () => {
    setMandateLoading(true);
    setMandate(null);
    await new Promise((r) => setTimeout(r, 1200));
    setMandate(generateMandate());
    setMandateLoading(false);
  }, []);

  const handleSubmitFulfillment = useCallback(async () => {
    setFulfillmentLoading(true);
    setFulfillment(null);
    setAuditActive(false);
    setTrustScore(99);
    await new Promise((r) => setTimeout(r, 900));
    const payload = generateMaliciousFulfillment();
    setFulfillment(payload);
    setFulfillmentLoading(false);
    setAuditActive(true);
  }, []);

  useEffect(() => {
    if (!auditActive) return;
    setPolicyFlash(true);
    const interval = setInterval(() => setPolicyFlash((f) => !f), 600);
    return () => clearInterval(interval);
  }, [auditActive]);

  useEffect(() => {
    if (!auditActive) return;
    setTrustScore(99);
    const steps = [97, 94, 91, 88, 85];
    let i = 0;
    const timer = setInterval(() => {
      if (i < steps.length) {
        setTrustScore(steps[i]);
        i++;
      } else {
        clearInterval(timer);
      }
    }, 400);
    return () => clearInterval(timer);
  }, [auditActive]);

  const hiddenFee = useMemo(
    () => fulfillment?.line_items.find((item) => item.hidden)?.amount ?? 0,
    [fulfillment]
  );

  const amountMismatch =
    mandate && fulfillment
      ? fulfillment.actual_amount !== mandate.authorized_amount
      : false;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
              UAP RECOURSE · LIABILITY LAYER
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Razorpay Deterministic Policy Engine · AP2 Protocol Monitor
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              LIVE
            </span>
            <span>v0.1.0</span>
          </div>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-57px)] grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-3">
        {/* Column 1: User Agent Terminal */}
        <section className="flex flex-col bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
              User Agent Terminal
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
              AP2 Intent Mandate · ECDSA-SHA256
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <button
              type="button"
              onClick={handleGenerateMandate}
              disabled={mandateLoading}
              className="w-full rounded border border-emerald-800/60 bg-emerald-950/40 px-4 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-950/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mandateLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border border-emerald-600 border-t-emerald-300" />
                  Signing Mandate…
                </span>
              ) : (
                "Generate AP2 Mandate"
              )}
            </button>

            <div className="flex-1">
              {mandate ? (
                <JsonBlock data={mandate} label="raw_payload" />
              ) : (
                <div className="flex h-32 items-center justify-center rounded border border-dashed border-zinc-800 font-mono text-[11px] text-zinc-600">
                  {mandateLoading ? "Awaiting signature…" : "No mandate generated"}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Column 2: Merchant Terminal */}
        <section className="flex flex-col bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Merchant Terminal
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
              Fulfillment Submission · Zepto Agent
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            <button
              type="button"
              onClick={handleSubmitFulfillment}
              disabled={fulfillmentLoading}
              className="w-full rounded border border-amber-800/60 bg-amber-950/30 px-4 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-amber-400 transition hover:bg-amber-950/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fulfillmentLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border border-amber-600 border-t-amber-300" />
                  Submitting…
                </span>
              ) : (
                "Submit Fulfillment"
              )}
            </button>

            <div className="flex-1">
              {fulfillment ? (
                <JsonBlock data={fulfillment} label="fulfillment_payload" />
              ) : (
                <div className="flex h-32 items-center justify-center rounded border border-dashed border-zinc-800 font-mono text-[11px] text-zinc-600">
                  {fulfillmentLoading
                    ? "Packaging fulfillment…"
                    : "No fulfillment submitted"}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Column 3: Razorpay Audit Log */}
        <section className="flex flex-col bg-zinc-900">
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Razorpay Audit Log
            </h2>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
              Liability Layer · Deterministic Diff
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4">
            {/* Policy Engine Status */}
            <div
              className={`rounded border px-3 py-2 transition-colors duration-300 ${
                auditActive
                  ? policyFlash
                    ? "border-red-600 bg-red-950/60"
                    : "border-red-900/80 bg-red-950/30"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Deterministic Policy Engine
                </span>
                <span
                  className={`font-mono text-[10px] font-bold uppercase ${
                    auditActive ? "text-red-400" : "text-zinc-600"
                  }`}
                >
                  {auditActive ? "VIOLATION DETECTED" : "IDLE"}
                </span>
              </div>
              {auditActive && (
                <p className="mt-1 font-mono text-[11px] text-red-400">
                  AMOUNT_EXCEEDED · hidden fee +₹{hiddenFee} detected
                </p>
              )}
            </div>

            {/* Trust Score */}
            <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Trust Score
                </span>
                <span
                  className={`font-mono text-lg font-bold tabular-nums ${
                    trustScore <= 85
                      ? "text-red-400"
                      : trustScore <= 92
                        ? "text-amber-400"
                        : "text-emerald-400"
                  }`}
                >
                  {trustScore}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    trustScore <= 85 ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${trustScore}%` }}
                />
              </div>
              {auditActive && (
                <p className="mt-1 font-mono text-[10px] text-zinc-600">
                  Δ −14 pts · merchant agent deviation
                </p>
              )}
            </div>

            {/* Dispute State Machine */}
            <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Dispute State Machine
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["AUTHORIZED", "FULFILLED", "AUDIT", "DISPUTE", "REFUND"].map(
                  (state, idx) => {
                    const active =
                      auditActive &&
                      (state === "AUDIT" ||
                        state === "DISPUTE" ||
                        state === "REFUND");
                    const current = auditActive && state === "REFUND";
                    return (
                      <span
                        key={state}
                        className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                          current
                            ? "bg-red-600 text-white"
                            : active
                              ? "bg-red-950 text-red-400 ring-1 ring-red-800"
                              : idx < 2
                                ? "bg-zinc-800 text-zinc-500"
                                : "bg-zinc-900 text-zinc-700"
                        }`}
                      >
                        {state}
                      </span>
                    );
                  }
                )}
              </div>
              {auditActive && (
                <p className="mt-2 font-mono text-[11px] font-semibold text-red-400">
                  FLAGGED — AUTO REFUND INITIATED
                </p>
              )}
            </div>

            {/* Visual Diff */}
            <div className="flex-1 rounded border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                JSON Diff · mandate ↔ fulfillment
              </div>

              {!mandate && !fulfillment ? (
                <p className="font-mono text-[11px] text-zinc-600">
                  Awaiting payloads for diff analysis…
                </p>
              ) : (
                <div>
                  <div className="mb-2 grid grid-cols-[1fr_auto_1fr_auto] gap-2 font-mono text-[9px] uppercase text-zinc-600">
                    <span>Mandate</span>
                    <span>Field</span>
                    <span>Fulfillment</span>
                    <span className="text-right">Status</span>
                  </div>

                  <DiffRow
                    field="sku"
                    mandateVal={mandate?.sku ?? "—"}
                    fulfillmentVal={fulfillment?.sku ?? "—"}
                    status={
                      mandate && fulfillment
                        ? mandate.sku === fulfillment.sku
                          ? "match"
                          : "mismatch"
                        : "match"
                    }
                  />
                  <DiffRow
                    field="amount"
                    mandateVal={
                      mandate ? `₹${mandate.authorized_amount}` : "—"
                    }
                    fulfillmentVal={
                      fulfillment ? `₹${fulfillment.actual_amount}` : "—"
                    }
                    status={
                      mandate && fulfillment
                        ? amountMismatch
                          ? "mismatch"
                          : "match"
                        : "match"
                    }
                  />
                  {fulfillment && hiddenFee > 0 && (
                    <DiffRow
                      field="hidden_fee"
                      mandateVal="₹0 (not authorized)"
                      fulfillmentVal={`₹${hiddenFee}`}
                      status="hidden"
                    />
                  )}

                  {auditActive && amountMismatch && (
                    <div className="mt-3 rounded border border-red-900/50 bg-red-950/20 p-2 font-mono text-[10px] text-red-400">
                      POLICY_REJECT: actual_amount ({fulfillment?.actual_amount})
                      exceeds authorized_amount ({mandate?.authorized_amount ??
                        2000}) + 2% tolerance
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
