import type { SessionEntryLike, StoredFetch, StoredResult, StoredSearch } from "./types.js";

const STORE_ENTRY_TYPE = "pi-web-result";

function cloneRecord<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function isStoredSearch(value: unknown): value is StoredSearch {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return v.type === "search" && typeof v.id === "string" && Array.isArray(v.queries);
}

function isStoredFetch(value: unknown): value is StoredFetch {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return v.type === "fetch" && typeof v.id === "string" && Array.isArray(v.urls);
}

function isStoredResult(value: unknown): value is StoredResult {
	return isStoredSearch(value) || isStoredFetch(value);
}

export class WebResultStore {
	private readonly records = new Map<string, StoredResult>();

	constructor(private readonly appendEntry?: (customType: string, data: unknown) => void) {}

	rehydrate(entries: Iterable<SessionEntryLike>): void {
		this.records.clear();
		for (const entry of entries) {
			if (entry?.type !== "custom" || entry.customType !== STORE_ENTRY_TYPE) continue;
			if (!isStoredResult(entry.data)) continue;
			this.records.set(entry.data.id, cloneRecord(entry.data));
		}
	}

	get(id: string): StoredResult | undefined {
		const record = this.records.get(id);
		return record ? cloneRecord(record) : undefined;
	}

	save(record: StoredResult): StoredResult {
		const cloned = cloneRecord(record);
		this.records.set(cloned.id, cloned);
		this.appendEntry?.(STORE_ENTRY_TYPE, cloned);
		return cloneRecord(cloned);
	}

	update(id: string, updater: (record: StoredResult) => StoredResult): StoredResult | undefined {
		const current = this.records.get(id);
		if (!current) return undefined;
		return this.save(updater(cloneRecord(current)));
	}
}
