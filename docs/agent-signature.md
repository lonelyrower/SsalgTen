# Agent Request Signature

To harden agent -> server calls, the backend supports optional HMAC signatures.

- Enable strict signature enforcement by setting `AGENT_REQUIRE_SIGNATURE=true`.
- Validity window is controlled by `AGENT_SIGNATURE_TTL_SECONDS` (default 300 seconds).
- Headers:
  - `X-API-Key`: system agent API key
  - `X-Timestamp`: unix seconds when the request is issued
  - `X-Nonce`: unique random string per request (prevents replay within window)
  - `X-Signature`: HMAC-SHA256 of `${timestamp}.${JSON.stringify(body)}` using the system API key

Example (Node.js):

```ts
import crypto from 'crypto';

function signRequest(systemKey: string, body: any) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${timestamp}.${JSON.stringify(body ?? {})}`;
  const signature = crypto.createHmac('sha256', systemKey).update(payload).digest('hex');
  return { timestamp, nonce, signature };
}

async function postHeartbeat(masterUrl: string, systemKey: string, agentId: string, heartbeat: any) {
  const { timestamp, nonce, signature } = signRequest(systemKey, heartbeat);
  const res = await fetch(`${masterUrl}/api/agents/${agentId}/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': systemKey,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
    },
    body: JSON.stringify(heartbeat),
  });
  return await res.json();
}
```

Example (bash):

```bash
TS=$(date +%s)
NONCE=$(openssl rand -hex 12)
BODY='{"status":"healthy"}'
PAYLOAD="${TS}.${BODY}"
SIG=$(printf "%s" "$PAYLOAD" | openssl dgst -sha256 -hmac "$SYSTEM_API_KEY" | awk '{print $2}')

curl -X POST "$MASTER_URL/api/agents/$AGENT_ID/heartbeat" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $SYSTEM_API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

Notes:
- The backend accepts the current system API key and (if still valid) the grace-period previous key after rotation.
- When `AGENT_REQUIRE_SIGNATURE=false`, unsigned requests are allowed but logged with a warning.
- Nonce values are cached in-memory during the TTL to prevent replay within the window.

