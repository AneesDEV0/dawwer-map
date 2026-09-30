const {chromium}=require('C:/Users/msi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],results=[];
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');await page.locator('#shopSearch').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`output/initial-${width}.png`,fullPage:true});
  results.push({width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),adminHidden:await page.locator('#appShell').isHidden()});
  await page.locator('#shopSearch').fill('milk');await page.locator('[data-act="go"][data-id="P1001"]').click();
  await page.locator('[data-act="shelf"]').click();await page.locator('.target-slot').waitFor();
  results.push({width,target:await page.locator('.target-slot').count(),level:await page.locator('.arrival-product').innerText(),shelfOverflow:await page.locator('#shopDialog').evaluate(e=>e.scrollWidth>e.clientWidth)});
  await page.screenshot({path:`output/shelf-${width}.png`,fullPage:true});
  await page.locator('.arrival-actions [data-act="close-dialog"]').click();
  await page.screenshot({path:`output/route-${width}.png`,fullPage:true});
  await page.locator('[data-act="shelf"]').click();await page.locator('[data-act="found"]').click();
  results.push({width,success:await page.locator('.success-state').isVisible()});
  await page.close();
 }
 fs.writeFileSync('output/browser-qa.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
