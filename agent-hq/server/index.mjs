import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { HQStore } from './store.mjs';

export function createHQServer(store) {
  return createServer((req, res) => {
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'" };
    const send = (status, data) => { res.writeHead(status, headers); res.end(JSON.stringify(data)); };
    // Protect the loopback API against DNS rebinding. A frontend proxy must rewrite Host.
    const loopback = value => ['localhost', '127.0.0.1', '[::1]'].includes(value);
    let host, path;
    try {
      host = new URL(`http://${req.headers.host || ''}`);
      if (!loopback(host.hostname) || host.username || host.password) return send(403, { error: 'untrusted_host' });
      if (req.headers.origin) {
        const origin = new URL(req.headers.origin);
        if (!loopback(origin.hostname) || !['http:', 'https:'].includes(origin.protocol)) return send(403, { error: 'untrusted_origin' });
      }
      if (req.url.length > 2048) return send(414, { error: 'url_too_long' });
      const target = new URL(req.url, host.origin);
      if (target.origin !== host.origin) return send(400, { error: 'invalid_request_target' });
      path = target.pathname;
    } catch { return send(400, { error: 'invalid_request_target' }); }
    if (!['GET', 'HEAD'].includes(req.method)) { req.resume(); return send(403, { error: 'owner_channel_required', message: 'This preview is read-only. Assign and update real tasks through the trusted local HQ CLI.' }); }
    if (path === '/api/state') return send(200, store.state());
    if (path === '/api/health') return send(200, { ok: true, persistence: 'sqlite', writes: 'trusted-local-cli', paidExecutionEnabled: false });
    return send(404, { error: 'not_found' });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = new HQStore(process.env.HQ_DB_PATH || resolve('data/hq.sqlite'));
  const server = createHQServer(store);
  const port = Number(process.env.HQ_API_PORT || 4318);
  server.listen(port, '127.0.0.1', () => console.log(`HQ API listening on http://127.0.0.1:${port} (read-only)`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
