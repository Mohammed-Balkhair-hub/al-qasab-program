import { infoHtml } from "./theme.js";
import {
  createLearningState,
  renderLearningPlot,
  renderLossCurve,
  clearLossCurve,
  averageError,
  errorContributions,
  gradientStep,
  formulaText,
  addFeature,
  removeLastFeature,
  randomizeWeights,
  resetAxes,
  jumpToSolution,
  LOSS_STOP,
  MAX_EPOCHS,
} from "./learning-play.js";

const TRAIN_PHASES = [
  { id: "guess", label: "تخمين" },
  { id: "measure", label: "قياس" },
  { id: "adjust", label: "تعديل" },
  { id: "repeat", label: "تكرار" },
];

const BASE_PHASE_MS = 700;
const BASE_GAP_MS = 200;

const state = {
  demo: "step",
  learn: createLearningState(),
  trainTimer: null,
  trainEpoch: 0,
  animSpeed: 1,
};

function sliderRow(id, label, min, max, step, value) {
  const display =
    id === "learn-anim-speed" ? `${parseFloat(value).toFixed(1)}×` : parseFloat(value).toFixed(2);
  return `
    <label class="slider-row">
      <span class="slider-label">${label}</span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
      <output id="${id}-val" class="slider-val">${display}</output>
    </label>`;
}

function contributionBars(items) {
  const max = Math.max(...items.map((i) => i.value), 0.001);
  return items
    .map(
      (item) => `
    <div class="contrib-row">
      <span class="contrib-label">${item.label}</span>
      <div class="contrib-bar-wrap">
        <div class="contrib-bar" style="width:${Math.round((item.value / max) * 100)}%"></div>
      </div>
      <span class="contrib-val">${item.value.toFixed(3)}</span>
    </div>`
    )
    .join("");
}

function updateLossPanel() {
  const lp = state.learn;
  const loss = averageError(lp);
  const lossEl = document.getElementById("avg-loss-val");
  if (lossEl) lossEl.textContent = loss.toFixed(3);

  const contribEl = document.getElementById("contrib-bars");
  if (contribEl) contribEl.innerHTML = contributionBars(errorContributions(lp));

  const weightsEl = document.getElementById("weights-readout");
  if (weightsEl) {
    const parts = lp.weights.map((w, i) => `w${i + 1}=${w.toFixed(2)}`);
    weightsEl.textContent = `${parts.join(" · ")} · b=${lp.bias.toFixed(2)}`;
  }

  const frozenEl = document.getElementById("frozen-badge");
  if (frozenEl) frozenEl.classList.toggle("hidden", !lp.frozen);
}

let raf = null;
function scheduleUpdate() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = null;
    if (state.demo === "step") updateStepUI();
    else updateTrainUI();
  });
}

function updateStepUI() {
  const lp = state.learn;
  renderLearningPlot(
    "chart-learn",
    lp,
    "اضغط على الرسم: x أفقي، y عمودي (الهدف) — الخط البرتقالي = التنبؤ ŷ",
    scheduleUpdate
  );

  const formulaEl = document.getElementById("learn-formula");
  if (formulaEl) formulaEl.textContent = formulaText(lp);

  updateLossPanel();

  const lrOut = document.getElementById("learn-lr-val");
  if (lrOut) lrOut.textContent = lp.learningRate.toFixed(2);

  const nextBtn = document.getElementById("btn-next");
  if (nextBtn) nextBtn.disabled = !lp.points.length || lp.frozen;

  const jumpBtn = document.getElementById("btn-jump");
  if (jumpBtn) jumpBtn.disabled = !lp.points.length || lp.training;
}

function setTrainPhase(phaseId) {
  state.learn.trainPhase = phaseId;
  document.querySelectorAll(".train-phase").forEach((el) => {
    el.classList.toggle("active", phaseId && el.dataset.phase === phaseId);
  });
}

