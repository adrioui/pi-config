import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isExaAvailable, searchWithExa } from "./exa-search.js";
import { isAnthropicWebAvailable, searchWithAnthropicWeb } from "./anthropic-web.js";
import type { SearchResponse, SearchOptions } from "./perplexity.js";

export type SearchProvider = "auto" | "exa" | "anthropic";

const CONFIG_PATH = join(homedir(), ".pi", "web-search.json");

function getSearchConfig(): { searchProvider: SearchProvider } {
	try {
		if (existsSync(CONFIG_PATH)) {
			const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as {
				provider?: SearchProvider;
				searchProvider?: SearchProvider;
			};
			return {
				searchProvider: raw.provider ?? raw.searchProvider ?? "auto",
			};
		}
	} catch {}
	return { searchProvider: "auto" };
}

export interface FullSearchOptions extends SearchOptions {
	provider?: SearchProvider;
}

export async function search(query: string, options: FullSearchOptions = {}): Promise<SearchResponse> {
	const config = getSearchConfig();
	const provider = options.provider ?? config.searchProvider;

	if (provider === "anthropic") {
		try {
			return await searchWithAnthropicWeb(query, options);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("timed out") || (err instanceof Error && err.name === "AbortError")) {
				throw err;
			}
			if (isExaAvailable()) {
				console.error(`[pi-web] Anthropic web search failed (${msg}), falling back to Exa`);
				return searchWithExa(query, options);
			}
			throw err;
		}
	}

	if (provider === "exa") {
		try {
			return await searchWithExa(query, options);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("timed out") || (err instanceof Error && err.name === "AbortError")) {
				throw err;
			}
			if (isAnthropicWebAvailable()) {
				console.error(`[pi-web] Exa failed (${msg}), falling back to Anthropic web search`);
				return searchWithAnthropicWeb(query, options);
			}
			throw err;
		}
	}

	// Auto mode priority: Exa -> Anthropic web search
	if (isExaAvailable()) {
		try {
			return await searchWithExa(query, options);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("timed out") || (err instanceof Error && err.name === "AbortError")) {
				throw err;
			}
			console.error(`[pi-web] Exa search failed, trying Anthropic fallback: ${msg}`);
		}
	}

	if (isAnthropicWebAvailable()) {
		try {
			return await searchWithAnthropicWeb(query, options);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes("timed out") || (err instanceof Error && err.name === "AbortError")) {
				throw err;
			}
			console.error(`[pi-web] Anthropic web search failed with no remaining fallback: ${msg}`);
		}
	}

	throw new Error(
		"No search provider available. Either:\n" +
		"  1. Set EXA_API_KEY or exaApiKey in ~/.pi/web-search.json\n" +
		"  2. Set ANTHROPIC_API_KEY or anthropicApiKey in ~/.pi/web-search.json",
	);
}
