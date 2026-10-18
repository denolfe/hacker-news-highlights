# Bot Protection Detection - Research Notes

Research date: 2026-10-17
Purpose: Decide how to tell a bot-protection challenge or block page from real article content, so the story is summarized from HN comments instead.

Source permalinks pin the commit that was read. Claims taken from tool source code (not vendor docs) are labeled "from X source".

## Recommendation for this repo

Current heuristic (`isBotChallengeText` in `src/browser/fetchContent.ts`): rendered text < 200 chars, or <= 2000 chars plus one of 8 keywords. Proposed: final main-document status, vendor markers, drop keywords and length, LLM backstop.

The proposal is closer to prior art than the current heuristic. Every maintained tool read for this note uses status codes first (Crawlee, Firecrawl, crawl4ai, Scrapling, scrapy-rotating-proxies). No tool uses a prose keyword list without a size or status gate. Positions:

1. **Adopt: last main-frame navigation status.** Record it with `page.on('response')` filtered to `req.isNavigationRequest() && req.frame() === page.mainFrame()`, keeping the last one. Jina Reader does exactly this ([puppeteer.ts#L1094-L1099](https://github.com/jina-ai/reader/blob/1574bfd380d249c86c82db4dace0d9c8fe17e2b1/src/services/puppeteer.ts#L1094-L1099)). Do not use the `page.goto()` return value. It covers HTTP redirects only ([Puppeteer docs](https://pptr.dev/api/puppeteer.page.goto)), so after a challenge solves itself through a JS navigation it still reports the challenge response. Crawlee's source says this directly ([browser-crawler.ts#L532](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/browser-crawler/src/internals/browser-crawler.ts#L532)).
2. **Change: widen the status rule to "any final status >= 400 is unusable".** 401/403/429/503 are the block codes; log them as `blocked`. Log other 4xx/5xx as `http-error`. Both end in a comments-only summary. A 404 or 500 page is not an article either. Also count `x-amzn-waf-action` on any status as blocked: AWS WAF returns 202 for Challenge and 405 for CAPTCHA, and neither is in the proposed list ([AWS docs](https://docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html)).
3. **Change: do not match bare `/cdn-cgi/challenge-platform/`.** Cloudflare injects a script from that path into all HTML pages when JavaScript Detections is on. It is always on for Bot Fight Mode, the Free-plan bot feature ([JS detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/), [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)). Observed on a real 200 page from substack.com (see Observations). Match `cf-mitigated: challenge` (header), `_cf_chl_opt`, or `/cdn-cgi/challenge-platform/h/<x>/orchestrate/` instead. crawl4ai uses the `orchestrate` form ([antibot_detector.py#L40](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py#L40)).
4. **Adopt with a note: `captcha-delivery.com` and `errors.edgesuite.net`.** In every observed case the status (401/403) already catches these pages. They help most on the plain-fetch path and as log labels. Keep them.
5. **Add: Anubis.** Anubis returns HTTP 200 for both challenge and deny pages by default ([botPolicies.yaml#L190-L196](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/data/botPolicies.yaml#L190-L196)), so a status rule never sees it. Match `<script id="anubis_challenge"` ([index.templ#L61-L62](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/web/index.templ#L61-L62)). Anubis is common on self-hosted git forges; its docs have a Gitea/Forgejo page ([docs](https://github.com/TecharoHQ/anubis/tree/207f9eb87183bf3d29982515648ed95b68f7dd4d/docs/docs/admin)). Those are frequent HN link targets.
6. **Agree: drop the keyword list.** It is gated at 2000 chars, so it misses large challenge pages. ft.com served a 270 KB Cloudflare challenge (title "Security Verification"). Status and `cf-mitigated` catch it.
7. **Push back: keep a minimum-content check, under a different name.** The 200-char rule also catches SPAs that fail to render and paywall stubs. No vendor marker covers those. Rename it to an "insufficient content" reason, not "bot protection". The outcome stays the same.
8. **Change: apply the same check on the plain-fetch path, but escalate.** A vendor hit on Node `fetch` should send the URL to the browser, not drop it, because a real browser may pass the challenge (Cloudflare non-interactive, Anubis proof-of-work, AWS WAF Challenge). Replace the vendor strings in `SPA_INDICATORS` with one shared detector.
9. **Change: make the LLM backstop structured.** Have the summarizer return a boolean such as `isSourceContentUsable` alongside the summary. A free-text "treat as empty" instruction cannot be tested, logged, or measured. No open-source tool read for this note uses an LLM to detect block pages (see LLM section). Its real job is soft blocks: login walls, consent walls, paywall teasers.
10. **Optional: short wait on a Cloudflare challenge.** If the last navigation is a `cf-mitigated: challenge` response, wait a few seconds for a new main-frame navigation before deciding. Crawlee waits 5 s in this case ([browser-crawler.ts#L528-L537](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/browser-crawler/src/internals/browser-crawler.ts#L528-L537)).
11. **Skip:**
    - WAF presence fingerprints (`cf-ray`, `server: cloudflare`, `server: AkamaiGHost`, `datadome`/`_abck`/`incap_ses_` cookies). They are on normal pages too.
    - `window._pxAppId`. HUMAN's normal-page sensor snippet sets it ([profile.template.jsp#L21](https://github.com/PerimeterX/perimeterx-java-sdk/blob/bf514311d2584f4e86f7e6391353dfd729e8a93c/web/src/main/java/templates/profile.template.jsp#L21)).
    - Challenge auto-clicking (FlareSolverr, Crawlee, Scrapling). Out of scope here, and it works against site intent.
    - crawl4ai's tier-3 structural scoring. Item 7 covers it.

Suggested decision order (browser path):

```
final = last main-frame navigation response
1. final.status >= 400                    -> unusable (blocked if 401/403/429/503)
2. header x-amzn-waf-action present       -> blocked (AWS WAF, 202/405)
3. header cf-mitigated == "challenge"     -> blocked (Cloudflare)
4. DOM has a high-precision marker        -> blocked (Anubis, CF _cf_chl_opt/orchestrate,
                                             px-captcha, _Incapsula_Resource, Vercel checkpoint)
5. Readability text < MIN_CONTENT_LENGTH  -> insufficient content
6. LLM returns isSourceContentUsable=false -> unusable (soft block)
```

## Signal comparison

| Signal | Vendors / tools using it | False-positive risk | False-negative risk |
|---|---|---|---|
| Last main-frame navigation status 401/403/429/503 | Crawlee (401/403/429), Firecrawl (401/403/429), crawl4ai (403/503/429), Scrapling (wider set), Jina (status recorded, warn only) | Low. A site with real content behind 403 is possible; no concrete case found | Misses 200-status challenges (Anubis, some in-house pages) and AWS 202/405 |
| `page.goto()` status | crawl4ai (first hop of redirect chain), Crawlee | Medium. Reports the challenge status after the challenge has solved and navigated | Same as above |
| Any status >= 400 | trafilatura (non-200 rejected), Firecrawl (non-2xx not "good") | Low for this use. 4xx pages are rarely articles | Same 200-status gap |
| `x-amzn-waf-action` + 202/405 | AWS WAF docs | Very low | Only AWS WAF |
| `cf-mitigated: challenge` | Cloudflare docs, Scrapfly Classify inputs | Very low (vendor-defined) | Does not cover Cloudflare blocks such as 1020 (those return 403) |
| Presence headers/cookies (`cf-ray`, `AkamaiGHost`, `datadome`, `_abck`, `incap_ses_`) | wafw00f (presence only) | High. They are on every proxied response | n/a |
| Bare `/cdn-cgi/challenge-platform/` | Proposed only | High. JSD script on normal Free-plan pages (observed) | Low |
| `_cf_chl_opt` / `.../orchestrate/` / Turnstile iframe | crawl4ai, Crawlee, FlareSolverr, Scrapling (`cType`) | Low. Turnstile widgets also sit on normal login forms | Cloudflare only |
| Title "Just a moment..." | FlareSolverr, Botasaurus, crawl4ai (short pages) | Low | Misses localized and new titles ("Security Verification", observed) |
| `captcha-delivery.com` | crawl4ai, repo SPA_INDICATORS | Unknown on normal DataDome pages (not checked) | DataDome only |
| `window._pxAppId` | crawl4ai (tier 1), fastcrw (port) | High. Normal-page sensor snippet sets it | n/a |
| `px-captcha`, `captcha.px-cdn.net`, "Access to this page has been denied" | HUMAN SDK templates, crawl4ai, wafw00f, Botasaurus | Low | Custom block pages (Bloomberg uses its own title) |
| `_Incapsula_Resource`, "Incapsula incident ID" | Crawlee, wafw00f, crawl4ai | Low | Imperva only |
| Akamai `Reference #18.x` / `errors.edgesuite.net` | crawl4ai, observed | Low | Akamai only; the status catches it anyway |
| `anubis_challenge` script id | Anubis source, wafw00f | Very low | Anubis only |
| Prose keywords on short pages (current) | crawl4ai tier 2 (status- or size-gated), FlareSolverr titles | Medium. Short real pages that mention the phrases | High. Large challenge pages (ft.com 270 KB) |
| Rendered text < N chars (current) | crawl4ai tier 3, Jina (< 200 tokens, cache gate) | Medium. Short real pages, image posts | Large SPA-shell block pages |
| LLM / VLM judgement | No OSS tool found; RegTrack paper (VLM, screenshots) | Unmeasured for HTML/text input | Unmeasured |

## Observations (curl, 2026-10-17)

These are plain HTTP requests (curl, Chrome 141 user agent, `Accept: text/html`), not headless Chrome. They show what each vendor returns before any JavaScript runs.

| URL | Status | Vendor evidence |
|---|---|---|
| nopecha.com/demo/cloudflare | 403 | `cf-mitigated: challenge`, title "Just a moment...", `cf_chl_opt`, `challenge-platform/h/b/orchestrate/chl` |
| stackoverflow.com/questions, quora.com, economist.com | 403 | title "Just a moment...", `cf_chl_opt` |
| ft.com | 403 | `cf-mitigated: challenge`, title "Security Verification", 270 KB body |
| medium.com | 403 | `server: cloudflare`, no `cf-mitigated`, title "Attention Required! \| Cloudflare", `challenge-platform/scripts/precursor/main` |
| substack.com | 200 | Real page; contains `challenge-platform/scripts/jsd/main` |
| nytimes.com | 403 | `server: DataDome`, `x-datadome: protected`, `x-dd-b: 1`, `datadome` cookie; body `var dd={...'host':'geo.captcha-delivery.com'...}` and `ct.captcha-delivery.com/c.js` |
| g2.com | 403 | `x-datadome: protected`, `x-dd-b: 1`, `server: cloudflare`; body has `captcha-delivery.com` and the Cloudflare JSD script |
| wsj.com, reuters.com | 401 | `x-datadome: protected`; body has `captcha-delivery.com` |
| tesla.com | 403 | `server: AkamaiGHost`, title "Access Denied", `Reference #18.<hex>.<ts>.<hex>`, `errors.edgesuite.net` |
| zillow.com | 403 | `x-px-blocked: 1`, title "Access to this page has been denied", `px-captcha`, `/HYx10rg3/init.js` |
| bloomberg.com | 403 | `_pxhd` cookie, title "Bloomberg - Are you a robot?", `px-captcha` |
| reddit.com | 200 | 8 KB page with an auto-submitting JS proof-of-work form (`solution` field). A 200-status challenge |

## Per-vendor markers

### Cloudflare

- `cf-mitigated: challenge` is set for all Challenge Page types; `challenge` is the only valid value. Challenge content type is always `text/html` ([detect-response](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)).
- That doc gives no status code. Observed: 403 on every challenge above. Several secondary sources also say 403; vendor-unverified.
- Error 1020 (blocked by a customer security rule) returns HTTP 403 ([1020 doc](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1020/)).
- Cookies: `cf_clearance` stores proof of a passed challenge; `__cf_bm` is set for bot products on normal traffic ([cookies doc](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/)). Neither indicates a block.
- `/cdn-cgi/challenge-platform/...` scripts are injected into all HTML pages when JavaScript Detections is on, and Bot Fight Mode forces it on ([JS detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/), [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)).
- From tool source:
  - Crawlee: `#turnstile-wrapper iframe[src^="https://challenges.cloudflare.com"]`, `.footer .footer-inner .ray-id`, h1 "Sorry, you have been blocked" ([blocked.ts](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/utils/src/internals/blocked.ts#L1), [playwright-utils.ts#L682-L694](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/playwright-crawler/src/internals/utils/playwright-utils.ts#L683-L696)).
  - FlareSolverr: titles "Just a moment...", "Access denied", "Attention Required! \| Cloudflare"; selectors `#cf-challenge-running`, `#challenge-spinner`, `#turnstile-wrapper`, `div.cf-error-title span.cf-code-label span`, and more ([flaresolverr_service.py#L25-L54](https://github.com/FlareSolverr/FlareSolverr/blob/76dc4049becf8fcb26b7ebd6a7ef266d508a5909/src/flaresolverr_service.py#L25-L54)).
  - Scrapling: `cType: 'non-interactive' | 'managed' | 'interactive'` in page source; embedded Turnstile via `script[src*="challenges.cloudflare.com/turnstile/v"]` ([_base.py#L582-L615](https://github.com/D4Vinci/Scrapling/blob/7a684934907a8c7feaafe9ff1ccfd9d45cc26faf/scrapling/engines/_browsers/_base.py#L582-L615)).
  - crawl4ai: `challenge-form.*__cf_chl_f_tk=`, `<span class="cf-error-code">\d{4}</span>`, `/cdn-cgi/challenge-platform/\S+orchestrate` ([antibot_detector.py#L26-L41](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py#L26-L41)).

### Akamai (Bot Manager / Kona)

- Vendor docs: none found that state the deny status code or block page content. The Terraform resource pages for challenge and custom deny actions give no response details ([challenge action](https://techdocs.akamai.com/terraform/docs/bmgr-rc-challenge-action), [custom deny](https://techdocs.akamai.com/terraform/docs/bmgr-rc-custom-deny-action)).
- Observed (tesla.com): 403, `server: AkamaiGHost`, "Access Denied", `Reference #18.<hex>.<epoch>.<hex>`, `https://errors.edgesuite.net/<same id>`.
- From wafw00f source: `Server: AkamaiGHost` identifies Akamai presence, not a block ([kona.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/kona.py)).
- From crawl4ai source: the `Reference #` regex, plus "Pardon Our Interruption" labeled as Akamai ([antibot_detector.py#L27-L32](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py#L27-L32)). The vendor for that page is unverified (see Open questions).

### DataDome

- Vendor docs: the integration module returns the status DataDome's API gives in `X-DataDomeResponse`. 200 means allow; any other value is returned to the client with the API body. Example statuses: 401, 403. The `datadome` cookie is set on responses ([validate-request](https://docs.datadome.co/reference/validate-request.md)). DataDome's Go module does the same ([client.go#L339-L364](https://github.com/DataDome/module-go-package/blob/316a3841c3f60bc9b345231a2292d2922b17a879/client.go#L339-L364)).
- Vendor test docs: the `BLOCKUA` user agent forces a block, and the plugin reacts to "the blocked request (403 code)" ([React Native SDK](https://docs.datadome.co/docs/sdk-react-native-fetch-restructured)).
- Observed: 403 or 401; headers `x-datadome: protected`, `x-dd-b: 1`, `x-datadome-cid`; body `var dd={...}` with `geo.captcha-delivery.com`, script `ct.captcha-delivery.com/c.js`. These headers are not in the vendor docs found. It is unverified whether `x-datadome: protected` also appears on allowed responses.
- From crawl4ai source: `captcha-delivery\.com` as tier 1 ([antibot_detector.py#L49](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py#L49)).

### HUMAN (PerimeterX)

- Vendor SDK source (HUMAN's own Java enforcer):
  - Block sends 403; rate-limit action sends 429 ([DefaultBlockHandler.java#L61-L66](https://github.com/PerimeterX/perimeterx-java-sdk/blob/bf514311d2584f4e86f7e6391353dfd729e8a93c/perimeterx-sdk/src/main/java/com/perimeterx/api/blockhandler/DefaultBlockHandler.java#L61-L66)).
  - Block template title is "Access to this page has been denied." ([block_template.mustache#L6](https://github.com/PerimeterX/perimeterx-java-sdk/blob/bf514311d2584f4e86f7e6391353dfd729e8a93c/perimeterx-sdk/src/main/resources/com/perimeterx/api/blockhandler/templates/block_template.mustache#L6)).
  - Captcha template has `<meta name="description" content="px-captcha">` and sets `window._pxAppId`, `window._pxUuid`, `window._pxHostUrl` ([captcha_template.mustache#L6-L18](https://github.com/PerimeterX/perimeterx-java-sdk/blob/bf514311d2584f4e86f7e6391353dfd729e8a93c/perimeterx-sdk/src/main/resources/com/perimeterx/api/blockhandler/templates/captcha_template.mustache#L6-L18)).
  - Captcha host constant: `captcha.px-cdn.net` ([Constants.java#L41](https://github.com/PerimeterX/perimeterx-java-sdk/blob/bf514311d2584f4e86f7e6391353dfd729e8a93c/perimeterx-sdk/src/main/java/com/perimeterx/utils/Constants.java#L41)).
  - The normal-page sensor snippet also sets `window._pxAppId` ([profile.template.jsp#L21](https://github.com/PerimeterX/perimeterx-java-sdk/blob/bf514311d2584f4e86f7e6391353dfd729e8a93c/web/src/main/java/templates/profile.template.jsp#L21)), so `_pxAppId` alone is not a block signal.
- Vendor docs: sensor CSP domains are `*.px-cloud.net`, `*.px-cdn.net`, `*.pxchk.net`, `*.px-client.net` ([sensor](https://docs.humansecurity.com/applications-and-accounts/docs/sensor)). These are on normal pages too.
- Observed: `x-px-blocked: 1` (zillow.com) and `_pxhd` cookie (bloomberg.com). Not in vendor docs found.
- From tool source: wafw00f matches `perimeterx.(com|net)/whywasiblocked`, `client.perimeterx.(net|com)`, "denied because we believe you are using automation tools" ([perimeterx.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/perimeterx.py)). Botasaurus matches the text "Please verify you are a human" ([driver.py#L1353-L1368](https://github.com/omkarcloud/botasaurus-driver/blob/db1d2916086e254dac64edc6bfb07fab556146df/botasaurus_driver/driver.py#L1353-L1368)).

### Imperva (Incapsula)

- Vendor docs: none found that describe the block page or its status code.
- From tool source:
  - Crawlee: `iframe[src*="_Incapsula_Resource"]` ([blocked.ts#L6-L10](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/utils/src/internals/blocked.ts#L6-L10)).
  - wafw00f: cookies `incap_ses_*`, `visid_incap_*` (presence); content "incapsula incident id", "powered by incapsula", `/_Incapsula_Resource` ([incapsula.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/incapsula.py)).
  - crawl4ai: `_Incapsula_Resource`, `Incapsula incident ID` (tier 1); "Request unsuccessful" (tier 2) ([antibot_detector.py](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py#L50-L56)).
- Secondary (unverified): Imperva may serve block pages with a 200 status ([ZenRows](https://www.zenrows.com/blog/incapsula-bypass.md)). If true, the status rule misses it, so keep the `_Incapsula_Resource` marker.

### Kasada

- Vendor docs: none public found.
- From crawl4ai source: `KPSDK.scriptStart = KPSDK.now()` ([antibot_detector.py](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py#L60-L62)).
- Third-party: `x-kpsdk-ct` / `x-kpsdk-cd` headers in solver tooling ([kpsdk-solver](https://classic.yarnpkg.com/en/package/kpsdk-solver)). The Kasada block status code (often reported as 429) is unverified.

### AWS WAF

- Vendor docs ([CAPTCHA and Challenge behavior](https://docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html)):
  - Challenge: header `x-amzn-waf-action: challenge`, status `202`, JS interstitial when `Accept: text/html`.
  - CAPTCHA: header `x-amzn-waf-action: captcha`, status `405`, CAPTCHA interstitial.
  - After a solve, "the script resubmits the original web request using the updated token". That is a new navigation, so only the last navigation response is valid.
- From wafw00f source: `X-Blocked-By-WAF: Blocked_by_custom_response_for_AWSManagedRules.*` ([awswaf.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/awswaf.py)); CloudFront "Generated by cloudfront (CloudFront)" block text ([cloudfront.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/cloudfront.py)).
- Default Block action status (commonly 403): not re-verified in AWS docs for this note.

### F5 (BIG-IP ASM, Distributed Cloud / Shape)

- From wafw00f source: ASM block page text "The requested URL was rejected" plus "Please consult with your administrator"; `TS[0-9a-f]{6,8}` cookies (presence) ([f5bigipasm.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/f5bigipasm.py)).
- Vendor docs: the BIG-IP blocking page has a configurable `status-code` ([tmsh reference](https://clouddocs.f5.com/cli/tmsh-reference/v15/modules/security/security_bot-defense_profile.html)), so no fixed code. No Distributed Cloud Bot Defense (Shape) status or markers found.

### Vercel

- Vendor docs: Deny returns `403 Forbidden`. Challenge shows a "Vercel Security Checkpoint" page that runs JS, then continues the request; sessions last 1 hour ([firewall concepts](https://vercel.com/docs/vercel-firewall/firewall-concepts)). The challenge status code is not stated.
- Community reports: `x-vercel-mitigated: challenge` or `deny` on 403 responses ([forum 1](https://community.vercel.com/t/production-api-and-vercel-dev-blocked-by-x-vercel-mitigated-challenge-403-false-cors/41873), [forum 2](https://community.vercel.com/t/false-positive-production-domain-blocked-by-vercel-edge-x-vercel-mitigated-deny/45125)). Not in vendor docs found.
- From wafw00f source: `<title>Vercel Security Checkpoint</title>`, `/vercel/security/` ([vercel.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/vercel.py)).

### Netlify

- Vendor docs: a rate limiting rule can block with HTTP 429 ([rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)). WAF actions are Block, Disable, and Log, with no challenge action; the block status is not stated ([WAF](https://docs.netlify.com/manage/security/secure-access-to-sites/web-application-firewall/)). Low relevance: no challenge page to detect.

### Anubis (Techaro)

- Vendor source and docs:
  - Default `status_codes: CHALLENGE: 200, DENY: 200` ([botPolicies.yaml#L190-L196](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/data/botPolicies.yaml#L190-L196)). The status is configurable ([custom-status-codes.mdx](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/docs/docs/admin/configuration/custom-status-codes.mdx)).
  - Page contains JSON scripts with ids `anubis_version` and `anubis_challenge` ([index.templ#L61-L62](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/web/index.templ#L61-L62)).
  - English title string: "Making sure you're not a bot!" ([en.json#L43](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/lib/localization/locales/en.json#L43)).
  - Cookie name prefix: `techaro.lol-anubis` ([anubis.go#L29](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/anubis.go#L29)).
- From wafw00f source: the same script ids, `-anubis-auth=` cookie, `/.within.website/x/cmd/anubis/` ([anubis.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/anubis.py)).

## Per-tool detection

### wafw00f

- 173 plugins. Each plugin's `is_waf()` matches headers, cookies, or content on a normal response and on an attack-payload response ([plugins/](https://github.com/EnableSecurity/wafw00f/tree/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins), [main.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/main.py#L207-L255)).
- It answers "is a WAF in front of this site", not "is this response a block". Example: Cloudflare is detected by `server: cloudflare`, `cf-ray`, or a `__cfduid` cookie ([cloudflare.py](https://github.com/EnableSecurity/wafw00f/blob/69fbe3956bba47a172cf87e40e9037535d32a130/wafw00f/plugins/cloudflare.py)). Those are on every Cloudflare response. Its content regexes (block-page strings) are reusable; its header and cookie checks are not.

### Crawlee (apify/crawlee, JS)

- `BLOCKED_STATUS_CODES = [401, 403, 429]` ([consts.ts#L1](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/basic-crawler/src/internals/session-pool/consts.ts#L1)). With a session pool, a matching status throws `SessionError` and retires the session ([basic-crawler.ts#L2466-L2472](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/basic-crawler/src/internals/basic-crawler.ts#L2466-L2472)).
- With `retryOnBlocked`, it also checks `RETRY_CSS_SELECTORS`: Cloudflare Turnstile iframe, a Google "sorry" page link, and the Incapsula iframe ([blocked.ts](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/utils/src/internals/blocked.ts)). Browser crawler: on a Cloudflare selector plus 403 it waits 5 s, then re-checks selectors only. The status from `goto` is stale after the challenge navigates ([browser-crawler.ts#L525-L546](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/browser-crawler/src/internals/browser-crawler.ts#L525-L546)). The HTTP crawler checks the same selectors with Cheerio ([http-crawler.ts#L711-L727](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/http-crawler/src/internals/http-crawler.ts#L711-L727)).
- `handleCloudflareChallenge` (Playwright): blocked = h1 contains "Sorry, you have been blocked"; challenge = `.footer .footer-inner .ray-id`. It then clicks the checkbox ([playwright-utils.ts#L677-L701](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/playwright-crawler/src/internals/utils/playwright-utils.ts#L677-L701)).
- crawlee-python mirrors the same codes and selectors ([_session.py](https://github.com/apify/crawlee-python/blob/508f544f7f0260b4f26b806d50e84592538f8db6/src/crawlee/sessions/_session.py#L33), [blocked.py](https://github.com/apify/crawlee-python/blob/508f544f7f0260b4f26b806d50e84592538f8db6/src/crawlee/_utils/blocked.py)).

### crawl4ai

The most complete open-source detector found ([antibot_detector.py](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/antibot_detector.py)). Its stated philosophy: "false positives are cheap (the fallback mechanism rescues them), false negatives are catastrophic". The same tradeoff applies here.

- 429 is always blocked. Tier 1 structural markers match on any size: the first 15 KB, plus a scripts-and-styles-stripped deep scan for large pages.
- 403/503 with non-data HTML is always blocked, regardless of size (L245).
- Tier 2 prose patterns ("Access Denied", "Checking your browser", `<title>Just a moment`, reCAPTCHA/hCaptcha class, "Access to This Page Has Been Blocked") apply only on pages < 10 KB or on 4xx/5xx.
- 200 with < 100 bytes, or a structural check (no `<body>`, < 50 visible chars, no content elements), counts as blocked.
- Weakness 1: `window._pxAppId =` is a tier 1 signal, but the normal-page sensor sets it (see HUMAN).
- Weakness 2: the status code is the first response in the redirect chain, not the final one ([async_crawler_strategy.py#L781-L800](https://github.com/unclecode/crawl4ai/blob/94b67888ca8b335ff2121423a50e06dd27661922/crawl4ai/async_crawler_strategy.py#L781-L800)). A 301 that leads to a 403 reports 301.
- fastcrw/crw (Rust) is a direct port of this file ([antibot.rs](https://github.com/fastcrw/crw/blob/main/crates/crw-extract/src/antibot.rs)).

### FlareSolverr

- Title and selector lists only; no status codes. Selenium does not expose them ([flaresolverr_service.py#L25-L54](https://github.com/FlareSolverr/FlareSolverr/blob/76dc4049becf8fcb26b7ebd6a7ef266d508a5909/src/flaresolverr_service.py#L25-L54)).
- An access-denied title or selector raises an error. A challenge title (exact match, case-insensitive) or selector starts a wait loop, then a wait for the `<html>` element to go stale, meaning the page navigated ([L402-L470](https://github.com/FlareSolverr/FlareSolverr/blob/76dc4049becf8fcb26b7ebd6a7ef266d508a5909/src/flaresolverr_service.py#L402-L470)). This confirms that a solved challenge replaces the document.

### Scrapy and scrapy-rotating-proxies

- Scrapy core has no ban detection. `RETRY_HTTP_CODES` defaults to `[500, 502, 503, 504, 522, 524, 408, 429]` ([docs](https://docs.scrapy.org/en/latest/topics/downloader-middleware.html)).
- scrapy-rotating-proxies `BanDetectionPolicy`: any status not in `{200, 301, 302}` is a ban; so is a 200 with an empty body ([policy.py](https://github.com/TeamHG-Memex/scrapy-rotating-proxies/blob/a2cd6a7517128cab09e4a8ce6645453814670d4d/rotating_proxies/policy.py)). The README tells users to subclass it for site-specific logic.

### Firecrawl

- Engine waterfall success rule: content non-empty or status not good. Good status = 2xx or 304. 401/403/429 is treated as "likely proxy error" and retried with a stealth proxy ([scrapeURL/index.ts#L747-L790](https://github.com/mendableai/firecrawl/blob/dc8a23c59ed20ef5a371092b6f59ce4dad521c77/apps/api/src/scraper/scrapeURL/index.ts#L747-L790)).
- An inline TODO admits the gap: "what to do when status code is bad is tough... we cannot just rely on text because error messages can be brief" (L785).
- Anti-bot handling in the hosted product lives in the closed-source Fire-engine. No vendor markers were found in the open-source tree.

### Jina Reader

- Tracks the last main-frame navigation response via `page.on('response')` ([puppeteer.ts#L1094-L1099](https://github.com/jina-ai/reader/blob/1574bfd380d249c86c82db4dace0d9c8fe17e2b1/src/services/puppeteer.ts#L1094-L1099)).
- Does not drop blocked pages. It adds warnings: "Target URL returned error {code}" for non-2xx, and a CAPTCHA warning when the HTML contains `captcha` or `cf-turnstile-response` ([snapshot-formatter.ts#L800-L810](https://github.com/jina-ai/reader/blob/1574bfd380d249c86c82db4dace0d9c8fe17e2b1/src/services/snapshot-formatter.ts#L800-L810), [L859-L862](https://github.com/jina-ai/reader/blob/1574bfd380d249c86c82db4dace0d9c8fe17e2b1/src/services/snapshot-formatter.ts#L859-L862)).
- Skips caching when content is < 200 tokens and the status is not 200 or the HTML has `captcha` or `cf-turnstile` ([crawler.ts#L165-L176](https://github.com/jina-ai/reader/blob/1574bfd380d249c86c82db4dace0d9c8fe17e2b1/src/api/crawler.ts#L165-L176)). The bare `captcha` substring is broad; it is acceptable for a warning, not for a drop decision.

### trafilatura

- Rejects any non-200 download and any body below `MIN_FILE_SIZE` (10 bytes). No vendor detection ([downloads.py#L256-L261](https://github.com/adbar/trafilatura/blob/e2f85c965662c7df26b73290ef175b2c2a5fdca6/trafilatura/downloads.py#L256-L261), [settings.cfg#L8](https://github.com/adbar/trafilatura/blob/e2f85c965662c7df26b73290ef175b2c2a5fdca6/trafilatura/settings.cfg#L8)).

### Scrapling

- Spider default `is_blocked`: status in `{401, 403, 407, 429, 444, 500, 502, 503, 504}`; users override it ([spider.py#L16](https://github.com/D4Vinci/Scrapling/blob/7a684934907a8c7feaafe9ff1ccfd9d45cc26faf/scrapling/spiders/spider.py#L16), [L204-L208](https://github.com/D4Vinci/Scrapling/blob/7a684934907a8c7feaafe9ff1ccfd9d45cc26faf/scrapling/spiders/spider.py#L204-L208)).
- Browser fetcher: detects Cloudflare by `cType: '<type>'` in the page or an embedded Turnstile script ([_base.py#L582-L615](https://github.com/D4Vinci/Scrapling/blob/7a684934907a8c7feaafe9ff1ccfd9d45cc26faf/scrapling/engines/_browsers/_base.py#L582-L615)). Builds the response from the final response when one is available ([convertor.py#L114](https://github.com/D4Vinci/Scrapling/blob/7a684934907a8c7feaafe9ff1ccfd9d45cc26faf/scrapling/engines/toolbelt/convertor.py#L114)).

### Botasaurus

- `get_bot_detected_by()`: Cloudflare if the title is "Just a moment..." or a visible `cf-turnstile-response` input exists; PerimeterX if the text "Please verify you are a human" is present ([driver.py#L1353-L1368](https://github.com/omkarcloud/botasaurus-driver/blob/db1d2916086e254dac64edc6bfb07fab556146df/botasaurus_driver/driver.py#L1353-L1368)).

### undetected-chromedriver, puppeteer-extra

- No block-page detection in either. They only reduce detection (checked with grep of [undetected-chromedriver](https://github.com/ultrafunkamsterdam/undetected-chromedriver/tree/757ed6a22052f0674bb7c9f765ca884d15dcb780) and [puppeteer-extra/packages](https://github.com/berstend/puppeteer-extra/tree/master/packages)).

### Commercial (closed)

- Zyte API defines a ban as a response "different from the response anyone would get in a browser". It returns 520 when it cannot avoid one, and passes non-ban non-200 responses (for example 404) through ([errors](https://docs.zyte.com/zyte-api/usage/errors.html)).
- Scrapfly Classify takes `status_code`, `headers` (`server`, `cf-ray`, `cf-mitigated`), and body. It says "detection signatures always live near the top of the body" but does not document the method ([classify](https://scrapfly.io/docs/scrape-api/classify)).

## LLM or classifier detection

- No open-source tool read here (Crawlee, crawl4ai, Firecrawl, Jina Reader, Scrapling, FlareSolverr, Botasaurus, trafilatura) uses an LLM or ML classifier in the block-detection path. All use status codes, selectors, or regexes.
- RegTrack (NDSS MADWeb 2026) classified crawl screenshots as valid or invalid (CAPTCHAs, error pages, security warnings) with five VLMs. Llama4 scored 99% accuracy, Cohen's kappa 0.94, on 400 manually labeled screenshots ([arXiv 2603.02679](https://arxiv.org/abs/2603.02679), §C and Table II). The input is screenshots, the task is coarse, and the sample is small, so it does not transfer directly to text from Readability.
- Older censorship research: Jones et al. 2014 found page-length comparison beat DOM similarity for block-page detection (95.03% TPR, 1.371% FPR on the ONI dataset). That method needs a known-good baseline page, which this repo does not have ([paper](https://people.cs.umass.edu/~phillipa/papers/JLFG14.pdf)).
- Conclusion: no evidence of LLM reliability for this exact task. Use the LLM as a last check with a structured output, and log its verdicts so the rate can be measured.

## Pitfalls

1. **Which response to check.** `page.goto()` returns the last HTTP-redirect response, not later navigations ([Puppeteer](https://pptr.dev/api/puppeteer.page.goto)). Cloudflare, AWS WAF, Anubis, and Reddit's proof-of-work all solve with JS and then navigate or resubmit ([AWS](https://docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html), [FlareSolverr staleness wait](https://github.com/FlareSolverr/FlareSolverr/blob/76dc4049becf8fcb26b7ebd6a7ef266d508a5909/src/flaresolverr_service.py#L458-L462), Reddit observation). Use the last main-frame navigation response. If the check runs before the solve finishes, the result is a false positive, which is safe here.
2. **The repo's goto retry.** On a `networkidle0` timeout, `fetchContentWithBrowser` calls `goto` again. A response listener sees both loads; keeping the last one is correct.
3. **200-status challenge pages.** Anubis by default ([botPolicies.yaml](https://github.com/TecharoHQ/anubis/blob/207f9eb87183bf3d29982515648ed95b68f7dd4d/data/botPolicies.yaml#L190-L196)), Reddit (observed), possibly Imperva (unverified). AWS uses 202 and 405 ([AWS](https://docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html)). A status-only rule misses these. Body markers or the content check must cover them.
4. **Soft blocks.** Login walls, consent walls, and paywall teasers return 200 with real-looking but partial content. No vendor marker or status catches them. Only the minimum-content check and the LLM backstop do. A paywall teaser may be acceptable input; a consent wall is not.
5. **Real content with 4xx.** Zyte passes through non-ban 404s as valid responses ([Zyte](https://docs.zyte.com/zyte-api/usage/errors.html)). Firecrawl accepts a non-2xx result when no engine does better ([index.ts#L758-L760](https://github.com/mendableai/firecrawl/blob/dc8a23c59ed20ef5a371092b6f59ce4dad521c77/apps/api/src/scraper/scrapeURL/index.ts#L760-L762)). No concrete HN-relevant site was found that serves its article with 401/403/429/503. The cost of that false positive here is a comments-only summary.
6. **Presence vs block.** Vendor headers and cookies (`cf-ray`, `__cf_bm`, `AkamaiGHost`, `datadome`, `_px*`, `incap_ses_`) mark the vendor, not a block. wafw00f's matchers are presence checks by design.
7. **Two vendors on one page.** g2.com is DataDome behind Cloudflare: the DataDome 403 page also carries the Cloudflare JSD script (observed). Attribute by the strongest marker; the "blocked" decision does not depend on attribution.
8. **Turnstile on normal pages.** Turnstile widgets also sit on normal login and comment forms. Treat `challenges.cloudflare.com` iframes as a signal only together with `cf-mitigated` or a short page. Crawlee pairs it with a 403 ([browser-crawler.ts#L529](https://github.com/apify/crawlee/blob/02899241d570624a0ce0b77dbcb44b9d58a98ade/packages/browser-crawler/src/internals/browser-crawler.ts#L529)).

## Open questions and unverified claims

- **Cloudflare challenge status:** the vendor docs read do not state it. 403 is observed only.
- **DataDome headers:** `x-datadome: protected` and `x-dd-b` are observed only. Unknown whether `x-datadome: protected` also appears on allowed 200 responses.
- **`captcha-delivery.com` on normal pages:** unknown whether it appears in normal (200) DataDome-protected pages. Not tested.
- **"Pardon Our Interruption":** vendor unverified. crawl4ai labels it Akamai; no vendor doc found for either Akamai or Imperva/Distil.
- **Akamai Bot Manager:** default deny status and challenge page content not found in Akamai docs. 403 is observed only.
- **Imperva:** block page status (200 vs 403) not verified in Imperva docs.
- **Kasada:** block status code and markers not verified in vendor docs. Only crawl4ai's `KPSDK` regex and third-party solver keywords.
- **AWS WAF:** default Block action status not re-verified in docs for this note.
- **F5 Distributed Cloud / Shape:** no status code or markers found.
- **Vercel:** challenge page status and the `x-vercel-mitigated` header are not in Vercel docs. Community reports only.
- **`x-px-blocked: 1`:** observed on zillow.com; not in HUMAN docs found.
- **Headless Chrome behavior:** the observations above use curl. It is not verified which of these challenges headless Chrome with the stealth plugin passes. Record the final navigation status per story in production logs to find out.
- **DataDome DOM after JS:** the exact path (for example `geo.captcha-delivery.com/captcha/`) is from third-party sources only.
