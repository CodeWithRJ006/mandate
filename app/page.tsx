/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { generateKeysAndSign, evaluateDiff } from './actions';

export default function Dashboard() {
  // User State
  const [keys, setKeys] = useState<any>(null);
  const [mandate, setMandate] = useState<any>(null);
  const [signature, setSignature] = useState<string>('');

  // Merchant State
  const [fulfillment, setFulfillment] = useState<any>(null);

  // Audit/Global State
  const [status, setStatus] = useState<string>('IDLE'); // IDLE, SETTLED, FLAGGED, DISPUTED, RESOLVED
  const [trustScore, setTrustScore] = useState<number>(99);
  const [flashColor, setFlashColor] = useState<string>('');
  const [loading, setLoading] = useState<string>('');

  const triggerFlash = (color: string) => {
    setFlashColor(color);
    setTimeout(() => setFlashColor(''), 1000);
  };

  const handleGenerateMandate = async () => {
    setLoading('USER');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER' })
      });
      const intentMandate = await res.json();
      
      const { keys, augmentedPayload, signature } = await generateKeysAndSign(intentMandate);
      setKeys(keys);
      setMandate(augmentedPayload);
      setSignature(signature);
      setStatus('IDLE');
      setFulfillment(null);
    } catch (e) {
      console.error(e);
    }
    setLoading('');
  };

  const handleMerchantSubmit = async (mode: 'valid' | 'malicious') => {
    if (!mandate) return alert('Generate a user mandate first!');
    setLoading('MERCHANT');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'MERCHANT', mode, mandate })
      });
      const payload = await res.json();
      setFulfillment(payload);

      // Evaluate deterministically
      const evaluation = await evaluateDiff(
        { sku: mandate.sku, authorized_amount: mandate.authorized_amount },
        { sku: payload.sku, actual_amount: payload.actual_amount }
      );

      if (evaluation.status === 'APPROVED') {
        setStatus('SETTLED');
        triggerFlash('bg-green-500/20');
        setTrustScore(99);
      } else {
        setStatus('FLAGGED');
        triggerFlash('bg-red-500/20');
        setTrustScore(85);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading('');
  };

  const handleAppeal = () => {
    setStatus('DISPUTED');
  };

  const handleAdminAccept = () => {
    setStatus('RESOLVED');
    setTrustScore(99);
    triggerFlash('bg-green-500/20');
  };

  return (
    <div className={`min-h-screen p-8 text-slate-200 bg-slate-950 transition-colors duration-500 ${flashColor}`}>
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
          Razorpay UAP Recourse Layer
        </h1>
        <p className="mt-2 text-slate-400">Deterministic Autonomous Agent Auditing</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        
        {/* User Terminal */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 flex flex-col p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-blue-400 border-b border-slate-800 pb-2">User Terminal</h2>
          
          <button 
            onClick={handleGenerateMandate}
            disabled={!!loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50"
          >
            {loading === 'USER' ? 'Generating...' : 'Generate AP2 Mandate'}
          </button>

          {mandate && (
            <div className="mt-6 flex-1 overflow-auto text-sm space-y-4">
              <div>
                <span className="text-slate-500 font-mono">Payload:</span>
                <pre className="mt-1 p-3 bg-black rounded-lg border border-slate-800 text-emerald-300 break-words whitespace-pre-wrap">
                  {JSON.stringify(mandate, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-slate-500 font-mono">ECDSA Signature:</span>
                <pre className="mt-1 p-3 bg-black rounded-lg border border-slate-800 text-purple-300 break-words whitespace-pre-wrap overflow-hidden">
                  {signature.substring(0, 100)}...
                </pre>
              </div>
              <div>
                <span className="text-slate-500 font-mono">Public Key (prime256v1):</span>
                <pre className="mt-1 p-3 bg-black rounded-lg border border-slate-800 text-blue-300 text-xs break-words whitespace-pre-wrap">
                  {keys.publicKey}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Merchant Terminal */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 flex flex-col p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-amber-400 border-b border-slate-800 pb-2">Merchant Terminal</h2>
          
          <div className="space-y-3">
            <button 
              onClick={() => handleMerchantSubmit('valid')}
              disabled={!mandate || !!loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50"
            >
              Submit Valid Fulfillment (Happy Path)
            </button>
            <button 
              onClick={() => handleMerchantSubmit('malicious')}
              disabled={!mandate || !!loading}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50"
            >
              Submit Malicious Fulfillment (Adversarial)
            </button>
          </div>

          {fulfillment && (
            <div className="mt-6 flex-1 overflow-auto text-sm">
              <span className="text-slate-500 font-mono">Fulfillment Payload:</span>
              <pre className="mt-1 p-3 bg-black rounded-lg border border-slate-800 text-amber-300 break-words whitespace-pre-wrap">
                {JSON.stringify(fulfillment, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Razorpay Audit Log */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 flex flex-col p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-red-500"></div>
          <h2 className="text-xl font-semibold mb-4 text-white border-b border-slate-800 pb-2">Razorpay Audit Log</h2>
          
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-slate-400 text-sm">Merchant Trust Score</p>
              <div className={`text-5xl font-black transition-all duration-700 ${trustScore === 99 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trustScore}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-slate-400 text-sm">Transaction Status</p>
              <div className={`mt-1 font-mono font-bold text-lg p-3 rounded border
                ${status === 'IDLE' ? 'bg-slate-800 border-slate-700 text-slate-300' : ''}
                ${status === 'SETTLED' ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400' : ''}
                ${status === 'FLAGGED' ? 'bg-red-900/40 border-red-500/50 text-red-400' : ''}
                ${status === 'DISPUTED' ? 'bg-amber-900/40 border-amber-500/50 text-amber-400' : ''}
                ${status === 'RESOLVED' ? 'bg-blue-900/40 border-blue-500/50 text-blue-400' : ''}
              `}>
                {status === 'FLAGGED' ? 'FLAGGED — AUTO REFUND' : status}
              </div>
            </div>

            {status === 'FLAGGED' && (
              <button 
                onClick={handleAppeal}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
              >
                Appeal (Merchant)
              </button>
            )}

            {status === 'DISPUTED' && (
              <button 
                onClick={handleAdminAccept}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Accept Appeal (Admin)
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
