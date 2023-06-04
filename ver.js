const app = require('fastify')();

app.get('/', async () => ({ hello: 'world' }));

const start = async () => {
    await app.listen(9000)
}
start();