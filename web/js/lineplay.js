/** Experiment 1 — y = w·x + b (1 feature) or w₁·x₁ + w₂·x₂ + b = 0 (2+ features) */

import { COLORS, PLOTLY_LAYOUT, PLOT_CONFIG } from "./theme.js";

const CLIP_EPS = 1e-6;
const AXIS_PAD = 0.15;

export function createLinePlayState() {
  return {
    nFeatures: 1,
    weights: [0.6],
    globals: [],
    bias: 0.2,
    touchEps: 0.02,
    points: [],
    axes: { x: [0, 1], y: [0, 1] },
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function globalContribution(state) {
  let sum = 0;
  for (let i = 2; i < state.nFeatures; i++) {
    sum += state.weights[i] * (state.globals[i - 2] ?? 0.5);
  }
  return sum;
}

/** ŷ = w·x + b (1 feature) or w₁·x₁ + w₂·x₂ + … + b (2+ features). */
export function pointScore(state, pt) {
  let yHat = state.weights[0] * pt.x;
  if (state.nFeatures >= 2) yHat += state.weights[1] * pt.y;
  yHat += globalContribution(state);
  yHat += state.bias;
  return yHat;
}

/** 1 feature: point on line y = w·x + b. 2+: on decision boundary where score ≈ 0. */
export function pointTouched(state, pt) {
  const eps = state.touchEps ?? 0.02;
  if (state.nFeatures === 1) {
    return Math.abs(pt.y - pointScore(state, pt)) <= eps;
  }
  return Math.abs(pointScore(state, pt)) <= eps;
}

function regressionLineEnds(state, yOffset = 0) {
  const w = state.weights[0] ?? 0;
  const b = state.bias + yOffset;
  const [xLo, xHi] = state.axes.x;
  return [[xLo, w * xLo + b], [xHi, w * xHi + b]];
}

function boundaryLineEndsAtScore(state, scoreTarget = 0) {
  if (state.nFeatures === 1) {
    return regressionLineEnds(state, scoreTarget);
  }

  const w1 = state.weights[0] ?? 0;
  const w2 = state.nFeatures >= 2 ? state.weights[1] ?? 0 : 0;
  const rhs = scoreTarget - state.bias - globalContribution(state);
  const [xLo, xHi] = state.axes.x;
  const [yLo, yHi] = state.axes.y;

  if (Math.abs(w1) < CLIP_EPS && Math.abs(w2) < CLIP_EPS) return null;

  if (Math.abs(w2) < CLIP_EPS) {
    const x = rhs / w1;
    if (x < xLo - CLIP_EPS || x > xHi + CLIP_EPS) return null;
    return [[clamp(x, xLo, xHi), yLo], [clamp(x, xLo, xHi), yHi]];
  }

  if (Math.abs(w1) < CLIP_EPS) {
    const y = rhs / w2;
    if (y < yLo - CLIP_EPS || y > yHi + CLIP_EPS) return null;
    return [[xLo, clamp(y, yLo, yHi)], [xHi, clamp(y, yLo, yHi)]];
  }

  const hits = [];
  const addHit = (x, y) => {
    if (x < xLo - CLIP_EPS || x > xHi + CLIP_EPS || y < yLo - CLIP_EPS || y > yHi + CLIP_EPS) return;
    const p = [clamp(x, xLo, xHi), clamp(y, yLo, yHi)];
    if (!hits.some((h) => Math.hypot(h[0] - p[0], h[1] - p[1]) < 1e-5)) hits.push(p);
  };

  addHit(xLo, (rhs - w1 * xLo) / w2);
  addHit(xHi, (rhs - w1 * xHi) / w2);
  addHit((rhs - w2 * yLo) / w1, yLo);
  addHit((rhs - w2 * yHi) / w1, yHi);

  if (hits.length < 2) return null;
  let best = null;
  let bestDist = -1;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const d = (hits[i][0] - hits[j][0]) ** 2 + (hits[i][1] - hits[j][1]) ** 2;
      if (d > bestDist) {
        bestDist = d;
        best = [hits[i], hits[j]];
      }
    }
  }
  return bestDist > 1e-10 ? best : null;
}

