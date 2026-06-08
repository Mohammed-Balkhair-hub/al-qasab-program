# 📚 QASAB AI Program — Stage 2

**Live site (GitHub Pages):**  
https://mohammed-balkhair-hub.github.io/al-qasab-program/

---

## 📋 Table of contents

- [Interactive pages](#-interactive-pages)
- [Course days & materials](#-course-days--materials)
- [Run locally](#-run-locally)
- [Brand colors](#-brand-colors)

---

## 🔗 Interactive pages

| Page | Title | Live link (GitHub Pages) | Repo file |
|------|-------|--------------------------|-----------|
| 🏠 **Hub** | Program home — pick a day | [Open hub](https://mohammed-balkhair-hub.github.io/al-qasab-program/) | [`web/index.html`](web/index.html) |
| 📐 **Day 1** | Pattern Engineering | [Open Day 1](https://mohammed-balkhair-hub.github.io/al-qasab-program/day-1.html) | [`web/day-1.html`](web/day-1.html) |
| 🧠 **Day 2** | Built on Our Images | [Open Day 2](https://mohammed-balkhair-hub.github.io/al-qasab-program/day-2.html) | [`web/day-2.html`](web/day-2.html) |

### Day 1 demos — *Pattern Engineering*

| Tab | What students see |
|-----|-------------------|
| **1 — Pixels & features** | Upload two labeled images → 32×32 pixel grid → animated feature extraction |
| **2 — Weight tuning** | 2D scatter plot with decision boundary — adjust weights until classes separate |

### Day 2 demos — *Built on Our Images*

| Tab | What students see |
|-----|-------------------|
| **1 — Single neuron** | One neuron receives input, checks a match, fires or passes |
| **2 — Full network** | Connected layers, broadcast activation, animated signal flow through the network |

---

## 📚 Course days & materials

Slide decks (PDF + PPTX) live beside the web app. **Day 3 has slides only** — no interactive page in this release.

| Day | Topic (Arabic) | Interactive web | PDF slides |
|-----|----------------|-----------------|------------|
| **1** | Pattern Engineering | ✅ 2 demos | PDF & PPTX in [`Day-1/`](Day-1/) |
| **2** | Built on Our Images (مبني على صورتنا) | ✅ 2 demos | PDF & PPTX in [`Day-2/`](Day-2/) |
| **3** | Where AI Falls Short (حيث يقصر الذكاء الاصطناعي) | — slides only | PDF & PPTX in [`Day-3/`](Day-3/) |

> PDF filenames use Arabic characters. Open them from the `Day-1/`, `Day-2/`, and `Day-3/` folders in your file browser or IDE.

---

## 🚀 Run locally

You need any static file server pointed at the `web/` folder.

### Option A — `npx serve` (recommended)

```bash
cd web
npx serve .
```

Open **http://localhost:3000** (port may vary — check the terminal output).

### Option B — Python built-in server

```bash
cd web
python3 -m http.server 8080
```

Open **http://localhost:8080**

### Classroom display

Press **F11** in the browser for fullscreen while teaching.

---

## 🎨 Brand colors

| Role | Hex | Preview |
|------|-----|---------|
| White | `#FFFFFF` | Background |
| QASAB Blue | `#1B6CA8` | Primary actions, headings |
| QASAB Orange | `#F58220` | Accents, secondary highlights |

Typography: **Noto Sans Arabic** (loaded from Google Fonts).

---

**QASAB AI Program · Stage 2 · برنامج القصب — المرحلة الثانية**
