import crypto from 'crypto';

const buildBodyPayload = (body: any) => `${JSON.stringify(body ?? {})}`;

export function signBody(apiKey: string, body: any) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${timestamp}.${buildBodyPayload(body)}`;
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

const controlNonceCache = new Map<string, number>();
const controlSignatureTtlSec = parseInt(
  process.env.AGENT_CONTROL_SIGNATURE_TTL_SECONDS ||
    process.env.AGENT_SIGNATURE_TTL_SECONDS ||
    '300',
  10,
);

const buildControlPayload = (
  timestamp: string,
  method: string,
  requestPath: string,
  body: unknown,
) => `${timestamp}.${method.toUpperCase()}.${requestPath}.${JSON.stringify(body ?? {})}`;

export function buildSignedControlHeaders(
  apiKey: string,
  method: string,
  requestPath: string,
  body?: unknown,
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(12).toString('hex');
  const signature = crypto
    .createHmac('sha256', apiKey)
    .update(buildControlPayload(timestamp, method, requestPath, body))
    .digest('hex');

  return {
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Signature': signature,
  } as Record<string, string>;
}

export function verifySignedControlRequest(options: {
  apiKey: string;
  method: string;
  requestPath: string;
  body?: unknown;
  timestamp?: string;
  nonce?: string;
  signature?: string;
}): { ok: boolean; reason?: string } {
  const { apiKey, method, requestPath, body, timestamp, nonce, signature } =
    options;

  if (!timestamp || !signature) {
    return { ok: false, reason: 'missing_signature_or_timestamp' };
  }

  const parsedTs = parseInt(timestamp, 10);
  if (!Number.isFinite(parsedTs)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsedTs) > controlSignatureTtlSec) {
    return { ok: false, reason: 'timestamp_out_of_window' };
  }

  if (nonce) {
    const cached = controlNonceCache.get(nonce);
    if (cached && cached > Date.now()) {
      return { ok: false, reason: 'replay_detected' };
    }
  }

  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(buildControlPayload(timestamp, method, requestPath, body))
    .digest('hex');

  if (expected !== signature) {
    return { ok: false, reason: 'bad_signature' };
  }

  if (nonce) {
    controlNonceCache.set(nonce, Date.now() + controlSignatureTtlSec * 1000);
  }

  if (controlNonceCache.size > 10000) {
    const now = Date.now();
    for (const [key, expiresAt] of controlNonceCache.entries()) {
      if (expiresAt <= now) {
        controlNonceCache.delete(key);
      }
    }
  }

  return { ok: true };
}
