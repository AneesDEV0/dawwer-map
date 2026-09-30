(function () {
  "use strict";

  const { tools, products, createDemoStore, createEmptyStore } = window.DawerData;
  const navigation = window.DawerNavigation;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const snap = value => $("#snapEnabled")?.checked === false ? Math.round(value) : Math.round(value / 10) * 10;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const dom = {
    shell: $("#appShell"),
    viewport: $("#mapViewport"),
    surface: $("#mapSurface"),
    elements: $("#mapElements"),
    selection: $("#selectionBox"),
    toolList: $("#toolList"),
    productList: $("#productList"),
    productSearch: $("#productSearch"),
    productCount: $("#productCount"),
    inspectorTitle: $("#inspectorTitle"),
    inspector: $("#inspectorContent"),
    routePath: $("#routePath"),
    routeHalo: $("#routeHalo"),
    routePins: $("#routePins"),
    navigationSearch: $("#navigationSearch"),
    navigationInput: $("#navigationInput"),
    searchSuggestions: $("#searchSuggestions"),
    navigationCard: $("#navigationCard"),
    destinationTip: $("#destinationTip"),
    shelfWorkspace: $("#shelfWorkspace"),
    shelfElevation: $("#shelfElevation"),
    sectionsInput: $("#sectionsInput"),
    levelsInput: $("#levelsInput"),
    placementBanner: $("#placementBanner"),
    contextMenu: $("#contextMenu"),
    helpPopover: $("#helpPopover"),
    toastStack: $("#toastStack"),
    zoomValue: $("#zoomValue")
  };

  const state = {
    store: createDemoStore(),
    mode: "build",
    activeTool: "select",
    panTool: false,
    selectedElementId: null,
    selectedProductId: null,
    currentShelfId: null,
    pendingProductId: null,
    highlightedProductId: null,
    selectedPosition: { section: "B", level: 3, position: 2 },
    draggedProductId: null,
    zoom: 0.84,
    pan: { x: 55, y: 75 },
    pointerAction: null,
    undo: [],
    redo: [],
    route: null,
    spacePressed: false,
    layerVisibility: { fixtures: true, zones: true, navgrid: false }
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function productById(id) { return state.store.products.find(product => product.id === id); }
  function elementById(id) { return state.store.elements.find(element => element.id === id); }
  function shelfByCode(code) { return state.store.elements.find(element => element.type === "shelf" && element.shelfId === code); }
  function locationForProduct(productId) { return state.store.locations.find(location => location.productId === productId); }
  function productsOnShelf(shelfId) { return state.store.locations.filter(location => location.shelf === shelfId); }
  function selectedElement() { return elementById(state.selectedElementId); }

  function locationCode(location) {
    if (!location) return "غير موزّع";
    return `A${location.aisle}-${location.shelf.replace("-", "")}-${location.side}-${location.section}-L${String(location.level).padStart(2, "0")}-P${String(location.position).padStart(2, "0")}`;
  }

  function snapshot() { return JSON.stringify(state.store); }
  function rememberSnapshot() {
    state.undo.push(snapshot());
    if (state.undo.length > 40) state.undo.shift();
    state.redo = [];
    updateHistoryButtons();
  }
  function restoreSnapshot(serialized) {
    state.store = JSON.parse(serialized);
    state.selectedElementId = null;
    state.selectedProductId = null;
    closeShelfDetail();
    clearRoute();
    renderMap();
    renderInspector();
  }
  function undo() {
    if (!state.undo.length) return;
    state.redo.push(snapshot());
    restoreSnapshot(state.undo.pop());
    updateHistoryButtons();
    showToast("تم التراجع", "أُعيدت الخريطة إلى حالتها السابقة.", "↶");
  }
  function redo() {
    if (!state.redo.length) return;
    state.undo.push(snapshot());
    restoreSnapshot(state.redo.pop());
    updateHistoryButtons();
    showToast("تمت الإعادة", "طُبّق تعديل الخريطة مرة أخرى.", "↷");
  }
  function updateHistoryButtons() {
    $("#undoButton").disabled = !state.undo.length;
    $("#redoButton").disabled = !state.redo.length;
  }

  function renderTools() {
    dom.toolList.innerHTML = tools.map(tool => `
      <button class="tool-item ${tool.id === state.activeTool ? "is-active" : ""}" data-tool="${tool.id}" title="${tool.label} (${tool.shortcut})">
        <span class="tool-glyph" aria-hidden="true">${tool.glyph}</span><span>${tool.label}</span>
      </button>`).join("");
  }

  function renderProducts(query = "") {
    const normalized = query.trim().toLowerCase();
    const list = state.store.products.filter(product => [product.name, product.sku, product.category, product.searchTerms].join(" ").toLowerCase().includes(normalized));
    dom.productCount.textContent = list.length;
    dom.productList.innerHTML = list.map(product => `
      <article class="product-card" draggable="true" data-product-id="${product.id}" tabindex="0" aria-label="اسحب ${escapeHtml(product.name)} إلى رف">
        ${window.DawerShopper ? window.DawerShopper.art(product, true) : `<span class="product-thumb" style="background:${product.color}">▣</span>`}
        <div><h3>${escapeHtml(product.name)}</h3><p>${product.sku} · ${escapeHtml(product.category)}</p></div>
        <span class="drag-dots" aria-hidden="true">⠿</span>
      </article>`).join("") || `<div class="inspector-empty"><b>لم نجد منتجات</b><p>جرّب اسم المنتج أو رمز SKU أو اسم الفئة.</p></div>`;
  }

  function renderShoppingList() {
    const ids = ["P1001", "P1008", "P1004", "P1010"];
    $("#shoppingItems").innerHTML = ids.map((id, index) => {
      const product = productById(id);
      return `<label class="shopping-check"><input type="checkbox" value="${id}" ${index < 4 ? "checked" : ""}><span>${escapeHtml(product.name)}</span></label>`;
    }).join("");
  }

  function objectMarkup(element) {
    const common = `class="map-object ${element.type}" data-id="${escapeHtml(element.id)}" tabindex="0" role="button" aria-label="${escapeHtml(element.shelfId || element.label || typeLabel(element.type))}" data-layer="${element.type === "zone" || element.type === "text" || element.type === "aisle" ? "zones" : "fixtures"}" style="left:${element.x}px;top:${element.y}px;width:${element.w}px;height:${element.h}px;transform:rotate(${element.rotation || 0}deg)"`;
    if (element.type === "shelf") {
      return `<div ${common} title="انقر نقرًا مزدوجًا لفتح ${escapeHtml(element.shelfId)}">
        <i class="shelf-end"></i><i class="shelf-end"></i><span class="side-tag">A</span><span class="side-tag b">B</span>
        <span class="object-label"><b>${escapeHtml(element.shelfId)}</b><small>الممر ${escapeHtml(element.aisle)}</small></span>
      </div>`;
    }
    if (element.type === "zone") return `<div ${common}><span class="object-label"><b>${escapeHtml(element.label)}</b><small>${escapeHtml(element.sublabel || "منطقة")}</small></span></div>`;
    if (["freezer", "fridge", "checkout", "entrance", "text", "aisle"].includes(element.type)) return `<div ${common}>${escapeHtml(element.label || element.type.toUpperCase())}</div>`;
    return `<div ${common} title="${escapeHtml(typeLabel(element.type))}"></div>`;
  }

  function renderMap() {
    $("#canvasStatus").textContent = `الطابق 01 · ${state.store.name}`;
    dom.elements.innerHTML = state.store.elements.map(objectMarkup).join("");
    state.store.elements.forEach(element => {
      const node = dom.elements.querySelector(`[data-id="${CSS.escape(element.id)}"]`);
      if (!node) return;
      const layer = node.dataset.layer;
      node.classList.toggle("is-hidden-layer", state.layerVisibility[layer] === false);
      node.classList.toggle("is-selected", element.id === state.selectedElementId);
      if (state.route?.shelfId && element.type === "shelf") node.classList.toggle("is-destination", element.id === state.route.shelfId);
    });
    updateSelectionBox();
  }

  function updateSelectionBox() {
    const element = selectedElement();
    if (!element || dom.shelfWorkspace.classList.contains("is-visible")) {
      dom.selection.hidden = true;
      return;
    }
    dom.selection.hidden = false;
    Object.assign(dom.selection.style, {
      left: `${element.x}px`, top: `${element.y}px`, width: `${element.w}px`, height: `${element.h}px`, transform: `rotate(${element.rotation || 0}deg)`
    });
  }

  function selectElement(id) {
    state.selectedElementId = id;
    state.selectedProductId = null;
    $$(".map-object.is-selected").forEach(node => node.classList.remove("is-selected"));
    const node = dom.elements.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (node) node.classList.add("is-selected");
    updateSelectionBox();
    renderInspector();
  }

  function clearSelection() {
    state.selectedElementId = null;
    state.selectedProductId = null;
    $$(".map-object.is-selected").forEach(node => node.classList.remove("is-selected"));
    dom.selection.hidden = true;
    renderInspector();
  }

  function renderInspector() {
    if (state.selectedProductId) return renderProductInspector(state.selectedProductId);
    const element = selectedElement();
    if (!element) {
      dom.inspectorTitle.textContent = "مخطط المتجر";
      const shelves = state.store.elements.filter(item => item.type === "shelf").length;
      dom.inspector.innerHTML = `<div class="inspector-empty">
        <div class="empty-diagram"></div><b>اختر عنصرًا من الخريطة</b><p>ستظهر هنا أبعاده وإعداداته. انقر نقرًا مزدوجًا على الرف لتحديد مواقع المنتجات.</p>
      </div><div class="inspector-group"><div class="property-row"><span>العناصر</span><b>${state.store.elements.length}</b></div><div class="property-row"><span>الرفوف</span><b>${shelves}</b></div><div class="property-row"><span>الشبكة</span><b>التقاط كل 10 سم</b></div></div>`;
      dom.shell.classList.add("inspector-idle");
      return;
    }
    dom.shell.classList.remove("inspector-idle");
    dom.inspectorTitle.textContent = element.type === "shelf" ? `الرف ${element.shelfId}` : typeLabel(element.type);
    const identityTitle = element.type === "shelf" ? `الرف ${element.shelfId}` : typeLabel(element.type);
    const identityMeta = element.type === "shelf" ? `الممر ${element.aisle} · الجانبان A / B` : (element.label || "عنصر في الخريطة");
    dom.inspector.innerHTML = `<div class="inspector-group">
      <div class="object-identity"><span class="object-icon">${element.type === "shelf" ? "رف" : typeLabel(element.type).slice(0,2)}</span><div><h3>${escapeHtml(identityTitle)}</h3><p>${escapeHtml(identityMeta)}</p></div></div>
    </div>
    <div class="inspector-group">
      <div class="inspector-group-title"><span>الأبعاد والموضع</span><span>شبكة 10</span></div>
      <div class="field-grid">
        <div class="inspector-field full"><label>اسم العنصر</label><input data-property="label" value="${escapeHtml(element.label || "")}"></div>
        <div class="property-row"><span>المعرّف</span><bdi>${escapeHtml(element.id)}</bdi></div>
        <div class="inspector-field"><label>العرض</label><input data-property="w" type="number" min="20" value="${Math.round(element.w)}"></div>
        <div class="inspector-field"><label>العمق / الارتفاع</label><input data-property="h" type="number" min="20" value="${Math.round(element.h)}"></div>
        <div class="inspector-field"><label>المحور X</label><input data-property="x" type="number" value="${Math.round(element.x)}"></div>
        <div class="inspector-field"><label>المحور Y</label><input data-property="y" type="number" value="${Math.round(element.y)}"></div>
        <div class="inspector-field full"><label>زاوية الدوران</label><input data-property="rotation" type="number" step="15" value="${element.rotation || 0}"></div>
      </div>
    </div>
    ${element.type === "shelf" ? `<div class="inspector-group"><div class="inspector-group-title"><span>بنية الرف</span><span>الجانب A</span></div><div class="field-grid">
      <div class="inspector-field"><label>رمز الرف</label><input data-property="shelfId" value="${escapeHtml(element.shelfId)}"></div>
      <div class="inspector-field"><label>رقم الممر</label><input data-property="aisle" value="${escapeHtml(element.aisle)}"></div>
      <div class="inspector-field"><label>عدد الأقسام</label><input data-property="sections" type="number" min="1" max="6" value="${element.sections}"></div>
      <div class="inspector-field"><label>عدد المستويات</label><input data-property="levels" type="number" min="1" max="6" value="${element.levels}"></div>
    </div></div>` : ""}
    <div class="inspector-actions">
      ${element.type === "shelf" ? `<button class="action-primary" data-action="split-shelf">فتح الرف وتقسيمه</button>` : ""}
      <button data-action="duplicate">إنشاء نسخة</button><button data-action="rotate">تدوير 90°</button>
      <button data-action="front">إلى الأمام</button><button data-action="back">إلى الخلف</button>
      <button class="action-danger" data-action="delete">حذف</button>
    </div>`;
  }

  function renderProductInspector(productId) {
    dom.shell.classList.remove("inspector-idle");
    const product = productById(productId);
    const location = locationForProduct(productId);
    if (!product) return;
    dom.inspectorTitle.textContent = product.shortName;
    dom.inspector.innerHTML = `<div class="inspector-group">
      <div class="object-identity">${window.DawerShopper ? window.DawerShopper.art(product, true) : '<span>▣</span>'}<div><h3>${escapeHtml(product.name)}</h3><p>${product.sku} · ${escapeHtml(product.category)}</p></div></div>
    </div>
    ${location ? `<div class="inspector-group"><div class="inspector-group-title"><span>الموقع داخل المتجر</span><span>محدّث</span></div>
      <div class="property-row"><span>الممر</span><b>${location.aisle}</b></div><div class="property-row"><span>الرف</span><b>${location.shelf}</b></div>
      <div class="property-row"><span>القسم</span><b>${location.section}</b></div><div class="property-row"><span>المستوى</span><b>${String(location.level).padStart(2,"0")}</b></div>
      <div class="property-row"><span>الموضع</span><b>${String(location.position).padStart(2,"0")}</b></div></div>
      <div class="inspector-group"><div class="inspector-group-title"><span>رمز الموقع الكامل</span></div><div class="location-code-box">${locationCode(location)}</div></div>` : `<div class="inspector-group"><p class="panel-note">لم يُوزّع هذا المنتج بعد. اسحبه من قائمة المنتجات إلى رف لتحديد موقعه.</p></div>`}
    <div class="inspector-actions">
      ${location ? `<button class="action-primary" data-product-action="locate">تحديده على الخريطة</button><button data-product-action="move">نقل المنتج</button><button class="action-danger" data-product-action="remove">إزالة</button>` : `<button class="action-primary" data-product-action="move">توزيع المنتج</button>`}
    </div>`;
  }

  function typeLabel(value) {
    return ({ shelf: "رف", wall: "جدار", entrance: "مدخل", freezer: "مجمّد", fridge: "ثلاجة", checkout: "صندوق دفع", obstacle: "عائق", text: "تسمية", aisle: "ممر", zone: "منطقة" })[value] || value;
  }

  function screenToSurface(clientX, clientY) {
    const rect = dom.surface.getBoundingClientRect();
    return { x: (clientX - rect.left) / state.zoom, y: (clientY - rect.top) / state.zoom };
  }

  function applyTransform(animated = false) {
    if (animated) dom.surface.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)";
    dom.surface.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    dom.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    if (animated) setTimeout(() => { dom.surface.style.transition = ""; }, 650);
    positionDestinationTip();
  }

  function fitToScreen(animated = false) {
    const rect = dom.viewport.getBoundingClientRect();
    state.zoom = clamp(Math.min((rect.width - 45) / 1200, (rect.height - 85) / 720), .15, 1.15);
    state.pan.x = (rect.width - 1200 * state.zoom) / 2;
    state.pan.y = (rect.height - 720 * state.zoom) / 2 + 15;
    applyTransform(animated);
  }

  function setZoom(nextZoom, anchor) {
    const rect = dom.viewport.getBoundingClientRect();
    const point = anchor || { x: rect.width / 2, y: rect.height / 2 };
    const surfaceX = (point.x - state.pan.x) / state.zoom;
    const surfaceY = (point.y - state.pan.y) / state.zoom;
    state.zoom = clamp(nextZoom, .35, 1.8);
    state.pan.x = point.x - surfaceX * state.zoom;
    state.pan.y = point.y - surfaceY * state.zoom;
    applyTransform();
  }

  function zoomToElement(element) {
    const rect = dom.viewport.getBoundingClientRect();
    const targetZoom = clamp(Math.min(rect.width / Math.max(element.w * 6, 520), rect.height / Math.max(element.h * 2.8, 430)), .75, 1.28);
    state.zoom = targetZoom;
    state.pan.x = rect.width / 2 - (element.x + element.w / 2) * targetZoom;
    state.pan.y = rect.height / 2 - (element.y + element.h / 2) * targetZoom;
    applyTransform(true);
  }

  function startObjectDrag(event, element) {
    if (state.mode !== "build" || state.activeTool !== "select") return;
    event.preventDefault();
    const node = event.target.closest(".map-object");
    state.pointerAction = { type: "move", id: element.id, startX: event.clientX, startY: event.clientY, x: element.x, y: element.y, node, remembered: false };
    node.setPointerCapture?.(event.pointerId);
  }

  function startResize(event, direction) {
    const element = selectedElement();
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    state.pointerAction = { type: "resize", direction, startX: event.clientX, startY: event.clientY, x: element.x, y: element.y, w: element.w, h: element.h, remembered: false };
  }

  function startPan(event) {
    state.pointerAction = { type: "pan", startX: event.clientX, startY: event.clientY, x: state.pan.x, y: state.pan.y };
    dom.viewport.classList.add("is-panning");
  }

  function onPointerMove(event) {
    const action = state.pointerAction;
    if (!action) return;
    if (action.type === "pan") {
      state.pan.x = action.x + event.clientX - action.startX;
      state.pan.y = action.y + event.clientY - action.startY;
      applyTransform();
      return;
    }
    const element = selectedElement();
    if (!element) return;
    if (!action.remembered && Math.hypot(event.clientX - action.startX, event.clientY - action.startY) > 2) {
      rememberSnapshot();
      action.remembered = true;
    }
    if (!action.remembered) return;
    const dx = (event.clientX - action.startX) / state.zoom;
    const dy = (event.clientY - action.startY) / state.zoom;
    if (action.type === "move") {
      element.x = clamp(snap(action.x + dx), 0, 1200 - element.w);
      element.y = clamp(snap(action.y + dy), 0, 720 - element.h);
    } else if (action.type === "resize") {
      const minW = element.type === "wall" ? 10 : 30;
      const minH = element.type === "wall" ? 8 : 20;
      if (action.direction.includes("e")) element.w = Math.max(minW, snap(action.w + dx));
      if (action.direction.includes("s")) element.h = Math.max(minH, snap(action.h + dy));
      if (action.direction.includes("w")) { element.x = snap(action.x + dx); element.w = Math.max(minW, snap(action.w - dx)); }
      if (action.direction.includes("n")) { element.y = snap(action.y + dy); element.h = Math.max(minH, snap(action.h - dy)); }
    }
    const node = dom.elements.querySelector(`[data-id="${CSS.escape(element.id)}"]`);
    if (node) Object.assign(node.style, { left: `${element.x}px`, top: `${element.y}px`, width: `${element.w}px`, height: `${element.h}px` });
    updateSelectionBox();
  }

  function onPointerUp() {
    if (state.pointerAction?.remembered) {
      renderInspector();
      showToast("تم تحديث الخريطة", "ثُبّتت التغييرات على شبكة التخطيط بدقة 10 سم.", "✓");
    }
    state.pointerAction = null;
    dom.viewport.classList.toggle("is-panning", state.panTool);
  }

  function addElement(type, point) {
    rememberSnapshot();
    const id = `${type}-${Date.now()}`;
    const presets = {
      wall: { w: 150, h: 9 }, entrance: { w: 100, h: 28, label: "مدخل" }, shelf: { w: 42, h: 150 },
      "double-shelf": { w: 62, h: 170 }, freezer: { w: 150, h: 34, label: "مجمّد" }, fridge: { w: 150, h: 34, label: "ثلاجة" },
      checkout: { w: 95, h: 26, label: "جديد" }, obstacle: { w: 45, h: 45 }, text: { w: 120, h: 24, label: "منطقة جديدة" }, aisle: { w: 52, h: 190, label: "ممر" }
    };
    const preset = presets[type] || presets.shelf;
    const normalizedType = type === "double-shelf" ? "shelf" : type;
    const element = { id, type: normalizedType, x: clamp(snap(point.x - preset.w / 2), 0, 1200 - preset.w), y: clamp(snap(point.y - preset.h / 2), 0, 720 - preset.h), w: preset.w, h: preset.h, rotation: 0, ...preset };
    if (normalizedType === "shelf") {
      const numbers = state.store.elements.filter(item => item.type === "shelf").map(item => Number(String(item.shelfId).replace(/\D/g, "")) || 0);
      element.shelfId = `S-${String(Math.max(0, ...numbers) + 1).padStart(2, "0")}`;
      element.aisle = "01";
      element.sections = 4;
      element.levels = 5;
      element.isDouble = type === "double-shelf";
    }
    state.store.elements.push(element);
    renderMap();
    selectElement(element.id);
    state.activeTool = "select";
    renderTools();
    showToast(`تمت إضافة ${typeLabel(normalizedType)}`, "اسحب العنصر لتحريكه، واستخدم المقابض لتغيير حجمه.", "+");
  }

  function deleteSelected() {
    const element = selectedElement();
    if (!element) return;
    rememberSnapshot();
    state.store.elements = state.store.elements.filter(item => item.id !== element.id);
    if (element.type === "shelf") state.store.locations = state.store.locations.filter(location => location.shelf !== element.shelfId);
    clearSelection();
    renderMap();
    showToast("تم حذف العنصر", "حُدّث مخطط المتجر.", "×");
  }

  function duplicateSelected() {
    const element = selectedElement();
    if (!element) return;
    rememberSnapshot();
    const copy = JSON.parse(JSON.stringify(element));
    copy.id = `${element.type}-${Date.now()}`;
    copy.x = clamp(element.x + 20, 0, 1200 - element.w);
    copy.y = clamp(element.y + 20, 0, 720 - element.h);
    if (copy.type === "shelf") {
      const numbers = state.store.elements.filter(item => item.type === "shelf").map(item => Number(String(item.shelfId).replace(/\D/g, "")) || 0);
      copy.shelfId = `S-${String(Math.max(0, ...numbers) + 1).padStart(2, "0")}`;
    }
    state.store.elements.push(copy);
    renderMap();
    selectElement(copy.id);
    showToast("تم إنشاء نسخة", `${copy.shelfId || typeLabel(copy.type)} جاهز للتعديل.`, "＋");
  }

  function rotateSelected() {
    const element = selectedElement();
    if (!element) return;
    rememberSnapshot();
    element.rotation = ((element.rotation || 0) + 90) % 360;
    renderMap();
    renderInspector();
  }

  function openShelfDetail(shelfId, options = {}) {
    const shelf = state.store.elements.find(element => element.type === "shelf" && (element.id === shelfId || element.shelfId === shelfId));
    if (!shelf) return;
    state.currentShelfId = shelf.id;
    state.pendingProductId = options.pendingProductId || null;
    state.highlightedProductId = options.highlightedProductId || null;
    state.selectedElementId = shelf.id;
    state.selectedPosition = options.position || state.selectedPosition;
    dom.shelfWorkspace.classList.add("is-visible");
    renderShelfDetail();
    renderInspector();
  }

  function closeShelfDetail() {
    dom.shelfWorkspace.classList.remove("is-visible");
    state.currentShelfId = null;
    state.pendingProductId = null;
    state.highlightedProductId = null;
    updateSelectionBox();
  }

  function renderShelfDetail() {
    const shelf = elementById(state.currentShelfId);
    if (!shelf) return;
    $("#shelfDetailTitle").textContent = `الرف ${shelf.shelfId}`;
    $("#crumbAisle").textContent = `الممر ${shelf.aisle}`;
    $("#crumbShelf").textContent = `الرف ${shelf.shelfId}`;
    dom.sectionsInput.value = shelf.sections;
    dom.levelsInput.value = shelf.levels;
    dom.shelfElevation.style.gridTemplateColumns = `repeat(${shelf.sections}, minmax(0, 1fr))`;
    const placed = productsOnShelf(shelf.shelfId).filter(l => (l.side || "A") === $("#shelfSide").value);
    let markup = "";
    for (let sectionIndex = 0; sectionIndex < shelf.sections; sectionIndex += 1) {
      const section = String.fromCharCode(65 + sectionIndex);
      markup += `<div class="shelf-section" style="grid-template-rows:repeat(${shelf.levels},minmax(62px,1fr))"><span class="section-cap">القسم ${section}</span>`;
      for (let visualLevel = shelf.levels; visualLevel >= 1; visualLevel -= 1) {
        markup += `<div class="shelf-level"><span class="level-tag">L${String(visualLevel).padStart(2,"0")}</span>`;
        for (let position = 1; position <= 3; position += 1) {
          const location = placed.find(item => item.section === section && Number(item.level) === visualLevel && Number(item.position) === position);
          const product = location ? productById(location.productId) : null;
          const highlighted = product && product.id === state.highlightedProductId;
          markup += `<div class="position-slot ${highlighted ? "is-highlighted" : ""}" data-section="${section}" data-level="${visualLevel}" data-position="${position}" tabindex="0">`;
          if (product) markup += `<button class="cell-product" data-product-id="${product.id}" title="${escapeHtml(product.name)} · ${locationCode(location)}">${window.DawerShopper ? window.DawerShopper.art(product, true) : '<span>▣</span>'}</button>`;
          markup += `</div>`;
        }
        markup += `</div>`;
      }
      markup += `</div>`;
    }
    dom.shelfElevation.innerHTML = markup;
    const pending = productById(state.pendingProductId);
    dom.placementBanner.classList.toggle("is-visible", Boolean(pending));
    if (pending) {
      $("#pendingProductName").textContent = pending.name;
      $("#pendingProductToken").textContent = pending.initials;
      $("#pendingProductToken").style.background = pending.color;
      $("#pendingProductToken").draggable = true;
    }
    updateLocationReadout();
  }

  function updateLocationReadout(position = state.selectedPosition) {
    const shelf = elementById(state.currentShelfId);
    if (!shelf) return;
    state.selectedPosition = position;
    const location = { aisle: shelf.aisle, shelf: shelf.shelfId, ...position, side: $("#shelfSide").value };
    $("#locationCode").textContent = locationCode(location);
    $("#locationDescription").textContent = `الممر ${shelf.aisle} · الرف ${shelf.shelfId} · الواجهة ${location.side} · القسم ${position.section} · المستوى ${position.level} من أسفل · الموضع ${position.position}`;
  }

  function placeProduct(productId, position) {
    const shelf = elementById(state.currentShelfId);
    const product = productById(productId);
    if (!shelf || !product) return;
    const side = $("#shelfSide").value;
    const occupied = state.store.locations.find(l => l.shelf === shelf.shelfId && l.side === side && l.section === position.section && +l.level === +position.level && +l.position === +position.position);
    if (occupied && occupied.productId !== productId) return showToast("الخانة مشغولة", "اختر خانة فارغة؛ لن نحذف موقع منتج آخر.", "!");
    rememberSnapshot();
    if (!$("#additionalLocation").checked) state.store.locations = state.store.locations.filter(location => location.productId !== productId);
    else if (occupied) return showToast("الموقع موجود", "هذا المنتج موزّع بالفعل في هذه الخانة.", "!");
    const location = { productId, aisle: shelf.aisle, shelf: shelf.shelfId, side, section: position.section, level: Number(position.level), position: Number(position.position) };
    state.store.locations.push(location);
    state.pendingProductId = null;
    state.highlightedProductId = productId;
    state.selectedProductId = productId;
    updateLocationReadout(position);
    renderShelfDetail();
    renderProductInspector(productId);
    showToast("تم توزيع المنتج بنجاح", `رمز الموقع: ${locationCode(location)}`, "✓");
  }

  function setMode(mode) {
    if (mode === "navigate" && window.DawerShopper) return window.DawerShopper.show();
    state.mode = mode;
    state.activeTool = "select";
    state.panTool = false;
    dom.viewport.classList.remove("is-panning");
    $$(".mode-button").forEach(button => button.classList.toggle("is-active", button.dataset.mode === mode));
    $$(".mode-panel").forEach(panel => panel.classList.remove("is-active"));
    $(`#${mode === "build" ? "build" : mode === "products" ? "products" : "navigate"}Panel`).classList.add("is-active");
    const copy = {
      build: ["مخطط المتجر", "ابنِ المتجر"], products: ["مكتبة المنتجات", "وزّع المنتجات"], navigate: ["الملاحة الذكية", "تنقّل داخل المتجر"]
    }[mode];
    $("#leftEyebrow").textContent = copy[0];
    $("#leftTitle").textContent = copy[1];
    dom.navigationSearch.classList.toggle("is-visible", mode === "navigate" && !state.route);
    if (mode !== "navigate") clearRoute();
    if (mode === "navigate") {
      closeShelfDetail();
      setTimeout(() => dom.navigationInput.focus(), 280);
      renderSuggestions(dom.navigationInput.value);
    }
    renderTools();
  }

  function renderSuggestions(query = "") {
    const normalized = query.trim().toLowerCase();
    const list = state.store.products.filter(product => {
      const location = locationForProduct(product.id);
      return location && (!normalized || [product.name, product.category, product.sku, product.searchTerms].join(" ").toLowerCase().includes(normalized));
    }).slice(0, 5);
    dom.searchSuggestions.innerHTML = list.map(product => {
      const location = locationForProduct(product.id);
      return `<button class="suggestion" data-product-id="${product.id}"><span class="product-thumb" style="background:${product.color}">${product.initials}</span><span><h4>${escapeHtml(product.name)}</h4><p>الممر ${location.aisle} · الرف ${location.shelf}</p></span><em>المسار ←</em></button>`;
    }).join("");
    dom.searchSuggestions.classList.toggle("has-results", Boolean(list.length));
  }

  function roundedPath(points) {
    if (!points || !points.length) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const midpoint = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
      d += ` Q ${current.x} ${current.y} ${midpoint.x} ${midpoint.y}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  function renderRoute(points, pins = []) {
    const d = roundedPath(points);
    dom.routeHalo.setAttribute("d", d);
    dom.routePath.setAttribute("d", d);
    dom.routePath.style.animation = "none";
    requestAnimationFrame(() => {
      const length = dom.routePath.getTotalLength?.() || 900;
      dom.routePath.style.transition = "none";
      dom.routePath.style.strokeDasharray = `${length} ${length}`;
      dom.routePath.style.strokeDashoffset = `${length}`;
      requestAnimationFrame(() => {
        dom.routePath.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.3,.8,.2,1)";
        dom.routePath.style.strokeDashoffset = "0";
        setTimeout(() => {
          dom.routePath.style.transition = "none";
          dom.routePath.style.strokeDasharray = "8 8";
          dom.routePath.style.animation = "routeFlow .65s linear infinite";
        }, 1150);
      });
    });
    const arrowPoints = points.slice(1, -1).filter((_, index) => index % 2 === 0).map((point, index) => {
      const next = points[Math.min(points.length - 1, (index * 2) + 2)];
      const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI;
      return `<polygon points="-5,-4 5,0 -5,4" transform="translate(${point.x} ${point.y}) rotate(${angle})" fill="#08a7e8" stroke="white" stroke-width="1.5"></polygon>`;
    }).join("");
    dom.routePins.innerHTML = pins.map((pin, index) => `<g class="route-pin" transform="translate(${pin.x} ${pin.y})"><circle r="10" fill="${pin.color || (index ? "#14a46f" : "#2563eb")}"></circle><text y=".5">${pin.label || index + 1}</text></g>`).join("") + arrowPoints;
  }

  function navigateToProduct(productId) {
    const product = productById(productId);
    const location = locationForProduct(productId);
    const shelf = location && shelfByCode(location.shelf);
    if (!product || !location || !shelf) {
      showToast("المنتج غير موزّع", "وزّع المنتج على رف أولًا حتى نتمكن من حساب المسار.", "!");
      return;
    }
    const route = navigation.getRoute(state.store, shelf);
    state.route = { ...route, productId, shelfId: shelf.id };
    state.selectedProductId = productId;
    renderMap();
    renderRoute(route.points, [
      { ...state.store.entrance, label: "ب", color: "#2563eb" },
      { ...route.accessPoint, label: "و", color: "#14a46f" }
    ]);
    dom.navigationSearch.classList.remove("is-visible");
    dom.navigationCard.classList.add("is-visible");
    $("#navProductAvatar").textContent = product.initials;
    $("#navProductAvatar").style.background = product.color;
    $("#navProductName").textContent = product.name;
    $("#navProductLocation").textContent = `الممر ${location.aisle} · الرف ${location.shelf}`;
    const meters = Math.max(30, Math.round(route.distance / 2 / 10) * 10);
    $("#routeDistance").textContent = `${meters} م`;
    $("#routeTime").textContent = `حوالي ${Math.max(1, Math.round(meters / 80))} دقيقة مشيًا`;
    $("#routeSteps").innerHTML = ["المدخل الرئيسي", "الممر الرئيسي", `الممر ${location.aisle}`, `الرف ${location.shelf}`].map(step => `<li>${step}</li>`).join("");
    $("#destinationText").textContent = `الممر ${location.aisle} · الرف ${location.shelf} · القسم ${location.section} · المستوى ${location.level}`;
    dom.destinationTip.classList.add("is-visible");
    renderProductInspector(productId);
    zoomToRoute(route.points);
    setTimeout(positionDestinationTip, 660);
  }

  function zoomToRoute(points) {
    const rect = dom.viewport.getBoundingClientRect();
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.max(400, maxX - minX + 220), height = Math.max(400, maxY - minY + 180);
    state.zoom = clamp(Math.min(rect.width / width, rect.height / height), .62, 1.08);
    state.pan.x = rect.width / 2 - ((minX + maxX) / 2) * state.zoom;
    state.pan.y = rect.height / 2 - ((minY + maxY) / 2) * state.zoom + 20;
    applyTransform(true);
  }

  function positionDestinationTip() {
    if (!state.route?.accessPoint || !dom.destinationTip.classList.contains("is-visible")) return;
    dom.destinationTip.style.left = `${state.pan.x + state.route.accessPoint.x * state.zoom}px`;
    dom.destinationTip.style.top = `${state.pan.y + state.route.accessPoint.y * state.zoom}px`;
  }

  function clearRoute() {
    state.route = null;
    dom.routePath.setAttribute("d", "");
    dom.routeHalo.setAttribute("d", "");
    dom.routePins.innerHTML = "";
    dom.navigationCard.classList.remove("is-visible");
    dom.destinationTip.classList.remove("is-visible");
    if (state.mode === "navigate") dom.navigationSearch.classList.add("is-visible");
    $$(".map-object.is-destination").forEach(node => node.classList.remove("is-destination"));
  }

  function optimizeShoppingRoute() {
    const selectedIds = $$("#shoppingItems input:checked").map(input => input.value);
    if (selectedIds.length < 2) {
      showToast("اختر منتجين أو أكثر", "يحتاج تحسين المسار إلى أكثر من محطة.", "!");
      return;
    }
    const entries = selectedIds.map(id => ({ product: productById(id), location: locationForProduct(id) })).filter(entry => entry.location);
    const shelves = entries.map(entry => shelfByCode(entry.location.shelf)).filter(Boolean);
    const route = navigation.getMultiStopRoute(state.store, shelves);
    const orderedEntries = route.ordered.map(shelf => entries.find(entry => entry.location.shelf === shelf.shelfId));
    const lastShelf = route.ordered[route.ordered.length - 1];
    const lastPoint = route.points[route.points.length - 1];
    state.route = { ...route, shelfId: lastShelf?.id, accessPoint: lastPoint, productId: orderedEntries[0]?.product?.id || null };
    renderMap();
    const pins = [{ ...state.store.entrance, label: "ب", color: "#2563eb" }].concat(route.ordered.map((shelf, index) => {
      const point = route.points.slice().reverse().find(candidate => Math.abs(candidate.x - (shelf.x + shelf.w / 2)) < 80) || { x: shelf.x - 20, y: shelf.y + shelf.h / 2 };
      return { ...point, label: String(index + 1), color: index === route.ordered.length - 1 ? "#14a46f" : "#08a7e8" };
    }));
    renderRoute(route.points, pins);
    dom.navigationSearch.classList.remove("is-visible");
    dom.navigationCard.classList.add("is-visible");
    dom.destinationTip.classList.remove("is-visible");
    $("#navProductAvatar").textContent = `${orderedEntries.length}`;
    $("#navProductAvatar").style.background = "#2563eb";
    $("#navProductName").textContent = "مسار قائمة التسوق";
    $("#navProductLocation").textContent = `${orderedEntries.length} محطات · ينتهي عند صندوق الدفع`;
    const meters = Math.max(40, Math.round(route.distance / 5 / 10) * 10);
    $("#routeDistance").textContent = `${meters} م`;
    $("#routeTime").textContent = `حوالي ${Math.max(1, Math.round(meters / 75))} دقيقة مشيًا`;
    $("#routeSteps").innerHTML = ["المدخل الرئيسي", ...orderedEntries.map(entry => entry?.product?.shortName || "منتج"), "صندوق الدفع"].map(step => `<li>${escapeHtml(step)}</li>`).join("");
    zoomToRoute(route.points);
    showToast("تم تحسين المسار", `رُتبت ${orderedEntries.length} منتجات وفق أقصر مسافة مشي.`, "⌁");
  }

  function showToast(title, message, icon = "✓") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span><b>${escapeHtml(title)}</b><small>${escapeHtml(message)}</small></span><button aria-label="إغلاق الإشعار">×</button>`;
    dom.toastStack.appendChild(toast);
    const remove = () => { toast.classList.add("is-leaving"); setTimeout(() => toast.remove(), 220); };
    toast.querySelector("button").addEventListener("click", remove);
    setTimeout(remove, 3600);
  }

  function showContextMenu(event, id) {
    event.preventDefault();
    selectElement(id);
    dom.contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 190)}px`;
    dom.contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 150)}px`;
    dom.contextMenu.classList.add("is-visible");
  }

  function hideContextMenu() { dom.contextMenu.classList.remove("is-visible"); }

  function setHelpVisible(visible) {
    dom.helpPopover.classList.toggle("is-visible", visible);
    dom.helpPopover.setAttribute("aria-hidden", String(!visible));
  }

  function saveDemo() {
    try { localStorage.setItem("dawer-map-demo", snapshot()); }
    catch { return showToast("تعذّر الحفظ", "لا توجد مساحة تخزين متاحة. احتفظ بهذه الجلسة مفتوحة.", "!"); }
    showToast("تم حفظ النموذج", "حُفظت الخريطة ومواقع المنتجات على هذا الجهاز.", "✓");
  }

  function loadDemo() {
    rememberSnapshot();
    state.store = createDemoStore();
    state.selectedElementId = null;
    state.selectedProductId = null;
    closeShelfDetail();
    clearRoute();
    renderMap(); renderProducts(); renderShoppingList(); renderInspector(); fitToScreen(true);
    showToast("تم تحميل المتجر التجريبي", "أصبحت الرفوف ومواقع المنتجات جاهزة للاستخدام.", "✓");
  }

  function createNewMap() {
    if (!window.confirm("هل تريد بدء خريطة جديدة؟ يمكنك التراجع عن هذا الإجراء.")) return;
    rememberSnapshot();
    state.store = createEmptyStore();
    state.selectedElementId = null;
    closeShelfDetail(); clearRoute(); renderMap(); renderProducts(); renderInspector(); fitToScreen(true);
    showToast("أُنشئت خريطة جديدة", "أضف الرفوف والتجهيزات من لوحة الأدوات.", "+");
  }

  function locateProduct(productId) {
    const location = locationForProduct(productId);
    const shelf = location && shelfByCode(location.shelf);
    if (!shelf) return;
    closeShelfDetail();
    setMode("products");
    selectElement(shelf.id);
    zoomToElement(shelf);
    const node = dom.elements.querySelector(`[data-id="${CSS.escape(shelf.id)}"]`);
    node?.classList.add("is-destination");
    setTimeout(() => node?.classList.remove("is-destination"), 3200);
    showToast("تم تحديد المنتج", `${locationCode(location)} · أضيء الرف ${shelf.shelfId} على الخريطة.`, "⌖");
  }

  function bindEvents() {
    $$(".mode-button").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
    dom.toolList.addEventListener("click", event => {
      const button = event.target.closest("[data-tool]");
      if (!button) return;
      if (button.dataset.tool === "delete") return deleteSelected();
      state.activeTool = button.dataset.tool;
      state.panTool = false;
      dom.viewport.classList.remove("is-panning");
      renderTools();
    });

    dom.elements.addEventListener("pointerdown", event => {
      const node = event.target.closest(".map-object");
      if (!node || event.button !== 0) return;
      event.stopPropagation();
      const element = elementById(node.dataset.id);
      if (!element) return;
      if (state.mode === "products" && state.pendingProductId && element.type === "shelf") {
        openShelfDetail(element.id, { pendingProductId: state.pendingProductId }); return;
      }
      if (state.activeTool === "delete" && state.mode === "build") { selectElement(element.id); deleteSelected(); return; }
      selectElement(element.id);
      startObjectDrag(event, element);
    });
    dom.elements.addEventListener("dblclick", event => {
      const node = event.target.closest(".map-object.shelf");
      if (node) openShelfDetail(node.dataset.id);
    });
    dom.elements.addEventListener("contextmenu", event => {
      const node = event.target.closest(".map-object");
      if (node) showContextMenu(event, node.dataset.id);
    });
    dom.elements.addEventListener("dragover", event => {
      const shelfNode = event.target.closest(".map-object.shelf");
      if (!shelfNode || !state.draggedProductId) return;
      event.preventDefault();
      $$(".map-object.is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
      shelfNode.classList.add("is-drop-target");
    });
    dom.elements.addEventListener("dragleave", event => event.target.closest(".map-object.shelf")?.classList.remove("is-drop-target"));
    dom.elements.addEventListener("drop", event => {
      const shelfNode = event.target.closest(".map-object.shelf");
      if (!shelfNode || !state.draggedProductId) return;
      event.preventDefault();
      shelfNode.classList.remove("is-drop-target");
      openShelfDetail(shelfNode.dataset.id, { pendingProductId: state.draggedProductId });
      showToast("تم اختيار الرف", "اختر الآن القسم والمستوى والموضع الدقيق للمنتج.", "←");
    });

    dom.viewport.addEventListener("pointerdown", event => {
      if (event.target.closest(".navigation-search,.navigation-card,.canvas-toolbar,.canvas-legend")) return;
      if (event.button === 1 || state.panTool || state.spacePressed) { event.preventDefault(); startPan(event); return; }
      if (event.button !== 0 || event.target.closest(".map-object")) return;
      if (state.mode === "build" && state.activeTool !== "select") addElement(state.activeTool, screenToSurface(event.clientX, event.clientY));
      else clearSelection();
    });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.viewport.addEventListener("wheel", event => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = dom.viewport.getBoundingClientRect();
        setZoom(state.zoom * (event.deltaY > 0 ? .9 : 1.1), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else {
        state.pan.x -= event.deltaX;
        state.pan.y -= event.deltaY;
        applyTransform();
      }
    }, { passive: false });

    $$(".resize-handle").forEach(handle => handle.addEventListener("pointerdown", event => startResize(event, handle.dataset.resize)));
    $("#rotateHandle").addEventListener("click", event => { event.stopPropagation(); rotateSelected(); });
    $("#zoomInButton").addEventListener("click", () => setZoom(state.zoom + .1));
    $("#zoomOutButton").addEventListener("click", () => setZoom(state.zoom - .1));
    $("#zoomValue").addEventListener("click", () => { state.zoom = 1; const rect = dom.viewport.getBoundingClientRect(); state.pan = { x: (rect.width - 1200) / 2, y: (rect.height - 720) / 2 + 15 }; applyTransform(true); });
    $("#fitButton").addEventListener("click", () => fitToScreen(true));
    $("#panButton").addEventListener("click", event => { state.panTool = !state.panTool; event.currentTarget.classList.toggle("is-active", state.panTool); dom.viewport.classList.toggle("is-panning", state.panTool); });
    $("#undoButton").addEventListener("click", undo); $("#redoButton").addEventListener("click", redo);
    $("#saveButton").addEventListener("click", saveDemo); $("#newMapButton").addEventListener("click", createNewMap); $("#loadDemoButton").addEventListener("click", loadDemo);
    $("#helpButton").addEventListener("click", event => { event.stopPropagation(); setHelpVisible(!dom.helpPopover.classList.contains("is-visible")); });
    $("#closeHelpButton").addEventListener("click", () => setHelpVisible(false));

    dom.productSearch.addEventListener("input", event => renderProducts(event.target.value));
    dom.productList.addEventListener("dragstart", event => {
      const card = event.target.closest("[data-product-id]");
      if (!card) return;
      state.draggedProductId = card.dataset.productId;
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/plain", state.draggedProductId);
    });
    dom.productList.addEventListener("dragend", () => { state.draggedProductId = null; $$(".is-drop-target").forEach(node => node.classList.remove("is-drop-target")); });
    dom.productList.addEventListener("click", event => {
      const card = event.target.closest("[data-product-id]"); if (!card) return;
      state.selectedProductId = card.dataset.productId; state.selectedElementId = null; updateSelectionBox(); renderProductInspector(card.dataset.productId);
      state.pendingProductId = card.dataset.productId;
      showToast("تم اختيار المنتج", "اضغط على الرف لتحديد موقعه، أو اسحب المنتج إليه.", "←");
    });

    $("#backToPlanButton").addEventListener("click", closeShelfDetail);
    [dom.sectionsInput, dom.levelsInput].forEach(input => input.addEventListener("change", () => {
      const shelf = elementById(state.currentShelfId); if (!shelf) return;
      rememberSnapshot(); shelf.sections = clamp(Number(dom.sectionsInput.value), 1, 6); shelf.levels = clamp(Number(dom.levelsInput.value), 1, 6); renderShelfDetail(); renderInspector();
    }));
    $("#pendingProductToken").addEventListener("dragstart", event => { state.draggedProductId = state.pendingProductId; event.dataTransfer.setData("text/plain", state.pendingProductId); });
    dom.shelfElevation.addEventListener("dragover", event => { const slot = event.target.closest(".position-slot"); if (!slot || !(state.draggedProductId || state.pendingProductId)) return; event.preventDefault(); slot.classList.add("is-drop-target"); });
    dom.shelfElevation.addEventListener("dragleave", event => event.target.closest(".position-slot")?.classList.remove("is-drop-target"));
    dom.shelfElevation.addEventListener("drop", event => {
      const slot = event.target.closest(".position-slot"); if (!slot) return; event.preventDefault();
      placeProduct(state.draggedProductId || state.pendingProductId, { section: slot.dataset.section, level: Number(slot.dataset.level), position: Number(slot.dataset.position) }); state.draggedProductId = null;
    });
    dom.shelfElevation.addEventListener("click", event => {
      const productNode = event.target.closest(".cell-product");
      if (productNode) { state.selectedProductId = productNode.dataset.productId; renderProductInspector(state.selectedProductId); return; }
      const slot = event.target.closest(".position-slot"); if (!slot) return;
      const position = { section: slot.dataset.section, level: Number(slot.dataset.level), position: Number(slot.dataset.position) };
      updateLocationReadout(position);
      if (state.pendingProductId) placeProduct(state.pendingProductId, position);
    });

    dom.inspector.addEventListener("change", event => {
      const input = event.target.closest("[data-property]"); const element = selectedElement(); if (!input || !element) return;
      if (input.dataset.property === "shelfId" && state.store.elements.some(e => e.id !== element.id && e.shelfId === input.value)) {
        input.value = element.shelfId; return showToast("رمز مستخدم بالفعل", "اختر رمزًا فريدًا لوحدة العرض.", "!");
      }
      rememberSnapshot();
      const property = input.dataset.property;
      const oldShelfId = element.shelfId;
      element[property] = input.type === "number" ? Number(input.value) : input.value;
      if (input.type === "number") {
        const ranges = { w: [8,1200], h: [8,720], x: [0,1200-element.w], y: [0,720-element.h], rotation: [-360,360], sections: [1,6], levels: [1,6] };
        const range = ranges[property] || [0,1200]; element[property] = clamp(Number.isFinite(element[property]) ? element[property] : range[0], ...range);
        if (["sections","levels"].includes(property)) element[property] = Math.round(element[property]);
      }
      if (property === "shelfId" && oldShelfId) state.store.locations.filter(location => location.shelf === oldShelfId).forEach(location => location.shelf = element.shelfId);
      if (property === "aisle" && element.shelfId) state.store.locations.filter(location => location.shelf === element.shelfId).forEach(location => location.aisle = String(element.aisle).padStart(2,"0"));
      renderMap(); renderInspector();
    });
    dom.inspector.addEventListener("click", event => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "split-shelf") openShelfDetail(state.selectedElementId);
      if (action === "duplicate") duplicateSelected();
      if (action === "rotate") rotateSelected();
      if (action === "delete") deleteSelected();
      if (action === "front" || action === "back") {
        const element = selectedElement(); if (element) { rememberSnapshot(); state.store.elements = state.store.elements.filter(e => e.id !== element.id); state.store.elements[action === "front" ? "push" : "unshift"](element); renderMap(); }
      }
      const productAction = event.target.closest("[data-product-action]")?.dataset.productAction;
      if (productAction === "locate") locateProduct(state.selectedProductId);
      if (productAction === "move") {
        const location = locationForProduct(state.selectedProductId); const shelf = location && shelfByCode(location.shelf);
        if (shelf) openShelfDetail(shelf.id, { pendingProductId: state.selectedProductId });
        else { setMode("products"); showToast("اختر رفًا", "اسحب المنتج المحدد من القائمة إلى أحد الرفوف على الخريطة.", "←"); }
      }
      if (productAction === "remove") {
        rememberSnapshot(); state.store.locations = state.store.locations.filter(location => location.productId !== state.selectedProductId); const id = state.selectedProductId; state.selectedProductId = null; renderShelfDetail(); renderInspector(); showToast("تمت إزالة المنتج", `لم يعد لـ ${productById(id)?.name || "المنتج"} موقع على الرفوف.`, "×");
      }
    });

    dom.navigationInput.addEventListener("input", event => renderSuggestions(event.target.value));
    dom.navigationInput.addEventListener("focus", event => renderSuggestions(event.target.value));
    dom.navigationInput.addEventListener("keydown", event => { if (event.key === "Enter") { const first = dom.searchSuggestions.querySelector("[data-product-id]"); if (first) navigateToProduct(first.dataset.productId); } });
    dom.searchSuggestions.addEventListener("click", event => { const suggestion = event.target.closest("[data-product-id]"); if (suggestion) navigateToProduct(suggestion.dataset.productId); });
    $("#closeRouteButton").addEventListener("click", clearRoute);
    $("#viewShelfButton").addEventListener("click", () => {
      if (!state.route?.productId) return;
      const location = locationForProduct(state.route.productId); const shelf = location && shelfByCode(location.shelf);
      if (shelf) openShelfDetail(shelf.id, { highlightedProductId: state.route.productId, position: { section: location.section, level: location.level, position: location.position } });
    });
    $("#optimizeButton").addEventListener("click", optimizeShoppingRoute);

    dom.contextMenu.addEventListener("click", event => {
      const action = event.target.closest("[data-context]")?.dataset.context;
      hideContextMenu(); if (action === "duplicate") duplicateSelected(); if (action === "rotate") rotateSelected(); if (action === "delete") deleteSelected();
    });
    document.addEventListener("pointerdown", event => {
      if (!event.target.closest("#contextMenu")) hideContextMenu();
      if (!event.target.closest("#helpPopover,#helpButton")) setHelpVisible(false);
    });
    $$("[data-layer]").filter(node => node.matches("input")).forEach(input => input.addEventListener("change", () => { state.layerVisibility[input.dataset.layer] = input.checked; renderMap(); }));
    $$("[data-collapse]").forEach(button => button.addEventListener("click", () => {
      const side = button.dataset.collapse;
      if (window.innerWidth <= 820) dom.shell.classList.toggle(`${side}-open`);
      else dom.shell.classList.toggle(`${side}-collapsed`);
      setTimeout(() => fitToScreen(true), 280);
    }));

    window.addEventListener("keydown", event => {
      if (dom.shell.hidden) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (event.code === "Space" && !typing) { state.spacePressed = true; dom.viewport.classList.add("is-panning"); event.preventDefault(); }
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setMode("products"); dom.productSearch.focus(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); return; }
      if (event.key.toLowerCase() === "r" && state.selectedElementId) { rotateSelected(); return; }
      const shortcuts = { v: "select", w: "wall", e: "entrance", s: "shelf", f: "freezer", g: "fridge", c: "checkout", o: "obstacle", t: "text", a: "aisle" };
      if (state.mode === "build" && shortcuts[event.key.toLowerCase()]) { state.activeTool = shortcuts[event.key.toLowerCase()]; renderTools(); }
      if (event.key === "Escape") { if (dom.shelfWorkspace.classList.contains("is-visible")) closeShelfDetail(); else clearSelection(); hideContextMenu(); setHelpVisible(false); }
    });
    window.addEventListener("keyup", event => { if (event.code === "Space") { state.spacePressed = false; dom.viewport.classList.toggle("is-panning", state.panTool); } });
    window.addEventListener("resize", () => fitToScreen(false));
  }

  function init() {
    try {
      const saved = JSON.parse(localStorage.getItem("dawer-map-demo"));
      if (saved && Array.isArray(saved.elements) && Array.isArray(saved.products) && Array.isArray(saved.locations)) state.store = saved;
    } catch { /* Keep original storage intact if a saved document cannot be read. */ }
    renderTools(); renderProducts(); renderShoppingList(); renderMap(); renderInspector(); bindEvents(); updateHistoryButtons();
    requestAnimationFrame(() => fitToScreen(false));
    $("#customerPreview").addEventListener("click", () => window.DawerShopper.show());
    $("#editorToolsButton").addEventListener("click", () => dom.shell.classList.toggle("left-open"));
    $("#editorPropertiesButton").addEventListener("click", () => dom.shell.classList.toggle("right-open"));
    $("#shelfSide").addEventListener("change", renderShelfDetail);
    $("#validateMap").addEventListener("click", () => showAdminReport("فحص المخطط", navigation.validate(state.store).map(x => x.message)));
    $("#reportsButton").addEventListener("click", () => {
      let reports = []; try { reports = JSON.parse(localStorage.getItem("dawer-reports-v1")) || []; } catch {}
      showAdminReport("بلاغات محلية — لم تُرسل إلى خادم", reports.map(r => `${r.id} · ${productById(r.productId)?.name || r.productId} · ${locationCode(r.location)}`));
    });
    dom.productList.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { const card = event.target.closest("[data-product-id]"); if (card) { event.preventDefault(); card.click(); } } });
    dom.elements.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const node = event.target.closest("[data-id]"); if (!node) return; event.preventDefault();
      const pending = state.pendingProductId; selectElement(node.dataset.id);
      if (elementById(node.dataset.id)?.type === "shelf") openShelfDetail(node.dataset.id, { pendingProductId: pending });
    });
    new MutationObserver(() => {
      dom.inspector.querySelectorAll(".inspector-field").forEach((field, i) => { const input = field.querySelector("input"), label = field.querySelector("label"); if (input && label) { input.id = `editor-property-${i}`; label.htmlFor = input.id; } });
    }).observe(dom.inspector, {childList:true});
    dom.shelfElevation.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { const slot = event.target.closest(".position-slot"); if (slot) { event.preventDefault(); slot.click(); } } });
  }

  function showAdminReport(title, messages) {
    let dialog = $("#adminReport");
    if (!dialog) { dialog = document.createElement("dialog"); dialog.id = "adminReport"; document.body.append(dialog); }
    dialog.innerHTML = `<form method="dialog"><button aria-label="إغلاق">×</button></form><h2>${escapeHtml(title)}</h2><p>${messages.length} ملاحظات</p><ul>${messages.map(m => `<li>${escapeHtml(m)}</li>`).join("") || "<li>لا توجد ملاحظات</li>"}</ul>`;
    dialog.showModal();
  }

  window.DawerEditor = { getStore: () => state.store, activate(mode) { dom.shell.classList.remove("left-open","right-open"); setMode(mode); renderProducts(); requestAnimationFrame(() => fitToScreen()); } };

  init();
})();
