import { infoHtml } from "./theme.js";
import {
  BUILTIN_EXAMPLES,
  HIDDEN_L1,
  HIDDEN_L2,
  OUTPUTS,
  INPUT_ID,
  ALL_EDGES,
  JOURNEY_STEPS,
  NEURON_STEPS,
  NEURON_PRESETS,
  edgeKey,
  signalEdges,
  neuronById,
  neuronDetectsImage,
} from "./day2-examples.js";

const SN_IN = "sn-in";
const SN_N = "sn-n";
const SN_OUT = "sn-out";

const state = {
  demo: "neuron",
  exampleIdx: 0,
  neuronId: "l1a",
  phase: "idle",
  neuronPhase: "idle",
  running: false,
  neuronRunning: false,
  timers: [],
  resizeObs: null,
};

function currentExample() {
  return BUILTIN_EXAMPLES[state.exampleIdx];
}

function currentNeuron() {
  return neuronById(HIDDEN_L1, state.neuronId);
}

function neuronWillFire() {
  return neuronDetectsImage(state.neuronId, currentExample());
}

function clearTimers() {
  state.timers.forEach(clearTimeout);
  state.timers = [];
  state.running = false;
  state.neuronRunning = false;
}

function schedule(fn, ms) {
  const id = setTimeout(fn, ms);
  state.timers.push(id);
  return id;
}

/* ─── Shared node/edge helpers ─── */

function resetNetworkVisuals() {
  document.querySelectorAll("#nn-graph .nn-node").forEach((el) => {
    el.classList.remove("lit", "winner", "passing");
  });
  document.querySelectorAll("#nn-graph .nn-edge").forEach((el) => {
    el.classList.remove("active", "pulse");
  });
}

function resetNeuronVisuals() {
  document.querySelectorAll("#sn-graph .nn-node").forEach((el) => {
    el.classList.remove("lit", "winner", "passing", "dim-out");
  });
  document.querySelectorAll("#sn-graph .sn-edge").forEach((el) => {
    el.classList.remove("active", "pulse");
  });
  const badge = document.getElementById("sn-result");
  if (badge) badge.className = "sn-result hidden";
}

function nodeEl(id, root = document) {
  return root.querySelector(`.nn-node[data-id="${id}"]`);
}

function edgeEl(from, to, root = document) {
  return root.querySelector(`.nn-edge[data-edge="${edgeKey(from, to)}"]`);
}

function snEdgeEl(from, to) {
  return document.querySelector(`#sn-edges [data-edge="${edgeKey(from, to)}"]`);
}

function pulseEdge(from, to, keepActive = false, getEdge = edgeEl) {
  const el = getEdge(from, to);
  if (!el) return;
  el.classList.add("pulse");
  if (keepActive) el.classList.add("active");
  schedule(() => {
    el.classList.remove("pulse");
    if (!keepActive) el.classList.remove("active");
  }, 700);
}

function lightNode(id, winner = false, root = document) {
  const el = nodeEl(id, root);
  if (!el) return;
  el.classList.add("lit");
  el.classList.add("passing");
  schedule(() => el.classList.remove("passing"), 700);
  if (winner) el.classList.add("winner");
}

function layoutEdgesIn(containerId, svgId, edgeList, getNode) {
  const svg = document.getElementById(svgId);
  const graph = document.getElementById(containerId);
  if (!svg || !graph) return;

  const w = graph.clientWidth;
  const h = graph.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);

  const gRect = graph.getBoundingClientRect();
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - gRect.left,
      y: r.top + r.height / 2 - gRect.top,
    };
  };

  edgeList.forEach(({ from, to }) => {
    const line = svg.querySelector(`[data-edge="${edgeKey(from, to)}"]`);
    const a = getNode(from);
    const b = getNode(to);
    if (!line || !a || !b) return;
    const p1 = center(a);
    const p2 = center(b);
    line.setAttribute("x1", p1.x);
    line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x);
    line.setAttribute("y2", p2.y);
  });
}

function layoutNetworkEdges() {
  layoutEdgesIn("nn-graph", "nn-edges", ALL_EDGES, (id) => nodeEl(id));
}

