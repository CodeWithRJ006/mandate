import { NextResponse } from 'next/server';
import { evaluateFulfillment } from '@/lib/uap-logic';
import stringSimilarity from 'string-similarity';

export async function POST(req: Request) {
  try {
    const { mandate, fulfillment } = await req.json();

    const authorizedTotal = (mandate.authorized_amount || 0) * (mandate.quantity || 1);
    const actualTotal = (fulfillment.actual_amount || 0) * (fulfillment.quantity || 1);
    const delta = actualTotal - authorizedTotal;
    const variancePct = authorizedTotal > 0 ? (delta / authorizedTotal) * 100 : 0;

    const similarity = stringSimilarity.compareTwoStrings(
      mandate.sku || "",
      fulfillment.sku || ""
    );

    const result = evaluateFulfillment(mandate, fulfillment, { tolerancePct: 0.02, similarityThreshold: 0.60 });

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
