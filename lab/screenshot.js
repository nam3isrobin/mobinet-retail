const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/robin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:4500', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Screenshot at top
  await page.screenshot({ path: '/home/robin/Documents/ObsidianVault/scrollcraft/builds/mobinet-retail/lab/hero-top.png', fullPage: false });
  
  // Scroll to 30% and screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.3));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/robin/Documents/ObsidianVault/scrollcraft/builds/mobinet-retail/lab/mid-scroll.png', fullPage: false });
  
  // Scroll to 50% (peak) and screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/robin/Documents/ObsidianVault/scrollcraft/builds/mobinet-retail/lab/peak.png', fullPage: false });
  
  // Scroll to 90% (finale) and screenshot
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.9));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/robin/Documents/ObsidianVault/scrollcraft/builds/mobinet-retail/lab/finale.png', fullPage: false });
  
  await browser.close();
  console.log('All 4 screenshots saved to lab/');
})();
