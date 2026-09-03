import { NextResponse } from 'next/server';
import { evaluateFulfillment, verifyMandate } from '@/lib/uap-logic';
import stringSimilarity from 'string-similarity';
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

    const similarity = stringSimilarity.compareTwoStrings(
      pureMandate.sku || "",
      fulfillment.sku || ""
    );

    const result = evaluateFulfillment(pureMandate, fulfillment, POLICY_CONFIG);
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Malformed verification payload' }, { status: 400 });
  }
}
