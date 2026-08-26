const { chromium } = require('playwright');

async function debugCLSNormal() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.addInitScript(() => {
    window.__shifts = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__shifts.push({
          startTime: entry.startTime,
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
          sources: (entry.sources || []).map(s => ({
            node: s.node?.nodeName,
            className: s.node?.className,
            prevRect: s.previousRect ? { x: s.previousRect.x, y: s.previousRect.y, w: s.previousRect.width, h: s.previousRect.height } : null,
            curRect: s.currentRect ? { x: s.currentRect.x, y: s.currentRect.y, w: s.currentRect.width, h: s.currentRect.height } : null,
          }))
        });
      }
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  });

  console.log('Navigating to http://localhost:4500 (normal motion)...');
  await page.goto('http://localhost:4500', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const shiftsAfterLoad = await page.evaluate(() => window.__shifts);
  console.log('Shifts after load (normal motion):', JSON.stringify(shiftsAfterLoad, null, 2));

  await browser.close();
}

debugCLSNormal().catch(console.error);
