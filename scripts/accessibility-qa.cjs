const {chromium}=require('C:/Users/msi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.goto('http://127.0.0.1:4173');await page.locator('#shopSearch').waitFor();
 async function contrast(){return page.evaluate(()=>{
  const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[0,0,0];
  const lum=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const output=[];
  for(const e of document.querySelectorAll('#shopper *')){
   if(e.namespaceURI.includes('svg')||e.closest('[hidden]')||e.closest('dialog:not([open])')||e.matches(':disabled'))continue;
   const rect=e.getBoundingClientRect(),css=getComputedStyle(e);
   if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight||css.visibility==='hidden'||css.opacity==='0')continue;
   if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
   let bg=[255,255,255],parent=e;
   while(parent){const color=rgb(getComputedStyle(parent).backgroundColor);if(color.length===3||color[3]===1){bg=color;break;}parent=parent.parentElement;}
   const fg=rgb(css.color),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(css.fontSize),large=size>=24||(size>=18.66&&+css.fontWeight>=700);
   if(ratio<(large?3:4.5))output.push({text:e.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),color:css.color,background:bg});
  }return output;
 });}
 const checks={initialContrast:await contrast()};
 await page.locator('#shopSearch').focus();await page.keyboard.type('milk');await page.keyboard.press('Enter');
 checks.routeContrast=await contrast();checks.motion=await page.locator('.shop-route').evaluate(e=>getComputedStyle(e).animationName);
 await page.locator('[data-act="shelf"]').click();await page.locator('.target-slot').waitFor();checks.shelfContrast=await contrast();
 // Native dialog focus must remain inside the modal through keyboard traversal.
 checks.modalFocus=[];for(let i=0;i<14;i++){await page.keyboard.press('Tab');checks.modalFocus.push(await page.evaluate(()=>!!document.activeElement.closest('#shopDialog')));}
 await page.keyboard.press('Escape');checks.escapeCloses=await page.locator('#shopDialog').evaluate(e=>!e.open);
 checks.primaryTargets=await page.locator('#shopper .primary').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
 fs.writeFileSync('output/accessibility-qa.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));assert.ok(checks.modalFocus.every(Boolean));assert.equal(checks.motion,'none');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
