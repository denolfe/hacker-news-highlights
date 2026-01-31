# Content Extraction Audit - Last 30 Stories

Audit date: 2026-01-30
Purpose: Evaluate Readability extraction success rate

## Summary

**30 stories analyzed**
- **6 failed** (20%) - No useful content extracted
- **24 succeeded** (80%) - Content extracted

### Failed Extractions

| Story ID | URL | Size | Issue |
|----------|-----|------|-------|
| 46778341 | https://tonystr.net/blog/git_immitation | 427 bytes | SPA (Vue.js) - returns empty shell |
| 46781530 | https://www.nytimes.com/2026/01/26/science/archaeology-neanderthals-tools.html | 771 bytes | Bot protection (DataDome captcha) |
| 46769051 | https://bsky.app/profile/did:plc:okydh7e54e2nok65kjxdklvd/post/3mdd55paffk2o | 9895 bytes | SPA - no content in HTML |
| 46771564 | https://twitter.com/karpathy/status/2015883857489522876 | 233892 bytes | SPA - Twitter loads via JS |
| 46767668 | https://twitter.com/lellouchenico/status/2015775970330882319 | 233856 bytes | SPA - Twitter loads via JS |
| 46783863 | https://github.com/moltbot/moltbot/commit/6d16a658e5ebe6ce15856565a47090d5b9d5dfb6 | 5283084 bytes | GitHub commit - noisy HTML, no article |

### Failure Categories

1. **SPA/JS-rendered sites** (3): tonystr.net, bsky.app, twitter.com x2
2. **Bot protection** (1): nytimes.com
3. **Non-article pages** (1): github.com commit page

### Note on AI Compensation

Despite content extraction failures, AI summaries were still generated using HN comments as fallback. This masks the problem but results in summaries based primarily on discussion rather than source material.

---

## Full Story List

| Story ID | Size | URL |
|----------|------|-----|
| 46787521 | 76,211 | https://www.web3isgoinggreat.com/single/lick-theft |
| 46784572 | 148,964 | https://amutable.com/about |
| 46783863 | 5,283,084 | https://github.com/moltbot/moltbot/commit/6d16a658e5ebe6ce15856565a47090d5b9d5dfb6 |
| 46783752 | 13,694 | https://openai.com/index/introducing-prism |
| 46783254 | 313,193 | https://www.nbcnews.com/tech/internet/fbi-investigating-minnesota-signal-minneapolis-group-ice-patel-kash-rcna256041 |
| 46781530 | 771 | https://www.nytimes.com/2026/01/26/science/archaeology-neanderthals-tools.html |
| 46781444 | 2,448,344 | https://finance.yahoo.com/news/amazon-closing-fresh-grocery-convenience-150437789.html |
| 46779809 | 6,024,452 | https://www.cnn.com/2026/01/26/tech/tiktok-ice-censorship-glitch-cec |
| 46779645 | 6,729 | https://alexxcons.github.io/blogpost_15.html |
| 46778341 | 427 | https://tonystr.net/blog/git_immitation |
| 46776155 | 19,213 | https://www.softwaredesign.ing/blog/doing-the-thing-is-doing-the-thing |
| 46771564 | 233,892 | https://twitter.com/karpathy/status/2015883857489522876 |
| 46770221 | 43,869 | https://simonwillison.net/2026/Jan/26/chatgpt-containers/ |
| 46769051 | 9,895 | https://bsky.app/profile/did:plc:okydh7e54e2nok65kjxdklvd/post/3mdd55paffk2o |
| 46768909 | 31,032 | https://nproject.io/blog/juicessh-give-me-back-my-pro-features/ |
| 46767668 | 233,856 | https://twitter.com/lellouchenico/status/2015775970330882319 |
| 46766961 | 213,618 | https://www.greptile.com/blog/ai-code-review-bubble |
| 46766741 | 23,482 | https://qwen.ai/blog?id=qwen3-max-thinking |
| 46766188 | 98,069 | https://diamondgeezer.blogspot.com/2026/01/tv100.html |
| 46766031 | 331,682 | https://www.theguardian.com/technology/2026/jan/24/google-ai-overviews-youtube-medical-citations-study |
| 46765819 | 216,049 | https://www.apple.com/newsroom/2026/01/apple-introduces-new-airtag-with-expanded-range-and-improved-findability/ |
| 46765460 | 181,728 | https://atmoio.substack.com/p/after-two-years-of-vibecoding-im |
| 46760329 | 297,853 | https://www.iranintl.com/en/202601255198 |
| 46757067 | 39,095 | https://gwern.net/blog/2026/make-me-care |
| 46756117 | 61,420 | https://www.eff.org/deeplinks/2026/01/report-ice-using-palantir-tool-feeds-medicaid-data |
| 46754944 | 315,179 | https://github.com/tldev/posturr |
| 46752151 | 9,063 | https://statmodeling.stat.columbia.edu/2026/01/22/aking/ |
| 46736815 | 244,064 | https://www.bbc.com/news/articles/c1evvx89559o |
| 46709270 | 180,021 | https://www.jampa.dev/p/lessons-learned-after-10-years-as |
| 46694193 | 78,844 | https://practical.engineering/blog/2026/1/20/the-hidden-engineering-of-runways |

