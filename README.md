# 🎓 QASAB AI Program — Stage 2

> Interactive Arabic (RTL) classroom demos for **Stage 2, Days 1–2**  
> Static web app · HTML · CSS · JavaScript · Plotly.js · no backend required

**Live site (after GitHub Pages deploy):**  
`https://YOUR_USERNAME.github.io/YOUR_REPO/`  
Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub account and repository name.

---

## 📋 Table of contents

- [Overview](#-overview)
- [Interactive pages](#-interactive-pages)
- [Course days & materials](#-course-days--materials)
- [Run locally](#-run-locally)
- [Deploy to GitHub Pages](#-deploy-to-github-pages)
- [Project structure](#-project-structure)
- [Brand colors](#-brand-colors)
- [Classroom tips](#-classroom-tips)

---

## 🌟 Overview

This repository contains classroom-ready demos for the **QASAB (القصب) AI Program — Stage 2**. The app is built for **1280×720 fullscreen projection** with native RTL layout and no scrollbars during demos.

| | |
|---|---|
| **Language** | Arabic UI (RTL) |
| **Stack** | Static HTML / CSS / ES modules |
| **Charts** | Plotly.js (Day 1 only) |
| **Deploy target** | GitHub Pages (`web/` folder) |
| **Dependencies** | None for production — only a local static server for development |

---

## 🔗 Interactive pages

After publishing, your live URLs will look like this:

| Page | Title | Live link (GitHub Pages) | Repo file |
|------|-------|--------------------------|-----------|
| 🏠 **Hub** | Program home — pick a day | `https://YOUR_USERNAME.github.io/YOUR_REPO/` | [`web/index.html`](web/index.html) |
| 📐 **Day 1** | Pattern Engineering | `https://YOUR_USERNAME.github.io/YOUR_REPO/day-1.html` | [`web/day-1.html`](web/day-1.html) |
| 🧠 **Day 2** | Built on Our Images | `https://YOUR_USERNAME.github.io/YOUR_REPO/day-2.html` | [`web/day-2.html`](web/day-2.html) |

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

## ☁️ Deploy to GitHub Pages

1. Create a new repository on GitHub and push this project.
2. In the repo go to **Settings → Pages → Build and deployment**.
3. Set **Source** to **GitHub Actions** (not “Deploy from a branch”).
4. Push to `main` or `master` — the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the `web/` folder automatically.
5. Your site will be live at:

   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO/
   ```

No build step, API keys, or server-side code are required.

---

## 📁 Project structure

```
stage-2/
├── web/                         # 🌐 Static app — deployed to GitHub Pages
│   ├── index.html               # Hub (Days 1 & 2)
│   ├── day-1.html               # Day 1 interactive demos
│   ├── day-2.html               # Day 2 interactive demos
│   ├── css/qasab.css            # QASAB theme, RTL layout, hub background
│   └── js/
│       ├── day1.js              # Pixels, features, weight tuning
│       ├── day2.js              # Neuron + network animations
│       ├── day2-examples.js     # Preset neuron/network examples
│       ├── plots.js             # Plotly charts (Day 1)
│       ├── image-utils.js       # Image → pixel grid helpers
│       └── theme.js             # Colors & chart defaults
├── Day-1/ … Day-3/              # 📄 Course slide PDFs & assets
├── AI_Program_Stage2.xlsx       # Curriculum spreadsheet
├── .github/workflows/deploy.yml # GitHub Pages CI
└── README.md
```

Folders not tracked in Git: `ignore/` (local only), `.venv/` (optional local Python env).

---

## 🎨 Brand colors

| Role | Hex | Preview |
|------|-----|---------|
| White | `#FFFFFF` | Background |
| QASAB Blue | `#1B6CA8` | Primary actions, headings |
| QASAB Orange | `#F58220` | Accents, secondary highlights |

Typography: **Noto Sans Arabic** (loaded from Google Fonts).

---

## 💡 Classroom tips

- Start from the **hub** ([`web/index.html`](web/index.html)) and pick the day card.
- Day 1 works best with two contrasting images (e.g. bright vs. dark, round vs. elongated).
- Day 2 tab 1 explains one neuron before tab 2 shows the full connected network.
- Remaining lesson content is in the PDF slides inside each `Day-*` folder.

---

**QASAB AI Program · Stage 2 · برنامج القصب — المرحلة الثانية**
