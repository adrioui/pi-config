import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { activityMonitor } from "./activity.js";
import type { SearchOptions, SearchResponse, SearchResult } from "./perplexity.js";
import type { ExtractedContent } from "./extract.js";

const CONFIG_PATH = join(homedir(), ".pi", "web-search.json");
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const DEFAULT_SEARCH_MODEL = "claude-haiku-4-5";
const DEFAULT_FETCH_MODEL = "claude-haiku-4-5";
const SEARCH_TOOL_TYPE = "web_search_20250305";
const FETCH_TOOL_TYPE = "web_fetch_20250910";
const DEFAULT_MAX_SEARCH_USES = 5;
const DEFAULT_MAX_FETCH_USES = 3;
const DEFAULT_TIMEOUT_MS = 45_000;

interface AnthropicWebConfig {
	anthropicApiKey?: string;
	anthropicApiUrl?: string;
	anthropicSearchModel?: string;
	anthropicFetchModel?: string;
}

interface AnthropicMessageResponse {
	id?: string;
	stop_reason?: string | null;
	content?: Array<Record<string, unknown>>;
	usage?: Record<string, unknown>;
	error?: { type?: string; message?: string };
}

let cachedConfig: AnthropicWebConfig | null = null;

function loadConfig(): AnthropicWebConfig {
	if (cachedConfig) return cachedConfig;
	try {
		if (existsSync(CONFIG_PATH)) {
			cachedConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as AnthropicWebConfig;
			return cachedConfig;
		}
	} catch {}
	cachedConfig = {};
	return cachedConfig;
}

function getApiKey(): string | null {
	return process.env.ANTHROPIC_API_KEY || loadConfig().anthropicApiKey || null;
}

function getApiUrl(): string {
	return process.env.ANTHROPIC_API_URL || loadConfig().anthropicApiUrl || API_URL;
}

function getSearchModel(): string {
	return loadConfig().anthropicSearchModel || DEFAULT_SEARCH_MODEL;
}

function getFetchModel(): string {
	return loadConfig().anthropicFetchModel || DEFAULT_FETCH_MODEL;
}

export function isAnthropicWebAvailable(): boolean {
	return Boolean(getApiKey());
}

