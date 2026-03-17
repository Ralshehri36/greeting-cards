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
        if (!res.ok) throw new Error(`Failed to load templates: ${res.status}`);
        const data = await res.json();
        state.templates = Array.isArray(data) ? data : [];
        if (!state.templates.length) {
            setStatus("لم يتم العثور على تصميم.");
            return;
        }
        await selectTemplate(state.templates[0]);
    } catch (err) {
        console.error(err);
        setStatus("تعذّر تحميل التصميم.");
    }
}

async function selectTemplate(template) {
    state.active = template;
    const initialName = nameInput.value.trim() || template.defaultName || DEFAULT_NAME;
    nameInput.value = initialName;
    nameInput.placeholder = template.placeholder || DEFAULT_NAME;
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
        setStatus("تعذّرت المعاينة.");
    }
}

async function onGenerateSubmit(event) {
    event.preventDefault();
    const template = state.active;
    if (!template) {
        setStatus("تأكد من تحميل التصميم.");
        return;
    }

    const name = nameInput.value.trim();
    if (!name) {
        setStatus("أدخل الاسم.");
        nameInput.focus();
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

        setStatus("تمت العملية.");
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

        const fill = template.textColor || "#ffffff";
        const stroke = template.strokeColor || "rgba(0,0,0,0.45)";
        const strokeWidth = template.strokeWidth ?? 4;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const size = template.fontSize || 42;
        ctx.font = `700 ${size}px ${CANVAS_FONT_STACK}`;

        ctx.direction = "rtl";

        if (strokeWidth > 0) {
            ctx.lineWidth = strokeWidth;
            ctx.strokeStyle = stroke;
            ctx.strokeText(name, template.textX, template.textY);
        }

        ctx.fillStyle = fill;
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

    // click حقيقي داخل user gesture
    a.dispatchEvent(
        new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
        })
    );

    document.body.removeChild(a);

    // fallback مهم جداً للجوالات التي تتجاهل download
    setTimeout(() => {
        URL.revokeObjectURL(url);

        // إذا لم يبدأ التحميل خلال لحظة → افتح الصورة
        // المستخدم يقدر يحفظها يدوياً
        const isDownloadSupported = "download" in HTMLAnchorElement.prototype;

        if (!isDownloadSupported) {
            window.open(dataUrl, "_blank");
        }

    }, 1500);
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
    const cleanName = name.trim().replace(/\s+/g, "-");
    return `${base}-${cleanName}.png`;
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

function setStatus(message) {
    statusEl.textContent = message;
}