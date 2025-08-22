import crypto from 'crypto';

export function signBody(apiKey: string, body: any) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${timestamp}.${JSON.stringify(body ?? {})}`;
  const signature = crypto.createHmac('sha256', apiKey).update(payload).digest('hex');
  return { timestamp, nonce, signature };
}

export function buildSignedHeaders(apiKey: string, body: any) {
  const { timestamp, nonce, signature } = signBody(apiKey, body);
  return {
    'X-API-Key': apiKey,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature,
  } as Record<string, string>;
}

