"use client";
import React, { useState } from 'react';

export default function EvidenceDrawer({ mandateBundle }: { mandateBundle: any }) {
  const [copied, setCopied] = useState(false);

  if (!mandateBundle) return null;

  // Exact command provided in the prompt
  const terminalCommand = `node -e "const c=require('crypto');const v=c.createVerify('SHA256');v.update('${JSON.stringify(mandateBundle.payload)}');v.end();console.log('Signature Valid:',v.verify(\`${mandateBundle.publicKeyPem}\`,'${mandateBundle.signature}','base64'));"`;

  function downloadEvidencePack() {
    const pack = {
      protocol: "AP2-UAP-RECOURSE-v1",
      timestamp: new Date().toISOString(),
      mandate: mandateBundle.payload,
      cryptography: {
        algorithm: "ECDSA_SHA256",
        curve: "prime256v1",
        publicKeyPem: mandateBundle.publicKeyPem,
        signature: mandateBundle.signature,
      },
      auditDecision: mandateBundle.auditDecision,
      verificationCommand: terminalCommand,
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-pack-${mandateBundle.payload?.nonce || 'record'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyCommand() {
    navigator.clipboard.writeText(terminalCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-neutral-800 pt-4 mt-4 font-mono text-xs">
      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={downloadEvidencePack} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded border border-neutral-700 transition-colors">
          📥 Download Signed Evidence Pack (.json)
        </button>
        <button onClick={copyCommand} className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded border border-neutral-700 transition-colors">
          {copied ? "✓ Copied Terminal Command" : "📋 Copy Terminal Verify Snippet"}
        </button>
      </div>
    </div>
  );
}
