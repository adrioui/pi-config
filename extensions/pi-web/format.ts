import type { SearchResult } from "./types.js";

export const MAX_INLINE_CONTENT = 262_144;

const OBJECTIVE_STOP_WORDS = new Set([
	"a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "if",
	"in", "into", "is", "it", "of", "on", "or", "recent", "should", "that", "the",
	"their", "this", "to", "up", "use", "using", "want", "what", "when", "where",
	"which", "with", "you", "your",
]);

export function clampNumber(value: number | undefined, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || Number.isNaN(value)) return fallback;
	return Math.max(min, Math.min(max, Math.floor(value)));
}

export function uniqueNonEmpty(values: Array<string | undefined> | undefined): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const value of values ?? []) {
		if (typeof value !== "string") continue;
		const trimmed = value.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(trimmed);
	}
	return out;
}

export function currentYear(): string {
	return String(new Date().getFullYear());
}

export function isTimeSensitiveObjective(text: string): boolean {
	return /\b(latest|recent|current|today|this year|last month|last week|shipped|release|released|new feature|new features)\b/i.test(text);
}

export function buildSearchQuery(objective: string, searchQuery?: string): string {
	const preferred = typeof searchQuery === "string" && searchQuery.trim()
		? searchQuery.trim()
		: objective;
	if (isTimeSensitiveObjective(preferred) && !new RegExp(`\\b${currentYear()}\\b`).test(preferred)) {
		return `${preferred} ${currentYear()}`;
	}
	return preferred;
}

export function formatSources(results: SearchResult[]): string {
	if (results.length === 0) return "No sources found.";
	return results.map((result, index) => {
		const snippet = result.snippet ? `\n   ${result.snippet}` : "";
		return `${index + 1}. ${result.title}\n   ${result.url}${snippet}`;
	}).join("\n\n");
}

export function formatSearchSummary(answer: string, results: SearchResult[]): string {
	const parts: string[] = [];
	if (answer) parts.push(answer);
	parts.push(`**Sources:**\n${formatSources(results)}`);
	return parts.join("\n\n---\n\n");
}

export function objectiveTerms(objective: string): string[] {
	const terms: string[] = [];
	const seen = new Set<string>();
	for (const part of objective.toLowerCase().split(/[^a-z0-9]+/)) {
		if (part.length < 3 || OBJECTIVE_STOP_WORDS.has(part) || seen.has(part)) continue;
		seen.add(part);
		terms.push(part);
	}
	return terms.slice(0, 12);
}

export function excerptForObjective(content: string, objective: string): string {
	const trimmed = content.trim();
	if (!objective || !trimmed) return trimmed;
	const terms = objectiveTerms(objective);
	if (terms.length === 0) return trimmed.slice(0, MAX_INLINE_CONTENT);

	const sections = trimmed
		.split(/\n{2,}/)
		.map((section) => section.trim())
		.filter(Boolean);

	const scored = sections
		.map((section, index) => {
			const lower = section.toLowerCase();
			let score = 0;
			for (const term of terms) {
				if (lower.includes(term)) score++;
			}
			return { section, index, score };
		})
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index);

	if (scored.length === 0) return trimmed.slice(0, MAX_INLINE_CONTENT);

	return scored
		.slice(0, 6)
		.sort((a, b) => a.index - b.index)
		.map((item) => item.section)
		.join("\n\n")
		.slice(0, MAX_INLINE_CONTENT);
}

export function sectionizeForObjective(content: string, objective: string): string {
	const excerpt = excerptForObjective(content, objective);
	const sections: Array<{ title: string; content: string }> = [];
	let currentTitle = "Excerpt";
	let currentLines: string[] = [];

	for (const line of excerpt.split("\n")) {
		const heading = line.match(/^#{1,6}\s+(.+)$/);
		if (heading) {
			if (currentLines.length > 0) {
				sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
			}
			currentTitle = heading[1].trim();
			currentLines = [];
			continue;
		}
		currentLines.push(line);
	}

	if (currentLines.length > 0) {
		sections.push({ title: currentTitle, content: currentLines.join("\n").trim() });
	}

	const formatted = sections
		.filter((section) => section.content)
		.map((section) => `Section Title: ${section.title}\nContent:\n${section.content}`)
		.join("\n\n");

	return (formatted || excerpt).slice(0, MAX_INLINE_CONTENT);
}

export function extractHeadingTitle(markdown: string): string | null {
	const match = markdown.match(/^#\s+(.+)$/m);
	return match?.[1]?.trim() || null;
}

export function numericIndex(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isInteger(value)) return value;
	if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
	return undefined;
}

export function sliceWithNotice(content: string, offset = 0, limit = MAX_INLINE_CONTENT): { text: string; truncated: boolean; nextOffset: number | null } {
	const safeOffset = Math.max(0, offset);
	const safeLimit = clampNumber(limit, MAX_INLINE_CONTENT, 1, MAX_INLINE_CONTENT);
	const sliced = content.slice(safeOffset, safeOffset + safeLimit);
	const nextOffset = safeOffset + safeLimit < content.length ? safeOffset + safeLimit : null;
	const truncated = nextOffset !== null || safeOffset > 0;
	let text = sliced;
	if (safeOffset > 0) text = `[Showing content from offset ${safeOffset}]\n\n${text}`;
	if (nextOffset !== null) text += `\n\n[Content truncated. Use contentOffset=${nextOffset} to continue.]`;
	return { text, truncated, nextOffset };
}
