/**
 * lab/adversarial_micro_audit.js
 * Ultra-compact 320px micro-audit and Keyboard Tab Focus Traversal
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4500';
const CHROME_PATH = process.env.CHROME_PATH || '/home/robin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

async function runMicroAudit() {
  console.log('=== Running Ultra-Compact 320px & Keyboard Accessibility Audit ===');
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true
  });

  try {
    // 1. 320px Ultra-Compact Viewport Audit
    const page320 = await browser.newPage({
      viewport: { width: 320, height: 568 },
      isMobile: true,
      hasTouch: true
    });
    await page320.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page320.waitForTimeout(300);

    const check320 = await page320.evaluate(() => {
      const results = [];
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

      // Check all 6 copy windows at their key progress points
      const checkpoints = [0.0, 0.25, 0.5, 0.7, 0.85, 1.0];
      for (const cp of checkpoints) {
        window.scrollTo(0, maxScroll * cp);
        const docW = document.documentElement.scrollWidth;
        const cliW = document.documentElement.clientWidth;
        const overflow = docW - cliW;

        // Check active visible copy blocks
        const copyBlocks = Array.from(document.querySelectorAll('[data-sc-copy]'));
        let visibleCount = 0;
        let clipped = false;

        for (const b of copyBlocks) {
          const op = parseFloat(window.getComputedStyle(b).opacity);
          if (op > 0.3) {
            visibleCount++;
            const rect = b.getBoundingClientRect();
            if (rect.left < -1 || rect.right > 321) {
              clipped = true;
            }
          }
        }

        results.push({
          checkpoint: cp,
          overflow,
          visibleCount,
          clipped
        });
      }
      return results;
    });

    console.log('\n320px Viewport Checkpoints:');
    let pass320 = true;
    for (const r of check320) {
      console.log(`  Progress ${(r.checkpoint * 100).toFixed(0)}%: overflow=${r.overflow}px, visibleBlocks=${r.visibleCount}, clipped=${r.clipped}`);
      if (r.overflow > 0.5 || r.clipped) pass320 = false;
    }

    // 2. Keyboard Tab Navigation & Focus Traversal
    const deskPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await deskPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await deskPage.waitForTimeout(300);

    console.log('\nKeyboard Tab Traversal:');
    const focusedElements = [];
    for (let i = 0; i < 10; i++) {
      await deskPage.keyboard.press('Tab');
      const focused = await deskPage.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          tagName: el.tagName,
          className: el.className,
          text: (el.innerText || el.textContent || '').trim().slice(0, 30),
          href: el.getAttribute('href')
        };
      });
      if (focused) focusedElements.push(focused);
    }

    console.log(`  Successfully tabbed through ${focusedElements.length} interactive elements:`);
    focusedElements.forEach((f, idx) => {
      console.log(`    ${idx + 1}. <${f.tagName}> .${f.className} "${f.text}" (href: ${f.href})`);
    });

    console.log(`\nMicro-audit Result: ${pass320 && focusedElements.length >= 5 ? 'PASS' : 'FAIL'}`);

    await page320.close();
    await deskPage.close();
  } finally {
    await browser.close();
  }
}

runMicroAudit().catch(console.error);
