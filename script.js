const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const TARGET_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.03;

const state = {
  image: null,
  fileName: "",
  showSafeZone: true,
  showGridPreview: true,
  cropZoom: 1,
  cropOffsetX: 0,
  cropOffsetY: 0,
  isDragging: false,
  showRuleOfThirds: true,
  showFaceGuide: true,
  snapToCenter: true
};

const imageInput = document.getElementById("imageInput");
const dropZone = document.getElementById("dropZone");
const statusMessage = document.getElementById("statusMessage");
const dimensionResult = document.getElementById("dimensionResult");
const ratioResult = document.getElementById("ratioResult");
const recommendationText = document.getElementById("recommendationText");
const creatorScoreValue = document.getElementById("creatorScoreValue");
const creatorScoreLabel = document.getElementById("creatorScoreLabel");
const creatorScoreBar = document.getElementById("creatorScoreBar");
const smartAdviceList = document.getElementById("smartAdviceList");
const scoreRatio = document.getElementById("scoreRatio");
const scoreResolution = document.getElementById("scoreResolution");
const scoreSafeZone = document.getElementById("scoreSafeZone");
const scoreGrid = document.getElementById("scoreGrid");

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
const zoomRange = document.getElementById("zoomRange");
const zoomValue = document.getElementById("zoomValue");
const resetCropBtn = document.getElementById("resetCropBtn");
const toggleThirdsBtn = document.getElementById("toggleThirdsBtn");
const toggleFaceGuideBtn = document.getElementById("toggleFaceGuideBtn");
const toggleSnapBtn = document.getElementById("toggleSnapBtn");

function trackEvent(eventName, eventParams = {}) {
  if (typeof window.gtag === "function") {
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
    toggleSafeBtn.setAttribute("aria-pressed", state.showSafeZone ? "true" : "false");
    drawReelPreview();
    refreshCreatorScore();
    trackEvent("safe_zone_toggle", {
      safe_zone_visible: state.showSafeZone ? "yes" : "no"
    });
  });
}

