import fastify from "fastify";
import path from "path";
import { test, before, after, afterEach } from "node:test";
import url from "url";
import fs from "fs";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const RE_CREATED = /"created":[0-9]+,/gi;

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Record<string, string>} */
let headers;
/** @type {Sink} */
let sink;

before(async () => {
	sink = new Sink();
	const service = new Server({ sink });

	app = fastify({
		routerOptions: { ignoreTrailingSlash: true },
		forceCloseConnections: true,
	});
	app.register(service.api());

	address = await app.listen({ port: 0, host: "127.0.0.1" });

	const formData = new FormData();
	formData.append("key", "change_me");
	const res = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});
	const login = /** @type {{ token: string }} */ (await res.json());
	headers = { Authorization: `Bearer ${login.token}` };
});

afterEach(() => {
	sink.clear();
});

after(async () => {
	await app.close();
});

test("Sink is slow and irregular - Writing medium sized package", async (t) => {
	// Simulate a slow write process by delaying each chunk written
	// to the sink with something between 10 and 100 + (buffer count) ms.
	sink.writeDelayChunks = (count = 0) => {
		const max = 100 + count;
		const min = 10;
		return Math.floor(Math.random() * max) + min;
	};

	const formData = new FormData();
	formData.append(
		"package",
		new Blob([
			fs.readFileSync(path.join(__dirname, "../fixtures/archive.tgz")),
		]),
	);

	const res = await fetch(`${address}/pkg/frazz/2.1.4`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
	});

	const obj = await res.json();
	t.assert.snapshot(JSON.stringify(obj).replace(RE_CREATED, '"created": -1,'));
});

test("Sink is slow and irregular - Writing small sized package", async (t) => {
	// Simulate a slow write process by delaying each chunk written
	// to the sink with something between 10 and 100 + (buffer count) ms.
	sink.writeDelayChunks = (count = 0) => {
		const max = 100 + count;
		const min = 10;
		return Math.floor(Math.random() * max) + min;
	};

	const formData = new FormData();
	formData.append(
		"package",
		new Blob([
			fs.readFileSync(path.join(__dirname, "../fixtures/archive-small.tgz")),
		]),
	);

	const res = await fetch(`${address}/pkg/brazz/7.1.3`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
	});

	const obj = await res.json();
	t.assert.snapshot(JSON.stringify(obj).replace(RE_CREATED, '"created": -1,'));
});

test("Sink is slow to construct writer - Writing medium sized package", async (t) => {
	// Simulate a slow creation of the sink write operation by delaying
	// it something between 20 and 100ms.
	sink.writeDelayResolve = () => {
		const max = 100;
		const min = 20;
		return Math.floor(Math.random() * max) + min;
	};

	const formData = new FormData();
	formData.append(
		"package",
		new Blob([
			fs.readFileSync(path.join(__dirname, "../fixtures/archive.tgz")),
		]),
	);

	const res = await fetch(`${address}/pkg/frazz/2.1.4`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
	});

	const obj = await res.json();
	t.assert.snapshot(JSON.stringify(obj).replace(RE_CREATED, '"created": -1,'));
});

test("Sink is slow to construct writer - Writing small sized package", async (t) => {
	// Simulate a slow creation of the sink write operation by delaying
	// it something between 20 and 100ms.
	sink.writeDelayResolve = () => {
		const max = 100;
		const min = 20;
		return Math.floor(Math.random() * max) + min;
	};

	const formData = new FormData();
	formData.append(
		"package",
		new Blob([
			fs.readFileSync(path.join(__dirname, "../fixtures/archive-small.tgz")),
		]),
	);

	const res = await fetch(`${address}/pkg/brazz/7.1.3`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
	});

	const obj = await res.json();
	t.assert.snapshot(JSON.stringify(obj).replace(RE_CREATED, '"created": -1,'));
});
