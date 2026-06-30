const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const TARGET_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.03;

const state = {
  image: null,
  fileName: "",
  showSafeZone: true,
  showGridPreview: true
};

const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const statusMessage = document.getElementById("statusMessage");
const dimensionResult = document.getElementById("dimensionResult");
const ratioResult = document.getElementById("ratioResult");
const recommendationText = document.getElementById("recommendationText");

const reelCanvas = document.getElementById("reelCanvas");
const reelCtx = reelCanvas ? reelCanvas.getContext("2d") : null;
const gridCanvas = document.getElementById("gridCanvas");
const gridCtx = gridCanvas ? gridCanvas.getContext("2d") : null;

const emptyPreview = document.getElementById("emptyPreview");
const emptyGridPreview = document.getElementById("emptyGridPreview");
const gridPreviewCard = document.getElementById("gridPreviewCard");

const toggleSafeBtn = document.getElementById("toggleSafeBtn");
const toggleGridBtn = document.getElementById("toggleGridBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

function trackEvent(eventName, eventParams = {}) {
  if (typeof gtag === "function") {
    gtag("event", eventName, {
      tool_name: "reelcoverfit",
      page_path: window.location.pathname,
      ...eventParams
    });
  }
}

function getFileSizeBucket(size) {
  if (size < 500 * 1024) return "under_500kb";
  if (size < 2 * 1024 * 1024) return "500kb_to_2mb";
  if (size < 5 * 1024 * 1024) return "2mb_to_5mb";
  return "5mb_to_10mb";
}

function setupClickTracking() {
  document.querySelectorAll("[data-track]").forEach((element) => {
    element.addEventListener("click", () => {
      trackEvent(element.dataset.track, {
        link_text: element.textContent.trim().slice(0, 80),
        link_url: element.getAttribute("href") || ""
      });
    });
  });
}

setupClickTracking();

if (dropZone && imageInput) {
  dropZone.addEventListener("click", () => imageInput.click());

  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      imageInput.click();
    }
  });

  imageInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) handleImageFile(file, "file_picker");
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (file) handleImageFile(file, "drag_drop");
  });
}

if (toggleSafeBtn) {
  toggleSafeBtn.addEventListener("click", () => {
    state.showSafeZone = !state.showSafeZone;
    toggleSafeBtn.textContent = state.showSafeZone ? "Hide Safe Zone" : "Show Safe Zone";
    drawReelPreview();
    trackEvent("safe_zone_toggle", {
      safe_zone_visible: state.showSafeZone ? "yes" : "no"
    });
  });
}

if (toggleGridBtn && gridPreviewCard) {
  toggleGridBtn.addEventListener("click", () => {
    state.showGridPreview = !state.showGridPreview;
    toggleGridBtn.textContent = state.showGridPreview ? "Hide Grid Preview" : "Show Grid Preview";
    gridPreviewCard.style.display = state.showGridPreview ? "block" : "none";
    trackEvent("grid_preview_toggle", {
      grid_preview_visible: state.showGridPreview ? "yes" : "no"
    });
  });
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", downloadPreview);
}

if (resetBtn) {
  resetBtn.addEventListener("click", resetTool);
}

function handleImageFile(file, uploadMethod = "unknown") {
  trackEvent("image_upload", {
    upload_method: uploadMethod,
    file_type: file.type || "unknown",
    file_size_bucket: getFileSizeBucket(file.size)
  });

  if (!file.type.startsWith("image/")) {
    setStatus("Please upload a valid image file.", "error");
    trackEvent("image_upload_error", { error_reason: "invalid_file_type" });
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setStatus("This image is too large. Please upload an image under 10 MB.", "error");
    trackEvent("image_upload_error", { error_reason: "file_too_large" });
    return;
  }

  setStatus("Loading your image...", "warning");

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(imageUrl);

    state.image = image;
    state.fileName = file.name;
    state.showSafeZone = true;
    state.showGridPreview = true;

    const ratioStatus = updateImageInfo(image, file);
    showToolControls();
    drawReelPreview();
    drawGridPreview();

    setStatus("Image loaded successfully. Check the preview and safe zones.", "success");

    trackEvent("cover_checked", {
      image_width: image.naturalWidth,
      image_height: image.naturalHeight,
      ratio_status: ratioStatus
    });
  };

  image.onerror = () => {
    URL.revokeObjectURL(imageUrl);
    setStatus("Could not load this image. Please try a different file.", "error");
    trackEvent("image_upload_error", { error_reason: "image_load_failed" });
  };

  image.src = imageUrl;
}

