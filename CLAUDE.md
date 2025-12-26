# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daily podcast generator that summarizes top 10 Hacker News posts using AI and text-to-speech. Audio is generated via OpenAI TTS or ElevenLabs and published to Transistor.fm podcast host.

## Development Commands

```bash
# Run the podcast generator
pnpm start

# Run tests
pnpm test              # Run all tests once
pnpm test:watch        # Run tests in watch mode

# Type checking and linting
pnpm build             # TypeScript type check (no output)
pnpm lint              # ESLint check
pnpm lint:fix          # ESLint with auto-fix
pnpm format            # Format with Prettier

# Cache management (cache/ directory stores intermediate data)
pnpm clean:all         # Remove all cached data and output
pnpm clean:cache       # Remove all cache files
pnpm clean:stories     # Remove cached story data
pnpm clean:summaries   # Remove cached summaries and intros
pnpm clean:audio       # Remove cached MP3 files
pnpm clean:output      # Remove output files
```

## CLI Arguments

The main script accepts several flags via minimist:

```bash
# Generate podcast with custom story count
pnpm start -- --count 5

# Preview stories without generating podcast
pnpm start -- --preview

# Skip audio generation
pnpm start -- --no-audio

# Publish to podcast host (otherwise only publishes in CI)
pnpm start -- --publish

# Summarize a specific HN story by ID
pnpm start -- --storyId 12345

# Parse and summarize arbitrary URL
pnpm start -- --summarizeLink https://example.com

# Generate audio from arbitrary text
pnpm start -- --textToAudio "Some text to speak"
```

## Architecture

### Data Flow

1. **Fetch** (`src/hn/index.ts`) - Fetches top stories from HN Algolia API, filters previously covered stories, parses content via Readability
2. **Summarize** (`src/ai/index.ts`) - Generates summaries using OpenAI GPT-4o-mini with structured prompts for story content + comments
3. **Adjust Pronunciation** (`src/audio/adjustPronunciation.ts`) - Pattern-based text transformations for TTS mispronunciations
4. **Generate Audio** (`src/audio/index.ts`) - Converts text to speech via OpenAI or ElevenLabs, concatenates segments with ffmpeg
5. **Publish** (`src/podcast.ts`) - Uploads to Transistor.fm API with show notes

### Key Modules

- **`src/index.ts`** - Entry point, orchestrates the full pipeline
- **`src/hn/`** - HN API integration, content parsing (Readability + JSDOM), PDF text extraction
- **`src/ai/`** - OpenAI integration for summarization, intro generation, episode title generation
- **`src/audio/`** - TTS integration (OpenAI/ElevenLabs), pronunciation adjustments, audio concatenation
- **`src/services.ts`** - TTS service factory (OpenAI vs ElevenLabs based on `VOICE_SERVICE` env)
- **`src/podcast.ts`** - Transistor.fm API client for episode upload/publish
- **`src/utils/cache.ts`** - File-based caching for summaries, audio segments, covered stories

### Caching Strategy

All intermediate data is cached to `cache/` directory to avoid redundant API calls:
- Story summaries: `cache/summary-{storyId}`
- Podcast intro: `cache/intro-{hash}`
- Episode title: `cache/title-{hash}`
- Audio segments: `cache/intro-{hash}.mp3`, `cache/story-{storyId}.mp3`
- Covered stories: `cache/covered-stories` (JSON array, also cached in GitHub Actions)

In CI, `cache/covered-stories` is restored/saved via GitHub Actions cache to prevent duplicate episodes.

### Path Aliases

TypeScript path alias `@/*` maps to `src/*` (configured in tsconfig.json, resolved via vite-tsconfig-paths in tests).

### Testing

Uses Vitest with path alias support. Test files use `.spec.ts` extension. Run single test file:

```bash
pnpm test src/audio/adjustPronunciation.spec.ts
```

## Environment Variables

Required:
- `OPENAI_API_KEY` - Required for AI summarization (always) and TTS (when using OpenAI)

Optional:
- `ELEVEN_LABS_API_KEY` - Required if `VOICE_SERVICE=elevenlabs`
- `TRANSISTOR_API_KEY` - Required to publish episodes (only in CI or with `--publish` flag)
- `VOICE_SERVICE` - `elevenlabs` or `openai` (defaults to openai)

See `.env.example` for template.

## Pronunciation Adjustments

TTS mispronunciations are fixed via pattern matching in `src/audio/adjustPronunciation.ts`. When adding new adjustments:

1. Add case-insensitive regex replacement to `adjustPronunciation()` function
2. Add test case to `src/audio/adjustPronunciation.spec.ts`
3. Common patterns include: acronyms, version numbers, domains, tech terms, currency/measurements

Pattern categories handled:
- Tech terms (SQL, GUI, regex, WASM, etc.)
- Version numbers (convert `.` to `-point-`)
- Domains ending in comma (replace `.` with `-dot-`)
- Acronyms before punctuation (U.S.'s → U-S's)
- Currency/measurements (converted to words in AI prompt, not adjustPronunciation)

## CI/CD

GitHub Actions workflow runs daily at 6:30am EST via cron schedule (`generate-podcast.yml`). Workflow:
1. Restores `cache/covered-stories` from GitHub Actions cache
2. Runs `pnpm start` with env vars from secrets
3. Publishes episode automatically (CI env var triggers publish)
4. Updates covered-stories cache for next run
5. Uploads artifacts (output + cache) for debugging
