"use client";
import React, { useState } from 'react';

export default function ManualTester() {
  const [authorizedSku, setAuthorizedSku] = useState("Organic Apples");
  const [authorizedAmount, setAuthorizedAmount] = useState(2000);
  const [fulfilledSku, setFulfilledSku] = useState("Organic Apples (1kg)");
  const [fulfilledAmount, setFulfilledAmount] = useState(2030);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mandate: { sku: authorizedSku, authorized_amount: Number(authorizedAmount), quantity: 1 },
        fulfillment: { sku: fulfilledSku, actual_amount: Number(fulfilledAmount), quantity: 1 }
      })
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 my-6 text-slate-200 font-sans text-sm shadow-xl">
      <h3 className="text-xl font-bold text-white mb-2 border-b border-slate-800 pb-2">Bring Your Own Transaction</h3>
      <p className="text-slate-400 text-xs mb-4">Input custom values to test boundary detection on the live policy engine.</p>
      <form onSubmit={handleEvaluate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Authorized SKU</label>
          <input className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={authorizedSku} onChange={e => setAuthorizedSku(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Authorized Amount (&#8377;)</label>
          <input type="number" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={authorizedAmount} onChange={e => setAuthorizedAmount(Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Fulfilled SKU</label>
          <input className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={fulfilledSku} onChange={e => setFulfilledSku(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Fulfilled Amount (&#8377;)</label>
          <input type="number" className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 transition-colors" value={fulfilledAmount} onChange={e => setFulfilledAmount(Number(e.target.value))} />
        </div>
        <button type="submit" disabled={loading} className="col-span-2 mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 rounded-lg font-bold text-white transition-all shadow-lg disabled:opacity-50">
          {loading ? "Evaluating..." : "Run Deterministic Diff Engine"}
        </button>
      </form>

      {result && (
        <div className={`mt-6 p-4 rounded-lg border ${result.verdict === 'APPROVED' ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-red-950/40 border-red-500/50'}`}>
          <div className="flex justify-between items-center mb-3 border-b border-slate-800/50 pb-2">
            <span className={`font-black text-lg ${result.verdict === 'APPROVED' ? 'text-emerald-400' : 'text-red-400'}`}>{result.verdict}</span>
            <span className="text-xs font-medium text-slate-400 uppercase">{result.reason || "Within Authorized Parameters"}</span>
          </div>
          <div className="text-sm space-y-1.5 text-slate-300">
            <p>SKU Similarity Score: <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">{(result.explainability.skuSimilarity * 100).toFixed(1)}%</span> <span className="text-xs text-slate-500">(Threshold: 60%)</span></p>
            <p>Amount Variance: <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">{result.explainability.amountVariancePct}%</span> <span className="text-xs text-slate-500">(Max Allowed: 2.0%)</span></p>
            <p>Delta: <span className="font-bold">&#8377;{result.explainability.deltaAmount}</span> <span className="text-xs text-slate-400 italic">({result.explainability.statusMessage})</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
