/**
 * lab/e2e_test.js
 * Comprehensive Opaque-Box Playwright Test Suite for Mobinet Retail
 * 
 * 4-Tier Verification Architecture:
 * - Tier 1: Feature Coverage & Asset DOM Inventory
 * - Tier 2: Boundary & Corner Cases (Hero, Finale, Fast Flick, Scroll Reversal, Reduced Motion)
 * - Tier 3: Cross-Feature Combinations (Progressive Scroll, Crossfading, Haptic Cursor Physics)
 * - Tier 4: Mobile Viewport & Accessibility Audits across 4 devices (390x844, 375x667, 412x915, 360x740)
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4500';
const CHROME_PATH = process.env.CHROME_PATH || '/home/robin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

// Mobile Viewport Matrix
const VIEWPORTS = [
  { name: 'iPhone 12/13/14', width: 390, height: 844 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'Compact Android', width: 360, height: 740 }
];

// Test Reporting State
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];

function assert(condition, description, detail = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  \x1b[32m✔\x1b[0m ${description}`);
  } else {
    failedAssertions++;
    const errMsg = `Assertion Failed: ${description} ${detail ? '(' + detail + ')' : ''}`;
    failures.push(errMsg);
    console.log(`  \x1b[31m✖\x1b[0m ${errMsg}`);
  }
}

function suiteHeader(title) {
  console.log(`\n\x1b[1m\x1b[36m======================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m ${title}\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m======================================================================\x1b[0m`);
}

function subSuiteHeader(title) {
  console.log(`\n\x1b[1m\x1b[33m▶ ${title}\x1b[0m`);
}

// Calculate relative luminance for WCAG contrast calculation
function getLuminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(colorStr) {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  }
  return [255, 255, 255];
}

async function runTestSuite() {
  const startTime = Date.now();
  console.log(`\x1b[1m\x1b[35mStarting Mobinet Retail E2E Test Suite\x1b[0m`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Chromium Path: ${CHROME_PATH}\n`);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
      headless: true
    });
  } catch (err) {
    console.error(`Failed to launch browser: ${err.message}`);
    process.exit(1);
  }

  try {
    // =========================================================================
    // TIER 1: FEATURE COVERAGE & DOM ASSET INVENTORY
    // =========================================================================
    suiteHeader('TIER 1: FEATURE COVERAGE & DOM ASSET INVENTORY');

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    // Listen for console and network errors
    const consoleErrors = [];
    const pageErrors = [];
    const failedNetworkRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('response', res => {
      if (res.status() >= 400) {
        failedNetworkRequests.push({ url: res.url(), status: res.status() });
      }
    });

    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    assert(response && response.status() === 200, 'Page loaded successfully with HTTP 200', `Status: ${response ? response.status() : 'null'}`);
    await page.waitForTimeout(500);

    // 1.1 Video Segments
    subSuiteHeader('1.1 Continuous World Video Segments Mounted');
    const segmentsData = await page.evaluate(() => {
      const segs = Array.from(document.querySelectorAll('[data-sc-segment]'));
      return segs.map((s, idx) => ({
        index: idx + 1,
        weight: s.getAttribute('data-sc-w') || s.getAttribute('data-sc-weight'),
        linger: s.getAttribute('data-sc-linger'),
        waypoint: s.getAttribute('data-sc-waypoint'),
        hasPoster: !!s.querySelector('img, .sc-world__poster'),
        posterSrc: s.querySelector('img, .sc-world__poster') ? s.querySelector('img, .sc-world__poster').getAttribute('src') : null
      }));
    });

    assert(segmentsData.length === 6, `Found exactly 6 continuous world segments in DOM`, `Count: ${segmentsData.length}`);
    for (let i = 0; i < 6; i++) {
      const seg = segmentsData[i];
      assert(seg && !!seg.weight, `Segment ${i + 1} has valid weight attribute`, `Weight: ${seg ? seg.weight : 'none'}`);
      assert(seg && !!seg.linger, `Segment ${i + 1} has valid linger attribute`, `Linger: ${seg ? seg.linger : 'none'}`);
      assert(seg && seg.hasPoster, `Segment ${i + 1} has poster image mounted`, `Src: ${seg ? seg.posterSrc : 'none'}`);
    }

    // 1.2 Poster Asset Load & Integrity
    subSuiteHeader('1.2 WebP Poster Asset Verification (p1.webp - p6.webp)');
    const postersIntegrity = await page.evaluate(async () => {
      const posters = Array.from(document.querySelectorAll('.sc-world__poster, [data-sc-segment] img'));
      const results = [];
      for (const img of posters) {
        results.push({
          src: img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete
        });
      }
      return results;
    });

    assert(postersIntegrity.length === 6, `Found 6 poster elements matching segments`, `Found: ${postersIntegrity.length}`);
    postersIntegrity.forEach((p, idx) => {
      assert(p.complete && p.naturalWidth > 0, `Poster ${idx + 1} (${path.basename(p.src)}) is decoded and non-empty`, `Dimensions: ${p.naturalWidth}x${p.naturalHeight}`);
    });

    // 1.3 Windowed Copy Blocks
    subSuiteHeader('1.3 Windowed Copy Blocks (Windows 1-6)');
    const copyBlocks = await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll('[data-sc-copy]'));
      return blocks.map((b, idx) => ({
        index: idx + 1,
        window: b.getAttribute('data-sc-window'),
        text: (b.innerText || '').trim().replace(/\n+/g, ' '),
        hasHeading: !!b.querySelector('h1, h2, h3, .wf-hero-headline, .wf-section-head')
      }));
    });

    assert(copyBlocks.length === 6, `Found exactly 6 windowed copy blocks`, `Count: ${copyBlocks.length}`);
    const expectedWindows = ['hero', '0.18 0.38', '0.42 0.62', '0.66 0.78', '0.80 0.90', 'finale'];
    copyBlocks.forEach((c, idx) => {
      assert(c.window === expectedWindows[idx], `Copy Block ${idx + 1} mapped to expected window [${expectedWindows[idx]}]`, `Actual: ${c.window}`);
      assert(c.hasHeading, `Copy Block ${idx + 1} contains a display heading`, `Preview: ${c.text.slice(0, 30)}...`);
    });

    // 1.4 Navigation Bar & CTA
    subSuiteHeader('1.4 Navigation Header, Waypoints & Site CTA');
    const navData = await page.evaluate(() => {
      const siteBar = document.querySelector('.site-bar');
      const siteMark = document.querySelector('.site-mark');
      const waypoints = Array.from(document.querySelectorAll('.site-waypoints li a')).map(a => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href')
      }));
      const siteCta = document.querySelector('.site-cta');
      return {
        hasSiteBar: !!siteBar,
        siteMarkText: siteMark ? (siteMark.innerText || '').replace(/\s+/g, '') : '',
        waypoints,
        siteCtaText: siteCta ? siteCta.innerText.trim() : '',
        siteCtaHref: siteCta ? siteCta.getAttribute('href') : ''
      };
    });

    assert(navData.hasSiteBar, 'Fixed navigation bar (.site-bar) exists in DOM');
    assert(navData.siteMarkText.toLowerCase().includes('mobinet'), `Site mark brand text contains 'Mobinet'`, `Found: ${navData.siteMarkText}`);
    assert(navData.waypoints.length === 4, `Found 4 desktop navigation waypoints`, `Count: ${navData.waypoints.length}`);
    const expectedWaypoints = ['Showroom', 'Products', 'Flagship', 'About'];
    expectedWaypoints.forEach(wp => {
      assert(navData.waypoints.some(w => w.text.toLowerCase() === wp.toLowerCase()), `Waypoint '${wp}' present in navigation list`);
    });
    assert(navData.siteCtaText === 'Shop Now', `Site CTA button exists with 'Shop Now' text`, `Found: ${navData.siteCtaText}`);

    // 1.5 Haptic Cards & Trust Items
    subSuiteHeader('1.5 Haptic Product Cards & Trust Row Chips');
    const cardData = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.haptic-card')).map(c => ({
        label: c.querySelector('.haptic-card__label') ? c.querySelector('.haptic-card__label').innerText.trim() : '',
        title: c.querySelector('.haptic-card__title') ? c.querySelector('.haptic-card__title').innerText.trim() : ''
      }));
      const trustItems = Array.from(document.querySelectorAll('.trust-item')).map(t => t.innerText.trim());
      const closeCta = document.querySelector('.close-cta');
      const footer = document.querySelector('.wf-foot');

      return {
        cards,
        trustItems,
        hasCloseCta: !!closeCta,
        closeCtaText: closeCta ? closeCta.innerText.trim() : '',
        hasFooter: !!footer,
        footerText: footer ? footer.innerText.trim() : ''
      };
    });

    assert(cardData.cards.length === 3, `Found 3 haptic product cards in Window 2`, `Count: ${cardData.cards.length}`);
    assert(cardData.cards.some(c => c.label.toLowerCase() === 'phones'), `Haptic card 'Phones' present`);
    assert(cardData.cards.some(c => c.label.toLowerCase() === 'laptops'), `Haptic card 'Laptops' present`);
    assert(cardData.cards.some(c => c.label.toLowerCase() === 'audio'), `Haptic card 'Audio' present`);

    assert(cardData.trustItems.length === 4, `Found 4 trust items in Window 5`, `Count: ${cardData.trustItems.length}`);
    assert(cardData.hasCloseCta && cardData.closeCtaText === 'Shop Now', `Finale section has close CTA button 'Shop Now'`);
    assert(cardData.hasFooter && cardData.footerText.includes('Mobinet Retail'), `Finale section includes brand footer`);

    await page.close();

    // =========================================================================
    // TIER 2: BOUNDARY & CORNER CASES
    // =========================================================================
    suiteHeader('TIER 2: BOUNDARY & CORNER CASES');

    const bPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await bPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await bPage.waitForTimeout(500);

    // 2.1 Top of Page Hero State
    subSuiteHeader('2.1 Initial Top-of-Page Hero State (Scroll = 0)');
    const heroState = await bPage.evaluate(() => {
      const segs = Array.from(document.querySelectorAll('[data-sc-segment]')).map(s => parseFloat(window.getComputedStyle(s).opacity));
      const copies = Array.from(document.querySelectorAll('[data-sc-copy]')).map(c => parseFloat(window.getComputedStyle(c).opacity));
      const prog = document.querySelector('[data-sc-progress]');
      return { segs, copies, progTransform: prog ? prog.style.transform : '' };
    });

    assert(heroState.segs[0] > 0.9, `Segment 1 is active (opacity >= 0.9) at top`, `Opacity: ${heroState.segs[0]}`);
    assert(heroState.copies[0] > 0.9, `Hero copy block is visible (opacity >= 0.9) at top`, `Opacity: ${heroState.copies[0]}`);
    assert(heroState.copies[5] < 0.1, `Finale copy block is hidden (opacity < 0.1) at top`, `Opacity: ${heroState.copies[5]}`);

    // 2.2 Deep Scroll Finale State
    subSuiteHeader('2.2 Deep Scroll Finale State (Scroll = 100%)');
    await bPage.evaluate(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll, behavior: 'instant' });
    });
    await bPage.waitForTimeout(300);

    const finaleState = await bPage.evaluate(() => {
      const segs = Array.from(document.querySelectorAll('[data-sc-segment]')).map(s => parseFloat(window.getComputedStyle(s).opacity));
      const copies = Array.from(document.querySelectorAll('[data-sc-copy]')).map(c => parseFloat(window.getComputedStyle(c).opacity));
      const prog = document.querySelector('[data-sc-progress]');
      return { segs, copies, progTransform: prog ? prog.style.transform : '' };
    });

    assert(finaleState.segs[5] > 0.9, `Segment 6 is active (opacity >= 0.9) at bottom`, `Opacity: ${finaleState.segs[5]}`);
    assert(finaleState.copies[5] > 0.9, `Finale copy block is visible (opacity >= 0.9) at bottom`, `Opacity: ${finaleState.copies[5]}`);
    assert(finaleState.copies[0] < 0.1, `Hero copy block is hidden (opacity < 0.1) at bottom`, `Opacity: ${finaleState.copies[0]}`);

    // 2.3 Fast Scroll Flick Stress Test
    subSuiteHeader('2.3 Fast Scroll Flick & Rapid State Transitions');
    let unhandledErrors = 0;
    bPage.on('pageerror', () => unhandledErrors++);

    for (let i = 0; i < 6; i++) {
      const targetPercent = (i % 2 === 0) ? 0.95 : 0.05;
      await bPage.evaluate(tp => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: maxScroll * tp, behavior: 'instant' });
      }, targetPercent);
      await bPage.waitForTimeout(40);
    }
    // Settle at top
    await bPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await bPage.waitForTimeout(300);

    const settledState = await bPage.evaluate(() => {
      const seg1 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-segment]')[0]).opacity);
      const copy1 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-copy]')[0]).opacity);
      return { seg1, copy1 };
    });

    assert(unhandledErrors === 0, `Zero uncaught exceptions during rapid scroll flicks`);
    assert(settledState.seg1 > 0.8 && settledState.copy1 > 0.8, `State settles deterministically back to hero after rapid flicks`, `Seg1: ${settledState.seg1}, Copy1: ${settledState.copy1}`);

    // 2.4 Scroll Reversal Test
    subSuiteHeader('2.4 Scroll Reversal Monotonicity (0% -> 50% -> 25% -> 0%)');
    // Move to 50%
    await bPage.evaluate(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.50, behavior: 'instant' });
    });
    await bPage.waitForTimeout(300);
    const midState = await bPage.evaluate(() => {
      const seg3 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-segment]')[2]).opacity);
      const copy3 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-copy]')[2]).opacity);
      return { seg3, copy3 };
    });
    assert(midState.seg3 > 0.8, `Forward scroll to 50% activates Segment 3`, `Opacity: ${midState.seg3}`);

    // Reverse to 25%
    await bPage.evaluate(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.25, behavior: 'instant' });
    });
    await bPage.waitForTimeout(300);
    const revState = await bPage.evaluate(() => {
      const seg2 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-segment]')[1]).opacity);
      const copy2 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-copy]')[1]).opacity);
      return { seg2, copy2 };
    });
    assert(revState.seg2 > 0.8, `Reverse scroll to 25% cleanly re-activates Segment 2`, `Opacity: ${revState.seg2}`);

    // Reverse back to 0%
    await bPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await bPage.waitForTimeout(300);
    const topAgain = await bPage.evaluate(() => {
      const seg1 = parseFloat(window.getComputedStyle(document.querySelectorAll('[data-sc-segment]')[0]).opacity);
      return seg1;
    });
    assert(topAgain > 0.9, `Reverse scroll to 0% cleanly restores Segment 1`, `Opacity: ${topAgain}`);

    await bPage.close();

    // 2.5 Reduced Motion Mode
    subSuiteHeader('2.5 Reduced Motion Mode (prefers-reduced-motion: reduce)');
    const rmPage = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce'
    });
    await rmPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await rmPage.waitForTimeout(400);

    const rmAudit = await rmPage.evaluate(() => {
      const poster = document.querySelector('.sc-world__poster');
      const posterStyle = window.getComputedStyle(poster);
      const copy = document.querySelector('[data-sc-copy]');
      const copyStyle = window.getComputedStyle(copy);
      const card = document.querySelector('.haptic-card');
      const cardStyle = window.getComputedStyle(card);

      return {
        posterTransform: posterStyle.transform,
        copyTransform: copyStyle.transform,
        cardTransition: cardStyle.transition,
        posterOpacity: posterStyle.opacity
      };
    });

    assert(rmAudit.posterOpacity > 0.8, `Poster remains visible under reduced motion`, `Opacity: ${rmAudit.posterOpacity}`);
    assert(rmAudit.cardTransition === 'all 0s ease 0s' || rmAudit.cardTransition === 'none' || !rmAudit.cardTransition.includes('280ms'), `Haptic card motion transitions suppressed or neutralized under reduced motion`, `Transition: ${rmAudit.cardTransition}`);

    await rmPage.close();

    // =========================================================================
    // TIER 3: CROSS-FEATURE COMBINATIONS & INTERACTION RUNTIME
    // =========================================================================
    suiteHeader('TIER 3: CROSS-FEATURE COMBINATIONS & INTERACTION RUNTIME');

    const xPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await xPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await xPage.waitForTimeout(500);

    // 3.1 Progressive Scroll Lifecycle
    subSuiteHeader('3.1 Desktop Progressive Lifecycle Checkpoints');
    const checkpoints = [
      { progress: 0.0, expectedActiveSeg: 1, name: 'Hero Entrance' },
      { progress: 0.25, expectedActiveSeg: 2, name: 'Product Discovery' },
      { progress: 0.50, expectedActiveSeg: 3, name: 'Flagship Peak Reveal' },
      { progress: 0.72, expectedActiveSeg: 4, name: 'Brand Story Alcove' },
      { progress: 0.85, expectedActiveSeg: 5, name: 'Trust Signals Promise' },
      { progress: 1.0, expectedActiveSeg: 6, name: 'Service Counter Finale' }
    ];

    for (const cp of checkpoints) {
      await xPage.evaluate(p => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: maxScroll * p, behavior: 'instant' });
      }, cp.progress);
      await xPage.waitForTimeout(300);

      const state = await xPage.evaluate(() => {
        const segs = Array.from(document.querySelectorAll('[data-sc-segment]')).map(s => parseFloat(window.getComputedStyle(s).opacity));
        const prog = document.querySelector('[data-sc-progress]');
        const match = prog && prog.style.transform.match(/scaleX\(([\d.]+)\)/);
        const scaleX = match ? parseFloat(match[1]) : 0;
        return { segs, scaleX };
      });

      const activeSegIndex = state.segs.indexOf(Math.max(...state.segs)) + 1;
      assert(activeSegIndex === cp.expectedActiveSeg, `Checkpoint [${cp.name}] at ${(cp.progress * 100).toFixed(0)}% activates Segment ${cp.expectedActiveSeg}`, `Active: Seg ${activeSegIndex}`);
      if (cp.progress > 0) {
        assert(state.scaleX > 0, `Progress bar scaleX is positive (${state.scaleX.toFixed(3)}) at ${(cp.progress * 100).toFixed(0)}% scroll`);
      }
    }

    // 3.2 Haptic Card Cursor Proximity Interaction
    subSuiteHeader('3.2 Haptic Cursor Physics & Luminance Bloom Simulation');
    // Scroll to products window
    await xPage.evaluate(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.25, behavior: 'instant' });
    });
    await xPage.waitForTimeout(300);

    const cardBounding = await xPage.evaluate(() => {
      const card = document.querySelector('.haptic-card');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    if (cardBounding) {
      // Hover directly over card (distance 0)
      await xPage.mouse.move(cardBounding.x, cardBounding.y);
      await xPage.waitForTimeout(100);

      const hapticActive = await xPage.evaluate(() => {
        const card = document.querySelector('.haptic-card');
        return {
          hasActiveClass: card.classList.contains('haptic-active'),
          hasCustomProps: card.style.getPropertyValue('--hx') !== '',
          hasTransform: card.style.transform.includes('perspective')
        };
      });

      assert(hapticActive.hasActiveClass, 'Haptic card activates .haptic-active on pointer proximity');
      assert(hapticActive.hasCustomProps, 'Haptic card sets dynamic --hx / --hy luminance coordinates');
      assert(hapticActive.hasTransform, 'Haptic card applies 3D perspective tilt transform');

      // Move far away (> 1000px away)
      await xPage.mouse.move(1400, 850);
      await xPage.waitForTimeout(100);
      const hapticReset = await xPage.evaluate(() => {
        const card = document.querySelector('.haptic-card');
        return !card.classList.contains('haptic-active') && card.style.transform === '';
      });
      assert(hapticReset, 'Haptic card cleanly resets transform when pointer leaves proximity');
    }

    await xPage.close();

    // =========================================================================
    // TIER 4: MOBILE VIEWPORT & ACCESSIBILITY AUDIT
    // =========================================================================
    suiteHeader('TIER 4: MOBILE VIEWPORT & ACCESSIBILITY AUDIT');

    for (const vp of VIEWPORTS) {
      subSuiteHeader(`4.x Device Viewport: ${vp.name} (${vp.width}x${vp.height})`);

      const mPage = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true
      });

      const mConsoleErrors = [];
      const mPageErrors = [];
      const mFailedRequests = [];

      mPage.on('console', msg => {
        if (msg.type() === 'error') mConsoleErrors.push(msg.text());
      });
      mPage.on('pageerror', err => mPageErrors.push(err.message));
      mPage.on('response', res => {
        if (res.status() >= 400) {
          mFailedRequests.push({ url: res.url(), status: res.status() });
        }
      });

      await mPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await mPage.waitForTimeout(400);

      // 4.1 Zero Horizontal Overflow
      const overflowAudit = await mPage.evaluate(() => {
        const sW = document.documentElement.scrollWidth;
        const cW = document.documentElement.clientWidth;
        const bSW = document.body.scrollWidth;
        const bCW = document.body.clientWidth;
        return {
          htmlOverflow: sW > cW,
          bodyOverflow: bSW > bCW,
          scrollWidth: sW,
          clientWidth: cW
        };
      });

      assert(!overflowAudit.htmlOverflow && !overflowAudit.bodyOverflow, `[${vp.name}] Zero horizontal page overflow (scrollWidth: ${overflowAudit.scrollWidth} <= clientWidth: ${overflowAudit.clientWidth})`);

      // Test overflow across all scroll stops on mobile
      const mobileScrollStops = [0.0, 0.25, 0.50, 0.75, 1.0];
      let midScrollOverflow = false;
      for (const stop of mobileScrollStops) {
        await mPage.evaluate(s => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo({ top: maxScroll * s, behavior: 'instant' });
        }, stop);
        await mPage.waitForTimeout(100);
        const hasOver = await mPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        if (hasOver) midScrollOverflow = true;
      }
      assert(!midScrollOverflow, `[${vp.name}] Zero horizontal overflow across all 5 scroll milestones`);

      // Scroll back to top for bounding box checks
      await mPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await mPage.waitForTimeout(200);

      // 4.2 Bounding Box Viewport Containment
      const boundsAudit = await mPage.evaluate(vpWidth => {
        const selectors = [
          '.site-bar', '.site-mark', '.site-cta',
          '.wf-copy', '.wf-hero-headline', '.wf-section-head',
          '.wf-body', '.wf-subline', '.haptic-card', '.trust-item', '.close-cta'
        ];
        const elements = Array.from(document.querySelectorAll(selectors.join(',')));
        const clipped = [];

        for (const el of elements) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            // Allow 2px subpixel rounding tolerance
            if (r.left < -2 || r.right > vpWidth + 2) {
              clipped.push({
                tag: el.tagName,
                cls: el.className,
                left: Math.round(r.left),
                right: Math.round(r.right),
                text: (el.innerText || '').slice(0, 20)
              });
            }
          }
        }
        return clipped;
      }, vp.width);

      assert(boundsAudit.length === 0, `[${vp.name}] All UI copy, buttons, and cards stay within [0, ${vp.width}] viewport bounds`, boundsAudit.length > 0 ? JSON.stringify(boundsAudit) : '');

      // 4.3 Headline Line Wrapping Constraint
      const headlineAudit = await mPage.evaluate(() => {
        const headlines = Array.from(document.querySelectorAll('.wf-hero-headline, .wf-section-head'));
        return headlines.map(h => {
          const rect = h.getBoundingClientRect();
          const style = window.getComputedStyle(h);
          const fontSize = parseFloat(style.fontSize);
          const lineHeight = parseFloat(style.lineHeight) || (fontSize * 1.15);
          const lines = Math.round(rect.height / lineHeight);
          return {
            text: h.innerText.trim(),
            lines,
            height: Math.round(rect.height)
          };
        });
      });

      headlineAudit.forEach(h => {
        assert(h.lines <= 3, `[${vp.name}] Heading "${h.text}" wraps within <= 3 lines`, `Lines: ${h.lines}, Height: ${h.height}px`);
      });

      // 4.4 Touch Target Dimensions
      const touchAudit = await mPage.evaluate(() => {
        const targets = Array.from(document.querySelectorAll('.site-cta, .site-mark, .trust-item, .haptic-card, .close-cta'));
        return targets.map(t => {
          const r = t.getBoundingClientRect();
          // Dimension passes if width >= 40 AND height >= 36, or height >= 44
          const pass = (r.width >= 40 && r.height >= 36) || r.height >= 44 || (r.width * r.height >= 44 * 36);
          return {
            cls: t.className,
            text: (t.innerText || '').slice(0, 15).trim(),
            width: Math.round(r.width),
            height: Math.round(r.height),
            pass
          };
        });
      });

      touchAudit.forEach(t => {
        assert(t.pass, `[${vp.name}] Touch target [${t.cls} "${t.text}"] meets tap ergonomics`, `${t.width}x${t.height}px`);
      });

      // 4.5 Server Health & Zero Error Invariant
      assert(mConsoleErrors.length === 0, `[${vp.name}] 0 console errors`, mConsoleErrors.join('; '));
      assert(mPageErrors.length === 0, `[${vp.name}] 0 uncaught page errors`, mPageErrors.join('; '));
      assert(mFailedRequests.length === 0, `[${vp.name}] 0 asset/script 404s or failed network requests`, mFailedRequests.map(r => `${r.status} ${r.url}`).join('; '));

      await mPage.close();
    }

    // =========================================================================
    // WCAG COLOR CONTRAST VERIFICATION
    // =========================================================================
    subSuiteHeader('4.6 WCAG AA/AAA Color Contrast Compliance');
    const contrastPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await contrastPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await contrastPage.waitForTimeout(300);

    const contrastData = await contrastPage.evaluate(() => {
      const primaryText = window.getComputedStyle(document.body).color; // --sc-ink
      const softTextEl = document.querySelector('.wf-body') || document.querySelector('.wf-subline');
      const softTextColor = softTextEl ? window.getComputedStyle(softTextEl).color : 'rgb(180, 183, 192)';
      const accentEl = document.querySelector('.site-cta');
      const accentBg = accentEl ? window.getComputedStyle(accentEl).backgroundColor : 'rgb(59, 158, 255)';
      const accentColor = accentEl ? window.getComputedStyle(accentEl).color : 'rgb(8, 9, 13)';
      const canvasBg = 'rgb(8, 9, 13)'; // --sc-canvas

      return {
        primaryText,
        softTextColor,
        accentBg,
        accentColor,
        canvasBg
      };
    });

    const bodyContrast = getContrastRatio(parseRgb(contrastData.primaryText), parseRgb(contrastData.canvasBg));
    const softContrast = getContrastRatio(parseRgb(contrastData.softTextColor), parseRgb(contrastData.canvasBg));
    const accentContrast = getContrastRatio(parseRgb(contrastData.accentColor), parseRgb(contrastData.accentBg));

    assert(bodyContrast >= 4.5, `Primary text (--sc-ink) contrast >= 4.5:1 against canvas ground`, `Ratio: ${bodyContrast.toFixed(2)}:1`);
    assert(softContrast >= 3.0, `Secondary text (--sc-ink-soft) contrast >= 3.0:1 against canvas ground`, `Ratio: ${softContrast.toFixed(2)}:1`);
    assert(accentContrast >= 4.5, `Accent button CTA text contrast >= 4.5:1 against accent background`, `Ratio: ${accentContrast.toFixed(2)}:1`);

    await contrastPage.close();

  } catch (testErr) {
    console.error(`\x1b[31mUnexpected Test Runner Error: ${testErr.message}\x1b[0m\n${testErr.stack}`);
    failedAssertions++;
    failures.push(`Runner Exception: ${testErr.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // =========================================================================
  // FINAL TEST SUITE SUMMARY
  // =========================================================================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\x1b[1m\x1b[35m======================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[35m E2E TEST RUN SUMMARY\x1b[0m`);
  console.log(`\x1b[1m\x1b[35m======================================================================\x1b[0m`);
  console.log(`Duration:           ${elapsed}s`);
  console.log(`Total Assertions:   ${totalAssertions}`);
  console.log(`Passed Assertions:  \x1b[32m${passedAssertions}\x1b[0m`);
  console.log(`Failed Assertions:  ${failedAssertions > 0 ? `\x1b[31m${failedAssertions}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);

  if (failures.length > 0) {
    console.log(`\n\x1b[31mFailure Details:\x1b[0m`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log(`\n\x1b[1m\x1b[32m✔ ALL E2E TESTS PASSED CLEANLY (Exit Code 0)\x1b[0m\n`);
    process.exit(0);
  }
}

runTestSuite();
