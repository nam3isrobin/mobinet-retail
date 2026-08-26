const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:4500';

async function runChallengerV2Suite() {
  console.log('================================================================');
  console.log('    CHALLENGER 2 (ITERATION 2) EMPIRICAL ADVERSARIAL SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-features=WebCodecs', '--disable-background-timer-throttling']
  });

  const fullReport = {
    timestamp: new Date().toISOString(),
    clsAudit: {},
    all12ClipsDirectSeek: {},
    liveInteractiveScrubbing: {},
    reducedMotionVerification: {},
    networkAndConsoleResilience: {},
    verdict: null
  };

  let allPassed = true;

  // ===========================================================================
  // SECTION 1: CUMULATIVE LAYOUT SHIFT (CLS) AUDIT ACROSS VIEWPORTS & MODES
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('SECTION 1: Cumulative Layout Shift (CLS) Pre & Post Hydration');
  console.log('----------------------------------------------------------------');

  const viewportsToTest = [
    { name: 'Desktop 1440x900', width: 1440, height: 900, reducedMotion: false },
    { name: 'Desktop 1440x900 (Reduced Motion)', width: 1440, height: 900, reducedMotion: true },
    { name: 'Desktop 1920x1080', width: 1920, height: 1080, reducedMotion: false },
    { name: 'Tablet 768x1024', width: 768, height: 1024, reducedMotion: false },
    { name: 'Mobile iPhone 12/13/14 (390x844)', width: 390, height: 844, reducedMotion: false, isMobile: true, hasTouch: true },
    { name: 'Mobile iPhone SE (375x667)', width: 375, height: 667, reducedMotion: false, isMobile: true, hasTouch: true },
  ];

  const clsResults = [];

  for (const vp of viewportsToTest) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile || false,
      hasTouch: vp.hasTouch || false
    });
    const page = await context.newPage();
    if (vp.reducedMotion) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }

    // Instrument PerformanceObserver before any HTML or scripts load
    await page.addInitScript(() => {
      window.__shifts = [];
      window.__cumulativeLayoutShift = 0;
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__cumulativeLayoutShift += entry.value;
              window.__shifts.push({
                startTime: entry.startTime,
                value: entry.value,
                hadRecentInput: entry.hadRecentInput,
                sources: (entry.sources || []).map(s => ({
                  node: s.node?.nodeName,
                  className: s.node?.className,
                  prevRect: s.previousRect ? { x: s.previousRect.x, y: s.previousRect.y, w: s.previousRect.width, h: s.previousRect.height } : null,
                  curRect: s.currentRect ? { x: s.currentRect.x, y: s.currentRect.y, w: s.currentRect.width, h: s.currentRect.height } : null
                }))
              });
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (e) {
        window.__clsError = e.message;
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(400);

    // Measure initial CLS before any user scrolling
    const initialMetrics = await page.evaluate(() => ({
      cls: window.__cumulativeLayoutShift,
      shifts: window.__shifts
    }));

    // Scroll down to middle and bottom to check scroll-induced layout shifts
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    await page.evaluate((dh) => window.scrollTo(0, dh * 0.5), docHeight);
    await page.waitForTimeout(200);
    await page.evaluate((dh) => window.scrollTo(0, dh), docHeight);
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const postScrollMetrics = await page.evaluate(() => ({
      cls: window.__cumulativeLayoutShift,
      shifts: window.__shifts
    }));

    // Verify static CSS placement of world container
    const worldRect = await page.evaluate(() => {
      const world = document.querySelector('[data-sc-world]');
      const segs = Array.from(document.querySelectorAll('[data-sc-segment]'));
      const r = world ? world.getBoundingClientRect() : null;
      return {
        worldExists: !!world,
        worldRect: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
        worldPosition: world ? window.getComputedStyle(world).position : null,
        segCount: segs.length,
        segsFixedOrAbsolute: segs.every(s => window.getComputedStyle(s).position === 'absolute')
      };
    });

    const isZeroCLS = initialMetrics.cls === 0 && postScrollMetrics.cls === 0;
    const isLayoutProper = worldRect.worldPosition === 'fixed' && worldRect.worldRect.top === 0 && worldRect.worldRect.left === 0;
    const passed = isZeroCLS && isLayoutProper;
    if (!passed) allPassed = false;

    console.log(`  [${vp.name}]`);
    console.log(`    Initial CLS: ${initialMetrics.cls} (Shifts: ${initialMetrics.shifts.length})`);
    console.log(`    Post-Scroll CLS: ${postScrollMetrics.cls} (Shifts: ${postScrollMetrics.shifts.length})`);
    console.log(`    World Stage: position: ${worldRect.worldPosition}, top: ${worldRect.worldRect?.top}, left: ${worldRect.worldRect?.left}`);
    console.log(`    Status: ${passed ? 'PASS (CLS = 0.000)' : 'FAIL'}\n`);

    clsResults.push({
      viewport: vp.name,
      initialCLS: initialMetrics.cls,
      postScrollCLS: postScrollMetrics.cls,
      shiftsCount: postScrollMetrics.shifts.length,
      shifts: postScrollMetrics.shifts,
      worldRect,
      passed
    });

    await context.close();
  }

  fullReport.clsAudit = {
    allPassed: clsResults.every(r => r.passed),
    results: clsResults
  };

  // ===========================================================================
  // SECTION 2: DIRECT SEEK & DECODE STRESS TEST ON ALL 12 VIDEO CLIPS
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('SECTION 2: Direct Seek & Decode Latency on All 12 Video Clips');
  console.log('----------------------------------------------------------------');

  const videoClips = [
    { name: 'leg1.mp4 (Desktop Leg 1)', relPath: 'assets/leg1.mp4', type: 'desktop' },
    { name: 'leg2.mp4 (Desktop Leg 2)', relPath: 'assets/leg2.mp4', type: 'desktop' },
    { name: 'leg3.mp4 (Desktop Leg 3)', relPath: 'assets/leg3.mp4', type: 'desktop' },
    { name: 'leg4.mp4 (Desktop Leg 4)', relPath: 'assets/leg4.mp4', type: 'desktop' },
    { name: 'leg5.mp4 (Desktop Leg 5)', relPath: 'assets/leg5.mp4', type: 'desktop' },
    { name: 'leg6.mp4 (Desktop Leg 6)', relPath: 'assets/leg6.mp4', type: 'desktop' },
    { name: 'leg1-m.mp4 (Mobile Leg 1)', relPath: 'assets/leg1-m.mp4', type: 'mobile' },
    { name: 'leg2-m.mp4 (Mobile Leg 2)', relPath: 'assets/leg2-m.mp4', type: 'mobile' },
    { name: 'leg3-m.mp4 (Mobile Leg 3)', relPath: 'assets/leg3-m.mp4', type: 'mobile' },
    { name: 'leg4-m.mp4 (Mobile Leg 4)', relPath: 'assets/leg4-m.mp4', type: 'mobile' },
    { name: 'leg5-m.mp4 (Mobile Leg 5)', relPath: 'assets/leg5-m.mp4', type: 'mobile' },
    { name: 'leg6-m.mp4 (Mobile Leg 6)', relPath: 'assets/leg6-m.mp4', type: 'mobile' },
  ];

  const clipResults = [];

  for (const clip of videoClips) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(BASE_URL);

    const seekTargets = [0.0, 0.5, 1.25, 2.5, 3.75, 4.9, 1.0, 3.0, 0.1, 4.8, 0.0];
    
    const clipMetrics = await page.evaluate(async ({ relPath, seekTargets }) => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = relPath;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        document.body.appendChild(video);

        let stalls = 0;
        let errors = [];
        const seekDurations = [];

        video.addEventListener('waiting', () => { stalls++; });
        video.addEventListener('stalled', () => { stalls++; });
        video.addEventListener('error', (e) => {
          errors.push(video.error ? `${video.error.code}: ${video.error.message}` : 'unknown error');
        });

        const runSeeks = async () => {
          for (const targetTime of seekTargets) {
            const t0 = performance.now();
            await new Promise((seekResolve) => {
              const onSeeked = () => {
                const elapsed = performance.now() - t0;
                seekDurations.push({ target: targetTime, durationMs: elapsed });
                video.removeEventListener('seeked', onSeeked);
                seekResolve();
              };
              video.addEventListener('seeked', onSeeked);
              video.currentTime = targetTime;
            });
            await new Promise(r => setTimeout(r, 10));
          }

          const durations = seekDurations.map(s => s.durationMs).sort((a, b) => a - b);
          const count = durations.length;
          const sum = durations.reduce((a, b) => a + b, 0);
          const avg = count ? sum / count : 0;
          const min = durations[0] || 0;
          const max = durations[count - 1] || 0;
          const p50 = durations[Math.floor(count * 0.5)] || 0;
          const p95 = durations[Math.floor(count * 0.95)] || 0;

          video.remove();
          resolve({
            videoDuration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            totalSeeks: count,
            stalls,
            errors,
            durations: seekDurations,
            minMs: min.toFixed(2),
            avgMs: avg.toFixed(2),
            p50Ms: p50.toFixed(2),
            p95Ms: p95.toFixed(2),
            maxMs: max.toFixed(2)
          });
        };

        if (video.readyState >= 3) {
          runSeeks();
        } else {
          video.addEventListener('loadeddata', runSeeks, { once: true });
        }

        setTimeout(() => {
          resolve({
            timeout: true,
            errors: ['Timeout loading video data']
          });
        }, 8000);
      });
    }, { relPath: clip.relPath, seekTargets });

    const p95Val = parseFloat(clipMetrics.p95Ms || '999');
    const threshold = clip.type === 'mobile' ? 65 : 200;
    const clipPassed = !clipMetrics.timeout &&
                       clipMetrics.errors.length === 0 &&
                       clipMetrics.totalSeeks === seekTargets.length &&
                       p95Val <= threshold;

    if (!clipPassed) allPassed = false;

    console.log(`  [${clip.name}]`);
    console.log(`    Resolution: ${clipMetrics.videoWidth}x${clipMetrics.videoHeight} | Duration: ${clipMetrics.videoDuration}s | ReadyState: ${clipMetrics.readyState}`);
    console.log(`    Seeks Completed: ${clipMetrics.totalSeeks}/${seekTargets.length} | Decoder Stalls: ${clipMetrics.stalls} | Errors: ${clipMetrics.errors.length}`);
    console.log(`    Seek Latency -> Min: ${clipMetrics.minMs}ms | Avg: ${clipMetrics.avgMs}ms | p50: ${clipMetrics.p50Ms}ms | p95: ${clipMetrics.p95Ms}ms | Max: ${clipMetrics.maxMs}ms`);
    console.log(`    Status: ${clipPassed ? 'PASS' : 'FAIL'}\n`);

    clipResults.push({
      name: clip.name,
      relPath: clip.relPath,
      type: clip.type,
      metrics: clipMetrics,
      passed: clipPassed
    });

    await page.close();
  }

  fullReport.all12ClipsDirectSeek = {
    allPassed: clipResults.every(c => c.passed),
    results: clipResults
  };

  // ===========================================================================
  // SECTION 3: LIVE INTERACTIVE SCRUBBING & ENGINE STRESS (DESKTOP & MOBILE)
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('SECTION 3: Live Interactive Scrubbing & High-Velocity Engine Stress');
  console.log('----------------------------------------------------------------');

  const liveStressPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const liveConsoleErrors = [];
  const liveNetworkErrors = [];

  liveStressPage.on('console', msg => {
    if (msg.type() === 'error') liveConsoleErrors.push(`[Console Error]: ${msg.text()}`);
  });
  liveStressPage.on('pageerror', err => liveConsoleErrors.push(`[Page Error]: ${err.message}`));
  liveStressPage.on('requestfailed', req => liveNetworkErrors.push(`[Request Failed]: ${req.url()} (${req.failure()?.errorText})`));
  liveStressPage.on('response', res => {
    if (res.status() >= 400) liveNetworkErrors.push(`[HTTP ${res.status()}]: ${res.url()}`);
  });

  await liveStressPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await liveStressPage.waitForTimeout(400);

  // Hook live page seek metrics
  await liveStressPage.evaluate(() => {
    window.__liveMetrics = { seeks: [], totalRequested: 0, totalCompleted: 0, stalls: 0 };
    const videos = Array.from(document.querySelectorAll('video'));
    videos.forEach((v, idx) => {
      let t0 = null;
      v.addEventListener('seeking', () => {
        t0 = performance.now();
        window.__liveMetrics.totalRequested++;
      });
      v.addEventListener('seeked', () => {
        if (t0 !== null) {
          window.__liveMetrics.seeks.push({ videoIdx: idx, durationMs: performance.now() - t0 });
          t0 = null;
        }
        window.__liveMetrics.totalCompleted++;
      });
      v.addEventListener('waiting', () => { window.__liveMetrics.stalls++; });
    });
  });

  // Prime
  await liveStressPage.mouse.wheel(0, 50);
  await liveStressPage.waitForTimeout(100);

  const scrollH = await liveStressPage.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

  // Phase A: Rapid 100-step scroll down
  console.log('  Executing Rapid Continuous Scroll Down (100 steps @ 16ms)...');
  for (let i = 0; i <= 100; i++) {
    await liveStressPage.evaluate((y) => window.scrollTo(0, y), (i / 100) * scrollH);
    await liveStressPage.waitForTimeout(16);
  }
  await liveStressPage.waitForTimeout(300);

  // Phase B: High-speed violent reverse flick (100% -> 0%)
  console.log('  Executing Violent Reverse Scrub (100% -> 0% @ 8ms)...');
  for (let i = 100; i >= 0; i -= 2) {
    await liveStressPage.evaluate((y) => window.scrollTo(0, y), (i / 100) * scrollH);
    await liveStressPage.waitForTimeout(8);
  }
  await liveStressPage.waitForTimeout(300);

  // Phase C: Random segment jump bursts
  console.log('  Executing High-Amplitude Random Segment Jumps...');
  const randomJumps = [0.15, 0.85, 0.35, 0.95, 0.05, 0.55, 0.72, 0.22, 0.98, 0.48, 0.0];
  for (const j of randomJumps) {
    await liveStressPage.evaluate((y) => window.scrollTo(0, y), j * scrollH);
    await liveStressPage.waitForTimeout(50);
  }
  await liveStressPage.waitForTimeout(400);

  // Phase D: Crossfade seam oscillation
  console.log('  Executing Crossfade Seam Oscillations...');
  const seams = [0.14, 0.17, 0.15, 0.33, 0.37, 0.34, 0.53, 0.57, 0.54, 0.73, 0.77, 0.74];
  for (const s of seams) {
    await liveStressPage.evaluate((y) => window.scrollTo(0, y), s * scrollH);
    await liveStressPage.waitForTimeout(25);
  }
  await liveStressPage.waitForTimeout(400);

  const liveMetrics = await liveStressPage.evaluate(() => {
    const durations = window.__liveMetrics.seeks.map(s => s.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    if (count === 0) return { count: 0 };
    const sum = durations.reduce((a, b) => a + b, 0);
    return {
      totalRequested: window.__liveMetrics.totalRequested,
      totalCompleted: window.__liveMetrics.totalCompleted,
      stalls: window.__liveMetrics.stalls,
      minMs: durations[0].toFixed(2),
      avgMs: (sum / count).toFixed(2),
      p50Ms: durations[Math.floor(count * 0.5)].toFixed(2),
      p95Ms: durations[Math.floor(count * 0.95)].toFixed(2),
      p99Ms: durations[Math.floor(count * 0.99)].toFixed(2),
      maxMs: durations[count - 1].toFixed(2)
    };
  });

  console.log(`  Live Engine Seeks: ${liveMetrics.totalCompleted} / ${liveMetrics.totalRequested} completed`);
  console.log(`  Seek Distribution: p50: ${liveMetrics.p50Ms}ms | p95: ${liveMetrics.p95Ms}ms | p99: ${liveMetrics.p99Ms}ms | Max: ${liveMetrics.maxMs}ms`);
  console.log(`  Decoder Stalls: ${liveMetrics.stalls}`);

  const liveStressPassed = liveMetrics.totalCompleted > 500 && parseFloat(liveMetrics.p95Ms) < 250;
  if (!liveStressPassed) allPassed = false;
  console.log(`  Status: ${liveStressPassed ? 'PASS' : 'FAIL'}\n`);

  fullReport.liveInteractiveScrubbing = {
    metrics: liveMetrics,
    passed: liveStressPassed
  };

  await liveStressPage.close();

  // ===========================================================================
  // SECTION 4: REDUCED MOTION ACCESSIBILITY & POSTER FALLBACK VERIFICATION
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('SECTION 4: Reduced Motion Fallback & Poster Integrity Audit');
  console.log('----------------------------------------------------------------');

  const rmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const rmPage = await rmContext.newPage();
  await rmPage.emulateMedia({ reducedMotion: 'reduce' });

  const interceptedMp4s = [];
  const posterResponses = [];

  rmPage.on('request', req => {
    if (req.url().endsWith('.mp4')) interceptedMp4s.push(req.url());
  });
  rmPage.on('response', res => {
    if (res.url().includes('assets/p') && res.url().endsWith('.webp')) {
      posterResponses.push({ url: res.url(), status: res.status() });
    }
  });

  // Track CLS under reduced motion
  await rmPage.addInitScript(() => {
    window.__rmCLS = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__rmCLS += entry.value;
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  });

  await rmPage.goto(BASE_URL, { waitUntil: 'load' });
  await rmPage.waitForTimeout(300);

  // Scroll through showroom under reduced motion
  const rmDocHeight = await rmPage.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let i = 0; i <= 30; i++) {
    await rmPage.evaluate((y) => window.scrollTo(0, y), (i / 30) * rmDocHeight);
    await rmPage.waitForTimeout(20);
  }
  await rmPage.waitForTimeout(300);

  const rmState = await rmPage.evaluate(() => {
    const posters = Array.from(document.querySelectorAll('.sc-world__poster'));
    const posterData = posters.map(p => ({
      src: p.src,
      naturalWidth: p.naturalWidth,
      naturalHeight: p.naturalHeight,
      complete: p.complete,
      computedOpacity: window.getComputedStyle(p).opacity,
      computedDisplay: window.getComputedStyle(p).display
    }));
    return {
      cls: window.__rmCLS,
      posters: posterData
    };
  });

  const mp4SuppressionPass = interceptedMp4s.length === 0;
  const postersLoadedPass = rmState.posters.length === 6 && rmState.posters.every(p => p.complete && p.naturalWidth > 0);
  const rmCLSPass = rmState.cls === 0;
  const rmOverallPass = mp4SuppressionPass && postersLoadedPass && rmCLSPass;

  if (!rmOverallPass) allPassed = false;

  console.log(`  MP4 Requests Intercepted: ${interceptedMp4s.length} (Expected: 0) -> ${mp4SuppressionPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Poster Assets Loaded: ${rmState.posters.filter(p => p.complete && p.naturalWidth > 0).length}/6 -> ${postersLoadedPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Reduced Motion CLS: ${rmState.cls} (Expected: 0) -> ${rmCLSPass ? 'PASS' : 'FAIL'}`);
  console.log(`  Status: ${rmOverallPass ? 'PASS' : 'FAIL'}\n`);

  fullReport.reducedMotionVerification = {
    mp4SuppressionPass,
    interceptedMp4s,
    postersLoadedPass,
    posters: rmState.posters,
    cls: rmState.cls,
    passed: rmOverallPass
  };

  await rmContext.close();

  // ===========================================================================
  // SECTION 5: CONSOLE & NETWORK RESILIENCE SUMMARY
  // ===========================================================================
  console.log('----------------------------------------------------------------');
  console.log('SECTION 5: Network & Console Resilience Audit');
  console.log('----------------------------------------------------------------');

  const resiliencePass = liveConsoleErrors.length === 0 && liveNetworkErrors.length === 0;
  if (!resiliencePass) allPassed = false;

  console.log(`  Console Errors Detected: ${liveConsoleErrors.length}`);
  console.log(`  Network Errors / Failed Requests: ${liveNetworkErrors.length}`);
  console.log(`  Resilience Status: ${resiliencePass ? 'PASS' : 'FAIL'}\n`);

  fullReport.networkAndConsoleResilience = {
    consoleErrors: liveConsoleErrors,
    networkErrors: liveNetworkErrors,
    passed: resiliencePass
  };

  // ===========================================================================
  // FINAL VERDICT DETERMINATION
  // ===========================================================================
  fullReport.verdict = allPassed ? 'APPROVE' : 'REQUEST_CHANGES';

  console.log('================================================================');
  console.log(`OVERALL CHALLENGER 2 VERDICT: ${fullReport.verdict}`);
  console.log('================================================================\n');

  fs.writeFileSync(
    path.resolve(__dirname, 'challenger_v2_results.json'),
    JSON.stringify(fullReport, null, 2)
  );

  await browser.close();

  if (!allPassed) {
    process.exit(1);
  }
}

runChallengerV2Suite().catch(err => {
  console.error('Fatal error during Challenger V2 suite:', err);
  process.exit(1);
});
