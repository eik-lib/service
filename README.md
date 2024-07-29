# Eik HTTP Service

Eik REST API - As a standalone running HTTP service

## Installation

```
npm install @eik/service
```

## Usage

This server can either be run as a Node executable, or as a Fastify plugin.

```sh
npx @eik/service
```

For a production setup, the Fastify plugin method is recommended.

```js
import fastify from 'fastify';
import Service from '@eik/service';
import Sink from '@eik/sink-gcs';

// Set up the Google Cloud Storage sink
// https://github.com/eik-lib/sink-gcs?tab=readme-ov-file#example
const sink = new Sink({
    credentials: {
        client_email: 'a@email.address',
        private_key: '[ ...snip... ]',
        projectId: 'myProject',
    },
});

// Set up the Eik service as a plugin
const service = new Service({ sink });

// Set up Fastify
const app = fastify({
    ignoreTrailingSlash: true,
    modifyCoreObjects: false,
    trustProxy: true,
});

// Register the Eik service in Fastify
app.register(service.api());

// Append custom HTTP ready checks
app.get('/_/health', (request, reply) => {
    reply.send('ok');
});

app.get('/_/ready', (request, reply) => {
    reply.send('ok');
});

// Start the server
const run = async () => {
    await service.health();
    await app.listen(
        service.config.get('http.port'),
        service.config.get('http.address'),
    );
};

run();
```

The example above shows the Google Cloud Storage sink. You can also use the [file system sink](https://github.com/eik-lib/sink-file-system), or implement the [sink interface](https://github.com/eik-lib/sink) for your own custom storage backend.
