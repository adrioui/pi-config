import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { activityMonitor } from "./activity.js";

const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
const CONFIG_PATH = join(homedir(), ".pi", "web-search.json");
const DEFAULT_TOKENS = 5000;
const TIMEOUT_MS = 30000;

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CodeSearchOptions {
	/** Number of tokens to return (1000–50000). Defaults to 5000. */
	tokensNum?: number;
	signal?: AbortSignal;
}

export interface CodeSearchResponse {
	content: string;
	query: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

interface CodeSearchConfig {
	exaApiKey?: string;
}

let cachedConfig: CodeSearchConfig | null = null;

function loadConfig(): CodeSearchConfig {
	if (cachedConfig) return cachedConfig;
	if (existsSync(CONFIG_PATH)) {
		try {
			cachedConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as CodeSearchConfig;
			return cachedConfig;
		} catch {
			cachedConfig = {};
		}
	} else {
		cachedConfig = {};
	}
	return cachedConfig;
}

function getExaApiKey(): string | null {
	const envKey = process.env.EXA_API_KEY;
	if (envKey) return envKey;
	return loadConfig().exaApiKey ?? null;
}

/**
 * Returns true if an Exa API key is available (env or ~/.pi/web-search.json).
 * The code-search endpoint works without a key but rate limits are stricter.
 */
export function isCodeSearchAvailable(): boolean {
	return getExaApiKey() !== null;
}

// ─── abortAfterAny helper ────────────────────────────────────────────────────

/**
 * Combines a millisecond timeout with optional caller-supplied signals.
 * Returns { signal, clearTimeout } — call clearTimeout() after fetch resolves
 * to prevent the timer from firing if the response came back before the deadline.
 */
function abortAfterAny(
	timeoutMs: number,
	...extraSignals: (AbortSignal | undefined)[]
): { signal: AbortSignal; clearTimeout: () => void } {
	const timeoutController = new AbortController();
	const id = setTimeout(() => timeoutController.abort(), timeoutMs);
	const validExtras = extraSignals.filter((s): s is AbortSignal => s !== undefined);
	const signal = AbortSignal.any([timeoutController.signal, ...validExtras]);
	return {
		signal,
		clearTimeout: () => clearTimeout(id),
	};
}

// ─── JSON-RPC types ──────────────────────────────────────────────────────────

interface McpCodeRequest {
	jsonrpc: "2.0";
	id: number;
	method: "tools/call";
	params: {
		name: "get_code_context_exa";
		arguments: {
			query: string;
			tokensNum: number;
		};
	};
}

interface McpCodeResponse {
	jsonrpc: string;
	result: {
		content: Array<{
			type: string;
			text: string;
		}>;
	};
}

// ─── searchCode ──────────────────────────────────────────────────────────────

/**
 * Search for code context via the Exa AI MCP endpoint.
 *
 * @param query    Natural-language or API-name query.
 * @param options  Optional tokensNum (1000–50000) and AbortSignal.
 */
export async function searchCode(
	query: string,
	options: CodeSearchOptions = {},
): Promise<CodeSearchResponse> {
	const tokensNum = options.tokensNum ?? DEFAULT_TOKENS;

	const activityId = activityMonitor.logStart({ type: "api", query });

	const requestBody: McpCodeRequest = {
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: {
			name: "get_code_context_exa",
			arguments: {
				query,
				tokensNum,
			},
		},
	};

	const headers: Record<string, string> = {
		accept: "application/json, text/event-stream",
		"content-type": "application/json",
	};

	const apiKey = getExaApiKey();
	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`;
	}

	const { signal, clearTimeout: clearTimeoutFn } = abortAfterAny(TIMEOUT_MS, options.signal);

	let response: Response;
	try {
		response = await fetch(EXA_MCP_URL, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
			signal,
		});
	} catch (err) {
		clearTimeoutFn();
		const message = err instanceof Error ? err.message : String(err);
		if (err instanceof Error && err.name === "AbortError") {
			activityMonitor.logComplete(activityId, 0);
			throw new Error("Code search timed out");
		}
		activityMonitor.logError(activityId, message);
		throw err;
	}

	clearTimeoutFn();

	if (!response.ok) {
		activityMonitor.logComplete(activityId, response.status);
		const errorText = await response.text();
		throw new Error(`Code search error (${response.status}): ${errorText}`);
	}

	let responseText: string;
	try {
		responseText = await response.text();
	} catch (err) {
		activityMonitor.logComplete(activityId, response.status);
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to read code search response: ${message}`);
	}

	activityMonitor.logComplete(activityId, response.status);

	// Parse SSE response — each event line starts with "data: "
	const lines = responseText.split("\n");
	for (const line of lines) {
		if (!line.startsWith("data: ")) continue;
		try {
			const data = JSON.parse(line.substring(6)) as McpCodeResponse;
			const text = data?.result?.content?.[0]?.text;
			if (text) {
				return { content: text, query };
			}
		} catch {
			// Malformed JSON in this SSE line — keep scanning
		}
	}

	// No usable content found in any SSE event
	return {
		content:
			"No code snippets or documentation found. Please try a different query, " +
			"be more specific about the library or programming concept, " +
			"or check the spelling of framework names.",
		query,
	};
}
