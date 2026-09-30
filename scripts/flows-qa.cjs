const {chromium}=require('C:/Users/msi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],passed=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('#shopSearch').waitFor();
 const act=(name)=>page.locator(`#shopper [data-act="${name}"]`).first();
 await page.locator('#shopSearch').fill('nutela');assert.match(await page.locator('#searchResults').innerText(),/ربما تقصد/);passed.push('English typo correction');
 await page.locator('#shopSearch').fill('zzzzzz');assert.match(await page.locator('#searchResults').innerText(),/لم نجد/);passed.push('No results');
 await page.locator('#shopSearch').fill('pepsi');await act('go').click();assert.match(await page.locator('#dialogTitle').innerText(),/غير محدّد/);await page.locator('.dialog-close').click();passed.push('Product without location');
 await page.locator('#shopSearch').fill('');
 for(const id of ['P1001','P1004','P1008','P1010'])await page.locator(`[data-act="add"][data-id="${id}"]`).click();
 await act('list').click();await act('start-list').click();assert.match(await page.locator('.route-heading').innerText(),/المنتج 1 من 4/);
 const listOrder=await page.evaluate(()=>JSON.parse(localStorage.getItem('dawer-journey-v2')).list.map(x=>x.id));
 await act('search').click();await page.locator('#shopSearch').fill('flakes');await act('add').click();await act('resume').click();assert.match(await page.locator('.route-heading').innerText(),/من 5/);passed.push('List journey retained after adding product during search');
 await act('shelf').click();await act('found').click();assert.match(await page.locator('.route-heading').innerText(),/المنتج 2 من 5/);passed.push('Found advances to next product');
 await act('skip').click();assert.match(await page.locator('.route-heading').innerText(),/المنتج 3 من 5/);passed.push('Deferred product and next item');
 await act('origin').click();await page.locator('[data-act="set-origin"][data-value="entrance"]').click();assert.match(await page.locator('#originCaption').innerText(),/المدخل الرئيسي/);passed.push('Change origin');
 await act('shelf').click();await act('missing').click();const before=await page.evaluate(()=>JSON.stringify(DawerEditor.getStore().locations));await act('report').click();assert.match(await page.locator('#dialogTitle').innerText(),/حُفظ البلاغ/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dawer-reports-v1')).length),1);assert.equal(await page.evaluate(()=>JSON.stringify(DawerEditor.getStore().locations)),before);await page.locator('.dialog-close').click();passed.push('Report saved without altering locations');
 await act('admin').click();assert.ok(await page.locator('#shopper').isHidden());await page.locator('[data-mode="products"]').click();await page.locator('#productSearch').fill('coca');await page.locator('#productList [data-product-id="P1002"]').click();
 await page.locator('[data-id="shelf-s-12"]').focus();await page.keyboard.press('Enter');await page.locator('#shelfWorkspace.is-visible').waitFor();await page.locator('#shelfSide').selectOption('B');await page.locator('.position-slot[data-section="B"][data-level="2"][data-position="2"]').click();
 await page.locator('#saveButton').click();await page.locator('#customerPreview').click();await act('search').click();await page.locator('#shopSearch').fill('coca');await page.locator('[data-act="go"][data-id="P1002"]').click();assert.match(await page.locator('.destination-address').innerText(),/الواجهة B/);
 await act('shelf').click();await page.locator('.target-slot').waitFor();assert.equal(await page.locator('.target-slot').count(),1);assert.match(await page.locator('.arrival-product').innerText(),/الثاني من أسفل/);await page.locator('.dialog-close').click();passed.push('Admin click/keyboard placement on face B reflected in shopper');
 await page.reload();await page.locator('.destination-address').waitFor();assert.match(await page.locator('.destination-address').innerText(),/الواجهة B/);passed.push('Store and journey restored after reload');
 await act('admin').click();await page.locator('[data-mode="products"]').click();await page.locator('#additionalLocation').check();await page.locator('#productSearch').fill('coca');await page.locator('#productList [data-product-id="P1002"]').click();await page.locator('[data-id="shelf-s-14"]').focus();await page.keyboard.press('Enter');await page.locator('.position-slot[data-section="A"][data-level="1"][data-position="1"]').click();assert.equal(await page.evaluate(()=>DawerEditor.getStore().locations.filter(x=>x.productId==='P1002').length),2);passed.push('Multiple product locations');
 await page.locator('#undoButton').click();assert.equal(await page.evaluate(()=>DawerEditor.getStore().locations.filter(x=>x.productId==='P1002').length),1);passed.push('Undo placement');
 await page.locator('[data-mode="build"]').click();await page.locator('#validateMap').click();assert.match(await page.locator('#adminReport').innerText(),/بلا موقع/);await page.locator('#adminReport button').click();await page.locator('#reportsButton').click();assert.match(await page.locator('#adminReport').innerText(),/R-/);await page.locator('#adminReport button').click();passed.push('Validation and saved reports');
 await page.screenshot({path:'output/admin-1440.png'});
 // Seed a blocked map using the existing saved document format, then exercise public search UI.
 await page.evaluate(()=>{const store=DawerEditor.getStore();store.elements.push({id:'qa-block',type:'wall',x:0,y:575,w:1200,h:20,rotation:0});localStorage.setItem('dawer-map-demo',JSON.stringify(store));localStorage.removeItem('dawer-journey-v2');});
 await page.reload();await page.locator('#shopSearch').fill('milk');await act('go').click();assert.match(await page.locator('#dialogTitle').innerText(),/لا يوجد مسار متاح/);assert.equal(await page.locator('#shopMap .shop-route').count(),0);passed.push('Blocked route UI, no fabricated path');
 await page.locator('.dialog-close').click();await page.context().setOffline(true);await page.waitForFunction(()=>document.querySelector('#shopNotice').textContent.includes('لا يوجد اتصال'));assert.match(await page.locator('#shopNotice').innerText(),/لا يوجد اتصال/);await page.context().setOffline(false);passed.push('Offline fallback');
 for(const width of [768,390]){await page.setViewportSize({width,height:900});await act('admin').click();await page.locator('#editorToolsButton').click();assert.ok(await page.locator('#toolList').isVisible());await page.screenshot({path:`output/admin-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#customerPreview').click();}passed.push('Mobile and tablet editor controls');
 assert.deepEqual(errors,[]);fs.writeFileSync('output/flows-qa.json',JSON.stringify({passed,listOrder,errors},null,2));console.log(JSON.stringify({passed,listOrder,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


