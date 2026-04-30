import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { fetchPages } from "./content-fetch.js";
import {
	MAX_INLINE_CONTENT,
	buildSearchQuery,
	clampNumber,
	formatSearchSummary,
	numericIndex,
	sectionizeForObjective,
	sliceWithNotice,
	uniqueNonEmpty,
} from "./format.js";
import { ensureSearchPage, searchWithProviders } from "./search.js";
import { WebResultStore } from "./store.js";
import type { FetchedPage, SearchQueryState, StoredFetch, StoredSearch } from "./types.js";

function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function resolveObjective(params: Record<string, unknown>): string {
	for (const key of ["objective", "context", "query"]) {
		const value = params[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	const queries = params.queries;
	if (Array.isArray(queries) && typeof queries[0] === "string") return queries[0].trim();
	return "";
}

function renderSearchOutput(queryState: SearchQueryState, responseId: string, queryIndex: number, multiQuery: boolean): string {
	const page = queryState.pages[0];
	let output = "";
	if (multiQuery) output += `## Search Query: "${queryState.query}"\n\n`;
	if (queryState.error) output += `Error: ${queryState.error}\n\n`;
	else output += formatSearchSummary(queryState.answer, page?.results ?? []) + "\n\n";
	if (page?.nextCursor) {
		output += `More results available via get_search_content with ID "${responseId}" and queryIndex ${queryIndex}, page 2.\n\n`;
	}
	return output;
}

export default function (pi: ExtensionAPI) {
	const store = new WebResultStore((customType, data) => pi.appendEntry(customType, data));

	pi.on("session_start", async (_event, ctx) => {
		store.rehydrate(ctx.sessionManager.getEntries() as Array<Record<string, unknown>>);
	});

	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web for information relevant to a research objective. Use when you need up-to-date information or precise documentation. Provide one objective, optional search_queries to prioritize exact terms, and max_results to control source count.",
		promptSnippet: "web_search: Search the web for a focused research objective",
		promptGuidelines: [
			"Use web_search for factual, current, or public-web questions that benefit from live internet sources.",
			"For context-collapsed research, the user should invoke the /boomerang command directly. Do not call the boomerang tool automatically from a normal assistant turn.",
			"Use objective for the high-level goal and search_queries only as focused boosts.",
		],
		parameters: Type.Object({
			objective: Type.Optional(Type.String({ description: "Natural-language research objective, including source or freshness guidance when relevant." })),
			search_queries: Type.Optional(Type.Array(Type.String(), { description: "Optional keyword queries to prioritize specific terms, APIs, vendors, or phrases." })),
			max_results: Type.Optional(Type.Number({ description: "Maximum results per search query (default 5, max 20)." })),
			recencyFilter: Type.Optional(StringEnum(["day", "week", "month", "year"], { description: "Best-effort recency hint." })),
			domainFilter: Type.Optional(Type.Array(Type.String(), { description: "Limit to domains with site: filters. Prefix with - to exclude." })),
			query: Type.Optional(Type.String({ description: "Compatibility alias for objective." })),
			queries: Type.Optional(Type.Array(Type.String(), { description: "Compatibility alias for search_queries." })),
		}),
		async execute(_toolCallId, params, signal, onUpdate) {
			const objective = resolveObjective(params);
			if (!objective) {
				return { content: [{ type: "text", text: "Error: No objective provided." }], details: { error: "No objective provided" } };
			}

			const prioritizedQueries = uniqueNonEmpty(
				Array.isArray(params.search_queries) ? params.search_queries as string[]
					: Array.isArray(params.queries) ? params.queries as string[]
					: undefined,
			);
			const queryLabels = prioritizedQueries.length > 0 ? prioritizedQueries : [objective];
			const maxResults = clampNumber(params.max_results as number | undefined, 5, 1, 20);
			const queries: SearchQueryState[] = [];

			for (let i = 0; i < queryLabels.length; i++) {
				const queryLabel = queryLabels[i];
				onUpdate?.({
					content: [{ type: "text", text: `Searching ${i + 1}/${queryLabels.length}: ${queryLabel}` }],
					details: { phase: "searching", progress: i / queryLabels.length, currentQuery: queryLabel, backend: "pi-web-v2" },
				});
				try {
					const builtQuery = buildSearchQuery(objective, queryLabel);
					const response = await searchWithProviders(builtQuery, {
						numResults: maxResults,
						recencyFilter: params.recencyFilter as "day" | "week" | "month" | "year" | undefined,
						domainFilter: Array.isArray(params.domainFilter) ? params.domainFilter as string[] : undefined,
						signal,
					});
					queries.push({ ...response.queryState, query: queryLabel });
				} catch (error) {
					queries.push({
						query: queryLabel,
						requestQuery: buildSearchQuery(objective, queryLabel),
						answer: "",
						pages: [{ page: 1, provider: "none", results: [], exhausted: true, fetchedAt: Date.now() }],
						error: error instanceof Error ? error.message : String(error),
						exhausted: true,
						providersTried: [],
						selectedProvider: null,
					});
				}
			}

			const searchId = generateId();
			const record: StoredSearch = {
				id: searchId,
				type: "search",
				timestamp: Date.now(),
				objective,
				queries,
			};
			store.save(record);

			let output = `Objective: ${objective}\n\n`;
			if (prioritizedQueries.length > 0) {
				output += `Prioritized search queries: ${prioritizedQueries.map((query) => `"${query}"`).join(", ")}\n\n`;
			}
			for (let i = 0; i < queries.length; i++) {
				output += renderSearchOutput(queries[i], searchId, i, queryLabels.length > 1);
			}
			output += `---\nFull per-query results available via get_search_content with ID "${searchId}".`;

			return {
				content: [{ type: "text", text: output.trim() }],
				details: {
					objective,
					searchQueries: queryLabels,
					queryCount: queryLabels.length,
					totalResults: queries.reduce((sum, query) => sum + (query.pages[0]?.results.length || 0), 0),
					searchId,
					providers: queries.map((query) => query.selectedProvider),
					backend: "pi-web-v2",
				},
			};
		},
		renderCall(args, theme) {
			const objective = resolveObjective(args as Record<string, unknown>);
			const display = objective.length > 70 ? objective.slice(0, 67) + "..." : objective;
			return new Text(theme.fg("toolTitle", theme.bold("search ")) + theme.fg("accent", display || "(no objective)"), 0, 0);
		},
	});

	pi.registerTool({
		name: "fetch_content",
		label: "Fetch Content",
		description:
			"Read the contents of a web page at a URL. With only url, returns readable content converted to markdown. With objective, returns excerpts relevant to that objective. Use forceRefetch for latest or recent content.",
		promptSnippet: "fetch_content: Read a public web page directly and extract the relevant content",
		promptGuidelines: [
			"Use fetch_content only for URLs the user provided directly or URLs already discovered through web_search.",
			"For context-collapsed research, the user should invoke the /boomerang command directly. Do not call the boomerang tool automatically from a normal assistant turn.",
			"Do not use fetch_content for localhost, private-network, or internal URLs; use shell/curl instead.",
		],
		parameters: Type.Object({
			url: Type.Optional(Type.String({ description: "Single URL to read." })),
			urls: Type.Optional(Type.Array(Type.String(), { description: "Multiple URLs to read." })),
			objective: Type.Optional(Type.String({ description: "Natural-language research goal. If set, only relevant excerpts are returned inline." })),
			forceRefetch: Type.Optional(Type.Boolean({ description: "Force a live fetch of the URL." })),
			prompt: Type.Optional(Type.String({ description: "Compatibility alias for objective." })),
		}),
		async execute(_toolCallId, params, signal, onUpdate) {
			const urls = uniqueNonEmpty(
				Array.isArray(params.urls) ? params.urls as string[]
					: typeof params.url === "string" ? [params.url]
					: undefined,
			);
			const objective = typeof params.objective === "string" && params.objective.trim()
				? params.objective.trim()
				: typeof params.prompt === "string" && params.prompt.trim()
				? params.prompt.trim()
				: "";
			const forceRefetch = params.forceRefetch === true;

			if (urls.length === 0) {
				return { content: [{ type: "text", text: "Error: No URL provided." }], details: { error: "No URL provided" } };
			}

			for (let i = 0; i < urls.length; i++) {
				onUpdate?.({
					content: [{ type: "text", text: `Reading ${i + 1}/${urls.length}: ${urls[i]}` }],
					details: { phase: "fetching", progress: i / urls.length, currentUrl: urls[i], backend: "pi-web-v2" },
				});
			}

			const fetched = await fetchPages(urls, forceRefetch, signal);
			const responseId = generateId();
			const record: StoredFetch = { id: responseId, type: "fetch", timestamp: Date.now(), urls: fetched };
			store.save(record);

			if (fetched.length === 1) {
				const page = fetched[0];
				if (page.error) {
					return {
						content: [{ type: "text", text: `Error: ${page.error}` }],
						details: { error: page.error, responseId, url: page.url },
					};
				}
				const inline = objective ? sectionizeForObjective(page.content, objective) : page.content;
				const sliced = sliceWithNotice(inline, 0, MAX_INLINE_CONTENT);
				const output = `${sliced.text}\n\n---\nFull content available via get_search_content with ID "${responseId}".`;
				return {
					content: [{ type: "text", text: output.trim() }],
					details: {
						url: page.url,
						title: page.title,
						responseId,
						contentLength: page.content.length,
						objective: objective || undefined,
						truncated: sliced.truncated,
						extractor: page.extractor,
						backend: "pi-web-v2",
					},
				};
			}

			let output = objective ? `Objective: ${objective}\n\n## Fetched URLs\n\n` : "## Fetched URLs\n\n";
			for (const page of fetched) {
				if (page.error) output += `- ${page.url}: Error - ${page.error}\n`;
				else output += `- ${page.title || page.url} (${page.content.length} chars, extractor: ${page.extractor || "unknown"})\n`;
			}
			output += `\n---\nFull content available via get_search_content with ID "${responseId}".`;
			return {
				content: [{ type: "text", text: output.trim() }],
				details: {
					responseId,
					urlCount: fetched.length,
					successful: fetched.filter((page) => !page.error).length,
					backend: "pi-web-v2",
				},
			};
		},
		renderCall(args, theme) {
			const target = typeof args.url === "string" ? args.url : Array.isArray(args.urls) ? `${args.urls.length} URLs` : "(no URL)";
			return new Text(theme.fg("toolTitle", theme.bold("fetch ")) + theme.fg("accent", target), 0, 0);
		},
	});

	pi.registerTool({
		name: "get_search_content",
		label: "Get Search Content",
		description: "Retrieve full content from a previous web_search or fetch_content call.",
		parameters: Type.Object({
			responseId: Type.String({ description: "The ID returned by web_search or fetch_content." }),
			query: Type.Optional(Type.String({ description: "Search query label to retrieve." })),
			queryIndex: Type.Optional(Type.Number({ description: "Search query index to retrieve." })),
			page: Type.Optional(Type.Number({ description: "Search result page number to retrieve or fetch (1-indexed)." })),
			resultOffset: Type.Optional(Type.Number({ description: "Starting result offset within a retrieved search page." })),
			limit: Type.Optional(Type.Number({ description: "Maximum number of search results to include from the selected page." })),
			url: Type.Optional(Type.String({ description: "Fetched URL to retrieve." })),
			urlIndex: Type.Optional(Type.Number({ description: "Fetched URL index to retrieve." })),
			contentOffset: Type.Optional(Type.Number({ description: "Character offset when slicing stored fetched page content." })),
			contentLimit: Type.Optional(Type.Number({ description: "Character count when slicing stored fetched page content." })),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			let data = store.get(params.responseId);
			if (!data && ctx) {
				store.rehydrate(ctx.sessionManager.getEntries() as Array<Record<string, unknown>>);
				data = store.get(params.responseId);
			}
			if (!data) {
				return { content: [{ type: "text", text: `Error: No stored results for "${params.responseId}"` }], details: { error: "Not found" } };
			}

			if (data.type === "search") {
				const queryIndex = typeof params.query === "string"
					? data.queries.findIndex((query) => query.query === params.query)
					: numericIndex(params.queryIndex) ?? 0;
				if (queryIndex < 0 || queryIndex >= data.queries.length) {
					return { content: [{ type: "text", text: "Error: Search query not found." }], details: { error: "Search query not found" } };
				}

				let queryState = data.queries[queryIndex];
				const targetPage = clampNumber(params.page as number | undefined, 1, 1, 50);
				if (targetPage > queryState.pages.length && !queryState.exhausted) {
					queryState = await ensureSearchPage(queryState, targetPage, {
						numResults: clampNumber(params.limit as number | undefined, 5, 1, 20),
						signal,
					});
					data = {
						...data,
						queries: data.queries.map((entry, index) => index === queryIndex ? queryState : entry),
					};
					store.save(data);
				}

				const page = queryState.pages[targetPage - 1];
				if (!page) {
					return {
						content: [{ type: "text", text: `Error: Search page ${targetPage} is not available.` }],
						details: { error: "Search page not available", availablePages: queryState.pages.length },
					};
				}

				const resultOffset = clampNumber(params.resultOffset as number | undefined, 0, 0, 1000);
				const resultLimit = clampNumber(params.limit as number | undefined, page.results.length || 5, 1, 20);
				const results = page.results.slice(resultOffset, resultOffset + resultLimit);
				const output = `## Results for "${queryState.query}" (page ${page.page})\n\n${formatSearchSummary(queryState.answer, results)}${page.nextCursor ? `\n\n---\nMore results remain. Request page ${page.page + 1} with the same response ID.` : ""}`;
				return {
					content: [{ type: "text", text: output }],
					details: {
						query: queryState.query,
						page: page.page,
						provider: page.provider,
						resultCount: results.length,
						totalCachedPages: queryState.pages.length,
						exhausted: queryState.exhausted,
					},
				};
			}

			let page: FetchedPage | undefined;
			if (typeof params.url === "string") page = data.urls.find((item) => item.url === params.url);
			else if (numericIndex(params.urlIndex) !== undefined) page = data.urls[numericIndex(params.urlIndex)!];
			else page = data.urls[0];

			if (!page) {
				return { content: [{ type: "text", text: "Error: URL not found." }], details: { error: "URL not found" } };
			}
			if (page.error) {
				return { content: [{ type: "text", text: `Error for ${page.url}: ${page.error}` }], details: { error: page.error } };
			}

			const sliced = sliceWithNotice(
				page.content,
				clampNumber(params.contentOffset as number | undefined, 0, 0, Math.max(0, page.content.length)),
				clampNumber(params.contentLimit as number | undefined, MAX_INLINE_CONTENT, 1, MAX_INLINE_CONTENT),
			);
			return {
				content: [{ type: "text", text: `# ${page.title}\n\n${sliced.text}` }],
				details: {
					url: page.url,
					title: page.title,
					contentLength: page.content.length,
					nextOffset: sliced.nextOffset,
					extractor: page.extractor,
				},
			};
		},
	});

	pi.registerTool({
		name: "code_search",
		label: "Code Search",
		description:
			"Search the web for code examples, API documentation, and library references for a coding objective. This is a compatibility wrapper around the providerless web search path.",
		promptSnippet: "code_search: Search the web for code examples and API docs for a coding objective",
		promptGuidelines: [
			"Use code_search for public API docs, library references, and code examples from the web.",
			"For context-collapsed coding research, the user should invoke the /boomerang command directly. Do not call the boomerang tool automatically from a normal assistant turn.",
		],
		parameters: Type.Object({
			objective: Type.Optional(Type.String({ description: "Natural-language coding objective." })),
			search_queries: Type.Optional(Type.Array(Type.String(), { description: "Optional library, API, version, or symbol names to prioritize." })),
			max_results: Type.Optional(Type.Number({ description: "Maximum results (default 5, max 20)." })),
			query: Type.Optional(Type.String({ description: "Compatibility alias for objective." })),
		}),
		async execute(_toolCallId, params, signal, onUpdate) {
			const objective = resolveObjective(params);
			if (!objective) {
				return { content: [{ type: "text", text: "Error: No objective provided." }], details: { error: "No objective provided" } };
			}
			const searchQueries = uniqueNonEmpty(Array.isArray(params.search_queries) ? params.search_queries as string[] : undefined);
			const codeQuery = `${buildSearchQuery(objective, searchQueries.join(" "))} code examples API documentation source`;
			onUpdate?.({ content: [{ type: "text", text: `Searching code context: ${objective}` }] });
			const maxResults = clampNumber(params.max_results as number | undefined, 5, 1, 20);
			const response = await searchWithProviders(codeQuery, { numResults: maxResults, signal });
			const page = response.queryState.pages[0];
			return {
				content: [{ type: "text", text: formatSearchSummary(response.queryState.answer, page?.results ?? []) }],
				details: {
					objective,
					totalResults: page?.results.length ?? 0,
					provider: response.queryState.selectedProvider,
					backend: "pi-web-v2",
				},
			};
		},
	});
}
