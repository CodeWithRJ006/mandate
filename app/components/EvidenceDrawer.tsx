"use client";
import React, { useState } from 'react';

interface MandateBundle {
  payload: Record<string, unknown>;
  publicKeyPem: string;
  signature: string;
  auditDecision: string;
}

export default function EvidenceDrawer({ mandateBundle }: { mandateBundle: MandateBundle | null }) {
  const [copied, setCopied] = useState(false);

  if (!mandateBundle) return null;

  const script = `const crypto = require('crypto');
const pub = Buffer.from('${typeof btoa !== 'undefined' ? btoa(mandateBundle.publicKeyPem) : Buffer.from(mandateBundle.publicKeyPem).toString('base64')}', 'base64').toString('utf-8');
const payload = Buffer.from('${typeof btoa !== 'undefined' ? btoa(JSON.stringify(mandateBundle.payload)) : Buffer.from(JSON.stringify(mandateBundle.payload)).toString('base64')}', 'base64').toString('utf-8');
const sig = '${mandateBundle.signature}';
const v = crypto.createVerify('SHA256');
v.update(payload);
v.end();
console.log('Signature Verified:', v.verify(pub, sig, 'base64'));`;
  const b64Script = typeof btoa !== 'undefined' ? btoa(script) : Buffer.from(script).toString('base64');
  const terminalCommand = `node -e "eval(Buffer.from('${b64Script}', 'base64').toString('utf-8'))"`;

  function downloadEvidencePack() {
    const pack = {
      protocol: "AP2-UAP-RECOURSE-v1",
      timestamp: new Date().toISOString(),
      mandate: mandateBundle!.payload,
      cryptography: {
        algorithm: "ECDSA_SHA256",
        curve: "prime256v1",
        publicKeyPem: mandateBundle!.publicKeyPem,
        signature: mandateBundle!.signature,
      },
      auditDecision: mandateBundle!.auditDecision,
      terminalVerificationCommand: terminalCommand
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-pack-${(mandateBundle!.payload as Record<string, unknown>)?.nonce || 'record'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyCommand() {
    navigator.clipboard.writeText(terminalCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-slate-800 pt-4 mt-4 font-mono text-xs">
      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={downloadEvidencePack} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded border border-slate-700 transition-colors flex items-center gap-2">
          <span>📦</span> Download Signed Evidence Pack (.json)
        </button>
        <button onClick={copyCommand} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded border border-slate-700 transition-colors flex items-center gap-2">
          {copied ? (
            <><span className="text-emerald-400">✓</span> Copied Terminal Command</>
          ) : (
            <><span>⌨️</span> Copy Terminal Verify Snippet</>
          )}
        </button>
      </div>
    </div>
  );
}