function phaseDelayMs() {
  return Math.max(80, Math.round(BASE_PHASE_MS / state.animSpeed));
}

function gapDelayMs() {
  return Math.max(40, Math.round(BASE_GAP_MS / state.animSpeed));
}

function stopTraining() {
  if (state.trainTimer) {
    clearTimeout(state.trainTimer);
    state.trainTimer = null;
  }
  state.learn.training = false;
  state.trainEpoch = 0;
  const trainBtn = document.getElementById("btn-train");
  const stopBtn = document.getElementById("btn-stop");
  if (trainBtn) trainBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
  setTrainPhase(null);
}

function runTrainStep() {
  const lp = state.learn;
  if (!lp.training || lp.frozen || !lp.points.length) {
    stopTraining();
    return;
  }
  if (state.trainEpoch >= MAX_EPOCHS) {
    stopTraining();
    return;
  }

  setTrainPhase("guess");
  scheduleUpdate();

  state.trainTimer = setTimeout(() => {
    setTrainPhase("measure");
    updateLossPanel();
    scheduleUpdate();

    state.trainTimer = setTimeout(() => {
      setTrainPhase("adjust");
      gradientStep(lp, { recordHistory: true });
      state.trainEpoch += 1;
      updateLossPanel();
      scheduleUpdate();
      renderLossCurve("chart-loss", lp);

      state.trainTimer = setTimeout(() => {
        setTrainPhase("repeat");
        if (lp.frozen || averageError(lp) <= LOSS_STOP || state.trainEpoch >= MAX_EPOCHS) {
          stopTraining();
          scheduleUpdate();
          return;
        }
        state.trainTimer = setTimeout(runTrainStep, gapDelayMs());
      }, phaseDelayMs());
    }, phaseDelayMs());
  }, phaseDelayMs());
}

function startTraining() {
  const lp = state.learn;
  if (!lp.points.length || lp.training) return;
  lp.training = true;
  lp.frozen = false;
  lp.lossHistory = [averageError(lp)];
  state.trainEpoch = 0;
  document.getElementById("btn-train").disabled = true;
  document.getElementById("btn-stop").disabled = false;
  runTrainStep();
}

function updateTrainUI() {
  const lp = state.learn;
  renderLearningPlot(
    "chart-learn",
    lp,
    "دائرة التعلم — اضغط «تدريب» لمشاهدة الدورة",
    scheduleUpdate
  );

  const formulaEl = document.getElementById("learn-formula");
  if (formulaEl) formulaEl.textContent = formulaText(lp);

  updateLossPanel();
  renderLossCurve("chart-loss", lp);

  const lrOut = document.getElementById("learn-lr-val");
  if (lrOut) lrOut.textContent = lp.learningRate.toFixed(2);

  const trainBtn = document.getElementById("btn-train");
  const stopBtn = document.getElementById("btn-stop");
  if (trainBtn) trainBtn.disabled = lp.training || !lp.points.length;
  if (stopBtn) stopBtn.disabled = !lp.training;
}

function bindSharedControls() {
  const lp = state.learn;

  document.getElementById("btn-add-x").addEventListener("click", () => {
    if (lp.training) return;
    addFeature(lp);
    rebuildGlobalReadout();
    scheduleUpdate();
  });

  document.getElementById("btn-remove-x").addEventListener("click", () => {
    if (lp.training) return;
    removeLastFeature(lp);
    rebuildGlobalReadout();
    scheduleUpdate();
  });

  document.getElementById("btn-clear-pts").addEventListener("click", () => {
    if (lp.training) return;
    lp.points = [];
    lp.lossHistory = [];
    lp.frozen = false;
    resetAxes(lp);
    scheduleUpdate();
  });

  document.getElementById("btn-random").addEventListener("click", () => {
    if (lp.training) return;
    randomizeWeights(lp);
    lp.lossHistory = [];
    scheduleUpdate();
  });

  document.getElementById("btn-jump").addEventListener("click", () => {
    if (lp.training || !lp.points.length) return;
    jumpToSolution(lp);
    if (state.demo === "train") {
      lp.lossHistory.push(averageError(lp));
      renderLossCurve("chart-loss", lp);
    }
    scheduleUpdate();
  });

  document.getElementById("learn-lr").addEventListener("input", (e) => {
    lp.learningRate = parseFloat(e.target.value);
    document.getElementById("learn-lr-val").textContent = lp.learningRate.toFixed(2);
  });

  document.getElementById("learn-anim-speed").addEventListener("input", (e) => {
    state.animSpeed = parseFloat(e.target.value);
    document.getElementById("learn-anim-speed-val").textContent = `${state.animSpeed.toFixed(1)}×`;
  });
}

