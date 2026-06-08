import { renderPlotInBox, setMetrics, infoHtml } from "./theme.js";
import { featureScatterWithBoundary, fixedFeatureAxes } from "./plots.js";
import {
  loadImageFromFile,
  drawToCanvases,
  computeFeatures,
  drawFeatureStep,
  FEATURE_STEPS,
  FEATURE_KEYS,
  FEATURE_NAMES,
  WEIGHT_IDS,
  GRID,
} from "./image-utils.js";

function emptySample(slot, label, labelName) {
  return { slot, img: null, geom: null, features: null, label, labelName };
}

const state = {
  demo: "pixels",
  samples: [
    emptySample(0, 1, "صنف أ"),
    emptySample(1, 0, "صنف ب"),
  ],
  activeSlot: 0,
  featStep: 0,
  animTimer: null,
  wVals: [0.4, 0.4, 0.2],
  threshold: 0.5,
  plotAxes: null,
};

function readySamples() {
  return state.samples.filter((s) => s.features);
}

function scoreSample2D(sample) {
  const [w1, w2] = state.wVals;
  const f = sample.features;
  return w1 * f.brightness + w2 * f.aspect;
}

function predictSample(sample) {
  return scoreSample2D(sample) >= state.threshold ? 1 : 0;
}

function featureDiffs(pos, neg) {
  return FEATURE_KEYS.map((key, idx) => ({
    key,
    idx,
    name: FEATURE_NAMES[idx],
    weight: WEIGHT_IDS[idx],
    pos: pos.features[key],
    neg: neg.features[key],
    diff: pos.features[key] - neg.features[key],
  })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}

function computeSuggestedWeights(pos, neg) {
  const diffs = featureDiffs(pos, neg);
  const w = [0, 0, 0];
  diffs.forEach((d, rank) => {
    if (Math.abs(d.diff) < 0.02) return;
    const sign = d.diff > 0 ? 1 : -1;
    w[d.idx] = sign * (rank === 0 ? 0.55 : rank === 1 ? 0.35 : 0.15);
  });
  if (!w.some((x) => x !== 0)) w = [0.45, 0.35, 0.2];
  const norm2d = w.map((x, i) => (i < 2 ? x : 0));
  const mag2 = Math.sqrt(norm2d[0] ** 2 + norm2d[1] ** 2) || 1;
  const w2d = [+(norm2d[0] / mag2).toFixed(2), +(norm2d[1] / mag2).toFixed(2)];
  const scorePos = w2d[0] * pos.features.brightness + w2d[1] * pos.features.aspect;
  const scoreNeg = w2d[0] * neg.features.brightness + w2d[1] * neg.features.aspect;
  const threshold = +((scorePos + scoreNeg) / 2).toFixed(2);
  return { weights: [...w2d, state.wVals[2]], threshold, diffs };
}

function weightHints(samples) {
  if (samples.length < 2) {
    return "ارفع صورتين في العرض ١ أولاً — ستظهر خصائصهما هنا.";
  }
  if (samples[0].label === samples[1].label) {
    return "⚠️ عيّن تصنيفين مختلفين — صورة واحدة «صنف أ» والأخرى «صنف ب».";
  }

  const pos = samples.find((s) => s.label === 1);
  const neg = samples.find((s) => s.label === 0);
  const { weights: idealW, threshold: idealT, diffs } = computeSuggestedWeights(pos, neg);
  const diffs2d = diffs.filter((d) => d.idx < 2);
  const best = diffs2d[0] || diffs[0];
  const second = diffs2d[1] || diffs[1];

  const wrong = samples.filter((s) => predictSample(s) !== s.label);
  if (!wrong.length) {
    return `✅ ممتاز! الخط يفصل بين <strong>${pos.labelName}</strong> و<strong>${neg.labelName}</strong> بشكل صحيح.`;
  }

  const target = wrong[0];
  const targetScore = scoreSample2D(target);
  const need = target.label === 1
    ? state.threshold - targetScore + 0.02
    : targetScore - state.threshold + 0.02;

  const helpful = diffs2d.find((d) =>
    target.label === 1 ? d.diff > 0.02 : d.diff < -0.02
  ) || best;

  const wIdx = helpful.idx;
  const featVal = target.features[helpful.key];
  const deltaW = Math.min(0.5, Math.max(0.05, need / Math.max(featVal, 0.08)));
  const newW = target.label === 1
    ? Math.min(1, state.wVals[wIdx] + deltaW)
    : Math.max(-1, state.wVals[wIdx] - deltaW);

  const scorePosNow = scoreSample2D(pos);
  const scoreNegNow = scoreSample2D(neg);
  const midThreshold = +((scorePosNow + scoreNegNow) / 2).toFixed(2);

  const steps = [
    `<strong>الخطوة ١ — المشكلة:</strong> <strong>${target.labelName}</strong> مصنّفة خطأ. مجموعها <strong>${targetScore.toFixed(2)}</strong> لكن المطلوب ${target.label === 1 ? `≥ ${state.threshold.toFixed(2)}` : `< ${state.threshold.toFixed(2)}`}.`,
    `<strong>الخطوة ٢ — قارن:</strong> ${pos.labelName} (${helpful.name}=${helpful.pos}) مقابل ${neg.labelName} (${helpful.name}=${helpful.neg}). الفرق = <strong>${helpful.diff.toFixed(2)}</strong>.`,
    `<strong>الخطوة ٣ — عدّل ${helpful.weight}:</strong> ${target.label === 1 ? "ارفع" : "خفّض"} <strong>${helpful.weight}</strong> (${helpful.name}) من <strong>${state.wVals[wIdx].toFixed(2)}</strong> إلى حوالي <strong>${newW.toFixed(2)}</strong>.`,
  ];

  if (Math.abs(second.diff) >= 0.04) {
    steps.push(
      `<strong>الخطوة ٤ — ثم ${second.weight}:</strong> ${second.diff > 0 ? "ارفع" : "خفّض"} ${second.weight} (${second.name}) قليلاً في نفس الاتجاه.`
    );
  }

  steps.push(
    `<strong>الخطوة ${steps.length} — العتبة:</strong> ضعها بين مجموع الصورتين ≈ <strong>${midThreshold}</strong> (أو جرّب <strong>${idealT}</strong> كحل جاهز).`
  );

  steps.push(
    `<strong>💡 حل مقترح:</strong> w₁=${idealW[0]} · w₂=${idealW[1]} · عتبة=${idealT} — إذا النقطتان في المنطقتين الصحيحتين، انتهيت!`
  );

  return steps.join("<br>");
}

function sliderRow(id, label, min, max, step, value) {
  return `
    <label class="slider-row">
      <span class="slider-label">${label}</span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      <output id="${id}-val" class="slider-val">${parseFloat(value).toFixed(2)}</output>
    </label>`;
}

function updateSliderOutputs() {
  const w1El = document.getElementById("w1-val");
  const w2El = document.getElementById("w2-val");
  const tEl = document.getElementById("threshold-val");
  if (w1El) w1El.textContent = state.wVals[0].toFixed(2);
  if (w2El) w2El.textContent = state.wVals[1].toFixed(2);
  if (tEl) tEl.textContent = state.threshold.toFixed(2);
}

/* ── ١ بكسلات وخصائص ── */
function renderPixels() {
  document.getElementById("demo-title").textContent = "من صورتين إلى بكسلات وخصائص";
  document.getElementById("demo-desc").textContent =
    `ارفع صورتين مع تصنيف كل واحدة — شبكة ${GRID}×${GRID} — ثم شغّل استخراج الخصائص.`;

  document.getElementById("charts-area").innerHTML = `
    <div class="dual-upload" id="dual-slots"></div>
    <div class="visual-box anim-box">
      <span class="visual-label" id="anim-label">${FEATURE_STEPS[0].title}</span>
      <canvas id="cv-anim" class="pixel-canvas wide"></canvas>
      <p class="anim-desc" id="anim-desc">${FEATURE_STEPS[0].desc}</p>
    </div>
  `;

  document.getElementById("controls-area").innerHTML = `
    <div class="control-group">
      <h3>اختر صورة للرسوم</h3>
      <div class="slot-tabs">
        <button class="btn ${state.activeSlot === 0 ? "btn-primary" : "btn-secondary"}" id="slot-0">صورة ١</button>
        <button class="btn ${state.activeSlot === 1 ? "btn-primary" : "btn-secondary"}" id="slot-1">صورة ٢</button>
      </div>
    </div>
    <div class="control-group">
      <h3>استخراج الخصائص</h3>
      <div class="step-dots" id="step-dots"></div>
      <button class="btn btn-primary" id="btn-play">▶ تشغيل الرسوم</button>
      <button class="btn btn-secondary" id="btn-step">خطوة تالية</button>
    </div>
    <div id="feat-vector"></div>
  `;

  renderDualSlots();

  document.getElementById("step-dots").innerHTML = FEATURE_STEPS.map((_, i) =>
    `<span class="dot ${i === state.featStep ? "active" : ""}">${i + 1}</span>`
  ).join("");

  updateAnimFrame();

  document.getElementById("slot-0").addEventListener("click", () => { state.activeSlot = 0; state.featStep = 0; renderPixels(); });
  document.getElementById("slot-1").addEventListener("click", () => { state.activeSlot = 1; state.featStep = 0; renderPixels(); });

  document.getElementById("btn-step").addEventListener("click", () => {
    state.featStep = Math.min(state.featStep + 1, FEATURE_STEPS.length - 1);
    updateAnimFrame();
  });

  document.getElementById("btn-play").addEventListener("click", () => {
    if (state.animTimer) clearInterval(state.animTimer);
    state.featStep = 0;
    updateAnimFrame();
    state.animTimer = setInterval(() => {
      if (state.featStep >= FEATURE_STEPS.length - 1) {
        clearInterval(state.animTimer);
        state.animTimer = null;
        return;
      }
      state.featStep++;
      updateAnimFrame();
    }, 1400);
  });
}

function renderDualSlots() {
  const container = document.getElementById("dual-slots");
  container.innerHTML = state.samples.map((s) => `
    <div class="upload-slot ${state.activeSlot === s.slot ? "active-slot" : ""}">
      <h4>صورة ${s.slot + 1}</h4>
      <label class="upload-zone compact">
        <input type="file" data-slot="${s.slot}" accept="image/*" hidden />
        <span>${s.img ? "✓ تم الرفع — اضغط للتغيير" : "📷 ارفع صورة"}</span>
      </label>
      <label>التصنيف:
        <select data-label-slot="${s.slot}">
          <option value="1" ${s.label === 1 ? "selected" : ""}>${state.samples[0].labelName} (صنف أ)</option>
          <option value="0" ${s.label === 0 ? "selected" : ""}>${state.samples[1].labelName} (صنف ب)</option>
        </select>
      </label>
      <label>اسم الصنف:
        <input type="text" data-name-slot="${s.slot}" value="${s.labelName}" placeholder="مثلاً: قطة" />
      </label>
      <div class="mini-canvases">
        <canvas id="cv-orig-${s.slot}" class="pixel-canvas mini"></canvas>
        <canvas id="cv-px-${s.slot}" class="pixel-canvas mini"></canvas>
      </div>
      ${s.features ? `<p class="slot-feat">سطوع=${s.features.brightness} · شكل=${s.features.aspect} · تفاصيل=${s.features.edges}</p>` : ""}
    </div>
  `).join("");

  state.samples.forEach((s) => {
    if (!s.img) return;
    const canvases = {
      original: document.getElementById(`cv-orig-${s.slot}`),
      pixels: document.getElementById(`cv-px-${s.slot}`),
    };
    s.geom = drawToCanvases(s.img, canvases);
    s.features = computeFeatures(s.geom.pixelData);
  });

  container.querySelectorAll("input[type=file]").forEach((inp) => {
    inp.addEventListener("change", async (e) => {
      const slot = parseInt(e.target.dataset.slot, 10);
      const f = e.target.files[0];
      if (!f) return;
      state.samples[slot].img = await loadImageFromFile(f);
      state.activeSlot = slot;
      state.featStep = 0;
      renderPixels();
    });
  });

  container.querySelectorAll("select[data-label-slot]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const slot = parseInt(e.target.dataset.labelSlot, 10);
      state.samples[slot].label = parseInt(e.target.value, 10);
    });
  });

  container.querySelectorAll("input[data-name-slot]").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const slot = parseInt(e.target.dataset.nameSlot, 10);
      state.samples[slot].labelName = e.target.value || (slot === 0 ? "صنف أ" : "صنف ب");
    });
  });
}

