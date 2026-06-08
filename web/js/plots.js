/** Plotly chart builders — Day 1 feature scatter + decision boundary */

import { COLORS, CHART_HEIGHT, PLOTLY_LAYOUT } from "./theme.js";

function baseLayout(title, height = CHART_HEIGHT) {
  return {
    ...PLOTLY_LAYOUT,
    title: { text: title, font: { size: 15, color: COLORS.primary } },
    height,
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 },
  };
}

/** Square viewport from sample points — stable while tuning weights */
export function fixedFeatureAxes(samples, minSpan = 0.18) {
  const xVals = samples.map((s) => s.features.brightness);
  const yVals = samples.map((s) => s.features.aspect);
  const xMid = (Math.min(...xVals) + Math.max(...xVals)) / 2;
  const yMid = (Math.min(...yVals) + Math.max(...yVals)) / 2;
  const xSpan = Math.max(Math.max(...xVals) - Math.min(...xVals), minSpan);
  const ySpan = Math.max(Math.max(...yVals) - Math.min(...yVals), minSpan);
  const span = Math.max(xSpan, ySpan, minSpan) * 1.75;
  return {
    x: [xMid - span / 2, xMid + span / 2],
    y: [yMid - span / 2, yMid + span / 2],
  };
}

const CLIP_EPS = 1e-6;