if (toggleGridBtn && gridPreviewCard) {
  toggleGridBtn.addEventListener("click", () => {
    state.showGridPreview = !state.showGridPreview;
    toggleGridBtn.textContent = state.showGridPreview ? "Hide Grid Preview" : "Show Grid Preview";
    toggleGridBtn.setAttribute("aria-pressed", state.showGridPreview ? "true" : "false");
    gridPreviewCard.style.display = state.showGridPreview ? "block" : "none";
    refreshCreatorScore();
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

setupCropControls();

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
    resetCrop(false);

    const ratioStatus = updateImageInfo(image, file);
    updateCreatorScore(image, ratioStatus);
    showToolControls();
    drawReelPreview();
    drawGridPreview();

    setStatus("Image loaded. Drag inside the Reel preview to position it, then adjust zoom if needed.", "success");

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
    toggleSafeBtn.setAttribute("aria-pressed", "true");
  }
  if (toggleGridBtn) {
    toggleGridBtn.disabled = false;
    toggleGridBtn.textContent = "Hide Grid Preview";
    toggleGridBtn.setAttribute("aria-pressed", "true");
  }
  if (downloadBtn) downloadBtn.disabled = false;
  if (resetBtn) resetBtn.disabled = false;
  if (zoomRange) zoomRange.disabled = false;
  if (resetCropBtn) resetCropBtn.disabled = false;
  if (toggleThirdsBtn) toggleThirdsBtn.disabled = false;
  if (toggleFaceGuideBtn) toggleFaceGuideBtn.disabled = false;
  if (toggleSnapBtn) toggleSnapBtn.disabled = false;
  if (reelCanvas) {
    reelCanvas.classList.add("crop-enabled");
    reelCanvas.tabIndex = 0;
  }
}

function drawReelPreview() {
  if (!state.image || !reelCtx || !reelCanvas) return;

  clearCanvas(reelCtx, reelCanvas);
  drawImageWithCrop(reelCtx, state.image, TARGET_WIDTH, TARGET_HEIGHT);

  if (state.showSafeZone) {
    drawSafeZoneOverlay(reelCtx);
  }

  drawCreatorOverlays(reelCtx);
}

function drawGridPreview() {
  if (!state.image || !gridCtx || !gridCanvas) return;

  clearCanvas(gridCtx, gridCanvas);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = TARGET_WIDTH;
  tempCanvas.height = TARGET_HEIGHT;

  const tempCtx = tempCanvas.getContext("2d");
  drawImageWithCrop(tempCtx, state.image, TARGET_WIDTH, TARGET_HEIGHT);

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

function getCropGeometry(image, canvasWidth, canvasHeight) {
  const baseScale = Math.max(
    canvasWidth / image.naturalWidth,
    canvasHeight / image.naturalHeight
  );
  const scale = baseScale * state.cropZoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  const maxOffsetX = Math.max(0, (drawWidth - canvasWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - canvasHeight) / 2);

  state.cropOffsetX = clamp(state.cropOffsetX, -maxOffsetX, maxOffsetX);
  state.cropOffsetY = clamp(state.cropOffsetY, -maxOffsetY, maxOffsetY);

  if (state.snapToCenter) {
    const snapThreshold = 28;
    if (Math.abs(state.cropOffsetX) < snapThreshold) state.cropOffsetX = 0;
    if (Math.abs(state.cropOffsetY) < snapThreshold) state.cropOffsetY = 0;
  }

  return {
    x: (canvasWidth - drawWidth) / 2 + state.cropOffsetX,
    y: (canvasHeight - drawHeight) / 2 + state.cropOffsetY,
    width: drawWidth,
    height: drawHeight
  };
}

function drawImageWithCrop(ctx, image, canvasWidth, canvasHeight) {
  const crop = getCropGeometry(image, canvasWidth, canvasHeight);
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height);
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


function drawCreatorOverlays(ctx) {
  ctx.save();

  if (state.showRuleOfThirds) {
    ctx.strokeStyle = "rgba(255,255,255,.72)";
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.moveTo(TARGET_WIDTH / 3, 0);
    ctx.lineTo(TARGET_WIDTH / 3, TARGET_HEIGHT);
    ctx.moveTo((TARGET_WIDTH / 3) * 2, 0);
    ctx.lineTo((TARGET_WIDTH / 3) * 2, TARGET_HEIGHT);
    ctx.moveTo(0, TARGET_HEIGHT / 3);
    ctx.lineTo(TARGET_WIDTH, TARGET_HEIGHT / 3);
    ctx.moveTo(0, (TARGET_HEIGHT / 3) * 2);
    ctx.lineTo(TARGET_WIDTH, (TARGET_HEIGHT / 3) * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.showFaceGuide) {
    const centerX = TARGET_WIDTH / 2;
    const centerY = TARGET_HEIGHT * 0.38;
    const radiusX = 190;
    const radiusY = 245;

    ctx.strokeStyle = "rgba(250,204,21,.95)";
    ctx.lineWidth = 7;
    ctx.setLineDash([24, 16]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(15,23,42,.78)";
    ctx.fillRect(centerX - 150, centerY - radiusY - 72, 300, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Recommended face area", centerX, centerY - radiusY - 36);
  }

  if (state.snapToCenter && state.cropOffsetX === 0 && state.cropOffsetY === 0) {
    ctx.strokeStyle = "rgba(34,197,94,.95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(TARGET_WIDTH / 2, 0);
    ctx.lineTo(TARGET_WIDTH / 2, TARGET_HEIGHT);
    ctx.stroke();

    ctx.fillStyle = "rgba(22,163,74,.92)";
    ctx.fillRect(TARGET_WIDTH / 2 - 92, TARGET_HEIGHT / 2 - 28, 184, 56);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Centered", TARGET_WIDTH / 2, TARGET_HEIGHT / 2 + 10);
  }

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

  downloadBtn.disabled = true;
  downloadBtn.textContent = "Preparing Download…";
  drawReelPreview();

  reelCanvas.toBlob((blob) => {
    if (!blob) {
      setStatus("Could not create the preview image. Please try again.", "error");
      trackEvent("cover_download_error", { error_reason: "blob_failed" });
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download Instagram-Ready Cover";
      return;
    }

    const link = document.createElement("a");
    const cleanName = state.fileName.replace(/\.[^/.]+$/, "").replace(/\s+/g, "-").toLowerCase();
    const objectUrl = URL.createObjectURL(blob);

    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.textContent = "Downloading…";
    }

    link.download = `${cleanName || "reelcoverfit"}-checked-preview.png`;
    link.href = objectUrl;
    link.click();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setStatus("Preview downloaded successfully.", "success");
    if (downloadBtn) {
      downloadBtn.textContent = "Downloaded ✓";
      window.setTimeout(() => {
        downloadBtn.textContent = "Download Preview";
        downloadBtn.disabled = false;
      }, 1800);
    }
    if (shareBox) {
  shareBox.hidden = false;
}

    downloadBtn.textContent = "Downloaded ✓";
    window.setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Download Instagram-Ready Cover";
    }, 1800);

    trackEvent("cover_download", {
      file_name_length: state.fileName.length,
      safe_zone_visible: state.showSafeZone ? "yes" : "no",
      rule_of_thirds_visible: state.showRuleOfThirds ? "yes" : "no",
      face_guide_visible: state.showFaceGuide ? "yes" : "no"
    });
  }, "image/png");
}

function resetTool() {
  state.image = null;
  state.fileName = "";
  state.showSafeZone = true;
  state.showGridPreview = true;
  resetCrop(false);

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

  resetCreatorScore();

  if (toggleSafeBtn) {
    toggleSafeBtn.disabled = true;
    toggleSafeBtn.setAttribute("aria-pressed", "false");
  }
  if (toggleGridBtn) {
    toggleGridBtn.disabled = true;
    toggleGridBtn.setAttribute("aria-pressed", "false");
  }
  if (downloadBtn) downloadBtn.disabled = true;
  if (resetBtn) resetBtn.disabled = true;
  if (zoomRange) zoomRange.disabled = true;
  if (resetCropBtn) resetCropBtn.disabled = true;
  [toggleThirdsBtn, toggleFaceGuideBtn, toggleSnapBtn].forEach((button) => {
    if (!button) return;
    button.disabled = true;
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
  });
  if (reelCanvas) reelCanvas.classList.remove("crop-enabled", "is-dragging");

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

function updateCreatorScore(image, ratioStatus) {
  if (!creatorScoreValue || !scoreRatio || !scoreResolution || !scoreSafeZone || !scoreGrid) return;

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  let score = 100;
  const advice = [];

  if (ratioStatus !== "good_9_16_fit") {
    score -= 28;
    advice.push(
      ratioStatus === "too_wide"
        ? "Crop the left and right sides or redesign on a 9:16 canvas."
        : "Add side space or redesign on a 9:16 canvas so the cover does not look narrow."
    );
  }

  if (width < 720 || height < 1280) {
    score -= 24;
    advice.push("Export a larger image. Aim for 1080 × 1920 px for clearer results.");
  } else if (width < TARGET_WIDTH || height < TARGET_HEIGHT) {
    score -= 10;
    advice.push("Your resolution is usable, but 1080 × 1920 px is safer for sharp output.");
  }

  if (!state.showSafeZone) {
    score -= 6;
    advice.push("Turn the safe-zone overlay on before your final check.");
  }

  if (!state.showGridPreview) {
    score -= 6;
    advice.push("Turn the grid preview on to confirm the center crop still works.");
  }

  score = Math.max(35, Math.min(100, score));
  creatorScoreValue.textContent = `${score}/100`;
  if (creatorScoreBar) creatorScoreBar.style.width = `${score}%`;

  const rating = getScoreRating(score);
  if (creatorScoreLabel) {
    creatorScoreLabel.textContent = `${rating.label} — ${rating.message}`;
    creatorScoreLabel.dataset.rating = rating.key;
  }

  setChecklistItem(
    scoreRatio,
    ratioStatus === "good_9_16_fit" ? "pass" : "warn",
    ratioStatus === "good_9_16_fit"
      ? "Aspect ratio is close to 9:16."
      : "Aspect ratio needs adjustment; some content may be cropped."
  );

  const highResolution = width >= TARGET_WIDTH && height >= TARGET_HEIGHT;
  const usableResolution = width >= 720 && height >= 1280;
  setChecklistItem(
    scoreResolution,
    highResolution ? "pass" : usableResolution ? "warn" : "fail",
    highResolution
      ? "Resolution meets the 1080 × 1920 recommendation."
      : usableResolution
        ? "Resolution is usable, but below the ideal export size."
        : "Resolution is low and may look soft after posting."
  );

  setChecklistItem(
    scoreSafeZone,
    state.showSafeZone ? "pass" : "warn",
    state.showSafeZone
      ? "Safe-zone overlay is visible for manual placement checking."
      : "Safe-zone overlay is hidden."
  );

  setChecklistItem(
    scoreGrid,
    state.showGridPreview ? "pass" : "warn",
    state.showGridPreview
      ? "Profile grid crop preview is visible."
      : "Profile grid crop preview is hidden."
  );

  renderSmartAdvice(advice);
}

function getScoreRating(score) {
  if (score >= 90) {
    return { key: "excellent", label: "Excellent", message: "Technically ready for a final visual check." };
  }
  if (score >= 75) {
    return { key: "good", label: "Good", message: "A few improvements can make it safer." };
  }
  if (score >= 55) {
    return { key: "adjust", label: "Needs adjustment", message: "Fix the highlighted technical issues." };
  }
  return { key: "poor", label: "Not ready", message: "Use a larger 9:16 export before posting." };
}

function renderSmartAdvice(advice) {
  if (!smartAdviceList) return;

  const suggestions = advice.length
    ? advice
    : [
        "Keep titles, faces, and logos inside the green safe-zone box.",
        "Check the square profile crop before downloading."
      ];

  smartAdviceList.innerHTML = "";
  suggestions.forEach((suggestion) => {
    const item = document.createElement("li");
    item.textContent = suggestion;
    smartAdviceList.appendChild(item);
  });
}

function refreshCreatorScore() {
  if (!state.image) return;
  const ratio = state.image.naturalWidth / state.image.naturalHeight;
  const difference = Math.abs(ratio - TARGET_RATIO);
  const ratioStatus = difference <= RATIO_TOLERANCE
    ? "good_9_16_fit"
    : ratio > TARGET_RATIO
      ? "too_wide"
      : "too_tall_or_narrow";
  updateCreatorScore(state.image, ratioStatus);
}

function resetCreatorScore() {
  if (!creatorScoreValue || !scoreRatio || !scoreResolution || !scoreSafeZone || !scoreGrid) return;

  creatorScoreValue.textContent = "--";
  if (creatorScoreBar) creatorScoreBar.style.width = "0%";
  if (creatorScoreLabel) {
    creatorScoreLabel.textContent = "Upload a cover to generate your report.";
    delete creatorScoreLabel.dataset.rating;
  }
  setChecklistItem(scoreRatio, "", "Upload an image to check 9:16 fit.");
  setChecklistItem(scoreResolution, "", "Resolution check waiting.");
  setChecklistItem(scoreSafeZone, "", "Safe zone guidance waiting.");
  setChecklistItem(scoreGrid, "", "Grid crop preview waiting.");
  renderSmartAdvice(["Your personalized technical suggestions will appear here."]);
}

function setChecklistItem(element, status, text) {
  if (!element) return;
  element.classList.remove("pass", "warn", "fail");
  if (status) element.classList.add(status);
  element.textContent = text;
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




function setupOverlayToggle(button, stateKey, eventName) {
  if (!button) return;

  button.addEventListener("click", () => {
    state[stateKey] = !state[stateKey];
    button.classList.toggle("active", state[stateKey]);
    button.setAttribute("aria-pressed", state[stateKey] ? "true" : "false");
    redrawCropPreviews();

    trackEvent(eventName, {
      enabled: state[stateKey] ? "yes" : "no"
    });
  });
}

function setupCropControls() {
  if (!reelCanvas) return;

  const pointers = new Map();
  let lastPointer = null;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  if (zoomRange) {
    zoomRange.addEventListener("input", () => {
      if (!state.image) return;
      setCropZoom(Number(zoomRange.value) / 100, true);
    });
  }

  if (resetCropBtn) {
    resetCropBtn.addEventListener("click", () => resetCrop(true));
  }

  setupOverlayToggle(toggleThirdsBtn, "showRuleOfThirds", "rule_of_thirds_toggle");
  setupOverlayToggle(toggleFaceGuideBtn, "showFaceGuide", "face_guide_toggle");
  setupOverlayToggle(toggleSnapBtn, "snapToCenter", "snap_to_center_toggle");

  reelCanvas.addEventListener("dblclick", () => {
    if (state.image) resetCrop(true);
  });

  reelCanvas.addEventListener("wheel", (event) => {
    if (!state.image) return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.08 : -0.08;
    setCropZoom(state.cropZoom + step, true);
  }, { passive: false });

  reelCanvas.addEventListener("pointerdown", (event) => {
    if (!state.image) return;
    reelCanvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      state.isDragging = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      reelCanvas.classList.add("is-dragging");
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStartDistance = Math.hypot(b.x - a.x, b.y - a.y);
      pinchStartZoom = state.cropZoom;
      state.isDragging = false;
    }
  });

  reelCanvas.addEventListener("pointermove", (event) => {
    if (!state.image || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (pinchStartDistance > 0) {
        setCropZoom(pinchStartZoom * (distance / pinchStartDistance), false);
        redrawCropPreviews();
      }
      return;
    }

    if (!state.isDragging || !lastPointer) return;
    const rect = reelCanvas.getBoundingClientRect();
    const scaleX = TARGET_WIDTH / rect.width;
    const scaleY = TARGET_HEIGHT / rect.height;
    state.cropOffsetX += (event.clientX - lastPointer.x) * scaleX;
    state.cropOffsetY += (event.clientY - lastPointer.y) * scaleY;
    lastPointer = { x: event.clientX, y: event.clientY };
    redrawCropPreviews();
  });

  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
      state.isDragging = false;
      lastPointer = null;
      reelCanvas.classList.remove("is-dragging");
      trackEvent("crop_adjusted", {
        zoom_percent: Math.round(state.cropZoom * 100),
        offset_x: Math.round(state.cropOffsetX),
        offset_y: Math.round(state.cropOffsetY)
      });
    } else if (pointers.size === 1) {
      const point = [...pointers.values()][0];
      state.isDragging = true;
      lastPointer = { ...point };
      reelCanvas.classList.add("is-dragging");
    }
  };

  reelCanvas.addEventListener("pointerup", endPointer);
  reelCanvas.addEventListener("pointercancel", endPointer);

  reelCanvas.addEventListener("keydown", (event) => {
    if (!state.image) return;
    const amount = event.shiftKey ? 60 : 20;
    let handled = true;
    if (event.key === "ArrowLeft") state.cropOffsetX -= amount;
    else if (event.key === "ArrowRight") state.cropOffsetX += amount;
    else if (event.key === "ArrowUp") state.cropOffsetY -= amount;
    else if (event.key === "ArrowDown") state.cropOffsetY += amount;
    else if (event.key === "+" || event.key === "=") setCropZoom(state.cropZoom + 0.05, false);
    else if (event.key === "-") setCropZoom(state.cropZoom - 0.05, false);
    else if (event.key === "0") resetCrop(true);
    else handled = false;

    if (handled) {
      event.preventDefault();
      redrawCropPreviews();
    }
  });
}

function setCropZoom(nextZoom, shouldRedraw = true) {
  state.cropZoom = clamp(nextZoom, 1, 3);
  if (zoomRange) zoomRange.value = String(Math.round(state.cropZoom * 100));
  if (zoomValue) zoomValue.textContent = `${Math.round(state.cropZoom * 100)}%`;
  if (shouldRedraw) redrawCropPreviews();
}

function resetCrop(announce = false) {
  state.cropZoom = 1;
  state.cropOffsetX = 0;
  state.cropOffsetY = 0;
  if (zoomRange) zoomRange.value = "100";
  if (zoomValue) zoomValue.textContent = "100%";
  if (state.image) redrawCropPreviews();
  if (announce) {
    setStatus("Crop reset to the centered 9:16 view.", "success");
    trackEvent("crop_reset");
  }
}

function redrawCropPreviews() {
  if (!state.image) return;
  drawReelPreview();
  drawGridPreview();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// scroll_depth_tracking
const scrollDepthState = {
  25: false,
  50: false,
  75: false,
  90: false
};

window.addEventListener("scroll", () => {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollableHeight <= 0) return;

  const scrollPercent = Math.round((window.scrollY / scrollableHeight) * 100);

  Object.keys(scrollDepthState).forEach((depth) => {
    const depthNumber = Number(depth);
    if (scrollPercent >= depthNumber && !scrollDepthState[depthNumber]) {
      scrollDepthState[depthNumber] = true;
      trackEvent(`scroll_${depthNumber}`);
    }
  });
}, { passive: true });

const platformButtons = document.querySelectorAll(".platform-btn");
const shareBox = document.getElementById("shareBox");
const copySiteLinkBtn = document.getElementById("copySiteLinkBtn");

platformButtons.forEach((button) => {
  button.addEventListener("click", () => {
    platformButtons.forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
    });
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");

    const platform = button.dataset.platform;

    recommendationText.textContent =
      `${platform} selected. Use a vertical 9:16 cover and keep text near the center safe zone.`;

    trackEvent("platform_selected", {
      platform
    });
  });
});


if (copySiteLinkBtn) {
  copySiteLinkBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("https://reelcoverfit.com/");
      setStatus("Website link copied.", "success");
      trackEvent("copy_site_link");
    } catch {
      setStatus("Copy failed. Manually copy reelcoverfit.com", "warning");
    }
  });
}
