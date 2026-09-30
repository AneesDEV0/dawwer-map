<div dir="rtl">

# واجهات API اللازمة لتشغيل خريطة DAWER

هذا الملف يصف فقط واجهات تشغيل الخريطة، من دون تسجيل دخول أو مستخدمين أو صلاحيات.

## قواعد عامة

- المسار الأساسي: `/api/v1`
- نوع البيانات: `application/json`
- المعرّفات: `UUID`
- الإحداثيات والأبعاد: بالسنتيمتر، ونقطة الأصل أعلى يسار الخريطة.
- أنواع العناصر: `shelf`, `wall`, `freezer`, `fridge`, `checkout`, `entrance`, `obstacle`, `service_area`.
- `draft` هي نسخة التحرير، و`published` هي النسخة التي تستخدمها شاشة الملاحة.

---

## 1. تحميل الخريطة

### `GET /api/v1/floors/{floorId}/map`

> **الشرح:** يعيد بيانات الطابق ونسخة الخريطة وجميع العناصر اللازمة لرسمها. استخدم `published` للملاحة و`draft` للمحرر.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `floorId` | UUID | نعم | معرّف الطابق |
| Query | `revision` | string | لا | `published` أو `draft`، والقيمة الافتراضية `published` |

```http
GET /api/v1/floors/floor_uuid/map?revision=published
```

### المخرجات — `200 OK`

```json
{
  "floor": {
    "id": "floor_uuid",
    "name": "الطابق الأرضي",
    "canvas": {
      "width": 4200,
      "height": 2800,
      "unit": "cm",
      "origin": "top_left"
    }
  },
  "revision": {
    "id": "revision_uuid",
    "number": 12,
    "status": "published",
    "version": 37
  },
  "elements": [
    {
      "id": "element_uuid",
      "type": "shelf",
      "label": "S-17",
      "geometry": {
        "x": 1380,
        "y": 720,
        "width": 260,
        "height": 80,
        "rotation": 0
      },
      "walkable": false,
      "properties": {
        "aisle": "04",
        "shelfCode": "S-17"
      }
    }
  ],
  "entrances": [
    {
      "elementId": "entrance_uuid",
      "accessPoint": { "x": 180, "y": 2520 }
    }
  ]
}
```

---

## 2. إضافة عنصر إلى الخريطة

### `POST /api/v1/floors/{floorId}/elements`

> **الشرح:** ينشئ رفًا أو جدارًا أو أي عنصر آخر داخل النسخة المسودة من الخريطة.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `floorId` | UUID | نعم | معرّف الطابق |
| Body | `revisionId` | UUID | نعم | معرّف النسخة المسودة |
| Body | `type` | string | نعم | نوع العنصر |
| Body | `label` | string | لا | الاسم الظاهر على الخريطة |
| Body | `geometry` | object | نعم | الموقع والأبعاد والدوران |
| Body | `walkable` | boolean | نعم | هل يسمح المسار بالمرور خلاله؟ |
| Body | `properties` | object | لا | خصائص إضافية حسب نوع العنصر |

```json
{
  "revisionId": "draft_revision_uuid",
  "type": "shelf",
  "label": "S-17",
  "geometry": {
    "x": 1380,
    "y": 720,
    "width": 260,
    "height": 80,
    "rotation": 0
  },
  "walkable": false,
  "properties": {
    "aisle": "04",
    "shelfCode": "S-17"
  }
}
```

### المخرجات — `201 Created`

```json
{
  "id": "element_uuid",
  "revisionId": "draft_revision_uuid",
  "type": "shelf",
  "label": "S-17",
  "geometry": {
    "x": 1380,
    "y": 720,
    "width": 260,
    "height": 80,
    "rotation": 0
  },
  "walkable": false,
  "properties": {
    "aisle": "04",
    "shelfCode": "S-17"
  },
  "version": 1
}
```

---

## 3. تعديل عنصر

### `PATCH /api/v1/elements/{elementId}`

> **الشرح:** يعدّل الحقول المرسلة فقط، مثل تحريك العنصر أو تغيير حجمه أو اسمه.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `elementId` | UUID | نعم | معرّف العنصر |
| Body | `geometry` | object | لا | القيم الهندسية المطلوب تغييرها |
| Body | `label` | string | لا | الاسم الجديد |
| Body | `walkable` | boolean | لا | حالة المرور |
| Body | `properties` | object | لا | الخصائص الإضافية |

```json
{
  "geometry": {
    "x": 1450,
    "y": 760,
    "rotation": 90
  },
  "label": "S-17A"
}
```

### المخرجات — `200 OK`

```json
{
  "id": "element_uuid",
  "type": "shelf",
  "label": "S-17A",
  "geometry": {
    "x": 1450,
    "y": 760,
    "width": 260,
    "height": 80,
    "rotation": 90
  },
  "version": 2
}
```