function clampVal(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function onBox(x, y, xLo, xHi, yLo, yHi) {
  return x >= xLo - CLIP_EPS && x <= xHi + CLIP_EPS && y >= yLo - CLIP_EPS && y <= yHi + CLIP_EPS;
}

function clampPoint(x, y, xLo, xHi, yLo, yHi) {
  return [clampVal(x, xLo, xHi), clampVal(y, yLo, yHi)];
}

function boundaryLineEnds(w1, w2, rhs, xLo, xHi, yLo, yHi) {
  if (Math.abs(w1) < CLIP_EPS && Math.abs(w2) < CLIP_EPS) return null;

  if (Math.abs(w2) < CLIP_EPS) {
    const x = rhs / w1;
    if (x < xLo - CLIP_EPS || x > xHi + CLIP_EPS) return null;
    return [[clampVal(x, xLo, xHi), yLo], [clampVal(x, xLo, xHi), yHi]];
  }

  if (Math.abs(w1) < CLIP_EPS) {
    const y = rhs / w2;
    if (y < yLo - CLIP_EPS || y > yHi + CLIP_EPS) return null;
    return [[xLo, clampVal(y, yLo, yHi)], [xHi, clampVal(y, yLo, yHi)]];
  }

  const hits = [];
  const addHit = (x, y) => {
    if (!onBox(x, y, xLo, xHi, yLo, yHi)) return;
    const p = clampPoint(x, y, xLo, xHi, yLo, yHi);
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

function regionCentroid(w1, w2, rhs, xMin, xMax, yMin, yMax, positive) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  const steps = 14;
  for (let j = 0; j <= steps; j++) {
    for (let i = 0; i <= steps; i++) {
      const x = xMin + ((xMax - xMin) * i) / steps;
      const y = yMin + ((yMax - yMin) * j) / steps;
      const side = w1 * x + w2 * y >= rhs;
      if ((positive && side) || (!positive && !side)) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  return n ? [sx / n, sy / n] : null;
}

function decisionRegionHeatmap(w1, w2, threshold, xMin, xMax, yMin, yMax) {
  const n = 48;
  const xs = Array.from({ length: n }, (_, i) => xMin + ((xMax - xMin) * i) / (n - 1));
  const ys = Array.from({ length: n }, (_, j) => yMin + ((yMax - yMin) * j) / (n - 1));
  const z = ys.map((y) => xs.map((x) => (w1 * x + w2 * y >= threshold ? 1 : 0)));

  return {
    type: "heatmap",
    x: xs,
    y: ys,
    z,
    zmin: 0,
    zmax: 1,
    colorscale: [
      [0, "rgba(245,130,32,0.38)"],
      [0.499, "rgba(245,130,32,0.38)"],
      [0.5, "rgba(27,108,168,0.38)"],
      [1, "rgba(27,108,168,0.38)"],
    ],
    showscale: false,
    hoverinfo: "skip",
    name: "مناطق التصنيف",
  };
}

export function featureScatterWithBoundary(samples, weights, threshold, fixedAxes = null) {
  const [w1, w2] = weights;
  const cats = samples.filter((s) => s.label === 1);
  const others = samples.filter((s) => s.label === 0);

  const traces = [];
  const axes = fixedAxes || fixedFeatureAxes(samples);
  const [xMin, xMax] = axes.x;
  const [yMin, yMax] = axes.y;
  const rhs = threshold;
  const posName = cats[0]?.labelName || "صنف أ";
  const negName = others[0]?.labelName || "صنف ب";

  traces.push(decisionRegionHeatmap(w1, w2, threshold, xMin, xMax, yMin, yMax));

  if (cats.length) {
    traces.push({
      type: "scatter",
      x: cats.map((s) => s.features.brightness),
      y: cats.map((s) => s.features.aspect),
      mode: "markers+text",
      name: posName,
      marker: { size: 20, color: COLORS.primary, symbol: "circle", line: { width: 3, color: COLORS.white } },
      text: cats.map((s) => s.labelName),
      textposition: "top center",
      hovertemplate: "%{text}<br>سطوع=%{x}<br>شكل=%{y}<extra></extra>",
    });
  }
  if (others.length) {
    traces.push({
      type: "scatter",
      x: others.map((s) => s.features.brightness),
      y: others.map((s) => s.features.aspect),
      mode: "markers+text",
      name: negName,
      marker: { size: 20, color: COLORS.accent, symbol: "square", line: { width: 3, color: COLORS.white } },
      text: others.map((s) => s.labelName),
      textposition: "bottom center",
      hovertemplate: "%{text}<br>سطوع=%{x}<br>شكل=%{y}<extra></extra>",
    });
  }

  if (samples.length && (Math.abs(w1) > CLIP_EPS || Math.abs(w2) > CLIP_EPS)) {
    const ends = boundaryLineEnds(w1, w2, rhs, xMin, xMax, yMin, yMax);
    if (ends) {
      traces.push({
        type: "scatter",
        x: [ends[0][0], ends[1][0]],
        y: [ends[0][1], ends[1][1]],
        mode: "lines",
        name: "خط الفصل",
        line: { color: "#E74C3C", width: 4, dash: "dash" },
        hoverinfo: "skip",
        cliponaxis: true,
      });
    }
  }

  const wrongPts = samples.filter((s) => {
    const score = w1 * s.features.brightness + w2 * s.features.aspect;
    const pred = score >= threshold ? 1 : 0;
    return pred !== s.label;
  });
  if (wrongPts.length) {
    traces.push({
      type: "scatter",
      x: wrongPts.map((s) => s.features.brightness),
      y: wrongPts.map((s) => s.features.aspect),
      mode: "markers",
      name: "تصنيف خاطئ",
      marker: {
        size: 22,
        color: "rgba(0,0,0,0)",
        line: { color: "#E74C3C", width: 3 },
        symbol: "circle-open",
      },
      hoverinfo: "skip",
      showlegend: false,
    });
  }

  const slopeLabel = Math.abs(w2) > 0.02
    ? `ميل الخط ≈ ${(-w1 / w2).toFixed(1)}`
    : "ميل عمودي";

  const posCenter = regionCentroid(w1, w2, rhs, xMin, xMax, yMin, yMax, true);
  const negCenter = regionCentroid(w1, w2, rhs, xMin, xMax, yMin, yMax, false);
  const annotations = [];
  const labelPadX = (xMax - xMin) * 0.1;
  const labelPadY = (yMax - yMin) * 0.1;
  const labelPos = (x, y) => [
    clampVal(x, xMin + labelPadX, xMax - labelPadX),
    clampVal(y, yMin + labelPadY, yMax - labelPadY),
  ];

  if (posCenter) {
    const [lx, ly] = labelPos(posCenter[0], posCenter[1]);
    annotations.push({
      x: lx, y: ly, xref: "x", yref: "y",
      text: `🔵 ${posName}<br>منطقة صنف أ`,
      showarrow: false,
      font: { family: "Noto Sans Arabic, sans-serif", size: 13, color: COLORS.primary },
      bgcolor: "rgba(255,255,255,0.82)",
      bordercolor: COLORS.primary,
      borderwidth: 2,
      borderpad: 6,
      align: "center",
    });
  }
  if (negCenter) {
    const [lx, ly] = labelPos(negCenter[0], negCenter[1]);
    annotations.push({
      x: lx, y: ly, xref: "x", yref: "y",
      text: `🟠 ${negName}<br>منطقة صنف ب`,
      showarrow: false,
      font: { family: "Noto Sans Arabic, sans-serif", size: 13, color: COLORS.accent },
      bgcolor: "rgba(255,255,255,0.82)",
      bordercolor: COLORS.accent,
      borderwidth: 2,
      borderpad: 6,
      align: "center",
    });
  }

  return {
    data: traces,
    layout: {
      ...baseLayout(`خصائص صورك — ${slopeLabel}`),
      shapes: [],
      annotations,
      xaxis: {
        title: "سطوع (من البكسلات)",
        range: [xMin, xMax],
        fixedrange: true,
        gridcolor: "#E0E8F0",
        zeroline: false,
        tickformat: ".2f",
        constrain: "domain",
      },
      yaxis: {
        title: "شكل (من البكسلات)",
        range: [yMin, yMax],
        fixedrange: true,
        gridcolor: "#E0E8F0",
        zeroline: false,
        tickformat: ".2f",
        constrain: "domain",
      },
    },
  };
}
