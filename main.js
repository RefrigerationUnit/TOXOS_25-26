const viewerEl = document.getElementById("viewer");
const statusEl = document.getElementById("status");
const themeToggleEl = document.getElementById("themeToggle");
const downloadLinkEl = document.getElementById("downloadLink");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const DEFAULT_PDF_PATH = "./TOXOS_25-26.pdf";
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

let currentPdf = null;
let renderJobId = 0;
let resizeTimer = null;
let lastViewerWidth = 0;
let viewerResizeObserver = null;
let currentDownloadUrl = DEFAULT_PDF_PATH;

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.setAttribute("data-theme", isLight ? "light" : "dark");
  themeToggleEl.textContent = isLight ? "Dark Mode" : "Light Mode";
}

function initializeTheme() {
  const saved = window.localStorage.getItem("pdf-viewer-theme");
  const theme = saved === "light" ? "light" : "dark";
  applyTheme(theme);
}

function toggleTheme() {
  const isLight = document.body.getAttribute("data-theme") === "light";
  const nextTheme = isLight ? "dark" : "light";
  applyTheme(nextTheme);
  window.localStorage.setItem("pdf-viewer-theme", nextTheme);
}

function setDownloadUrl(url, fileName) {
  if (currentDownloadUrl.startsWith("blob:")) {
    URL.revokeObjectURL(currentDownloadUrl);
  }

  currentDownloadUrl = url;
  downloadLinkEl.href = currentDownloadUrl;
  downloadLinkEl.download = fileName || "document.pdf";
}

async function loadPdf(source) {
  setStatus("Loading PDF...");

  try {
    const loadingTask = pdfjsLib.getDocument(source);
    currentPdf = await loadingTask.promise;
    await renderDocument();
  } catch (error) {
    console.error(error);
    setStatus("Could not load the PDF. If you opened this from file://, run a local server.");
  }
}

async function renderDocument() {
  if (!currentPdf) {
    return;
  }

  const jobId = ++renderJobId;
  clearViewer();
  setStatus("Rendering pages...");

  for (let pageNum = 1; pageNum <= currentPdf.numPages; pageNum += 1) {
    if (jobId !== renderJobId) {
      return;
    }

    const page = await currentPdf.getPage(pageNum);
    if (jobId !== renderJobId) {
      return;
    }

    await renderPage(page, pageNum);
  }

  if (jobId === renderJobId) {
    setStatus(`Loaded ${currentPdf.numPages} page${currentPdf.numPages > 1 ? "s" : ""}`);
  }
}

function clearViewer() {
  viewerEl.replaceChildren();
}

function setStatus(message) {
  statusEl.textContent = message;
}

async function renderPage(page, pageNum) {
  const scale = getFitScale(page);
  const viewport = page.getViewport({ scale });

  const pageEl = document.createElement("article");
  pageEl.className = "page";
  pageEl.setAttribute("aria-label", `Page ${pageNum}`);

  const canvas = document.createElement("canvas");
  canvas.className = "page-canvas";

  const context = canvas.getContext("2d", { alpha: false });
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

  const annotationLayer = document.createElement("div");
  annotationLayer.className = "annotation-layer";
  annotationLayer.style.width = `${viewport.width}px`;
  annotationLayer.style.height = `${viewport.height}px`;

  pageEl.style.width = `${viewport.width}px`;
  pageEl.style.height = `${viewport.height}px`;

  pageEl.append(canvas, annotationLayer);
  viewerEl.append(pageEl);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  await renderLinks(page, viewport, annotationLayer);
}

function getFitScale(page) {
  const unscaledViewport = page.getViewport({ scale: 1 });
  const targetWidth = Math.max(0, viewerEl.clientWidth - 2);

  if (!targetWidth) {
    return 1;
  }

  const fitScale = targetWidth / unscaledViewport.width;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
}

function scheduleResponsiveRender() {
  if (!currentPdf) {
    return;
  }

  const currentWidth = viewerEl.clientWidth;
  if (Math.abs(currentWidth - lastViewerWidth) < 2) {
    return;
  }

  lastViewerWidth = currentWidth;

  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
  }

  resizeTimer = window.setTimeout(() => {
    renderDocument();
  }, 120);
}

function onResize() {
  scheduleResponsiveRender();
}

async function renderLinks(page, viewport, layerEl) {
  const annotations = await page.getAnnotations({ intent: "display" });

  for (const annotation of annotations) {
    if (annotation.subtype !== "Link") {
      continue;
    }

    const url = annotation.url || annotation.unsafeUrl;
    if (!url) {
      continue;
    }

    const rect = pdfjsLib.Util.normalizeRect(annotation.rect);

    const [left, bottom] = viewport.convertToViewportPoint(rect[0], rect[1]);
    const [right, top] = viewport.convertToViewportPoint(rect[2], rect[3]);

    const x = Math.min(left, right);
    const y = Math.min(top, bottom);
    const width = Math.abs(right - left);
    const height = Math.abs(bottom - top);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      continue;
    }

    const anchor = document.createElement("a");
    anchor.className = "annotation-link";
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;
    anchor.style.width = `${width}px`;
    anchor.style.height = `${height}px`;
    anchor.title = url;
    anchor.setAttribute("aria-label", `Open link: ${url}`);

    layerEl.append(anchor);
  }
}

window.addEventListener("resize", onResize);

if ("ResizeObserver" in window) {
  viewerResizeObserver = new ResizeObserver(() => {
    scheduleResponsiveRender();
  });
  viewerResizeObserver.observe(viewerEl);
}

themeToggleEl.addEventListener("click", toggleTheme);

initializeTheme();
setDownloadUrl(DEFAULT_PDF_PATH, "TOXOS_25-26.pdf");

loadPdf(DEFAULT_PDF_PATH);
