# Promptie - Video Library RAG

## Project Overview
Interactive prompt testing tool built on [Ragie](https://ragie.ai/) knowledge retrieval + Anthropic Claude.
Users upload video content to Ragie, then query it via natural language. The system retrieves relevant video chunks and generates AI responses with citations that link back to the source video segments.

- **Repo**: `quack2025/promptie-video-library`
- **Deployed**: Vercel at `promptie-lovat.vercel.app`
- **Original upstream**: `ragieai/promptie`

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS
- Ragie SDK (`ragie` npm package) for document retrieval
- Anthropic SDK (`@anthropic-ai/sdk`) with citations for LLM responses
- OpenRouter (`@openrouter/ai-sdk-provider`) as alternative LLM provider
- Vercel for deployment

## Architecture

### API Routes
- `/api/completions` — Main endpoint. Retrieves chunks from Ragie, sends to Anthropic/OpenRouter, returns response + citations
- `/api/search` — Direct Ragie retrieval (chunks only, no LLM)
- `/api/stream` — Proxy for Ragie media URLs (video/audio). Required because Ragie API needs auth headers
- `/api/documents/[id]` — Fetch document summary from Ragie
- `/api/chunk-summary` — Summarize a single chunk

### Citation + Video Flow
1. User submits query → `/api/completions`
2. Ragie retrieves `scoredChunks` with `links.self_video_stream` URLs
3. Anthropic processes chunks using `type: "document"` content with `citations: { enabled: true }`
4. Frontend renders citations as clickable links → `CitationDialog` opens with embedded `<video>` player
5. Video is streamed through `/api/stream` proxy (adds Ragie auth headers)

### Key Files
- `app/api/completions/route.ts` — Core RAG + LLM logic
- `app/page.tsx` — Main UI (query input, tabs for Message/Chunks)
- `app/generated-text.tsx` — Renders LLM response with citation links
- `app/citation-dialog.tsx` — Modal with video/audio player + document summary
- `lib/utils.ts` — `getStreamType()`, `getProxyPath()`, `formatSeconds()`
- `lib/prompts.ts` — `DEFAULT_SYSTEM_PROMPT` and `DEFAULT_OPENROUTER_MODEL`
- `lib/server/settings.ts` — Environment variable exports
- `lib/server/utils.ts` — `getRagieClient()` factory

## Environment Variables (Vercel dashboard)
- `RAGIE_API_KEY` — Ragie tenant key (`tnt_...`)
- `ANTHROPIC_API_KEY` — Anthropic API key
- `OPENROUTER_API_KEY` — OpenRouter API key
- `NEXT_PUBLIC_OPENROUTER_API_KEY` — Same as above, exposed to frontend for UI toggle

The `.env` file is NOT committed to git. All env vars must be configured in Vercel dashboard and redeployed.

## Important: Anthropic Model Names
Anthropic deprecates model aliases without notice. As of Feb 2026:
- `claude-3-7-sonnet-latest` — **REMOVED** (was the original model used)
- `claude-sonnet-4-5-20250929` — Current working model with citations support
- `claude-sonnet-4-6` — Latest Sonnet (also supports citations)
- `claude-3-haiku-20240307` — Does NOT support `document` content type or citations

Use the `/v1/models` API endpoint to list available models for your key:
```bash
curl -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" https://api.anthropic.com/v1/models
```

## Customizations vs Upstream
Changes from the original `ragieai/promptie`:
- `rerank` forced to `false` server-side (Ragie returns empty chunks with rerank enabled for this content)
- `systemPrompt` forced to server's `DEFAULT_SYSTEM_PROMPT` (ignores client value)
- CORS headers added to `/api/completions` and `/api/stream`
- Video proxy with Range header support for mobile seeking
- Spanish localization in video player fallback text

## Development
```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # Production build
```

## Gotchas
- After changing env vars in Vercel dashboard, you MUST trigger a Redeploy for changes to take effect
- The `rerank: true` parameter causes Ragie to return empty `scoredChunks` for video content — always use `false`
- Citations require Anthropic models that support `type: "document"` content blocks (Sonnet 4+ or Haiku 4.5+)
- OpenRouter path does NOT support citations — videos won't show when using OpenRouter provider
