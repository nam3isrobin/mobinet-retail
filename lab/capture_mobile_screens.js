const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const dir = '/home/robin/Documents/ObsidianVault/scrollcraft/builds/mobinet-retail/lab/mobile_verify';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const viewports = [
    { name: 'iphone13_390x844', width: 390, height: 844 },
    { name: 'iphonese_375x667', width: 375, height: 667 }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:4500', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const maxScroll = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);

    const scrollSteps = [
      { name: '01_hero', pos: 0.0 },
      { name: '02_products', pos: 0.28 },
      { name: '03_flagship', pos: 0.52 },
      { name: '04_story', pos: 0.72 },
      { name: '05_trust', pos: 0.85 },
      { name: '06_finale', pos: 1.0 }
    ];

    for (const step of scrollSteps) {
      await page.evaluate(y => window.scrollTo(0, y), maxScroll * step.pos);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/${vp.name}_${step.name}.png`, fullPage: false });
    }

    await page.close();
  }

  await browser.close();
  console.log('Mobile screenshots captured to lab/mobile_verify/');
})();
