# Original User Request

## 2026-08-26T19:51:57Z

Overhaul the Mobinet Retail landing page by implementing automated Playwright bot flows to generate cinematic showroom camera clips via Google VideoFX / Labs, encoding them for fluid scroll scrubbing, and completely rectifying the mobile responsive layout, touch physics, and contrast hierarchy.

Working directory: `/home/robin/Documents/ObsidianVault/scrollcraft/builds/mobinet-retail`
Integrity mode: development

## Requirements

### R1. Google VideoFX Playwright Automation Pipeline
Build a Playwright browser automation script that logs into / interacts with Google VideoFX / Labs to generate the 6 showroom camera-move video clips described in `BRIEF.md`:
- Leg 1: Dark showroom entrance establishing dolly
- Leg 2: Display shelves product discovery drift
- Leg 3: Flagship phone internal circuits reveal (peak moment)
- Leg 4: Brand story alcove settle
- Leg 5: Trust and service guarantee panels drift
- Leg 6: Lit service counter arrival

### R2. Dense-GOP Video Encoding & Asset Optimization
Process generated video clips with FFmpeg using dense GOP structures (`-g 8` for desktop 1080p, `-g 4` for mobile 720p), stripping audio tracks and generating matching first-frame WebP posters and seam chaining frames.

### R3. Mobile Layout, Touch Smoothing & Scrim Overhaul
Completely redesign the mobile viewport experience (`@media (max-width: 700px)` down to 360px):
- Fix header navigation and CTA overflow on portrait screens.
- Implement responsive font scaling so display headings don't wrap onto 5+ lines.
- Refactor product cards and trust rows with proper touch targets and padding.
- Apply localized gradient scrims guaranteeing >= 4.5:1 contrast ratio without muddying the visual background.
- Ensure touch-tuned lerp and momentum scroll function smoothly on mobile browsers.

### R4. Worldflight Video Scrubbing Integration
Update `index.html` to mount the newly generated video clips into `data-sc-segment` nodes with full visible-life lerp scrub mapping, seamless crossfades, and poster fallbacks for reduced motion.

## Acceptance Criteria

### Automation & Asset Generation
- [ ] Playwright automation script reliably executes and produces 6 distinct MP4 video assets.
- [ ] FFmpeg encodes desktop and mobile video assets with dense keyframe intervals for instant frame seeking.

### Mobile Experience & Design
- [ ] Viewport renders cleanly at 390x844, 375x667, and 412x915 with zero horizontal overflow.
- [ ] Headline text scales responsively (max 2–3 balanced lines on mobile).
- [ ] All text passes accessibility contrast checks (>= 4.5:1 body, >= 3:1 display) across all scroll frames.
- [ ] Mobile navigation bar and CTA buttons remain accessible and unclipped.

### Verification & Quality Assurance
- [ ] Automated Playwright test script captures desktop and mobile scroll progression without errors.
- [ ] Site runs at `http://localhost:4500` with zero console errors or broken asset 404s.
- [ ] Code changes are committed and synced to git repository.
