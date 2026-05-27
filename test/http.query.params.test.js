import fastify from "fastify";
import path from "path";
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import url from "url";
import fs from "fs";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, "..", "fixtures", "archive.tgz");
const FIXTURE_MAP = path.resolve(
	__dirname,
	"..",
	"fixtures",
	"import-map.json",
);

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

test("query params - package", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	await fetch(`${address}/pkg/fuzz/8.4.1`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET file from server
	const downloaded = await fetch(
		`${address}/pkg/fuzz/8.4.1/main/index.js?foo=bar`,
		{
			method: "GET",
		},
	);

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of file, server should respond with 200 ok",
	);
});

test("query params - NPM package", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	await fetch(`${address}/npm/fuzz/8.4.1`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET file from server
	const downloaded = await fetch(
		`${address}/npm/fuzz/8.4.1/main/index.js?foo=bar`,
		{
			method: "GET",
		},
	);

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of file, server should respond with 200 ok",
	);
});

test("query params - map", async () => {
	const formData = new FormData();
	formData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT map on server
	await fetch(`${address}/map/buzz/4.2.2`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET file from server
	const downloaded = await fetch(`${address}/map/buzz/4.2.2?foo=bar`, {
		method: "GET",
	});

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of file, server should respond with 200 ok",
	);
});
