import Fastify from 'fastify';
import tap from 'tap';
import fetch from 'node-fetch'

import Sink from "@eik/core/lib/sinks/test.js";
import Server from '../lib/main.js';

tap.test('ping - returns pong', async  t => {
  const service = new Server({ customSink: new Sink() });

  const app = Fastify({
    ignoreTrailingSlash: true,
  });
  app.register(service.api());

  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const response = await fetch(`${address}/ping`, {
    method: 'GET',
  });
  t.ok(response.ok)
  t.equal(response.status, 200, 'returns 200 OK')
  t.equal(await response.text(), 'pong')

  await app.close()
})