function updateAnimFrame() {
  const sample = state.samples[state.activeSlot];
  const canvas = document.getElementById("cv-anim");
  if (!canvas) return;
  const animGeom = sample?.geom ? { ...sample.geom, size: 400 } : { size: 400 };
  drawFeatureStep(canvas, sample?.img ?? null, state.featStep, sample?.features, animGeom);
  const s = FEATURE_STEPS[state.featStep];
  const lbl = document.getElementById("anim-label");
  const desc = document.getElementById("anim-desc");
  if (lbl) lbl.textContent = s.title;
  if (desc) desc.textContent = s.desc;
  document.querySelectorAll(".dot").forEach((d, i) => d.classList.toggle("active", i === state.featStep));
  showFeatureVector();
}

function pixelSampleTable(data) {
  const mid = Math.floor(GRID / 2);
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = mid + dx;
      const y = mid + dy;
      const i = (y * GRID + x) * 4;
      cells.push(`(${data[i]},${data[i + 1]},${data[i + 2]})`);
    }
  }
  return cells.join(" · ");
}

function showFeatureVector() {
  const el = document.getElementById("feat-vector");
  if (!el) return;
  const ready = readySamples();
  if (!ready.length) {
    el.innerHTML = infoHtml("ارفع صورتين مع تصنيفهما — ستُستخدم في ضبط الأوزان.", "info");
    return;
  }
  const sample = state.samples[state.activeSlot];
  if (!sample?.features) {
    el.innerHTML = infoHtml("اختر صورة مرفوعة لعرض الخصائص.", "info");
    return;
  }
  const sampleRgb = sample.geom?.pixelData ? pixelSampleTable(sample.geom.pixelData) : "";
  const allRows = ready.map((s) =>
    `<strong>${s.labelName}</strong> (${s.label ? "صنف أ" : "صنف ب"}): سطوع=${s.features.brightness} · شكل=${s.features.aspect} · تفاصيل=${s.features.edges}`
  ).join("<br>");
  el.innerHTML = infoHtml(
    `<strong>صورة ${state.activeSlot + 1} — عينة RGB (${GRID}×${GRID}):</strong><br>${sampleRgb}<br><br>
     <strong>كل الصور المستخرجة:</strong><br>${allRows}`,
    "info"
  );
}

