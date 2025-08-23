// Quick test for getInstallCommand URL resolution
require('dotenv').config({ path: __dirname + '/.env' });

const { nodeController } = require('./dist/controllers/NodeController');

// helper to mock req/res
function createMockReqRes({ protocol = 'http', host = 'localhost:3001' } = {}) {
  const headers = { host };
  const req = {
    protocol,
    get: (h) => headers[h.toLowerCase()],
    app: { get: () => null },
    ip: '127.0.0.1',
    body: {},
    params: {},
    headers,
  };
  const res = {
    _json: null,
    _status: 200,
    json(obj) { this._json = obj; console.log(JSON.stringify(obj, null, 2)); },
    status(code) { this._status = code; return this; },
    setHeader() {},
    send(txt) { console.log(txt); },
  };
  return { req, res };
}

async function run() {
  // Case 1: Use FRONTEND_URL if set
  process.env.FRONTEND_URL = 'https://example.com';
  let { req, res } = createMockReqRes({ protocol: 'http', host: 'internal:3001' });
  await nodeController.getInstallCommand(req, res);

  // Case 2: No FRONTEND_URL, use host + port fix
  delete process.env.FRONTEND_URL;
  ;({ req, res } = createMockReqRes({ protocol: 'https', host: 'mydomain.com' }));
  process.env.PORT = '3001';
  await nodeController.getInstallCommand(req, res);
}

run().catch(e => { console.error(e); process.exit(1); });