function updateImageInfo(image, file) {
  if (!dimensionResult || !ratioResult || !recommendationText || !statusMessage) return "unknown";

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const ratio = width / height;
  const difference = Math.abs(ratio - TARGET_RATIO);
  let ratioStatus = "good_9_16_fit";

  dimensionResult.textContent = `${width} × ${height}px`;

  if (difference <= RATIO_TOLERANCE) {
    ratioResult.textContent = "Good 9:16 fit";
    ratioResult.style.color = "var(--success)";
    recommendationText.textContent =
      "Great! Your image is close to 9:16. Now check whether important text, face, or logo stays inside the safe zone.";
  } else if (ratio > TARGET_RATIO) {
    ratioStatus = "too_wide";
    ratioResult.textContent = "Too wide";
    ratioResult.style.color = "var(--warning)";
    recommendationText.textContent =
      "Your image is wider than 9:16. Some left and right parts may be cropped in a vertical Reel preview.";
  } else {
    ratioStatus = "too_tall_or_narrow";
    ratioResult.textContent = "Too tall/narrow";
    ratioResult.style.color = "var(--warning)";
    recommendationText.textContent =
      "Your image is narrower than 9:16. It may need cropping or background filling for a clean Reel preview.";
  }

  const readableSize = formatFileSize(file.size);
  statusMessage.textContent = `Loaded: ${file.name} (${readableSize})`;
  return ratioStatus;
}

function showToolControls() {
  if (reelCanvas) reelCanvas.style.display = "block";
  if (gridCanvas) gridCanvas.style.display = "block";
  if (emptyPreview) emptyPreview.style.display = "none";
  if (emptyGridPreview) emptyGridPreview.style.display = "none";
  if (gridPreviewCard) gridPreviewCard.style.display = "block";

  if (toggleSafeBtn) {
    toggleSafeBtn.disabled = false;
    toggleSafeBtn.textContent = "Hide Safe Zone";
  }
  if (toggleGridBtn) {
    toggleGridBtn.disabled = false;
    toggleGridBtn.textContent = "Hide Grid Preview";
  }
  if (downloadBtn) downloadBtn.disabled = false;
  if (resetBtn) resetBtn.disabled = false;
}

function drawReelPreview() {
  if (!state.image || !reelCtx || !reelCanvas) return;

  clearCanvas(reelCtx, reelCanvas);
  drawImageCover(reelCtx, state.image, TARGET_WIDTH, TARGET_HEIGHT);

  if (state.showSafeZone) {
    drawSafeZoneOverlay(reelCtx);
  }
}

function drawGridPreview() {
  if (!state.image || !gridCtx || !gridCanvas) return;

  clearCanvas(gridCtx, gridCanvas);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = TARGET_WIDTH;
  tempCanvas.height = TARGET_HEIGHT;

  const tempCtx = tempCanvas.getContext("2d");
  drawImageCover(tempCtx, state.image, TARGET_WIDTH, TARGET_HEIGHT);

  const squareSize = TARGET_WIDTH;
  const sourceX = 0;
  const sourceY = (TARGET_HEIGHT - squareSize) / 2;

  gridCtx.drawImage(
    tempCanvas,
    sourceX,
    sourceY,
    squareSize,
    squareSize,
    0,
    0,
    gridCanvas.width,
    gridCanvas.height
  );

  drawGridOverlay(gridCtx);
}

function drawImageCover(ctx, image, canvasWidth, canvasHeight) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = canvasWidth / canvasHeight;

  let sourceWidth;
  let sourceHeight;
  let sourceX;
  let sourceY;

  if (imageRatio > canvasRatio) {
    sourceHeight = image.naturalHeight;
    sourceWidth = sourceHeight * canvasRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
    sourceY = 0;
  } else {
    sourceWidth = image.naturalWidth;
    sourceHeight = sourceWidth / canvasRatio;
    sourceX = 0;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvasWidth,
    canvasHeight
  );
}

