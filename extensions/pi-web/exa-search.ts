import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SearchResult, SearchResponse, SearchOptions } from "./perplexity.js";
import { activityMonitor } from "./activity.js";

const EXA_MCP_URL = "https://mcp.exa.ai/mcp";
const CONFIG_PATH = join(homedir(), ".pi", "web-search.json");
const TIMEOUT_MS = 25_000;

interface ExaWebSearchConfig {
	exaApiKey?: string;
}

let cachedConfig: ExaWebSearchConfig | null = null;

function loadConfig(): ExaWebSearchConfig {
	if (cachedConfig) return cachedConfig;

	if (existsSync(CONFIG_PATH)) {
		try {
			const content = readFileSync(CONFIG_PATH, "utf-8");
			cachedConfig = JSON.parse(content) as ExaWebSearchConfig;
			return cachedConfig;
		} catch {
			cachedConfig = {};
		}
	} else {
		cachedConfig = {};
	}
	return cachedConfig;
}

function getExaApiKey(): string | undefined {
	const config = loadConfig();
	return process.env.EXA_API_KEY || config.exaApiKey;
}

export function isExaAvailable(): boolean {
	return Boolean(getExaApiKey());
}

/**
 * Combine a timeout with optional caller-supplied signals so that whichever
 * fires first aborts the fetch.  Returns the combined signal and a way to
 * cancel the internal timer so it doesn't linger after a successful response.
 */
export function abortAfterAny(
	ms: number,
	...signals: (AbortSignal | undefined)[]
): { signal: AbortSignal; clearTimeout: () => void } {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error("Exa search request timed out")), ms);
	const clearTimer = () => clearTimeout(timer);

	const active = signals.filter((s): s is AbortSignal => s != null);

	// Forward any external cancellation to our controller
	for (const sig of active) {
		if (sig.aborted) {
			clearTimer();
			controller.abort(sig.reason);
			break;
		}
		sig.addEventListener("abort", () => {
			clearTimer();
			controller.abort(sig.reason);
		}, { once: true });
	}

	return { signal: controller.signal, clearTimeout: clearTimer };
}

/**
 * Parse the text payload from the MCP result into a structured answer + source list.
 * Exa may return JSON (with a `results` array) or freeform markdown containing
 * `[title](url)` links and bare https:// URLs.
 */
