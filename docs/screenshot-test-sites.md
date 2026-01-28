# Screenshot Test Sites

Test URLs used to validate screenshot capture fixes.

## Error Handling

| URL | Issue | Fix |
|-----|-------|-----|
| `https://dbushell.com/2026/01/22/proton-spam/` | CSS injection fails (CSP blocks addStyleTag) | Wrap addStyleTag in try/catch, continue without CSS |
| `https://blog.cloudflare.com/cname-a-record-order-dns-standards/` | Navigation timeout (networkidle0 > 15s) | Retry with domcontentloaded on timeout |

## Ad Banners

| URL | Issue | Fix |
|-----|-------|-----|
| `https://www.androidauthority.com/google-sideloading-android-high-friction-process-3633468/` | 2 banner ads, empty ad placeholder gaps | puppeteer-extra-plugin-adblocker + collapse empty min-height divs via JS |
| `https://www.sciencealert.com/scientists-identify-brain-waves-that-define-the-limits-of-you` | Top ad banner | puppeteer-extra-plugin-adblocker |
| `https://www.windowscentral.com/microsoft/windows-11/windows-11-second-emergency-out-of-band-update-kb5078127-released-address-outlook-bugs` | DFP leaderboard ads, missing article (JS-heavy) | CSS selectors for .dfp-leaderboard-container, [id^="bordeaux-"], wait for article element |

## Consent/Cookie Popups

| URL | Issue | Fix |
|-----|-------|-----|
| `https://boginjr.com/it/sw/dev/vinyl-boot/` | CookieYes "we value your privacy" popup | CSS selectors for [class^="cky-"], [id^="cky-"] |
| `https://newsroom.porsche.com/en/2026/company/porsche-deliveries-2025-41516.html` | Usercentrics cookie settings popup (shadow DOM) | CSS + JS to hide uc-* custom elements |

## Bot Protection

| URL | Issue | Fix |
|-----|-------|-----|
| `https://www.latimes.com/california/story/2026-01-09/california-has-no-areas-of-dryness-first-time-in-25-years` | Access denied, then legal terms popup | puppeteer-extra-plugin-stealth + CSS for modality-custom-element |
| `https://openai.com/index/unrolling-the-codex-agent-loop/` | Cloudflare verification button | puppeteer-extra-plugin-stealth |
| `https://www.reuters.com/legal/transactional/capital-one-buy-fintech-firm-brex-515-billion-deal-2026-01-22/` | "Validation required" - aggressive bot protection | Detect via content check, fall back to generated image with favicon |

## Consent Platforms Supported (CSS Selectors)

- **OneTrust**: `#onetrust-consent-sdk`, `#onetrust-banner-sdk`
- **Quantcast Choice**: `.qc-cmp2-container`
- **Cookiebot/Cybot**: `#CybotCookiebotDialog`
- **TrustArc/TRUSTe**: `.truste_overlay`, `.truste_box_overlay`
- **Osano**: `.osano-cm-window`
- **Didomi**: `#didomi-host`
- **Cookie Consent (Insites)**: `.cc-window`
- **SourcePoint**: `#sp_message_container`
- **CookieYes**: `[class^="cky-"]`, `[id^="cky-"]`
- **Usercentrics**: `#usercentrics-root`, `[class^="uc-"]`, `uc-*` custom elements (JS)
- **Termly**: `[class^="termly-"]`, `[id^="termly-"]`
- **iubenda**: `#iubenda-cs-banner`, `[class^="iubenda-"]`
- **Klaro**: `.klaro`, `#klaro`
- **Complianz**: `[class^="cmplz-"]`, `[id^="cmplz-"]`
- **Cookie Notice**: `#cookie-notice`, `[class^="cookie-notice"]`
- **Borlabs Cookie**: `.BorlabsCookie`, `#BorlabsCookieBox`
- **Axeptio**: `[id^="axeptio_"]`, `[class^="axeptio-"]`
- **Cookie Script**: `[id^="cookiescript_"]`, `[class^="cookiescript_"]`
- **Consentmanager.net**: `#cmpbox`, `[class^="cmpbox"]`
- **LiveRamp/Evidon**: `[class^="evidon-"]`, `[id^="evidon-"]`
- **Modality (latimes.com)**: `modality-custom-element`, `[id^="modality-"]`
- **Generic patterns**: `[class^="gdpr-"]`, `[class*="cookie-banner"]`, `[class*="cookie-consent"]`

## Bot Protection Detection

Pages are detected as bot-protected if:
- Body text < 200 characters, OR
- Contains keywords: "verifying", "validation required", "access denied", "please wait", "checking your browser", "just a moment", "enable javascript", "ray id"

When detected, falls back to generated image with:
- Site favicon (via Google favicon service)
- Story title
- Source domain
