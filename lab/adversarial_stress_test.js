/**
 * lab/adversarial_stress_test.js
 * Adversarial UX Stress Test Harness for Mobinet Retail (Challenger 1)
 * 
 * 4 Adversarial Vectors:
 * 1. Extreme Viewport Matrix & Dynamic Resizing/Rotations (320px to 3840px 4K)
 * 2. Chaotic & High-Frequency Scroll Inputs (Burst flicks, teleportation, micro-jitter)
 * 3. Touch Physics, Rubberbanding & Bounding Containment
 * 4. Pixel-Level Geometry, Overlap Collision & CTA Clipping Matrix
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4500';
const CHROME_PATH = process.env.CHROME_PATH || '/home/robin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

// Target Viewport Matrix for Stress Testing
const STRESS_VIEWPORTS = [
  { name: 'Ultra-Compact iPhone SE1', width: 320, height: 568, isMobile: true, hasTouch: true },
  { name: 'Android Compact (360x640)', width: 360, height: 640, isMobile: true, hasTouch: true },
  { name: 'Android Standard (360x740)', width: 360, height: 740, isMobile: true, hasTouch: true },
  { name: 'iPhone SE 2/3 (375x667)', width: 375, height: 667, isMobile: true, hasTouch: true },
  { name: 'iPhone 12/13/14 (390x844)', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'Google Pixel 7 (412x915)', width: 412, height: 915, isMobile: true, hasTouch: true },
  { name: 'iPhone 14 Pro Max (430x932)', width: 430, height: 932, isMobile: true, hasTouch: true },
  { name: 'iPad Mini Portrait (768x1024)', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'iPad Air Landscape (1180x820)', width: 1180, height: 820, isMobile: false, hasTouch: true },
  { name: 'Laptop WXGA (1366x768)', width: 1366, height: 768, isMobile: false, hasTouch: false },
  { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080, isMobile: false, hasTouch: false },
  { name: 'Desktop 2K QHD (2560x1440)', width: 2560, height: 1440, isMobile: false, hasTouch: false },
  { name: 'Desktop 4K UHD (3840x2160)', width: 3840, height: 2160, isMobile: false, hasTouch: false }
];

let totalAsserts = 0;
let passedAsserts = 0;
let failedAsserts = 0;
const failureDetails = [];
const telemetry = {
  viewportsTested: 0,
  chaoticScrollBursts: 0,
  touchInteractions: 0,
  collisionPairsAudited: 0,
  clippingAudits: 0,
  maxScrollWidthOverflow: 0,
  consoleErrors: []
};

function recordAssert(pass, name, details = '') {
  totalAsserts++;
  if (pass) {
    passedAsserts++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    failedAsserts++;
    const msg = `FAIL: ${name} ${details ? '(' + details + ')' : ''}`;
    failureDetails.push(msg);
    console.log(`  \x1b[31m✖\x1b[0m ${msg}`);
  }
}

function banner(title) {
  console.log(`\n\x1b[1m\x1b[34m======================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[34m [ADVERSARIAL STRESS] ${title}\x1b[0m`);
  console.log(`\x1b[1m\x1b[34m======================================================================\x1b[0m`);
}

function subBanner(title) {
  console.log(`\n\x1b[1m\x1b[36m▶ ${title}\x1b[0m`);
}

async function runAdversarialSuite() {
  const t0 = Date.now();
  console.log(`\x1b[1m\x1b[35m=== Mobinet Retail Adversarial UX Stress Suite (Playwright) ===\x1b[0m`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Browser: ${CHROME_PATH}\n`);

  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true
  });

  try {
    // =========================================================================
    // VECTOR 1: EXTREME VIEWPORT MATRIX & DYNAMIC RESIZING / ORIENTATION FLIPS
    // =========================================================================
    banner('VECTOR 1: EXTREME VIEWPORT MATRIX & DYNAMIC RESIZING');

    for (const vp of STRESS_VIEWPORTS) {
      subBanner(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      telemetry.viewportsTested++;

      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch
      });

      const consoleErrs = [];
      page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
      page.on('pageerror', err => consoleErrs.push(err.message));

      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Check horizontal overflow at scroll 0, 0.3, 0.6, 1.0
      for (const p of [0, 0.3, 0.6, 1.0]) {
        const overflow = await page.evaluate((progressTarget) => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, maxScroll * progressTarget);
          
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientW = docEl.clientWidth;
          const excess = scrollW - clientW;
          return { excess, scrollW, clientW };
        }, p);

        telemetry.maxScrollWidthOverflow = Math.max(telemetry.maxScrollWidthOverflow, overflow.excess);
        recordAssert(
          overflow.excess <= 0.5,
          `[${vp.name}] Zero horizontal overflow at progress ${p * 100}%`,
          `scrollWidth=${overflow.scrollW}, clientWidth=${overflow.clientW}, diff=${overflow.excess}px`
        );
      }

      // Check fixed world stage containment
      const stageGeometry = await page.evaluate(() => {
        const world = document.querySelector('[data-sc-world]');
        if (!world) return { valid: false, reason: 'no world stage' };
        const rect = world.getBoundingClientRect();
        return {
          valid: true,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          winW: window.innerWidth,
          winH: window.innerHeight
        };
      });

      recordAssert(
        stageGeometry.valid && Math.abs(stageGeometry.left) < 1 && Math.abs(stageGeometry.top) < 1,
        `[${vp.name}] Stage fixed anchor is perfectly aligned (0,0)`,
        `left=${stageGeometry.left}, top=${stageGeometry.top}`
      );
      recordAssert(
        stageGeometry.valid && Math.abs(stageGeometry.width - stageGeometry.winW) <= 1,
        `[${vp.name}] Stage width matches innerWidth exactly`,
        `stageW=${stageGeometry.width}, winW=${stageGeometry.winW}`
      );

      // Check for console errors in this viewport
      recordAssert(consoleErrs.length === 0, `[${vp.name}] Zero JS errors or console faults`, consoleErrs.join('; '));
      if (consoleErrs.length > 0) telemetry.consoleErrors.push(...consoleErrs);

      await page.close();
    }

    // Dynamic Live Resizing Stress (Resize viewport smoothly while scrubbing)
    subBanner('Dynamic Live Resizing & Orientation Flip Torture');
    {
      const dynamicPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await dynamicPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await dynamicPage.waitForTimeout(300);

      // Rapidly step through widths from 320 to 2560 and back to 375
      const resizeSequence = [320, 360, 390, 480, 768, 1024, 1440, 2560, 1920, 1024, 600, 375];
      let resizeFaults = 0;

      for (let i = 0; i < resizeSequence.length; i++) {
        const w = resizeSequence[i];
        const h = Math.round(w * 1.6 > 1200 ? 1080 : w * 1.6);
        await dynamicPage.setViewportSize({ width: w, height: h });
        // Scroll during resize
        const prog = i / (resizeSequence.length - 1);
        const check = await dynamicPage.evaluate((targetProg) => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, max * targetProg);
          const scrollW = document.documentElement.scrollWidth;
          const clientW = document.documentElement.clientWidth;
          const spacerH = document.querySelector('[data-sc-spacer]').getBoundingClientRect().height;
          return {
            overflow: scrollW - clientW,
            hasValidSpacer: spacerH > window.innerHeight * 2,
            hasNaNTransform: document.body.innerHTML.includes('NaN')
          };
        }, prog);

        if (check.overflow > 1 || !check.hasValidSpacer || check.hasNaNTransform) {
          resizeFaults++;
        }
      }

      recordAssert(resizeFaults === 0, 'Live dynamic resizing preserves DOM geometry without NaN transforms or overflow', `Faults: ${resizeFaults}`);

      // Rapid Device Orientation Flip (390x844 <-> 844x390)
      await dynamicPage.setViewportSize({ width: 390, height: 844 });
      await dynamicPage.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.5));
      await dynamicPage.waitForTimeout(100);

      await dynamicPage.setViewportSize({ width: 844, height: 390 }); // Rotate to landscape
      await dynamicPage.waitForTimeout(100);
      const landscapeState = await dynamicPage.evaluate(() => {
        const stage = document.querySelector('[data-sc-world]').getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          stageW: stage.width,
          winW: window.innerWidth
        };
      });
      recordAssert(landscapeState.overflow <= 1, 'Landscape orientation flip retains 0 horizontal overflow', `Overflow: ${landscapeState.overflow}px`);
      recordAssert(Math.abs(landscapeState.stageW - landscapeState.winW) <= 1, 'Landscape orientation retains full width stage', `diff: ${landscapeState.stageW - landscapeState.winW}`);

      await dynamicPage.setViewportSize({ width: 390, height: 844 }); // Rotate back to portrait
      await dynamicPage.waitForTimeout(100);
      const portraitState = await dynamicPage.evaluate(() => {
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      recordAssert(portraitState.overflow <= 1, 'Re-orientation back to portrait leaves clean geometry', `Overflow: ${portraitState.overflow}px`);

      await dynamicPage.close();
    }

    // =========================================================================
    // VECTOR 2: CHAOTIC & HIGH-FREQUENCY SCROLL INPUTS
    // =========================================================================
    banner('VECTOR 2: CHAOTIC & HIGH-FREQUENCY SCROLL INPUTS');
    {
      const scrollPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const jsErrors = [];
      scrollPage.on('pageerror', err => jsErrors.push(err.message));
      await scrollPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await scrollPage.waitForTimeout(300);

      subBanner('2.1 High-Velocity Delta Bursts & Micro-Jitter (50 rapid burst cycles)');
      const burstResults = await scrollPage.evaluate(async () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        let nanDetections = 0;
        let stuckFrames = 0;

        // Perform 50 chaotic flick jumps
        for (let i = 0; i < 50; i++) {
          const randY = Math.floor(Math.random() * maxScroll);
          window.scrollTo(0, randY);
          // Check CSS variables and transforms
          const progressVar = document.documentElement.style.getPropertyValue('--sc-p');
          if (progressVar && (progressVar.includes('NaN') || progressVar.includes('Infinity'))) {
            nanDetections++;
          }
        }

        // Oscillatory micro-jitter: alternating +/- 3px at high frequency
        const currentY = window.scrollY;
        for (let j = 0; j < 100; j++) {
          const delta = (j % 2 === 0 ? 3 : -3);
          window.scrollTo(0, Math.max(0, Math.min(maxScroll, currentY + delta)));
        }

        return { nanDetections, finalScrollY: window.scrollY, maxScroll };
      });

      telemetry.chaoticScrollBursts += 150;
      recordAssert(burstResults.nanDetections === 0, 'Zero NaN or Infinity in CSS custom properties during chaotic bursts');
      recordAssert(jsErrors.length === 0, 'Zero uncaught exceptions during high-frequency scroll bursts', jsErrors.join('; '));

      subBanner('2.2 Quantum Teleportation Across Extrema (0% -> 100% -> 50% -> 0%)');
      const teleportResults = await scrollPage.evaluate(async () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const jumpPoints = [0, 1.0, 0.5, 0.95, 0.05, 0.75, 0.25, 0];
        const settleTimes = [];

        for (const pt of jumpPoints) {
          const targetY = maxScroll * pt;
          const tStart = performance.now();
          window.scrollTo(0, targetY);
          
          // Wait for 100ms
          await new Promise(r => setTimeout(r, 100));
          const tEnd = performance.now();
          settleTimes.push(tEnd - tStart);
        }

        // Verify active video playhead consistency
        const videos = Array.from(document.querySelectorAll('video'));
        const videoStates = videos.map(v => ({
          currentTime: v.currentTime,
          duration: v.duration,
          isFinite: Number.isFinite(v.currentTime)
        }));

        return { settleTimes, videoStates };
      });

      const allVideosFinite = teleportResults.videoStates.every(v => v.isFinite);
      recordAssert(allVideosFinite, 'All video playheads maintain finite numeric state during quantum teleportation');

      subBanner('2.3 Rapid Seam Crossfade Reversal Torture');
      // Rapid oscillation across the seam points (0.16, 0.35, 0.58, 0.75, 0.88)
      const seamOscillation = await scrollPage.evaluate(async () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const seams = [0.16, 0.35, 0.58, 0.75, 0.88];
        let badOpacities = 0;

        for (const seam of seams) {
          const seamY = maxScroll * seam;
          // Rapidly rock back and forth around seam by +/- 40px for 10 iterations
          for (let k = 0; k < 10; k++) {
            window.scrollTo(0, seamY + (k % 2 === 0 ? 40 : -40));
            await new Promise(r => setTimeout(r, 15));
            // Check opacity of all segments
            const segments = Array.from(document.querySelectorAll('.sc-world__seg'));
            for (const seg of segments) {
              const op = parseFloat(window.getComputedStyle(seg).opacity);
              if (isNaN(op) || op < -0.01 || op > 1.01) badOpacities++;
            }
          }
        }
        return { badOpacities };
      });

      recordAssert(seamOscillation.badOpacities === 0, 'Segment opacities remain strictly bounded [0, 1] during seam oscillation', `Bad opacities: ${seamOscillation.badOpacities}`);

      await scrollPage.close();
    }

    // =========================================================================
    // VECTOR 3: TOUCH PHYSICS, RUBBERBANDING & BOUNDING CONTAINMENT
    // =========================================================================
    banner('VECTOR 3: TOUCH PHYSICS & BOUNDING CONTAINMENT');
    {
      const touchPage = await browser.newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true
      });
      await touchPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await touchPage.waitForTimeout(300);

      subBanner('3.1 Simulated Touch Swipes & Momentum');
      // Simulate fast vertical swipes using touch events
      await touchPage.touchscreen.tap(200, 400);
      
      // Perform swipe down (scroll up)
      for (let s = 0; s < 5; s++) {
        await touchPage.evaluate(async (step) => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const target = (maxScroll / 5) * step;
          window.scrollTo({ top: target, behavior: 'smooth' });
        }, s + 1);
        await touchPage.waitForTimeout(150);
        telemetry.touchInteractions++;
      }

      // Check overscroll containment
      subBanner('3.2 Overscroll Top / Bottom Rubberbanding Containment');
      const overscrollCheck = await touchPage.evaluate(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        const htmlStyle = window.getComputedStyle(document.documentElement);
        return {
          bodyOverscroll: bodyStyle.overscrollBehaviorY,
          htmlOverscroll: htmlStyle.overscrollBehaviorY,
          overflowX: bodyStyle.overflowX
        };
      });

      recordAssert(
        overscrollCheck.htmlOverscroll === 'none' || overscrollCheck.bodyOverscroll === 'none',
        'Overscroll behavior prevents erratic browser rubberband bounce',
        `html=${overscrollCheck.htmlOverscroll}, body=${overscrollCheck.bodyOverscroll}`
      );
      recordAssert(
        overscrollCheck.overflowX === 'clip' || overscrollCheck.overflowX === 'hidden',
        'Horizontal overflow is strictly clipped on body',
        `overflowX=${overscrollCheck.overflowX}`
      );

      await touchPage.close();
    }

    // =========================================================================
    // VECTOR 4: PIXEL-LEVEL GEOMETRY, OVERLAP COLLISION & CTA CLIPPING MATRIX
    // =========================================================================
    banner('VECTOR 4: PIXEL-LEVEL GEOMETRY, COLLISION & CTA CLIPPING');

    const auditViewports = [
      { name: 'iPhone SE (375x667)', width: 375, height: 667 },
      { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
      { name: 'Pixel 7 (412x915)', width: 412, height: 915 },
      { name: 'Compact Android (360x740)', width: 360, height: 740 },
      { name: 'WXGA Laptop (1366x768)', width: 1366, height: 768 },
      { name: 'Desktop 1080p (1920x1080)', width: 1920, height: 1080 },
      { name: '4K UHD (3840x2160)', width: 3840, height: 2160 }
    ];

    for (const avp of auditViewports) {
      subBanner(`Auditing Viewport: ${avp.name}`);
      const page = await browser.newPage({
        viewport: { width: avp.width, height: avp.height },
        isMobile: avp.width < 800,
        hasTouch: avp.width < 800
      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Audit across 11 scroll positions: 0.0 to 1.0
      const scrollPositions = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

      let clippingViolations = 0;
      let collisionViolations = 0;
      let touchTargetViolations = 0;

      for (const sp of scrollPositions) {
        const audit = await page.evaluate((progress) => {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          window.scrollTo(0, maxScroll * progress);

          const winW = window.innerWidth;
          const winH = window.innerHeight;

          // Elements to inspect
          const copyBlocks = Array.from(document.querySelectorAll('[data-sc-copy]'));
          const interactiveEls = Array.from(document.querySelectorAll('.site-cta, .site-mark, .close-cta, .trust-item, .haptic-card'));

          // 1. Inspect Visible Copy Blocks for Viewport Clipping
          let clipped = [];
          const visibleBlocks = [];

          for (const block of copyBlocks) {
            const opacity = parseFloat(window.getComputedStyle(block).opacity);
            if (opacity > 0.3) {
              visibleBlocks.push(block);
              const rect = block.getBoundingClientRect();
              // Check horizontal containment (allowing 1px sub-pixel tolerance)
              if (rect.left < -1 || rect.right > winW + 1) {
                clipped.push({
                  type: 'copy-block-overflow',
                  text: block.innerText.slice(0, 30),
                  left: rect.left,
                  right: rect.right,
                  winW
                });
              }
            }
          }

          // 2. Check for Pairwise Collisions Between Active Copy Blocks
          let collisions = [];
          for (let i = 0; i < visibleBlocks.length; i++) {
            for (let j = i + 1; j < visibleBlocks.length; j++) {
              const b1 = visibleBlocks[i];
              const b2 = visibleBlocks[j];
              const r1 = b1.getBoundingClientRect();
              const r2 = b2.getBoundingClientRect();

              // Check AABB overlap
              const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
              const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));

              if (overlapX > 20 && overlapY > 20) {
                collisions.push({
                  b1: b1.innerText.slice(0, 20),
                  b2: b2.innerText.slice(0, 20),
                  overlapArea: overlapX * overlapY
                });
              }
            }
          }

          // 3. Inspect Interactive Touch Targets
          let touchFails = [];
          for (const el of interactiveEls) {
            const rect = el.getBoundingClientRect();
            // If element is in viewport and visible
            if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= winH) {
              const op = parseFloat(window.getComputedStyle(el).opacity);
              const vis = window.getComputedStyle(el).visibility;
              if (op > 0.5 && vis !== 'hidden') {
                if (rect.width < 43.5 || rect.height < 43.5) {
                  touchFails.push({
                    el: el.className,
                    text: el.innerText.slice(0, 20),
                    w: rect.width,
                    h: rect.height
                  });
                }
                // Check if CTA button is clipped outside screen
                if (rect.left < 0 || rect.right > winW) {
                  clipped.push({
                    type: 'cta-clipped',
                    el: el.className,
                    left: rect.left,
                    right: rect.right,
                    winW
                  });
                }
              }
            }
          }

          return {
            clipped,
            collisions,
            touchFails,
            visibleBlockCount: visibleBlocks.length
          };
        }, sp);

        telemetry.clippingAudits++;
        telemetry.collisionPairsAudited += audit.visibleBlockCount;

        if (audit.clipped.length > 0) clippingViolations += audit.clipped.length;
        if (audit.collisions.length > 0) collisionViolations += audit.collisions.length;
        if (audit.touchFails.length > 0) touchTargetViolations += audit.touchFails.length;
      }

      recordAssert(clippingViolations === 0, `[${avp.name}] Zero clipped copy blocks or CTA buttons across 11 scroll stops`, `Violations: ${clippingViolations}`);
      recordAssert(collisionViolations === 0, `[${avp.name}] Zero overlapping text collisions between visible blocks`, `Collisions: ${collisionViolations}`);
      recordAssert(touchTargetViolations === 0, `[${avp.name}] 100% of visible interactive targets meet 44x44px minimum`, `Failures: ${touchTargetViolations}`);

      await page.close();
    }

    // =========================================================================
    // FINAL EMPIRICAL SUMMARY
    // =========================================================================
    banner('ADVERSARIAL STRESS TEST SUMMARY & VERDICT');
    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`Duration: ${elapsedSec}s`);
    console.log(`Total Assertions: ${totalAsserts}`);
    console.log(`Passed: \x1b[32m${passedAsserts}\x1b[0m`);
    console.log(`Failed: \x1b[31m${failedAsserts}\x1b[0m`);
    console.log(`Viewports Tested: ${telemetry.viewportsTested}`);
    console.log(`Chaotic Bursts & Jitter Events: ${telemetry.chaoticScrollBursts}`);
    console.log(`Clipping Audits: ${telemetry.clippingAudits}`);
    console.log(`Max Horizontal Overflow: ${telemetry.maxScrollWidthOverflow}px`);
    console.log(`Console Errors: ${telemetry.consoleErrors.length}`);

    if (failedAsserts === 0) {
      console.log(`\n\x1b[1m\x1b[32mVERDICT: APPROVE — All adversarial UX stress vectors passed with zero regressions.\x1b[0m\n`);
    } else {
      console.log(`\n\x1b[1m\x1b[31mVERDICT: REQUEST_CHANGES — Identified ${failedAsserts} adversarial failures:\x1b[0m`);
      failureDetails.forEach(f => console.log(` - ${f}`));
      console.log('');
    }

  } finally {
    await browser.close();
  }

  if (failedAsserts > 0) {
    process.exit(1);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal error in adversarial test harness:', err);
  process.exit(1);
});