function boundaryLineEnds(state) {
  return boundaryLineEndsAtScore(state, 0);
}

function addToleranceBandTraces(traces, state) {
  const eps = state.touchEps ?? 0.02;
  if (eps <= 0) return;

  const upper = boundaryLineEndsAtScore(state, eps);
  const lower = boundaryLineEndsAtScore(state, -eps);
  if (!upper || !lower) return;

  if (state.nFeatures === 1) {
    const [xLo, xHi] = state.axes.x;
    traces.unshift({
      type: "scatter",
      x: [xLo, xHi, xHi, xLo],
      y: [upper[0][1], upper[1][1], lower[1][1], lower[0][1]],
      fill: "toself",
      fillcolor: "rgba(39, 174, 96, 0.18)",
      line: { width: 0 },
      mode: "lines",
      name: `منطقة ε=${eps.toFixed(2)}`,
      hoverinfo: "skip",
    });
  }

  traces.unshift({
    type: "scatter",
    x: [lower[0][0], lower[1][0]],
    y: [lower[0][1], lower[1][1]],
    mode: "lines",
    line: { color: "rgba(39, 174, 96, 0.55)", width: 2, dash: "dot" },
    name: state.nFeatures === 1 ? "−ε" : "score=−ε",
    hoverinfo: "skip",
    showlegend: state.nFeatures !== 1,
  });
  traces.unshift({
    type: "scatter",
    x: [upper[0][0], upper[1][0]],
    y: [upper[0][1], upper[1][1]],
    mode: "lines",
    line: { color: "rgba(39, 174, 96, 0.55)", width: 2, dash: "dot" },
    name: state.nFeatures === 1 ? "+ε" : "score=+ε",
    hoverinfo: "skip",
    showlegend: state.nFeatures !== 1,
  });
}

export function refreshAxes(state) {
  const xs = state.points.map((p) => p.x);
  const ys = state.points.map((p) => p.y);
  const xMid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0.5;
  const yMid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0.5;
  const xSpan = xs.length ? Math.max(Math.max(...xs) - Math.min(...xs), 0.25) : 0.5;
  const ySpan = ys.length ? Math.max(Math.max(...ys) - Math.min(...ys), 0.25) : 0.5;
  const span = Math.max(xSpan, ySpan, 0.35) * (1 + AXIS_PAD);
  state.axes = {
    x: [xMid - span / 2, xMid + span / 2],
    y: [yMid - span / 2, yMid + span / 2],
  };
}

function lineLegendName(state) {
  return state.nFeatures === 1 ? "y = w·x + b" : "w·x + b = 0";
}

function chartTitle(state) {
  if (state.nFeatures === 1) {
    return "y = w·x + b — اضغط على الرسم لإضافة نقاط";
  }
  return "w₁·x₁ + w₂·x₂ + b = 0 — اضغط على الرسم لإضافة نقاط";
}

