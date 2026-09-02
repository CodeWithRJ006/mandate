'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function EvalDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/eval')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  if (loading || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 font-mono">
      Executing Test Pipeline...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <header className="mb-10 text-center relative max-w-6xl mx-auto">
        <Link href="/" className="absolute left-0 top-2 text-blue-400 hover:text-blue-300 font-medium transition-colors">
          &larr; Back to UAP Sandbox
        </Link>
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 tracking-tight">
          Risk Engine Evaluation
        </h1>
        <p className="mt-2 text-slate-400">Offline Dataset Metrics & Confusion Matrix</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wide">Recall</h3>
            <div className="text-5xl font-black text-emerald-400 mt-2">{(data.metrics.recall * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wide">Precision</h3>
            <div className="text-5xl font-black text-blue-400 mt-2">{(data.metrics.precision * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wide">False Positive Rate (FPR)</h3>
            <div className="text-5xl font-black text-amber-400 mt-2">{(data.metrics.fpr * 100).toFixed(1)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Confusion Matrix */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-white border-b border-slate-800 pb-2">Confusion Matrix</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-emerald-900/30 border border-emerald-500/50 p-6 rounded-lg">
                <div className="text-emerald-400 font-black text-4xl">{data.matrix.TP}</div>
                <div className="text-xs text-slate-400 mt-2 uppercase tracking-wide">True Positives</div>
                <div className="text-[11px] text-slate-500 mt-1">(Fraud Blocked)</div>
              </div>
              <div className="bg-amber-900/30 border border-amber-500/50 p-6 rounded-lg">
                <div className="text-amber-400 font-black text-4xl">{data.matrix.FP}</div>
                <div className="text-xs text-slate-400 mt-2 uppercase tracking-wide">False Positives</div>
                <div className="text-[11px] text-amber-500/80 mt-1 font-bold">(Merchant Friction)</div>
              </div>
              <div className="bg-red-900/30 border border-red-500/50 p-6 rounded-lg">
                <div className="text-red-400 font-black text-4xl">{data.matrix.FN}</div>
                <div className="text-xs text-slate-400 mt-2 uppercase tracking-wide">False Negatives</div>
                <div className="text-[11px] text-red-500/80 mt-1 font-bold">(Razorpay Liability)</div>
              </div>
              <div className="bg-slate-800 p-6 rounded-lg border border-slate-700">
                <div className="text-white font-black text-4xl">{data.matrix.TN}</div>
                <div className="text-xs text-slate-400 mt-2 uppercase tracking-wide">True Negatives</div>
                <div className="text-[11px] text-slate-500 mt-1">(Valid Approved)</div>
              </div>
            </div>
          </div>

          {/* Tradeoff Summary & Raw Results */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
              <h2 className="text-xl font-bold mb-4 text-white border-b border-slate-800 pb-2">Business Tradeoff Summary</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                At a 2.0% tolerance threshold, our FPR is kept manageable. <strong className="text-amber-400">False positives generate merchant support tickets</strong>, whereas <strong className="text-red-400">False negatives represent unrecoverable financial liability</strong>. The engine is tuned for high recall ({">"}90%) to protect Razorpay's liability, while containing merchant friction.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
              <h2 className="text-sm font-bold mb-4 text-white uppercase tracking-wider">Test Suite Execution Log</h2>
              <div className="space-y-2 max-h-[300px] overflow-auto pr-2">
                {data.results.map((r: any, i: number) => (
                  <div key={i} className="text-xs flex justify-between items-center border-b border-slate-800/50 pb-2">
                    <span className="text-slate-300 font-medium">{r.name}</span>
                    <span className={`font-mono px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${r.isFlagged ? 'bg-red-900/30 text-red-400 border border-red-500/20' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20'}`}>
                      {r.isFlagged ? `FLAGGED: ${r.reason}` : 'APPROVED'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