function layoutSingleEdges() {
  const edges = [
    { from: SN_IN, to: SN_N },
    { from: SN_N, to: SN_OUT },
  ];
  layoutEdgesIn("sn-graph", "sn-edges", edges, (id) => nodeEl(id, document.getElementById("sn-graph")));
}

/* ─── Tab 1: Single neuron ─── */

function updateNeuronStory(phase) {
  const step = NEURON_STEPS.find((s) => s.phase === phase);
  const titleEl = document.getElementById("sn-story-title");
  const textEl = document.getElementById("sn-story-text");
  if (titleEl && step) titleEl.textContent = step.title;
  if (textEl && step) textEl.innerHTML = step.text;

  document.querySelectorAll(".neuron-step").forEach((el) => {
    const order = ["receive", "check", "fire"];
    const ci = order.indexOf(phase);
    const pi = order.indexOf(el.dataset.phase);
    el.classList.toggle("current", el.dataset.phase === phase);
    el.classList.toggle("done", pi >= 0 && pi < ci);
  });
}

function syncNeuronVisual() {
  const ex = currentExample();
  const neuron = currentNeuron();
  const thumb = document.getElementById("sn-thumb");
  const nIcon = document.getElementById("sn-neuron-icon");
  const nLabel = document.getElementById("sn-neuron-label");
  if (thumb) {
    thumb.src = ex.thumb;
    thumb.alt = ex.name;
  }
  if (nIcon) nIcon.textContent = neuron.icon;
  if (nLabel) nLabel.textContent = neuron.label;

  document.querySelectorAll("#neuron-picker .neuron-chip").forEach((el) => {
    el.classList.toggle("selected", el.dataset.id === state.neuronId);
  });
  document.querySelectorAll("#sn-example-picker .example-card").forEach((el, i) => {
    el.classList.toggle("selected", i === state.exampleIdx);
  });

  const hint = document.getElementById("sn-hint");
  if (hint) {
    hint.innerHTML = neuronWillFire()
      ? infoHtml(`مع <strong>${ex.emoji} ${ex.name}</strong> — هذا العصبون سيلتقط «${neuron.label}» و<strong>يضيء</strong>.`, "warn")
      : infoHtml(`مع <strong>${ex.emoji} ${ex.name}</strong> — لا يرى «${neuron.label}» — سيبقى <strong>خامداً</strong>.`, "info");
  }
  requestAnimationFrame(layoutSingleEdges);
}

function runNeuronDemo() {
  clearTimers();
  state.neuronRunning = true;
  const fires = neuronWillFire();
  const btn = document.getElementById("sn-play");
  if (btn) {
    btn.textContent = "⏳ …";
    btn.setAttribute("disabled", "disabled");
  }

  resetNeuronVisuals();
  layoutSingleEdges();

  schedule(() => {
    updateNeuronStory("receive");
    lightNode(SN_IN, false, document.getElementById("sn-graph"));
    pulseEdge(SN_IN, SN_N, false, snEdgeEl);
  }, 200);

  schedule(() => {
    updateNeuronStory("check");
    const n = nodeEl(SN_N, document.getElementById("sn-graph"));
    n?.classList.add("passing");
  }, 950);

  schedule(() => {
    updateNeuronStory("fire");
    if (fires) {
      lightNode(SN_N, false, document.getElementById("sn-graph"));
      pulseEdge(SN_N, SN_OUT, true, snEdgeEl);
      schedule(() => lightNode(SN_OUT, true, document.getElementById("sn-graph")), 350);
      const badge = document.getElementById("sn-result");
      if (badge) {
        badge.className = "sn-result sn-yes";
        badge.textContent = "✓ يلتقط — يضيء ويمرّر الإشارة";
      }
    } else {
      pulseEdge(SN_N, SN_OUT, false, snEdgeEl);
      nodeEl(SN_OUT, document.getElementById("sn-graph"))?.classList.add("dim-out");
      const badge = document.getElementById("sn-result");
      if (badge) {
        badge.className = "sn-result sn-no";
        badge.textContent = "✗ لا يلتقط — يبقى خامداً";
      }
    }
  }, 1700);

  schedule(() => {
    state.neuronRunning = false;
    btn?.removeAttribute("disabled");
    if (btn) btn.textContent = "↺ جرّب مرة أخرى";
  }, 2800);
}