---

## Recommendation

Puppeteer + Readability hybrid approach would solve:
1. **SPA sites** - Puppeteer renders JS, then Readability extracts
2. **Bot protection** - puppeteer-extra stealth plugin (already used for screenshots)
3. **Social media** - Could extract tweet/post content after JS loads

Trade-offs:
- Slower (browser spin-up)
- More resource intensive
- Keep plain fetch + Readability as fast fallback for static sites

---

## Puppeteer Test Results

Tested the 6 failed URLs with Puppeteer + Readability hybrid approach.

| Story ID | Original Issue | Puppeteer | Content Length | Notes |
|----------|----------------|-----------|----------------|-------|
| 46778341 | SPA (Vue.js) | ✅ Success | 8,145 | Full article extracted |
| 46781530 | Bot protection (NYTimes) | ✅ Success | 3,015 | Bypassed DataDome captcha |
| 46769051 | SPA (Bluesky) | ✅ Success | 3,729 | Post content extracted |
| 46771564 | SPA (Twitter) | ✅ Success | 6,463 | Karpathy's full thread |
| 46767668 | SPA (Twitter) | ✅ Success | 384 | Full tweet extracted (short content) |
| 46783863 | GitHub commit | ✅ Success | 13,203 | Fixed with domcontentloaded fallback |

### Result: 6 of 6 fixed (100% recovery)

**Overall with Puppeteer fallback:**
- Original failures: 6/30 (20%)
- Remaining failures: 0/30 (0%)
- **Success rate improved from 80% → 100%**

### Sample Extracted Content

**46778341 (tonystr.net SPA):**
> I made my own gitVersion control used to be a black box for me; I had no idea how files were stored, how diffs were generated or how commits were structured. Since I love reinventing the wheel, why not take a stab at git?

**46781530 (NYTimes behind bot protection):**
> The finding, along with the discovery of a 500,000-year-old hammer made of bone, indicates that our human ancestors were making tools even earlier than archaeologists thought.

**46771564 (Twitter/Karpathy thread):**
> A few random notes from claude coding quite a bit last few weeks. Coding workflow. Given the latest lift in LLM coding capability, like many others I rapidly went from about 80% manual+autocomplete coding and 20% agents in November to 80% agent coding and 20% edits+touchups in December...

### All Failures Fixed

1. ~~**Twitter (French post)**~~ - **FIXED**: Content was extracting correctly (384 chars = full tweet). Initial test used 500 char threshold which is too strict for tweets.
2. ~~**GitHub commit page**~~ - **FIXED** with `domcontentloaded` fallback (13,203 chars extracted)

### Notes

**GitHub commit**: The page has many network requests that never settle, but diff content loads quickly with `domcontentloaded`.

**Twitter/social posts**: Short content (< 500 chars) is expected. Threshold should be lower (~100 chars) or check for actual content presence.

---

## Screenshot Test Sites (Extended Test)

Tested 10 known problematic sites from `docs/screenshot-test-sites.md`:

| Site | Issue | Puppeteer | Content |
|------|-------|-----------|---------|
| dbushell.com | CSP blocks CSS | ✅ | 7,534 chars |
| blog.cloudflare.com | Navigation timeout | ✅ | 14,190 chars |
| androidauthority.com | Ad banners | ✅ | 1,440 chars |
| sciencealert.com | Top ad banner | ✅ | 3,879 chars |
| windowscentral.com | DFP ads, JS-heavy | ✅ | 1,936 chars |
| boginjr.com | CookieYes popup | ✅ | 3,882 chars |
| newsroom.porsche.com | Usercentrics popup | ✅ | 6,770 chars |
| latimes.com | Bot protection + legal popup | ✅ | 4,193 chars |
| openai.com | Cloudflare verification | ✅ | 14,196 chars |
| reuters.com | Aggressive bot protection | ✅ | 2,831 chars |

**Result: 10/10 success (100%)**

All problematic sites that required workarounds for screenshots also work perfectly for content extraction with Puppeteer + Readability.
