# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daily podcast generator that summarizes top 10 Hacker News posts using AI and text-to-speech. Audio is generated via OpenAI TTS or ElevenLabs and published to Transistor.fm podcast host. Optionally generates YouTube-ready video with story screenshots and chapter timestamps.

## Terminology

- Story - A Hacker News post (article, link, or discussion)
- Episode - A podcast episode covering the top stories
- Intro - Short AI-generated introduction for the episode mentioning the top 3 headlines
- Summary - AI-generated summary of a story's content and top comments

## Development Commands

```bash
# Run the podcast generator
pnpm start

# Run tests
pnpm test              # Run all tests once
pnpm test:watch        # Run tests in watch mode
pnpm test:screenshots  # Manual screenshot capture verification

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
pnpm clean:screenshots # Remove cached screenshot images
pnpm clean:output      # Remove output files
pnpm clean:video       # Remove video output files
```

## CLI Arguments

The main script accepts several flags via minimist. **Do not use `--` separator** — pass flags directly to `pnpm start`:

```bash
# Generate podcast with custom story count
pnpm start --count 5

# Preview stories without generating podcast
pnpm start --preview

# Skip audio generation
pnpm start --no-audio

# Publish to podcast host (otherwise only publishes in CI)
pnpm start --publish

# Summarize a specific HN story by ID
pnpm start --storyId 12345

# Parse and summarize arbitrary URL
pnpm start --summarizeLink https://example.com

# Generate audio from arbitrary text
pnpm start --textToAudio "Some text to speak"

# Generate video alongside audio (also runs automatically in CI)
pnpm start --video

# Video generation shorthand
pnpm start:video

# Test intro generation with specific story IDs (requires exactly 3)
pnpm start --testIntro 123,456,789

# Test screenshot capture for a single URL
pnpm start --testScreenshot https://example.com

# Benchmark video pipeline with predefined URLs
pnpm benchmark                    # Uses showcase (default)
pnpm benchmark:stress-test        # Uses challenging URLs
pnpm start --benchmark=data/custom.json  # Custom file
```

### Benchmark Data Files

- **`data/showcase-episode.json`** - Curated URLs with visually appealing screenshots (YouTube, GitHub, major tech blogs)
- **`data/benchmark-stress-test.json`** - Challenging URLs that test edge cases (paywalls, bot detection, varied layouts)

## Architecture

### Data Flow

1. **Fetch** (`src/hn/index.ts`) - Fetches top stories from HN Algolia API, filters previously covered stories, parses content via Readability
2. **Summarize** (`src/ai/index.ts`) - Generates summaries using OpenAI GPT-4o-mini with structured prompts for story content + comments
3. **Adjust Pronunciation** (`src/audio/adjustPronunciation.ts`) - Pattern-based text transformations for TTS mispronunciations
4. **Generate Audio** (`src/audio/index.ts`) - Converts text to speech via OpenAI or ElevenLabs, concatenates segments with ffmpeg
5. **Generate Video** (`src/video/index.ts`) - Optional: Captures screenshots of story URLs, renders video with Remotion, muxes audio with ffmpeg
6. **Publish** (`src/podcast.ts`) - Uploads to Transistor.fm API with show notes

### Key Modules

- **`src/index.ts`** - Entry point, orchestrates the full pipeline
- **`src/hn/`** - HN API integration, content parsing (Readability + JSDOM), PDF text extraction
- **`src/ai/`** - OpenAI integration for summarization, intro generation, episode title generation
- **`src/audio/`** - TTS integration (OpenAI/ElevenLabs), pronunciation adjustments, audio concatenation
- **`src/browser/`** - Shared Puppeteer browser config with stealth/adblocker plugins for content fetching and screenshots
- **`src/video/`** - Video generation with Remotion, Puppeteer screenshots, YouTube chapter timestamps
- **`src/video/domain-handlers/`** - Domain-specific screenshot handlers (YouTube thumbnails, GitHub repo cards, Twitter embeds)
- **`src/show-notes.ts`** - Generates `show-notes.txt` (episode description with links) and `transcript.txt` for output
- **`src/services.ts`** - TTS service factory (OpenAI vs ElevenLabs based on `VOICE_SERVICE` env)
- **`src/podcast.ts`** - Transistor.fm API client for episode upload/publish
- **`src/utils/cache.ts`** - File-based caching for summaries, audio segments, covered stories

