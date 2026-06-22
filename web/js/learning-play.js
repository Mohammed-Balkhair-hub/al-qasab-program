/** Day 2 — learning loop plot: loss, error lines, gradient step */

import { COLORS, PLOTLY_LAYOUT, PLOT_CONFIG } from "./theme.js";

const PLOT_MAX = 100;
const DEFAULT_AXES = { x: [0, PLOT_MAX], y: [0, PLOT_MAX] };
const LOSS_STOP = PLOT_MAX * 0.02;
const LR_SCALE = 1 / (PLOT_MAX * PLOT_MAX);
const MAX_EPOCHS = 80;

function randW() {
  return +(Math.random() * 1.2 - 0.2).toFixed(3);
}

function randB() {
  return +(Math.random() * 60 - 30).toFixed(2);
}

export function createLearningState() {
  return {
    nFeatures: 1,
    weights: [randW()],
    globals: [],
    bias: randB(),
    points: [],
    axes: { x: [...DEFAULT_AXES.x], y: [...DEFAULT_AXES.y] },
    learningRate: 0.1,
    lossHistory: [],
    training: false,
    frozen: false,
    trainPhase: null,
  };
}

function fixedFeatureOffset(state) {
  let sum = 0;
  for (let i = 0; i < state.globals.length; i++) {
    sum += (state.weights[i + 1] ?? 0) * state.globals[i];
  }
  return sum;
}

function featureVector(state, pt) {
  const xs = [pt.x];
  for (let i = 0; i < state.globals.length; i++) {
    xs.push(state.globals[i]);
  }
  return xs;
}

/** ŷ or score = w·x + b */
export function pointScore(state, pt) {
  let yHat = 0;
  const xs = featureVector(state, pt);
  for (let i = 0; i < xs.length; i++) {
    yHat += (state.weights[i] ?? 0) * xs[i];
  }
  yHat += state.bias;
  return yHat;
}

export function pointTarget(state, pt) {
  return pt.y;
}

export function pointResidual(state, pt) {
  return pt.y - pointScore(state, pt);
}

export function averageError(state) {
  if (!state.points.length) return 0;
  const sum = state.points.reduce((acc, pt) => acc + Math.abs(pointResidual(state, pt)), 0);
  return sum / state.points.length;
}

/** @deprecated alias */
export const averageLoss = averageError;

/** Per-weight contribution to error (mean over all points). */
export function errorContributions(state) {
  const n = state.points.length;
  const items = [];
  if (!n) {
    for (let i = 0; i < state.nFeatures; i++) {
      items.push({ id: `w${i + 1}`, label: `w${i + 1}`, value: 0 });
    }
    items.push({ id: "b", label: "b (الانحياز)", value: 0 });
    return items;
  }

  const sums = state.weights.map(() => 0);
  let sumB = 0;
  state.points.forEach((pt) => {
    const r = pointResidual(state, pt);
    const xs = featureVector(state, pt);
    xs.forEach((xj, j) => {
      sums[j] += r * xj;
    });
    sumB += r;
  });

  for (let i = 0; i < state.nFeatures; i++) {
    items.push({
      id: `w${i + 1}`,
      label: `w${i + 1}`,
      value: Math.abs(sums[i] / n),
    });
  }
  items.push({ id: "b", label: "b (الانحياز)", value: Math.abs(sumB / n) });
  return items;
}

/** Batch step — average update over all points, then record error. */
export function gradientStep(state, { recordHistory = false } = {}) {
  if (state.frozen || !state.points.length) return false;
  const n = state.points.length;
  const lr = state.learningRate * LR_SCALE;
  const dW = state.weights.map(() => 0);
  let dB = 0;

  state.points.forEach((pt) => {
    const r = pointResidual(state, pt);
    const xs = featureVector(state, pt);
    xs.forEach((xj, j) => {
      dW[j] += r * xj;
    });
    dB += r;
  });

  for (let j = 0; j < state.weights.length; j++) {
    state.weights[j] += lr * (dW[j] / n);
    state.weights[j] = +state.weights[j].toFixed(4);
  }
  state.bias += lr * (dB / n);
  state.bias = +state.bias.toFixed(4);

  const err = averageError(state);
  if (recordHistory) state.lossHistory.push(err);
  if (err <= LOSS_STOP) state.frozen = true;
  return true;
}

function regressionLineEnds(state) {
  const w1 = state.weights[0] ?? 0;
  const intercept = state.bias + fixedFeatureOffset(state);
  const [xLo, xHi] = state.axes.x;
  return [
    [xLo, w1 * xLo + intercept],
    [xHi, w1 * xHi + intercept],
  ];
}

