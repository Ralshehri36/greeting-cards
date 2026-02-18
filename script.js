const grid = document.getElementById("templatesGrid");
const statusEl = document.getElementById("templatesStatus");
const previewImage = document.getElementById("previewImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const form = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const canvas = document.getElementById("workCanvas");

const state = {
    templates: [],
    selectedId: null,
};

const CANVAS_FONT_STACK = '"Lemonada", "Noto Sans Arabic", "Manrope", sans-serif';

document.addEventListener("DOMContentLoaded", () => {
    loadTemplates();
    form.addEventListener("submit", onGenerateSubmit);
});

async function loadTemplates() {
    setStatus("جاري تحميل النماذج…");
    try {
        const res = await fetch("templates.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load templates: ${res.status}`);
        const data = await res.json();
        state.templates = Array.isArray(data) ? data : [];
        renderTemplates(state.templates);
        setStatus(state.templates.length ? "" : "لم يتم العثور على نماذج. أضف قيماً إلى templates.json.");
    } catch (err) {
        setStatus("تعذّر تحميل النماذج. تحقق من templates.json.");
        console.error(err);
    }
}

function renderTemplates(list) {
    grid.innerHTML = "";
    list.forEach((template) => {
        const card = createTemplateCard(template);
        grid.appendChild(card);
    });
}

function createTemplateCard(template) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.dataset.id = template.id || template.image;

    const thumb = document.createElement("div");
    thumb.className = "card__thumb";
    const img = document.createElement("img");
    img.src = template.image;
    img.alt = template.title ? `${template.title} template` : "Template preview";
    thumb.appendChild(img);

    const title = document.createElement("p");
    title.className = "card__title";
    title.textContent = template.title || "Untitled template";

    card.append(thumb, title);
    card.addEventListener("click", () => selectTemplate(template));
    card.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            selectTemplate(template);
        }
    });

    return card;
}

function selectTemplate(template) {
    state.selectedId = template.id || template.image;
    highlightSelectedCard(state.selectedId);
    updatePreview(template.image);
    toggleForm(true);
}

function highlightSelectedCard(selectedId) {
    grid.querySelectorAll(".card").forEach((card) => {
        card.classList.toggle("card--selected", card.dataset.id === selectedId);
    });
}

function updatePreview(src) {
    previewImage.classList.add("hidden");
    previewPlaceholder.classList.remove("hidden");

    previewImage.onload = () => {
        previewPlaceholder.classList.add("hidden");
        previewImage.classList.remove("hidden");
    };

    previewImage.onerror = () => {
        setStatus("تعذّرت معاينة الصورة. تحقق من مسارها.");
    };

    previewImage.src = src;
}

function toggleForm(visible) {
    form.classList.toggle("hidden", !visible);
    if (visible) {
        form.reset();
        nameInput.focus();
    }
}

async function onGenerateSubmit(event) {
    event.preventDefault();
    const template = state.templates.find((t) => (t.id || t.image) === state.selectedId);
    if (!template) {
        setStatus("الرجاء اختيار نموذج أولاً.");
        return;
    }

    const name = nameInput.value.trim();
    if (!name) {
        setStatus("الرجاء إدخال الاسم.");
        nameInput.focus();
        return;
    }

    setStatus("جاري إنشاء الصورة…");
    try {
        await Promise.all([
            document.fonts.ready,
            ensureCanvasFontLoaded(template.fontSize || 42),
        ]); // Ensure Lemonada is loaded before drawing
        const blobUrl = await renderAndExport(template, name);
        triggerDownload(blobUrl, buildFileName(template, name));
        setStatus("تم تنزيل الصورة.");
    } catch (err) {
        setStatus("حدث خطأ أثناء الإنشاء.");
        console.error(err);
    }
}

async function renderAndExport(template, name) {
    const image = await loadImage(template.image);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const fill = template.textColor || template.color || "#ffffff";
    const stroke = template.strokeColor || "rgba(0,0,0,0.45)";
    const strokeWidth = template.strokeWidth || 4;
    const shadowColor = template.shadowColor || "rgba(0,0,0,0.35)";
    const shadowBlur = template.shadowBlur || 10;
    const shadowOffsetX = template.shadowOffsetX || 0;
    const shadowOffsetY = template.shadowOffsetY || 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = template.fontSize || 42;
    ctx.font = `700 ${size}px ${CANVAS_FONT_STACK}`;

    ctx.save();
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;

    if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = stroke;
        ctx.strokeText(name, template.textX, template.textY);
    }

    ctx.fillStyle = fill;
    ctx.fillText(name, template.textX, template.textY);
    ctx.restore();

    return canvas.toDataURL("image/png");
}

function triggerDownload(dataUrl, fileName) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
}

function buildFileName(template, name) {
    const base = (template.id || "greeting").toLowerCase().replace(/\s+/g, "-");
    const cleanName = name
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\p{Letter}\p{Number}-]+/gu, "-");
    return `${base}-${cleanName || "صديق"}.png`;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function ensureCanvasFontLoaded(sizePx) {
    return document.fonts.load(`700 ${sizePx}px "Lemonada"`);
}

function setStatus(message) {
    statusEl.textContent = message;
}
