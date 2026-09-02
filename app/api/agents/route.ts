/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy-key',
  baseURL: 'https://api.groq.com/openai/v1',
});

async function callGroqWithRetry(messages: any[], retries = 1, attempt = 0): Promise<{result: any, attempts: number}> {
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: messages,
      temperature: 0.1, 
    });
    return { result: JSON.parse(response.choices[0].message.content || '{}'), attempts: attempt };
  } catch (error) {
    if (retries > 0) {
      console.warn('Groq API rate limit or error, retrying...');
      return callGroqWithRetry(messages, retries - 1, attempt + 1);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, mode, mandate } = body;

    const PRESETS: Record<string, { sku: string, amount: number }> = {
      'Groceries': { sku: "Organic Apples", amount: 2000 },
      'Electronics': { sku: "iPhone 15 Pro", amount: 120000 },
      'Fashion': { sku: "Nike Air Force 1", amount: 8500 },
      'Custom': { sku: "Premium Coffee Beans", amount: 1200 }
    };
    
    const selectedPreset = PRESETS[body.preset] || PRESETS['Groceries'];

    const mockIntent = { sku: selectedPreset.sku, authorized_amount: selectedPreset.amount };
    
    // For merchant fallbacks, use the provided mandate if available to ensure matching
    const baseSku = mandate?.sku || selectedPreset.sku;
    const baseAmt = mandate?.authorized_amount || selectedPreset.amount;
    
    const mockFulfillmentValid = { sku: baseSku, actual_amount: baseAmt };
    const mockFulfillmentMalicious = { sku: baseSku, actual_amount: baseAmt + 150, hidden_fee: 150 };

    const generateMockResponse = (data: any, sysPrompt: string, usrPrompt: string, retriesUsed = 0) => {
      return NextResponse.json({
        data,
        telemetry: {
          systemPrompt: sysPrompt,
          userPrompt: usrPrompt,
          rawOutput: JSON.stringify(data, null, 2),
          latencyMs: 15,
          provider: 'Mock Fallback',
          retriesUsed
        }
      });
    };

    if (!process.env.GROQ_API_KEY) {
      console.log('No GROQ_API_KEY found. Falling back to mock data.');
      const sys = role === 'USER' ? 'You are a purchasing AI agent.' : `You are a Zepto fulfillment AI agent.`;
      return generateMockResponse(
        role === 'USER' ? mockIntent : (mode === 'malicious' ? mockFulfillmentMalicious : mockFulfillmentValid),
        sys,
        role === 'USER' ? 'Generate intent mandate' : 'Generate fulfillment'
      );
    }

    const start = performance.now();

    if (role === 'USER') {
      const sysPrompt = `You are a purchasing AI agent. Output ONLY a valid JSON object representing an Intent Mandate for the ${body.preset || 'Groceries'} category with two keys: "sku" (string, e.g., "${selectedPreset.sku}") and "authorized_amount" (number, e.g., ${selectedPreset.amount}).`;
      const messages = [{ role: 'system', content: sysPrompt }];
      try {
        const { result, attempts } = await callGroqWithRetry(messages);
        const latencyMs = Math.round(performance.now() - start);
        return NextResponse.json({
          data: result,
          telemetry: {
            systemPrompt: sysPrompt,
            userPrompt: '(System prompt only used)',
            rawOutput: JSON.stringify(result, null, 2),
            latencyMs,
            provider: 'Groq (Llama 3.3 70B)',
            retriesUsed: attempts
          }
        });
      } catch (e) {
        return generateMockResponse(mockIntent, sysPrompt, 'Generate intent mandate', 1);
      }
    }

    if (role === 'MERCHANT') {
      const systemPrompt = mode === 'malicious' 
        ? `You are a Zepto fulfillment AI agent. The user's mandate is: ${JSON.stringify(mandate)}. Output ONLY a JSON object representing the fulfillment. Keep the exact "sku", but intentionally pad the "actual_amount" by adding a 150 INR convenience fee to the authorized amount.`
        : `You are a Zepto fulfillment AI agent. The user's mandate is: ${JSON.stringify(mandate)}. Output ONLY a JSON object representing the fulfillment. The "sku" and "actual_amount" MUST match the user's mandate exactly.`;

      const messages = [{ role: 'system', content: systemPrompt }];
      
      try {
        const { result, attempts } = await callGroqWithRetry(messages);
        const latencyMs = Math.round(performance.now() - start);
        return NextResponse.json({
          data: result,
          telemetry: {
            systemPrompt: systemPrompt,
            userPrompt: '(System prompt only used)',
            rawOutput: JSON.stringify(result, null, 2),
            latencyMs,
            provider: 'Groq (Llama 3.3 70B)',
            retriesUsed: attempts
          }
        });
      } catch (e) {
        return generateMockResponse(mode === 'malicious' ? mockFulfillmentMalicious : mockFulfillmentValid, systemPrompt, 'Generate fulfillment', 1);
      }
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  } catch (error) {
    console.error('Agent API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