---

## 4. حذف عنصر

### `DELETE /api/v1/elements/{elementId}`

> **الشرح:** يحذف عنصرًا من النسخة المسودة، ويرفض حذف رف ما زالت عليه مواقع منتجات إلا بعد إزالة تلك المواقع.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `elementId` | UUID | نعم | معرّف العنصر |

### المخرجات — `204 No Content`

لا يوجد جسم للاستجابة.

---

## 5. حفظ عدة تعديلات دفعة واحدة

### `POST /api/v1/floors/{floorId}/elements/batch`

> **الشرح:** يحفظ عمليات الإضافة والتعديل والحذف في طلب واحد. مناسب للحفظ التلقائي داخل محرر الخريطة.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `floorId` | UUID | نعم | معرّف الطابق |
| Body | `revisionId` | UUID | نعم | النسخة المسودة |
| Body | `expectedVersion` | integer | نعم | النسخة التي عدّلها العميل |
| Body | `operations` | array | نعم | العمليات المطلوب تنفيذها |

```json
{
  "revisionId": "draft_revision_uuid",
  "expectedVersion": 38,
  "operations": [
    {
      "op": "create",
      "clientId": "temp-1",
      "data": {
        "type": "wall",
        "label": "جدار جديد",
        "geometry": {
          "x": 200,
          "y": 300,
          "width": 500,
          "height": 20,
          "rotation": 0
        },
        "walkable": false
      }
    },
    {
      "op": "update",
      "id": "element_uuid",
      "patch": {
        "geometry": { "x": 1500 }
      }
    },
    {
      "op": "delete",
      "id": "old_element_uuid"
    }
  ]
}
```

### المخرجات — `200 OK`

```json
{
  "revisionId": "draft_revision_uuid",
  "version": 39,
  "created": {
    "temp-1": "new_element_uuid"
  },
  "updated": ["element_uuid"],
  "deleted": ["old_element_uuid"]
}
```

---

## 6. التحقق من صلاحية الخريطة

### `POST /api/v1/floors/{floorId}/validate`

> **الشرح:** يفحص حدود العناصر والتداخلات والمداخل وقابلية الوصول إلى الرفوف قبل نشر الخريطة.

### المدخلات

```json
{
  "revisionId": "draft_revision_uuid"
}
```

### المخرجات — `200 OK`

```json
{
  "valid": false,
  "errors": [
    {
      "code": "OVERLAP",
      "elementId": "element_uuid",
      "message": "الرف يتقاطع مع جدار"
    }
  ],
  "warnings": [
    {
      "code": "UNREACHABLE_SHELF",
      "elementId": "shelf_uuid",
      "message": "لا يوجد مسار صالح إلى الرف"
    }
  ]
}
```

---

## 7. نشر الخريطة

### `POST /api/v1/floors/{floorId}/publish`

> **الشرح:** يجعل النسخة المسودة هي النسخة المستخدمة في البحث والملاحة، ثم ينشئ مسودة جديدة للتحرير التالي.

### المدخلات

```json
{
  "revisionId": "draft_revision_uuid",
  "expectedVersion": 39,
  "note": "تحديث قسم المخبوزات"
}
```

### المخرجات — `200 OK`

```json
{
  "publishedRevisionId": "published_revision_uuid",
  "number": 13,
  "publishedAt": "2026-09-23T12:00:00Z",
  "nextDraftRevisionId": "new_draft_revision_uuid"
}
```

---

## 8. قراءة تكوين رف

### `GET /api/v1/shelves/{shelfId}/layout`

> **الشرح:** يعيد جوانب الرف وأقسامه ومستوياته ومواضعه ونقاط الوصول المستخدمة في الملاحة.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `shelfId` | UUID | نعم | معرّف عنصر الرف |
| Query | `revisionId` | UUID | نعم | معرّف نسخة الخريطة |

### المخرجات — `200 OK`

```json
{
  "shelfId": "shelf_uuid",
  "code": "S-17",
  "aisle": "04",
  "sides": ["A", "B"],
  "sections": ["A", "B", "C", "D"],
  "levelsPerSection": 5,
  "positionsPerLevel": 3,
  "capacity": 120,
  "occupiedSlotCount": 83,
  "accessPoints": {
    "A": { "x": 1510, "y": 690 },
    "B": { "x": 1510, "y": 830 }
  }
}
```

---

## 9. تعديل تكوين رف

### `PATCH /api/v1/shelves/{shelfId}/layout`

> **الشرح:** يضبط عدد الجوانب والأقسام والمستويات والمواضع ونقاط الوصول للرف داخل المسودة.

### المدخلات

