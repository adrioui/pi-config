import { SEARCH_PROVIDERS, fetchSearchPage } from "./search-providers.js";
import type { ProviderSearchResult, SearchOptions, SearchQueryState, SearchResponse } from "./types.js";

function simplifyQuery(query: string): string {
	const firstLine = query.split("\n")[0]?.trim() || query.trim();
	const words = firstLine.split(/\s+/).filter(Boolean);
	if (words.length <= 10) return firstLine;
	return words.slice(0, 10).join(" ");
}

function queryVariants(query: string): string[] {
	const variants = [query];
	const simplified = simplifyQuery(query);
	if (simplified && simplified !== query) variants.push(simplified);
	return [...new Set(variants)];
}

function labelForProvider(id: string): string {
	return SEARCH_PROVIDERS.find((provider) => provider.id === id)?.label || id;
}

function matchesDomain(host: string, domain: string): boolean {
	const normalizedHost = host.toLowerCase();
	const normalizedDomain = domain.trim().toLowerCase();
	return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function applyDomainFilter(results: SearchQueryState["pages"][number]["results"], domainFilter?: string[]): SearchQueryState["pages"][number]["results"] {
	if (!domainFilter || domainFilter.length === 0) return results;
	const positive = domainFilter.map((item) => item.trim()).filter(Boolean).filter((item) => !item.startsWith("-"));
	const negative = domainFilter.map((item) => item.trim()).filter((item) => item.startsWith("-")).map((item) => item.slice(1));
	return results.filter((result) => {
		let host = "";
		try {
			host = new URL(result.url).hostname.toLowerCase();
		} catch {
			return false;
		}
		if (negative.some((domain) => matchesDomain(host, domain))) return false;
		if (positive.length === 0) return true;
		return positive.some((domain) => matchesDomain(host, domain));
	});
}

function summarizeFailure(attempts: Array<{ provider: string; challenged?: boolean; error?: string }>): string {
	const labels = [...new Set(attempts.map((attempt) => labelForProvider(attempt.provider)))];
	const errors = attempts
		.filter((attempt) => attempt.error)
		.map((attempt) => `${labelForProvider(attempt.provider)}: ${attempt.error}`);
	if (errors.length > 0) return `No results found after trying ${labels.join(", ")}. Errors: ${errors.join("; ")}`;
	if (attempts.some((attempt) => attempt.challenged)) {
		return `No results found after trying ${labels.join(", ")}. Some providers returned anti-bot or challenge pages.`;
	}
	return `No results found after trying ${labels.join(", ")}.`;
}

function toQueryState(query: string, requestQuery: string, attempt: ProviderSearchResult): SearchQueryState {
	return {
		query,
		requestQuery,
		answer: `Found ${attempt.results.length} result(s) from ${labelForProvider(attempt.provider)}.`,
		pages: [{
			page: 1,
			provider: attempt.provider,
			results: attempt.results,
			nextCursor: attempt.nextCursor,
			exhausted: attempt.exhausted,
			fetchedAt: Date.now(),
		}],
		error: null,
		exhausted: attempt.exhausted,
		providersTried: [attempt.provider],
		selectedProvider: attempt.provider,
	};
}

export async function searchWithProviders(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
	const maxResults = Math.min(options.numResults ?? 5, 20);
	const attempts: Array<{ provider: string; challenged?: boolean; error?: string }> = [];

	for (const variant of queryVariants(query)) {
		for (const provider of SEARCH_PROVIDERS) {
			const attempt = await provider.search({
				query: variant,
				maxResults,
				recencyFilter: options.recencyFilter,
				domainFilter: options.domainFilter,
				signal: options.signal,
			});
			attempt.results = applyDomainFilter(attempt.results, options.domainFilter);
			attempts.push({ provider: attempt.provider, challenged: attempt.challenged, error: attempt.error });
			if (attempt.results.length > 0) {
				return { queryState: toQueryState(query, variant, attempt), usedVariant: variant };
			}
		}
	}

	return {
		queryState: {
			query,
			requestQuery: query,
			answer: summarizeFailure(attempts),
			pages: [{ page: 1, provider: "none", results: [], exhausted: true, fetchedAt: Date.now() }],
			error: null,
			exhausted: true,
			providersTried: attempts.map((attempt) => attempt.provider),
			selectedProvider: null,
		},
		usedVariant: query,
	};
}

export async function ensureSearchPage(
	queryState: SearchQueryState,
	targetPage: number,
	options: SearchOptions = {},
): Promise<SearchQueryState> {
	if (targetPage <= 1 || queryState.pages.length >= targetPage || queryState.exhausted) return queryState;
	const maxResults = Math.min(options.numResults ?? 5, 20);
	let state = { ...queryState, pages: [...queryState.pages] };

	while (!state.exhausted && state.pages.length < targetPage) {
		const lastPage = state.pages[state.pages.length - 1];
		if (!lastPage?.nextCursor) {
			state.exhausted = true;
			break;
		}
		const fetched = await fetchSearchPage(lastPage.nextCursor, {
			query: state.requestQuery,
			maxResults,
			recencyFilter: options.recencyFilter,
			domainFilter: options.domainFilter,
			signal: options.signal,
		});
		fetched.results = applyDomainFilter(fetched.results, options.domainFilter);
		state.providersTried = [...new Set([...state.providersTried, fetched.provider])];
		state.pages.push({
			page: state.pages.length + 1,
			provider: fetched.provider,
			results: fetched.results,
			nextCursor: fetched.nextCursor,
			exhausted: fetched.exhausted,
			fetchedAt: Date.now(),
		});
		state.exhausted = fetched.exhausted;
		if (fetched.results.length === 0 && fetched.error) {
			state.error = fetched.error;
			break;
		}
	}

	return state;
}
