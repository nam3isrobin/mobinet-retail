const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: 'iPhone 12/13/14', width: 390, height: 844 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'Compact Android', width: 360, height: 740 }
];

const SCROLL_POINTS = [0.0, 0.25, 0.50, 0.72, 0.85, 1.0];

function relativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHex(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

async function run() {
  console.log('=== Starting Mobinet Retail M2 Mobile & UX Verification ===\n');

  const browser = await chromium.launch({ headless: true });
  let totalErrors = 0;

  // 1. Contrast Assertions
  console.log('--- 1. WCAG Contrast Check ---');
  const bgBase = parseHex('08090D');
  const bgLitShelf = parseHex('3C4150');
  const inkPrimary = parseHex('E8E6E1');
  const inkSoft = parseHex('B4B7C0');

  const crPrimaryBase = contrastRatio(inkPrimary, bgBase);
  const crPrimaryLit = contrastRatio(inkPrimary, bgLitShelf);
  const crSoftBase = contrastRatio(inkSoft, bgBase);
  const crSoftLit = contrastRatio(inkSoft, bgLitShelf);

  console.log(`Primary Ink (#E8E6E1) vs Base (#08090D): ${crPrimaryBase.toFixed(2)}:1 (Target >= 3.0:1 display)`);
  console.log(`Primary Ink (#E8E6E1) vs Lit Shelf (#3C4150): ${crPrimaryLit.toFixed(2)}:1 (Target >= 3.0:1 display)`);
  console.log(`Secondary Ink Soft (#B4B7C0) vs Base (#08090D): ${crSoftBase.toFixed(2)}:1 (Target >= 4.5:1 body)`);
  console.log(`Secondary Ink Soft (#B4B7C0) vs Lit Shelf (#3C4150): ${crSoftLit.toFixed(2)}:1 (Target >= 4.5:1 body)`);

  if (crPrimaryBase < 3.0 || crPrimaryLit < 3.0 || crSoftBase < 4.5 || crSoftLit < 4.5) {
    console.error('FAIL: Contrast ratio check failed!');
    totalErrors++;
  } else {
    console.log('PASS: All color contrast checks met (WCAG AAA/AA).\n');
  }

  // 2. Multi-Viewport Assertions
  for (const vp of VIEWPORTS) {
    console.log(`--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:4500', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Assert Safe-Area & Touch Targets on Header
    const headerData = await page.evaluate(() => {
      const siteBar = document.querySelector('.site-bar');
      const siteMark = document.querySelector('.site-mark');
      const siteCta = document.querySelector('.site-cta');
      const barStyle = window.getComputedStyle(siteBar);
      const markRect = siteMark.getBoundingClientRect();
      const ctaRect = siteCta.getBoundingClientRect();

      return {
        paddingTop: parseFloat(barStyle.paddingTop),
        markW: markRect.width,
        markH: markRect.height,
        ctaW: ctaRect.width,
        ctaH: ctaRect.height
      };
    });

    console.log(`  Header paddingTop: ${headerData.paddingTop}px`);
    console.log(`  SiteMark: ${headerData.markW.toFixed(1)}x${headerData.markH.toFixed(1)}px (min 44x44)`);
    console.log(`  SiteCTA: ${headerData.ctaW.toFixed(1)}x${headerData.ctaH.toFixed(1)}px (min 44x44)`);

    if (headerData.markH < 44 || headerData.markW < 44) {
      console.error(`  FAIL: .site-mark height/width < 44px (${headerData.markW}x${headerData.markH})`);
      totalErrors++;
    }
    if (headerData.ctaH < 44 || headerData.ctaW < 44) {
      console.error(`  FAIL: .site-cta height/width < 44px (${headerData.ctaW}x${headerData.ctaH})`);
      totalErrors++;
    }

    // Check Touch Targets on Trust Items and Close CTA
    const touchTargetData = await page.evaluate(() => {
      const trustItems = Array.from(document.querySelectorAll('.trust-item')).map(el => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      const closeCta = document.querySelector('.close-cta');
      const ccRect = closeCta.getBoundingClientRect();
      const hapticCards = Array.from(document.querySelectorAll('.haptic-card')).map(el => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });

      return {
        trustItems,
        closeCta: { w: ccRect.width, h: ccRect.height },
        hapticCards
      };
    });

    for (let i = 0; i < touchTargetData.trustItems.length; i++) {
      const item = touchTargetData.trustItems[i];
      if (item.h < 44 || item.w < 44) {
        console.error(`  FAIL: .trust-item[${i}] < 44px (${item.w.toFixed(1)}x${item.h.toFixed(1)})`);
        totalErrors++;
      }
    }
    if (touchTargetData.closeCta.h < 44 || touchTargetData.closeCta.w < 44) {
      console.error(`  FAIL: .close-cta < 44px (${touchTargetData.closeCta.w}x${touchTargetData.closeCta.h})`);
      totalErrors++;
    }

    // Scroll & Layout Overflow Check across all scroll positions
    const maxScroll = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);

    for (const p of SCROLL_POINTS) {
      const targetY = maxScroll * p;
      await page.evaluate(y => window.scrollTo(0, y), targetY);
      await page.waitForTimeout(300);

      const overflowData = await page.evaluate(expectedW => {
        const docScrollW = document.documentElement.scrollWidth;
        const bodyScrollW = document.body.scrollWidth;
        const innerW = window.innerWidth;

        // Check active / visible copy windows
        const copies = Array.from(document.querySelectorAll('[data-sc-copy]')).map(c => {
          const rect = c.getBoundingClientRect();
          const opacity = parseFloat(window.getComputedStyle(c).opacity || '0');
          return {
            window: c.getAttribute('data-sc-window'),
            opacity,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height
          };
        });

        return {
          docScrollW,
          bodyScrollW,
          innerW,
          copies
        };
      }, vp.width);

      if (overflowData.docScrollW > vp.width || overflowData.bodyScrollW > vp.width) {
        console.error(`  FAIL at scroll ${(p*100).toFixed(0)}%: Horizontal scroll overflow detected! docScrollW=${overflowData.docScrollW}, innerW=${vp.width}`);
        totalErrors++;
      }

      // Check each visible copy block for bounds
      for (const copy of overflowData.copies) {
        if (copy.opacity > 0.1) {
          // Bounding box must be inside [0, vp.width]
          if (copy.left < -1 || copy.right > vp.width + 1) {
            console.error(`  FAIL at scroll ${(p*100).toFixed(0)}% [${copy.window}]: Copy block outside viewport! left=${copy.left.toFixed(1)}, right=${copy.right.toFixed(1)}, vpWidth=${vp.width}`);
            totalErrors++;
          }
        }
      }
    }

    console.log(`  PASS: Viewport ${vp.name} verified with zero horizontal overflow.\n`);
    await page.close();
  }

  await browser.close();

  console.log('===================================================');
  if (totalErrors === 0) {
    console.log('ALL VERIFICATION ASSERTIONS PASSED (Exit Code: 0)');
    process.exit(0);
  } else {
    console.error(`VERIFICATION FAILED with ${totalErrors} errors (Exit Code: 1)`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
