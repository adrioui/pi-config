import { parseHTML } from "linkedom";
import type { DdgCursor, ProviderSearchRequest, ProviderSearchResult, SearchCursor, SearchResult, YahooCursor } from "./types.js";

const DDG_HTML_URL = "https://html.duckduckgo.com/html/";
const DDG_LITE_URL = "https://lite.duckduckgo.com/lite/";
const YAHOO_SEARCH_URL = "https://search.yahoo.com/search";
const JINA_READER_BASE = "https://r.jina.ai/http://";

interface SearchProvider {
	id: string;
	label: string;
	search(request: ProviderSearchRequest): Promise<ProviderSearchResult>;
}

function cleanText(value: string | null | undefined): string {
	return value?.replace(/\s+/g, " ").trim() || "";
}

function cleanMarkdownInline(value: string): string {
	let text = value.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
	for (let i = 0; i < 3; i++) {
		const next = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
		if (next === text) break;
		text = next;
	}
	text = text
		.replace(/\]\(https?:\/\/[^)]+\)/g, "")
		.replace(/^\[/, "")
		.replace(/\]$/, "")
		.replace(/\*{4}/g, " ")
		.replace(/\*{2}/g, "")
		.replace(/`/g, "");
	return cleanText(text);
}

function decodeDuckDuckGoUrl(rawHref: string): string {
	try {
		const href = rawHref.startsWith("//") ? `https:${rawHref}` : rawHref;
		const url = new URL(href, DDG_HTML_URL);
		const uddg = url.searchParams.get("uddg");
		return uddg ? decodeURIComponent(uddg) : href;
	} catch {
		return rawHref;
	}
}

function decodeYahooUrl(rawHref: string): string {
	try {
		const href = rawHref.startsWith("/") ? `https://search.yahoo.com${rawHref}` : rawHref;
		const match = href.match(/\/RU=([^/]+)\/RK=/);
		if (match?.[1]) return decodeURIComponent(match[1]);
		const url = new URL(href, YAHOO_SEARCH_URL);
		const ru = url.searchParams.get("RU") || url.searchParams.get("ru");
		return ru ? decodeURIComponent(ru) : url.toString();
	} catch {
		return rawHref;
	}
}

function isUsableResultUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		if (!["http:", "https:"].includes(url.protocol)) return false;
		const host = url.hostname.toLowerCase();
		if (host === "duckduckgo.com" && ["/html/", "/lite/", "/y.js", "/l/"].includes(url.pathname)) return false;
		if (host.endsWith("search.yahoo.com") && url.pathname.startsWith("/search")) return false;
		if (url.searchParams.has("ad_domain") || url.searchParams.has("ad_provider")) return false;
		return true;
	} catch {
		return false;
	}
}

function extractDdgNextCursor(html: string, provider: DdgCursor["provider"]): DdgCursor | undefined {
	const { document } = parseHTML(html);
	const forms = [...document.querySelectorAll("form")];
	for (const form of forms) {
		const submit = form.querySelector('input[type="submit"]');
		const submitValue = cleanText(submit?.getAttribute("value") || submit?.textContent || "").toLowerCase();
		if (!submitValue.includes("next")) continue;
		const fields: Record<string, string> = {};
		for (const input of [...form.querySelectorAll("input[name]")]) {
			const name = input.getAttribute("name");
			if (!name) continue;
			const type = (input.getAttribute("type") || "text").toLowerCase();
			if (type === "submit" || type === "button") continue;
			fields[name] = input.getAttribute("value") || "";
		}
		if (Object.keys(fields).length === 0) continue;
		const pageOffset = Number(fields.s || 0);
		return { provider, page: Number.isFinite(pageOffset) && pageOffset > 0 ? Math.floor(pageOffset / 10) + 1 : 2, form: fields };
	}
	return undefined;
}

function extractYahooNextCursor(html: string, currentPage = 1): YahooCursor | undefined {
	const { document } = parseHTML(html);
	const candidates = [
		document.querySelector('.compPagination a.next[href]'),
		...document.querySelectorAll('.compPagination a[href]'),
		...document.querySelectorAll('a[href]'),
	].filter(Boolean) as Element[];
	for (const candidate of candidates) {
		const text = cleanText(candidate.textContent).toLowerCase();
		const title = cleanText(candidate.getAttribute('title')).toLowerCase();
		const href = candidate.getAttribute('href') || "";
		if (!href) continue;
		if (candidate.classList.contains('next') || text === 'next' || (title.includes('results') && /[?&]b=\d+/.test(href))) {
			const nextUrl = new URL(href, YAHOO_SEARCH_URL);
			// Strip Yahoo's ephemeral path tokens so stored cursors stay usable after session reopen.
			nextUrl.pathname = '/search';
			return {
				provider: "yahoo-html",
				page: currentPage + 1,
				nextUrl: nextUrl.toString(),
			};
		}
	}
	return undefined;
}