function renderNeuron() {
  document.getElementById("demo-title").textContent = "الخلية العصبية — واحدة فقط";
  document.getElementById("demo-desc").textContent =
    "يستقبل إشارة من المدخل — إن وجد «خصّيته» في الصورة يضيء ويمرّر.";

  const neuron = currentNeuron();
  document.getElementById("charts-area").innerHTML = `
    <div class="single-neuron-wrap">
      <div class="sn-graph" id="sn-graph">
        <svg class="nn-edges-svg" id="sn-edges" aria-hidden="true">
          <line class="nn-edge sn-edge" data-edge="${edgeKey(SN_IN, SN_N)}" />
          <line class="nn-edge sn-edge" data-edge="${edgeKey(SN_N, SN_OUT)}" />
        </svg>
        <div class="sn-row">
          <div class="sn-col">
            <span class="nn-col-title">المدخل</span>
            <div class="nn-node nn-input-node" data-id="${SN_IN}">
              <img id="sn-thumb" alt="" />
              <span class="nn-label">صورة</span>
            </div>
          </div>
          <div class="sn-col sn-col-center">
            <span class="nn-col-title">عصبون واحد</span>
            <div class="nn-node sn-neuron-node" data-id="${SN_N}">
              <span class="nn-icon" id="sn-neuron-icon">${neuron.icon}</span>
              <span class="nn-label" id="sn-neuron-label">${neuron.label}</span>
            </div>
          </div>
          <div class="sn-col">
            <span class="nn-col-title">الخرج</span>
            <div class="nn-node sn-out-node" data-id="${SN_OUT}">
              <span class="nn-icon">➜</span>
              <span class="nn-label">إشارة<br/>للطبقة التالية</span>
            </div>
          </div>
        </div>
      </div>
      <div id="sn-result" class="sn-result hidden"></div>
    </div>
  `;

  document.getElementById("controls-area").innerHTML = `
    <div class="control-group">
      <h3>أي عصبون؟</h3>
      <div class="neuron-picker" id="neuron-picker">
        ${HIDDEN_L1.map(
          (n) =>
            `<button type="button" class="neuron-chip${n.id === state.neuronId ? " selected" : ""}" data-id="${n.id}">
              <span>${n.icon}</span> ${n.label}
            </button>`
        ).join("")}
      </div>
    </div>
    <div class="control-group">
      <h3>أي صورة؟</h3>
      <div class="example-picker" id="sn-example-picker">
        ${BUILTIN_EXAMPLES.map(
          (ex, i) => `
          <button type="button" class="example-card" data-idx="${i}">
            <img src="${ex.thumb}" alt="${ex.name}" />
            <strong>${ex.emoji} ${ex.name}</strong>
          </button>`
        ).join("")}
      </div>
    </div>
    <div class="preset-row">
      <button type="button" class="btn btn-secondary btn-sm" id="preset-yes">✓ يلتقط</button>
      <button type="button" class="btn btn-secondary btn-sm" id="preset-no">✗ لا يلتقط</button>
    </div>
    <div id="sn-hint"></div>
    <button class="btn btn-primary" id="sn-play" style="width:100%">▶ جرّب هذا العصبون</button>
    <div class="journey-track neuron-track">
      ${NEURON_STEPS.map(
        (s) => `
        <div class="journey-step neuron-step" data-phase="${s.phase}">
          <span class="journey-dot"></span>
          <span class="journey-label">${s.title}</span>
        </div>`
      ).join("")}
    </div>
    <div class="story-card">
      <h3 id="sn-story-title">كيف يعمل؟</h3>
      <p id="sn-story-text">كل عصبون في الشبكة يعمل بنفس الطريقة — قبل أن ترى الشبكة كاملة، افهم الواحد.</p>
    </div>
    <div class="info-box">
      <strong>تذكّر:</strong> الإشارة <em>تصل</em> دائماً — لكن <em>الإضاءة</em> تعني «وجدت ما أبحث عنه».
    </div>
  `;

  document.getElementById("neuron-picker").addEventListener("click", (e) => {
    const chip = e.target.closest(".neuron-chip");
    if (!chip || state.neuronRunning) return;
    state.neuronId = chip.dataset.id;
    resetNeuronVisuals();
    syncNeuronVisual();
  });

  document.getElementById("sn-example-picker").addEventListener("click", (e) => {
    const card = e.target.closest(".example-card");
    if (!card || state.neuronRunning) return;
    state.exampleIdx = parseInt(card.dataset.idx, 10);
    resetNeuronVisuals();
    syncNeuronVisual();
  });

  document.getElementById("preset-yes").addEventListener("click", () => {
    if (state.neuronRunning) return;
    state.neuronId = NEURON_PRESETS.yes.neuronId;
    state.exampleIdx = NEURON_PRESETS.yes.exampleIdx;
    resetNeuronVisuals();
    syncNeuronVisual();
  });

  document.getElementById("preset-no").addEventListener("click", () => {
    if (state.neuronRunning) return;
    state.neuronId = NEURON_PRESETS.no.neuronId;
    state.exampleIdx = NEURON_PRESETS.no.exampleIdx;
    resetNeuronVisuals();
    syncNeuronVisual();
  });

  document.getElementById("sn-play").addEventListener("click", () => {
    if (state.neuronRunning) return;
    runNeuronDemo();
  });

  syncNeuronVisual();
  const graph = document.getElementById("sn-graph");
  if (graph && typeof ResizeObserver !== "undefined") {
    if (state.resizeObs) state.resizeObs.disconnect();
    state.resizeObs = new ResizeObserver(() => layoutSingleEdges());
    state.resizeObs.observe(graph);
  }
  requestAnimationFrame(layoutSingleEdges);
}