```json
{
  "revisionId": "draft_revision_uuid",
  "sides": ["A", "B"],
  "sections": ["A", "B", "C", "D"],
  "levelsPerSection": 5,
  "positionsPerLevel": 3,
  "accessPoints": {
    "A": { "x": 1510, "y": 690 },
    "B": { "x": 1510, "y": 830 }
  }
}
```

### المخرجات — `200 OK`

```json
{
  "shelfId": "shelf_uuid",
  "layoutVersion": 4,
  "slotCount": 120,
  "occupiedSlotCount": 83,
  "accessPoints": {
    "A": { "x": 1510, "y": 690 },
    "B": { "x": 1510, "y": 830 }
  }
}
```

---

## 10. البحث عن المنتجات

### `GET /api/v1/products`

> **الشرح:** يبحث في أسماء المنتجات أو رمزها أو الباركود، ويبيّن إن كان المنتج موجودًا على الخريطة المنشورة.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Query | `search` | string | لا | نص البحث |
| Query | `storeId` | UUID | نعم | معرّف المتجر |
| Query | `limit` | integer | لا | عدد النتائج، الافتراضي 20 |
| Query | `cursor` | string | لا | مؤشر الصفحة التالية |

```http
GET /api/v1/products?storeId=store_uuid&search=حليب&limit=20
```

### المخرجات — `200 OK`

```json
{
  "data": [
    {
      "id": "P1004",
      "sku": "MILK-1L-FULL",
      "barcode": "6251234567890",
      "name": "حليب كامل الدسم 1 لتر",
      "category": "الألبان",
      "imageUrl": "https://cdn.example/products/P1004.webp",
      "availableInStore": true
    }
  ],
  "meta": {
    "nextCursor": null,
    "limit": 20
  }
}
```

---

## 11. إضافة موقع لمنتج

### `POST /api/v1/placements`

> **الشرح:** يربط منتجًا بخانة محددة داخل رف في النسخة المسودة من الخريطة.

### المدخلات

```json
{
  "revisionId": "draft_revision_uuid",
  "productId": "P1004",
  "shelfId": "shelf_uuid",
  "side": "A",
  "section": "B",
  "level": 3,
  "position": 2
}
```

### المخرجات — `201 Created`

```json
{
  "id": "placement_uuid",
  "productId": "P1004",
  "floorId": "floor_uuid",
  "aisle": "04",
  "shelf": "S-17",
  "side": "A",
  "section": "B",
  "level": 3,
  "position": 2,
  "locationCode": "A04-S17-A-B-L03-P02",
  "accessPoint": { "x": 1510, "y": 690 }
}
```

---

## 12. تعديل موقع منتج

### `PATCH /api/v1/placements/{placementId}`

> **الشرح:** ينقل المنتج إلى خانة أخرى أو يغيّر موقعه داخل الرف نفسه.

### المدخلات

```json
{
  "shelfId": "new_shelf_uuid",
  "side": "B",
  "section": "C",
  "level": 2,
  "position": 1
}
```

### المخرجات — `200 OK`

```json
{
  "id": "placement_uuid",
  "productId": "P1004",
  "shelfId": "new_shelf_uuid",
  "side": "B",
  "section": "C",
  "level": 2,
  "position": 1,
  "locationCode": "A05-S21-B-C-L02-P01",
  "accessPoint": { "x": 2100, "y": 910 }
}
```

---

## 13. حذف موقع منتج

### `DELETE /api/v1/placements/{placementId}`

> **الشرح:** يزيل ربط المنتج بالخانة، ولا يحذف المنتج نفسه من الكتالوج.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `placementId` | UUID | نعم | معرّف موقع المنتج |

### المخرجات — `204 No Content`

لا يوجد جسم للاستجابة.

---

## 14. معرفة مواقع منتج داخل المتجر

### `GET /api/v1/stores/{storeId}/products/{productId}/locations`

> **الشرح:** يعيد جميع المواقع المنشورة للمنتج حتى تختار الخريطة أقرب موقع أو تعرض أكثر من خيار.

### المدخلات

| المكان | الاسم | النوع | مطلوب | الوصف |
|---|---|---:|---:|---|
| Path | `storeId` | UUID | نعم | معرّف المتجر |
| Path | `productId` | UUID أو string | نعم | معرّف المنتج |
| Query | `floorId` | UUID | لا | حصر النتائج في طابق واحد |

### المخرجات — `200 OK`

```json
{
  "productId": "P1004",
  "locations": [
    {
      "placementId": "placement_uuid",
      "floorId": "floor_uuid",
      "aisle": "04",
      "shelf": "S-17",
      "side": "A",
      "section": "B",
      "level": 3,
      "position": 2,
      "locationCode": "A04-S17-A-B-L03-P02",
      "accessPoint": { "x": 1510, "y": 690 }
    }
  ]
}
```

