(function () {
  'use strict';
  const $=s=>document.querySelector(s), nav=window.DawerNavigation, editor=()=>window.DawerEditor;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store=()=>editor().getStore(), product=id=>store().products.find(p=>p.id===id), shelf=code=>store().elements.find(e=>e.type==='shelf'&&e.shelfId===code);
  const normalize=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim();
  const brand=p=>({'P1002':'Coca-Cola','P1003':'Pepsi','P1004':'Nutella'}[p.id]||'العلامة غير مسجّلة');
  const code=l=>`A${l.aisle}-${l.shelf.replace('-','')}-${l.side}-${l.section}-L${String(l.level).padStart(2,'0')}-P${String(l.position).padStart(2,'0')}`;
  const level=n=>['','السفلي','الثاني من أسفل','الثالث من أسفل','الرابع من أسفل','الخامس من أسفل','السادس من أسفل'][n]||`${n} من أسفل`;
  const locationText=l=>l?`الممر ${l.aisle} — وحدة العرض ${l.shelf} — الواجهة ${l.side} — الرف ${level(l.level)}`:'لم يُحدّد موقعه بعد';
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  const saved=read('dawer-journey-v2',{});
  const state={view:'search',query:'',category:'الكل',current:null,location:null,route:null,origin:{...store().entrance},originLabel:'المدخل الرئيسي',step:0,list:[],listActive:false,speed:1.2,frame:[25,35,1150,675],panned:false,picking:false,lastReached:null,...saved};
  state.list=Array.isArray(state.list)?state.list.filter(x=>product(x.id)&&['pending','found','deferred'].includes(x.status)):[];
  state.speed=Math.max(.4,Math.min(2,Number(state.speed)||1.2));state.current=product(state.current)?.id||null;
  let timer,drag=null,sheetDrag=null,returnFocus=null;
  const root=document.createElement('div');root.id='shopper';document.body.prepend(root);
  root.innerHTML=`
    <header class="shop-header"><div class="brand"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-name">داور <b>ماب</b><small>دليلك داخل المتجر</small></span></div>
    <div class="store-name"><span class="store-symbol">⌑</span><span>السوبرماركت التجريبي<small>الطابق الأرضي · خريطة داخلية</small></span></div>
    <div class="shop-header-actions"><span class="prototype-tag">نسخة تجريبية</span><button data-act="admin" class="quiet-button">إدارة المتجر <span aria-hidden="true">↗</span></button></div></header>
    <main class="shop-layout">
      <aside class="journey-panel" aria-label="البحث وإرشادات الرحلة"><button class="sheet-handle" data-act="sheet" aria-label="توسيع أو تصغير لوحة الإرشاد" aria-expanded="false"><i></i></button>
        <nav class="shop-tabs" aria-label="التسوّق"><button data-act="search" class="active">⌕ <span>البحث عن منتج</span></button><button data-act="list">▤ <span>قائمتي</span><b id="listCount">0</b></button></nav>
        <div id="panelContent" class="panel-scroll"></div>
        <div class="panel-footer"><span class="origin-symbol">↑</span><span id="originCaption">المسار يبدأ من المدخل الرئيسي</span><button data-act="origin">تغيير</button></div>
      </aside>
      <section class="shop-map" aria-label="خريطة المتجر"><div class="map-heading"><div><span class="overline">أنت تختار المنتج. ونحن نرشدك.</span><h1>كل ممر يقرّبك.</h1></div><span class="floor-tag">الطابق <b>01</b></span></div>
        <div id="mapMessage" class="map-message"><span>↑</span> ابدأ من المدخل الرئيسي، واختر منتجك من البحث</div>
        <div class="map-drawing" id="shopMapDrawing"><svg id="shopMap" viewBox="25 35 1150 675" role="img" aria-label="مخطط المتجر؛ إرشادات نصية مكافئة متاحة في لوحة الرحلة" tabindex="0"></svg></div>
        <div class="map-controls"><button data-act="zoom-in" aria-label="تكبير الخريطة">+</button><button data-act="zoom-out" aria-label="تصغير الخريطة">−</button><span></span><button data-act="fit" aria-label="اعرض الرحلة كاملة" title="اعرض الرحلة كاملة">⌗</button></div>
        <div class="map-bottom"><div class="shop-legend"><span><i class="start-key">↑</i> نقطة البداية</span><span><i class="path-key"></i> المسار</span><span><i class="end-key">◈</i> المنتج</span></div><span class="map-note">مخطط تجريبي · لا يوجد تتبّع حي</span></div>
      </section>
    </main><div id="shopNotice" role="status" aria-live="polite"></div>
    <dialog id="shopDialog" aria-labelledby="dialogTitle"><div id="dialogContent"></div></dialog>`;
  function persist(){try{localStorage.setItem('dawer-journey-v2',JSON.stringify({list:state.list,listActive:state.listActive,current:state.current,origin:state.origin,originLabel:state.originLabel,speed:state.speed,lastReached:state.lastReached,manualOrder:state.manualOrder}));}catch{notice('تعذّر الحفظ على الجهاز؛ ستبقى التغييرات خلال هذه الجلسة.');}}
  function notice(message){$('#shopNotice').textContent=message;$('#shopNotice').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('#shopNotice').classList.remove('show'),5500);}
  function art(p,small=false){
    const kind=['P1001','P1011'].includes(p.id)?'carton':['P1002','P1003','P1010','P1014','P1015'].includes(p.id)?'bottle':p.id==='P1004'?'jar':'box';
    const shape=kind==='carton'?'<path d="M25 24 35 10h28l12 14v78H25Z"/><path d="M25 24h50M35 10v14" fill="none" stroke="#fff"/>':kind==='bottle'?'<path d="M39 10h22v17l9 12v60q-20 9-40 0V39l9-12Z"/><rect x="37" y="6" width="26" height="9" rx="2" fill="#d5dce2"/>':kind==='jar'?'<rect x="20" y="27" width="60" height="76" rx="14"/><rect x="19" y="17" width="62" height="17" rx="4" fill="#e3e5e6"/>':'<path d="M23 15h54v88H23Z"/><path d="m23 15 8-6h38l8 6" fill="#c4c9c8"/>';
    return `<span class="package-art ${small?'small':''}" role="img" aria-label="رسم بديل لعبوة ${esc(p.name)}"><svg viewBox="0 0 100 120" aria-hidden="true"><ellipse cx="50" cy="108" rx="31" ry="4" fill="#10283f" opacity=".09"/><g fill="${p.color}">${shape}</g><rect x="27" y="46" width="46" height="34" rx="2" fill="#fff"/><text x="50" y="60" text-anchor="middle" fill="#162d43" font-size="9" font-weight="700">${esc(p.shortName)}</text><path d="M37 68h26M42 72h16" stroke="${p.color}" stroke-width="3"/></svg>${small?'':'<small>صورة بديلة</small>'}</span>`;
  }
  function button(label,act,extra='',cls=''){return `<button class="${cls}" data-act="${act}" ${extra}>${label}</button>`;}
  function bestLocation(id){
    return store().locations.filter(l=>l.productId===id).map(l=>({l,r:shelf(l.shelf)?nav.getRoute(store(),shelf(l.shelf),l,state.origin):null})).sort((a,b)=>(a.r?.reachable?a.r.distance:Infinity)-(b.r?.reachable?b.r.distance:Infinity))[0]?.l||null;
  }
  function showSearch(){state.view='search';renderPanel();$('#shopSearch')?.focus();}
  function renderPanel(){
    $('#listCount').textContent=state.list.filter(x=>x.status!=='found').length;
    root.querySelectorAll('.shop-tabs button').forEach(b=>{const on=b.dataset.act===(state.view==='list'?'list':'search');b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');});
    $('#originCaption').textContent=`المسار يبدأ من ${state.originLabel}`;
    if(state.view==='search'){
      $('#panelContent').innerHTML=`${state.listActive?`<button class="resume-banner" data-act="resume">↗ رحلة قائمتك مستمرة · العودة للإرشاد</button>`:''}<div class="search-heading"><span class="overline">رحلتك تبدأ هنا</span><h2>ما المنتج الذي<br>تبحث عنه؟</h2><p>من أول ممر، حتى مكانه على الرف.</p></div><label class="shop-search"><span aria-hidden="true">⌕</span><input id="shopSearch" type="search" value="${esc(state.query)}" placeholder="اسم المنتج أو العلامة التجارية" aria-label="ما المنتج الذي تبحث عنه؟" autocomplete="off"><kbd>↵</kbd></label><div class="category-tabs">${['الكل','الألبان','المشروبات','الإفطار'].map(c=>button(c,'category',`data-value="${c}" aria-pressed="${state.category===c}"`,state.category===c?'selected':'')).join('')}</div><div id="searchResults" aria-live="polite"></div><p class="data-note">صور توضيحية بديلة. الموقع لا يدلّ على توفر المخزون.</p>`;
      renderResults();
    }else if(state.view==='list') renderList(); else if(state.view==='route') renderDirections(); else if(state.view==='success') renderSuccess();
    $('#panelContent').scrollTop=0;
  }
  function editDistance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]!==b[j-1]));row=next;}return row[b.length];}
  function renderResults(){
    const q=normalize(state.query),available=store().products.filter(p=>state.category==='الكل'||p.category===state.category);
    let results=available.filter(p=>normalize([p.name,p.searchTerms,p.sku,p.category].join(' ')).includes(q)),corrected=false;
    if(!results.length&&q.length>=3){results=available.filter(p=>normalize(p.name+' '+p.searchTerms).split(/\s+/).some(w=>editDistance(q,w)<=1));corrected=!!results.length;}
    if(!q&&state.category==='الكل') results=['P1001','P1004','P1008','P1010'].map(product).filter(Boolean);
    $('#searchResults').innerHTML=`<div class="results-title"><b>${corrected?'ربما تقصد':q?'نتائج البحث':'منتجات قد تبحث عنها'}</b><span>${results.length} منتجات</span></div>${results.map(p=>{const l=store().locations.find(l=>l.productId===p.id),added=state.list.some(x=>x.id===p.id);return `<article class="search-product">${art(p)}<div class="product-copy"><h3>${esc(p.name)}</h3><p>${esc(brand(p))}</p><span class="product-location">${l?`⌖ الممر <bdi>${l.aisle}</bdi> · <bdi>${l.shelf}</bdi>`:'◌ لم يُحدّد موقعه بعد'}</span><div class="product-actions">${button('خذني إليه ←','go',`data-id="${p.id}"`,'text-primary')}${button(added?'ضمن قائمتي':'＋ أضف إلى قائمتي','add',`data-id="${p.id}" ${added?'disabled':''}`)}</div></div></article>`;}).join('')||`<div class="empty-state"><span>⌕</span><h3>لم نجد هذا المنتج</h3><p>جرّب الاسم بالعربية أو الإنجليزية، أو كلمة أقصر مثل «حليب».</p>${button('عرض المنتجات','reset')}</div>`}`;
  }
  function add(id){if(!state.list.some(x=>x.id===id)){state.list.push({id,status:'pending'});persist();notice('أُضيف المنتج إلى قائمتك');}renderPanel();}
  function renderList(){
    const done=state.list.filter(x=>x.status==='found').length;
    $('#panelContent').innerHTML=`<div class="search-heading"><span class="overline">منتجًا بعد منتج</span><h2>قائمة التسوّق<span class="title-number">${state.list.length}</span></h2><p>تم العثور على ${done} من ${state.list.length} منتجات</p></div><div class="list-progress"><i style="width:${state.list.length?done/state.list.length*100:0}%"></i></div>${state.list.map((item,i)=>{const p=product(item.id),active=state.current===p.id&&state.listActive;return `<article class="list-product ${active?'current':''}">${art(p,true)}<div><h3>${esc(p.name)}</h3><p>${item.status==='found'?'✓ تم العثور عليه':active?'← المنتج الحالي':item.status==='deferred'?'◷ مؤجّل':'◌ ضمن القائمة'}</p><div class="list-actions">${button(item.status==='found'?'اعرض المنتج':'اذهب إليه','go',`data-id="${p.id}"`)}${button('↑','reorder',`data-id="${p.id}" aria-label="تقديم ${esc(p.name)}" ${i===0?'disabled':''}`)}${button('×','remove',`data-id="${p.id}" aria-label="إزالة ${esc(p.name)} من القائمة"`)}</div></div></article>`;}).join('')||'<div class="empty-state"><span>▤</span><h3>قائمتك جاهزة لمنتجك الأول</h3><p>ابحث عن منتج ثم اختر «أضف إلى قائمتي».</p></div>'}${state.list.some(x=>x.status!=='found')?button('ابدأ رحلة القائمة ←','start-list','','primary wide'):button('ابحث عن منتج','search','','primary wide')}<p class="data-note">نرتّب المحطات بحسب مسافة المشي في الممرات لتقليل الرجوع. يمكنك تعديل الترتيب يدويًا.</p>${state.listActive?button('العودة للمنتج الحالي','resume','','wide'):''}`;
  }
  function go(id,override){
    const p=product(id);if(!p)return;
    const l=override||bestLocation(id);
    if(!l||!shelf(l.shelf)){openDialog('موقع المنتج غير محدّد',`${art(p)}<h3>${esc(p.name)}</h3><p>هذا المنتج موجود في الدليل، لكن لم يُسجّل موقعه بعد. اسأل موظف خدمة العملاء عند المدخل.</p>${button('أضف إلى قائمتي','add',`data-id="${id}"`)}${button('إغلاق','close-dialog')}`);return;}
    const route=nav.getRoute(store(),shelf(l.shelf),l,state.origin);
    if(!route.reachable){openDialog('لا يوجد مسار متاح',`<p>لا يمكن الوصول إلى الواجهة <bdi>${l.side}</bdi> لوحدة <bdi>${l.shelf}</bdi> من نقطة البداية الحالية.</p><p>غيّر نقطة البداية أو راجع موظف المتجر. لم نرسم مسارًا عبر العوائق.</p>${button('تغيير نقطة البداية','origin','','primary')}${button('العودة','close-dialog')}`);return;}
    state.current=id;state.location=l;state.route=route;state.step=0;state.view='route';state.panned=false;persist();renderPanel();fit();
  }
  function segments(){return (state.route?.points||[]).slice(1).map((p,i)=>{const prev=state.route.points[i],dx=p.x-prev.x,dy=p.y-prev.y;return {p,meters:Math.hypot(dx,dy)*(store().metersPerUnit||.01),direction:Math.abs(dx)>Math.abs(dy)?dx>0?'يمين الخريطة':'يسار الخريطة':dy>0?'أسفل الخريطة':'أعلى الخريطة',arrow:Math.abs(dx)>Math.abs(dy)?dx>0?'→':'←':dy>0?'↓':'↑'};});}
  function renderDirections(){
    if(!state.route||!state.current){state.view='search';renderPanel();return;}
    const p=product(state.current),l=state.location,steps=segments(),current=steps[state.step],seconds=Math.max(1,Math.round(state.route.meters/state.speed)),itemIndex=state.list.findIndex(x=>x.id===p.id);
    $('#panelContent').innerHTML=`<div class="route-heading"><span class="overline">${state.listActive&&itemIndex>=0?`المنتج ${itemIndex+1} من ${state.list.length}`:'إلى منتجك، خطوة بخطوة'}</span>${button('تغيير المنتج','search','','text-primary')}</div><div class="selected-product">${art(p)}<div><h2>${esc(p.name)}</h2><p>${esc(brand(p))}</p><span>${esc(p.category)}</span></div></div><div class="route-summary"><div><b>${state.route.meters.toFixed(1)}</b><span>متر مشيًا</span></div><i></i><div><b>${seconds<60?seconds:Math.ceil(seconds/60)}</b><span>${seconds<60?'ثانية تقريبًا':'دقيقة تقريبًا'}</span></div><button data-act="origin" aria-label="إعدادات نقطة البداية وسرعة المشي">⚙</button></div><div class="direction-sign"><span class="direction-arrow" aria-hidden="true">${current?.arrow||'◈'}</span><div><small>الخطوة ${Math.min(state.step+1,steps.length||1)} من ${steps.length||1} · تقدّم يدوي</small><h3>${current?`تابع ${current.meters.toFixed(1)} م نحو ${current.direction}`:'أنت عند نقطة الوصول'}</h3><p>${state.step===0?'من '+esc(state.originLabel):`باتجاه وحدة العرض ${esc(l.shelf)}`} ${state.step===steps.length-1?`· الواجهة ${l.side}`:''}</p></div></div><div class="step-controls">${button('السابقة','prev-step',state.step===0?'disabled':'')}${button('الخطوة التالية','next-step',state.step>=steps.length-1?'disabled':'')}</div><div class="destination-address"><span class="aisle-number"><small>الممر</small>${esc(l.aisle)}</span><div><b>وحدة العرض <bdi>${esc(l.shelf)}</bdi></b><p>الواجهة <bdi>${l.side}</bdi> · الرف ${level(l.level)}</p></div></div>${button('وصلت للرف <span>←</span>','shelf','','primary wide')}<div class="route-secondary">${button('اعرض الرحلة كاملة','fit')}${button('نقطة البداية','origin')}</div><details class="text-route"><summary>الإرشادات النصية الكاملة</summary><p>المسار يبدأ من ${esc(state.originLabel)}. الاتجاهات التالية بالنسبة للخريطة، وليست اتجاه الهاتف.</p><ol>${steps.map(s=>`<li>تابع ${s.meters.toFixed(1)} متر نحو ${s.direction}.</li>`).join('')}<li>${esc(locationText(l))}. القسم ${l.section}، الخانة ${l.position}.</li></ol></details><div class="route-secondary">${state.listActive?button('تخطَّ مؤقتًا','skip'):''}${button('إنهاء الإرشاد','end')}</div><p class="data-note">المسافة محسوبة بالسنتيمتر حسب المخطط المسجّل. لا يوجد تتبّع حي.</p>`;
    $('#mapMessage').innerHTML=`<span>${current?.arrow||'◈'}</span> ${current?`تابع نحو ${current.direction}`:`الوجهة ${esc(l.shelf)}`}<small>وحدة ${esc(l.shelf)} · الواجهة ${l.side}</small>`;
  }
  function fit(){
    const ps=state.route?.points;
    if(ps?.length){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const w=Math.max(460,maxX-minX+240),h=Math.max(380,maxY-minY+170);state.frame=[(minX+maxX-w)/2,(minY+maxY-h)/2,w,h];}
    else state.frame=[25,35,1150,675];state.panned=false;renderMap();
  }
  function mapMarkup(){
    const dest=state.location?.shelf;let markup='<rect x="55" y="60" width="1090" height="615" rx="8" fill="#fffefa"/>';
    for(const e of store().elements){const transform=`transform="rotate(${e.rotation||0} ${e.x+e.w/2} ${e.y+e.h/2})"`;
      if(e.type==='shelf'){const active=e.shelfId===dest;markup+=`<g ${transform}><rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="5" class="fixture ${active?'destination':''}"/><path d="M${e.x+e.w/2} ${e.y+6}v${e.h-12}" stroke="${active?'#92b7f6':'#c4cec9'}" stroke-width="2"/>${[1,2,3].map(n=>`<path d="M${e.x+5} ${e.y+e.h*n/4}h${e.w-10}" stroke="${active?'#92b7f6':'#c4cec9'}"/>`).join('')}<text class="fixture-code" x="${e.x+e.w/2}" y="${e.y+e.h/2}" transform="rotate(-90 ${e.x+e.w/2} ${e.y+e.h/2})">${esc(e.shelfId)}</text>${active?`<text class="face-label" x="${state.location.side==='A'?e.x-13:e.x+e.w+13}" y="${e.y+e.h/2}">${state.location.side}</text>`:''}</g>`;
      }else if(e.type==='wall')markup+=`<rect ${transform} x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="2" fill="#aab6af"/>`;
      else if(e.type==='zone'){const produce=e.id==='zone-produce';markup+=`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="8" fill="${produce?'#eaf1e3':'#f7ecd6'}" fill-opacity=".72"/><text class="zone-label" x="${produce?112:e.x+e.w/2}" y="${produce?e.y+e.h/2:e.y+23}" ${produce?`transform="rotate(-90 112 ${e.y+e.h/2})"`:''}>${esc(e.label)}</text>`;}
      else if(e.type==='text'&&e.id.startsWith('aisle-label'))markup+=`<rect x="${e.x+18}" y="${e.y-18}" width="35" height="30" rx="5" fill="#172e43"/><text class="aisle-label" x="${e.x+35}" y="${e.y+2}">${esc(e.label.replace('الممر ',''))}</text>`;
      else if(e.type==='text')markup+=`<text class="zone-label" x="${e.x+e.w/2}" y="${e.y+e.h/2}">${esc(e.label)}</text>`;
      else if(e.type==='entrance')markup+=`<path d="M${e.x} ${e.y+25}h${e.w}" stroke="#376c99" stroke-width="4"/><text class="zone-label" x="${e.x+e.w/2}" y="${e.y+51}">${esc(e.label)}</text>`;
      else {markup+=`<g ${transform}><rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="5" fill="${e.type==='checkout'?'#d4ded6':'#e0eaee'}" stroke="#b7c6c8"/><text class="zone-label" x="${e.x+e.w/2}" y="${e.y+e.h/2+5}" ${e.h>e.w?`transform="rotate(-90 ${e.x+e.w/2} ${e.y+e.h/2})"`:''}>${esc(e.label||'عائق')}</text></g>`;}
    }
    if(state.route?.points.length){const d=state.route.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');markup+=`<path d="${d}" fill="none" stroke="white" stroke-width="12" stroke-linejoin="round"/><path class="shop-route" d="${d}" fill="none" stroke="#2563eb" stroke-width="5" stroke-linejoin="round"/>`;const end=state.route.accessPoint;markup+=`<g transform="translate(${end.x},${end.y})"><path d="M0 0-15-19v-22h30v22Z" fill="#2563eb" stroke="white" stroke-width="3"/><text x="0" y="-23" text-anchor="middle" fill="white" font-size="17">◈</text></g>`;}
    markup+=`<g transform="translate(${state.origin.x},${state.origin.y})"><circle r="16" fill="#172e43" stroke="white" stroke-width="4"/><path d="m-6 3 6-9 6 9-6-3Z" fill="white"/></g>`;
    return markup;
  }
  function renderMap(){
    const svg=$('#shopMap');svg.innerHTML=mapMarkup();svg.setAttribute('viewBox',state.frame.join(' '));svg.classList.toggle('detail',state.frame[2]<850);svg.classList.toggle('pick-origin',state.picking);
    const rect=svg.getBoundingClientRect(),scale=Math.max(.1,Math.min(rect.width/state.frame[2],rect.height/state.frame[3]));
    if(scale<.6){
      svg.querySelectorAll('.zone-label').forEach(label=>{label.style.fontSize=`${Math.min(42,10/scale)}px`;label.textContent=label.textContent.replace('الخضار والفواكه','خضار').replace('ثلاجات الألبان','الألبان');});
      svg.querySelectorAll('.aisle-label').forEach(label=>{
        const size=Math.min(39,10/scale),badge=label.previousElementSibling,cx=+label.getAttribute('x'),y=+label.getAttribute('y');
        label.style.fontSize=`${size}px`;badge.setAttribute('width',size*1.8);badge.setAttribute('height',size*1.5);badge.setAttribute('x',cx-size*.9);badge.setAttribute('y',y-size*1.12);
      });
    }
    if(!state.route)$('#mapMessage').innerHTML='<span>↑</span> ابدأ من المدخل الرئيسي، واختر منتجك من البحث';
    if(state.picking)$('#mapMessage').innerHTML='<span>⌖</span> اضغط على ممر فارغ لتحديد نقطة البداية';
  }
  function openDialog(title,body,wide=false){
    if(!$('#shopDialog').open)returnFocus=document.activeElement;$('#shopDialog').classList.toggle('shelf-dialog',wide);$('#dialogContent').innerHTML=`<div class="dialog-heading"><h2 id="dialogTitle">${title}</h2>${button('×','close-dialog','aria-label="إغلاق النافذة"','dialog-close')}</div>${body}`;
    if(!$('#shopDialog').open)$('#shopDialog').showModal();
  }
  function closeDialog(){$('#shopDialog').close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else $('#panelContent button')?.focus({preventScroll:true});}
  async function openShelf(){
    if(!state.location)return;const e=shelf(state.location.shelf);if(!e)return;
    state.lastReached=state.route.accessPoint;persist();
    const l=state.location,p=product(state.current),map=$('#shopMap');map.classList.add('shelf-focus');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>{
      const start=performance.now(),from=[...state.frame],to=[e.x-120,e.y-30,e.w+240,e.h+60];
      function frame(now){const progress=Math.min(1,(now-start)/260),t=1-(1-progress)**3;map.setAttribute('viewBox',from.map((v,i)=>v+(to[i]-v)*t).join(' '));if(progress<1)requestAnimationFrame(frame);else resolve();}
      requestAnimationFrame(frame);
    });
    map.classList.remove('shelf-focus');map.setAttribute('viewBox',state.frame.join(' '));
    let elevation='';
    for(let sectionIndex=0;sectionIndex<e.sections;sectionIndex++){
      const section=String.fromCharCode(65+sectionIndex);elevation+=`<div class="front-section"><b class="front-cap">${section}</b>`;
      for(let n=e.levels;n>=1;n--){elevation+=`<div class="front-level"><small>L${String(n).padStart(2,'0')}</small>`;
        for(let pos=1;pos<=3;pos++){const loc=store().locations.find(x=>x.shelf===l.shelf&&x.side===l.side&&x.section===section&&+x.level===n&&+x.position===pos),match=l.section===section&&+l.level===n&&+l.position===pos;elevation+=`<div class="front-slot ${match?'target-slot':''}">${match?'<span class="slot-arrow">↓</span>':''}${loc&&product(loc.productId)?art(product(loc.productId),true):'<span class="shelf-placeholder"></span>'}${match?'<span class="slot-label">هنا</span>':''}</div>`;}
        elevation+='</div>';}
      elevation+='</div>';
    }
    openDialog('وصلت إلى الرف. بقيت العبوة.',`<div class="arrival-layout"><div class="arrival-copy"><span class="arrival-tag">⌖ وحدة العرض <bdi>${esc(e.shelfId)}</bdi> · الواجهة ${l.side}</span><div class="arrival-product">${art(p)}<div><h3>${esc(p.name)}</h3><p>الرف ${level(l.level)}<br>القسم <bdi>${l.section}</bdi> · الخانة ${l.position}</p></div></div><svg class="mini-map" viewBox="25 35 1150 675" aria-label="موضع وحدة العرض داخل المتجر" role="img">${mapMarkup()}</svg><p class="data-note">ترتيب الأقسام كما تراه عند مواجهة الواجهة ${l.side}. يبدأ L01 من الأسفل.</p><details class="location-details"><summary>تفاصيل الموقع</summary><p>${esc(locationText(l))}</p><code dir="ltr">${code(l)}</code>${button('نسخ الرمز','copy-location')}</details></div><div class="front-wrap"><div class="front-title"><b>واجهتك للرف <bdi>${l.side}</bdi></b><span>↓ ابحث عن الخانة المضيئة</span></div><div class="shelf-front" style="--sections:${e.sections}">${elevation}</div></div></div><div class="arrival-actions">${button('✓ وجدته','found','','primary success')}${button('لم أجده','missing')}${button('العودة للمسار','close-dialog')}</div>`,true);
  }
  function found(){
    const item=state.list.find(x=>x.id===state.current);if(item)item.status='found';state.origin={...state.route.accessPoint};state.originLabel=`الرف ${state.location.shelf}`;state.lastReached=state.origin;closeDialog();persist();
    if(state.listActive){const next=state.list.find(x=>x.status==='pending');if(next){go(next.id);notice('تم العثور على المنتج. نرشدك الآن إلى المنتج التالي.');return;}}
    state.view='success';renderPanel();notice('تم تأكيد العثور على المنتج');
  }
  function renderSuccess(){const deferred=state.list.filter(x=>x.status==='deferred').length;$('#panelContent').innerHTML=`<div class="success-state"><span>✓</span><p class="overline">وصلت للعبوة الصحيحة</p><h2>${state.listActive&&!deferred?'اكتملت قائمتك!':'وجدته!'}</h2><p>${esc(product(state.current)?.name||'')}<br>${deferred?`لديك ${deferred} منتجات مؤجّلة في القائمة.`:'خطوة أقل في البحث، وقت أكثر لك.'}</p>${button(deferred?'العودة للمنتجات المؤجّلة':'متابعة التسوّق',deferred?'list':'search','','primary wide')}${button('عرض قائمتي','list','','wide')}</div>`;}
  function startList(){
    const entries=state.list.filter(x=>x.status!=='found').map(item=>{const l=bestLocation(item.id);return {id:item.id,shelf:l&&shelf(l.shelf),location:l};});
    const valid=entries.filter(e=>e.shelf),route=nav.getMultiStopRoute(store(),valid,state.origin),reachable=new Set(route.ordered.map(x=>x.id)),ids=state.manualOrder?entries.filter(x=>reachable.has(x.id)).map(x=>x.id):route.ordered.map(x=>x.id);
    if(!ids.length){notice('لا توجد منتجات بمواقع قابلة للوصول في القائمة.');return;}
    state.list=[...ids.map(id=>({id,status:'pending'})),...state.list.filter(x=>!ids.includes(x.id)).map(x=>x.status==='found'?x:{...x,status:'deferred'})];state.listActive=true;persist();go(ids[0]);if(ids.length<entries.length)notice('بعض المنتجات بلا موقع متاح؛ احتفظنا بها مؤجّلة في قائمتك.');
  }
  function originDialog(){openDialog('نقطة البداية',`<p>اختر مكانًا تعرفه. لا يتتبع هذا النموذج موقعك تلقائيًا.</p><div class="origin-options">${button('↑ المدخل الرئيسي','set-origin','data-value="entrance"')}${button('◈ آخر رف وصلت إليه','set-origin',`data-value="last" ${state.lastReached?'':'disabled'}`)}${button('⌖ تحديد نقطة على الخريطة','pick-origin')}</div><label class="speed-label">سرعة المشي التقديرية <select id="walkSpeed">${[[.8,'هادئة · 0.8 م/ث'],[1.2,'عادية · 1.2 م/ث'],[1.6,'سريعة · 1.6 م/ث']].map(([v,t])=>`<option value="${v}" ${state.speed===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="data-note">زمن المشي لا يشمل وقت اختيار المنتج أو الانتظار.</p>`);}
  function applyOrigin(point,label){const id=state.current;state.origin={...point};state.originLabel=label;state.route=null;state.location=null;state.view='search';persist();renderPanel();fit();if(id)go(id);}
  function missing(){const p=product(state.current),alternatives=store().locations.filter(l=>l.productId===p.id&&code(l)!==code(state.location));openDialog('لنبحث عنه معًا',`<div class="arrival-product">${art(p)}<div><h3>${esc(p.name)}</h3><p>${esc(locationText(state.location))}</p></div></div><p>تأكّد من الحجم والواجهة، ثم انظر إلى القسم ${state.location.section} والخانة ${state.location.position}. وجود الموقع لا يؤكّد توفر المنتج.</p>${alternatives.length?alternatives.map((l,i)=>button(`مكان آخر: ${l.shelf} · الواجهة ${l.side}`,'alternate',`data-index="${i}"`)).join(''):'<p class="data-note">لا يوجد موقع آخر أو بديل مسجّل لهذا المنتج.</p>'}<div class="help-actions">${button('أبلغ عن موقع غير صحيح','report','','primary')}${button('كيف أطلب مساعدة موظف؟','staff')}${button('العودة للرف','shelf')}</div>`);}
  function report(){const reports=read('dawer-reports-v1',[]),record={id:`R-${Date.now()}`,productId:state.current,location:{...state.location},createdAt:new Date().toISOString(),status:'local'};try{localStorage.setItem('dawer-reports-v1',JSON.stringify([...reports,record]));openDialog('حُفظ البلاغ على هذا الجهاز',`<p>البلاغ <bdi>${record.id}</bdi> متاح في إدارة المتجر. لم يُرسل إلى موظف لأن خدمة البلاغات غير مربوطة بعد.</p><p>لم نغيّر موقع المنتج. يمكنك عرض الرمز لموظف خدمة العملاء عند المدخل.</p>${button('العودة للمسار','close-dialog','','primary')}`);}catch{notice('تعذّر حفظ البلاغ. اعرض رمز الموقع لموظف المتجر.');}}
  function end(){state.route=null;state.current=null;state.location=null;state.listActive=false;state.view='search';persist();renderPanel();fit();}
  async function action(act,b){
    if(act==='search')showSearch();
    if(act==='list'){state.view='list';renderPanel();}
    if(act==='reset'){state.query='';state.category='الكل';renderPanel();}
    if(act==='category'){state.category=b.dataset.value;renderPanel();}
    if(act==='go')go(b.dataset.id);
    if(act==='add')add(b.dataset.id);
    if(act==='remove'){state.list=state.list.filter(x=>x.id!==b.dataset.id);persist();renderPanel();}
    if(act==='reorder'){const i=state.list.findIndex(x=>x.id===b.dataset.id);if(i>0)[state.list[i-1],state.list[i]]=[state.list[i],state.list[i-1]];state.manualOrder=true;persist();renderPanel();notice('حُفظ الترتيب اليدوي، وستبدأ الرحلة بهذا الترتيب.');}
    if(act==='start-list')startList();
    if(act==='resume'){if(state.current)go(state.current);else startList();}
    if(act==='shelf')await openShelf();
    if(act==='found')found();
    if(act==='missing')missing();
    if(act==='report')report();
    if(act==='staff')openDialog('مساعدة داخل المتجر','<p>توجّه إلى موظف خدمة العملاء عند المدخل الرئيسي، وأظهر له اسم المنتج ورمز موقعه.</p><p>طلب الموظف إلكترونيًا غير متاح في هذه النسخة.</p>'+button('العودة للمسار','close-dialog','','primary'));
    if(act==='alternate'){const list=store().locations.filter(l=>l.productId===state.current&&code(l)!==code(state.location));closeDialog();go(state.current,list[+b.dataset.index]);}
    if(act==='copy-location'){try{await navigator.clipboard.writeText(code(state.location));notice('نُسخ رمز الموقع');}catch{notice('تعذّر النسخ. يمكنك تحديد الرمز ونسخه يدويًا.');}}
    if(act==='skip'){const item=state.list.find(x=>x.id===state.current);if(item)item.status='deferred';persist();const next=state.list.find(x=>x.status==='pending');if(next)go(next.id);else{state.view='list';renderPanel();}}
    if(act==='end')end();
    if(act==='next-step'||act==='prev-step'){state.step=Math.max(0,Math.min(segments().length-1,state.step+(act==='next-step'?1:-1)));renderDirections();}
    if(act==='fit')fit();
    if(act==='origin')originDialog();
    if(act==='set-origin'){const p=b.dataset.value==='last'?state.lastReached:store().entrance;closeDialog();applyOrigin(p,b.dataset.value==='last'?'آخر رف وصلت إليه':'المدخل الرئيسي');}
    if(act==='pick-origin'){closeDialog();state.picking=true;state.frame=[25,35,1150,675];renderMap();notice('اضغط على ممر فارغ. يمكنك استخدام الأسهم ثم Enter على الخريطة.');$('#shopMap').focus();}
    if(act==='zoom-in'||act==='zoom-out'){const [x,y,w,h]=state.frame,f=act==='zoom-in'?.8:1.25,nw=Math.max(200,Math.min(1600,w*f)),nh=h*nw/w;state.frame=[x+(w-nw)/2,y+(h-nh)/2,nw,nh];state.panned=true;renderMap();}
    if(act==='close-dialog')closeDialog();
    if(act==='sheet'){const expanded=root.classList.toggle('sheet-expanded');b.setAttribute('aria-expanded',expanded);}
    if(act==='admin'){root.hidden=true;$('#appShell').hidden=false;editor().activate('build');}
  }
  root.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)action(b.dataset.act,b);});
  root.addEventListener('input',e=>{if(e.target.id==='shopSearch'){state.query=e.target.value;renderResults();}});
  root.addEventListener('keydown',e=>{if(e.target.id==='shopSearch'&&e.key==='Enter'){const first=$('#searchResults [data-act="go"]');if(first)go(first.dataset.id);}});
  root.addEventListener('change',e=>{if(e.target.id==='walkSpeed'){state.speed=+e.target.value;persist();if(state.route)renderDirections();}});
  $('#shopDialog').addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  $('#shopDialog').addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const focusable=[...event.currentTarget.querySelectorAll('button:not(:disabled),input,select,summary,a[href]')].filter(e=>e.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
  const svg=$('#shopMap');
  function mapPoint(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  function selectOrigin(p){const point={x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10},blocked=nav.buildBlocked(store().elements);if(point.x<0||point.y<0||point.x>1200||point.y>720||blocked.has(`${point.x/10},${point.y/10}`)){notice('هذه نقطة خارج المخطط أو داخل عائق. اختر ممرًا فارغًا.');return;}state.picking=false;applyOrigin(point,'النقطة المحدّدة على الخريطة');}
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(state.picking){selectOrigin(mapPoint(e));return;}drag={point:mapPoint(e),frame:[...state.frame]};svg.setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const p=mapPoint(e),dx=p.x-drag.point.x,dy=p.y-drag.point.y;state.frame=[state.frame[0]-dx,state.frame[1]-dy,state.frame[2],state.frame[3]];state.panned=true;svg.setAttribute('viewBox',state.frame.join(' '));});
  svg.addEventListener('pointerup',()=>drag=null);svg.addEventListener('pointercancel',()=>drag=null);
  svg.addEventListener('keydown',e=>{const arrows={ArrowUp:[0,-10],ArrowDown:[0,10],ArrowLeft:[-10,0],ArrowRight:[10,0]};if(arrows[e.key]){e.preventDefault();if(state.picking){state.origin={x:state.origin.x+arrows[e.key][0],y:state.origin.y+arrows[e.key][1]};renderMap();}else{state.frame[0]+=arrows[e.key][0]*4;state.frame[1]+=arrows[e.key][1]*4;renderMap();}}if(e.key==='Enter'&&state.picking)selectOrigin(state.origin);});
  const handle=$('.sheet-handle');handle.addEventListener('pointerdown',e=>{sheetDrag=e.clientY;handle.setPointerCapture(e.pointerId);});handle.addEventListener('pointerup',e=>{if(sheetDrag!==null&&Math.abs(e.clientY-sheetDrag)>25){root.classList.toggle('sheet-expanded',e.clientY<sheetDrag);handle.setAttribute('aria-expanded',root.classList.contains('sheet-expanded'));}sheetDrag=null;});
  function connection(){root.classList.toggle('offline',!navigator.onLine);if(!navigator.onLine)notice('لا يوجد اتصال. يمكنك استخدام الخريطة المحفوظة على هذا الجهاز.');}
  window.addEventListener('offline',connection);window.addEventListener('online',()=>{connection();notice('عاد الاتصال؛ ما زالت بيانات المتجر في هذا النموذج محلية.');});
  window.addEventListener('resize',()=>{if(!root.hidden)renderMap();});
  window.DawerShopper={show(){root.hidden=false;$('#appShell').hidden=true;const id=state.current,step=state.step,view=state.view;if(id&&state.route){state.route=null;state.location=null;state.view='search';renderPanel();fit();go(id);if(state.route){state.step=Math.min(step,Math.max(0,segments().length-1));state.view=view;renderPanel();}}else{renderPanel();fit();}},notice,art};
  if(state.current){go(state.current);}else{renderPanel();renderMap();}connection();
  $('#bootStatus').remove();
})();
