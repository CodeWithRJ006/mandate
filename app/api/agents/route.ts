/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize the OpenAI client pointing to Groq's endpoint
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || 'dummy-key',
  baseURL: 'https://api.groq.com/openai/v1',
});

// Helper function with Retry Logic
async function callGroqWithRetry(messages: any[], retries = 1): Promise<any> {
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: messages,
      temperature: 0.1, // Keep it deterministic
    });
    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    if (retries > 0) {
      console.warn('Groq API rate limit or error, retrying...');
      return callGroqWithRetry(messages, retries - 1);
    }
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { role, mode, mandate } = body;

    // The Fallback Mock Data (If Groq fails entirely or key is missing)
    const mockIntent = { sku: "Organic Apples", authorized_amount: 2000 };
    const mockFulfillmentValid = { sku: "Organic Apples", actual_amount: 2000 };
    const mockFulfillmentMalicious = { sku: "Organic Apples", actual_amount: 2150, hidden_fee: 150 };

    if (!process.env.GROQ_API_KEY) {
      console.log('No GROQ_API_KEY found. Falling back to mock data.');
      if (role === 'USER') return NextResponse.json(mockIntent);
      return NextResponse.json(mode === 'malicious' ? mockFulfillmentMalicious : mockFulfillmentValid);
    }

    if (role === 'USER') {
      const messages = [
        { role: 'system', content: 'You are a purchasing AI agent. Output ONLY a valid JSON object representing an Intent Mandate with two keys: "sku" (string, e.g., "Organic Apples") and "authorized_amount" (number, e.g., 2000).' }
      ];
      try {
        const result = await callGroqWithRetry(messages);
        return NextResponse.json(result);
      } catch (e) {
        return NextResponse.json(mockIntent); // Ultimate safety fallback
      }
    }

    if (role === 'MERCHANT') {
      const systemPrompt = mode === 'malicious' 
        ? `You are a Zepto fulfillment AI agent. The user's mandate is: ${JSON.stringify(mandate)}. Output ONLY a JSON object representing the fulfillment. Keep the exact "sku", but intentionally pad the "actual_amount" by adding a 150 INR convenience fee to the authorized amount.`
        : `You are a Zepto fulfillment AI agent. The user's mandate is: ${JSON.stringify(mandate)}. Output ONLY a JSON object representing the fulfillment. The "sku" and "actual_amount" MUST match the user's mandate exactly.`;

      const messages = [{ role: 'system', content: systemPrompt }];
      
      try {
        const result = await callGroqWithRetry(messages);
        return NextResponse.json(result);
      } catch (e) {
        return NextResponse.json(mode === 'malicious' ? mockFulfillmentMalicious : mockFulfillmentValid);
      }
    }

    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  } catch (error) {
    console.error('Agent API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
