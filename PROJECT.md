# Project: Mobinet Retail Overhaul

## Architecture
- **Paradigm**: Scrollcraft Continuous World (`worldflight` grammar, Nocturne-showroom world grade).
- **Core Runtime Components**:
  - Fixed Viewport Stage (`.sc-world` / `[data-sc-world]`, `position: fixed; inset: 0;`).
  - Document-Flow Spacer (`[data-sc-spacer]` sized dynamically to $(\sum w + 1) \times \text{vh} = 700\text{vh}$).
  - Fixed Copy Overlay (`[data-sc-world-copy]` with 6 windowed blocks mapped to track progress $pr \in [0, 1]$).
  - Continuous Media Segments (6 legs mounted as `<video>` elements in `.sc-segment` containers).
  - Non-linear lerp scrub playhead engine (`scrollcraft.js`) with dynamic dwell easing (`lingerEase`) and zero DOM destruction.
  - Haptic cursor field physics overlay.
- **Asset Pipeline**:
  - Google VideoFX Playwright automation bot generating 6 seamless camera-move legs.
  - FFmpeg dense GOP transcoding (`-g 8` desktop 1080p, `-g 4` mobile 720p, audio stripping `-an`, faststart moov).
  - High-quality WebP first-frame posters and sub-frame seam chaining frames.
- **Mobile Responsive Engine**:
  - Unbroken mobile layout down to 360px viewport width (390x844, 375x667, 412x915).
  - Fluid typography clamp scaling and zero horizontal overflow.
  - Safe-area inset handling and accessible touch targets ($\ge 44\times 44\text{px}$).
  - Localized gradient scrims ensuring WCAG AAA/AA contrast ($\ge 4.5:1$ body, $\ge 3:1$ display).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | VideoFX Bot Context & Auth Stealth | Launches Playwright with persistent storage and stealth headers | M1 | ORIGINAL_REQUEST §R1 |
| 2 | VideoFX 6-Leg Sequence Automation | Automated generation of 6 camera-move clips with Nocturne preamble | M1 | ORIGINAL_REQUEST §R1, BRIEF.md |
| 3 | Automated Asset Download & Fallback | Polling, download interception, error handling, offline mock fallback | M1 | ORIGINAL_REQUEST §R1 |
| 4 | FFmpeg Desktop 1080p Dense GOP Encode | Transcodes to 1080p with `-g 8 -keyint_min 8 -crf 20 -movflags +faststart` | M1 | ORIGINAL_REQUEST §R2 |
| 5 | FFmpeg Mobile 720p Dense GOP Encode | Transcodes to 720p with `-g 4 -keyint_min 4 -crf 24 -movflags +faststart` | M1 | ORIGINAL_REQUEST §R2 |
| 6 | FFmpeg Audio Stripping & Container Opt | Mandatory `-an` audio removal and faststart moov placement | M1 | ORIGINAL_REQUEST §R2 |
| 7 | WebP First-Frame Poster Extraction | Frame-accurate WebP poster extraction from final encoded MP4s | M1 | ORIGINAL_REQUEST §R2 |
| 8 | Sub-Frame Seam Chaining Extraction | Extracts terminal anchor frames (`-sseof -0.15`) for visual continuity | M1 | ORIGINAL_REQUEST §R2, BRIEF.md |
| 9 | Mobile Viewport Layout Fixes (DEF-01) | Fixes `.sc-copy--center` & `.sc-copy--trail` left/right overflow | M2 | ORIGINAL_REQUEST §R3, AC |
| 10 | Header Touch Targets & Safe Areas (DEF-02) | $\ge 44\text{px}$ touch targets on `.site-mark` and `.site-cta`, `env(safe-area-inset-top)` | M2 | ORIGINAL_REQUEST §R3, AC |
| 11 | Media Query Breakpoint Unification (DEF-03) | Synchronizes `@media (max-width: 860px)` and `@media (max-width: 700px)` | M2 | ORIGINAL_REQUEST §R3 |
| 12 | Touch Target Compliance $\ge 44\text{px}$ (DEF-04) | Expands `.trust-item` chips and interaction targets to $\ge 44\times 44\text{px}$ | M2 | ORIGINAL_REQUEST §R3, AC |
| 13 | Localized Gradient Scrims & Contrast (DEF-05) | Upgrades `--sc-ink-soft` and adds gradient scrims ensuring $\ge 4.5:1$ contrast | M2 | ORIGINAL_REQUEST §R3, AC |
| 14 | Mobile Product Cards & Trust Ergonomics (DEF-06) | Compact horizontal snap-rail / ergonomic grid for cards, preventing vertical screen crowding | M2 | ORIGINAL_REQUEST §R3 |
| 15 | Mobile Touch Lerp Physics Tuning (DEF-07) | Optimizes `data-sc-lerp` for mobile finger tracking and deadband thresholds | M2 | ORIGINAL_REQUEST §R3 |
| 16 | Worldflight Video Elements Mounting | Mounts `<video data-sc-src="..." data-sc-src-mobile="..." muted playsinline>` in all 6 segments | M3 | ORIGINAL_REQUEST §R4 |
| 17 | Visible-Life Lerp Scrub Mapping | Video playhead seeking synchronized with normalized segment progress | M3 | ORIGINAL_REQUEST §R4 |
| 18 | Seamless Video Crossfades & Compositing | Smoothstep crossfading between consecutive video segments without dark flashes | M3 | ORIGINAL_REQUEST §R4 |
| 19 | Reduced Motion Poster Fallbacks | Poster fallback mode for users with `prefers-reduced-motion: reduce` | M3 | ORIGINAL_REQUEST §R4 |
| 20 | Opaque-Box E2E Playwright Suite (Tiers 1-4) | Comprehensive test suite verifying all features, boundary cases, mobile viewports, contrast, server | M4 | ORIGINAL_REQUEST §AC |
| 21 | Adversarial Hardening (Tier 5) | White-box stress testing, video seek lag benchmarks, and extreme viewport audits | M4 | ORIGINAL_REQUEST §AC |
| 22 | Git Sync & Production Verification | Verification against `http://localhost:4500`, zero console errors, clean git sync | M4 | ORIGINAL_REQUEST §AC |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| **E2E** | E2E Testing Track | Requirement-driven opaque-box test suite (Tiers 1–4), `TEST_READY.md` | Survey | **DONE** |
| **M1** | VideoFX Automation & FFmpeg Encoding Pipeline | Features 1–8: `lab/videofx_pipeline.js`, FFmpeg encoding script, 6 video legs + posters | Survey | **DONE** |
| **M2** | Mobile Viewport, Touch Physics & Scrim Overhaul | Features 9–15: `scrollcraft.css`, `index.html` responsive typography, scrims, touch targets | Survey | **DONE** |
| **M3** | Worldflight Video Scrubbing & Runtime Integration | Features 16–19: `index.html`, `scrollcraft.js` video mounting, crossfading, fallbacks | M1, M2 | **DONE** |
| **M4** | Final E2E Pass, Adversarial Hardening & Git Sync | Features 20–22: 100% E2E test pass across viewports, Tier 5 hardening, git sync | E2E, M3 | **DONE** |

