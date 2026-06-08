/** Canvas helpers: pixels, features from uploaded image */

export const GRID = 32;

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function computeLetterbox(img, size) {
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2;
  return { ox, oy, w, h, scale, size };
}

function downsampleToGrid(img) {
  const tmp = document.createElement("canvas");
  tmp.width = GRID;
  tmp.height = GRID;
  const tctx = tmp.getContext("2d");
  tctx.fillStyle = "#F0F7FC";
  tctx.fillRect(0, 0, GRID, GRID);
  const scale = Math.min(GRID / img.width, GRID / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (GRID - dw) / 2;
  const dy = (GRID - dh) / 2;
  tctx.drawImage(img, dx, dy, dw, dh);
  return tctx.getImageData(0, 0, GRID, GRID).data;
}

function drawPixelGrid(ctx, pixelData, size) {
  const cell = size / GRID;
  ctx.fillStyle = "#F0F7FC";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = (y * GRID + x) * 4;
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.strokeStyle = "rgba(27,108,168,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }
}

export function ensureCanvasSize(canvas, size) {
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  return size;
}

export function drawToCanvases(img, canvases, size = 280) {
  const { original, pixels, overlay } = canvases;
  [original, pixels, overlay].filter(Boolean).forEach((c) => ensureCanvasSize(c, size));

  const fit = computeLetterbox(img, size);
  const ctxO = original.getContext("2d");
  ctxO.fillStyle = "#F0F7FC";
  ctxO.fillRect(0, 0, size, size);
  ctxO.drawImage(img, fit.ox, fit.oy, fit.w, fit.h);

  const data = downsampleToGrid(img);
  drawPixelGrid(pixels.getContext("2d"), data, size);

  if (overlay) {
    overlay.getContext("2d").clearRect(0, 0, size, size);
  }
  return { ...fit, pixelData: data };
}

function rgbDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function estimateBackground(pixelData) {
  const samples = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (x < 2 || x >= GRID - 2 || y < 2 || y >= GRID - 2) {
        const i = (y * GRID + x) * 4;
        samples.push([pixelData[i], pixelData[i + 1], pixelData[i + 2]]);
      }
    }
  }
  const r = samples.reduce((s, p) => s + p[0], 0) / samples.length;
  const g = samples.reduce((s, p) => s + p[1], 0) / samples.length;
  const b = samples.reduce((s, p) => s + p[2], 0) / samples.length;
  return { r, g, b };
}

function buildForegroundMask(pixelData) {
  const bg = estimateBackground(pixelData);
  const mask = new Array(GRID * GRID).fill(false);
  let fgCount = 0;

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = (y * GRID + x) * 4;
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const dist = rgbDist(r, g, b, bg.r, bg.g, bg.b);
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const isFg = dist > 28 || Math.abs(L - (0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b) / 255) > 0.12;
      mask[y * GRID + x] = isFg;
      if (isFg) fgCount++;
    }
  }

  if (fgCount < GRID * 2) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = (y * GRID + x) * 4;
        const L = (0.299 * pixelData[i] + 0.587 * pixelData[i + 1] + 0.114 * pixelData[i + 2]) / 255;
        mask[y * GRID + x] = L < 0.9;
        if (mask[y * GRID + x]) fgCount++;
      }
    }
  }

  return mask;
}

