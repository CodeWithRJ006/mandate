const http = require('http');

async function testPreset(preset) {
  console.log(`\n=== Testing Preset: ${preset} ===`);
  
  // 1. Generate Mandate (USER)
  const res1 = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'USER', preset })
  });
  const data1 = await res1.json();
  const mandate = data1.data;
  console.log('Mandate Payload:', mandate);
  
  // 2. Generate Valid Fulfillment (MERCHANT)
  const res2 = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'MERCHANT', mode: 'valid', mandate, preset })
  });
  const data2 = await res2.json();
  console.log('Valid Fulfillment:', data2.data);
  
  // 3. Generate Malicious Fulfillment (MERCHANT)
  const res3 = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'MERCHANT', mode: 'malicious', mandate, preset })
  });
  const data3 = await res3.json();
  console.log('Malicious Fulfillment:', data3.data);
}

async function run() {
  await testPreset('Groceries');
  await testPreset('Electronics');
  await testPreset('Fashion');
  await testPreset('Custom');
}

run().catch(console.error);