## Interface Contracts

### Media Pipeline ↔ Runtime DOM (`index.html`)
- **Asset Paths**:
  - Desktop 1080p MP4: `assets/leg{1..6}.mp4` (H.264, GOP 8, CRF 20, faststart, no audio).
  - Mobile 720p MP4: `assets/leg{1..6}-m.mp4` (H.264, GOP 4, CRF 24, faststart, no audio).
  - WebP Posters: `assets/p{1..6}.webp` (Quality 82, first frame of encoded MP4).
- **DOM Specification**:
  ```html
  <div class="sc-segment sc-world__seg" data-sc-segment data-sc-weight="[w]" data-sc-linger="[L]">
    <div class="sc-segment__media">
      <video
        data-sc-src="assets/leg[N].mp4"
        data-sc-src-mobile="assets/leg[N]-m.mp4"
        poster="assets/p[N].webp"
        muted
        playsinline
        preload="none">
      </video>
    </div>
  </div>
  ```

### Mobile Layout & Styling Contracts (`scrollcraft.css` ↔ `index.html`)
- **Tokens**:
  - `--sc-ink-soft`: `#B4B7C0` (ensures $\ge 4.5:1$ contrast against dark/lit video frames).
  - `--sc-gutter`: `clamp(1rem, 4vw, 1.5rem)`.
  - Localized scrims: `background: linear-gradient(180deg, rgba(8,8,10,0.85) 0%, rgba(8,8,10,0.4) 70%, transparent 100%);` or radial backdrop.
- **Copy Positioning Rules**:
  - Mobile center copy must use `inset-inline: 0; left: 0; right: 0; width: 100%; translate: 0 0;` (preventing leftwards offset).
  - All interactive elements (`.site-cta`, `.site-mark`, `.trust-item`, `.close-cta`) have min dimensions $\ge 44\times 44\text{px}$.

## Code Layout
- `index.html` — Semantic markup, video segment elements, windowed copy overlays, inline style tokens.
- `scrollcraft.css` — Design tokens, layout floors, mobile media queries, gradient scrims, typography clamp.
- `scrollcraft.js` — Worldflight runtime, scroll lerping, video seeking, crossfades, safe-area listeners.
- `lab/videofx_pipeline.js` — Playwright VideoFX bot script.
- `lab/encode_all.sh` — FFmpeg batch dense-GOP encoding script.
- `lab/e2e_test.js` — Automated Playwright E2E verification test suite.
- `assets/` — Encoded MP4 video assets and WebP posters.
- `out/` — Intermediate frames and raw download captures.
