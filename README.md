# ReliefSync — Predictive Disaster Logistics Engine

[![Frontend on Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Backend on Render](https://img.shields.io/badge/Backend-Render-blue?logo=render)](https://render.com)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![ML: scikit-learn](https://img.shields.io/badge/ML-scikit--learn-orange?logo=scikit-learn)](https://scikit-learn.org)

ReliefSync is a **predictive disaster logistics engine** built for Philippine typhoon response. It uses a Machine Learning model trained on NDRRMC/PAGASA-grounded data to forecast the 72-hour supply demand (water, rice, medical kits) for evacuation centers, and generates actionable dispatch manifests for relief officers.

---

## Table of Contents

1. [Project Overview](#-project-overview)
2. [Features](#-features)
3. [Architecture](#-architecture)
4. [Running Locally (Step-by-Step)](#-running-locally)
5. [Testing the App](#-testing-the-app)
6. [Deploying to Vercel (Frontend)](#️-deploying-to-vercel-frontend-only)
7. [Deploying the Backend to Render](#-deploying-the-ml-backend-to-render)
8. [Vercel vs Render — Which to Use?](#-vercel-vs-render--which-to-use)
9. [Data Sources](#-data-sources)
10. [Tech Stack](#-tech-stack)

---

## Project Overview

ReliefSync simulates a real-world DSWD/LGU logistics coordination scenario during **Super Typhoon "Amihan"**. A relief officer can:

1. Select an evacuation center (3 camps: CRITICAL, WARNING, STABLE)
2. Click **Generate 72-Hour Forecast** to get ML-powered supply predictions
3. Read the depletion chart and packing manifest to decide what to dispatch
4. Execute the dispatch via the interactive Warehouse Kanban board

The ML backend is a **Linear Regression model** trained on 900 synthetic records based on Philippine NDRRMC disaster response parameters and PAGASA Signal 1–5 classifications.

---

## Features

| Feature | Description |
|---|---|
| **Dynamic Alert Status** | CRITICAL / WARNING / STABLE computed from (Stock ÷ ML Demand) ratio |
| **72H Depletion Chart** | S-Curve SVG chart showing stock rundown during peak typhoon hours |
| **Packing Manifest** | Coverage bars + exact units to dispatch per supply category |
| **ML Insights Modal** | Step-by-step math breakdown of how the model computed each number |
| **Dataset Transparency** | Full disclosure of training data sources (NDRRMC, PAGASA, SPHERE) |
| **How to Use Guide** | 7-step in-app guide for relief officers |
| **Warehouse Kanban Board** | Drag-and-drop loading tracker (To Load → In Progress → Loaded) |
| **Fail-Safe Fallback** | If Flask server is offline, JS computes SPHERE-standard estimates automatically |

---

## Architecture

```
ReliefSync/
│
├── frontend/                  ← Static HTML/CSS/JS (hosted on Vercel)
│   ├── index.html             Landing page
│   ├── style.css
│   ├── portal.html            Main dashboard
│   ├── portal.css
│   ├── portal.js              Calls ML backend via fetch()
│   ├── warehouse.html         Kanban dispatch board
│   ├── warehouse.css
│   ├── warehouse.js
│   ├── login.html / .css / .js
│   └── ...
│
├── backend/                   ← Python Flask ML server (hosted on Render)
│   ├── app.py                 Flask API — POST /api/predict
│   └── requirements.txt       Python dependencies
│
└── model_training/            ← ML training scripts (run once, locally)
    ├── train_model.py         Trains the Linear Regression model
    └── relief_model.pkl       Trained model file (auto-generated)
```

**Data flow:**
```
Browser (portal.js)
    → POST /api/predict { camp_id, population, pagasa_signal, item_type }
    → Flask (app.py) → LinearRegression model (relief_model.pkl)
    → { recommended_dispatch: N }
    → Rendered in manifest table + chart
```

---

## Running Locally

> **Requirement:** Python 3.12 installed. Get it from [python.org](https://python.org/downloads/).
>
> ⚠️ On this machine, always use `py -3.12` instead of `python` to avoid MSYS2 Python conflicts.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/myrielleai/ReliefSync.git
cd ReliefSync
```

### Step 2 — Install Python Dependencies (one time only)

```powershell
py -3.12 -m pip install -r backend/requirements.txt
```

Expected output:
```
Successfully installed flask flask-cors scikit-learn pandas numpy joblib
```

### Step 3 — Train the ML Model (one time only)

```powershell
py -3.12 model_training/train_model.py
```

Expected output:
```
Dataset created: 900 training records
Model training complete!
R² Score: 0.794
Model saved to: model_training/relief_model.pkl
```

### Step 4 — Start the Flask ML Backend

Open a **new terminal window** and run:

```powershell
cd backend
py -3.12 app.py
```

Expected output:
```
ML Model loaded successfully
ReliefSync Flask API Server Starting...
Server running at: http://127.0.0.1:5000
Health check:     http://127.0.0.1:5000/api/health
```

> Keep this terminal window open while using the app.

### Step 5 — Open the Frontend

**Option A: Direct browser open (simplest)**
```
Double-click: frontend/portal.html
```

**Option B: Local HTTP server (recommended — avoids CORS issues)**
```powershell
npx serve frontend
```
Then open: [http://localhost:3000](http://localhost:3000)

---

## Testing the App

### Verify the Backend is Running

Open this URL in your browser while the Flask server is running:
```
http://127.0.0.1:5000/api/health
```
You should see:
```json
{ "status": "healthy", "model": "loaded", "server": "ReliefSync Flask API" }
```

### Test the Prediction API Directly (PowerShell)

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/predict" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"camp_id":1,"population":1250,"pagasa_signal":4,"item_type":"water"}' | Select-Object -Expand Content
```

Expected response:
```json
{ "recommended_dispatch": 4737, "model_used": "linear_regression", "source": "ml_model" }
```

### Test All Three Alert States (Dashboard)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Select **Brgy. 172 Covered Court**, click Generate | 🔴 **CRITICAL** — coverage bars all red, large dispatch numbers |
| 2 | Select **Brgy. 173 Gymnasium**, click Generate | 🟢 **STABLE** — coverage bars green, dispatch shows "✓ Sufficient" |
| 3 | Select **Brgy. 174 Elementary School**, click Generate | 🟡 **WARNING** — mixed coverage, moderate dispatch numbers |

### Test ML Insights Modal

1. Generate a forecast for any camp
2. Click **🧠 ML Insights** button
3. Verify the modal opens and shows: Base Need, PAGASA Signal Surge, and final predicted total

### Test the Warehouse Kanban

1. Click **🚚 Load Truck ↗** (opens warehouse.html)
2. Drag all 3 cards (Water, Rice, Medical) from **To Load** → **Loading** → **Loaded**
3. Verify the **Dispatch Truck** button activates only when all 3 are in the Loaded column
4. Click dispatch to see the success/waybill screen

### Test the Fail-Safe (Backend Offline)

1. Stop the Flask server (close its terminal window)
2. Open the dashboard and click Generate Forecast
3. The app should still work using fallback SPHERE estimates (no error shown)

---

## Deploying to Vercel (Frontend Only)

Vercel is a **static hosting platform** — it can only serve HTML, CSS, and JavaScript files. It **cannot** run Python or Flask.

**What Vercel hosts:** the `frontend/` folder (the dashboard UI)  
**What Vercel cannot host:** `backend/app.py` (Python Flask server)

### Vercel Setup (already configured)

The `vercel.json` at the root handles routing automatically. Your Vercel project should be configured as:

| Setting | Value |
|---|---|
| Framework Preset | `Other` |
| Root Directory | `./` (default) |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |

> The frontend already works on Vercel **without the backend** — it uses the built-in SPHERE fallback calculations automatically when Flask is unreachable.

---

## Deploying the ML Backend to Render

**Render** is the recommended platform for the Flask backend because it natively runs Python web servers for free.

### Step 1 — Create a Render Account

Go to [render.com](https://render.com) and sign up (free tier is sufficient).

### Step 2 — Create a New Web Service

1. Click **New → Web Service**
2. Connect your **GitHub repository** (`myrielleai/ReliefSync`)
3. Configure the service:

| Setting | Value |
|---|---|
| Name | `reliefsync-backend` |
| Region | `Southeast Asia (Singapore)` (lowest latency from PH) |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt && cd .. && py -3.12 model_training/train_model.py` |
| Start Command | `python app.py` |
| Instance Type | `Free` |

> **Note:** On Render, Python commands use `python` not `py -3.12`. The `py` launcher is Windows-only.

### Step 3 — Add the Model Training to Build

Since `relief_model.pkl` is in `.gitignore`, Render won't have it. Update the **Build Command** to train the model during deployment:

```bash
pip install -r requirements.txt && python ../model_training/train_model.py
```

Or add this to `backend/requirements.txt` and create a `render-build.sh` script.

### Step 4 — Update Frontend to Point to Render URL

Once deployed, Render gives you a URL like: `https://reliefsync-backend.onrender.com`

Update this line in [`frontend/portal.js`](frontend/portal.js):

```js
// Change this:
const ML_API_BASE_URL = "http://127.0.0.1:5000";

// To your Render URL:
const ML_API_BASE_URL = "https://reliefsync-backend.onrender.com";
```

Then commit and push — Vercel will automatically redeploy the frontend.

---

## Vercel vs Render — Which to Use?

| | Vercel | Render |
|---|---|---|
| **What it runs** | Static HTML/CSS/JS only | Python, Node, Go, Ruby, Docker |
| **Flask/Python** | ❌ Not supported | ✅ Yes |
| **Free tier** | ✅ Unlimited static hosting | ✅ 750 hours/month (always-on for 1 service) |
| **Cold start** | Instant | ~30 seconds (free tier spins down after 15 min inactivity) |
| **Custom domain** | ✅ Easy | ✅ Easy |
| **Best for** | Frontend dashboard | ML Flask API |

### ✅ Recommended Setup for This Project

```
┌─────────────────────────────────────────────────────┐
│  Frontend (portal.html, portal.css, portal.js)      │
│  → Hosted on VERCEL (free, instant, global CDN)     │
│  → URL: https://reliefsync.vercel.app               │
└────────────────────┬────────────────────────────────┘
                     │ POST /api/predict
                     ▼
┌─────────────────────────────────────────────────────┐
│  ML Backend (app.py + relief_model.pkl)             │
│  → Hosted on RENDER (free Python hosting)           │
│  → URL: https://reliefsync-backend.onrender.com     │
└─────────────────────────────────────────────────────┘
```

> **For the hackathon demo:** Running the Flask server **locally** (Step 4 above) is the most reliable approach. Render's free tier has a 30-second cold start that may slow down your first prediction during a live demo.

---

## Data Sources

ReliefSync's ML model is trained on **900 synthetic records derived from Philippine-specific disaster parameters**, not generic worldwide data.

| Source | How it's used |
|---|---|
| **NDRRMC** — National Disaster Risk Reduction Management Council | Camp population ranges, supply demand baselines from actual typhoon operations |
| **PAGASA Signal 1–5** | Storm severity input (replaces generic weather severity) |
| **SPHERE Humanitarian Standards (2018)** | Base consumption rates: 15L water/person/day, 400g rice/person/day, 5% medical kit coverage |
| **DSWD Family Food Pack composition** | Rice and supply unit calibration |

> **Transparency note:** This is a hackathon prototype. The training data is synthetic-but-Philippine-grounded. In production, this would use real NDRRMC incident logs and actual LGU stock inventory data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+) |
| Charts | Custom SVG (no external chart library) |
| ML Model | scikit-learn LinearRegression |
| Backend API | Python 3.12 + Flask + Flask-CORS |
| Model Serialization | joblib |
| Frontend Hosting | Vercel |
| Backend Hosting | Render (recommended) or localhost |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## Team

Built for a hackathon by Team ReliefSync.
- Frontend design & HTML/CSS system
- ML backend integration & API engineering

---

*ReliefSync is a prototype built for demonstration purposes. Not intended for production disaster response operations without formal validation.*
