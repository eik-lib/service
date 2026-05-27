import crypto from "node:crypto";

const Entry = class Entry {
	/** @param {{ mimeType?: string, payload?: Buffer[] }} options */
	constructor({ mimeType = "application/octet-stream", payload = [] } = {}) {
		this._mimeType = mimeType;
		this._payload = payload;
		this._hash = "";

		if (Array.isArray(payload)) {
			const hash = crypto.createHash("sha512");
			payload.forEach((buffer) => {
				hash.update(buffer.toString());
			});
			this._hash = `sha512-${hash.digest("base64")}`;
		}
	}

	get mimeType() {
		return this._mimeType;
	}

	get payload() {
		return this._payload;
	}

	get hash() {
		return this._hash;
	}

	get [Symbol.toStringTag]() {
		return "Entry";
	}
};

export default Entry;
