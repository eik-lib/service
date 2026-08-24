declare module "convict";
declare module "http-errors";
declare module "@eik/sink-memory";
declare module "@eik/sink-file-system";

declare module "http" {
	interface IncomingMessage {
		/** Per-request trace ID threaded through the upload stack for log correlation. */
		traceId?: string;
	}
}