/* ── ٢ ضبط الأوزان ── */
let weightsRaf = null;

function scheduleWeightsUpdate() {
  if (weightsRaf) return;
  weightsRaf = requestAnimationFrame(() => {
    weightsRaf = null;
    updateWeightsUI();
  });
}

function updateWeightsUI() {
  const samples = readySamples();
  let correct = 0;
  samples.forEach((s) => { if (predictSample(s) === s.label) correct++; });

  updateSliderOutputs();

  const formulaEl = document.getElementById("formula-text");
  if (formulaEl) {
    formulaEl.textContent = `Σ = w₁·سطوع + w₂·شكل ≥ ${state.threshold.toFixed(2)}`;
  }

  const scatterEl = document.getElementById("chart-scatter");
  if (scatterEl && samples.length >= 2) {
    if (scatterEl.querySelector(".info-box, .warn-box")) scatterEl.innerHTML = "";
    if (!state.plotAxes) state.plotAxes = fixedFeatureAxes(samples);
    const chart = featureScatterWithBoundary(samples, state.wVals, state.threshold, state.plotAxes);
    chart.layout.datarevision = Date.now();
    renderPlotInBox("chart-scatter", chart.data, chart.layout);
  }

  const metricsEl = document.getElementById("metrics");
  if (metricsEl) {
    setMetrics(metricsEl, [
      ["صور", String(samples.length)],
      ["صحيح", `${correct}/${samples.length}`],
      ["الدقة", samples.length ? `${Math.round((correct / samples.length) * 100)}%` : "—"],
    ]);
  }

  const hintEl = document.getElementById("hint-box");
  if (hintEl) {
    hintEl.innerHTML = infoHtml(
      weightHints(samples),
      samples.length >= 2 && correct === samples.length ? "info" : "warn"
    );
  }

  const tableEl = document.getElementById("feat-table");
  if (tableEl) {
    if (!samples.length) {
      tableEl.innerHTML = "";
    } else {
      tableEl.innerHTML = `
        <table class="data-table">
          <tr><th>الصورة</th><th>سطوع</th><th>شكل</th><th>تفاصيل</th><th>التصنيف</th><th>التوقع</th></tr>
          ${samples.map((s) => {
            const score2d = scoreSample2D(s);
            const pred = predictSample(s);
            const ok = pred === s.label;
            return `<tr class="${ok ? "" : "current"}">
              <td>${s.labelName}</td>
              <td>${s.features.brightness}</td>
              <td>${s.features.aspect}</td>
              <td>${s.features.edges}</td>
              <td>${s.label ? "صنف أ" : "صنف ب"}</td>
              <td>${ok ? "✓" : "✗"} (${score2d.toFixed(2)})</td>
            </tr>`;
          }).join("")}
        </table>`;
    }
  }
}