### Caching Strategy

All intermediate data is cached to `cache/` directory to avoid redundant API calls:
- Story summaries: `cache/summary-{storyId}`
- Podcast intro: `cache/intro-{hash}`
- Episode title: `cache/title-{hash}`
- Audio segments: `cache/intro-{hash}.mp3`, `cache/story-{storyId}.mp3`
- Screenshots: `cache/screenshot-{storyId}.png` (for video generation)
- Covered stories: `cache/covered-stories` (JSON array, also cached in GitHub Actions)

In CI, `cache/covered-stories` is restored/saved via GitHub Actions cache to prevent duplicate episodes.

### Path Aliases

TypeScript path alias `@/*` maps to `src/*` (configured in tsconfig.json, resolved via vite-tsconfig-paths in tests).

### Testing

Uses Vitest with path alias support. Test files use `.spec.ts` extension.

```bash
pnpm test src/audio/adjustPronunciation.spec.ts  # Run single test file
pnpm test:content                                 # Run integration tests (60s timeout)
```

Integration tests (`*.integration.spec.ts`) run separately via `vitest.integration.config.ts` with longer timeouts for network requests.

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

### Manual Workflow Dispatch

The workflow can be triggered manually with these options:
- **debug** - Enable debug mode
- **voice_service** - Choose `openai` or `elevenlabs` (default: openai for manual, elevenlabs on main)
- **skip_publish** - Skip publishing to podcast host (default: true for manual runs)
- **video** - Generate YouTube video (default: false for manual runs)

## Video Generation

Video output (`--video` flag) generates an MP4 alongside the podcast audio:

- **Screenshots**: Puppeteer captures each story URL at 1920x1080
- **Composition**: Remotion renders video with title banner + screenshot per chapter
- **Audio**: ffmpeg muxes the podcast audio into the final video
- **Output**: `output/output.mp4` and `output/youtube-chapters.txt`

### Setup

Puppeteer Chrome browser is installed automatically via `postinstall` script when running `pnpm install`.

### Video Architecture

```
src/video/
├── index.ts           # Entry point - generateVideo(), generateYouTubeChapters()
├── composition.tsx    # Main Remotion composition
├── remotion-entry.tsx # Remotion registerRoot entry
├── screenshots.ts     # Puppeteer screenshot capture with caching
├── fallback.ts        # Fallback image generation for failed screenshots
├── types.ts           # VideoChapter, VideoProps, ChapterInput types
├── domain-handlers/   # Domain-specific screenshot customization
│   ├── youtube.ts     # Fetches video thumbnail instead of screenshot
│   ├── github.ts      # Uses OpenGraph image for repo cards
│   └── twitter.ts     # Renders tweet embed widget
└── components/
    ├── Chapter.tsx    # Story chapter view (title banner + screenshot)
    └── Branding.tsx   # Intro/outro branding screen
```

### Screenshot Capture

Uses puppeteer-extra with plugins for reliable screenshots:
- **Stealth plugin**: Bypasses Cloudflare and basic bot detection
- **Adblocker plugin**: Removes ads and trackers
- **CSS injection**: Hides consent popups (OneTrust, CookieYes, Usercentrics, etc.)
- **JS evaluation**: Collapses empty ad placeholders, hides shadow DOM elements

Bot protection detection triggers fallback image generation when:
- Page body text < 200 characters
- Challenge keywords detected (e.g., "verifying", "access denied", "ray id")

Test URLs and fixes documented in `scripts/test-screenshots.json`. Run `pnpm test:screenshots` to verify.

### Remotion Notes

- Remotion uses Webpack (not Node ESM) - files in `src/video/` use `@ts-nocheck` and imports without `.js` extensions
- Screenshots served via `publicDir` pointing to cache directory, loaded with `staticFile()`