/* ─── Tab 2: Full network ─── */

function buildNetworkHtml() {
  const nodeHtml = (node, extra = "") => `
    <div class="nn-node ${extra}" data-id="${node.id}">
      <span class="nn-icon">${node.icon || ""}</span>
      <span class="nn-label">${node.label}</span>
    </div>`;

  return `
    <div class="nn-graph" id="nn-graph">
      <svg class="nn-edges-svg" id="nn-edges" aria-hidden="true">
        ${ALL_EDGES.map(
          ({ from, to }) =>
            `<line class="nn-edge" data-edge="${edgeKey(from, to)}" data-from="${from}" data-to="${to}" />`
        ).join("")}
      </svg>
      <div class="nn-layers">
        <div class="nn-column">
          <span class="nn-col-title">المدخل</span>
          <div class="nn-node nn-input-node" data-id="${INPUT_ID}" id="nn-image">
            <img id="nn-thumb" alt="" />
            <span class="nn-label">صورتك</span>
          </div>
        </div>
        <div class="nn-column">
          <span class="nn-col-title">طبقة ١</span>
          <div class="nn-stack">${HIDDEN_L1.map((n) => nodeHtml(n)).join("")}</div>
        </div>
        <div class="nn-column">
          <span class="nn-col-title">طبقة ٢</span>
          <div class="nn-stack">${HIDDEN_L2.map((n) => nodeHtml(n)).join("")}</div>
        </div>
        <div class="nn-column">
          <span class="nn-col-title">الخرج</span>
          <div class="nn-stack">${OUTPUTS.map((n) => nodeHtml(n, "nn-out")).join("")}</div>
        </div>
      </div>
    </div>
  `;
}

function updateStory(phase) {
  const ex = currentExample();
  const step = JOURNEY_STEPS.find((s) => s.phase === phase) || JOURNEY_STEPS[JOURNEY_STEPS.length - 1];
  const titleEl = document.getElementById("story-title");
  const textEl = document.getElementById("story-text");
  if (titleEl) titleEl.textContent = step.title;
  if (textEl) {
    textEl.innerHTML = phase === "done" ? ex.story.insight : step.text;
  }

  const order = ["input", "layer1", "layer2", "output", "done"];
  const ci = order.indexOf(phase);
  document.querySelectorAll("#network-panel .journey-step").forEach((el) => {
    const pi = order.indexOf(el.dataset.phase);
    el.classList.toggle("current", el.dataset.phase === phase);
    el.classList.toggle("done", pi >= 0 && pi < ci);
  });
}

