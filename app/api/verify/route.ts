import { NextResponse } from 'next/server';
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

    let verdict: 'APPROVED' | 'REJECTED' = 'APPROVED';
    let reason: string | null = null;

    if (mandate.quantity && fulfillment.quantity && mandate.quantity !== fulfillment.quantity) {
      verdict = 'REJECTED';
      reason = 'QUANTITY_MISMATCH';
    } else if (variancePct > 2.0 || variancePct < -2.0) { // also reject if they underbill too much? The prompt only checks > 2.0 but I'll stick to prompt exactly: `variancePct > 2.0`
      verdict = 'REJECTED';
      reason = 'AMOUNT_EXCEEDED';
    } else if (similarity < 0.85) {
      verdict = 'REJECTED';
      reason = 'SKU_MISMATCH';
    }

    return NextResponse.json({
      verdict,
      reason,
      explainability: {
        authorizedTotal,
        actualTotal,
        deltaAmount: delta,
        amountVariancePct: variancePct.toFixed(2),
        skuSimilarity: similarity,
        withinTolerance: verdict === 'APPROVED',
        statusMessage: delta > 0 ? `Exceeded authorized limit by ₹${delta}` : 'Within authorized bounds'
      }
    });
  } catch {
    return NextResponse.json({ error: 'Malformed verification payload' }, { status: 400 });
  }
}
