const previewImage = document.getElementById("previewImage");
const statusEl = document.getElementById("statusMessage");
const form = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const canvas = document.getElementById("workCanvas");

const state = {
    templates: [],
    active: null,
};

const DEFAULT_NAME = "";
const CANVAS_FONT_STACK = '"Cairo", "Noto Sans Arabic", "Manrope", sans-serif';

document.addEventListener("DOMContentLoaded", () => {
    init();
});

async function init() {
    form.addEventListener("submit", onGenerateSubmit);
    nameInput.addEventListener("input", onNameInput);
    await loadTemplates();
}

async function loadTemplates() {
    setStatus("جاري تحميل التصميم…");
    try {
        const res = await fetch("templates.json", { cache: "no-store" });
        const data = await res.json();
        state.templates = Array.isArray(data) ? data : [];
        if (!state.templates.length) {
            setStatus("لا يوجد تصميم.");
            return;
        }
        await selectTemplate(state.templates[0]);
    } catch (err) {
        console.error(err);
        setStatus("تعذر تحميل التصميم.");
    }
}

async function selectTemplate(template) {
    state.active = template;
    const initialName =
        nameInput.value.trim() || template.defaultName || DEFAULT_NAME;

    nameInput.value = initialName;
    await renderPreview(initialName);
}

async function onNameInput() {
    const name = nameInput.value.trim() || DEFAULT_NAME;
    await renderPreview(name);
}

async function renderPreview(name) {
    if (!state.active) return;

    try {
        await Promise.all([
            document.fonts.ready,
            ensureCanvasFontLoaded(state.active.fontSize || 46),
        ]);

        const dataUrl = await renderToDataUrl(state.active, name);

        previewImage.src = dataUrl;
        previewImage.classList.remove("hidden");

        setStatus("");
    } catch (err) {
        console.error(err);
        setStatus("فشل عرض المعاينة.");
    }
}

async function onGenerateSubmit(e) {
    e.preventDefault();

    if (isInAppBrowser()) {
        showOpenInBrowserMessage();
        return;
    }

    const template = state.active;
    if (!template) return;

    const name = nameInput.value.trim();
    if (!name) {
        setStatus("أدخل الاسم.");
        return;
    }

    setStatus("جاري إنشاء الصورة…");

    try {
        await Promise.all([
            document.fonts.ready,
            ensureCanvasFontLoaded(template.fontSize || 46),
        ]);

        const dataUrl = await renderToDataUrl(template, name);

        triggerDownload(dataUrl, buildFileName(template, name));

        setStatus("تم التحميل.");
    } catch (err) {
        console.error(err);
        setStatus("حدث خطأ.");
    }
}

function renderToDataUrl(template, name) {
    return loadImage(template.image).then((image) => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const size = template.fontSize || 42;
        ctx.font = `700 ${size}px ${CANVAS_FONT_STACK}`;
        ctx.direction = "rtl";

        ctx.lineWidth = template.strokeWidth ?? 4;
        ctx.strokeStyle = template.strokeColor || "rgba(0,0,0,0.45)";
        ctx.fillStyle = template.textColor || "#fff";

        ctx.strokeText(name, template.textX, template.textY);
        ctx.fillText(name, template.textX, template.textY);

        return canvas.toDataURL("image/png");
    });
}

function triggerDownload(dataUrl, fileName) {
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    a.style.display = "none";

    document.body.appendChild(a);

    a.dispatchEvent(
        new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
        })
    );

    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);

    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
}

function buildFileName(template, name) {
    const base = (template.id || "image").toLowerCase().replace(/\s+/g, "-");
    const clean = name.trim().replace(/\s+/g, "-");
    return `${base}-${clean}.png`;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function ensureCanvasFontLoaded(sizePx) {
    return document.fonts.load(`700 ${sizePx}px "Cairo"`);
}

function setStatus(msg) {
    statusEl.textContent = msg;
}

/* ===== كشف In-App Browser ===== */

function isInAppBrowser() {
    const ua = navigator.userAgent || "";

    return (
        ua.includes("GSA") || // Google App
        ua.includes("FBAN") ||
        ua.includes("FBAV") ||
        ua.includes("Instagram") ||
        ua.includes("Twitter")
    );
}

function showOpenInBrowserMessage() {
    alert("لتحميل الصورة افتح الصفحة في المتصفح مثل Chrome أو Safari.");
}