export function buildLinePlayChart(state) {
  const [xMin, xMax] = state.axes.x;
  const [yMin, yMax] = state.axes.y;
  const traces = [];

  const touched = [];
  const untouched = [];
  state.points.forEach((pt) => {
    const t = pointTouched(state, pt);
    pt.touched = t;
    (t ? touched : untouched).push(pt);
  });

  if (untouched.length) {
    traces.push({
      type: "scatter",
      x: untouched.map((p) => p.x),
      y: untouched.map((p) => p.y),
      mode: "markers",
      name: "نقاط",
      marker: {
        size: 16,
        color: COLORS.primary,
        line: { width: 2, color: COLORS.white },
      },
      hovertemplate:
        state.nFeatures === 1
          ? "x=%{x:.2f}<br>y=%{y:.2f}<br>ŷ=%{customdata:.2f}<extra></extra>"
          : "x₁=%{x:.2f}<br>x₂=%{y:.2f}<br>score=%{customdata:.2f}<extra></extra>",
      customdata: untouched.map((p) => pointScore(state, p)),
    });
  }

  if (touched.length) {
    traces.push({
      type: "scatter",
      x: touched.map((p) => p.x),
      y: touched.map((p) => p.y),
      mode: "markers",
      name: "على الخط",
      marker: {
        size: 18,
        color: "#27AE60",
        line: { width: 2, color: COLORS.white },
      },
      hovertemplate: "على الخط ✓<extra></extra>",
    });
  }

  const ends = boundaryLineEnds(state);
  if (ends) {
    traces.push({
      type: "scatter",
      x: [ends[0][0], ends[1][0]],
      y: [ends[0][1], ends[1][1]],
      mode: "lines",
      name: lineLegendName(state),
      line: { color: COLORS.accent, width: 4 },
      hoverinfo: "skip",
    });
  }

  addToleranceBandTraces(traces, state);

  const xLabel = state.nFeatures === 1 ? "x" : "x₁";
  const yLabel = state.nFeatures === 1 ? "y" : "x₂";

  return {
    data: traces,
    layout: {
      ...PLOTLY_LAYOUT,
      title: {
        text: chartTitle(state),
        font: { size: 14, color: COLORS.primary },
      },
      height: 380,
      margin: { l: 52, r: 24, t: 48, b: 48 },
      showlegend: true,
      legend: { orientation: "h", y: 1.08, x: 0.5, xanchor: "center" },
      xaxis: {
        title: xLabel,
        range: [xMin, xMax],
        fixedrange: false,
        gridcolor: "#DCE8F2",
        zeroline: true,
        zerolinecolor: "#B0C4D8",
      },
      yaxis: {
        title: yLabel,
        range: [yMin, yMax],
        fixedrange: false,
        gridcolor: "#DCE8F2",
        zeroline: true,
        zerolinecolor: "#B0C4D8",
      },
      dragmode: false,
    },
  };
}

/** Convert a DOM click to plot data coordinates (Plotly pixel → data). */
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

function addPointFromClick(el, state, onChange, evt) {
  const xy = domClickToData(el, evt);
  if (!xy) return;
  state.points.push({ x: xy.x, y: xy.y, touched: false });
  refreshAxes(state);
  onChange();
}

export function bindLinePlayClick(el, state, onChange) {
  if (!el) return;
  if (el._linePlayClickHandler) {
    el.removeEventListener("click", el._linePlayClickHandler);
  }
  el._linePlayClickHandler = (evt) => addPointFromClick(el, state, onChange, evt);
  el.addEventListener("click", el._linePlayClickHandler);
}

export function renderLinePlayPlot(containerId, state, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const draw = () => {
    const { data, layout } = buildLinePlayChart(state);
    const h = Math.max(220, el.clientHeight - 4 || 380);
    return Plotly.react(el, data, { ...layout, height: h }, PLOT_CONFIG).then(() => {
      Plotly.Plots.resize(el);
      if (onChange) bindLinePlayClick(el, state, onChange);
    });
  };

  if (!el._linePlayResizeObs) {
    el._linePlayResizeObs = new ResizeObserver(() => {
      if (el.clientWidth > 80 && el._fullLayout) {
        Plotly.Plots.resize(el);
      } else if (el.clientWidth > 80) {
        draw();
      }
    });
    el._linePlayResizeObs.observe(el);
  }

  if (el.clientWidth > 80) {
    draw();
  } else {
    requestAnimationFrame(() => {
      if (el.clientWidth > 80) draw();
      else requestAnimationFrame(draw);
    });
  }
}

export function formulaText(state) {
  const b = state.bias;
  const bPart = b >= 0 ? ` + ${b.toFixed(2)}` : ` − ${Math.abs(b).toFixed(2)}`;
  if (state.nFeatures === 1) {
    return `y = w·x${bPart}`;
  }
  const parts = [];
  for (let i = 0; i < state.nFeatures; i++) {
    parts.push(`w${i + 1}·x${i + 1}`);
  }
  return `${parts.join(" + ")}${bPart} = 0`;
}

export function addFeature(state) {
  if (state.nFeatures >= 5) return;
  state.nFeatures += 1;
  state.weights.push(0.3);
  if (state.nFeatures > 2) {
    state.globals.push(0.5);
  }
}

export function removeLastFeature(state) {
  if (state.nFeatures <= 1) return;
  state.nFeatures -= 1;
  state.weights.pop();
  if (state.globals.length) {
    state.globals.pop();
  }
}