export function parseMcpResponse(responseText: string): { answer: string; results: SearchResult[] } {
	// --- 1. Try structured JSON ---
	try {
		const parsed = JSON.parse(responseText) as unknown;

		if (parsed && typeof parsed === "object") {
			const obj = parsed as Record<string, unknown>;

			// Shape: { results: Array<{ title, url, text|snippet|summary }> }
			if (Array.isArray(obj.results)) {
				const results: SearchResult[] = [];
				for (const item of obj.results as Record<string, unknown>[]) {
					const url = typeof item.url === "string" ? item.url : "";
					if (!url) continue;
					const title = typeof item.title === "string" ? item.title : url;
					const snippet =
						typeof item.text === "string"
							? item.text.slice(0, 300)
							: typeof item.summary === "string"
							? item.summary.slice(0, 300)
							: typeof item.snippet === "string"
							? item.snippet.slice(0, 300)
							: "";
					results.push({ title, url, snippet });
				}
				const answer =
					typeof obj.answer === "string"
						? obj.answer
						: results.length > 0
						? `Found ${results.length} result(s).`
						: "No results found.";
				return { answer, results };
			}
		}
	} catch {
		// Not JSON – fall through to text extraction
	}

	// --- 2. Markdown / plain-text extraction ---
	const results: SearchResult[] = [];
	const seen = new Set<string>();

	// Markdown links: [title](url)
	const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
	for (const match of responseText.matchAll(linkRegex)) {
		const url = match[2].trim();
		if (seen.has(url)) continue;
		seen.add(url);
		results.push({ title: match[1].trim(), url, snippet: "" });
	}

	// Bare URLs not already captured
	const bareUrlRegex = /(?<!\()(https?:\/\/[^\s"'<>)\]]+)/g;
	for (const match of responseText.matchAll(bareUrlRegex)) {
		const url = match[1].trim().replace(/[.,;!?]+$/, "");
		if (seen.has(url)) continue;
		seen.add(url);
		results.push({ title: url, url, snippet: "" });
	}

	const answer = responseText.trim() || "No results found.";
	return { answer, results };
}

/**
 * Parse a raw SSE (or plain JSON) response body from the Exa MCP endpoint.
 * The endpoint streams `data: <json>` lines; we collect them all and pick the
 * first one that carries a `result` payload.
 */
function parseSseBody(raw: string): Record<string, unknown> | null {
	const lines = raw.split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) continue;
		const jsonStr = trimmed.slice("data:".length).trim();
		if (!jsonStr || jsonStr === "[DONE]") continue;
		try {
			const msg = JSON.parse(jsonStr) as Record<string, unknown>;
			if (msg.result !== undefined || msg.error !== undefined) return msg;
		} catch {
			// Skip malformed frames
		}
	}

	// Fallback: try to parse the whole body as JSON (non-SSE servers)
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export async function searchWithExa(
	query: string,
	options: SearchOptions = {},
): Promise<SearchResponse> {
	const activityId = activityMonitor.logStart({ type: "api", query });

	const { signal, clearTimeout: cancelTimer } = abortAfterAny(TIMEOUT_MS, options.signal);

	const requestBody = {
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: {
			name: "web_search_exa",
			arguments: {
				query,
				type: "auto",
				numResults: options.numResults ?? 8,
				livecrawl: "fallback",
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

	let response: Response;
	try {
		response = await fetch(EXA_MCP_URL, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
			signal,
		});
	} catch (err) {
		cancelTimer();
		const message = err instanceof Error ? err.message : String(err);
		if (
			message.toLowerCase().includes("abort") ||
			message.toLowerCase().includes("timed out") ||
			(err instanceof Error && err.name === "AbortError")
		) {
			activityMonitor.logComplete(activityId, 0);
			throw new Error("Exa search request timed out");
		}
		activityMonitor.logError(activityId, message);
		throw err;
	}

	cancelTimer();

	if (!response.ok) {
		activityMonitor.logComplete(activityId, response.status);
		const errorText = await response.text();
		throw new Error(`Exa MCP error ${response.status}: ${errorText.slice(0, 300)}`);
	}

	let rawBody: string;
	try {
		rawBody = await response.text();
	} catch {
		activityMonitor.logComplete(activityId, response.status);
		throw new Error("Exa MCP returned an unreadable response body");
	}

	const rpcMsg = parseSseBody(rawBody);

	if (!rpcMsg) {
		activityMonitor.logComplete(activityId, response.status);
		return { answer: "No results found.", results: [] };
	}

	// JSON-RPC error frame
	if (rpcMsg.error) {
		activityMonitor.logComplete(activityId, response.status);
		const rpcError = rpcMsg.error as Record<string, unknown>;
		throw new Error(`Exa MCP RPC error: ${rpcError.message ?? JSON.stringify(rpcMsg.error)}`);
	}

	// Extract result.content[0].text
	const result = rpcMsg.result as Record<string, unknown> | undefined;
	const content = Array.isArray(result?.content) ? result!.content : [];
	const firstContent = content[0] as Record<string, unknown> | undefined;
	const resultText = typeof firstContent?.text === "string" ? firstContent.text : "";

	if (!resultText.trim()) {
		activityMonitor.logComplete(activityId, response.status);
		return { answer: "No results found.", results: [] };
	}

	const { answer, results } = parseMcpResponse(resultText);
	activityMonitor.logComplete(activityId, response.status);
	return { answer, results };
}
