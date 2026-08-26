# Test Infrastructure Specification: Mobinet Retail

## 1. Executive Summary & Overview
This document specifies the end-to-end (E2E) testing infrastructure, 4-tier verification architecture, feature test map, and deterministic pass/fail criteria for the Mobinet Retail continuous-world showroom landing page.

The testing suite is implemented as a standalone, zero-flakiness Playwright test runner in `lab/e2e_test.js` executed via Node.js against the local live runtime (`http://localhost:4500`).

---

## 2. 4-Tier Test Architecture

```
+-------------------------------------------------------------------------------+
|                       Mobinet Retail E2E Test Suite                           |
+-------------------------------------------------------------------------------+
| Tier 1: Feature Coverage & DOM Asset Inventory                                |
|   - 6 Video segments (data-sc-segment, weights, linger attributes)             |
|   - 6 Decoded WebP poster assets (p1.webp - p6.webp, dimensions > 0)          |
|   - 6 Windowed copy blocks (hero, 0.18-0.38, 0.42-0.62, 0.66-0.78, 0.8-0.9, fin)|
|   - Navigation header, 4 waypoints, and site CTA (.site-cta)                  |
|   - 3 Haptic cards (Phones, Laptops, Audio) & 4 Trust items                   |
|   - Finale CTA (.close-cta) and brand footer (.wf-foot)                       |
+-------------------------------------------------------------------------------+
| Tier 2: Boundary & Corner Cases                                               |
|   - Initial top-of-page hero state (scroll = 0, Seg 1 op = 1, Hero op = 1)   |
|   - Deep scroll finale state (scroll = 100%, Seg 6 op = 1, Finale op = 1)     |
|   - Fast scroll flick stress testing (rapid jumps, 0 exceptions, clean settle)|
|   - Scroll reversal monotonicity (0% -> 50% -> 25% -> 0% clean restoration)   |
|   - Reduced motion media query (prefers-reduced-motion: reduce fallbacks)     |
+-------------------------------------------------------------------------------+
| Tier 3: Cross-Feature Combinations & Interactive Runtime                      |
|   - Desktop progressive scroll lifecycle (0%, 25%, 50%, 72%, 85%, 100%)       |
|   - Video segment activation & copy opacity crossfade synchronization         |
|   - Monotonic progress bar scaleX tracking across scroll milestones           |
|   - Haptic cursor field physics simulation (--hx/--hy, 3D tilt, clean reset)  |
+-------------------------------------------------------------------------------+
| Tier 4: Mobile Viewport & Accessibility Verification                          |
|   - 4 Viewport matrix: 390x844, 375x667, 412x915, 360x740                    |
|   - Zero horizontal overflow (scrollWidth <= clientWidth across all stops)   |
|   - Bounding box containment (all UI elements within [0, viewportWidth])      |
|   - Headline line-wrap constraint (<= 2-3 lines max across mobile devices)    |
|   - Touch target ergonomics (>= 44x44px or >= 44px height on tap targets)     |
|   - WCAG AA/AAA Color Contrast (>= 4.5:1 body, >= 3:1 display, >= 4.5:1 CTA)  |
|   - Server health invariant (0 console errors, 0 page errors, 0 asset 404s)   |
+-------------------------------------------------------------------------------+
```

---

## 3. Feature Inventory Test Map

