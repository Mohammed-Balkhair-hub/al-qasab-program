/** Day 2 — examples, layer labels, edge topology */

import { GRID, computeFeatures } from "./image-utils.js";

function downsampleCanvas(sourceCanvas) {
  const tmp = document.createElement("canvas");
  tmp.width = GRID;
  tmp.height = GRID;
  const tctx = tmp.getContext("2d");
  tctx.fillStyle = "#E8F4FC";
  tctx.fillRect(0, 0, GRID, GRID);
  const scale = Math.min(GRID / sourceCanvas.width, GRID / sourceCanvas.height);
  tctx.drawImage(
    sourceCanvas,
    (GRID - sourceCanvas.width * scale) / 2,
    (GRID - sourceCanvas.height * scale) / 2,
    sourceCanvas.width * scale,
    sourceCanvas.height * scale
  );
  return tctx.getImageData(0, 0, GRID, GRID).data;
}

function makeExample(drawFn, meta) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#E8F4FC";
  ctx.fillRect(0, 0, 160, 160);
  drawFn(ctx, 160);
  const pixelData = downsampleCanvas(canvas);
  return {
    ...meta,
    canvas,
    pixelData,
    features: computeFeatures(pixelData),
    thumb: canvas.toDataURL("image/png"),
  };
}

function drawStar(ctx, s) {
  const cx = s / 2;
  const cy = s / 2;
  const outer = s * 0.38;
  const inner = outer * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#F5A623";
  ctx.fill();
  ctx.strokeStyle = "#D35400";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCircle(ctx, s) {
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "#5BA4D9";
  ctx.fill();
  ctx.strokeStyle = "#1B6CA8";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawRectangle(ctx, s) {
  const w = s * 0.62;
  const h = s * 0.22;
  const x = (s - w) / 2;
  const y = (s - h) / 2;
  ctx.fillStyle = "#2C3E50";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#1A2B3C";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

export const INPUT_ID = "in";

export const HIDDEN_L1 = [
  { id: "l1a", icon: "📐", label: "حواف وخطوط" },
  { id: "l1b", icon: "💡", label: "فاتح وداكن" },
  { id: "l1c", icon: "⚡", label: "زوايا حادة" },
  { id: "l1d", icon: "〰️", label: "منحنيات ناعمة" },
];

export const HIDDEN_L2 = [
  { id: "l2a", icon: "✦", label: "أشكال مدبّبة" },
  { id: "l2b", icon: "↔", label: "أشكال ممتدة" },
  { id: "l2c", icon: "⭕", label: "أشكال دائرية" },
];

export const OUTPUTS = [
  { id: "out-star", icon: "⭐", label: "نجمة" },
  { id: "out-rect", icon: "▬", label: "مستطيل" },
  { id: "out-circle", icon: "🔵", label: "دائرة" },
];

/** Every edge in the feedforward net — all exist, only some carry signal per example */
export function buildAllEdges() {
  const edges = [];
  HIDDEN_L1.forEach((a) => edges.push({ from: INPUT_ID, to: a.id }));
  HIDDEN_L1.forEach((a) => {
    HIDDEN_L2.forEach((b) => edges.push({ from: a.id, to: b.id }));
  });
  HIDDEN_L2.forEach((a) => {
    OUTPUTS.forEach((b) => edges.push({ from: a.id, to: b.id }));
  });
  return edges;
}

export const ALL_EDGES = buildAllEdges();

export function edgeKey(from, to) {
  return `${from}→${to}`;
}

/** Which edges actually carry signal for this example */
export function signalEdges(story) {
  const set = new Set();
  story.l1.forEach((id) => set.add(edgeKey(INPUT_ID, id)));
  story.l1.forEach((a) => {
    story.l2.forEach((b) => set.add(edgeKey(a, b)));
  });
  story.l2.forEach((a) => set.add(edgeKey(a, story.output)));
  return set;
}

export const JOURNEY_STEPS = [
  {
    phase: "input",
    title: "الصورة تدخل",
    text: "الإشارة تُرسل إلى <strong>كل</strong> عصبونات الطبقة الأولى — الجميع يستقبل نفس المدخل.",
  },
  {
    phase: "layer1",
    title: "الطبقة الأولى تستجيب",
    text: "الخطوط كلها ومضة للحظة — لكن فقط العصبون الذي يلتقط «خاصية» في الصورة <strong>يضيء</strong> ويمرّر؛ الباقي يبقى خامداً.",
  },
  {
    phase: "layer2",
    title: "الطبقة الثانية تجمع",
    text: "من انطلق قبلها يرسل إلى الجميع في الطبقة التالية — ثم يضيء فقط من يرى معنى أعمق (مدبّب، ممتد، دائري).",
  },
  {
    phase: "output",
    title: "القرار",
    text: "نفس الفكرة: إشارة إلى كل خرج — واحد فقط ينجح ويختار التصنيف.",
  },
  {
    phase: "done",
    title: "اكتملت الرحلة",
    text: "",
  },
];

export const BUILTIN_EXAMPLES = [
  makeExample(drawStar, {
    id: "star",
    name: "نجمة",
    emoji: "⭐",
    story: {
      l1: ["l1a", "l1c", "l1b"],
      l2: ["l2a"],
      output: "out-star",
      insight: "أولاً: الإشارة إلى الجميع. ثم: يضيء فقط من يلتقط — خطوط برتقالية = مسار ناجح، رمادي = وصلته إشارة لكنه لم ينشط.",
    },
  }),
  makeExample(drawCircle, {
    id: "circle",
    name: "دائرة",
    emoji: "🔵",
    story: {
      l1: ["l1d", "l1b"],
      l2: ["l2c"],
      output: "out-circle",
      insight: "عصبون «زوايا حادة» متصل لكنه خامد — الدائرة لا تفعّله. هذا شكل شبكة حقيقية.",
    },
  }),
  makeExample(drawRectangle, {
    id: "rect",
    name: "مستطيل",
    emoji: "▬",
    story: {
      l1: ["l1a", "l1b"],
      l2: ["l2b"],
      output: "out-rect",
      insight: "مسارات قليلة فقط تنير — باقي الوصلات موجودة لكن الإشارة لا تعبرها.",
    },
  }),
];

export function neuronById(list, id) {
  return list.find((n) => n.id === id);
}

export function neuronDetectsImage(neuronId, example) {
  return example.story.l1.includes(neuronId);
}

export const NEURON_STEPS = [
  {
    phase: "receive",
    title: "١ — يستقبل الإشارة",
    text: "المدخل (الصورة) يرسل إشارة إلى العصبون — <strong>دائماً</strong>، حتى لو لم ينشط بعد.",
  },
  {
    phase: "check",
    title: "٢ — يتفحّص",
    text: "العصبون «مدرّب» على التقاط شيء معيّن — حافة، منحنى، سطوع… هل يراه في هذه الصورة؟",
  },
  {
    phase: "fire",
    title: "٣ — ينشط أو يصمت",
    text: "إن وجد ما يبحث عنه → <strong>يضيء</strong> ويمرّر الإشارة للأمام. وإلا → يبقى خامداً ولا يمرّر شيئاً مفيداً.",
  },
];

/** Quick presets for classroom */
export const NEURON_PRESETS = {
  yes: { neuronId: "l1a", exampleIdx: 0, label: "نجمة → حواف ✓" },
  no: { neuronId: "l1c", exampleIdx: 1, label: "دائرة → زوايا ✗" },
};
