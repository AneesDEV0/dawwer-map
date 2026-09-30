from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Iterable, Sequence

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "output", "pdf", "DAWER_FastAPI_Backend_Guide_AR.pdf")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

W, H = A4
M = 38
CONTENT_W = W - 2 * M

FONT_REG = r"C:\Windows\Fonts\tahoma.ttf"
FONT_BOLD = r"C:\Windows\Fonts\tahomabd.ttf"
FONT_CODE = r"C:\Windows\Fonts\consola.ttf"

pdfmetrics.registerFont(TTFont("Tahoma", FONT_REG))
pdfmetrics.registerFont(TTFont("Tahoma-Bold", FONT_BOLD))
pdfmetrics.registerFont(TTFont("Consolas", FONT_CODE))


# Arabic presentation-form shaping. This keeps the PDF self-contained and
# visually correct without relying on a system-level shaping engine.
FORMS = {
    "\u0621": ("\ufe80", None, None, None),
    "\u0622": ("\ufe81", "\ufe82", None, None),
    "\u0623": ("\ufe83", "\ufe84", None, None),
    "\u0624": ("\ufe85", "\ufe86", None, None),
    "\u0625": ("\ufe87", "\ufe88", None, None),
    "\u0626": ("\ufe89", "\ufe8a", "\ufe8b", "\ufe8c"),
    "\u0627": ("\ufe8d", "\ufe8e", None, None),
    "\u0628": ("\ufe8f", "\ufe90", "\ufe91", "\ufe92"),
    "\u0629": ("\ufe93", "\ufe94", None, None),
    "\u062a": ("\ufe95", "\ufe96", "\ufe97", "\ufe98"),
    "\u062b": ("\ufe99", "\ufe9a", "\ufe9b", "\ufe9c"),
    "\u062c": ("\ufe9d", "\ufe9e", "\ufe9f", "\ufea0"),
    "\u062d": ("\ufea1", "\ufea2", "\ufea3", "\ufea4"),
    "\u062e": ("\ufea5", "\ufea6", "\ufea7", "\ufea8"),
    "\u062f": ("\ufea9", "\ufeaa", None, None),
    "\u0630": ("\ufeab", "\ufeac", None, None),
    "\u0631": ("\ufead", "\ufeae", None, None),
    "\u0632": ("\ufeaf", "\ufeb0", None, None),
    "\u0633": ("\ufeb1", "\ufeb2", "\ufeb3", "\ufeb4"),
    "\u0634": ("\ufeb5", "\ufeb6", "\ufeb7", "\ufeb8"),
    "\u0635": ("\ufeb9", "\ufeba", "\ufebb", "\ufebc"),
    "\u0636": ("\ufebd", "\ufebe", "\ufebf", "\ufec0"),
    "\u0637": ("\ufec1", "\ufec2", "\ufec3", "\ufec4"),
    "\u0638": ("\ufec5", "\ufec6", "\ufec7", "\ufec8"),
    "\u0639": ("\ufec9", "\ufeca", "\ufecb", "\ufecc"),
    "\u063a": ("\ufecd", "\ufece", "\ufecf", "\ufed0"),
    "\u0641": ("\ufed1", "\ufed2", "\ufed3", "\ufed4"),
    "\u0642": ("\ufed5", "\ufed6", "\ufed7", "\ufed8"),
    "\u0643": ("\ufed9", "\ufeda", "\ufedb", "\ufedc"),
    "\u0644": ("\ufedd", "\ufede", "\ufedf", "\ufee0"),
    "\u0645": ("\ufee1", "\ufee2", "\ufee3", "\ufee4"),
    "\u0646": ("\ufee5", "\ufee6", "\ufee7", "\ufee8"),
    "\u0647": ("\ufee9", "\ufeea", "\ufeeb", "\ufeec"),
    "\u0648": ("\ufeed", "\ufeee", None, None),
    "\u0649": ("\ufeef", "\ufef0", None, None),
    "\u064a": ("\ufef1", "\ufef2", "\ufef3", "\ufef4"),
    "\u0671": ("\ufb50", "\ufb51", None, None),
    "\u067e": ("\ufb56", "\ufb57", "\ufb58", "\ufb59"),
    "\u0686": ("\ufb7a", "\ufb7b", "\ufb7c", "\ufb7d"),
    "\u0698": ("\ufb8a", "\ufb8b", None, None),
    "\u06a9": ("\ufb8e", "\ufb8f", "\ufb90", "\ufb91"),
    "\u06af": ("\ufb92", "\ufb93", "\ufb94", "\ufb95"),
    "\u06cc": ("\ufbfc", "\ufbfd", "\ufbfe", "\ufbff"),
}


def _shape_arabic(text: str) -> str:
    chars = list(text)
    out: list[str] = []
    for i, ch in enumerate(chars):
        if ch not in FORMS:
            out.append(ch)
            continue
        prev = chars[i - 1] if i > 0 else None
        nxt = chars[i + 1] if i + 1 < len(chars) else None
        prev_connects = prev in FORMS and FORMS[prev][2] is not None and FORMS[ch][1] is not None
        next_connects = nxt in FORMS and FORMS[ch][2] is not None and FORMS[nxt][1] is not None
        iso, final, initial, medial = FORMS[ch]
        if prev_connects and next_connects and medial:
            out.append(medial)
        elif prev_connects and final:
            out.append(final)
        elif next_connects and initial:
            out.append(initial)
        else:
            out.append(iso)
    return "".join(out)


ARABIC_RE = re.compile(r"[\u0600-\u06ff]")


def has_arabic(text: str) -> bool:
    return bool(ARABIC_RE.search(text))


def rtl_visual(text: str) -> str:
    """Return a visual-order string suitable for a left-to-right PDF text run."""
    if not text:
        return text
    tokens = text.split(" ")
    visual_tokens: list[str] = []
    for token in reversed(tokens):
        # Keep Latin/code fragments readable, shape and reverse Arabic fragments.
        runs = re.findall(r"[\u0600-\u06ff]+|[^\u0600-\u06ff]+", token)
        visual_runs: list[str] = []
        for run in reversed(runs):
            if has_arabic(run):
                visual_runs.append(_shape_arabic(run)[::-1])
            else:
                visual_runs.append(run)
        visual_tokens.append("".join(visual_runs))
    return " ".join(visual_tokens)


NAVY = HexColor("#0A1F33")
INK = HexColor("#142433")
MUTED = HexColor("#617184")
BLUE = HexColor("#136EF1")
CYAN = HexColor("#37B7E5")
GREEN = HexColor("#21B573")
AMBER = HexColor("#F5A524")
RED = HexColor("#E14D63")
PAPER = HexColor("#F6F8FB")
PANEL = white
LINE = HexColor("#DDE5EE")
CODE_BG = HexColor("#0F1C2A")
CODE_TEXT = HexColor("#DCE8F4")


@dataclass
class Doc:
    c: canvas.Canvas
    page: int = 0
    section: str = ""

    def begin(self, title: str, kicker: str = "", section: str = "") -> float:
        self.page += 1
        self.section = section or title
        self.c.setFillColor(PAPER)
        self.c.rect(0, 0, W, H, stroke=0, fill=1)
        self.c.setFillColor(NAVY)
        self.c.rect(0, H - 7, W, 7, stroke=0, fill=1)
        if kicker:
            draw_rtl(self.c, kicker, W - M, H - 44, 8.5, BLUE, "Tahoma-Bold")
        draw_rtl(self.c, title, W - M, H - 68, 21, NAVY, "Tahoma-Bold")
        self.c.setStrokeColor(CYAN)
        self.c.setLineWidth(2.5)
        self.c.line(W - M - 72, H - 77, W - M, H - 77)
        return H - 98

    def end(self) -> None:
        self.c.setStrokeColor(LINE)
        self.c.setLineWidth(0.6)
        self.c.line(M, 28, W - M, 28)
        self.c.setFont("Tahoma", 7.2)
        self.c.setFillColor(MUTED)
        self.c.drawString(M, 16, f"DAWER / FastAPI Backend Blueprint  |  v1.0  |  2026")
        draw_rtl(self.c, f"صفحة {self.page}", W - M, 16, 7.5, MUTED)
        self.c.showPage()


def draw_rtl(c: canvas.Canvas, text: str, x_right: float, y: float, size: float,
             color: Color = INK, font: str = "Tahoma") -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawRightString(x_right, y, rtl_visual(text))


def draw_ltr(c: canvas.Canvas, text: str, x: float, y: float, size: float,
             color: Color = INK, font: str = "Tahoma") -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, text)


def _wrap_words(text: str, width: float, size: float, font: str = "Tahoma") -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    cur = words[0]
    for word in words[1:]:
        trial = cur + " " + word
        visual = rtl_visual(trial) if has_arabic(trial) else trial
        if pdfmetrics.stringWidth(visual, font, size) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines


def paragraph(c: canvas.Canvas, text: str, x: float, y: float, width: float,
              size: float = 10.2, leading: float = 17, color: Color = INK,
              max_lines: int | None = None) -> float:
    lines = _wrap_words(text, width, size)
    if max_lines:
        lines = lines[:max_lines]
    for line in lines:
        if has_arabic(line):
            draw_rtl(c, line, x + width, y, size, color)
        else:
            draw_ltr(c, line, x, y, size, color)
        y -= leading
    return y


def pill(c: canvas.Canvas, text: str, x: float, y: float, width: float,
         fill: Color = BLUE, text_color: Color = white) -> None:
    c.setFillColor(fill)
    c.roundRect(x, y, width, 23, 11, stroke=0, fill=1)
    if has_arabic(text):
        draw_rtl(c, text, x + width - 10, y + 7, 7.5, text_color, "Tahoma-Bold")
    else:
        c.setFont("Tahoma-Bold", 7.5)
        c.setFillColor(text_color)
        c.drawCentredString(x + width / 2, y + 7, text)


