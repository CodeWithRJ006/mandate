import { NextResponse } from 'next/server';
import { runEvaluation } from '../../../scripts/evaluate-risk-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = runEvaluation();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