function rebuildGlobalReadout() {
  const lp = state.learn;
  const gWrap = document.getElementById("learn-global-readout");
  const hint = document.getElementById("feature-hint");
  if (hint) {
    hint.textContent =
      lp.nFeatures === 1
        ? `عدد w = عدد x — ${lp.nFeatures} ميزة`
        : `x على الرسم · y = الهدف · x₂…x${lp.nFeatures} ثابتة لكل النقاط`;
  }
  if (!gWrap) return;

  if (!lp.globals.length) {
    gWrap.innerHTML = "";
    return;
  }
  gWrap.innerHTML = lp.globals
    .map(
      (v, i) =>
        `<p class="global-readout">x${i + 2} = <strong>${v.toFixed(1)}</strong> (ثابت)</p>`
    )
    .join("");
}

function mountChartsShell() {
  document.getElementById("charts-area").innerHTML = `
    <div class="learn-charts">
      <div class="learn-plot-row">
        <aside class="loss-panel" id="loss-panel">
          <div class="loss-panel-head">متوسط الخطأ</div>
          <div class="avg-loss-val" id="avg-loss-val">0.000</div>
          <div class="loss-panel-sub">مساهمة كل وزن في الخطأ</div>
          <div id="contrib-bars"></div>
          <div class="weights-readout" id="weights-readout"></div>
          <div class="frozen-badge hidden" id="frozen-badge">🧊 الأوزان مجمدة — الخطأ منخفض</div>
        </aside>
        <div class="chart-box weights-scatter learn-main-chart" id="chart-learn"></div>
      </div>
      <div class="chart-box loss-curve-box hidden" id="chart-loss"></div>
    </div>
  `;
}

function mountControlsShell() {
  document.getElementById("controls-area").innerHTML = `
    <div class="control-group" id="learn-control-group">
      <h3 id="control-title">دائرة التعلم — خطوة</h3>
      <p class="hint-inline" id="feature-hint">عدد w = عدد x — 1 ميزة</p>
      <div id="learn-global-readout"></div>
      ${sliderRow("learn-lr", "معدل التعلم", 0.01, 3, 0.01, state.learn.learningRate)}
      <div id="anim-speed-wrap" class="hidden">
        ${sliderRow("learn-anim-speed", "سرعة العرض", 0.25, 4, 0.25, state.animSpeed)}
      </div>
      <div class="btn-row" id="action-btns">
        <button class="btn btn-primary" id="btn-next">التالي ← خطوة</button>
        <button class="btn btn-secondary" id="btn-jump">⚡ أفضل خط فوراً</button>
        <button class="btn btn-secondary" id="btn-add-x">+ إضافة x</button>
        <button class="btn btn-secondary" id="btn-remove-x">− حذف x</button>
        <button class="btn btn-secondary" id="btn-clear-pts">مسح النقاط</button>
        <button class="btn btn-secondary" id="btn-random">🎲 أوزان عشوائية</button>
      </div>
    </div>
    <div class="formula" style="direction:rtl" id="learn-formula"></div>
    <div id="learn-info">${infoHtml("🔴 خط أحمر = |y − ŷ| · المحور الأفقي = x · العمودي = y (الهدف) · الميزات الإضافية ثابتة", "info")}</div>
  `;

  document.getElementById("btn-next").addEventListener("click", () => {
    const lp = state.learn;
    if (!lp.points.length || lp.frozen) return;
    gradientStep(lp);
    scheduleUpdate();
  });
  bindSharedControls();
}