def card(c: canvas.Canvas, x: float, y_top: float, w: float, h: float,
         title: str, body: str, accent: Color = BLUE, number: str | None = None) -> None:
    y = y_top - h
    c.setFillColor(PANEL)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, 10, stroke=1, fill=1)
    c.setFillColor(accent)
    c.roundRect(x + w - 7, y, 7, h, 3, stroke=0, fill=1)
    if number:
        c.setFillColor(accent)
        c.circle(x + 20, y_top - 22, 12, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Tahoma-Bold", 8)
        c.drawCentredString(x + 20, y_top - 25, number)
    draw_rtl(c, title, x + w - 18, y_top - 25, 10.5, NAVY, "Tahoma-Bold")
    paragraph(c, body, x + 15, y_top - 48, w - 33, 8.5, 13, MUTED, max_lines=max(1, int((h - 55) / 13)))


def section_label(c: canvas.Canvas, text: str, y: float, color: Color = BLUE) -> float:
    c.setFillColor(color)
    c.roundRect(W - M - 128, y - 17, 128, 22, 11, stroke=0, fill=1)
    draw_rtl(c, text, W - M - 10, y - 10, 7.8, white, "Tahoma-Bold")
    return y - 31


def bullets(c: canvas.Canvas, items: Sequence[str], x: float, y: float, width: float,
            size: float = 9.1, leading: float = 15, accent: Color = BLUE) -> float:
    for item in items:
        lines = _wrap_words(item, width - 20, size)
        c.setFillColor(accent)
        c.circle(x + width - 5, y + 3, 2.4, stroke=0, fill=1)
        for j, line in enumerate(lines):
            draw_rtl(c, line, x + width - 16, y, size, INK if j == 0 else MUTED)
            y -= leading
        y -= 4
    return y


def code_box(c: canvas.Canvas, title: str, code: str, x: float, y_top: float,
             w: float, h: float, font_size: float = 7.0, highlight: Color = CYAN) -> None:
    y = y_top - h
    c.setFillColor(CODE_BG)
    c.roundRect(x, y, w, h, 9, stroke=0, fill=1)
    c.setFillColor(highlight)
    c.roundRect(x, y_top - 25, w, 25, 9, stroke=0, fill=1)
    c.rect(x, y_top - 25, w, 12, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont("Tahoma-Bold", 7.8)
    c.drawString(x + 11, y_top - 17, title)
    c.setFillColor(CODE_TEXT)
    yy = y_top - 39
    for line in code.strip("\n").splitlines():
        if yy < y + 9:
            break
        line = line[:116]
        if has_arabic(line):
            # Keep the JSON/Python line left-to-right while shaping only the
            # Arabic value fragments inside it.
            shown = re.sub(
                r"[\u0600-\u06ff]+",
                lambda match: _shape_arabic(match.group(0))[::-1],
                line,
            )
            c.setFont("Tahoma", font_size)
        else:
            shown = line
            c.setFont("Consolas", font_size)
        c.drawString(x + 11, yy, shown)
        yy -= font_size + 3.2


def table(c: canvas.Canvas, headers: Sequence[str], rows: Sequence[Sequence[str]],
          x: float, y_top: float, widths: Sequence[float], row_h: float = 27,
          font_size: float = 6.8) -> float:
    total = sum(widths)
    c.setFillColor(NAVY)
    c.roundRect(x, y_top - 24, total, 24, 7, stroke=0, fill=1)
    xx = x
    for head, w in zip(headers, widths):
        if has_arabic(head):
            draw_rtl(c, head, xx + w - 6, y_top - 16, 7.2, white, "Tahoma-Bold")
        else:
            draw_ltr(c, head, xx + 6, y_top - 16, 7.2, white, "Tahoma-Bold")
        xx += w
    y = y_top - 24
    for i, row in enumerate(rows):
        c.setFillColor(PANEL if i % 2 == 0 else HexColor("#EDF2F7"))
        c.setStrokeColor(LINE)
        c.rect(x, y - row_h, total, row_h, stroke=1, fill=1)
        xx = x
        for value, w in zip(row, widths):
            value = str(value)
            c.setFillColor(INK)
            if has_arabic(value):
                draw_rtl(c, value, xx + w - 5, y - 17, font_size, INK)
            else:
                font = "Consolas" if "/" in value or value in {"GET", "POST", "PATCH", "DELETE", "WS"} else "Tahoma"
                draw_ltr(c, value[:44], xx + 5, y - 17, font_size, INK, font)
            xx += w
        y -= row_h
    return y


def note(c: canvas.Canvas, text: str, x: float, y_top: float, w: float,
         color: Color = BLUE, height: float = 48) -> float:
    y = y_top - height
    c.setFillColor(Color(color.red, color.green, color.blue, alpha=0.08))
    c.setStrokeColor(color)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, height, 8, stroke=1, fill=1)
    c.setFillColor(color)
    c.circle(x + w - 18, y_top - 18, 7, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Tahoma-Bold", 7)
    c.drawCentredString(x + w - 18, y_top - 20.5, "i")
    paragraph(c, text, x + 13, y_top - 19, w - 42, 8.4, 13, INK, max_lines=3)
    return y


def stat(c: canvas.Canvas, x: float, y: float, w: float, value: str, label: str, color: Color) -> None:
    c.setFillColor(PANEL)
    c.setStrokeColor(LINE)
    c.roundRect(x, y, w, 63, 10, stroke=1, fill=1)
    draw_ltr(c, value, x + 13, y + 31, 20, color, "Tahoma-Bold")
    draw_rtl(c, label, x + w - 12, y + 14, 7.4, MUTED, "Tahoma-Bold")


def arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color: Color = BLUE) -> None:
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.5)
    c.line(x1, y1, x2, y2)
    angle = 5
    if abs(x2 - x1) > abs(y2 - y1):
        d = 1 if x2 > x1 else -1
        c.line(x2, y2, x2 - d * angle, y2 + 3)
        c.line(x2, y2, x2 - d * angle, y2 - 3)
    else:
        d = 1 if y2 > y1 else -1
        c.line(x2, y2, x2 + 3, y2 - d * angle)
        c.line(x2, y2, x2 - 3, y2 - d * angle)


def finish_page(doc: Doc) -> None:
    doc.end()


def cover(doc: Doc) -> None:
    c = doc.c
    doc.page += 1
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(BLUE)
    c.circle(70, H - 85, 102, stroke=0, fill=1)
    c.setFillColor(CYAN)
    c.circle(W - 22, 80, 135, stroke=0, fill=1)
    c.setFillColor(Color(1, 1, 1, alpha=0.06))
    for i in range(8):
        c.roundRect(44 + (i % 2) * 65, 165 + i * 43, 48, 25, 5, stroke=0, fill=1)
    pill(c, "BACKEND BLUEPRINT", M, H - 126, 123, CYAN, NAVY)
    draw_rtl(c, "دليل بناء الباك إند", W - M, H - 220, 34, white, "Tahoma-Bold")
    draw_ltr(c, "FastAPI", M, H - 267, 32, CYAN, "Tahoma-Bold")
    draw_rtl(c, "لنظام رسم خرائط السوبرماركت الداخلي والملاحة الذكية", W - M, H - 309, 16, HexColor("#D8E7F4"), "Tahoma-Bold")
    paragraph(c, "مخطط تنفيذي كامل يحول النموذج الحالي إلى منصة إنتاجية: قاعدة البيانات، العقود البرمجية، المدخلات والمخرجات، إدارة نسخ الخريطة، تحديد مواقع المنتجات، خوارزمية المسار، الأمان، الاختبارات والنشر.", M, H - 352, CONTENT_W, 11.5, 19, HexColor("#C7D5E3"))
    labels = [("FastAPI", 88), ("PostgreSQL", 98), ("Redis", 68), ("A* Routing", 90)]
    xx = M
    for label, ww in labels:
        pill(c, label, xx, 142, ww, Color(1, 1, 1, alpha=0.13), white)
        xx += ww + 9
    c.setFillColor(Color(1, 1, 1, alpha=0.13))
    c.roundRect(M, 57, CONTENT_W, 58, 12, stroke=0, fill=1)
    draw_rtl(c, "مصمم خصيصًا لنموذج DAWER الحالي — واجهة عربية RTL", W - M - 16, 91, 9.5, white, "Tahoma-Bold")
    draw_ltr(c, "API v1  /  Production-ready specification  /  September 2026", M + 16, 70, 7.5, HexColor("#C7D5E3"), "Tahoma")
    c.showPage()