---

## 15. حساب أقصر مسار إلى منتج

### `POST /api/v1/routes/shortest`

> **الشرح:** يحسب أقصر مسار من المدخل أو نقطة محددة إلى أقرب موقع صالح للمنتج.

### المدخلات

```json
{
  "storeId": "store_uuid",
  "floorId": "floor_uuid",
  "start": {
    "type": "entrance",
    "elementId": "entrance_uuid"
  },
  "destination": {
    "type": "product",
    "productId": "P1004"
  },
  "preferences": {
    "accessible": false,
    "avoidElementTypes": ["service_area"],
    "allowDiagonal": false
  }
}
```

يمكن أيضًا إرسال نقطة بداية مباشرة:

```json
{
  "start": {
    "type": "point",
    "point": { "x": 180, "y": 2520 }
  }
}
```

### المخرجات — `200 OK`

```json
{
  "routeId": "route_uuid",
  "mapRevisionId": "published_revision_uuid",
  "distanceMeters": 38.4,
  "estimatedSeconds": 31,
  "destination": {
    "productId": "P1004",
    "locationCode": "A04-S17-A-B-L03-P02"
  },
  "path": [
    { "x": 180, "y": 2520 },
    { "x": 180, "y": 2320 },
    { "x": 620, "y": 2320 },
    { "x": 1510, "y": 690 }
  ],
  "instructions": [
    { "type": "start", "distanceMeters": 0 },
    {
      "type": "turn_left",
      "at": { "x": 620, "y": 2320 },
      "distanceMeters": 12.4
    },
    {
      "type": "arrive",
      "shelfSide": "A"
    }
  ]
}
```

---

## 16. حساب مسار قائمة تسوق

### `POST /api/v1/routes/optimize`

> **الشرح:** يرتب المنتجات ويعيد مسارًا واحدًا يمر بها بأقل مسافة ممكنة ثم يتجه إلى صندوق الدفع.

### المدخلات

```json
{
  "storeId": "store_uuid",
  "floorId": "floor_uuid",
  "start": {
    "type": "entrance",
    "elementId": "entrance_uuid"
  },
  "productIds": [
    "P1004",
    "P2011",
    "P3320",
    "P4402"
  ],
  "end": {
    "type": "nearest_checkout"
  },
  "preferences": {
    "accessible": false
  }
}
```

### المخرجات — `200 OK`

```json
{
  "routeId": "route_uuid",
  "mapRevisionId": "published_revision_uuid",
  "orderedStops": [
    {
      "order": 1,
      "productId": "P3320",
      "locationCode": "A02-S08-A-C-L02-P01",
      "accessPoint": { "x": 800, "y": 2200 }
    },
    {
      "order": 2,
      "productId": "P1004",
      "locationCode": "A04-S17-A-B-L03-P02",
      "accessPoint": { "x": 1510, "y": 690 }
    }
  ],
  "distanceMeters": 116.7,
  "estimatedSeconds": 95,
  "path": [
    { "x": 180, "y": 2520 },
    { "x": 800, "y": 2200 },
    { "x": 1510, "y": 690 },
    { "x": 3500, "y": 2500 }
  ],
  "unavailableProductIds": []
}
```

---

## شكل الخطأ الموحد

تستخدم جميع الواجهات الشكل التالي عند فشل الطلب:

```json
{
  "status": 422,
  "code": "ROUTE_NOT_FOUND",
  "message": "لا يوجد مسار صالح إلى المنتج",
  "errors": [
    {
      "field": "destination.productId",
      "message": "موقع المنتج غير قابل للوصول"
    }
  ]
}
```

| HTTP | الاستخدام |
|---:|---|
| `400` | الطلب غير صحيح |
| `404` | الطابق أو العنصر أو المنتج غير موجود |
| `409` | تعارض في نسخة الخريطة أو خانة رف مشغولة |
| `422` | البيانات أو الخريطة غير صالحة |
| `500` | خطأ غير متوقع في الخادم |

---

## ترتيب الربط مع الواجهة الحالية

1. اربط تحميل الخريطة بـ `GET /floors/{floorId}/map`.
2. اربط الحفظ التلقائي بـ `POST /floors/{floorId}/elements/batch`.
3. اربط محرر الرفوف بواجهتي `GET/PATCH /shelves/{shelfId}/layout`.
4. اربط البحث بـ `GET /products` ومواقع المنتج بـ `GET /locations`.
5. اربط زر الاتجاهات بـ `POST /routes/shortest` وقائمة التسوق بـ `POST /routes/optimize`.
6. استخدم `validate` ثم `publish` قبل إظهار التعديلات في شاشة الملاحة.

</div>