function markActiveEdges(story) {
  const active = signalEdges(story);
  document.querySelectorAll("#nn-graph .nn-edge").forEach((el) => {
    el.classList.toggle("active", active.has(el.dataset.edge));
  });
}

function setPhase(phase) {
  state.phase = phase;
  updateStory(phase);

  if (phase === "idle") {
    resetNetworkVisuals();
    return;
  }

  const story = currentExample().story;

  if (phase === "input") {
    resetNetworkVisuals();
    nodeEl(INPUT_ID)?.classList.add("lit");
  }

  if (phase === "layer1" || phase === "layer2" || phase === "output" || phase === "done") {
    nodeEl(INPUT_ID)?.classList.add("lit");
    story.l1.forEach((id) => nodeEl(id)?.classList.add("lit"));
  }
  if (phase === "layer2" || phase === "output" || phase === "done") {
    story.l2.forEach((id) => nodeEl(id)?.classList.add("lit"));
  }
  if (phase === "output" || phase === "done") {
    nodeEl(story.output)?.classList.add("lit");
  }
  if (phase === "done") {
    nodeEl(story.output)?.classList.add("winner");
    markActiveEdges(story);
    const o = neuronById(OUTPUTS, story.output);
    const banner = document.getElementById("result-banner");
    if (banner && o) {
      banner.classList.remove("hidden");
      banner.innerHTML = infoHtml(
        `الشبكة: <strong>${o.icon} ${o.label}</strong> — كل عصبون يعمل كما في العرض ١.`,
        "warn"
      );
    }
  } else {
    document.getElementById("result-banner")?.classList.add("hidden");
  }

  if (phase !== "idle" && phase !== "input") {
    markActiveEdges(story);
  }

  const playBtn = document.getElementById("btn-play");
  if (playBtn && !state.running) {
    playBtn.textContent = phase === "done" ? "↺ شاهد مرة أخرى" : "▶ ابدأ الرحلة";
  }
}

function animateLayer1(story, t0 = 0) {
  schedule(() => {
    updateStory("layer1");
    HIDDEN_L1.forEach((n) => {
      pulseEdge(INPUT_ID, n.id, story.l1.includes(n.id));
    });
  }, t0);

  const activateAt = t0 + 780;
  story.l1.forEach((l1id, i) => {
    schedule(() => lightNode(l1id), activateAt + i * 220);
  });

  return activateAt + story.l1.length * 220 + 550;
}

function animateLayer2(story, t0) {
  schedule(() => {
    updateStory("layer2");
    story.l1.forEach((l1id) => {
      HIDDEN_L2.forEach((l2) => {
        pulseEdge(l1id, l2.id, story.l2.includes(l2.id));
      });
    });
  }, t0);

  const activateAt = t0 + 780;
  story.l2.forEach((l2id, i) => {
    schedule(() => lightNode(l2id), activateAt + i * 220);
  });

  return activateAt + story.l2.length * 220 + 550;
}

function animateOutput(story, t0) {
  schedule(() => {
    updateStory("output");
    story.l2.forEach((l2id) => {
      OUTPUTS.forEach((out) => {
        pulseEdge(l2id, out.id, out.id === story.output);
      });
    });
  }, t0);

  const activateAt = t0 + 780;
  schedule(() => lightNode(story.output, true), activateAt);
  schedule(() => setPhase("done"), activateAt + 450);

  return activateAt + 750;
}

function runJourney() {
  clearTimers();
  state.running = true;
  const story = currentExample().story;
  const playBtn = document.getElementById("btn-play");
  if (playBtn) {
    playBtn.textContent = "⏳ جاري العرض…";
    playBtn.setAttribute("disabled", "disabled");
  }

  resetNetworkVisuals();
  layoutNetworkEdges();
  setPhase("input");
  nodeEl(INPUT_ID)?.classList.add("lit");

  let t = 700;
  t = animateLayer1(story, t);
  t = animateLayer2(story, t);
  t = animateOutput(story, t);

  schedule(() => {
    state.running = false;
    playBtn?.removeAttribute("disabled");
    if (playBtn) playBtn.textContent = "↺ شاهد مرة أخرى";
  }, t);
}

