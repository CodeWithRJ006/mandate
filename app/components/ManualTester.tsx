"use client";
import React, { useState } from 'react';

import { generateKeysAndSign, evaluateDiff } from '../actions';

export default function ManualTester({ context }: { context?: 'main' | 'eval' }) {
  const [authorizedSku, setAuthorizedSku] = useState("Organic Apples");
  const [authorizedAmount, setAuthorizedAmount] = useState<string>("2000");
  const [mandateQty, setMandateQty] = useState<string>("1");
  const [fulfilledSku, setFulfilledSku] = useState("Organic Apples (1kg)");
  const [fulfilledAmount, setFulfilledAmount] = useState<string>("2030");
  const [actualQty, setActualQty] = useState<string>("1");
  interface EvalResult {
    status?: 'APPROVED' | 'REJECTED';
    verdict?: string;
    reason?: string | null;
    error?: string;
    explainability?: {
      skuSimilarity?: number;
      amountVariancePct?: number;
      deltaAmount?: number;
      statusMessage?: string;
      authorizedTotal?: number;
      actualTotal?: number;
    };
  }
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);

  type Preset = { authSku: string; authAmt: string; authQty: string; fullSku: string; fullAmt: string; fullQty: string };
  const PRESETS: Record<string, Preset> = {
    'Groceries': { authSku: "Organic Apples", authAmt: "2000", authQty: "1", fullSku: "Organic Apples (1kg)", fullAmt: "2030", fullQty: "1" },
    'Electronics': { authSku: "iPhone 15 Pro", authAmt: "120000", authQty: "1", fullSku: "iPhone 15 Pro", fullAmt: "120150", fullQty: "1" },
    'Fashion': { authSku: "Nike Air Force 1", authAmt: "8500", authQty: "1", fullSku: "Nike Air Force 1", fullAmt: "8900", fullQty: "1" },
    'Custom': { authSku: "Premium Coffee Beans", authAmt: "1200", authQty: "1", fullSku: "Coffee Beans 250g", fullAmt: "1200", fullQty: "1" }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = PRESETS[e.target.value];
    if (preset) {
      setAuthorizedSku(preset.authSku);
      setAuthorizedAmount(preset.authAmt);
      setMandateQty(preset.authQty);
      setFulfilledSku(preset.fullSku);
      setFulfilledAmount(preset.fullAmt);
      setActualQty(preset.fullQty);
    }
  };

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Step 1: Sign the mandate using the server's registered identity (server action)
      const { augmentedPayload, signature, verificationBundle } = await generateKeysAndSign({
        sku: authorizedSku,
        authorized_amount: Number(authorizedAmount),
        quantity: Number(mandateQty)
      });

      const fulfillment = {
        sku: fulfilledSku,
        actual_amount: Number(fulfilledAmount),
        quantity: Number(actualQty)
      };

      // Step 2: Evaluate via server action — avoids cross-instance keyRegistry mismatch on Vercel
      const evalResult = await evaluateDiff(
        augmentedPayload,
        fulfillment,
        signature,
        verificationBundle.publicKeyPem
      );

      // Step 3: Compute explainability client-side for display
      const authTotal = Number(authorizedAmount) * Number(mandateQty);
      const actualTotal = Number(fulfilledAmount) * Number(actualQty);
      const delta = actualTotal - authTotal;
      const variancePct = authTotal > 0 ? parseFloat(((delta / authTotal) * 100).toFixed(2)) : 0;

      // Compute SKU similarity (Sørensen-Dice) client-side for display
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bigrams = (s: string) => { const b = new Set<string>(); for (let i = 0; i < s.length - 1; i++) b.add(s.substring(i, i + 2)); return b; };
      const n1 = norm(authorizedSku), n2 = norm(fulfilledSku);
      const bg1 = bigrams(n1), bg2 = bigrams(n2);
      let inter = 0; for (const bg of bg1) { if (bg2.has(bg)) inter++; }
      const similarity = n1 === n2 ? 1 : (n1.length < 2 || n2.length < 2) ? 0 : (2 * inter) / (bg1.size + bg2.size);

      setResult({
        status: evalResult.status,
        verdict: evalResult.status,
        reason: evalResult.reason || null,
        explainability: {
          skuSimilarity: similarity,
          amountVariancePct: variancePct,
          deltaAmount: delta,
          authorizedTotal: authTotal,
          actualTotal: actualTotal,
          statusMessage: evalResult.status === 'APPROVED'
            ? 'Approved: Within thresholds'
            : `Rejected: ${evalResult.reason?.replace(/_/g, ' ')}`
        }
      });
    } catch (err: unknown) {
      setResult({ error: (err as Error).message || 'Failed to evaluate transaction' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 my-6 text-slate-200 font-sans text-sm shadow-xl">
      <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
        <h3 className="text-xl font-bold text-white">Bring Your Own Transaction</h3>
        {context === 'main' && (
          <select 
            onChange={handlePresetChange}
            className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded p-1 focus:outline-none focus:border-blue-500"
          >
            <option value="Groceries">Groceries</option>
            <option value="Electronics">Electronics</option>
            <option value="Fashion">Fashion</option>
            <option value="Custom">Custom</option>
          </select>
        )}
      </div>
      <p className="text-slate-400 text-xs mb-4">
        Input custom values to test boundary detection on the live policy engine.
        {context === 'eval' && (
          <span className="block mt-1 text-emerald-400 font-semibold italic">Tested against the live production baseline (60% similarity / 2% tolerance) — independent of the sliders above.</span>
        )}
      </p>
      <form onSubmit={handleEvaluate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Authorized SKU</label>
            <input className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={authorizedSku} onChange={e => setAuthorizedSku(e.target.value)} />
          </div>
          <div className="col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Qty</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={mandateQty} onChange={e => setMandateQty(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Authorized Amount (&#8377;)</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={authorizedAmount} onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            setAuthorizedAmount(val);
          }} />
        </div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Fulfilled SKU</label>
            <input className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={fulfilledSku} onChange={e => setFulfilledSku(e.target.value)} />
          </div>
          <div className="col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Qty</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={actualQty} onChange={e => setActualQty(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Fulfilled Amount (&#8377;)</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={fulfilledAmount} onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            setFulfilledAmount(val);
          }} />
        </div>
        <button type="submit" disabled={loading} className="col-span-2 mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 rounded-lg font-bold text-white transition-all shadow-lg disabled:opacity-50">
          {loading ? "Evaluating..." : "Run Deterministic Diff Engine"}
        </button>
      </form>

      {loading && (
        <div className="mt-6 p-4 rounded-lg border border-slate-700 bg-slate-900/50 text-center text-slate-400 animate-pulse text-sm">
          ⏳ Running cryptographic verification &amp; policy diff engine...
        </div>
      )}

      {result && (
        <div className={`mt-6 p-4 rounded-lg border ${
          result.error
            ? 'bg-orange-950/40 border-orange-500/50'
            : result.verdict === 'APPROVED'
              ? 'bg-emerald-950/40 border-emerald-500/50'
              : 'bg-red-950/40 border-red-500/50'
        }`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3 border-b border-slate-800/50 pb-3">
            <span className={`font-black text-2xl tracking-tight ${
              result.error ? 'text-orange-400' : result.verdict === 'APPROVED' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {result.error ? '⚠ ERROR' : result.verdict === 'APPROVED' ? '✓ APPROVED' : '✗ REJECTED'}
            </span>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded ${
              result.error ? 'bg-orange-900/50 text-orange-300' : result.verdict === 'APPROVED' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
            }`}>
              {result.error ? result.error : result.reason ? result.reason.replace(/_/g, ' ') : 'WITHIN PARAMETERS'}
            </span>
          </div>

          {result.error && (
            <p className="text-sm text-orange-300 mt-1">
              The policy engine could not evaluate this request. Check your inputs and try again.
            </p>
          )}

          {!result.error && result.explainability && (
            <div className="text-sm space-y-2 text-slate-300">
              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-slate-900/60 rounded p-2 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Authorized</p>
                  <p className="font-mono font-bold text-blue-300">₹{result.explainability.authorizedTotal?.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/60 rounded p-2 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Actual</p>
                  <p className="font-mono font-bold text-white">₹{result.explainability.actualTotal?.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900/60 rounded p-2 text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Delta</p>
                  <p className={`font-mono font-bold ${(result.explainability.deltaAmount || 0) > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {(result.explainability.deltaAmount || 0) >= 0 ? '+' : ''}₹{result.explainability.deltaAmount}
                  </p>
                </div>
              </div>

              {/* Policy Metrics */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">SKU Similarity (Sørensen-Dice)</span>
                  <span className={`font-mono bg-slate-900 px-2 py-0.5 rounded font-bold ${
                    (result.explainability.skuSimilarity || 0) >= 0.6 ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    {((result.explainability.skuSimilarity || 0) * 100).toFixed(1)}%
                    <span className="text-slate-500 font-normal text-xs ml-1">(min 60%)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Amount Variance</span>
                  <span className={`font-mono bg-slate-900 px-2 py-0.5 rounded font-bold ${
                    Math.abs(result.explainability.amountVariancePct || 0) <= 2.0 ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    {result.explainability.amountVariancePct}%
                    <span className="text-slate-500 font-normal text-xs ml-1">(max 2.0%)</span>
                  </span>
                </div>
              </div>

              {/* Status message */}
              <p className="text-xs text-slate-500 italic mt-2 border-t border-slate-800/50 pt-2">
                {result.explainability.statusMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
