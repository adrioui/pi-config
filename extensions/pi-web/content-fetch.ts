import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { extractHeadingTitle } from "./format.js";
import { extractRSCContent } from "./rsc-extract.js";
import type { FetchedPage } from "./types.js";

const DEFAULT_USER_AGENT = "Pi-Web/2.0";
const JINA_READER_BASE = "https://r.jina.ai/";

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
});

function isLocalOrPrivateUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		const host = url.hostname.toLowerCase();
		if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
		if (host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
		if (/^10\./.test(host)) return true;
		if (/^192\.168\./.test(host)) return true;
		if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
		if (/^169\.254\./.test(host)) return true;
		return false;
	} catch {
		return false;
	}
}

export function invalidPublicUrlReason(rawUrl: string): string | null {
	if (rawUrl.startsWith("view-source:")) return "Refusing browser-specific view-source URL.";

	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return "Invalid URL";
	}

	if (!["http:", "https:"].includes(url.protocol)) return "Refusing non-http(s) URL.";
	if (isLocalOrPrivateUrl(rawUrl)) {
		return "Refusing local or non-Internet URL. Use bash/curl for localhost or private network URLs.";
	}
	if (url.hostname === "github.com" && /^\/[^/]+\/[^/]+\/pull\/new(\/|$)/.test(url.pathname)) {
		return "Refusing GitHub pull/new creation URL. Provide a viewable PR or issue URL instead.";
	}

	const sensitiveParams = new Set([
		"token", "auth", "signature", "sig", "x-amz-signature", "x-goog-signature",
		"x-amz-security-token", "x-goog-credential", "x-goog-algorithm", "awsaccesskeyid",
	]);
	for (const key of url.searchParams.keys()) {
		if (sensitiveParams.has(key.toLowerCase())) {
			return "Refusing URL with temporary or sensitive access parameters.";
		}
	}

	return null;
}

async function fetchViaJina(url: string, signal?: AbortSignal): Promise<FetchedPage | null> {
	const response = await fetch(JINA_READER_BASE + url, {
		headers: {
			"Accept": "text/markdown,text/plain",
			"X-No-Cache": "true",
			"User-Agent": DEFAULT_USER_AGENT,
		},
		signal,
	});
	if (!response.ok) return null;
	let content = await response.text();
	if (/SecurityCompromiseError|Target URL returned error 4\d\d|Too Many Requests/i.test(content)) return null;
	const marker = content.indexOf("Markdown Content:");
	if (marker >= 0) content = content.slice(marker + "Markdown Content:".length).trim();
	if (!content.trim()) return null;
	return {
		url,
		title: extractHeadingTitle(content) ?? url,
		content: content.trim(),
		error: null,
		extractor: "jina-reader",
		fetchedAt: Date.now(),
	};
}

function extractHtmlToMarkdown(url: string, html: string): { title: string; content: string; extractor: string } {
	const { document } = parseHTML(html);
	const readability = new Readability(document).parse();
	const readableTitle = readability?.title?.trim();
	const title = readableTitle || document.querySelector("title")?.textContent?.trim() || url;
	const readableHtml = readability?.content || document.body?.innerHTML || html;
	let markdown = turndown.turndown(readableHtml).trim();
	let extractor = readability?.content ? "readability" : "turndown-body";

	if (markdown.length < 200) {
		const rsc = extractRSCContent(html);
		if (rsc?.content && rsc.content.length > markdown.length) {
			markdown = rsc.content.trim();
			extractor = "rsc";
		}
	}

	if (!markdown.trim()) {
		markdown = turndown.turndown(document.body?.innerHTML || html).trim();
		extractor = "turndown-body";
	}

	return { title, content: markdown.trim(), extractor };
}

export async function fetchPage(url: string, forceRefetch: boolean, signal?: AbortSignal): Promise<FetchedPage> {
	const invalidReason = invalidPublicUrlReason(url);
	if (invalidReason) {
		return { url, title: "", content: "", error: invalidReason, fetchedAt: Date.now() };
	}

	const headers: Record<string, string> = {
		"User-Agent": DEFAULT_USER_AGENT,
		"Accept": "text/html,application/xhtml+xml,text/markdown,text/plain,application/json;q=0.9,*/*;q=0.5",
		"Accept-Language": "en-US,en;q=0.9",
		"Cache-Control": forceRefetch ? "no-cache, no-store" : "no-cache",
		"Pragma": "no-cache",
	};

	try {
		const response = await fetch(url, { headers, signal, redirect: "follow" });
		const contentType = response.headers.get("content-type") || "";
		if (!response.ok) {
			const jina = await fetchViaJina(url, signal).catch(() => null);
			return jina ?? {
				url,
				title: "",
				content: "",
				error: `HTTP ${response.status}: ${response.statusText}`,
				status: response.status,
				contentType,
				fetchedAt: Date.now(),
			};
		}

		if (contentType.includes("application/pdf")) {
			const jina = await fetchViaJina(url, signal).catch(() => null);
			return jina ?? {
				url,
				title: url,
				content: "",
				error: "PDF extraction failed and no readable fallback was available.",
				status: response.status,
				contentType,
				fetchedAt: Date.now(),
			};
		}

		const text = await response.text();
		if (contentType.includes("text/plain") || contentType.includes("markdown") || contentType.includes("application/json")) {
			return {
				url,
				title: extractHeadingTitle(text) ?? url,
				content: text.trim(),
				error: null,
				status: response.status,
				contentType,
				extractor: contentType.includes("application/json") ? "json-text" : "text-pass-through",
				fetchedAt: Date.now(),
			};
		}

		const extracted = extractHtmlToMarkdown(url, text);
		if (extracted.content.length >= 120) {
			return {
				url,
				title: extracted.title,
				content: extracted.content,
				error: null,
				status: response.status,
				contentType,
				extractor: extracted.extractor,
				fetchedAt: Date.now(),
			};
		}

		const jina = await fetchViaJina(url, signal).catch(() => null);
		return jina ?? {
			url,
			title: extracted.title,
			content: extracted.content,
			error: null,
			status: response.status,
			contentType,
			extractor: extracted.extractor,
			fetchedAt: Date.now(),
		};
	} catch (error) {
		const jina = await fetchViaJina(url, signal).catch(() => null);
		if (jina) return jina;
		return {
			url,
			title: "",
			content: "",
			error: error instanceof Error ? error.message : String(error),
			fetchedAt: Date.now(),
		};
	}
}

export async function fetchPages(urls: string[], forceRefetch: boolean, signal?: AbortSignal): Promise<FetchedPage[]> {
	return Promise.all(urls.map((url) => fetchPage(url, forceRefetch, signal)));
}