function parseDuckDuckGoHtmlResults(html: string, limit: number): SearchResult[] {
	const { document } = parseHTML(html);
	const nodes = [...document.querySelectorAll(".result")];
	const results: SearchResult[] = [];
	for (const node of nodes) {
		if (results.length >= limit) break;
		const link = node.querySelector(".result__a");
		if (!link) continue;
		const title = cleanText(link.textContent) || "Untitled";
		const url = decodeDuckDuckGoUrl(link.getAttribute("href") || "");
		if (!isUsableResultUrl(url)) continue;
		const snippet = cleanText(node.querySelector(".result__snippet")?.textContent);
		results.push({ title, url, snippet, provider: "ddg-html" });
	}
	return results;
}

function parseDuckDuckGoLiteResults(html: string, limit: number): SearchResult[] {
	const { document } = parseHTML(html);
	const links = [...document.querySelectorAll("a.result-link")];
	const results: SearchResult[] = [];
	for (const link of links) {
		if (results.length >= limit) break;
		const title = cleanText(link.textContent) || "Untitled";
		const url = decodeDuckDuckGoUrl(link.getAttribute("href") || "");
		if (!isUsableResultUrl(url)) continue;
		const row = link.closest("tr");
		const snippet = cleanText(row?.nextElementSibling?.querySelector(".result-snippet")?.textContent);
		results.push({ title, url, snippet, provider: "ddg-lite" });
	}
	return results;
}

function parseYahooResults(html: string, limit: number): SearchResult[] {
	const { document } = parseHTML(html);
	const nodes = [...document.querySelectorAll(".algo")];
	const results: SearchResult[] = [];
	for (const node of nodes) {
		if (results.length >= limit) break;
		const link = node.querySelector(".compTitle a[href]") || node.querySelector("a[href]");
		if (!link) continue;
		const titleNode = node.querySelector("h3") || node.querySelector(".title") || link;
		const title = cleanText(titleNode.textContent) || "Untitled";
		const url = decodeYahooUrl(link.getAttribute("href") || "");
		if (!isUsableResultUrl(url)) continue;
		const snippet = cleanText(node.querySelector(".compText p")?.textContent || node.querySelector("p")?.textContent);
		results.push({ title, url, snippet, provider: "yahoo-html" });
	}
	return results;
}

function isDuckDuckGoChallenge(body: string): boolean {
	return body.includes("/anomaly.js?") ||
		body.includes("challenge-form") ||
		body.includes("anomaly-modal") ||
		/please complete the following challenge|unusual traffic/i.test(body);
}

function parseJinaDuckDuckGoResults(markdown: string, limit: number): SearchResult[] {
	const lines = markdown.split("\n");
	const results: SearchResult[] = [];
	for (let i = 0; i < lines.length && results.length < limit; i++) {
		const heading = lines[i].match(/^##\s+\[(.+?)\]\((https?:\/\/[^)]+)\)$/);
		if (!heading) continue;
		const title = cleanText(heading[1]);
		const url = decodeDuckDuckGoUrl(heading[2]);
		if (!title || !isUsableResultUrl(url)) continue;
		let snippet = "";
		for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
			const rawLine = lines[j].trim();
			if (!rawLine || rawLine.startsWith("## ") || rawLine.startsWith("[![Image")) continue;
			const line = cleanMarkdownInline(rawLine);
			if (!line) continue;
			if (line.includes(url) || /^\S+\s+\d{4}-\d{2}-\d{2}T/.test(line)) continue;
			snippet = line;
			break;
		}
		results.push({ title, url, snippet, provider: "jina-ddg" });
	}
	return results;
}

function isYahooChallenge(status: number, body: string): boolean {
	return status >= 400 || /automated queries|forbidden|captcha|unusual traffic/i.test(body);
}

async function fetchText(url: string, init: RequestInit, signal?: AbortSignal): Promise<{ status: number; body: string; contentType: string }> {
	const response = await fetch(url, { ...init, signal });
	const body = await response.text();
	return {
		status: response.status,
		body,
		contentType: response.headers.get("content-type") || "",
	};
}

async function searchDuckDuckGoHtml(request: ProviderSearchRequest): Promise<ProviderSearchResult> {
	try {
		const cursor = request.cursor as DdgCursor | undefined;
		const headers: Record<string, string> = {
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml",
			"Accept-Language": "en-US,en;q=0.9",
			"Cache-Control": "no-cache",
		};
		const response = cursor?.provider === "ddg-html"
			? await fetchText(DDG_HTML_URL, {
				method: "POST",
				headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams(cursor.form).toString(),
			}, request.signal)
			: await fetchText(`${DDG_HTML_URL}?q=${encodeURIComponent(request.query)}`, { headers }, request.signal);
		if (isDuckDuckGoChallenge(response.body)) {
			return { provider: "ddg-html", results: [], exhausted: true, challenged: true };
		}
		const results = parseDuckDuckGoHtmlResults(response.body, request.maxResults);
		const nextCursor = extractDdgNextCursor(response.body, "ddg-html");
		return { provider: "ddg-html", results, nextCursor, exhausted: !nextCursor || results.length === 0 };
	} catch (error) {
		return { provider: "ddg-html", results: [], exhausted: true, error: error instanceof Error ? error.message : String(error) };
	}
}

