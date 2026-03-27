# pi-web — Pi Extension

Enhanced web search and content fetching for pi, combining the strongest patterns from [opencode](https://github.com/anomalyco/opencode) and [Claude Code](https://github.com/anthropics/claude-code).

## What Changed from pi-web-access

This extension is a fork of `pi-web-access@0.10.3` with the following enhancements:

### 1. Exa AI Search Provider (`exa-search.ts`)
- **Primary search provider:** Exa AI MCP-based web search via `https://mcp.exa.ai/mcp`
- **JSON-RPC 2.0:** Uses opencode's MCP pattern (`tools/call`, `web_search_exa`)
- **SSE parsing:** Handles Server-Sent Events responses from the MCP endpoint
- **Live crawling:** Supports `fallback` and `preferred` crawl modes
- **Search types:** `auto`, `fast`, `deep` search modes
- **Auth:** `EXA_API_KEY` env var or `exaApiKey` in `~/.pi/web-search.json`

### 2. Claude Code–style Anthropic Fallback (`anthropic-web.ts`)
- **Fallback search provider:** Anthropic public `web_search` server tool via the Messages API
- **Fallback fetch provider:** Anthropic public `web_fetch` server tool for URL extraction fallback
- **Claude Code pattern:** uses Anthropic server-side web tools rather than client-side scraping when fallback is needed
- **Pause-turn handling:** continues Anthropic server-tool loops when `stop_reason === "pause_turn"`
- **Auth:** `ANTHROPIC_API_KEY` env var or `anthropicApiKey` in `~/.pi/web-search.json`

### 3. Code Search Tool (`code-search.ts`)
- **New tool:** `code_search` — Search for code examples, API docs, library references
- **Exa AI MCP:** Uses `get_code_context_exa` for code-focused results
- **Token control:** 1,000–50,000 tokens (default: 5,000)
- **Timeout:** 30-second timeout with abort signal support

### 4. Claude Code / opencode Fetch Improvements (`extract.ts`)
- **Claude-User User-Agent:** identifies honestly for robots.txt compliance
- **UA fallback chain:** Claude-User → simplified retry → browser UA
- **Cloudflare retry:** if `cf-mitigated: challenge` is returned, retry automatically
- **Format-aware headers:** Accept header prefers `text/markdown` and `text/plain`
- **Binary save-to-disk:** PDFs, Office docs, and audio can be saved with correct extensions
- **Anthropic web_fetch fallback:** server-side URL fetch fallback for pages that block normal extraction

## Tools Provided

| Tool | Description |
|------|-------------|
| `web_search` | Search the web using Exa first, then Anthropic web search as fallback |
| `fetch_content` | Fetch URLs with intelligent content extraction and Anthropic fallback |
| `get_search_content` | Retrieve full content from previous searches |
| `code_search` | Search code examples and API docs via Exa AI |

## Configuration

### `~/.pi/web-search.json`

```json
{
  "exaApiKey": "your-exa-api-key",
  "anthropicApiKey": "your-anthropic-api-key",
  "provider": "auto",
  "anthropicSearchModel": "claude-haiku-4-5",
  "anthropicFetchModel": "claude-haiku-4-5"
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXA_API_KEY` | Exa AI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude-style web search/fetch |
| `HTTPS_PROXY` / `HTTP_PROXY` | Proxy settings for fetch operations |

### Search Provider Priority (`web_search`)

1. **Exa AI** — primary provider if `EXA_API_KEY` / `exaApiKey` is configured
2. **Anthropic web search** — fallback provider if `ANTHROPIC_API_KEY` / `anthropicApiKey` is configured

### Notes

- `web_search` uses Exa AI first, then Anthropic web search as fallback.
- `fetch_content` falls back to Anthropic `web_fetch` + Jina Reader for pages that block normal extraction or return bot-challenge responses.
- Video extraction (YouTube and local video files) uses Anthropic-based tools when available.
- Anthropic web search requires org-level enablement in Anthropic Console privacy settings.

## Installation

This extension replaces `npm:pi-web-access`. The original package was removed from `~/.pi/agent/settings.json` and this extension lives at `~/.pi/agent/extensions/pi-web/`.

To revert: remove this directory and add `"npm:pi-web-access"` back to `settings.json`.

## Credits

- Original: [pi-web-access](https://www.npmjs.com/package/pi-web-access)
- Primary search/provider patterns: [opencode](https://github.com/anomalyco/opencode)
- Server-side web tool behavior and fallback inspiration: [Claude Code](https://github.com/anthropics/claude-code)