/** Gaussian elimination for small normal-equation systems. */
function solveLinearSystem(aIn, bIn) {
  const n = bIn.length;
  const a = aIn.map((row) => row.slice());
  const b = bIn.slice();
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    const div = a[col][col];
    if (Math.abs(div) < 1e-12) return null;
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / div;
      for (let j = col; j < n; j++) a[row][j] -= factor * a[col][j];
      b[row] -= factor * b[col];
    }
  }
  const x = new Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let j = row + 1; j < n; j++) sum -= a[row][j] * x[j];
    x[row] = sum / a[row][row];
  }
  return x;
}

/** Closed-form least squares: ŷ = w·x + b — best fit for current points. */
export function jumpToSolution(state) {
  const n = state.points.length;
  const k = state.nFeatures;
  if (!n || !k) return false;

  const dim = k + 1;
  const ata = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const aty = new Array(dim).fill(0);

  state.points.forEach((pt) => {
    const xs = featureVector(state, pt);
    const row = [...xs, 1];
    for (let i = 0; i < dim; i++) {
      aty[i] += row[i] * pt.y;
      for (let j = 0; j < dim; j++) ata[i][j] += row[i] * row[j];
    }
  });

  const ridge = 1e-8;
  for (let i = 0; i < dim; i++) ata[i][i] += ridge;

  const sol = solveLinearSystem(ata, aty);
  if (!sol) return false;

  for (let j = 0; j < k; j++) {
    state.weights[j] = +sol[j].toFixed(4);
  }
  state.bias = +sol[k].toFixed(4);
  state.frozen = averageError(state) <= LOSS_STOP;
  return true;
}

/** Vertical error segment: target y → predicted ŷ at same x. */
export function errorFoot(state, pt) {
  return { x: pt.x, y: pointScore(state, pt) };
}

function errorShapes(state) {
  return state.points.map((pt) => {
    const foot = errorFoot(state, pt);
    return {
      type: "line",
      xref: "x",
      yref: "y",
      x0: pt.x,
      y0: pt.y,
      x1: foot.x,
      y1: foot.y,
      line: { color: "#E74C3C", width: 2, dash: "dot" },
    };
  });
}

export function resetAxes(state) {
  state.axes = { x: [...DEFAULT_AXES.x], y: [...DEFAULT_AXES.y] };
}

export function formulaText(state) {
  const b = state.bias;
  const bPart = b >= 0 ? ` + ${b.toFixed(2)}` : ` − ${Math.abs(b).toFixed(2)}`;
  if (state.nFeatures === 1) {
    return `y = w₁·x${bPart}`;
  }
  const parts = ["w₁·x"];
  for (let i = 0; i < state.globals.length; i++) {
    parts.push(`w${i + 2}·x${i + 2}`);
  }
  return `y = ${parts.join(" + ")}${bPart}`;
}

export function buildLearningChart(state, title) {
  const [xMin, xMax] = state.axes.x;
  const [yMin, yMax] = state.axes.y;
  const traces = [];

  if (state.points.length) {
    traces.push({
      type: "scatter",
      x: state.points.map((p) => p.x),
      y: state.points.map((p) => p.y),
      mode: "markers",
      name: "نقاط",
      marker: {
        size: 14,
        color: COLORS.primary,
        line: { width: 2, color: COLORS.white },
      },
      hovertemplate: "x=%{x:.1f}<br>y=%{y:.1f}<br>خطأ=%{customdata:.2f}<extra></extra>",
      customdata: state.points.map((p) => Math.abs(pointResidual(state, p))),
    });
  }

  const ends = regressionLineEnds(state);
  if (ends) {
    traces.push({
      type: "scatter",
      x: [ends[0][0], ends[1][0]],
      y: [ends[0][1], ends[1][1]],
      mode: "lines",
      name: state.nFeatures === 1 ? "y = w₁·x + b" : "ŷ عند x ثابتة",
      line: { color: COLORS.accent, width: 4 },
      hoverinfo: "skip",
    });
  }

  const xLabel = "x";
  const yLabel = "y (الهدف)";

  return {
    data: traces,
    layout: {
      ...PLOTLY_LAYOUT,
      title: {
        text: title,
        font: { size: 14, color: COLORS.primary },
        x: 0.5,
        xanchor: "center",
        y: 0.98,
        yref: "paper",
      },
      shapes: errorShapes(state),
      height: 320,
      margin: { l: 52, r: 24, t: 44, b: 56 },
      showlegend: true,
      legend: {
        orientation: "h",
        y: -0.22,
        x: 0.5,
        xanchor: "center",
        yref: "paper",
        bgcolor: "rgba(255,255,255,0.85)",
      },
      xaxis: {
        title: xLabel,
        range: [xMin, xMax],
        fixedrange: true,
        gridcolor: "#DCE8F2",
        zeroline: true,
        zerolinecolor: "#B0C4D8",
      },
      yaxis: {
        title: yLabel,
        range: [yMin, yMax],
        fixedrange: true,
        gridcolor: "#DCE8F2",
        zeroline: true,
        zerolinecolor: "#B0C4D8",
      },
      dragmode: false,
    },
  };
}