async function searchDuckDuckGoLite(request: ProviderSearchRequest): Promise<ProviderSearchResult> {
	try {
		const cursor = request.cursor as DdgCursor | undefined;
		const headers: Record<string, string> = {
			"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml",
			"Accept-Language": "en-US,en;q=0.9",
			"Cache-Control": "no-cache",
		};
		const response = cursor?.provider === "ddg-lite"
			? await fetchText(DDG_LITE_URL, {
				method: "POST",
				headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams(cursor.form).toString(),
			}, request.signal)
			: await fetchText(`${DDG_LITE_URL}?q=${encodeURIComponent(request.query)}`, { headers }, request.signal);
		if (isDuckDuckGoChallenge(response.body)) {
			return { provider: "ddg-lite", results: [], exhausted: true, challenged: true };
		}
		const results = parseDuckDuckGoLiteResults(response.body, request.maxResults);
		const nextCursor = extractDdgNextCursor(response.body, "ddg-lite");
		return { provider: "ddg-lite", results, nextCursor, exhausted: !nextCursor || results.length === 0 };
	} catch (error) {
		return { provider: "ddg-lite", results: [], exhausted: true, error: error instanceof Error ? error.message : String(error) };
	}
}

async function searchYahooHtml(request: ProviderSearchRequest): Promise<ProviderSearchResult> {
	try {
		const cursor = request.cursor as YahooCursor | undefined;
		const url = cursor?.provider === "yahoo-html"
			? cursor.nextUrl
			: `${YAHOO_SEARCH_URL}?p=${encodeURIComponent(request.query)}`;
		const response = await fetchText(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
				"Accept": "text/html,application/xhtml+xml",
				"Accept-Language": "en-US,en;q=0.9",
				"Cache-Control": "no-cache",
			},
		}, request.signal);
		if (isYahooChallenge(response.status, response.body)) {
			return {
				provider: "yahoo-html",
				results: [],
				exhausted: true,
				challenged: true,
				error: response.status >= 400 ? `HTTP ${response.status}` : undefined,
			};
		}
		const results = parseYahooResults(response.body, request.maxResults);
		const nextCursor = extractYahooNextCursor(response.body, cursor?.page ?? 1);
		return { provider: "yahoo-html", results, nextCursor, exhausted: !nextCursor || results.length === 0 };
	} catch (error) {
		return { provider: "yahoo-html", results: [], exhausted: true, error: error instanceof Error ? error.message : String(error) };
	}
}

async function searchJinaDuckDuckGo(request: ProviderSearchRequest): Promise<ProviderSearchResult> {
	try {
		const target = `${DDG_HTML_URL}?q=${encodeURIComponent(request.query)}`;
		const response = await fetchText(JINA_READER_BASE + target, {
			headers: {
				"Accept": "text/plain,text/markdown",
				"X-No-Cache": "true",
				"User-Agent": "Pi-Web/2.0",
			},
		}, request.signal);
		if (response.status >= 400 || /SecurityCompromiseError|Target URL returned error 4\d\d|Too Many Requests/i.test(response.body)) {
			return {
				provider: "jina-ddg",
				results: [],
				exhausted: true,
				challenged: response.status === 451,
				error: response.status >= 400 ? `HTTP ${response.status}` : undefined,
			};
		}
		const results = parseJinaDuckDuckGoResults(response.body, request.maxResults);
		return { provider: "jina-ddg", results, exhausted: true };
	} catch (error) {
		return { provider: "jina-ddg", results: [], exhausted: true, error: error instanceof Error ? error.message : String(error) };
	}
}

export const SEARCH_PROVIDERS: SearchProvider[] = [
	{ id: "ddg-html", label: "DuckDuckGo HTML", search: searchDuckDuckGoHtml },
	{ id: "ddg-lite", label: "DuckDuckGo Lite", search: searchDuckDuckGoLite },
	{ id: "yahoo-html", label: "Yahoo HTML", search: searchYahooHtml },
	{ id: "jina-ddg", label: "Jina Reader DuckDuckGo", search: searchJinaDuckDuckGo },
];

export async function fetchSearchPage(cursor: SearchCursor, request: Omit<ProviderSearchRequest, "cursor">): Promise<ProviderSearchResult> {
	const provider = SEARCH_PROVIDERS.find((item) => item.id === cursor.provider);
	if (!provider) {
		return { provider: String((cursor as { provider?: unknown }).provider || "unknown"), results: [], exhausted: true, error: "Unsupported cursor provider." };
	}
	return provider.search({ ...request, cursor });
}