export function computeFeatures(pixelData) {
  const mask = buildForegroundMask(pixelData);
  const lum = new Float32Array(GRID * GRID);
  const sat = new Float32Array(GRID * GRID);

  let minX = GRID;
  let maxX = 0;
  let minY = GRID;
  let maxY = 0;
  let fgLumSum = 0;
  let fgSatSum = 0;
  let fgCount = 0;
  const fgLums = [];

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const idx = y * GRID + x;
      const i = idx * 4;
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const S = max === 0 ? 0 : (max - min) / max;
      lum[idx] = L;
      sat[idx] = S;

      if (mask[idx]) {
        fgLumSum += L;
        fgSatSum += S;
        fgLums.push(L);
        fgCount++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!fgCount) {
    minX = 0; maxX = GRID - 1; minY = 0; maxY = GRID - 1;
    fgCount = GRID * GRID;
    for (let i = 0; i < lum.length; i++) fgLums.push(lum[i]);
    fgLumSum = fgLums.reduce((a, b) => a + b, 0);
  }

  const brightness = fgLumSum / fgCount;
  const colorRichness = fgSatSum / fgCount;

  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const fillRatio = fgCount / (bw * bh);
  const aspect = Math.min(bw, bh) / Math.max(bw, bh);

  const meanL = brightness;
  let variance = 0;
  for (const L of fgLums) variance += (L - meanL) ** 2;
  const texture = Math.sqrt(variance / fgLums.length);

  let edgeMagSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const idx = y * GRID + x;
      if (!mask[idx]) continue;
      const gx =
        -lum[idx - 1] + lum[idx + 1]
        - lum[idx - GRID - 1] + lum[idx - GRID + 1]
        - lum[idx + GRID - 1] + lum[idx + GRID + 1];
      const gy =
        -lum[idx - GRID] + lum[idx + GRID]
        - lum[idx - GRID - 1] + lum[idx + GRID + 1]
        - lum[idx - GRID + 1] + lum[idx + GRID - 1];
      const mag = Math.sqrt(gx * gx + gy * gy) / 4;
      edgeMagSum += mag;
      edgeCount++;
    }
  }
  const sobel = edgeCount ? edgeMagSum / edgeCount : 0;
  const edges = Math.min(1, 0.55 * sobel * 3.5 + 0.25 * texture * 2 + 0.2 * (1 - fillRatio));

  const round = (v) => +Math.max(0, Math.min(1, v)).toFixed(3);

  return {
    brightness: round(brightness * 0.85 + colorRichness * 0.15),
    aspect: round(aspect * 0.7 + fillRatio * 0.3),
    edges: round(edges),
    light: brightness > 0.45,
    round: aspect > 0.6,
    detailed: edges > 0.12,
    bbox: { minX, maxX, minY, maxY },
    raw: { brightness, aspect, sobel, texture, fillRatio, colorRichness },
  };
}

export function drawFeatureStep(canvas, img, step, features, geom) {
  const size = ensureCanvasSize(canvas, geom?.size || 400);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#F0F7FC";
  ctx.fillRect(0, 0, size, size);

  if (!img) {
    ctx.fillStyle = "#1B6CA8";
    ctx.font = "16px Noto Sans Arabic";
    ctx.textAlign = "center";
    ctx.fillText("ارفع صورة للبدء", size / 2, size / 2);
    return;
  }

  const pixelData = geom?.pixelData || downsampleToGrid(img);
  const cell = size / GRID;
  const fit = computeLetterbox(img, size);

  if (step === 0) {
    ctx.drawImage(img, fit.ox, fit.oy, fit.w, fit.h);
    return;
  }

  if (step === 1) {
    drawPixelGrid(ctx, pixelData, size);
    return;
  }

  if (step === 2 && features) {
    drawPixelGrid(ctx, pixelData, size);
    const b = features.bbox;
    const bx = b.minX * cell;
    const by = b.minY * cell;
    const bw = (b.maxX - b.minX + 1) * cell;
    const bh = (b.maxY - b.minY + 1) * cell;
    ctx.strokeStyle = "#F58220";
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "#F58220";
    ctx.font = "bold 13px Noto Sans Arabic";
    ctx.textAlign = "right";
    const labelY = by > 18 ? by - 8 : by + bh + 16;
    ctx.fillText(`طول≈${bh.toFixed(0)} · عرض≈${bw.toFixed(0)}`, bx + bw, labelY);
    return;
  }

  if (step >= 3 && features) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#1A2B3C";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    const lines = [
      "متجه الخصائص:",
      `[سطوع=${features.brightness},`,
      ` شكل=${features.aspect},`,
      ` تفاصيل=${features.edges}]`,
    ];
    lines.forEach((t, i) => ctx.fillText(t, size / 2, size * 0.38 + i * 28));
    ctx.font = "14px Noto Sans Arabic";
    ctx.fillStyle = "#1B6CA8";
    ctx.fillText("أرقام يفهمها الحاسوب — ليست صورة!", size / 2, size * 0.72);
  }
}

export const FEATURE_STEPS = [
  { title: "١. الصورة الأصلية", desc: "ما تراه عينك — الصورة كاملة بدون قص." },
  { title: "٢. شبكة البكسلات", desc: `الحاسوب يرى جدولاً ${GRID}×${GRID} من الألوان.` },
  { title: "٣. قياس الشكل", desc: "نحدد جسم الصورة ونقيس طوله وعرضه." },
  { title: "٤. متجه الخصائص", desc: "سطوع + شكل + تفاصيل = أرقام دقيقة." },
];

export const FEATURE_KEYS = ["brightness", "aspect", "edges"];
export const FEATURE_NAMES = ["السطوع", "الشكل", "التفاصيل"];
export const WEIGHT_IDS = ["w₁", "w₂", "w₃"];