| Feature # | Feature Name | Source Spec | Test Tier | Test Suite ID | Assertion & Validation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | VideoFX Context & Auth | ORIGINAL_REQUEST §R1 | Tier 1 | `1.1` | Verify runner execution environment and context availability. |
| **F-02** | 6-Leg Sequence Automation | ORIGINAL_REQUEST §R1 | Tier 1 | `1.1` | Verify 6 distinct `[data-sc-segment]` DOM nodes with weights and lingermap. |
| **F-03** | Automated Asset Download | ORIGINAL_REQUEST §R1 | Tier 1 | `1.2` | Verify all 6 poster image assets exist, decode cleanly, and have non-zero resolution. |
| **F-04** | Desktop 1080p Video Encode | ORIGINAL_REQUEST §R2 | Tier 1 | `1.1` | Check `data-sc-src` bindings and container configurations. |
| **F-05** | Mobile 720p Video Encode | ORIGINAL_REQUEST §R2 | Tier 1 | `1.1` | Check `data-sc-src-mobile` attribute compliance. |
| **F-06** | Audio Stripping & Moov Opt | ORIGINAL_REQUEST §R2 | Tier 4 | `4.5` | Verify fast asset streaming and zero media playback errors. |
| **F-07** | WebP Poster Extraction | ORIGINAL_REQUEST §R2 | Tier 1 | `1.2` | Verify `assets/p1.webp` through `assets/p6.webp` naturalWidth > 0 and complete. |
| **F-08** | Seam Chaining Extraction | ORIGINAL_REQUEST §R2 | Tier 3 | `3.1` | Verify smooth segment opacity transitions without blank stage flashes. |
| **F-09** | Mobile Viewport Layout (DEF-01) | ORIGINAL_REQUEST §R3 | Tier 4 | `4.1, 4.2` | Verify `scrollWidth <= clientWidth` and `[0, width]` bounding containment. |
| **F-10** | Header Touch Targets (DEF-02) | ORIGINAL_REQUEST §R3 | Tier 4 | `4.4` | Verify `.site-mark` and `.site-cta` dimensions meet $\ge 44\text{px}$ touch targets. |
| **F-11** | Media Query Breakpoints (DEF-03)| ORIGINAL_REQUEST §R3 | Tier 4 | `4.1-4.4` | Viewport testing at 390x844, 375x667, 412x915, 360x740. |
| **F-12** | Touch Target Compliance (DEF-04)| ORIGINAL_REQUEST §R3 | Tier 4 | `4.4` | Verify `.trust-item`, `.haptic-card`, `.close-cta` tap areas $\ge 44\text{px}$. |
| **F-13** | Localized Scrims & Contrast (DEF-05)| ORIGINAL_REQUEST §R3 | Tier 4 | `4.6` | WCAG contrast evaluation ($\ge 4.5:1$ body, $\ge 3:1$ display, $\ge 4.5:1$ CTA). |
| **F-14** | Mobile Product Ergonomics (DEF-06)| ORIGINAL_REQUEST §R3 | Tier 4 | `4.2, 4.3` | Verify no card overlap and headline wrapping $\le 3$ lines. |
| **F-15** | Touch Lerp Physics (DEF-07) | ORIGINAL_REQUEST §R3 | Tier 2, 3 | `2.3, 3.1` | Rapid scroll flick stability and monotonic progressive scroll tracking. |
| **F-16** | Worldflight Media Mounting | ORIGINAL_REQUEST §R4 | Tier 1 | `1.1` | Check all 6 segments mounted simultaneously in `[data-sc-world]`. |
| **F-17** | Visible-Life Lerp Scrub | ORIGINAL_REQUEST §R4 | Tier 3 | `3.1, 3.3` | Verify playhead seeking and progress indicator correlation with scroll progress. |
| **F-18** | Seamless Video Crossfades | ORIGINAL_REQUEST §R4 | Tier 3 | `3.1` | Verify smoothstep crossfade opacity curves between consecutive segments. |
| **F-19** | Reduced Motion Fallbacks | ORIGINAL_REQUEST §R4 | Tier 2 | `2.5` | Emulate `prefers-reduced-motion: reduce`, verify posters stay visible, transforms neutral. |
| **F-20** | Opaque-Box E2E Suite | ORIGINAL_REQUEST §AC | Tiers 1-4 | `All` | Standalone `lab/e2e_test.js` runner with 174 automated assertions. |
| **F-21** | Boundary & Stress Hardening | ORIGINAL_REQUEST §AC | Tier 2 | `2.3, 2.4` | Rapid scroll flick jumps and forward/reverse monotonicity cycles. |
| **F-22** | Production Health & Git Sync | ORIGINAL_REQUEST §AC | Tier 4 | `4.5` | 0 console errors, 0 page errors, 0 asset 404s on `http://localhost:4500`. |

---

## 4. Pass/Fail Criteria & Technical Invariants

### Invariant 1: Zero Horizontal Overflow
- **Criterion**: On all viewports (desktop 1440x900 and mobile 390x844, 375x667, 412x915, 360x740), `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and `document.body.scrollWidth <= document.body.clientWidth`.
- **Validation**: Evaluated across 5 scroll positions (0%, 25%, 50%, 75%, 100%).

### Invariant 2: Bounding Box Containment
- **Criterion**: All interactive elements, navigation bars, display headings, body copy, and cards must remain within viewport coordinate bounds:
  $$\text{rect.left} \ge -2\text{px} \quad \text{and} \quad \text{rect.right} \le \text{viewportWidth} + 2\text{px}$$
- **Validation**: Evaluated for `.site-bar`, `.site-mark`, `.site-cta`, `.wf-copy`, `.wf-hero-headline`, `.wf-section-head`, `.wf-body`, `.haptic-card`, `.trust-item`, `.close-cta`.

### Invariant 3: Headline Line-Wrapping Constraint
- **Criterion**: Display headings on mobile viewports must wrap cleanly into $\le 2\text{–}3$ lines without spilling or fragmenting:
  $$\text{lines} = \text{round}\left(\frac{\text{height}}{\text{lineHeight}}\right) \le 3$$

### Invariant 4: WCAG AA/AAA Text Contrast Compliance
- **Criterion**: Relative luminance contrast ratio $C = \frac{L_1 + 0.05}{L_2 + 0.05}$:
  - Body text (`--sc-ink-soft` / `--sc-ink`): $C \ge 4.5:1$ against canvas/scrim backdrop.
  - Display headings: $C \ge 3.0:1$ against canvas/scrim backdrop.
  - Interactive CTAs (`.site-cta`, `.close-cta`): $C \ge 4.5:1$ between button ink and accent background.

### Invariant 5: Touch Target Ergonomics
- **Criterion**: Interactive tap targets (`.site-cta`, `.site-mark`, `.trust-item`, `.haptic-card`, `.close-cta`) must meet mobile tap ergonomics ($\ge 44\times 44\text{px}$ or $\ge 44\text{px}$ effective height).

### Invariant 6: Server Health & Zero Defects
- **Criterion**: During all page interactions, scrolling cycles, and viewport resizes:
  - 0 uncaught console errors (`console.error`).
  - 0 unhandled page exceptions (`pageerror`).
  - 0 HTTP 4xx or 5xx network response status codes for scripts, stylesheets, posters, and fonts.
