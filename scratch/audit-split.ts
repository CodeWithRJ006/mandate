import { DATASET, TUNING_SET, HELD_OUT_SET } from '../scripts/evaluate-risk-engine';

console.log(`Total: ${DATASET.length}, Tuning: ${TUNING_SET.length}, HeldOut: ${HELD_OUT_SET.length}`);

const cats = (set: any[], label: string) => {
  const counts: Record<string, {total:number, approve:number, reject:number}> = {};
  for (const c of set) {
    if (!counts[c.category]) counts[c.category] = {total:0, approve:0, reject:0};
    counts[c.category].total++;
    if (c.expected === 'APPROVE') counts[c.category].approve++;
    else counts[c.category].reject++;
  }
  console.log(`\n--- ${label} ---`);
  let totalApprove = 0, totalReject = 0;
  for (const [cat, v] of Object.entries(counts)) {
    console.log(`  ${cat}: ${v.total} (approve=${v.approve}, reject=${v.reject})`);
    totalApprove += v.approve;
    totalReject += v.reject;
  }
  console.log(`  TOTALS: approve=${totalApprove}, reject=${totalReject}`);
};

cats(TUNING_SET, "TUNING SET (70%)");
cats(HELD_OUT_SET, "HELD-OUT SET (30%)");
