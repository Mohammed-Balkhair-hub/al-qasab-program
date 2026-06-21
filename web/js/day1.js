import { renderPlotInBox, setMetrics, infoHtml } from "./theme.js";
import { featureScatterWithBoundary, fixedFeatureAxes } from "./plots.js";
import {
  createLinePlayState,
  renderLinePlayPlot,
  formulaText as lineFormula,
  addFeature,
  removeLastFeature,
  pointTouched,
} from "./lineplay.js";
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
  demo: "lineplay",
  imagesStep: "pixels",
  linePlay: createLinePlayState(),
  samples: [
    emptySample(0, 1, "صنف أ"),
    emptySample(1, 0, "صنف ب"),
  ],
  activeSlot: 0,
  featStep: 0,
  animTimer: null,
  wVals: [0.4, 0.4, 0.2],
  bias: -0.5,
  plotAxes: null,
};

function readySamples() {
  return state.samples.filter((s) => s.features);
}

function scoreSample2D(sample) {
  const [w1, w2] = state.wVals;
  const f = sample.features;
  return w1 * f.brightness + w2 * f.aspect + state.bias;
}

function predictSample(sample) {
  return scoreSample2D(sample) >= 0 ? 1 : 0;
}

function weightsFormulaText() {
  const b = state.bias;
  const bPart = b >= 0 ? ` + ${b.toFixed(2)}` : ` − ${Math.abs(b).toFixed(2)}`;
  return `y = w₁·سطوع + w₂·شكل${bPart}`;
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
  const bias = +(-(scorePos + scoreNeg) / 2).toFixed(2);
  return { weights: [...w2d, state.wVals[2]], bias, diffs };
}