def contents(doc: Doc) -> None:
    y = doc.begin("خريطة الدليل", "من الفكرة إلى API جاهز للإنتاج", "المحتويات")
    groups = [
        ("01", "الرؤية والمعمارية", "النطاق، المكوّنات، قرارات المجال، التقنيات", BLUE),
        ("02", "التهيئة وهيكل المشروع", "الإعداد المحلي، المجلدات، الإعدادات والأسرار", CYAN),
        ("03", "قاعدة البيانات", "الجداول، العلاقات، نسخ الخريطة، الفهارس والترحيلات", GREEN),
        ("04", "عقد الواجهة البرمجية", "المعايير العامة، المصادقة، الخرائط، الرفوف والمنتجات", AMBER),
        ("05", "الملاحة الذكية", "أقصر مسار، عدة محطات، شبكة المشي والتحقق", RED),
        ("06", "الإنتاج والجودة", "التزامن، الأمان، الاختبارات، الأداء، النشر وخطة التنفيذ", BLUE),
    ]
    for num, title, body, color in groups:
        c = doc.c
        c.setFillColor(PANEL)
        c.setStrokeColor(LINE)
        c.roundRect(M, y - 73, CONTENT_W, 62, 10, stroke=1, fill=1)
        c.setFillColor(color)
        c.roundRect(M + CONTENT_W - 58, y - 73, 58, 62, 10, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Tahoma-Bold", 14)
        c.drawCentredString(M + CONTENT_W - 29, y - 49, num)
        draw_rtl(c, title, M + CONTENT_W - 75, y - 34, 11, NAVY, "Tahoma-Bold")
        draw_rtl(c, body, M + CONTENT_W - 75, y - 55, 8.2, MUTED)
        y -= 76
    note(doc.c, "ابدأ بالصفحات 3–5 لاتخاذ القرارات، ثم نفّذ الصفحات 6–13، وبعدها طبّق الـ endpoints بالترتيب الوارد في خطة التنفيذ.", M, y - 6, CONTENT_W, BLUE, 49)
    finish_page(doc)


def vision(doc: Doc) -> None:
    y = doc.begin("الرؤية الكاملة للنظام", "01 — الرؤية والمعمارية")
    paragraph(doc.c, "الواجهة الحالية هي محرر خريطة ومتصفح ملاحة يعمل ببيانات محلية. الباك إند المقترح يحولها إلى نظام متعدد المتاجر، يحفظ كل تعديل بأمان، ينشر نسخة مستقرة للزبائن، ويحسب المسارات اعتمادًا على نفس نموذج الإحداثيات.", M, y, CONTENT_W, 10.5, 18)
    y -= 84
    cols = (CONTENT_W - 16) / 3
    card(doc.c, M, y, cols, 137, "تجربة الزبون", "البحث عن منتج، اختيار موقعه، حساب أقصر مسار من المدخل، ثم تحسين جولة قائمة التسوق.", BLUE, "1")
    card(doc.c, M + cols + 8, y, cols, 137, "إدارة المتجر", "رسم العناصر، ضبط الرفوف، ربط المنتجات بالخانات، مراجعة الأخطاء ثم نشر الخريطة.", GREEN, "2")
    card(doc.c, M + 2 * (cols + 8), y, cols, 137, "تشغيل موثوق", "صلاحيات، سجل تدقيق، نسخ خريطة، قفل تعارضات، مراقبة وأداء قابل للتوسع.", AMBER, "3")
    y -= 162
    y = section_label(doc.c, "حدود الإصدار الأول", y)
    y = bullets(doc.c, [
        "متاجر متعددة، ولكل متجر طوابق وخريطة مستقلة.",
        "عناصر الخريطة: رف، جدار، ثلاجة، فريزر، صندوق دفع، مدخل، عائق ونقطة خدمة.",
        "نظام رفوف يدعم الجهة والقسم والمستوى والموضع، مع رمز موقع قابل للطباعة.",
        "نسخة مسودة للتحرير ونسخة منشورة للملاحة؛ النشر عملية ذرّية واحدة.",
        "محرك A* لمسار واحد، وتحسين ترتيب عدة منتجات بطريقة nearest-neighbor مع تحسين 2-opt اختياري.",
    ], M, y, CONTENT_W)
    note(doc.c, "قرار أساسي: تطبيق الزبون يقرأ النسخة المنشورة فقط، بينما لوحة الإدارة تتعامل مع المسودة. هذا يمنع ظهور خريطة نصف مكتملة للمستخدمين.", M, y - 4, CONTENT_W, GREEN, 54)
    finish_page(doc)


def architecture(doc: Doc) -> None:
    y = doc.begin("المعمارية المقترحة", "01 — الرؤية والمعمارية")
    c = doc.c
    labels = [
        (M, y - 75, 130, 58, "واجهة الزبون", "Search + Navigation", BLUE),
        (W - M - 130, y - 75, 130, 58, "لوحة الإدارة", "Map Editor", GREEN),
        (M + 161, y - 172, 198, 76, "FastAPI Application", "REST / WebSocket / OpenAPI", NAVY),
        (M, y - 300, 132, 66, "PostgreSQL", "Source of truth", BLUE),
        (M + 191, y - 300, 132, 66, "Redis", "Cache + locks", RED),
        (W - M - 132, y - 300, 132, 66, "Worker", "Jobs + rebuild", AMBER),
        (M + 161, y - 423, 198, 64, "Observability", "Logs / metrics / traces", CYAN),
    ]
    for x, yy, ww, hh, ar, en, color in labels:
        c.setFillColor(PANEL)
        c.setStrokeColor(color)
        c.setLineWidth(1.2)
        c.roundRect(x, yy, ww, hh, 9, stroke=1, fill=1)
        c.setFillColor(color)
        c.rect(x, yy + hh - 6, ww, 6, stroke=0, fill=1)
        draw_rtl(c, ar, x + ww - 11, yy + hh - 28, 9.4, NAVY, "Tahoma-Bold")
        draw_ltr(c, en, x + 11, yy + 13, 7.2, MUTED, "Tahoma")
    arrow(c, M + 130, y - 48, M + 211, y - 121, BLUE)
    arrow(c, W - M - 130, y - 48, M + 348, y - 121, GREEN)
    arrow(c, M + 222, y - 172, M + 109, y - 234, BLUE)
    arrow(c, M + 260, y - 172, M + 257, y - 234, RED)
    arrow(c, M + 302, y - 172, W - M - 66, y - 234, AMBER)
    arrow(c, M + 260, y - 300, M + 260, y - 359, CYAN)
    note(c, "ابدأ كتطبيق واحد modular monolith. افصل محرك الملاحة كخدمة داخلية واضحة، ولا تحوله إلى microservice إلا عندما يظهر حمل مستقل حقيقي.", M, y - 455, CONTENT_W, BLUE, 55)
    finish_page(doc)


def decisions(doc: Doc) -> None:
    y = doc.begin("قرارات المجال التي تمنع التعقيد لاحقًا", "01 — الرؤية والمعمارية")
    cards = [
        ("وحدة القياس", "خزّن الإحداثيات والأبعاد بالسنتيمتر كأعداد صحيحة. الواجهة تحولها إلى بكسل حسب zoom.", BLUE),
        ("نقطة الأصل", "اعتمد أعلى اليسار كـ origin: المحور x يمينًا و y إلى أسفل، مطابقًا للنموذج الحالي.", CYAN),
        ("نسخ الخريطة", "كل تعديل ينتمي إلى revision. لا تُحدّث النسخة المنشورة مباشرة.", GREEN),
        ("المعرّفات", "استخدم UUID في الـ API، وأضف code بشريًا مثل A04-S17-A-B-L03-P02.", AMBER),
        ("العوائق", "العنصر يمنع المرور حسب type و walkable، وليس حسب لونه أو شكله في الواجهة.", RED),
        ("الوصول للرف", "المسار ينتهي عند access point بجوار الرف لا داخل مستطيل الرف.", BLUE),
    ]
    col = (CONTENT_W - 12) / 2
    for i, (title, body, color) in enumerate(cards):
        row = i // 2
        side = i % 2
        card(doc.c, M + side * (col + 12), y - row * 126, col, 112, title, body, color)
    y2 = y - 3 * 126 - 4
    note(doc.c, "قاعدة توافق الواجهة: الحقول x و y و width و height و rotation تبقى بأسمائها الحالية داخل DTO الخاص بالهندسة، لتقليل تغييرات الفرونت إند.", M, y2, CONTENT_W, GREEN, 54)
    y2 -= 70
    table(doc.c, ["القرار", "القيمة"], [
        ["API prefix", "/api/v1"], ["Content type", "application/json"],
        ["ID format", "UUID v4"], ["Time", "UTC / ISO 8601"],
        ["Coordinates", "integer centimeters"], ["Published map", "immutable revision"],
    ], M, y2, [160, CONTENT_W - 160], 25, 7.2)
    finish_page(doc)


def stack_setup(doc: Doc) -> None:
    y = doc.begin("التقنيات والتهيئة المحلية", "02 — التهيئة وهيكل المشروع")
    table(doc.c, ["الحزمة", "الغرض", "مطلوبة؟"], [
        ["FastAPI + Uvicorn", "HTTP, OpenAPI, ASGI", "نعم"],
        ["SQLAlchemy 2 async", "ORM + transactions", "نعم"],
        ["asyncpg + PostgreSQL", "قاعدة البيانات", "نعم"],
        ["Alembic", "ترحيلات الجداول", "نعم"],
        ["Pydantic Settings", "الإعدادات والأسرار", "نعم"],
        ["PyJWT + Argon2", "التوكن وكلمات المرور", "نعم"],
        ["Redis", "كاش وأقفال ومعدل الطلبات", "موصى به"],
        ["Pytest + HTTPX", "اختبارات API", "نعم"],
    ], M, y, [165, 215, CONTENT_W - 380], 29, 7.2)
    y -= 8 * 29 + 45
    code_box(doc.c, "PowerShell — bootstrap", r"""
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi "uvicorn[standard]" sqlalchemy asyncpg alembic
pip install pydantic-settings pyjwt argon2-cffi redis orjson
pip install pytest pytest-asyncio httpx ruff mypy
alembic init app/db/migrations
uvicorn app.main:app --reload --port 8000
""", M, y, CONTENT_W, 166, 8)
    note(doc.c, "ثبّت الإصدارات في pyproject.toml أو requirements.lock. لا تعتمد على latest في بيئة الإنتاج.", M, y - 179, CONTENT_W, AMBER, 48)
    finish_page(doc)


def project_structure(doc: Doc) -> None:
    y = doc.begin("هيكل مشروع واضح وقابل للتوسع", "02 — التهيئة وهيكل المشروع")
    code_box(doc.c, "Recommended layout", r"""
app/
|-- main.py                 # create_app, middleware, routers
|-- core/                   # config, security, logging, errors
|-- db/                     # session, base, migrations
|-- modules/
|   |-- auth/               # router, schemas, service
|   |-- stores/             # store + floor
|   |-- maps/               # revisions + elements + publish
|   |-- catalog/            # products + placements
|   |-- shelves/            # layouts + slots
|   `-- routing/            # graph builder + A* + optimizer
|-- realtime/               # WebSocket broker
`-- tests/                  # unit, integration, contract
""", M, y, 290, 286, 7.6)
    x2 = M + 307
    yy = y
    card(doc.c, x2, yy, CONTENT_W - 307, 94, "قاعدة الاعتماد", "الـ router يستدعي service، والخدمة تستدعي repository. لا تضع منطق المجال داخل route handler.", BLUE)
    yy -= 108
    card(doc.c, x2, yy, CONTENT_W - 307, 94, "حدود المعاملة", "عملية publish وعملية batch update تعملان داخل transaction واحدة أو تفشلان كاملتين.", GREEN)
    yy -= 108
    card(doc.c, x2, yy, CONTENT_W - 307, 94, "عزل الملاحة", "routing لا يعرف FastAPI. يستقبل MapSnapshot ويعيد RouteResult، فيسهل اختباره.", AMBER)
    yy -= 108
    card(doc.c, x2, yy, CONTENT_W - 307, 94, "العقود أولًا", "عرّف Pydantic schemas قبل التنفيذ، وصدّر OpenAPI ليستهلكها الفرونت إند.", CYAN)
    y2 = y - 320
    note(doc.c, "يمكن دمج repository وservice في البداية للوحدات البسيطة، لكن أبقِ maps وrouting منفصلتين لأنهما تحملان معظم منطق العمل.", M, y2 - 96, CONTENT_W, BLUE, 53)
    finish_page(doc)


def settings_page(doc: Doc) -> None:
    y = doc.begin("الإعدادات والتشغيل", "02 — التهيئة وهيكل المشروع")
    code_box(doc.c, "app/core/config.py", r"""
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_env: str = "local"
    api_prefix: str = "/api/v1"
    database_url: str
    redis_url: str | None = None
    jwt_secret: str
    jwt_exp_minutes: int = 30
    cors_origins: list[str] = []
    map_grid_cm: int = 20

    model_config = SettingsConfigDict(
        env_file=".env", env_nested_delimiter="__", extra="ignore"
    )
""", M, y, CONTENT_W, 205, 7.4)
    y -= 220
    table(doc.c, ["المتغير", "مثال محلي", "ملاحظة"], [
        ["DATABASE_URL", "postgresql+asyncpg://...", "سر"],
        ["REDIS_URL", "redis://localhost:6379/0", "اختياري محليًا"],
        ["JWT_SECRET", "generated-32-bytes", "لا يُرفع إلى Git"],
        ["CORS_ORIGINS", "[\"http://localhost:3000\"]", "قائمة صريحة"],
        ["MAP_GRID_CM", "20", "دقة شبكة A*"],
        ["LOG_LEVEL", "INFO", "JSON في الإنتاج"],
    ], M, y, [145, 210, CONTENT_W - 355], 29, 6.7)
    y -= 6 * 29 + 39
    note(doc.c, "في الإنتاج استخدم Secret Manager أو متغيرات المنصة. ملف .env للتطوير فقط، وأضف .env.example بلا قيم حساسة.", M, y, CONTENT_W, RED, 54)
    finish_page(doc)


def data_overview(doc: Doc) -> None:
    y = doc.begin("نموذج البيانات — النظرة العامة", "03 — قاعدة البيانات")
    c = doc.c
    nodes = [
        ("Organization", M + 182, y - 40, BLUE),
        ("Store", M + 182, y - 116, GREEN),
        ("Floor", M + 182, y - 192, CYAN),
        ("MapRevision", M + 182, y - 268, AMBER),
        ("MapElement", M + 30, y - 356, RED),
        ("Shelf", M + 182, y - 356, BLUE),
        ("ProductPlacement", M + 334, y - 356, GREEN),
        ("Product", M + 334, y - 446, NAVY),
    ]
    for label, x, yy, color in nodes:
        c.setFillColor(PANEL)
        c.setStrokeColor(color)
        c.setLineWidth(1.2)
        c.roundRect(x, yy, 145, 42, 7, stroke=1, fill=1)
        c.setFillColor(color)
        c.rect(x, yy, 5, 42, stroke=0, fill=1)
        c.setFont("Consolas", 8.3)
        c.setFillColor(INK)
        c.drawCentredString(x + 74, yy + 16, label)
    arrow(c, M + 254, y + 2, M + 254, y - 72, BLUE)
    arrow(c, M + 254, y - 74, M + 254, y - 148, GREEN)
    arrow(c, M + 254, y - 150, M + 254, y - 224, CYAN)
    arrow(c, M + 254, y - 226, M + 102, y - 314, AMBER)
    arrow(c, M + 254, y - 226, M + 254, y - 314, AMBER)
    arrow(c, M + 254, y - 226, M + 406, y - 314, AMBER)
    arrow(c, M + 406, y - 358, M + 406, y - 404, GREEN)
    note(c, "User وMembership يرتبطان بالـ Organization لتحديد الدور داخل المؤسسة. لا تربط الدور مباشرة بالمتجر إلا إذا احتجت صلاحيات أدق لاحقًا.", M, y - 474, CONTENT_W, BLUE, 53)
    finish_page(doc)


def schema_store_floor(doc: Doc) -> None:
    y = doc.begin("الجداول الأساسية: المتجر والطابق", "03 — قاعدة البيانات")
    table(doc.c, ["Store", "النوع", "القيود"], [
        ["id", "uuid", "PK"], ["organization_id", "uuid", "FK + index"],
        ["name", "varchar(160)", "required"], ["slug", "varchar(80)", "unique/org"],
        ["timezone", "varchar(50)", "default UTC"], ["status", "enum", "draft|active|archived"],
        ["created_at / updated_at", "timestamptz", "server default"],
    ], M, y, [190, 150, CONTENT_W - 340], 27, 6.9)
    y -= 7 * 27 + 41
    table(doc.c, ["Floor", "النوع", "القيود"], [
        ["id", "uuid", "PK"], ["store_id", "uuid", "FK + index"],
        ["name / level", "varchar / int", "unique(store, level)"],
        ["width_cm / height_cm", "integer", "> 0"],
        ["origin", "enum", "top_left"], ["published_revision_id", "uuid?", "FK"],
        ["draft_revision_id", "uuid?", "FK"],
    ], M, y, [190, 150, CONTENT_W - 340], 27, 6.9)
    y -= 7 * 27 + 39
    note(doc.c, "استخدم soft delete للمتجر والطابق إذا كان لديك سجلات استخدام أو خرائط منشورة. الحذف النهائي يكون مهمة إدارية منفصلة.", M, y, CONTENT_W, AMBER, 50)
    finish_page(doc)


def schema_revision_element(doc: Doc) -> None:
    y = doc.begin("نسخ الخريطة وعناصرها", "03 — قاعدة البيانات")
    table(doc.c, ["MapRevision", "التفسير"], [
        ["id, floor_id", "معرّف النسخة والطابق"], ["number", "رقم متزايد داخل الطابق"],
        ["status", "draft | published | archived"], ["based_on_id", "النسخة التي بدأت منها المسودة"],
        ["version", "رقم optimistic locking"], ["published_at/by", "أثر عملية النشر"],
        ["validation_report", "JSON لأخطاء الخريطة"],
    ], M, y, [180, CONTENT_W - 180], 27, 7.1)
    y -= 7 * 27 + 42
    table(doc.c, ["MapElement", "النوع / مثال"], [
        ["revision_id", "uuid"], ["element_type", "shelf|wall|freezer|fridge|checkout|entrance|obstacle"],
        ["label", "رف 17"], ["x_cm, y_cm", "integer"],
        ["width_cm, height_cm", "integer > 0"], ["rotation_deg", "0..359"],
        ["walkable", "boolean"], ["properties", "jsonb: color, icon, serviceType..."],
    ], M, y, [180, CONTENT_W - 180], 27, 6.8)
    y -= 8 * 27 + 38
    note(doc.c, "عند إنشاء مسودة جديدة انسخ عناصر النسخة المنشورة مرة واحدة. بعدها تتغير المسودة وحدها إلى أن تنجح validate ثم publish.", M, y, CONTENT_W, GREEN, 54)
    finish_page(doc)


def schema_catalog(doc: Doc) -> None:
    y = doc.begin("الرفوف والمنتجات ومواقعها", "03 — قاعدة البيانات")
    cols = (CONTENT_W - 16) / 3
    card(doc.c, M, y, cols, 131, "Shelf", "يمتد MapElement من النوع shelf ببيانات الجوانب، الأقسام، المستويات والمواضع.", BLUE)
    card(doc.c, M + cols + 8, y, cols, 131, "Product", "SKU وbarcode والاسم والتصنيف والصورة والحالة؛ مستقل عن أي خريطة.", GREEN)
    card(doc.c, M + 2 * (cols + 8), y, cols, 131, "ProductPlacement", "يربط المنتج بخانة محددة في رف ضمن نسخة خريطة، ويمكن أن تكون له عدة مواقع.", AMBER)
    y -= 158
    table(doc.c, ["حقل الموقع", "مثال", "قاعدة"], [
        ["shelf_id", "S-17", "must belong to revision"],
        ["side", "A", "A | B"], ["section", "B", "within layout"],
        ["level", "3", "1..levels"], ["position", "2", "1..positions"],
        ["location_code", "A04-S17-A-B-L03-P02", "unique/revision"],
        ["access_point", "{x: 1640, y: 920}", "computed or override"],
    ], M, y, [165, 185, CONTENT_W - 350], 30, 6.8)
    y -= 7 * 30 + 39
    code_box(doc.c, "Unique slot constraint", """
UNIQUE (
  revision_id, shelf_id, side,
  section_code, level_no, position_no
)
""", M, y, 232, 93, 7.6)
    note(doc.c, "إن سمحت بأكثر من منتج في الخانة، استبدل القيد الفريد بنموذج ShelfSlot مستقل ثم اربط placements به مع ترتيب facings.", M + 247, y, CONTENT_W - 247, BLUE, 93)
    finish_page(doc)


def indexes_migrations(doc: Doc) -> None:
    y = doc.begin("الفهارس والترحيلات وسلامة البيانات", "03 — قاعدة البيانات")
    table(doc.c, ["الفهرس / القيد", "السبب"], [
        ["products(name gin_trgm_ops)", "بحث عربي سريع مع ILIKE"],
        ["products(barcode) UNIQUE", "إيجاد مباشر ومنع التكرار"],
        ["placements(product_id, revision_id)", "مواقع المنتج في الخريطة"],
        ["elements(revision_id, element_type)", "تحميل العناصر حسب النسخة"],
        ["revisions(floor_id, status)", "المسودة والمنشور"],
        ["floors(store_id, level) UNIQUE", "ترتيب الطوابق"],
        ["CHECK width_cm > 0", "منع هندسة غير صالحة"],
        ["FK ... ON DELETE RESTRICT", "حماية النسخ المنشورة"],
    ], M, y, [230, CONTENT_W - 230], 29, 7.1)
    y -= 8 * 29 + 42
    code_box(doc.c, "Migration routine", r"""
alembic revision --autogenerate -m "add map revisions"
alembic upgrade head
alembic check

# CI: create empty database -> upgrade head -> run tests
# Deploy: backup -> migrate -> start new app -> readiness check
""", M, y, CONTENT_W, 128, 7.6)
    y -= 145
    note(doc.c, "لا تعدّل migration سبق تشغيلها في بيئة مشتركة. أنشئ migration تصحيحية جديدة، واختبر downgrade إن كانت سياسة النشر تتطلب الرجوع.", M, y, CONTENT_W, RED, 54)
    finish_page(doc)


def api_conventions(doc: Doc) -> None:
    y = doc.begin("معايير موحدة لعقد الـ API", "04 — عقد الواجهة البرمجية")
    table(doc.c, ["البند", "المعيار"], [
        ["Base URL", "/api/v1"], ["IDs", "UUID strings"],
        ["Dates", "ISO 8601 UTC"], ["Pagination", "cursor + limit"],
        ["Filtering", "query parameters"], ["Mutation safety", "Idempotency-Key"],
        ["Concurrency", "If-Match: revision version"], ["Errors", "application/problem+json"],
        ["Tracing", "X-Request-ID"], ["Localization", "Accept-Language: ar"],
    ], M, y, [180, CONTENT_W - 180], 27, 7.1)
    y -= 10 * 27 + 41
    code_box(doc.c, "Success envelope — list", """
{
  "data": [{ "id": "...", "name": "فرع رام الله" }],
  "meta": { "nextCursor": "eyJpZCI6...", "limit": 20 }
}
""", M, y, (CONTENT_W - 10) / 2, 116, 6.9)
    code_box(doc.c, "Problem details — error", """
{
  "type": "https://api.dawer.app/problems/map-conflict",
  "title": "تعارض في نسخة الخريطة",
  "status": 409,
  "code": "MAP_VERSION_CONFLICT",
  "requestId": "req_01J...",
  "errors": [{ "field": "version", "message": "Expected 12" }]
}
""", M + (CONTENT_W + 10) / 2, y, (CONTENT_W - 10) / 2, 116, 6.2)
    finish_page(doc)


def endpoint_catalog_1(doc: Doc) -> None:
    y = doc.begin("فهرس الـ endpoints — الهوية والمتاجر والخرائط", "04 — عقد الواجهة البرمجية")
    rows = [
        ["POST", "/auth/login", "credentials", "tokens", "عام"],
        ["POST", "/auth/refresh", "refreshToken", "tokens", "عام"],
        ["POST", "/auth/logout", "refreshToken", "204", "مستخدم"],
        ["GET", "/auth/me", "—", "user", "مستخدم"],
        ["GET", "/stores", "cursor, limit", "Store[]", "مستخدم"],
        ["POST", "/stores", "StoreCreate", "Store", "مالك"],
        ["GET", "/stores/{store_id}", "—", "Store", "مستخدم"],
        ["PATCH", "/stores/{store_id}", "StorePatch", "Store", "مدير"],
        ["DELETE", "/stores/{store_id}", "—", "204", "مالك"],
        ["GET", "/stores/{store_id}/floors", "—", "Floor[]", "مستخدم"],
        ["POST", "/stores/{store_id}/floors", "FloorCreate", "Floor", "محرر"],
        ["PATCH", "/floors/{floor_id}", "FloorPatch", "Floor", "محرر"],
        ["GET", "/floors/{floor_id}/map", "revision", "MapSnapshot", "مستخدم"],
        ["POST", "/floors/{floor_id}/elements", "ElementCreate", "Element", "محرر"],
        ["PATCH", "/elements/{element_id}", "ElementPatch", "Element", "محرر"],
        ["DELETE", "/elements/{element_id}", "—", "204", "محرر"],
    ]
    table(doc.c, ["HTTP", "المسار", "المدخل", "المخرج", "الدور"], rows, M, y, [46, 235, 91, 78, CONTENT_W - 450], 29, 6.15)
    note(doc.c, "كل عمليات التعديل على الخريطة تتطلب X-Map-Revision أو If-Match حتى يرفض الخادم الكتابة فوق تعديل أحدث.", M, y - len(rows) * 29 - 38, CONTENT_W, AMBER, 49)
    finish_page(doc)


def endpoint_catalog_2(doc: Doc) -> None:
    y = doc.begin("فهرس الـ endpoints — النشر والكتالوج والملاحة", "04 — عقد الواجهة البرمجية")
    rows = [
        ["POST", "/floors/{floor_id}/elements/batch", "operations[]", "BatchResult", "محرر"],
        ["GET", "/floors/{floor_id}/revisions", "cursor", "Revision[]", "محرر"],
        ["POST", "/floors/{floor_id}/validate", "revisionId", "Validation", "محرر"],
        ["POST", "/floors/{floor_id}/publish", "revisionId", "Revision", "ناشر"],
        ["GET", "/shelves/{shelf_id}/layout", "—", "ShelfLayout", "مستخدم"],
        ["PATCH", "/shelves/{shelf_id}/layout", "ShelfLayoutPatch", "ShelfLayout", "محرر"],
        ["GET", "/products", "search, cursor", "Product[]", "مستخدم"],
        ["POST", "/products", "ProductCreate", "Product", "مدير"],
        ["PATCH", "/products/{product_id}", "ProductPatch", "Product", "مدير"],
        ["POST", "/placements", "PlacementCreate", "Placement", "محرر"],
        ["PATCH", "/placements/{id}", "PlacementPatch", "Placement", "محرر"],
        ["DELETE", "/placements/{id}", "—", "204", "محرر"],
        ["GET", "/stores/{store_id}/products/{id}/locations", "revision", "Location[]", "مستخدم"],
        ["POST", "/routes/shortest", "RouteRequest", "RouteResult", "عام/مستخدم"],
        ["POST", "/routes/optimize", "OptimizeRequest", "RouteResult", "عام/مستخدم"],
        ["WS", "/ws/stores/{store_id}/floors/{floor_id}", "events", "events", "محرر"],
    ]
    table(doc.c, ["HTTP", "المسار", "المدخل", "المخرج", "الدور"], rows, M, y, [46, 235, 91, 78, CONTENT_W - 450], 29, 5.95)
    finish_page(doc)


def auth_page(doc: Doc) -> None:
    y = doc.begin("المصادقة وتجديد الجلسة", "04 — عقد الواجهة البرمجية")
    code_box(doc.c, "POST /api/v1/auth/login — input", """
{
  "email": "manager@example.com",
  "password": "correct-horse-battery-staple"
}
""", M, y, 242, 108, 7.2)
    code_box(doc.c, "200 — output", """
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 1800,
  "user": { "id": "uuid", "name": "مدير الفرع", "roles": ["editor"] }
}
""", M + 255, y, CONTENT_W - 255, 108, 6.55)
    y -= 128
    y = section_label(doc.c, "قواعد التنفيذ", y)
    y = bullets(doc.c, [
        "خزّن كلمة المرور باستخدام Argon2id ولا تُعدها في أي response.",
        "اجعل access token قصير العمر، ودوّر refresh token عند كل استخدام.",
        "خزّن hash للـ refresh token مع device id ووقت الانتهاء وإمكانية الإلغاء.",
        "لواجهة ويب على نطاقك، يفضّل refresh token داخل HttpOnly Secure SameSite cookie.",
        "أرجع 401 للتوكن غير الصحيح أو المنتهي، و403 عندما تكون الهوية صحيحة لكن الدور غير كافٍ.",
    ], M, y, CONTENT_W, 9.1)
    y -= 4
    table(doc.c, ["الحالة", "الكود"], [
        ["400", "VALIDATION_ERROR"], ["401", "INVALID_CREDENTIALS"],
        ["423", "ACCOUNT_LOCKED"], ["429", "RATE_LIMITED"],
    ], M, y, [105, CONTENT_W - 105], 28, 7)
    finish_page(doc)


def stores_floors_page(doc: Doc) -> None:
    y = doc.begin("إدارة المتاجر والطوابق", "04 — عقد الواجهة البرمجية")
    code_box(doc.c, "POST /api/v1/stores — input", """
{
  "name": "سوبرماركت النخبة — رام الله",
  "slug": "elite-ramallah",
  "timezone": "Asia/Hebron"
}
""", M, y, 250, 116, 7.0)
    code_box(doc.c, "201 — Store output", """
{
  "id": "5ee84d5d-...",
  "name": "سوبرماركت النخبة — رام الله",
  "slug": "elite-ramallah",
  "status": "draft",
  "createdAt": "2026-09-23T08:00:00Z"
}
""", M + 263, y, CONTENT_W - 263, 116, 6.4)
    y -= 138
    code_box(doc.c, "POST /stores/{store_id}/floors", """
{
  "name": "الطابق الأرضي",
  "level": 0,
  "widthCm": 4200,
  "heightCm": 2800,
  "origin": "top_left"
}
""", M, y, 250, 126, 7)
    code_box(doc.c, "201 — Floor output", """
{
  "id": "floor_uuid",
  "storeId": "store_uuid",
  "name": "الطابق الأرضي",
  "level": 0,
  "canvas": { "widthCm": 4200, "heightCm": 2800 },
  "draftRevisionId": "revision_uuid",
  "publishedRevisionId": null
}
""", M + 263, y, CONTENT_W - 263, 126, 6.15)
    y -= 146
    bullets(doc.c, [
        "POST يُرجع 201 مع Location header.",
        "DELETE متجر مستخدم يُحوّله إلى archived بدل حذفه مباشرة.",
        "تغيير أبعاد الطابق يشغّل validate للتأكد أن كل العناصر بقيت داخل الحدود.",
    ], M, y, CONTENT_W, 8.8, 14)
    finish_page(doc)


def map_snapshot_page(doc: Doc) -> None:
    y = doc.begin("تحميل الخريطة في طلب واحد", "04 — عقد الواجهة البرمجية")
    paragraph(doc.c, "تحتاج شاشة الخريطة إلى snapshot متماسك بدل عشرات الطلبات. هذا endpoint يعيد الطابق والنسخة والعناصر والرفوف وملخص مواقع المنتجات اللازمة للعرض.", M, y, CONTENT_W, 9.8, 16)
    y -= 57
    code_box(doc.c, "GET /api/v1/floors/{floor_id}/map?revision=published", """
{
  "floor": {
    "id": "floor_uuid", "name": "الطابق الأرضي",
    "canvas": { "widthCm": 4200, "heightCm": 2800, "origin": "top_left" }
  },
  "revision": { "id": "rev_uuid", "number": 12, "status": "published", "version": 37 },
  "elements": [
    {
      "id": "element_uuid", "type": "shelf", "label": "S-17",
      "geometry": { "x": 1380, "y": 720, "width": 260, "height": 80, "rotation": 0 },
      "walkable": false,
      "properties": { "aisle": "04", "shelfCode": "S-17" }
    }
  ],
  "entrances": [{ "elementId": "...", "accessPoint": { "x": 180, "y": 2520 } }],
  "etag": "W/\"map-rev-12-v37\""
}
""", M, y, CONTENT_W, 286, 6.45)
    y -= 304
    note(doc.c, "أرسل ETag واستقبل If-None-Match. إذا لم تتغير النسخة المنشورة أرجع 304 بلا body؛ هذا يقلل زمن التحميل وتكلفة النقل.", M, y, CONTENT_W, GREEN, 55)
    y -= 72
    table(doc.c, ["revision", "السلوك"], [["published", "للزبون والملاحة"], ["draft", "للمحرر فقط"], ["UUID", "نسخة تاريخية بصلاحية قراءة"]], M, y, [115, CONTENT_W - 115], 28, 7.1)
    finish_page(doc)


def editor_page(doc: Doc) -> None:
    y = doc.begin("إنشاء العناصر وتعديلها دفعة واحدة", "04 — عقد الواجهة البرمجية")
    code_box(doc.c, "POST /floors/{floor_id}/elements", """
{
  "revisionId": "draft_revision_uuid",
  "type": "shelf",
  "label": "S-17",
  "geometry": { "x": 1380, "y": 720, "width": 260, "height": 80, "rotation": 0 },
  "walkable": false,
  "properties": { "aisle": "04" }
}
""", M, y, 264, 152, 6.65)
    code_box(doc.c, "PATCH /elements/{id}", """
Headers:
  If-Match: "37"

{
  "geometry": { "x": 1400, "y": 720 },
  "label": "S-17"
}

200 -> element.version = 38
409 -> MAP_VERSION_CONFLICT
""", M + 277, y, CONTENT_W - 277, 152, 6.45)
    y -= 172
    code_box(doc.c, "POST /floors/{floor_id}/elements/batch", """
{
  "revisionId": "draft_revision_uuid",
  "expectedVersion": 38,
  "operations": [
    { "op": "create", "clientId": "tmp-1", "data": { "type": "wall", "geometry": { ... } } },
    { "op": "update", "id": "element_uuid", "patch": { "geometry": { "x": 1500 } } },
    { "op": "delete", "id": "old_element_uuid" }
  ]
}

200 -> { "version": 39, "created": { "tmp-1": "new_uuid" }, "updated": [...], "deleted": [...] }
""", M, y, CONTENT_W, 199, 6.15)
    y -= 216
    note(doc.c, "Batch endpoint هو الخيار الأفضل للحفظ التلقائي: معاملة واحدة، نسخة واحدة جديدة، وخريطة clientId→UUID للعناصر المنشأة محليًا.", M, y, CONTENT_W, BLUE, 54)
    finish_page(doc)


def publish_page(doc: Doc) -> None:
    y = doc.begin("التحقق من الخريطة ثم نشرها", "04 — عقد الواجهة البرمجية")
    c = doc.c
    steps = [
        ("1", "Save draft", "حفظ عمليات المحرر", BLUE),
        ("2", "Validate", "الهندسة والمداخل والرفوف", AMBER),
        ("3", "Build graph", "شبكة المشي ونقاط الوصول", CYAN),
        ("4", "Publish", "تبديل النسخة المنشورة ذريًا", GREEN),
    ]
    xx = M
    sw = (CONTENT_W - 27) / 4
    for i, (num, en, ar, color) in enumerate(steps):
        c.setFillColor(PANEL)
        c.setStrokeColor(color)
        c.roundRect(xx, y - 84, sw, 72, 9, stroke=1, fill=1)
        c.setFillColor(color)
        c.circle(xx + 18, y - 31, 10, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Tahoma-Bold", 7)
        c.drawCentredString(xx + 18, y - 33.5, num)
        draw_ltr(c, en, xx + 34, y - 33, 7.2, NAVY, "Tahoma-Bold")
        draw_rtl(c, ar, xx + sw - 9, y - 62, 7.1, MUTED)
        if i < 3:
            arrow(c, xx + sw + 2, y - 48, xx + sw + 7, y - 48, color)
        xx += sw + 9
    y -= 112
    code_box(c, "POST /floors/{floor_id}/validate", """
{ "revisionId": "rev_uuid" }

200
{
  "valid": false,
  "errors": [
    { "code": "NO_ENTRANCE", "elementId": null, "message": "يجب تحديد مدخل واحد على الأقل" },
    { "code": "OVERLAP", "elementId": "...", "message": "رف يتقاطع مع جدار" }
  ],
  "warnings": [{ "code": "UNREACHABLE_SHELF", "elementId": "..." }]
}
""", M, y, 260, 183, 6.4)
    code_box(c, "POST /floors/{floor_id}/publish", """
{
  "revisionId": "rev_uuid",
  "expectedVersion": 41,
  "note": "تحديث قسم المخبوزات"
}

200
{
  "publishedRevisionId": "rev_uuid",
  "number": 13,
  "publishedAt": "2026-09-23T12:00:00Z",
  "nextDraftRevisionId": "new_rev_uuid"
}
""", M + 273, y, CONTENT_W - 273, 183, 6.2)
    y -= 201
    note(c, "publish يفشل بـ 422 إذا وجدت أخطاء، وبـ 409 إذا تغيرت المسودة، وبـ 503 إذا تعذر بناء شبكة الملاحة. التحذيرات لا تمنع النشر إلا حسب سياسة المتجر.", M, y, CONTENT_W, RED, 58)
    finish_page(doc)


def shelf_page(doc: Doc) -> None:
    y = doc.begin("تكوين الرف والخانات", "04 — عقد الواجهة البرمجية")
    code_box(doc.c, "PATCH /api/v1/shelves/{shelf_id}/layout", """
{
  "revisionId": "draft_rev_uuid",
  "sides": ["A", "B"],
  "sections": ["A", "B", "C", "D"],
  "levelsPerSection": 5,
  "positionsPerLevel": 3,
  "accessPoints": {
    "A": { "x": 1510, "y": 690 },
    "B": { "x": 1510, "y": 830 }
  }
}
""", M, y, 270, 199, 6.6)
    code_box(doc.c, "200 — ShelfLayout", """
{
  "shelfId": "shelf_uuid",
  "code": "S-17",
  "aisle": "04",
  "capacity": 120,
  "slotCount": 120,
  "occupiedSlotCount": 83,
  "layoutVersion": 4,
  "sides": [
    { "code": "A", "sections": [ ... ] },
    { "code": "B", "sections": [ ... ] }
  ]
}
""", M + 283, y, CONTENT_W - 283, 199, 6.35)
    y -= 219
    y = section_label(doc.c, "تحقق إلزامي", y)
    bullets(doc.c, [
        "لا تقلل عدد المستويات أو المواضع إذا كانت خانات محذوفة مشغولة؛ أرجع 409 مع قائمة المواقع المتأثرة.",
        "كل access point يجب أن يكون داخل حدود الطابق وخارج العوائق وقريبًا من الرف.",
        "locationCode يُولد في الخادم ولا يقبل قيمة من العميل لتجنب عدم الاتساق.",
        "GET /shelves/{id}/slots?occupied=true يفيد شاشة إدارة الرف دون تحميل الكتالوج كله.",
    ], M, y, CONTENT_W, 9)
    finish_page(doc)


def products_page(doc: Doc) -> None:
    y = doc.begin("المنتجات والبحث والمواقع", "04 — عقد الواجهة البرمجية")
    code_box(doc.c, "GET /products?search=حليب&storeId=...&limit=20", """
{
  "data": [
    {
      "id": "P1004",
      "sku": "MILK-1L-FULL",
      "barcode": "6251234567890",
      "name": "حليب كامل الدسم 1 لتر",
      "category": { "id": "dairy", "name": "الألبان" },
      "imageUrl": "https://cdn.example/...",
      "availableInStore": true
    }
  ],
  "meta": { "nextCursor": null, "limit": 20 }
}
""", M, y, CONTENT_W, 198, 6.45)
    y -= 216
    code_box(doc.c, "POST /placements — input", """
{
  "revisionId": "draft_rev_uuid",
  "productId": "P1004",
  "shelfId": "shelf_uuid",
  "side": "A", "section": "B",
  "level": 3, "position": 2
}
""", M, y, 245, 144, 6.8)
    code_box(doc.c, "201 — output", """
{
  "id": "placement_uuid",
  "productId": "P1004",
  "floorId": "floor_uuid",
  "aisle": "04", "shelf": "S-17",
  "side": "A", "section": "B",
  "level": 3, "position": 2,
  "locationCode": "A04-S17-A-B-L03-P02",
  "accessPoint": { "x": 1510, "y": 690 }
}
""", M + 258, y, CONTENT_W - 258, 144, 6.15)
    y -= 163
    note(doc.c, "البحث يعيد المنتجات حتى لو لم تكن موضوعة، لكن availableInStore يسهّل على الواجهة إخفاء زر الملاحة عندما لا يوجد موقع في النسخة المنشورة.", M, y, CONTENT_W, BLUE, 54)
    finish_page(doc)


def route_shortest_page(doc: Doc) -> None:
    y = doc.begin("أقصر مسار إلى منتج", "05 — الملاحة الذكية")
    code_box(doc.c, "POST /api/v1/routes/shortest — input", """
{
  "storeId": "store_uuid",
  "floorId": "floor_uuid",
  "revision": "published",
  "start": { "type": "entrance", "elementId": "entrance_uuid" },
  "destination": { "type": "product", "productId": "P1004" },
  "preferences": {
    "accessible": false,
    "avoidElementTypes": ["service_area"],
    "allowDiagonal": false
  }
}
""", M, y, 265, 193, 6.5)
    code_box(doc.c, "200 — RouteResult", """
{
  "routeId": "route_01J...",
  "mapRevisionId": "published_rev_uuid",
  "distanceMeters": 38.4,
  "estimatedSeconds": 31,
  "destination": {
    "productId": "P1004",
    "locationCode": "A04-S17-A-B-L03-P02"
  },
  "path": [
    { "x": 180, "y": 2520 },
    { "x": 180, "y": 2320 },
    { "x": 1510, "y": 690 }
  ],
  "instructions": [
    { "type": "start", "distanceMeters": 0 },
    { "type": "turn_left", "at": { "x": 620, "y": 2320 } },
    { "type": "arrive", "shelfSide": "A" }
  ]
}
""", M + 278, y, CONTENT_W - 278, 193, 5.85)
    y -= 213
    y = section_label(doc.c, "اختيار موقع المنتج", y)
    bullets(doc.c, [
        "إن كان للمنتج عدة مواقع، احسب كلفة الوصول إلى كل access point واختر الأقل وفق التفضيلات.",
        "أرجع 404 PRODUCT_NOT_PLACED إذا لم يوجد موقع منشور، و422 ROUTE_NOT_FOUND إذا كان الموقع معزولًا.",
        "استعمل نسخة الخريطة المنشورة المرسلة في response لتستطيع الواجهة كشف أي اختلاف في العرض.",
    ], M, y, CONTENT_W, 9)
    note(doc.c, "المسافة = مجموع أطوال مقاطع path بعد تحويل السنتيمتر إلى متر، وليست عدد عقد الشبكة.", M, y - 48, CONTENT_W, GREEN, 48)
    finish_page(doc)


def route_optimize_page(doc: Doc) -> None:
    y = doc.begin("تحسين مسار قائمة التسوق", "05 — الملاحة الذكية")
    code_box(doc.c, "POST /api/v1/routes/optimize — input", """
{
  "storeId": "store_uuid",
  "floorId": "floor_uuid",
  "start": { "type": "entrance", "elementId": "entrance_uuid" },
  "productIds": ["P1004", "P2011", "P3320", "P4402"],
  "end": { "type": "nearest_checkout" },
  "strategy": "balanced",
  "preferences": { "accessible": false }
}
""", M, y, 270, 166, 6.5)
    code_box(doc.c, "200 — output summary", """
{
  "routeId": "route_01J...",
  "orderedStops": [
    { "order": 1, "productId": "P3320", "locationCode": "A02-S08-A-C-L02-P01" },
    { "order": 2, "productId": "P1004", "locationCode": "A04-S17-A-B-L03-P02" },
    { "order": 3, "productId": "P2011", "locationCode": "A06-S25-B-A-L01-P03" },
    { "order": 4, "productId": "P4402", "locationCode": "A07-S29-A-D-L04-P02" }
  ],
  "distanceMeters": 116.7,
  "estimatedSeconds": 95,
  "path": [ ... ],
  "unavailableProductIds": []
}
""", M + 283, y, CONTENT_W - 283, 166, 5.75)
    y -= 186
    y = section_label(doc.c, "استراتيجية الإصدار الأول", y)
    bullets(doc.c, [
        "أنشئ مصفوفة مسافات بين المدخل ومواقع المنتجات والصناديق باستخدام A*.",
        "ابدأ بأقرب نقطة متاحة، ثم اختر الأقرب تباعًا nearest-neighbor.",
        "طبّق 2-opt على ترتيب المحطات لتحسين المسافة دون كلفة عالية.",
        "عند تعدد مواقع المنتج، اختر الموقع الذي يخفض كلفة الجولة كلها لا الأقرب للمدخل فقط.",
        "حدد حدًا مثل 40 منتجًا للطلب المتزامن، وما فوقه يتحول إلى job اختياري.",
    ], M, y, CONTENT_W, 9)
    finish_page(doc)


def routing_engine_page(doc: Doc) -> None:
    y = doc.begin("محرك المسار: من المستطيلات إلى A*", "05 — الملاحة الذكية")
    c = doc.c
    stages = [
        ("Snapshot", "خريطة منشورة", BLUE),
        ("Rasterize", "شبكة 20 سم", CYAN),
        ("Inflate", "هامش جسم المستخدم", AMBER),
        ("Graph", "عقد وحواف مسموحة", GREEN),
        ("A*", "المسار الخام", RED),
        ("Simplify", "نقاط وتعليمات", NAVY),
    ]
    sw = (CONTENT_W - 25) / 6
    xx = M
    for i, (en, ar, color) in enumerate(stages):
        c.setFillColor(PANEL)
        c.setStrokeColor(color)
        c.roundRect(xx, y - 77, sw, 62, 8, stroke=1, fill=1)
        draw_ltr(c, en, xx + 8, y - 39, 7.2, color, "Tahoma-Bold")
        draw_rtl(c, ar, xx + sw - 7, y - 59, 6.7, MUTED)
        if i < len(stages) - 1:
            arrow(c, xx + sw + 1, y - 47, xx + sw + 4, y - 47, color)
        xx += sw + 5
    y -= 101
    code_box(c, "Service boundary — app/modules/routing/service.py", """
class RoutingService:
    async def shortest(self, request: RouteRequest) -> RouteResult:
        snapshot = await self.maps.get_published(request.floor_id)
        graph = await self.graphs.get_or_build(snapshot)
        starts = resolve_start(request.start, snapshot)
        targets = resolve_destination(request.destination, snapshot)
        path = astar(graph, starts, targets, request.preferences)
        return build_route_result(path, snapshot)
""", M, y, CONTENT_W, 166, 7.0)
    y -= 186
    table(c, ["المعامل", "التوصية"], [
        ["grid size", "20 cm؛ 10 cm للمتاجر الدقيقة"],
        ["heuristic", "Manhattan بلا أقطار، Euclidean مع الأقطار"],
        ["obstacle margin", "25–40 cm حسب تجربة الاستخدام"],
        ["graph cache key", "floor_id + published_revision_id + preferences"],
        ["simplification", "حذف النقاط على خط واحد ثم line-of-sight"],
    ], M, y, [170, CONTENT_W - 170], 29, 6.9)
    finish_page(doc)


def route_validation_page(doc: Doc) -> None:
    y = doc.begin("التحقق من قابلية الملاحة", "05 — الملاحة الذكية")
    paragraph(doc.c, "التحقق لا يقتصر على عدم تداخل المستطيلات؛ يجب إثبات أن المساحات المهمة قابلة للوصول من مدخل واحد على الأقل.", M, y, CONTENT_W, 10.2, 17)
    y -= 57
    checks = [
        ("GEOMETRY_OUT_OF_BOUNDS", "العنصر خارج حدود الطابق", RED),
        ("BLOCKING_OVERLAP", "عائقان أو رف وجدار متداخلان", RED),
        ("NO_ENTRANCE", "لا يوجد مدخل صالح", AMBER),
        ("UNREACHABLE_SHELF", "نقطة وصول الرف معزولة", AMBER),
        ("UNREACHABLE_CHECKOUT", "لا يوجد مسار إلى صندوق دفع", AMBER),
        ("ACCESS_POINT_BLOCKED", "نقطة الوصول داخل عنصر مانع", RED),
        ("NARROW_CORRIDOR", "ممر أضيق من الحد المطلوب", BLUE),
        ("DUPLICATE_LOCATION", "خانة رف مستخدمة أكثر من مرة", RED),
    ]
    for i, (code, ar, color) in enumerate(checks):
        row = i // 2
        side = i % 2
        x = M + side * ((CONTENT_W - 10) / 2 + 10)
        w = (CONTENT_W - 10) / 2
        yy = y - row * 67
        c = doc.c
        c.setFillColor(PANEL)
        c.setStrokeColor(LINE)
        c.roundRect(x, yy - 53, w, 53, 8, stroke=1, fill=1)
        c.setFillColor(color)
        c.circle(x + 16, yy - 17, 5, stroke=0, fill=1)
        draw_ltr(c, code, x + 28, yy - 20, 6.4, NAVY, "Consolas")
        draw_rtl(c, ar, x + w - 10, yy - 42, 7.2, MUTED)
    y -= 4 * 67 + 10
    note(doc.c, "أعد تقريرًا بموقع الخطأ elementId والإحداثيات؛ بهذا تستطيع الواجهة تحديد العنصر وإظهاره للمحرر بدل عرض رسالة عامة فقط.", M, y, CONTENT_W, GREEN, 54)
    y -= 72
    code_box(doc.c, "POST /routes/validate (internal/admin)", """
{ "floorId": "...", "revisionId": "...", "samplePairs": 50 }
-> { "reachable": 48, "unreachable": 2, "issues": [ ... ] }
""", M, y, CONTENT_W, 77, 7)
    finish_page(doc)


def realtime_page(doc: Doc) -> None:
    y = doc.begin("الحفظ التلقائي والتزامن الفوري", "06 — الإنتاج والجودة")
    c = doc.c
    card(c, M, y, (CONTENT_W - 12) / 2, 123, "Autosave", "اجمع تغييرات 500–1000ms ثم أرسل batch مع expectedVersion. عند النجاح حدّث النسخة المحلية.", BLUE)
    card(c, M + (CONTENT_W + 12) / 2, y, (CONTENT_W - 12) / 2, 123, "WebSocket", "يبث element.updated وrevision.published وpresence.changed للمحررين المتصلين.", CYAN)
    y -= 147
    code_box(c, "WS /api/v1/ws/stores/{store_id}/floors/{floor_id}", """
// client -> server
{ "type": "subscribe", "revisionId": "draft_uuid", "lastVersion": 38 }

// server -> clients
{
  "type": "element.updated",
  "revisionId": "draft_uuid",
  "version": 39,
  "actor": { "id": "user_uuid", "name": "ليان" },
  "element": { "id": "...", "geometry": { "x": 1500, "y": 720 } }
}
""", M, y, CONTENT_W, 158, 6.6)
    y -= 178
    table(c, ["السيناريو", "السلوك"], [
        ["expectedVersion مطابق", "احفظ وأعد version جديد"],
        ["نسخة أقدم", "409 + currentVersion + changedIds"],
        ["انقطاع WebSocket", "استمر عبر REST ثم أعد الاشتراك"],
        ["عودة الاتصال", "GET changes?since=version"],
        ["تحرير نفس العنصر", "last writer blocked؛ اطلب merge/reload"],
    ], M, y, [180, CONTENT_W - 180], 31, 7)
    y -= 5 * 31 + 38
    note(c, "لا تجعل WebSocket طريق الحفظ الأساسي. REST هو مصدر الحقيقة، وWebSocket للتنبيه والمزامنة فقط.", M, y, CONTENT_W, AMBER, 50)
    finish_page(doc)


def security_page(doc: Doc) -> None:
    y = doc.begin("الأدوار والأمان", "06 — الإنتاج والجودة")
    table(doc.c, ["الدور", "قراءة", "تحرير", "نشر", "إدارة مستخدمين"], [
        ["viewer", "نعم", "لا", "لا", "لا"],
        ["editor", "نعم", "نعم", "لا", "لا"],
        ["publisher", "نعم", "نعم", "نعم", "لا"],
        ["manager", "نعم", "نعم", "نعم", "محدود"],
        ["owner", "نعم", "نعم", "نعم", "نعم"],
    ], M, y, [120, 90, 90, 90, CONTENT_W - 390], 32, 7.2)
    y -= 5 * 32 + 44
    y = section_label(doc.c, "قائمة حماية الإنتاج", y)
    y = bullets(doc.c, [
        "تحقق دائمًا أن المورد ينتمي إلى organization الخاصة بالمستخدم؛ معرفة UUID ليست صلاحية.",
        "CORS بقائمة origins محددة، وTrustedHost، وHTTPS فقط، وحد أقصى لحجم body.",
        "Rate limit: تسجيل الدخول، البحث العام، وحساب المسار؛ مفاتيح مختلفة حسب الحساسية.",
        "سجل AuditLog لكل publish وتغيير صلاحية وحذف، مع actor وrequestId والقيم المهمة.",
        "لا تسجل كلمات المرور أو التوكنات أو Authorization header أو أسرار الاتصال.",
        "تحقق Pydantic وحده لا يكفي: افحص حدود الإحداثيات والانتماء والعلاقات داخل الخدمة.",
        "أضف Content Security Policy إلى الواجهة، وامنع رفع صور مباشرة إلى خادم API؛ استخدم signed uploads.",
    ], M, y, CONTENT_W, 8.9, 15)
    note(doc.c, "إن كان النظام مخصصًا لمؤسسة واحدة فقط، أبقِ organization_id منذ البداية؛ كلفته صغيرة ويمنع إعادة تصميم مؤلمة عند التوسع.", M, y - 3, CONTENT_W, BLUE, 55)
    finish_page(doc)


def errors_page(doc: Doc) -> None:
    y = doc.begin("الأخطاء والتحقق القابلان للاستخدام", "06 — الإنتاج والجودة")
    table(doc.c, ["HTTP", "الكود", "متى؟"], [
        ["400", "BAD_REQUEST", "صيغة عامة غير صالحة"],
        ["401", "UNAUTHENTICATED", "لا توجد هوية صالحة"],
        ["403", "FORBIDDEN", "الدور أو المؤسسة غير مناسبة"],
        ["404", "RESOURCE_NOT_FOUND", "المورد غير موجود ضمن نطاق المستخدم"],
        ["409", "MAP_VERSION_CONFLICT", "تعديل متزامن أو خانة مشغولة"],
        ["422", "VALIDATION_ERROR", "مدخلات أو خريطة غير صالحة"],
        ["429", "RATE_LIMITED", "تجاوز الحد"],
        ["503", "ROUTING_UNAVAILABLE", "الشبكة غير جاهزة مؤقتًا"],
    ], M, y, [55, 190, CONTENT_W - 245], 31, 6.8)
    y -= 8 * 31 + 42
    code_box(doc.c, "FastAPI exception handler — shape", """
@app.exception_handler(DomainError)
async def handle_domain_error(request: Request, exc: DomainError):
    return ORJSONResponse(
        status_code=exc.status,
        media_type="application/problem+json",
        content={
            "type": f"https://api.dawer.app/problems/{exc.slug}",
            "title": exc.title_ar,
            "status": exc.status,
            "code": exc.code,
            "requestId": request.state.request_id,
            "errors": exc.details,
        },
    )
""", M, y, CONTENT_W, 167, 6.6)
    finish_page(doc)


def testing_page(doc: Doc) -> None:
    y = doc.begin("خطة اختبار تغطي القصة كاملة", "06 — الإنتاج والجودة")
    cols = (CONTENT_W - 16) / 3
    card(doc.c, M, y, cols, 129, "Unit", "هندسة العناصر، توليد locationCode، A*، التبسيط و2-opt.", BLUE)
    card(doc.c, M + cols + 8, y, cols, 129, "Integration", "PostgreSQL حقيقي: المعاملات، القيود، الترحيلات، الصلاحيات والتعارضات.", GREEN)
    card(doc.c, M + 2 * (cols + 8), y, cols, 129, "Contract / E2E", "OpenAPI مع الفرونت إند: إنشاء خريطة، نشرها، البحث ثم الملاحة.", AMBER)
    y -= 153
    code_box(doc.c, "Representative API test", """
async def test_publish_then_route(client, editor_token, seeded_floor):
    draft = await create_valid_draft(client, seeded_floor, editor_token)
    publish = await client.post(
        f"/api/v1/floors/{seeded_floor}/publish",
        json={"revisionId": draft["id"], "expectedVersion": draft["version"]},
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert publish.status_code == 200

    route = await client.post("/api/v1/routes/shortest", json=route_request())
    assert route.status_code == 200
    assert route.json()["distanceMeters"] > 0
    assert route.json()["path"][0] == ENTRANCE_POINT
""", M, y, CONTENT_W, 203, 6.4)
    y -= 222
    y = section_label(doc.c, "حالات لا تنسها", y)
    bullets(doc.c, [
        "خريطة بلا مدخل، رف معزول، عنصر خارج الحدود، منتج بلا موقع، موقعان في الخانة نفسها.",
        "مستخدم من مؤسسة أخرى، توكن منتهي، publish بنسخة قديمة، وbatch يفشل في عمليته الثالثة.",
        "اختبار property-based لخوارزمية المسار: لا تدخل النقاط داخل عائق والمسافة لا تكون سالبة.",
    ], M, y, CONTENT_W, 8.8, 14)
    finish_page(doc)


def performance_page(doc: Doc) -> None:
    y = doc.begin("الأداء والكاش والمراقبة", "06 — الإنتاج والجودة")
    table(doc.c, ["الهدف", "التقنية", "مفتاح القياس"], [
        ["تحميل الخريطة", "ETag + gzip/brotli + snapshot", "p95 < 300ms"],
        ["بحث المنتجات", "pg_trgm + cursor", "p95 < 150ms"],
        ["المسار", "cached navigation graph", "p95 < 500ms"],
        ["النشر", "background graph build اختياري", "< 5s المعتاد"],
        ["التزامن", "batch + optimistic lock", "conflict rate"],
        ["قاعدة البيانات", "pool مضبوط + slow query log", "p95 query"],
    ], M, y, [155, 205, CONTENT_W - 360], 33, 6.8)
    y -= 6 * 33 + 44
    code_box(doc.c, "Recommended cache keys", """
map:{floor_id}:published:{revision_id}          TTL 15m
graph:{floor_id}:{revision_id}:{profile_hash}  TTL 24h
product-search:{org_id}:{query_hash}           TTL 60s
route:{revision_id}:{start}:{targets_hash}     TTL 5m

Invalidate map + graph caches only after successful publish.
""", M, y, CONTENT_W, 135, 7.1)
    y -= 154
    y = section_label(doc.c, "سجلات ومقاييس أساسية", y)
    bullets(doc.c, [
        "request_id، user_id، org_id، route، status، duration_ms؛ بلا بيانات حساسة.",
        "عدادات route_found وroute_not_found وpublish_failed وmap_conflict.",
        "قياسات زمن قاعدة البيانات وزمن بناء graph وزمن A* وحجم snapshot.",
        "تنبيه عند ارتفاع 5xx، فشل readiness، بطء p95، أو نمو أخطاء الخريطة بعد النشر.",
    ], M, y, CONTENT_W, 8.8, 14)
    finish_page(doc)


def deployment_page(doc: Doc) -> None:
    y = doc.begin("التغليف والنشر", "06 — الإنتاج والجودة")
    code_box(doc.c, "Dockerfile", """
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN useradd --create-home appuser
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY app ./app
USER appuser
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
""", M, y, 265, 178, 6.7)
    code_box(doc.c, "Health endpoints", """
GET /health/live
200 { "status": "ok" }

GET /health/ready
200 {
  "status": "ready",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "migrations": "current"
  }
}

503 when a required dependency is unavailable.
""", M + 278, y, CONTENT_W - 278, 178, 6.35)
    y -= 198
    y = section_label(doc.c, "تسلسل نشر آمن", y)
    y = bullets(doc.c, [
        "شغّل lint وtype-check واختبارات الوحدة والتكامل وبناء الصورة في CI.",
        "خذ نسخة احتياطية، ثم شغّل Alembic migration متوافقة للخلف.",
        "انشر نسخة التطبيق الجديدة مع rolling deployment وreadiness probe.",
        "راقب الأخطاء وزمن الاستجابة، ثم فعّل الترافيك كاملًا.",
        "اجعل rollback يعيد التطبيق؛ لا ترجّع قاعدة البيانات تلقائيًا إلا بخطة مدروسة.",
    ], M, y, CONTENT_W, 9.0)
    y -= 2
    note(doc.c, "في أول إصدار، خدمة API واحدة وPostgreSQL مُدار وRedis مُدار تكفي. أضف worker فقط عندما يصبح بناء الشبكة أو الاستيراد طويلًا.", M, y, CONTENT_W, GREEN, 55)
    finish_page(doc)


def implementation_plan(doc: Doc) -> None:
    y = doc.begin("خطة تنفيذ من ست مراحل", "06 — الإنتاج والجودة")
    phases = [
        ("1", "Foundation", "المشروع، الإعدادات، DB، migrations، الأخطاء، health", BLUE),
        ("2", "Identity", "المستخدمون، المؤسسات، الأدوار، login/refresh", CYAN),
        ("3", "Maps", "المتجر والطابق والنسخ والعناصر وbatch editor", GREEN),
        ("4", "Catalog", "الرفوف والمنتجات والمواقع والبحث", AMBER),
        ("5", "Routing", "validate، graph، shortest، optimize، cache", RED),
        ("6", "Production", "WebSocket، audit، metrics، CI/CD، hardening", NAVY),
    ]
    for i, (num, en, body, color) in enumerate(phases):
        yy = y - i * 79
        c = doc.c
        c.setFillColor(PANEL)
        c.setStrokeColor(LINE)
        c.roundRect(M, yy - 64, CONTENT_W, 58, 9, stroke=1, fill=1)
        c.setFillColor(color)
        c.roundRect(M + CONTENT_W - 52, yy - 64, 52, 58, 9, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Tahoma-Bold", 14)
        c.drawCentredString(M + CONTENT_W - 26, yy - 43, num)
        draw_ltr(c, en, M + 14, yy - 29, 8.5, color, "Tahoma-Bold")
        draw_rtl(c, body, M + CONTENT_W - 68, yy - 48, 8.0, INK)
    y -= 6 * 79 + 4
    note(doc.c, "نقطة تسليم كل مرحلة: OpenAPI محدث، migration قابلة للتشغيل، اختبارات ناجحة، وبيانات seed تتيح عرض التدفق من الواجهة.", M, y, CONTENT_W, BLUE, 53)
    finish_page(doc)


def checklist_page(doc: Doc) -> None:
    y = doc.begin("تعريف الجاهزية للإطلاق", "06 — الإنتاج والجودة")
    groups = [
        ("البيانات", ["ترحيلات من قاعدة فارغة", "قيود وفهارس مطبقة", "نسخ احتياطي واستعادة مجرّبة"], BLUE),
        ("الـ API", ["OpenAPI منشور", "أخطاء موحدة", "ETag وconcurrency مجرّبان"], CYAN),
        ("الملاحة", ["كل رف منشور قابل للوصول", "اختبار خرائط صغيرة وكبيرة", "cache يُلغى بعد النشر"], GREEN),
        ("الأمان", ["صلاحيات المؤسسة", "تدوير refresh tokens", "rate limit وسجل تدقيق"], RED),
        ("التشغيل", ["health وmetrics", "تنبيهات 5xx والبطء", "خطة rollback"], AMBER),
        ("الواجهة", ["بيئة staging مربوطة", "حالات loading/error/empty", "توافق RTL والهاتف"], NAVY),
    ]
    col = (CONTENT_W - 12) / 2
    for i, (title, items, color) in enumerate(groups):
        row = i // 2
        side = i % 2
        x = M + side * (col + 12)
        yy = y - row * 154
        c = doc.c
        c.setFillColor(PANEL)
        c.setStrokeColor(LINE)
        c.roundRect(x, yy - 139, col, 139, 10, stroke=1, fill=1)
        c.setFillColor(color)
        c.rect(x, yy - 6, col, 6, stroke=0, fill=1)
        draw_rtl(c, title, x + col - 12, yy - 29, 10.2, NAVY, "Tahoma-Bold")
        by = yy - 57
        for item in items:
            c.setStrokeColor(color)
            c.rect(x + col - 23, by - 3, 9, 9, stroke=1, fill=0)
            draw_rtl(c, item, x + col - 31, by - 2, 7.7, INK)
            by -= 25
    y -= 3 * 154 + 7
    note(doc.c, "الإطلاق ليس اكتمال الكود فقط. النظام جاهز عندما يستطيع محرر إنشاء خريطة ونشرها، ثم يستطيع زبون إيجاد منتج والوصول إليه مع مراقبة كاملة للأخطاء.", M, y, CONTENT_W, GREEN, 61)
    finish_page(doc)


def closing_page(doc: Doc) -> None:
    c = doc.c
    doc.page += 1
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(BLUE)
    c.roundRect(M, H - 190, CONTENT_W, 114, 17, stroke=0, fill=1)
    draw_rtl(c, "الخطوة التالية", W - M - 22, H - 120, 11, HexColor("#DDEBFF"), "Tahoma-Bold")
    draw_rtl(c, "حوّل هذا المخطط إلى مستودع قابل للتشغيل", W - M - 22, H - 159, 22, white, "Tahoma-Bold")
    paragraph(c, "ابدأ بـ Foundation ثم Maps، واربط شاشة المحرر بالـ snapshot وbatch. بعد ثبات النشر أضف الكتالوج والملاحة، ثم التزامن الفوري.", M + 22, H - 224, CONTENT_W - 44, 11, 18, HexColor("#C7D5E3"))
    items = [
        ("1", "اعتمد أسماء الحقول والعقود في هذا الدليل كنسخة API v1."),
        ("2", "أنشئ OpenAPI وبيانات seed لنفس المتجر التجريبي الموجود في الواجهة."),
        ("3", "اربط GET map ثم batch editor قبل بقية الوظائف."),
        ("4", "اجعل publish بوابة إلزامية قبل أن يقرأ تطبيق الزبون التغييرات."),
    ]
    yy = H - 300
    for num, text in items:
        c.setFillColor(Color(1, 1, 1, alpha=0.10))
        c.roundRect(M, yy - 54, CONTENT_W, 48, 10, stroke=0, fill=1)
        c.setFillColor(CYAN)
        c.circle(M + 20, yy - 30, 11, stroke=0, fill=1)
        c.setFillColor(NAVY)
        c.setFont("Tahoma-Bold", 8)
        c.drawCentredString(M + 20, yy - 33, num)
        draw_rtl(c, text, W - M - 15, yy - 34, 9.3, white)
        yy -= 65
    c.setStrokeColor(Color(1, 1, 1, alpha=0.18))
    c.line(M, 86, W - M, 86)
    draw_ltr(c, "DAWER", M, 57, 12, CYAN, "Tahoma-Bold")
    draw_rtl(c, "وثيقة معمارية وتنفيذية — الإصدار 1.0", W - M, 58, 8.5, HexColor("#C7D5E3"))
    c.showPage()


def build() -> None:
    c = canvas.Canvas(OUT, pagesize=A4, pageCompression=1)
    c.setTitle("دليل بناء الباك إند بـ FastAPI لنظام DAWER")
    c.setAuthor("DAWER Product & Engineering Blueprint")
    c.setSubject("FastAPI backend architecture, endpoints, inputs, outputs, routing and deployment")
    c.setCreator("ReportLab")
    doc = Doc(c)

    pages: Iterable = [
        cover, contents, vision, architecture, decisions,
        stack_setup, project_structure, settings_page,
        data_overview, schema_store_floor, schema_revision_element, schema_catalog, indexes_migrations,
        api_conventions, endpoint_catalog_1, endpoint_catalog_2, auth_page, stores_floors_page,
        map_snapshot_page, editor_page, publish_page, shelf_page, products_page,
        route_shortest_page, route_optimize_page, routing_engine_page, route_validation_page,
        realtime_page, security_page, errors_page, testing_page, performance_page,
        deployment_page, implementation_plan, checklist_page, closing_page,
    ]
    for page_fn in pages:
        page_fn(doc)
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