export function buildLossCurveChart(state) {
  const xs = state.lossHistory.map((_, i) => i + 1);
  return {
    data: [
      {
        type: "scatter",
        x: xs,
        y: state.lossHistory,
        mode: "lines+markers",
        name: "الخطأ",
        line: { color: COLORS.primary, width: 3 },
        marker: { size: 5, color: COLORS.accent },
      },
    ],
    layout: {
      ...PLOTLY_LAYOUT,
      title: { text: "منحنى الخطأ", font: { size: 13, color: COLORS.primary } },
      height: 160,
      margin: { l: 48, r: 16, t: 36, b: 36 },
      showlegend: false,
      xaxis: { title: "جولة", dtick: 1 },
      yaxis: { title: "خطأ", rangemode: "tozero" },
    },
  };
}

function domClickToData(gd, evt) {
  const fl = gd._fullLayout;
  if (!fl?.xaxis?.p2l || !fl?.yaxis?.p2l || !fl._size) return null;
  const box = gd.getBoundingClientRect();
  const xPx = evt.clientX - box.left - fl._size.l;
  const yPx = evt.clientY - box.top - fl._size.t;
  if (xPx < 0 || yPx < 0 || xPx > fl._size.w || yPx > fl._size.h) return null;
  const x = fl.xaxis.p2l(xPx);
  const y = fl.yaxis.p2l(yPx);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function bindLearningClick(el, state, onChange) {
  if (!el) return;
  if (el._learnClickHandler) el.removeEventListener("click", el._learnClickHandler);
  el._learnClickHandler = (evt) => {
    if (state.training || state.frozen) return;
    const xy = domClickToData(el, evt);
    if (!xy) return;
    state.points.push({ x: xy.x, y: xy.y });
    onChange();
  };
  el.addEventListener("click", el._learnClickHandler);
}

export function renderLearningPlot(containerId, state, title, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return Promise.resolve();
  const draw = () => {
    const { data, layout } = buildLearningChart(state, title);
    const h = Math.max(200, el.clientHeight - 4 || 320);
    return Plotly.react(el, data, { ...layout, height: h }, PLOT_CONFIG).then(() => {
      Plotly.Plots.resize(el);
      if (onChange) bindLearningClick(el, state, onChange);
    });
  };

  if (!el._learnResizeObs) {
    el._learnResizeObs = new ResizeObserver(() => {
      if (el.clientWidth > 80 && el._fullLayout) Plotly.Plots.resize(el);
      else if (el.clientWidth > 80) draw();
    });
    el._learnResizeObs.observe(el);
  }

  if (el.clientWidth > 80) return draw();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      if (el.clientWidth > 80) draw().then(resolve);
      else requestAnimationFrame(() => draw().then(resolve));
    });
  });
}

export function renderLossCurve(containerId, state) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!state.lossHistory.length) {
    el.innerHTML = "";
    return;
  }
  const { data, layout } = buildLossCurveChart(state);
  const h = Math.max(120, el.clientHeight - 4 || 160);
  Plotly.react(el, data, { ...layout, height: h }, PLOT_CONFIG);
}

export function clearLossCurve(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (el._fullLayout) Plotly.purge(el);
  else el.innerHTML = "";
}

export function addFeature(state) {
  if (state.nFeatures >= 5) return;
  state.nFeatures += 1;
  state.weights.push(randW());
  if (state.nFeatures > 1) {
    state.globals.push(+(25 + Math.random() * 50).toFixed(1));
  }
}

export function removeLastFeature(state) {
  if (state.nFeatures <= 1) return;
  if (state.globals.length) state.globals.pop();
  state.nFeatures -= 1;
  state.weights.pop();
}

export function randomizeWeights(state) {
  state.weights = state.weights.map(() => randW());
  state.bias = randB();
  state.frozen = false;
}

export { LOSS_STOP, MAX_EPOCHS };