function renderStep() {
  stopTraining();
  state.learn.lossHistory = [];
  document.getElementById("demo-title").textContent = "قياس الخطأ — خطوة واحدة";
  document.getElementById("demo-desc").textContent =
    "أضف نقاطاً — الخطوط الحمراء = الخطأ. اضغط «التالي» لتعديل w و b تلقائياً.";

  if (!document.getElementById("chart-learn")) {
    mountChartsShell();
    mountControlsShell();
  }

  document.getElementById("control-title").textContent = "دائرة التعلم — خطوة";
  document.getElementById("btn-next")?.classList.remove("hidden");
  document.getElementById("train-btns")?.classList.add("hidden");
  document.getElementById("anim-speed-wrap")?.classList.add("hidden");
  document.querySelector(".train-phases")?.classList.add("hidden");
  document.getElementById("chart-loss")?.classList.add("hidden");
  clearLossCurve("chart-loss");

  rebuildGlobalReadout();
  updateStepUI();
  requestAnimationFrame(() => requestAnimationFrame(updateStepUI));
}

function renderTrain() {
  document.getElementById("demo-title").textContent = "دائرة التدريب الكاملة";
  document.getElementById("demo-desc").textContent =
    "تخمين → قياس → تعديل → تكرار — ببطء حتى ترى كل مرحلة.";

  if (!document.getElementById("chart-learn")) {
    mountChartsShell();
    mountControlsShell();
  }

  document.getElementById("chart-loss")?.classList.remove("hidden");

  if (!document.querySelector(".train-phases")) {
    document.getElementById("demo-header").insertAdjacentHTML(
      "beforeend",
      `<div class="train-phases">
        ${TRAIN_PHASES.map(
          (p) => `<span class="train-phase" data-phase="${p.id}">${p.label}</span>`
        ).join("")}
      </div>`
    );
  }
  document.querySelector(".train-phases")?.classList.remove("hidden");

  const actionBtns = document.getElementById("action-btns");
  if (!document.getElementById("train-btns")) {
    actionBtns.insertAdjacentHTML(
      "afterbegin",
      `<div class="btn-row train-btns" id="train-btns">
        <button class="btn btn-primary" id="btn-train">▶ تدريب</button>
        <button class="btn btn-secondary" id="btn-stop" disabled>⏹ إيقاف</button>
      </div>`
    );
    document.getElementById("btn-train").addEventListener("click", startTraining);
    document.getElementById("btn-stop").addEventListener("click", stopTraining);
  }
  document.getElementById("train-btns")?.classList.remove("hidden");
  document.getElementById("anim-speed-wrap")?.classList.remove("hidden");
  document.getElementById("btn-next")?.classList.add("hidden");
  document.getElementById("control-title").textContent = "دائرة التعلم — تدريب";

  if (state.learn.training) stopTraining();
  state.learn.lossHistory = [];
  clearLossCurve("chart-loss");
  rebuildGlobalReadout();
  updateTrainUI();
  requestAnimationFrame(() => {
    const main = document.getElementById("chart-learn");
    if (main?._fullLayout) Plotly.Plots.resize(main);
    requestAnimationFrame(updateTrainUI);
  });
}

function switchDemo(demo) {
  stopTraining();
  state.demo = demo;
  document.querySelectorAll(".nav-tabs button[data-demo]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.demo === demo);
  });
  if (demo === "step") renderStep();
  else renderTrain();
}

document.querySelectorAll(".nav-tabs button[data-demo]").forEach((btn) => {
  btn.addEventListener("click", () => switchDemo(btn.dataset.demo));
});

switchDemo("step");
