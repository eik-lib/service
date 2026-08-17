import net from "node:net";
import fastify from "fastify";
import { test } from "node:test";
import assert from "node:assert/strict";

import Sink from "@eik/sink-memory";
import Server from "../lib/main.js";

/**
 * Opens a raw TCP connection, sends an HTTP PUT request with valid
 * auth headers but never sends a body, and measures how long the
 * server takes to close the connection. Resolves with the elapsed
 * milliseconds, or rejects if the connection remains open past `maxWaitMs`.
 *
 * @param {number} port
 * @param {string} host
 * @param {string} path
 * @param {string} token
 * @param {number} maxWaitMs
 * @returns {Promise<number>}
 */
function timeToConnectionClose(port, host, path, token, maxWaitMs) {
	return new Promise((resolve, reject) => {
		const start = Date.now();

		const socket = net.connect(port, host, () => {
			// Content-Length promises a body but we never send it, leaving
			// the server waiting for data that will never arrive.
			socket.write(
				`PUT ${path} HTTP/1.1\r\n` +
					`Host: ${host}:${port}\r\n` +
					`Authorization: Bearer ${token}\r\n` +
					`Content-Type: multipart/form-data; boundary=boundary123\r\n` +
					`Content-Length: 100000\r\n` +
					`\r\n`,
			);
		});

		const timer = setTimeout(() => {
			socket.destroy();
			reject(
				new Error(`server did not close the connection within ${maxWaitMs} ms`),
			);
		}, maxWaitMs);

		socket.on("close", () => {
			clearTimeout(timer);
			resolve(Date.now() - start);
		});

		socket.on("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

// Regression test: PUT routes had no body timeout, meaning a slow or
// stalled client upload held busboy, the tar parser, and all open sink
// write streams open indefinitely. The fix adds a configurable
// bodyTimeout that closes idle connections so server resources are
// freed when uploads stall.
test("PUT routes close stalled connections within bodyTimeout to free server resources", async () => {
	const BODY_TIMEOUT = 300;

	const sink = new Sink();
	const service = new Server({ sink, bodyTimeout: BODY_TIMEOUT });

	const app = fastify({
		routerOptions: { ignoreTrailingSlash: true },
		forceCloseConnections: true,
	});
	app.register(service.api());

	const address = await app.listen({ port: 0, host: "127.0.0.1" });
	const port = Number(new URL(address).port);

	try {
		// Obtain a valid auth token so the request passes authentication
		// and reaches the body-reading phase where the timeout applies.
		const loginForm = new FormData();
		loginForm.append("key", "change_me");
		const loginRes = await fetch(`${address}/auth/login`, {
			method: "POST",
			body: loginForm,
		});
		const { token } = /** @type {any} */ (await loginRes.json());

		// Without bodyTimeout the connection would stay open until the
		// Fastify default (0 — no timeout), making this await hang for the
		// full maxWaitMs and the test would fail with the timeout error.
		const elapsedMs = await timeToConnectionClose(
			port,
			"127.0.0.1",
			"/pkg/my-app/1.0.0",
			token,
			BODY_TIMEOUT * 10,
		);

		assert.ok(
			elapsedMs < BODY_TIMEOUT * 5,
			`connection should close within ${BODY_TIMEOUT * 5} ms of the body timeout, ` +
				`but took ${elapsedMs} ms`,
		);
	} finally {
		await app.close();
	}
});