function drawSafeZoneOverlay(ctx) {
  const topUnsafeHeight = 250;
  const bottomUnsafeHeight = 360;
  const sideMargin = 110;

  ctx.save();

  ctx.fillStyle = "rgba(239, 68, 68, 0.24)";
  ctx.fillRect(0, 0, TARGET_WIDTH, topUnsafeHeight);
  ctx.fillRect(0, TARGET_HEIGHT - bottomUnsafeHeight, TARGET_WIDTH, bottomUnsafeHeight);

  ctx.strokeStyle = "rgba(34, 197, 94, 0.95)";
  ctx.lineWidth = 8;
  ctx.setLineDash([28, 18]);

  const safeX = sideMargin;
  const safeY = topUnsafeHeight;
  const safeWidth = TARGET_WIDTH - sideMargin * 2;
  const safeHeight = TARGET_HEIGHT - topUnsafeHeight - bottomUnsafeHeight;

  roundRect(ctx, safeX, safeY, safeWidth, safeHeight, 36);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(22, 163, 74, 0.92)";
  ctx.fillRect(safeX + 22, safeY + 22, 260, 58);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillText("Safe Zone", safeX + 42, safeY + 62);

  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.fillRect(32, 32, 330, 58);
  ctx.fillRect(32, TARGET_HEIGHT - 92, 430, 58);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("Top unsafe area", 52, 70);
  ctx.fillText("Bottom unsafe area", 52, TARGET_HEIGHT - 54);

  ctx.restore();
}

function drawGridOverlay(ctx) {
  if (!gridCanvas) return;

  ctx.save();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(gridCanvas.width / 3, 0);
  ctx.lineTo(gridCanvas.width / 3, gridCanvas.height);
  ctx.moveTo((gridCanvas.width / 3) * 2, 0);
  ctx.lineTo((gridCanvas.width / 3) * 2, gridCanvas.height);
  ctx.moveTo(0, gridCanvas.height / 3);
  ctx.lineTo(gridCanvas.width, gridCanvas.height / 3);
  ctx.moveTo(0, (gridCanvas.height / 3) * 2);
  ctx.lineTo(gridCanvas.width, (gridCanvas.height / 3) * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.fillRect(24, 24, 300, 46);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("Profile grid crop", 42, 55);

  ctx.restore();
}

function downloadPreview() {
  if (!state.image || !reelCanvas) {
    setStatus("Upload an image before downloading.", "error");
    return;
  }

  drawReelPreview();

  reelCanvas.toBlob((blob) => {
    if (!blob) {
      setStatus("Could not create the preview image. Please try again.", "error");
      trackEvent("cover_download_error", { error_reason: "blob_failed" });
      return;
    }

    const link = document.createElement("a");
    const cleanName = state.fileName.replace(/\.[^/.]+$/, "").replace(/\s+/g, "-").toLowerCase();
    const objectUrl = URL.createObjectURL(blob);

    link.download = `${cleanName || "reelcoverfit"}-checked-preview.png`;
    link.href = objectUrl;
    link.click();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setStatus("Preview downloaded successfully.", "success");

    trackEvent("cover_download", {
      file_name_length: state.fileName.length,
      safe_zone_visible: state.showSafeZone ? "yes" : "no"
    });
  }, "image/png");
}

function resetTool() {
  state.image = null;
  state.fileName = "";
  state.showSafeZone = true;
  state.showGridPreview = true;

  if (imageInput) imageInput.value = "";

  if (reelCtx && reelCanvas) clearCanvas(reelCtx, reelCanvas);
  if (gridCtx && gridCanvas) clearCanvas(gridCtx, gridCanvas);

  if (reelCanvas) reelCanvas.style.display = "none";
  if (gridCanvas) gridCanvas.style.display = "none";
  if (emptyPreview) emptyPreview.style.display = "block";
  if (emptyGridPreview) emptyGridPreview.style.display = "block";
  if (gridPreviewCard) gridPreviewCard.style.display = "block";

  if (dimensionResult) dimensionResult.textContent = "Not uploaded";
  if (ratioResult) {
    ratioResult.textContent = "Waiting";
    ratioResult.style.color = "inherit";
  }
  if (recommendationText) {
    recommendationText.textContent =
      "Tip: Keep important text, face, and logo away from the top and bottom edges.";
  }

  if (toggleSafeBtn) toggleSafeBtn.disabled = true;
  if (toggleGridBtn) toggleGridBtn.disabled = true;
  if (downloadBtn) downloadBtn.disabled = true;
  if (resetBtn) resetBtn.disabled = true;

  setStatus("Upload an image to start checking.", "");
  trackEvent("tool_reset");
}

function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function setStatus(message, type) {
  if (!statusMessage) return;

  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
