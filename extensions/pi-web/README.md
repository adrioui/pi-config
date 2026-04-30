# pi-web

Pi-native objective-first web tools for Pi.

## Tools

- `web_search`
  - input: `objective`, optional `search_queries`, optional `max_results`, optional `recencyFilter`, optional `domainFilter`
  - behavior: searches public web sources, stores the response, and returns compact source summaries
- `fetch_content`
  - input: `url` or `urls`, optional `objective`, optional `forceRefetch`
  - behavior: fetches a public page, converts it to readable markdown, and stores the full content for follow-up retrieval
- `get_search_content`
  - input: `responseId` plus optional `query`/`queryIndex`/`page` for search or `url`/`urlIndex`/`contentOffset` for fetched content
  - behavior: retrieves stored search/fetch content, including later search pages and sliced follow-up content
- `code_search`
  - compatibility wrapper for code/documentation-oriented searches

## Search architecture

Primary search path:
- DuckDuckGo HTML
- DuckDuckGo Lite
- Yahoo HTML
- Jina Reader DuckDuckGo as a last-resort recovery path

Key behaviors:
- challenge pages are treated as provider failures, not sources
- obvious redirect/ad URLs are filtered out
- parsed results are post-filtered against `domainFilter`
- later result pages are fetched through `get_search_content(..., page: N)` when the provider exposes pagination
- Yahoo next-page links are normalized to remove ephemeral path tokens so page 2 remains retrievable after reopening the same session file
- Jina Reader search fallback is intentionally page-1-only; it is used to recover results when the direct HTML providers are challenged or empty
- results are stored in Pi session custom entries so they can be reopened in later turns and fresh Pi processes when the same session file is used

## Fetch architecture

Primary fetch path:
- direct HTTP fetch
- `@mozilla/readability` + `turndown` for HTML
- `rsc-extract.ts` as a fallback for poor Next.js/RSC readability output
- Jina Reader only as a readable fallback when direct extraction is poor or blocked

Safety rules:
- rejects localhost, private-network, `.local`, `.internal`, `view-source:`, non-http(s), and sensitive signed URLs
- use `bash`/`curl` for localhost or private-network targets instead

## Follow-up retrieval

Search follow-up examples:
- `get_search_content({ responseId: "..." })`
- `get_search_content({ responseId: "...", queryIndex: 0, page: 2 })`
- `get_search_content({ responseId: "...", query: "python uv package manager docs", page: 3 })`

Fetched-content follow-up examples:
- `get_search_content({ responseId: "..." })`
- `get_search_content({ responseId: "...", contentOffset: 800, contentLimit: 400 })`

## Notes

- Search pagination is provider-dependent. When a provider exposes a next-page cursor, `get_search_content` can fetch later pages on demand.
- Stored response IDs are Pi-session scoped. Reopen the same session file if you want to retrieve them in a later Pi process.
