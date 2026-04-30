export type RecencyFilter = "day" | "week" | "month" | "year";

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	provider: string;
}

export interface SearchQueryState {
	query: string;
	requestQuery: string;
	answer: string;
	pages: SearchPage[];
	error: string | null;
	exhausted: boolean;
	providersTried: string[];
	selectedProvider: string | null;
}

export interface SearchPage {
	page: number;
	provider: string;
	results: SearchResult[];
	nextCursor?: SearchCursor;
	exhausted: boolean;
	fetchedAt: number;
}

export type SearchCursor = DdgCursor | YahooCursor;

export interface DdgCursor {
	provider: "ddg-html" | "ddg-lite";
	page: number;
	form: Record<string, string>;
}

export interface YahooCursor {
	provider: "yahoo-html";
	page: number;
	nextUrl: string;
}

export interface StoredSearch {
	id: string;
	type: "search";
	timestamp: number;
	objective: string;
	queries: SearchQueryState[];
}

export interface FetchedPage {
	url: string;
	title: string;
	content: string;
	error: string | null;
	status?: number;
	contentType?: string;
	extractor?: string;
	fetchedAt: number;
}

export interface StoredFetch {
	id: string;
	type: "fetch";
	timestamp: number;
	urls: FetchedPage[];
}

export type StoredResult = StoredSearch | StoredFetch;

export interface SearchOptions {
	numResults?: number;
	recencyFilter?: RecencyFilter;
	domainFilter?: string[];
	signal?: AbortSignal;
}

export interface ProviderSearchRequest {
	query: string;
	maxResults: number;
	recencyFilter?: RecencyFilter;
	domainFilter?: string[];
	signal?: AbortSignal;
	cursor?: SearchCursor;
}

export interface ProviderSearchResult {
	provider: string;
	results: SearchResult[];
	nextCursor?: SearchCursor;
	exhausted: boolean;
	challenged?: boolean;
	error?: string;
}

export interface SearchResponse {
	queryState: SearchQueryState;
	usedVariant: string;
}

export type SessionEntryLike = {
	type?: string;
	customType?: string;
	data?: unknown;
};