function bindWeightSliders() {
  ["w1", "w2"].forEach((id, i) => {
    document.getElementById(id).addEventListener("input", (e) => {
      state.wVals[i] = parseFloat(e.target.value);
      updateSliderOutputs();
      scheduleWeightsUpdate();
    });
  });
  document.getElementById("threshold").addEventListener("input", (e) => {
    state.threshold = parseFloat(e.target.value);
    updateSliderOutputs();
    scheduleWeightsUpdate();
  });
}

function renderWeights() {
  document.getElementById("demo-title").textContent = "ضبط الأوزان — اجعل الخط يفصل";
  document.getElementById("demo-desc").textContent =
    "🔵 أزرق = صنف أ · 🟠 برتقالي = صنف ب — إذا فصل الخط بين النقطتين، التصنيف صحيح!";

  const samples = readySamples();
  const [w1, w2] = state.wVals;
  const mounted = document.getElementById("w1");

  if (samples.length >= 2) {
    state.plotAxes = fixedFeatureAxes(samples);
  } else {
    state.plotAxes = null;
  }

  if (!mounted) {
    document.getElementById("charts-area").innerHTML = `
      <div class="chart-box weights-scatter" id="chart-scatter"></div>
    `;

    document.getElementById("controls-area").innerHTML = `
      <div class="control-group">
        <h3>الأوزان</h3>
        ${sliderRow("w1", "w₁ سطوع", -1, 1, 0.01, w1)}
        ${sliderRow("w2", "w₂ شكل", -1, 1, 0.01, w2)}
        ${sliderRow("threshold", "عتبة", -0.5, 1.5, 0.01, state.threshold)}
      </div>
      <div class="formula" style="direction:rtl" id="formula-text"></div>
      <div class="metrics" id="metrics"></div>
      <div id="hint-box"></div>
      <div id="feat-table"></div>
    `;
    bindWeightSliders();
  }

  if (samples.length < 2) {
    const scatter = document.getElementById("chart-scatter");
    if (scatter) scatter.innerHTML = infoHtml("ارفع صورتين في العرض ١ أولاً.", "warn");
  }

  updateWeightsUI();
  requestAnimationFrame(() => requestAnimationFrame(() => updateWeightsUI()));
}

function switchDemo(demo) {
  if (state.animTimer) clearInterval(state.animTimer);
  state.demo = demo;
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.demo === demo);
  });
  if (demo === "pixels") renderPixels();
  else renderWeights();
}

document.querySelectorAll(".nav-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => switchDemo(btn.dataset.demo));
});

switchDemo("pixels");