function syncNetworkUI() {
  const ex = currentExample();
  const thumb = document.getElementById("nn-thumb");
  if (thumb) {
    thumb.src = ex.thumb;
    thumb.alt = ex.name;
  }
  document.querySelectorAll("#example-picker .example-card").forEach((el, i) => {
    el.classList.toggle("selected", i === state.exampleIdx);
  });
  requestAnimationFrame(layoutNetworkEdges);
}

function renderNetwork() {
  document.getElementById("demo-title").textContent = "الشبكة — عصبونات كثيرة معاً";
  document.getElementById("demo-desc").textContent =
    "نفس فكرة العصبون الواحد — لكن الآن طبقات متصلة بالكامل.";

  document.getElementById("charts-area").innerHTML = `
    <div class="journey-wrap" id="network-panel">
      ${buildNetworkHtml()}
      <div class="nn-legend">
        <span><i class="leg active-line"></i> إشارة مارة</span>
        <span><i class="leg idle-line"></i> وصلته إشارة لكن خامد</span>
        <span><i class="leg lit-node"></i> عصبون مفعّل</span>
      </div>
      <div id="result-banner" class="hidden"></div>
    </div>
  `;

  document.getElementById("controls-area").innerHTML = `
    <div class="control-group">
      <h3>اختر مثالاً</h3>
      <div class="example-picker" id="example-picker">
        ${BUILTIN_EXAMPLES.map(
          (ex, i) => `
          <button type="button" class="example-card" data-idx="${i}">
            <img src="${ex.thumb}" alt="${ex.name}" />
            <strong>${ex.emoji} ${ex.name}</strong>
          </button>`
        ).join("")}
      </div>
    </div>
    <button class="btn btn-primary" id="btn-play" style="width:100%">▶ ابدأ الرحلة</button>
    <div class="journey-track">
      ${JOURNEY_STEPS.filter((s) => s.phase !== "done")
        .map(
          (s) => `
        <div class="journey-step" data-phase="${s.phase}">
          <span class="journey-dot"></span>
          <span class="journey-label">${s.title}</span>
        </div>`
        )
        .join("")}
    </div>
    <div class="story-card">
      <h3 id="story-title">جاهز؟</h3>
      <p id="story-text">الإشارة تذهب أولاً إلى <strong>كل</strong> العصبونات — ثم يضيء فقط من يلتقط شيئاً في الصورة.</p>
    </div>
    <div class="info-box">
      <strong>الربط:</strong> كل عصبون هنا = نفس الذي فهمته في العرض ١ — الآن مئات منهم يعملون معاً.
    </div>
  `;

  document.getElementById("example-picker").addEventListener("click", (e) => {
    const card = e.target.closest(".example-card");
    if (!card || state.running) return;
    clearTimers();
    state.exampleIdx = parseInt(card.dataset.idx, 10);
    state.phase = "idle";
    syncNetworkUI();
    setPhase("idle");
    document.getElementById("story-title").textContent = "جاهز؟";
    document.getElementById("story-text").innerHTML =
      "الإشارة تذهب أولاً إلى <strong>كل</strong> العصبونات — ثم يضيء فقط من يلتقط شيئاً في الصورة.";
    document.getElementById("btn-play").textContent = "▶ ابدأ الرحلة";
  });

  document.getElementById("btn-play").addEventListener("click", () => {
    if (state.running) return;
    runJourney();
  });

  const graph = document.getElementById("nn-graph");
  if (graph && typeof ResizeObserver !== "undefined") {
    if (state.resizeObs) state.resizeObs.disconnect();
    state.resizeObs = new ResizeObserver(() => {
      if (state.demo === "network") layoutNetworkEdges();
      else layoutSingleEdges();
    });
    state.resizeObs.observe(graph);
  }

  syncNetworkUI();
  setPhase("idle");
  requestAnimationFrame(layoutNetworkEdges);
}

function switchDemo(demo) {
  clearTimers();
  state.demo = demo;
  document.querySelectorAll(".nav-tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.demo === demo);
  });
  document.getElementById("charts-area").innerHTML = "";
  document.getElementById("controls-area").innerHTML = "";
  if (demo === "neuron") renderNeuron();
  else renderNetwork();
}

document.querySelectorAll(".nav-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => switchDemo(btn.dataset.demo));
});

switchDemo("neuron");
