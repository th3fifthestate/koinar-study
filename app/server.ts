// server.ts — Custom HTTP server wrapping Next.js + WebSocket
// Railway runs a persistent Node.js process, so HTTP and WebSocket traffic
// are handled by this single server on the same port.
// Note: uses relative imports (not @/ alias) — tsx runs this as plain Node.js.

import './server-polyfills';
import { createServer } from 'http';
import next from 'next';
import { setupWebSocketServer } from './lib/ws/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  setupWebSocketServer(server);

  server.listen(port, hostname, () => {
    console.log(
      `> Server ready on http://${hostname}:${port} [${dev ? 'development' : 'production'}]`
    );
  });
});
