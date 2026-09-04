"use client";
import React, { useEffect, useState } from 'react';
import { getLedgerChain, tamperLedgerAction, verifyLedgerAction, resetLedgerAction } from '../actions';
import type { LedgerBlock } from '../../lib/ledger';

export default function LedgerViewer() {
  const [chain, setChain] = useState<LedgerBlock[]>([]);
  const [integrity, setIntegrity] = useState<{ isValid: boolean; corruptedBlockIndex?: number }>({ isValid: true });

  const fetchLedger = async () => {
    const data = await getLedgerChain();
    const int = await verifyLedgerAction();
    setChain(data);
    setIntegrity(int);
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchLedger();
    const interval = setInterval(fetchLedger, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTamper = async (index: number) => {
    await tamperLedgerAction(index, 'TAMPERED_VERDICT');
    await fetchLedger();
  };

  const handleReset = async () => {
    await resetLedgerAction();
    await fetchLedger();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 my-6 text-slate-200 font-sans text-sm shadow-xl">
      <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
        <h3 className="text-xl font-bold text-white">Cryptographic Audit Ledger</h3>
        <div className="space-x-2">
          <button onClick={handleReset} className="text-xs bg-red-900/40 text-red-400 border border-red-800/50 hover:bg-red-800/60 px-3 py-1 rounded">Clear Data</button>
          <button onClick={fetchLedger} className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded">Refresh</button>
        </div>
      </div>

      <div className={`mb-4 p-3 rounded border font-mono text-sm ${integrity.isValid ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-400' : 'bg-red-900/40 border-red-500/50 text-red-400'}`}>
        <div className="flex justify-between">
          <span>Chain Integrity: {integrity.isValid ? 'VALID' : 'COMPROMISED'}</span>
          {!integrity.isValid && <span>Corruption detected at block #{integrity.corruptedBlockIndex}</span>}
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-96 pr-2">
        {chain.map((block) => (
          <div key={block.index} className={`p-4 rounded-lg border ${!integrity.isValid && integrity.corruptedBlockIndex === block.index ? 'bg-red-950 border-red-600' : 'bg-slate-950 border-slate-800'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-300">Block #{block.index}</span>
              <span className="text-xs text-slate-500">{new Date(block.timestamp).toISOString()}</span>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-1 text-xs font-mono">
              <span className="text-slate-500">Verdict:</span>
              <span className={block.verdict === 'APPROVED' ? 'text-emerald-400' : (block.verdict === 'TAMPERED_VERDICT' ? 'text-red-500' : 'text-amber-400')}>{block.verdict} {block.reason ? `(${block.reason})` : ''}</span>
              
              <span className="text-slate-500">Nonce:</span>
              <span className="text-slate-400 truncate" title={block.nonce}>{block.nonce}</span>
              
              <span className="text-slate-500">Prev Hash:</span>
              <span className="text-slate-400 truncate text-[10px]" title={block.prevHash}>{block.prevHash}</span>
              
              <span className="text-slate-500">Hash:</span>
              <span className="text-amber-200/70 truncate text-[10px]" title={block.hash}>{block.hash}</span>
            </div>
            
            {block.index > 0 && (
              <div className="mt-3 text-right">
                <button 
                  onClick={() => handleTamper(block.index)}
                  className="text-[10px] bg-red-900/40 text-red-400 border border-red-800/50 hover:bg-red-800/60 px-2 py-1 rounded"
                >
                  [Intentionally Corrupt Block]
                </button>
              </div>
            )}
          </div>
        ))}
        {chain.length === 1 && (
          <p className="text-center text-slate-500 italic py-4">Waiting for transactions...</p>
        )}
      </div>
    </div>
  );
}