function weightHints(samples) {
  if (samples.length < 2) {
    return "ارفع صورتين في التجربة ٢ (رفع واستخراج) أولاً — ستظهر خصائصهما هنا.";
  }
  if (samples[0].label === samples[1].label) {
    return "⚠️ عيّن تصنيفين مختلفين — صورة واحدة «صنف أ» والأخرى «صنف ب».";
  }

  const pos = samples.find((s) => s.label === 1);
  const neg = samples.find((s) => s.label === 0);
  const { weights: idealW, bias: idealB, diffs } = computeSuggestedWeights(pos, neg);
  const diffs2d = diffs.filter((d) => d.idx < 2);
  const best = diffs2d[0] || diffs[0];
  const second = diffs2d[1] || diffs[1];

  const wrong = samples.filter((s) => predictSample(s) !== s.label);
  if (!wrong.length) {
    return `✅ ممتاز! الخط يفصل بين <strong>${pos.labelName}</strong> و<strong>${neg.labelName}</strong> بشكل صحيح.`;
  }

  const target = wrong[0];
  const targetY = scoreSample2D(target);
  const need = target.label === 1
    ? -targetY + 0.02
    : targetY + 0.02;

  const helpful = diffs2d.find((d) =>
    target.label === 1 ? d.diff > 0.02 : d.diff < -0.02
  ) || best;

  const wIdx = helpful.idx;
  const featVal = target.features[helpful.key];
  const deltaW = Math.min(0.5, Math.max(0.05, need / Math.max(featVal, 0.08)));
  const newW = target.label === 1
    ? Math.min(1, state.wVals[wIdx] + deltaW)
    : Math.max(-1, state.wVals[wIdx] - deltaW);

  const rawPos = state.wVals[0] * pos.features.brightness + state.wVals[1] * pos.features.aspect;
  const rawNeg = state.wVals[0] * neg.features.brightness + state.wVals[1] * neg.features.aspect;
  const midBias = +(-(rawPos + rawNeg) / 2).toFixed(2);

  const steps = [
    `<strong>الخطوة ١ — المشكلة:</strong> <strong>${target.labelName}</strong> مصنّفة خطأ. قيمة y = <strong>${targetY.toFixed(2)}</strong> لكن المطلوب ${target.label === 1 ? "y ≥ 0" : "y < 0"}.`,
    `<strong>الخطوة ٢ — قارن:</strong> ${pos.labelName} (${helpful.name}=${helpful.pos}) مقابل ${neg.labelName} (${helpful.name}=${helpful.neg}). الفرق = <strong>${helpful.diff.toFixed(2)}</strong>.`,
    `<strong>الخطوة ٣ — عدّل ${helpful.weight}:</strong> ${target.label === 1 ? "ارفع" : "خفّض"} <strong>${helpful.weight}</strong> (${helpful.name}) من <strong>${state.wVals[wIdx].toFixed(2)}</strong> إلى حوالي <strong>${newW.toFixed(2)}</strong>.`,
  ];

  if (Math.abs(second.diff) >= 0.04) {
    steps.push(
      `<strong>الخطوة ٤ — ثم ${second.weight}:</strong> ${second.diff > 0 ? "ارفع" : "خفّض"} ${second.weight} (${second.name}) قليلاً في نفس الاتجاه.`
    );
  }

  steps.push(
    `<strong>الخطوة ${steps.length} — b:</strong> اضبط الانحياز b بين y للصورتين ≈ <strong>${midBias}</strong> (أو جرّب <strong>${idealB}</strong> كحل جاهز).`
  );

  steps.push(
    `<strong>💡 حل مقترح:</strong> w₁=${idealW[0]} · w₂=${idealW[1]} · b=${idealB} — صنف أ حيث y ≥ 0`
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

/* ── ١ خط وأوزان (تجربة تفاعلية) ── */
let linePlayRaf = null;

function scheduleLinePlayUpdate() {
  if (linePlayRaf) return;
  linePlayRaf = requestAnimationFrame(() => {
    linePlayRaf = null;
    updateLinePlayUI();
  });
}

function updateLinePlayUI() {
  const lp = state.linePlay;
  renderLinePlayPlot("chart-lineplay", lp, scheduleLinePlayUpdate);

  const formulaEl = document.getElementById("line-formula");
  if (formulaEl) formulaEl.textContent = lineFormula(lp);

  const touched = lp.points.filter((p) => pointTouched(lp, p)).length;
  const metricsEl = document.getElementById("line-metrics");
  if (metricsEl) {
    setMetrics(metricsEl, [
      ["الميزات x", String(lp.nFeatures)],
      ["النقاط", String(lp.points.length)],
      ["على الخط", String(touched)],
      ["ε", lp.touchEps.toFixed(2)],
    ]);
  }

  for (let i = 0; i < lp.nFeatures; i++) {
    const out = document.getElementById(`lw${i + 1}-val`);
    if (out) out.textContent = lp.weights[i].toFixed(2);
  }
  for (let i = 0; i < lp.globals.length; i++) {
    const out = document.getElementById(`lx${i + 3}-val`);
    if (out) out.textContent = lp.globals[i].toFixed(2);
  }
  const tOut = document.getElementById("line-bias-val");
  if (tOut) tOut.textContent = lp.bias.toFixed(2);
  const epsOut = document.getElementById("line-eps-val");
  if (epsOut) epsOut.textContent = lp.touchEps.toFixed(2);
}

function renderLinePlay() {
  document.getElementById("demo-title").textContent = "خط القرار — y = w·x + b";
  document.getElementById("demo-desc").textContent =
    "ميزة واحدة: y = w·x + b — خط مائل مثل R. ميزتان فأكثر: w₁·x₁ + w₂·x₂ + b = 0. اضغط داخل الرسم الأبيض لإضافة نقاط زرقاء.";

  const lp = state.linePlay;
  const mounted = document.getElementById("chart-lineplay");

  if (!mounted) {
    document.getElementById("charts-area").innerHTML = `
      <div class="chart-box weights-scatter" id="chart-lineplay"></div>
    `;

    let weightSliders = "";
    for (let i = 0; i < lp.nFeatures; i++) {
      weightSliders += sliderRow(`lw${i + 1}`, `w${i + 1}`, -1, 1, 0.01, lp.weights[i]);
    }

    let globalSliders = "";
    for (let i = 0; i < lp.globals.length; i++) {
      globalSliders += sliderRow(`lx${i + 3}`, `x${i + 3} (ثابت)`, 0, 1, 0.01, lp.globals[i]);
    }

    document.getElementById("controls-area").innerHTML = `
      <div class="control-group">
        <h3>الميزات x والأوزان w</h3>
        <p class="hint-inline">عدد w = عدد x — ${lp.nFeatures} ميزة حالياً</p>
        <div id="line-weight-sliders">${weightSliders}</div>
        <div id="line-global-sliders">${globalSliders}</div>
        ${sliderRow("line-bias", "b (الانحياز)", -1.5, 1.5, 0.01, lp.bias)}
        ${sliderRow("line-eps", "ε (مسافة القرب)", 0.005, 0.15, 0.005, lp.touchEps)}
        <div class="btn-row">
          <button class="btn btn-secondary" id="btn-add-x">+ إضافة x</button>
          <button class="btn btn-secondary" id="btn-remove-x">− حذف x</button>
          <button class="btn btn-secondary" id="btn-clear-pts">مسح النقاط</button>
        </div>
      </div>
      <div class="formula" style="direction:rtl" id="line-formula"></div>
      <div class="metrics" id="line-metrics"></div>
      ${infoHtml("🟢 المنطقة الخضراء = ε — النقطة تتحول لأخضر داخلها · 🟠 الخط البرتقالي", "info")}
    `;

    bindLinePlayControls();
  } else {
    rebuildLinePlaySliders();
  }

  updateLinePlayUI();
  requestAnimationFrame(() => requestAnimationFrame(() => updateLinePlayUI()));
}

function rebuildLinePlaySliders() {
  const lp = state.linePlay;
  const wWrap = document.getElementById("line-weight-sliders");
  const gWrap = document.getElementById("line-global-sliders");
  const hint = document.querySelector(".hint-inline");
  if (hint) hint.textContent = `عدد w = عدد x — ${lp.nFeatures} ميزة حالياً`;

  if (wWrap) {
    wWrap.innerHTML = "";
    for (let i = 0; i < lp.nFeatures; i++) {
      wWrap.insertAdjacentHTML("beforeend", sliderRow(`lw${i + 1}`, `w${i + 1}`, -1, 1, 0.01, lp.weights[i]));
    }
  }
  if (gWrap) {
    gWrap.innerHTML = "";
    for (let i = 0; i < lp.globals.length; i++) {
      gWrap.insertAdjacentHTML("beforeend", sliderRow(`lx${i + 3}`, `x${i + 3} (ثابت)`, 0, 1, 0.01, lp.globals[i]));
    }
  }
  bindLinePlaySliders();
}

function bindLinePlaySliders() {
  const lp = state.linePlay;
  const wWrap = document.getElementById("line-weight-sliders");
  const gWrap = document.getElementById("line-global-sliders");

  if (wWrap && !wWrap.dataset.bound) {
    wWrap.dataset.bound = "1";
    wWrap.addEventListener("input", (e) => {
      const m = e.target.id?.match(/^lw(\d+)$/);
      if (!m) return;
      lp.weights[parseInt(m[1], 10) - 1] = parseFloat(e.target.value);
      scheduleLinePlayUpdate();
    });
  }

  if (gWrap && !gWrap.dataset.bound) {
    gWrap.dataset.bound = "1";
    gWrap.addEventListener("input", (e) => {
      const m = e.target.id?.match(/^lx(\d+)$/);
      if (!m) return;
      lp.globals[parseInt(m[1], 10) - 3] = parseFloat(e.target.value);
      scheduleLinePlayUpdate();
    });
  }

  const th = document.getElementById("line-bias");
  if (th && !th.dataset.bound) {
    th.dataset.bound = "1";
    th.addEventListener("input", (e) => {
      lp.bias = parseFloat(e.target.value);
      scheduleLinePlayUpdate();
    });
  }

  const eps = document.getElementById("line-eps");
  if (eps && !eps.dataset.bound) {
    eps.dataset.bound = "1";
    eps.addEventListener("input", (e) => {
      lp.touchEps = parseFloat(e.target.value);
      scheduleLinePlayUpdate();
    });
  }
}

function bindLinePlayControls() {
  bindLinePlaySliders();

  document.getElementById("btn-add-x").addEventListener("click", () => {
    addFeature(state.linePlay);
    rebuildLinePlaySliders();
    scheduleLinePlayUpdate();
  });

  document.getElementById("btn-remove-x").addEventListener("click", () => {
    removeLastFeature(state.linePlay);
    rebuildLinePlaySliders();
    scheduleLinePlayUpdate();
  });

  document.getElementById("btn-clear-pts").addEventListener("click", () => {
    state.linePlay.points = [];
    scheduleLinePlayUpdate();
  });
}

function updateSliderOutputs() {
  const w1El = document.getElementById("w1-val");
  const w2El = document.getElementById("w2-val");
  const bEl = document.getElementById("img-bias-val");
  if (w1El) w1El.textContent = state.wVals[0].toFixed(2);
  if (w2El) w2El.textContent = state.wVals[1].toFixed(2);
  if (bEl) bEl.textContent = state.bias.toFixed(2);
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
    formulaEl.textContent = `${weightsFormulaText()}  ·  صنف أ إذا y ≥ 0`;
  }

  const scatterEl = document.getElementById("chart-scatter");
  if (scatterEl && samples.length >= 2) {
    if (scatterEl.querySelector(".info-box, .warn-box")) scatterEl.innerHTML = "";
    if (!state.plotAxes) state.plotAxes = fixedFeatureAxes(samples);
    const chart = featureScatterWithBoundary(samples, state.wVals, state.bias, state.plotAxes);
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
          <tr><th>الصورة</th><th>سطوع</th><th>شكل</th><th>تفاصيل</th><th>التصنيف</th><th>y</th></tr>
          ${samples.map((s) => {
            const yVal = scoreSample2D(s);
            const pred = predictSample(s);
            const ok = pred === s.label;
            return `<tr class="${ok ? "" : "current"}">
              <td>${s.labelName}</td>
              <td>${s.features.brightness}</td>
              <td>${s.features.aspect}</td>
              <td>${s.features.edges}</td>
              <td>${s.label ? "صنف أ" : "صنف ب"}</td>
              <td>${ok ? "✓" : "✗"} (${yVal.toFixed(2)})</td>
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
  document.getElementById("img-bias").addEventListener("input", (e) => {
    state.bias = parseFloat(e.target.value);
    updateSliderOutputs();
    scheduleWeightsUpdate();
  });
}

function renderWeights() {
  document.getElementById("demo-title").textContent = "ضبط الأوزان — اجعل الخط يفصل";
  document.getElementById("demo-desc").textContent =
    "y = w₁·سطوع + w₂·شكل + b — صنف أ إذا y ≥ 0. 🔵 أزرق = صنف أ · 🟠 برتقالي = صنف ب";

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
        ${sliderRow("img-bias", "b (الانحياز)", -1.5, 1.5, 0.01, state.bias)}
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
    if (scatter) scatter.innerHTML = infoHtml("ارفع صورتين في التجربة ٢ (رفع واستخراج) أولاً.", "warn");
  }

  updateWeightsUI();
  requestAnimationFrame(() => requestAnimationFrame(() => updateWeightsUI()));
}

function switchDemo(demo) {
  if (state.animTimer) clearInterval(state.animTimer);
  state.demo = demo;
  document.querySelectorAll(".nav-tabs button[data-demo]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.demo === demo);
  });
  const sub = document.getElementById("images-sub-nav");
  if (sub) sub.remove();
  if (demo === "lineplay") renderLinePlay();
  else if (demo === "images") renderImagesFlow();
}

function renderImagesFlow() {
  showImagesSubNav();
  if (state.imagesStep === "pixels") renderPixels();
  else renderWeights();
}

function showImagesSubNav() {
  if (document.getElementById("images-sub-nav")) {
    document.querySelectorAll("#images-sub-nav button").forEach((b) => {
      b.classList.toggle("active", b.dataset.step === state.imagesStep);
    });
    return;
  }
  const header = document.getElementById("demo-header");
  header.insertAdjacentHTML(
    "beforeend",
    `<div class="sub-tabs" id="images-sub-nav">
      <button type="button" data-step="pixels">أ — رفع واستخراج</button>
      <button type="button" data-step="weights">ب — ضبط الأوزان</button>
    </div>`
  );
  document.getElementById("images-sub-nav").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-step]");
    if (!btn) return;
    state.imagesStep = btn.dataset.step;
    renderImagesFlow();
  });
  showImagesSubNav();
}

document.querySelectorAll(".nav-tabs button[data-demo]").forEach((btn) => {
  btn.addEventListener("click", () => switchDemo(btn.dataset.demo));
});

switchDemo("lineplay");
