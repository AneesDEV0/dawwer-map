(function () {
  const products = [
    { id: "P1001", name: "حليب طازج 1 لتر", shortName: "حليب", sku: "MLK-1L", category: "الألبان", searchTerms: "milk dairy", color: "#4d8de8", accent: "#dfeeff", initials: "ح" },
    { id: "P1002", name: "كوكاكولا 330 مل", shortName: "كوكاكولا", sku: "CC-330", category: "المشروبات", searchTerms: "coca cola coke", color: "#d73532", accent: "#fff0ed", initials: "ك" },
    { id: "P1003", name: "بيبسي 330 مل", shortName: "بيبسي", sku: "PPS-330", category: "المشروبات", searchTerms: "pepsi", color: "#2659ad", accent: "#e6efff", initials: "ب" },
    { id: "P1004", name: "نوتيلا 350 غ", shortName: "نوتيلا", sku: "NTL-350", category: "قابل للدهن", searchTerms: "nutella spread", color: "#6b3b25", accent: "#fff3e7", initials: "ن" },
    { id: "P1005", name: "كورن فليكس 500 غ", shortName: "كورن فليكس", sku: "CRN-500", category: "الإفطار", searchTerms: "corn flakes cereal", color: "#e29e2e", accent: "#fff4d7", initials: "كف" },
    { id: "P1006", name: "أرز بسمتي 1 كغ", shortName: "أرز", sku: "RCE-1K", category: "المؤن", searchTerms: "rice basmati", color: "#759873", accent: "#eef7e9", initials: "أ" },
    { id: "P1007", name: "باستا بيني 500 غ", shortName: "باستا", sku: "PST-500", category: "المؤن", searchTerms: "pasta penne", color: "#cf8b32", accent: "#fff3d8", initials: "با" },
    { id: "P1008", name: "قهوة أرابيكا 250 غ", shortName: "قهوة", sku: "COF-250", category: "مشروبات ساخنة", searchTerms: "coffee arabica", color: "#574238", accent: "#f4ece3", initials: "ق" },
    { id: "P1009", name: "شاي الإفطار الإنجليزي", shortName: "شاي", sku: "TEA-100", category: "مشروبات ساخنة", searchTerms: "tea", color: "#488661", accent: "#e4f4e9", initials: "ش" },
    { id: "P1010", name: "مياه معدنية 1.5 لتر", shortName: "مياه", sku: "WTR-15", category: "المشروبات", searchTerms: "water mineral", color: "#2f9bbb", accent: "#e0f6fa", initials: "م" },
    { id: "P1011", name: "عصير برتقال 1 لتر", shortName: "عصير برتقال", sku: "OJ-1L", category: "المشروبات", searchTerms: "orange juice", color: "#ef8d2d", accent: "#fff0dc", initials: "ع" },
    { id: "P1012", name: "رقائق بملح البحر", shortName: "رقائق", sku: "CHP-150", category: "التسالي", searchTerms: "chips snacks", color: "#616daf", accent: "#edf0ff", initials: "ر" },
    { id: "P1013", name: "شوكولاتة داكنة 70%", shortName: "شوكولاتة", sku: "CHO-100", category: "التسالي", searchTerms: "chocolate dark", color: "#5d3430", accent: "#f6e9e7", initials: "ش" },
    { id: "P1014", name: "منظف برائحة منعشة", shortName: "منظف", sku: "DTG-2L", category: "مستلزمات المنزل", searchTerms: "detergent cleaning", color: "#318eb2", accent: "#e3f3f8", initials: "م" },
    { id: "P1015", name: "شامبو عناية يومية", shortName: "شامبو", sku: "SHP-400", category: "العناية الشخصية", searchTerms: "shampoo care", color: "#8c5da7", accent: "#f3e8fa", initials: "ش" }
  ];

  const tools = [
    { id: "select", label: "تحديد وتحريك", glyph: "↖", shortcut: "V" },
    { id: "wall", label: "جدار", glyph: "ج", shortcut: "W" },
    { id: "entrance", label: "مدخل", glyph: "مد", shortcut: "E" },
    { id: "shelf", label: "رف", glyph: "ر", shortcut: "S" },
    { id: "double-shelf", label: "رف مزدوج", glyph: "ر₂", shortcut: "D" },
    { id: "freezer", label: "مجمّد", glyph: "مج", shortcut: "F" },
    { id: "fridge", label: "ثلاجة", glyph: "ث", shortcut: "G" },
    { id: "checkout", label: "صندوق دفع", glyph: "د", shortcut: "C" },
    { id: "obstacle", label: "عائق", glyph: "○", shortcut: "O" },
    { id: "text", label: "تسمية", glyph: "ن", shortcut: "T" },
    { id: "aisle", label: "ممر", glyph: "م", shortcut: "A" },
    { id: "delete", label: "حذف", glyph: "×", shortcut: "⌫" }
  ];

  function shelf(id, aisle, x, y, h) {
    return {
      id: `shelf-${id.toLowerCase()}`,
      type: "shelf",
      shelfId: id,
      aisle: String(aisle).padStart(2, "0"),
      x, y, w: 42, h,
      rotation: 0,
      sections: 4,
      levels: 5,
      label: `الرف ${id}`
    };
  }

  function createDemoStore() {
    const elements = [
      { id: "wall-top", type: "wall", x: 55, y: 60, w: 1090, h: 9, rotation: 0 },
      { id: "wall-left", type: "wall", x: 55, y: 60, w: 9, h: 615, rotation: 0 },
      { id: "wall-right", type: "wall", x: 1136, y: 60, w: 9, h: 615, rotation: 0 },
      { id: "wall-bottom-left", type: "wall", x: 55, y: 666, w: 485, h: 9, rotation: 0 },
      { id: "wall-bottom-right", type: "wall", x: 660, y: 666, w: 485, h: 9, rotation: 0 },
      { id: "entrance-main", type: "entrance", x: 550, y: 648, w: 100, h: 27, rotation: 0, label: "المدخل الرئيسي" },
      { id: "zone-bakery", type: "zone", x: 82, y: 86, w: 205, h: 95, rotation: 0, label: "المخبوزات", sublabel: "طازجة كل صباح" },
      { id: "zone-produce", type: "zone", x: 80, y: 435, w: 190, h: 178, rotation: 0, label: "الخضار والفواكه", sublabel: "منتجات طازجة" },
      { id: "fridge-dairy", type: "fridge", x: 315, y: 84, w: 370, h: 35, rotation: 0, label: "ثلاجات الألبان" },
      { id: "freezer-frozen", type: "freezer", x: 728, y: 84, w: 385, h: 35, rotation: 0, label: "المجمّدات" },
      { id: "freezer-side", type: "freezer", x: 1088, y: 165, w: 31, h: 335, rotation: 0, label: "تبريد" },
      { id: "checkout-01", type: "checkout", x: 314, y: 604, w: 95, h: 25, rotation: -7, label: "01" },
      { id: "checkout-02", type: "checkout", x: 425, y: 604, w: 95, h: 25, rotation: -7, label: "02" },
      { id: "checkout-03", type: "checkout", x: 680, y: 604, w: 95, h: 25, rotation: 7, label: "03" },
      { id: "checkout-04", type: "checkout", x: 791, y: 604, w: 95, h: 25, rotation: 7, label: "04" },
      { id: "label-checkout", type: "text", x: 489, y: 605, w: 220, h: 20, rotation: 0, label: "صناديق الدفع" }
    ];

    for (let aisle = 1; aisle <= 10; aisle += 1) {
      const x = 165 + (aisle - 1) * 87;
      const firstId = `S-${String(aisle * 2 + 8).padStart(2, "0")}`;
      const secondId = `S-${String(aisle * 2 + 9).padStart(2, "0")}`;
      elements.push(
        { id: `aisle-label-${aisle}`, type: "text", x: x - 14, y: 150, w: 70, h: 18, rotation: 0, label: `الممر ${String(aisle).padStart(2, "0")}` },
        shelf(firstId, aisle, x, 188, 184),
        shelf(secondId, aisle, x, 418, 134)
      );
    }

    const locations = [
      { productId: "P1004", aisle: "04", shelf: "S-17", side: "A", section: "B", level: 3, position: 2 },
      { productId: "P1001", aisle: "02", shelf: "S-12", side: "A", section: "A", level: 2, position: 1 },
      { productId: "P1008", aisle: "06", shelf: "S-21", side: "A", section: "C", level: 2, position: 2 },
      { productId: "P1010", aisle: "09", shelf: "S-26", side: "A", section: "D", level: 4, position: 3 },
      { productId: "P1012", aisle: "05", shelf: "S-18", side: "A", section: "A", level: 3, position: 1 },
      { productId: "P1005", aisle: "03", shelf: "S-14", side: "A", section: "C", level: 1, position: 2 },
      { productId: "P1014", aisle: "08", shelf: "S-25", side: "A", section: "B", level: 2, position: 1 }
    ];

    return {
      id: "store-dawer-demo",
      name: "السوبرماركت التجريبي",
      floors: [{ id: "floor-01", name: "الطابق 01", width: 1200, height: 720 }],
      elements,
      products: products.map(product => ({ ...product })),
      locations,
      entrance: { x: 600, y: 645 },
      updatedAt: new Date().toISOString()
    };
  }

  function createEmptyStore() {
    return {
      id: `store-${Date.now()}`,
      name: "متجر جديد",
      floors: [{ id: "floor-01", name: "الطابق 01", width: 1200, height: 720 }],
      elements: [
        { id: "wall-top", type: "wall", x: 100, y: 100, w: 1000, h: 9, rotation: 0 },
        { id: "wall-left", type: "wall", x: 100, y: 100, w: 9, h: 520, rotation: 0 },
        { id: "wall-right", type: "wall", x: 1091, y: 100, w: 9, h: 520, rotation: 0 },
        { id: "entrance-main", type: "entrance", x: 550, y: 593, w: 100, h: 27, rotation: 0, label: "المدخل الرئيسي" }
      ],
      products: products.map(product => ({ ...product })),
      locations: [],
      entrance: { x: 600, y: 585 },
      updatedAt: new Date().toISOString()
    };
  }

  window.DawerData = { products, tools, createDemoStore, createEmptyStore };
})();