function abortAfterAny(
	ms: number,
	...signals: (AbortSignal | undefined)[]
): { signal: AbortSignal; clearTimeout: () => void } {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error("Anthropic web request timed out")), ms);
	const clearTimer = () => clearTimeout(timer);
	for (const sig of signals.filter((s): s is AbortSignal => s != null)) {
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

async function postAnthropicMessage(
	body: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<AnthropicMessageResponse> {
	const apiKey = getApiKey();
	if (!apiKey) {
		throw new Error("Anthropic web tools unavailable. Set ANTHROPIC_API_KEY or anthropicApiKey in ~/.pi/web-search.json");
	}

	const { signal: timeoutSignal, clearTimeout } = abortAfterAny(DEFAULT_TIMEOUT_MS, signal);
	try {
		const res = await fetch(getApiUrl(), {
			method: "POST",
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": API_VERSION,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: timeoutSignal,
		});
		clearTimeout();
		const data = await res.json() as AnthropicMessageResponse;
		if (!res.ok) {
			const message = data?.error?.message || `Anthropic API error ${res.status}`;
			throw new Error(message);
		}
		return data;
	} catch (err) {
		clearTimeout();
		throw err;
	}
}

function buildSearchPrompt(query: string, options: SearchOptions): string {
	let prompt = `Search the web for the following query and provide a concise factual answer with citations and source links. Query: ${query}`;
	if (options.recencyFilter) {
		const labels: Record<string, string> = {
			day: "past 24 hours",
			week: "past week",
			month: "past month",
			year: "past year",
		};
		prompt += `\nOnly prioritize results from the ${labels[options.recencyFilter]}.`;
	}
	return prompt;
}

function extractSearchResults(content: Array<Record<string, unknown>> | undefined): SearchResult[] {
	const results: SearchResult[] = [];
	for (const block of content ?? []) {
		if (block.type !== "web_search_tool_result") continue;
		const blockContent = block.content;
		if (Array.isArray(blockContent)) {
			for (const item of blockContent) {
				if (!item || typeof item !== "object") continue;
				const result = item as Record<string, unknown>;
				if (result.type !== "web_search_result") continue;
				const url = typeof result.url === "string" ? result.url : "";
				if (!url) continue;
				results.push({
					title: typeof result.title === "string" ? result.title : url,
					url,
					snippet: typeof result.page_age === "string" ? result.page_age : "",
				});
			}
			continue;
		}
		if (blockContent && typeof blockContent === "object") {
			const single = blockContent as Record<string, unknown>;
			if (single.type === "web_search_tool_result_error") {
				const code = typeof single.error_code === "string" ? single.error_code : "unknown";
				throw new Error(`Anthropic web search error: ${code}`);
			}
		}
	}
	return results;
}

function extractTextAnswer(content: Array<Record<string, unknown>> | undefined): string {
	return (content ?? [])
		.filter(block => block.type === "text" && typeof block.text === "string")
		.map(block => String(block.text))
		.join("")
		.trim();
}

async function runServerToolLoop(
	initialUserText: string,
	model: string,
	tools: Array<Record<string, unknown>>,
	signal?: AbortSignal,
): Promise<AnthropicMessageResponse> {
	const messages: Array<Record<string, unknown>> = [
		{ role: "user", content: initialUserText },
	];
	const allContent: Array<Record<string, unknown>> = [];

	for (let i = 0; i < 3; i++) {
		const response = await postAnthropicMessage({
			model,
			max_tokens: 2048,
			messages,
			tools,
		}, signal);
		allContent.push(...(response.content ?? []));
		if (response.stop_reason !== "pause_turn") {
			return {
				...response,
				content: allContent,
			};
		}
		messages.push({ role: "assistant", content: response.content ?? [] });
	}

	throw new Error("Anthropic server tool exceeded pause_turn continuation limit");
}

export async function searchWithAnthropicWeb(
	query: string,
	options: SearchOptions = {},
): Promise<SearchResponse> {
	const activityId = activityMonitor.logStart({ type: "api", query });
	try {
		const includes = (options.domainFilter ?? []).filter(d => !d.startsWith("-"));
		const excludes = (options.domainFilter ?? []).filter(d => d.startsWith("-")).map(d => d.slice(1));
		const tools: Array<Record<string, unknown>> = [{
			type: SEARCH_TOOL_TYPE,
			name: "web_search",
			max_uses: DEFAULT_MAX_SEARCH_USES,
			...(includes.length ? { allowed_domains: includes } : {}),
			...(excludes.length ? { blocked_domains: excludes } : {}),
		}];
		const response = await runServerToolLoop(buildSearchPrompt(query, options), getSearchModel(), tools, options.signal);
		const answer = extractTextAnswer(response.content) || "No results found.";
		const results = extractSearchResults(response.content).slice(0, options.numResults ?? 8);
		activityMonitor.logComplete(activityId, 200);
		return { answer, results };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("timed out")) {
			activityMonitor.logComplete(activityId, 0);
		} else {
			activityMonitor.logError(activityId, message);
		}
		throw err;
	}
}

function extractFetchedDocument(content: Array<Record<string, unknown>> | undefined): { title: string; content: string; error: string | null } | null {
	for (const block of content ?? []) {
		if (block.type !== "web_fetch_tool_result") continue;
		const payload = block.content;
		if (!payload || typeof payload !== "object") continue;
		const result = payload as Record<string, unknown>;
		if (result.type === "web_fetch_tool_error") {
			const code = typeof result.error_code === "string" ? result.error_code : "unknown";
			return { title: "", content: "", error: `Anthropic web fetch error: ${code}` };
		}
		if (result.type !== "web_fetch_result") continue;
		const doc = result.content as Record<string, unknown> | undefined;
		if (!doc || typeof doc !== "object") continue;
		const title = typeof doc.title === "string" ? doc.title : "";
		const source = doc.source as Record<string, unknown> | undefined;
		if (source && source.type === "text" && typeof source.data === "string") {
			return { title, content: source.data, error: null };
		}
	}
	return null;
}

export async function fetchWithAnthropicWeb(
	url: string,
	signal?: AbortSignal,
	prompt?: string,
): Promise<ExtractedContent | null> {
	if (!isAnthropicWebAvailable()) return null;
	const activityId = activityMonitor.logStart({ type: "api", query: `anthropic_fetch: ${url}` });
	try {
		const userPrompt = prompt
			? `Fetch the content at ${url} and answer this question using the fetched page: ${prompt}`
			: `Fetch the content at ${url} and return the complete readable content as clean markdown.`;
		const response = await runServerToolLoop(userPrompt, getFetchModel(), [{
			type: FETCH_TOOL_TYPE,
			name: "web_fetch",
			max_uses: DEFAULT_MAX_FETCH_USES,
			citations: { enabled: true },
			max_content_tokens: 100000,
		}], signal);
		const fetched = extractFetchedDocument(response.content);
		const answerText = extractTextAnswer(response.content);
		activityMonitor.logComplete(activityId, 200);
		if (fetched?.error) {
			return { url, title: "", content: "", error: fetched.error };
		}
		if (fetched && fetched.content.trim()) {
			return {
				url,
				title: fetched.title || url,
				content: fetched.content,
				error: null,
			};
		}
		if (answerText) {
			return {
				url,
				title: url,
				content: answerText,
				error: null,
			};
		}
		return null;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("timed out")) {
			activityMonitor.logComplete(activityId, 0);
		} else {
			activityMonitor.logError(activityId, message);
		}
		return null;
	}
}
