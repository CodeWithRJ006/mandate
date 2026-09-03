import { NextResponse } from 'next/server';
import { runEvaluation } from '../../../scripts/evaluate-risk-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = runEvaluation();
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
