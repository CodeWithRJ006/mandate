/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { generateKeysAndSign, evaluateDiff, AgentExecutionTelemetry, MandateVerificationBundle } from './actions';
import EvidenceDrawer from './components/EvidenceDrawer';
import ManualTester from './components/ManualTester';

export default function Dashboard() {
  // User State
  const [keys, setKeys] = useState<any>(null);
  const [mandate, setMandate] = useState<any>(null);
  const [signature, setSignature] = useState<string>('');
  const [userTelemetry, setUserTelemetry] = useState<AgentExecutionTelemetry | null>(null);
  const [verificationBundle, setVerificationBundle] = useState<MandateVerificationBundle | null>(null);

  // Merchant State
  const [fulfillment, setFulfillment] = useState<any>(null);
  const [merchantTelemetry, setMerchantTelemetry] = useState<AgentExecutionTelemetry | null>(null);

  // Audit/Global State
  const [status, setStatus] = useState<string>('IDLE');
  const [trustScore, setTrustScore] = useState<number>(99);
  const [flashColor, setFlashColor] = useState<string>('');
  const [preset, setPreset] = useState<string>('Groceries');
  
  // Execution Guards
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [apiWarning, setApiWarning] = useState<string>('');

  const triggerFlash = (color: string) => {
    setFlashColor(color);
    setTimeout(() => setFlashColor(''), 1000);
  };

  const handleCopyCommand = () => {
    if (!verificationBundle) return;
    const escapedPem = verificationBundle.publicKeyPem.replace(/\n/g, '\\n');
    const escapedCanonical = verificationBundle.canonicalString.replace(/"/g, '\\"');
    const cmd = `node -e "const crypto=require('crypto');const v=crypto.createVerify('SHA256');v.update('${escapedCanonical}');v.end();console.log('Signature Verified:',v.verify('${escapedPem}','${verificationBundle.signature}','base64'));"`;
    navigator.clipboard.writeText(cmd);
    alert('Independent verification command copied to clipboard!');
  };

  const handleGenerateMandate = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setApiWarning('');
    setUserTelemetry(null);
    setVerificationBundle(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER', preset })
      });
      const responseJson = await res.json();
      
      if (responseJson.telemetry?.retriesUsed > 0) {
        setApiWarning(`Rate limit encountered. Auto-retry triggered (Attempt ${responseJson.telemetry.retriesUsed} of 2)... Recovering.`);
      }

      const intentMandate = responseJson.data;
      setUserTelemetry(responseJson.telemetry);
      
      const { keys, augmentedPayload, signature, verificationBundle } = await generateKeysAndSign(intentMandate);
      setKeys(keys);
      setMandate(augmentedPayload);
      setSignature(signature);
      setVerificationBundle(verificationBundle);
      setStatus('IDLE');
      setFulfillment(null);
      setMerchantTelemetry(null);
    } catch (e) {
      console.error(e);
      setApiWarning('Critical network failure triggering fallback execution.');
    }
    setIsProcessing(false);
  };

  const handleMerchantSubmit = async (mode: 'valid' | 'malicious') => {
    if (!mandate || isProcessing) return;
    setIsProcessing(true);
    setApiWarning('');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'MERCHANT', mode, mandate })
      });
      const responseJson = await res.json();
      
      if (responseJson.telemetry?.retriesUsed > 0) {
        setApiWarning(`Rate limit encountered. Auto-retry triggered (Attempt ${responseJson.telemetry.retriesUsed} of 2)... Recovering.`);
      }

      const payload = responseJson.data;
      setFulfillment(payload);
      setMerchantTelemetry(responseJson.telemetry);

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
      setApiWarning('Critical network failure during fulfillment execution.');
    }
    setIsProcessing(false);
  };

  const handleAppeal = () => { if(!isProcessing) setStatus('DISPUTED'); };
  const handleAdminAccept = () => {
    if(!isProcessing) {
      setStatus('RESOLVED');
      setTrustScore(99);
      triggerFlash('bg-green-500/20');
    }
  };

  return (
    <div className={`min-h-screen p-8 text-slate-200 bg-slate-950 transition-colors duration-500 ${flashColor}`}>
      <header className="mb-10 text-center relative max-w-6xl mx-auto">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
          Razorpay UAP · AI Risk Manager
        </h1>
        <p className="mt-2 text-slate-400">Detector · Verifier · Auto-Responder</p>
        <div className="mt-4">
          <Link href="/eval" className="text-sm font-medium text-purple-400 hover:text-purple-300 border border-purple-500/30 bg-purple-900/20 px-4 py-2 rounded-full transition-colors inline-block">
            📊 View Risk Engine Evaluation Harness
          </Link>
        </div>
      </header>

      {apiWarning && (
        <div className="max-w-7xl mx-auto bg-amber-900/50 border border-amber-500/50 text-amber-400 px-4 py-3 rounded-lg mb-6 flex items-center justify-center font-medium animate-pulse">
          ⚠️ {apiWarning}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        
        {/* User Terminal */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 flex flex-col p-6 shadow-xl">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
            <h2 className="text-xl font-semibold text-blue-400">User Terminal</h2>
            <select 
              value={preset} 
              onChange={(e) => setPreset(e.target.value)}
              disabled={isProcessing}
              className="bg-slate-950 border border-slate-700 text-slate-300 text-sm rounded p-1 focus:outline-none focus:border-blue-500"
            >
              <option value="Groceries">Groceries</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          
          <button 
            onClick={handleGenerateMandate}
            disabled={isProcessing}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Generating...' : 'Generate AP2 Mandate'}
          </button>

          {mandate && (
            <div className="mt-6 flex-1 overflow-auto text-sm space-y-4">
              <div>
                <span className="text-slate-500 font-mono">Payload:</span>
                <pre className="mt-1 p-3 bg-black rounded-lg border border-slate-800 text-emerald-300 break-words whitespace-pre-wrap">
                  {JSON.stringify(mandate, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {userTelemetry && (
            <details className="mt-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <summary className="text-sm text-slate-400 font-mono cursor-pointer hover:text-slate-300">
                ▶ Agent Telemetry & Raw Prompts
              </summary>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                   <span className="text-slate-500">Provider:</span> 
                   <span className="ml-2 text-emerald-400 font-bold">{userTelemetry.provider}</span>
                   <br/>
                   <span className="text-slate-500">Latency:</span> 
                   <span className="ml-2 text-emerald-400">{userTelemetry.latencyMs}ms</span>
                </div>
                <div>
                   <div className="text-slate-500 mb-1">System Prompt:</div>
                   <div className="p-2 bg-slate-900 rounded text-slate-300 font-mono break-all">{userTelemetry.systemPrompt}</div>
                </div>
                <div>
                   <div className="text-slate-500 mb-1">Raw Output:</div>
                   <div className="p-2 bg-slate-900 rounded text-amber-300 font-mono break-all">{userTelemetry.rawOutput}</div>
                </div>
              </div>
            </details>
          )}
        </div>

        {/* Merchant Terminal */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 flex flex-col p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-amber-400 border-b border-slate-800 pb-2">Merchant Terminal</h2>
          
          <div className="space-y-3">
            <button 
              onClick={() => handleMerchantSubmit('valid')}
              disabled={!mandate || isProcessing}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Generating...' : 'Submit Valid Fulfillment (Happy Path)'}
            </button>
            <button 
              onClick={() => handleMerchantSubmit('malicious')}
              disabled={!mandate || isProcessing}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Generating...' : 'Submit Malicious Fulfillment (Adversarial)'}
            </button>
            <p className="text-xs text-neutral-500 mt-2 italic">
              Defense Verification Fixture: This button generates an intentionally naive adversarial payload (padded fee) exclusively to evaluate and demonstrate policy engine rejection boundaries. It contains no offensive capabilities.
            </p>
          </div>

          {fulfillment && (
            <div className="mt-6 flex-1 overflow-auto text-sm">
              <span className="text-slate-500 font-mono">Fulfillment Payload:</span>
              <pre className="mt-1 p-3 bg-black rounded-lg border border-slate-800 text-amber-300 break-words whitespace-pre-wrap">
                {JSON.stringify(fulfillment, null, 2)}
              </pre>
            </div>
          )}

          {merchantTelemetry && (
            <details className="mt-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <summary className="text-sm text-slate-400 font-mono cursor-pointer hover:text-slate-300">
                ▶ Agent Telemetry & Raw Prompts
              </summary>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                   <span className="text-slate-500">Provider:</span> 
                   <span className="ml-2 text-emerald-400 font-bold">{merchantTelemetry.provider}</span>
                   <br/>
                   <span className="text-slate-500">Latency:</span> 
                   <span className="ml-2 text-emerald-400">{merchantTelemetry.latencyMs}ms</span>
                </div>
                <div>
                   <div className="text-slate-500 mb-1">System Prompt:</div>
                   <div className="p-2 bg-slate-900 rounded text-slate-300 font-mono break-all">{merchantTelemetry.systemPrompt}</div>
                </div>
                <div>
                   <div className="text-slate-500 mb-1">Raw Output:</div>
                   <div className="p-2 bg-slate-900 rounded text-amber-300 font-mono break-all">{merchantTelemetry.rawOutput}</div>
                </div>
              </div>
            </details>
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

            <button 
              onClick={handleAppeal}
              disabled={status !== 'FLAGGED' || isProcessing}
              className={`w-full py-2 rounded-lg font-medium transition-colors ${status === 'FLAGGED' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
            >
              Appeal (Merchant)
            </button>

            <button 
              onClick={handleAdminAccept}
              disabled={status !== 'DISPUTED' || isProcessing}
              className={`w-full py-2 rounded-lg font-medium transition-colors ${status === 'DISPUTED' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
            >
              Accept Appeal (Admin)
            </button>
          </div>

          {verificationBundle && (
            <details className="mt-6 bg-slate-950 p-4 rounded-lg border border-slate-700">
              <summary className="text-sm font-semibold text-blue-400 cursor-pointer hover:text-blue-300">
                ▶ Independent ECDSA Verification (Terminal Check)
              </summary>
              <div className="mt-4 space-y-3 text-xs overflow-hidden">
                <div className="flex flex-col space-y-1">
                   <span className="text-slate-500">Canonical Hash Payload:</span>
                   <code className="text-emerald-300 bg-black p-2 rounded break-all">{verificationBundle.canonicalString}</code>
                </div>
                <div className="flex flex-col space-y-1">
                   <span className="text-slate-500">Base64 Signature:</span>
                   <code className="text-purple-300 bg-black p-2 rounded break-all">{verificationBundle.signature}</code>
                </div>
                <div className="flex flex-col space-y-1">
                   <span className="text-slate-500">Public Key (PEM):</span>
                   <code className="text-blue-300 bg-black p-2 rounded whitespace-pre-wrap">{verificationBundle.publicKeyPem}</code>
                </div>
                <EvidenceDrawer mandateBundle={{ payload: JSON.parse(verificationBundle.canonicalString), publicKeyPem: verificationBundle.publicKeyPem, signature: verificationBundle.signature, auditDecision: status }} />
              </div>
            </details>
          )}

        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-8 pb-8">
        <ManualTester />
      </div>
    </div>
  );
}
