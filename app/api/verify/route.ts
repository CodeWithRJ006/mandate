import { NextResponse } from 'next/server';
import { evaluateFulfillment, verifyMandate, consumeNonce } from '@/lib/uap-logic';
import { POLICY_CONFIG } from '@/lib/config';
import { globalLedger } from '@/lib/ledger';

export async function POST(req: Request) {
  try {
    const { mandate, fulfillment } = await req.json();

    if (!mandate || !mandate.signature || !mandate.publicKeyPem) {
      return NextResponse.json({ error: 'CRYPTOGRAPHIC_SIGNATURE_REQUIRED' }, { status: 401 });
    }

    const { signature, publicKeyPem, ...pureMandate } = mandate;
    
    const verification = verifyMandate(pureMandate, signature, publicKeyPem);
    if (!verification.isValid) {
      globalLedger.addBlock(pureMandate.nonce || 'UNKNOWN', 'REJECTED', verification.reason || 'SIGNATURE_INVALID');
      return NextResponse.json({ error: verification.reason || 'SIGNATURE_INVALID' }, { status: 403 });
    }

    const authorizedTotal = (pureMandate.authorized_amount || 0) * (pureMandate.quantity || 1);
    const actualTotal = (fulfillment.actual_amount || 0) * (fulfillment.quantity || 1);
    const delta = actualTotal - authorizedTotal;
    const variancePct = authorizedTotal > 0 ? (delta / authorizedTotal) * 100 : 0;

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const getBigrams = (str: string) => {
      const b = new Set<string>();
      for (let i = 0; i < str.length - 1; i++) b.add(str.substring(i, i + 2));
      return b;
    };
    
    let similarity = 0;
    const n1 = normalize(pureMandate.sku || "");
    const n2 = normalize(fulfillment.sku || "");
    if (n1 === n2) {
      similarity = 1;
    } else if (n1.length > 1 && n2.length > 1) {
      const bg1 = getBigrams(n1);
      const bg2 = getBigrams(n2);
      let intersect = 0;
      for (const bg of bg1) if (bg2.has(bg)) intersect++;
      similarity = (2.0 * intersect) / (bg1.size + bg2.size);
    }

    const result = evaluateFulfillment(pureMandate, fulfillment, POLICY_CONFIG);
    
    if (result.status === 'APPROVED') {
      consumeNonce(pureMandate.nonce);
    }

    globalLedger.addBlock(pureMandate.nonce, result.status, result.reason || null);

    return NextResponse.json({
      verdict: result.status,
      reason: result.reason || null,
      explainability: {
        authorizedTotal,
        actualTotal,
        deltaAmount: delta,
        amountVariancePct: variancePct,
        skuSimilarity: similarity,
        withinTolerance: result.status === 'APPROVED',
        statusMessage: result.status === 'APPROVED' ? 'Approved: Within thresholds' : `Rejected: ${result.reason}`
      }
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message || 'Malformed verification payload' }, { status: 400 });
  }
}
