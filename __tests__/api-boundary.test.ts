import { POST } from '../app/api/verify/route';
import { generateAgentKeyPair, signMandate, keyRegistry } from '../lib/uap-logic';

describe('HTTP Boundary & Security Abuse Integration Tests', () => {
  const mockKeys = generateAgentKeyPair();

  const createRequest = (body: Record<string, unknown>) => {
    return new Request('https://mandate-six.vercel.app/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  // Each test signs a fresh payload with a fresh UUID nonce to avoid cross-test NONCE_REUSED pollution
  const freshMandate = () => {
    const { augmentedPayload, signature } = signMandate(
      { sku: 'Integration Test Item', quantity: 1, authorized_amount: 500 },
      mockKeys.privateKey
    );
    return { augmentedPayload, signature };
  };

  it('401 Unauthorized: Rejects completely unsigned payloads', async () => {
    const { augmentedPayload } = freshMandate();
    const req = createRequest({
      mandate: augmentedPayload,
      fulfillment: { sku: 'Integration Test Item', quantity: 1, actual_amount: 500 }
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('CRYPTOGRAPHIC_SIGNATURE_REQUIRED');
  });

  it('400 Bad Request: Rejects malformed JSON gracefully', async () => {
    const req = new Request('https://mandate-six.vercel.app/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json ',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('403 Forbidden: Rejects valid signatures with unregistered public keys', async () => {
    // Attack scenario: Attacker generates a perfectly valid keypair and signature,
    // but the key is not in keyRegistry.
    // We simulate this by removing the key from the registry temporarily.
    const { augmentedPayload, signature } = freshMandate();
    keyRegistry.delete(mockKeys.publicKey.trim());

    const req = createRequest({
      mandate: { ...augmentedPayload, signature, publicKeyPem: mockKeys.publicKey },
      fulfillment: { sku: 'Integration Test Item', quantity: 1, actual_amount: 500 }
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('UNREGISTERED_PUBLIC_KEY');

    // Restore key for remaining tests
    keyRegistry.add(mockKeys.publicKey.trim());
  });

  it('403 Forbidden: Rejects tampered payloads', async () => {
    const { augmentedPayload, signature } = freshMandate();
    const req = createRequest({
      mandate: {
        ...augmentedPayload,
        authorized_amount: 99999, // Tampering with amount after signing
        signature,
        publicKeyPem: mockKeys.publicKey
      },
      fulfillment: { sku: 'Integration Test Item', quantity: 1, actual_amount: 500 }
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('SIGNATURE_INVALID');
  });

  it('200 OK: Approves perfectly formed, valid, and authenticated requests', async () => {
    const { augmentedPayload, signature } = freshMandate();
    const req = createRequest({
      mandate: { ...augmentedPayload, signature, publicKeyPem: mockKeys.publicKey },
      fulfillment: { sku: 'Integration Test Item', quantity: 1, actual_amount: 500 }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.verdict).toBe('APPROVED');
  });
});
