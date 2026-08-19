import { test } from "node:test";
import assert from "node:assert/strict";
import SinkMemory from "@eik/sink-memory";
import Server from "../lib/main.js";

// Regression: mergeStreams used a reactive str.on("pipe", ...) approach to
// increment maxListeners on the PassThrough destination as sources were piped
// in. @metrics/client extends readable-stream whose pipe() emits the "pipe"
// event on the SOURCE, not the destination, so the reactive increment never
// fired. With 12 metric streams piped into one PassThrough the limit of 10 was
// exceeded, producing a MaxListenersExceededWarning on startup.
test("constructing EikService does not produce a MaxListenersExceededWarning", async () => {
	/** @type {Error[]} */
	const warnings = [];
	/** @param {Error} w */
	const onWarning = (w) => {
		warnings.push(w);
	};
	process.on("warning", onWarning);

	try {
		const sink = new SinkMemory();
		// Construction pipes 12 metrics streams into one PassThrough via
		// mergeStreams — this is where the warning fires when unfixed.
		new Server({ sink });

		// Warnings are emitted asynchronously via process.nextTick; give
		// the event loop a turn before checking.
		await new Promise((resolve) => setImmediate(resolve));

		const maxListenerWarnings = warnings.filter(
			(w) => w.name === "MaxListenersExceededWarning",
		);

		assert.equal(
			maxListenerWarnings.length,
			0,
			`Expected no MaxListenersExceededWarning but got: ${maxListenerWarnings.map((w) => w.message).join(", ")}`,
		);
	} finally {
		process.off("warning", onWarning);
	}
});
