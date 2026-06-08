/** QASAB design tokens and Plotly helpers */

export const COLORS = {
  white: "#FFFFFF",
  surface: "#F0F7FC",
  primary: "#1B6CA8",
  primaryLight: "#5BA4D9",
  accent: "#F58220",
  text: "#1A2B3C",
};

export const PLOTLY_LAYOUT = {
  paper_bgcolor: COLORS.white,
  plot_bgcolor: COLORS.surface,
  font: { family: "Noto Sans Arabic, sans-serif", color: COLORS.text, size: 13 },
  colorway: [COLORS.primary, COLORS.accent, COLORS.primaryLight],
};

export const PLOT_CONFIG = {
  displayModeBar: false,
  responsive: true,
  scrollZoom: false,
  staticPlot: false,
};

export const CHART_HEIGHT = 380;

export function renderPlot(divId, data, layout, height = CHART_HEIGHT) {
  const el = document.getElementById(divId);
  if (!el) return;
  Plotly.react(el, data, {
    ...PLOTLY_LAYOUT,
    ...layout,
    height,
    margin: layout.margin || { l: 50, r: 30, t: 45, b: 50 },
  }, { ...PLOT_CONFIG, transition: { duration: 0, easing: "linear" } });
}

/** Fill parent chart-box height (avoids empty gap below plot) */
export function renderPlotInBox(divId, data, layout) {
  const el = document.getElementById(divId);
  if (!el) return;
  const h = Math.max(180, el.clientHeight - 4);
  renderPlot(divId, data, layout, h);
}

export function setMetrics(container, items) {
  container.innerHTML = items
    .map(
      ([label, value]) => `
      <div class="metric">
        <div class="metric-value">${value}</div>
        <div class="metric-label">${label}</div>
      </div>`
    )
    .join("");
}

export function infoHtml(text, kind = "info") {
  const cls = kind === "warn" ? "warn-box" : "info-box";
  return `<div class="${cls}">${text}</div>`;
}
