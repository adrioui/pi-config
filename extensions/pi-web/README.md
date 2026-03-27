# opencode-web — Pi Extension

Enhanced web search and content fetching for pi, incorporating patterns from [opencode](https://github.com/anomalyco/opencode).

## What Changed from pi-web-access

This extension is a fork of `pi-web-access@0.10.3` with the following enhancements reverse-engineered from opencode:

### 1. Exa AI Search Provider (`exa-search.ts`)
- **New provider:** Exa AI MCP-based web search via `https://mcp.exa.ai/mcp`
- **JSON-RPC 2.0:** Uses opencode's exact MCP protocol (`tools/call` method, `web_search_exa` tool)
- **SSE parsing:** Handles Server-Sent Events responses from the MCP endpoint
- **Live crawling:** Supports `fallback` and `preferred` crawl modes
- **Search types:** `auto`, `fast`, `deep` search modes
- **Priority:** Exa is tried first in auto-detection before Perplexity and Gemini
- **Auth:** Optional `EXA_API_KEY` env var or `exaApiKey` in `~/.pi/web-search.json`

### 2. Code Search Tool (`code-search.ts`)
- **New tool:** `code_search` — Search for code examples, API docs, library references
- **Exa AI MCP:** Uses `get_code_context_exa` tool for code-focused results
- **Token control:** 1,000–50,000 tokens (default: 5,000)
- **Timeout:** 30-second timeout with abort signal support

### 3. Cloudflare Bot Detection Retry (`extract.ts`)
- **Auto-retry:** When fetching content, if Cloudflare returns 403 with `cf-mitigated: challenge`, automatically retries with simplified User-Agent
- **Format-aware headers:** Accept header now includes `text/markdown` and `text/plain` quality preferences

### 4. Provider Selection Enhancement (`gemini-search.ts`)
- **New provider option:** `"exa"` added to the `SearchProvider` type
- **Auto-detection priority:** Exa → Perplexity → Gemini API → Gemini Web
- **Parameter:** `provider: "exa"` now available in `web_search` tool

## Tools Provided

| Tool | Description |
|------|-------------|
| `web_search` | Search the web (Exa AI, Perplexity, or Gemini) |
| `fetch_content` | Fetch URLs with intelligent content extraction |
| `get_search_content` | Retrieve full content from previous searches |
| `code_search` | Search code examples and API docs via Exa AI |

## Configuration

### ~/.pi/web-search.json

```json
{
  "exaApiKey": "your-exa-api-key",
  "perplexityApiKey": "pplx-...",
  "geminiApiKey": "AIza...",
  "provider": "auto"
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXA_API_KEY` | Exa AI API key (highest priority) |
| `PERPLEXITY_API_KEY` | Perplexity API key |
| `GEMINI_API_KEY` | Google Gemini API key |

### Provider Priority (auto mode)

1. **Exa AI** — if `EXA_API_KEY` or `exaApiKey` configured
2. **Perplexity** — if `PERPLEXITY_API_KEY` or `perplexityApiKey` configured
3. **Gemini API** — if `GEMINI_API_KEY` or `geminiApiKey` configured
4. **Gemini Web** — if signed into gemini.google.com in Chrome

## Installation

This extension replaces `npm:pi-web-access`. The original package was removed from `~/.pi/agent/settings.json` and this extension lives at `~/.pi/agent/extensions/opencode-web/`.

To revert: remove this directory and add `"npm:pi-web-access"` back to settings.json packages array.

## Credits

- Original: [pi-web-access](https://www.npmjs.com/package/pi-web-access) by [@mariozechner](https://github.com/badlogic)
- Enhancements: Reverse-engineered from [opencode](https://github.com/anomalyco/opencode) by [@anomalyco](https://github.com/anomalyco)
