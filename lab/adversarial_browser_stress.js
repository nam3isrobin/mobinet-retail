const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:4500';

async function runAdversarialStressSuite() {
  console.log('================================================================');
  console.log('       MOBINET RETAIL ADVERSARIAL BROWSER STRESS SUITE');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-features=WebCodecs', '--disable-background-timer-throttling']
  });

  const report = {
    timestamp: new Date().toISOString(),
    seekLatency: {},
    reducedMotion: {},
    networkAndConsoleResilience: {},
    mobileScrubbing: {},
    summary: {}
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Rapid Scrubbing & Frame Seek Latency (Desktop 1440x900)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Desktop Rapid Scrubbing & Frame Seek Latency ---');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[Console Error]: ${msg.text()}`);
  });
  page.on('pageerror', err => consoleErrors.push(`[Page Error]: ${err.message}`));
  page.on('requestfailed', req => networkErrors.push(`[Request Failed]: ${req.url()} (${req.failure()?.errorText})`));
  page.on('response', res => {
    if (res.status() >= 400) networkErrors.push(`[HTTP ${res.status()}]: ${res.url()}`);
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Inject seek latency instrumenter into all videos
  await page.evaluate(() => {
    window.__seekMetrics = {
      seeks: [],
      inFlight: 0,
      totalSeeksRequested: 0,
      totalSeeksCompleted: 0,
      stalls: 0
    };

    const videos = Array.from(document.querySelectorAll('video'));
    videos.forEach((v, idx) => {
      let seekStart = null;
      let targetTime = null;

      v.addEventListener('seeking', () => {
        seekStart = performance.now();
        targetTime = v.currentTime;
        window.__seekMetrics.inFlight++;
        window.__seekMetrics.totalSeeksRequested++;
      });

      v.addEventListener('seeked', () => {
        if (seekStart !== null) {
          const duration = performance.now() - seekStart;
          window.__seekMetrics.seeks.push({
            videoIndex: idx,
            durationMs: duration,
            time: targetTime
          });
          seekStart = null;
        }
        window.__seekMetrics.inFlight = Math.max(0, window.__seekMetrics.inFlight - 1);
        window.__seekMetrics.totalSeeksCompleted++;
      });

      v.addEventListener('waiting', () => {
        window.__seekMetrics.stalls++;
      });
    });
  });

  // Prime the media / trigger first interaction
  await page.mouse.wheel(0, 50);
  await page.waitForTimeout(200);

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

  // Stress Phase 1A: 60Hz-120Hz Progressive High Velocity Scrub
  console.log('  Executing Phase 1A: Progressive High Velocity Scrub (0% -> 100%)...');
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * scrollHeight;
    await page.evaluate((targetY) => window.scrollTo(0, targetY), y);
    await page.waitForTimeout(16); // ~60fps scroll bursts
  }
  await page.waitForTimeout(400);

  // Stress Phase 1B: Violent Reverse Scrub (100% -> 0%)
  console.log('  Executing Phase 1B: Violent Reverse Scrub (100% -> 0%)...');
  for (let i = steps; i >= 0; i -= 2) {
    const y = (i / steps) * scrollHeight;
    await page.evaluate((targetY) => window.scrollTo(0, targetY), y);
    await page.waitForTimeout(10); // ~100fps rapid flicks
  }
  await page.waitForTimeout(400);

  // Stress Phase 1C: Random Seek Jump Bursts across all 6 segments
  console.log('  Executing Phase 1C: Random Jump Flicks across video segments...');
  const jumps = [0.15, 0.85, 0.35, 0.95, 0.05, 0.55, 0.72, 0.22, 0.98, 0.48, 0.0];
  for (const fraction of jumps) {
    const y = fraction * scrollHeight;
    await page.evaluate((targetY) => window.scrollTo(0, targetY), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(600);

  // Stress Phase 1D: Seam Boundary Oscillation (stress crossfade lerp logic)
  console.log('  Executing Phase 1D: Seam Boundary Oscillations (stressing decoder transitions)...');
  const seamFractions = [0.14, 0.16, 0.18, 0.16, 0.14, 0.32, 0.35, 0.38, 0.35, 0.52, 0.55, 0.58, 0.73, 0.75, 0.78];
  for (const sf of seamFractions) {
    await page.evaluate((targetY) => window.scrollTo(0, targetY), sf * scrollHeight);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(500);

  // Harvest seek metrics
  const seekMetrics = await page.evaluate(() => {
    const data = window.__seekMetrics;
    const durations = data.seeks.map(s => s.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    if (count === 0) return { count: 0 };
    
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = durations[0];
    const max = durations[count - 1];
    const p50 = durations[Math.floor(count * 0.50)];
    const p95 = durations[Math.floor(count * 0.95)];
    const p99 = durations[Math.floor(count * 0.99)];
    
    return {
      totalSeeksRequested: data.totalSeeksRequested,
      totalSeeksCompleted: data.totalSeeksCompleted,
      inFlightRemaining: data.inFlight,
      stalls: data.stalls,
      completedSampleCount: count,
      minMs: min.toFixed(2),
      maxMs: max.toFixed(2),
      avgMs: avg.toFixed(2),
      p50Ms: p50.toFixed(2),
      p95Ms: p95.toFixed(2),
      p99Ms: p99.toFixed(2)
    };
  });

  report.seekLatency = seekMetrics;
  console.log(`  Completed Seeks: ${seekMetrics.totalSeeksCompleted} / ${seekMetrics.totalSeeksRequested}`);
  console.log(`  Seek Latency: Min: ${seekMetrics.minMs}ms | Avg: ${seekMetrics.avgMs}ms | p50: ${seekMetrics.p50Ms}ms | p95: ${seekMetrics.p95Ms}ms | p99: ${seekMetrics.p99Ms}ms | Max: ${seekMetrics.maxMs}ms`);
  console.log(`  Decoder Stalls: ${seekMetrics.stalls}`);

  await page.close();

  // ---------------------------------------------------------------------------
  // TEST 2: Reduced Motion Preference & Zero Cumulative Layout Shift (CLS)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Reduced Motion Fallback & Cumulative Layout Shift (CLS) ---');
  const rmPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await rmPage.emulateMedia({ reducedMotion: 'reduce' });

  const rmNetworkRequests = [];
  rmPage.on('request', req => {
    if (req.url().endsWith('.mp4')) {
      rmNetworkRequests.push(req.url());
    }
  });

  await rmPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Install CLS PerformanceObserver
  await rmPage.evaluate(() => {
    window.__cumulativeLayoutShift = 0;
    window.__layoutShiftEntries = [];
    try {
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__cumulativeLayoutShift += entry.value;
            window.__layoutShiftEntries.push({
              value: entry.value,
              hadRecentInput: entry.hadRecentInput,
              sources: (entry.sources || []).map(s => s.node?.nodeName || 'unknown')
            });
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      window.__clsError = e.message;
    }
  });

  await rmPage.waitForTimeout(300);

  // Scroll smoothly through entire document under reduced motion
  const rmScrollHeight = await rmPage.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let i = 0; i <= 50; i++) {
    await rmPage.evaluate((y) => window.scrollTo(0, y), (i / 50) * rmScrollHeight);
    await rmPage.waitForTimeout(20);
  }
  await rmPage.waitForTimeout(400);

  // Check state under reduced motion
  const rmState = await rmPage.evaluate(() => {
    const posters = Array.from(document.querySelectorAll('.sc-world__poster, [poster]'));
    const posterVisibilities = posters.map(p => {
      const style = window.getComputedStyle(p);
      return {
        tag: p.tagName,
        src: p.getAttribute('poster') || p.getAttribute('src') || p.style.backgroundImage,
        opacity: style.opacity,
        display: style.display,
        visibility: style.visibility
      };
    });

    const videos = Array.from(document.querySelectorAll('video'));
    const videoStates = videos.map(v => ({
      src: v.src,
      currentSrc: v.currentSrc,
      preload: v.preload,
      hasBlob: v.src.startsWith('blob:'),
      paused: v.paused
    }));

    return {
      cls: window.__cumulativeLayoutShift || 0,
      shiftEntries: window.__layoutShiftEntries || [],
      postersCount: posters.length,
      videoStates,
      transformsSuppressed: document.querySelector('[data-sc-world]').style.transform === '' || document.querySelector('[data-sc-world]').style.transform === 'none'
    };
  });

  const mp4Suppressed = rmNetworkRequests.length === 0;
  const zeroCLS = rmState.cls === 0;
  console.log(`  MP4 Requests under Reduced Motion: ${rmNetworkRequests.length} (Expected: 0) -> ${mp4Suppressed ? 'PASS' : 'FAIL'}`);
  console.log(`  Cumulative Layout Shift (CLS): ${rmState.cls} (Expected: 0) -> ${zeroCLS ? 'PASS' : 'FAIL'}`);
  console.log(`  Poster Fallbacks Active: ${rmState.postersCount} posters checked`);
  
  report.reducedMotion = {
    mp4FetchSuppressed: mp4Suppressed,
    mp4RequestsIntercepted: rmNetworkRequests,
    clsScore: rmState.cls,
    zeroLayoutShiftPass: zeroCLS,
    shiftEntries: rmState.shiftEntries,
    videoStates: rmState.videoStates
  };

  await rmPage.close();

  // ---------------------------------------------------------------------------
  // TEST 3: Mobile Viewport Touch Scrubbing & Seek Latency (390x844)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Mobile Viewport Touch Scrubbing & Seek Latency (390x844) ---');
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });

  await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(400);

  await mobilePage.evaluate(() => {
    window.__mobileSeekMetrics = {
      seeks: [],
      inFlight: 0,
      totalSeeksRequested: 0,
      totalSeeksCompleted: 0,
      stalls: 0
    };

    const videos = Array.from(document.querySelectorAll('video'));
    videos.forEach((v, idx) => {
      let seekStart = null;
      let targetTime = null;

      v.addEventListener('seeking', () => {
        seekStart = performance.now();
        targetTime = v.currentTime;
        window.__mobileSeekMetrics.inFlight++;
        window.__mobileSeekMetrics.totalSeeksRequested++;
      });

      v.addEventListener('seeked', () => {
        if (seekStart !== null) {
          const duration = performance.now() - seekStart;
          window.__mobileSeekMetrics.seeks.push({
            videoIndex: idx,
            durationMs: duration,
            time: targetTime
          });
          seekStart = null;
        }
        window.__mobileSeekMetrics.inFlight = Math.max(0, window.__mobileSeekMetrics.inFlight - 1);
        window.__mobileSeekMetrics.totalSeeksCompleted++;
      });
    });
  });

  // Mobile touch gesture simulation (swipe gestures)
  await mobilePage.touchscreen.tap(200, 400);
  await mobilePage.waitForTimeout(200);

  const mScrollHeight = await mobilePage.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

  // Progressive swipe scrub
  for (let i = 0; i <= 60; i++) {
    const y = (i / 60) * mScrollHeight;
    await mobilePage.evaluate((targetY) => window.scrollTo(0, targetY), y);
    await mobilePage.waitForTimeout(20);
  }
  await mobilePage.waitForTimeout(500);

  // Mobile fast swipe flicks
  const mFlicks = [0.2, 0.8, 0.3, 0.9, 0.1, 0.6, 0.0];
  for (const f of mFlicks) {
    await mobilePage.evaluate((targetY) => window.scrollTo(0, targetY), f * mScrollHeight);
    await mobilePage.waitForTimeout(80);
  }
  await mobilePage.waitForTimeout(600);

  const mobileSeekMetrics = await mobilePage.evaluate(() => {
    const data = window.__mobileSeekMetrics;
    const durations = data.seeks.map(s => s.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    if (count === 0) return { count: 0 };
    
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = durations[0];
    const max = durations[count - 1];
    const p50 = durations[Math.floor(count * 0.50)];
    const p95 = durations[Math.floor(count * 0.95)];
    const p99 = durations[Math.floor(count * 0.99)];
    
    return {
      totalSeeksRequested: data.totalSeeksRequested,
      totalSeeksCompleted: data.totalSeeksCompleted,
      inFlightRemaining: data.inFlight,
      completedSampleCount: count,
      minMs: min.toFixed(2),
      maxMs: max.toFixed(2),
      avgMs: avg.toFixed(2),
      p50Ms: p50.toFixed(2),
      p95Ms: p95.toFixed(2),
      p99Ms: p99.toFixed(2)
    };
  });

  report.mobileScrubbing = mobileSeekMetrics;
  console.log(`  Mobile Completed Seeks: ${mobileSeekMetrics.totalSeeksCompleted} / ${mobileSeekMetrics.totalSeeksRequested}`);
  console.log(`  Mobile Seek Latency: Min: ${mobileSeekMetrics.minMs}ms | Avg: ${mobileSeekMetrics.avgMs}ms | p50: ${mobileSeekMetrics.p50Ms}ms | p95: ${mobileSeekMetrics.p95Ms}ms | p99: ${mobileSeekMetrics.p99Ms}ms | Max: ${mobileSeekMetrics.maxMs}ms`);

  await mobilePage.close();

  // ---------------------------------------------------------------------------
  // TEST 4: Network Resilience, 404 Status Codes & Uncaught Console Errors
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Network Resilience & Console Error Audit ---');
  report.networkAndConsoleResilience = {
    consoleErrorsCount: consoleErrors.length,
    consoleErrors,
    networkErrorsCount: networkErrors.length,
    networkErrors,
    pass: consoleErrors.length === 0 && networkErrors.length === 0
  };

  console.log(`  Console Errors Detected: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach(err => console.log(`    ${err}`));
  }
  console.log(`  Network 4xx/5xx / Failed Requests: ${networkErrors.length}`);
  if (networkErrors.length > 0) {
    networkErrors.forEach(err => console.log(`    ${err}`));
  }
  console.log(`  Resilience Audit: ${report.networkAndConsoleResilience.pass ? 'PASS (0 errors, 0 404s)' : 'FAIL'}`);

  await browser.close();

  // Summary Verdict
  const p95Latency = parseFloat(report.seekLatency.p95Ms || '999');
  const mobileP95 = parseFloat(report.mobileScrubbing.p95Ms || '999');
  const latencyPass = p95Latency < 200 && mobileP95 < 50;
  const reducedMotionPass = report.reducedMotion.mp4FetchSuppressed && report.reducedMotion.zeroLayoutShiftPass;
  const resiliencePass = report.networkAndConsoleResilience.pass;

  const overallPass = latencyPass && reducedMotionPass && resiliencePass;
  report.summary = {
    latencyPass,
    desktopP95LatencyMs: report.seekLatency.p95Ms,
    mobileP95LatencyMs: report.mobileScrubbing.p95Ms,
    reducedMotionPass,
    resiliencePass,
    verdict: overallPass ? 'APPROVE' : 'REQUEST_CHANGES'
  };

  console.log('\n================================================================');
  console.log(`ADVERSARIAL STRESS VERDICT: ${report.summary.verdict}`);
  console.log('================================================================');

  fs.writeFileSync(path.resolve(__dirname, 'browser_stress_results.json'), JSON.stringify(report, null, 2));
}

runAdversarialStressSuite().catch(err => {
  console.error('Fatal error during adversarial suite:', err);
  process.exit(1);
});
