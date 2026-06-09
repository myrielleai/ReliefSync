# ReliefSync — Predictive Disaster Logistics Engine

[![Frontend on Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Backend on Render](https://img.shields.io/badge/Backend-Render-blue?logo=render)](https://render.com)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![ML: scikit-learn](https://img.shields.io/badge/ML-scikit--learn-orange?logo=scikit-learn)](https://scikit-learn.org)

ReliefSync is a **decision-support tool** for disaster relief operations during Philippine typhoons. It uses a Machine Learning model trained on NDRRMC/PAGASA-grounded data to forecast the 72-hour supply demand (water, rice, medical kits) for evacuation centers and generates actionable dispatch manifests for relief officers.

> For a full team guide — including screen-by-screen descriptions, all demo scenarios, judge Q&A scripts, and scope/limitations — see [WALKTHROUGH.md](./WALKTHROUGH.md).

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
3. [Running Locally](#running-locally)
4. [Testing the App](#testing-the-app)
5. [Data Sources](#data-sources)
6. [Tech Stack](#tech-stack)
7. [Scope and Limitations](#scope-and-limitations)

---

## What It Does

ReliefSync answers one specific question for LGU and DSWD relief officers:

> **"How much water, rice, and medicine does this evacuation center need over the next 72 hours — and how much do we need to send from the warehouse right now?"**

The core workflow:

```
Officer selects camp → Clicks "Generate 72-Hour Forecast" → ML model runs
  → Dashboard shows: Alert level + Depletion chart + Packing manifest
    → Officer reads manifest → Opens Warehouse Kanban → Confirms dispatch
```

### Key Features

| Feature | Description |
|---|---|
| Dynamic Alert Status | CRITICAL / WARNING / STABLE computed from (Stock / ML Demand) ratio |
| 72H Depletion Chart | S-Curve SVG chart showing projected stock rundown during typhoon peak |
| Packing Manifest | Coverage bars + exact units to dispatch per supply category |
| ML Insights Modal | Step-by-step math showing how the model computed each number |
| Dataset Transparency | Full disclosure of training data sources (NDRRMC, PAGASA, SPHERE) |
| How to Use Guide | In-app step-by-step guide for relief officers |
| Warehouse Kanban Board | Drag-and-drop loading tracker — To Load → Loading → Loaded |
| Fail-Safe Fallback | If Flask server is offline, JS computes SPHERE-standard estimates automatically |

---

## Architecture

The project has three layers:

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND  (the website the officer uses)                │
│  Files: frontend/portal.html, portal.css, portal.js      │
│  Technology: Plain HTML + CSS + JavaScript               │
│  Hosted on: Vercel (or opened directly in browser)       │
└──────────────────────────┬───────────────────────────────┘
                           │  POST /api/predict
                           │  { camp_id, population,
                           │    pagasa_signal, item_type }
                           ▼
┌──────────────────────────────────────────────────────────┐
│  BACKEND API  (Python server)                            │
│  Files: backend/app.py                                   │
│  Technology: Python 3.12 + Flask + Flask-CORS            │
│  Runs on: http://127.0.0.1:5000 locally, Render in cloud │
└──────────────────────────┬───────────────────────────────┘
                           │  model.predict()
                           ▼
┌──────────────────────────────────────────────────────────┐
│  ML MODEL  (the brain)                                   │
│  Files: model_training/train_model.py                    │
│         model_training/relief_model.pkl                  │
│  Technology: scikit-learn LinearRegression               │
│  Trained on 900 records, saved as relief_model.pkl       │
└──────────────────────────────────────────────────────────┘
```

### File Structure

```
ReliefSync/
│
├── frontend/
│   ├── index.html          Landing / home page
│   ├── portal.html         Main dashboard
│   ├── portal.css          Dashboard styles
│   ├── portal.js           Dashboard logic + ML API calls
│   ├── warehouse.html      Kanban dispatch board
│   ├── warehouse.css / .js
│   └── login.html / .css / .js
│
├── backend/
│   ├── app.py              Flask API — POST /api/predict
│   └── requirements.txt    Python dependencies
│
├── model_training/
│   ├── train_model.py      Trains the Linear Regression model
│   └── relief_model.pkl    Saved trained model (auto-generated)
│
├── WALKTHROUGH.md          Full team guide and demo scenarios
├── README.md               This file
├── render.yaml             Render.com deployment config
└── vercel.json             Vercel routing config
```

---

## Running Locally

> **Requirement:** Python 3.12 — download from [python.org](https://python.org/downloads/)
>
> On Windows, use `py -3.12` instead of `python` to avoid Python version conflicts.

### Step 1 — Clone the Repository

```powershell
git clone https://github.com/myrielleai/ReliefSync.git
cd ReliefSync
```

### Step 2 — Install Python Dependencies (one time only)

```powershell
py -3.12 -m pip install -r backend/requirements.txt
```

Expected output ends with:
```
Successfully installed flask flask-cors scikit-learn pandas numpy joblib
```

### Step 3 — Train the ML Model (one time only)

```powershell
py -3.12 model_training/train_model.py
```

Expected output:
```
============================================================
  ReliefSync ML Engine — Model Training Initializing...
============================================================
  Dataset created: 900 training records
  Model trained successfully!
  R² Score:  0.794
  MAE Score: ~1,216 units
  Model saved to: model_training/relief_model.pkl
============================================================
```

### Step 4 — Start the Flask ML Backend

Open a **new terminal window** and keep it open while using the app:

```powershell
cd backend
py -3.12 app.py
```

Expected output:
```
============================================================
  ReliefSync Flask API Server Starting...
============================================================
  Server running at: http://0.0.0.0:5000
  Health check:     http://0.0.0.0:5000/api/health
  Predict endpoint: POST http://0.0.0.0:5000/api/predict
============================================================
```

### Step 5 — Open the Dashboard

**Option A — Direct file (simplest):**
Double-click `frontend/portal.html`

**Option B — Local HTTP server (recommended):**
```powershell
npx serve frontend
```
Then open: [http://localhost:3000](http://localhost:3000)

---

## Testing the App

### Verify the Backend is Running

```
http://127.0.0.1:5000/api/health
```

Should return:
```json
{ "status": "ReliefSync API is running!", "model_status": "loaded" }
```

### Test the API Directly (PowerShell)

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/predict" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"camp_id":1,"population":1250,"pagasa_signal":4,"item_type":"water"}' | Select-Object -Expand Content
```

Expected response:
```json
{ "recommended_dispatch": 6246, "model_used": "linear_regression", "source": "ml_model" }
```

### Test All Three Alert States

| Step | Select Camp | Expected Alert |
|---|---|---|
| 1 | Brgy. 172 Covered Court | CRITICAL — all coverage bars red |
| 2 | Brgy. 173 Gymnasium | STABLE — all coverage bars green, no dispatch needed |
| 3 | Brgy. 174 Elementary School | WARNING — medium coverage, dispatch within 8h |

### Test the Warehouse Kanban

1. Click **"Load Truck"** on the dashboard
2. Drag all 3 supply cards to "Loaded"
3. Verify the "Dispatch Truck" button only activates after all 3 are loaded
4. Click dispatch — confirm success screen shows waybill

### Test the Fail-Safe

1. Stop the Flask server (close its terminal)
2. Click "Generate 72-Hour Forecast" on any camp
3. App still produces results using SPHERE standard estimates — no error shown

---

## Data Sources

ReliefSync's ML model is trained on **900 synthetic records derived from Philippine-specific disaster parameters**.

| Source | How it is used |
|---|---|
| **NDRRMC** — National Disaster Risk Reduction Management Council | Camp population ranges and supply demand baselines from actual Philippine typhoon operations |
| **PAGASA Signal 1–5** | Storm severity input — each signal level adds 308 units of additional demand |
| **SPHERE Humanitarian Standards (2018)** | Base consumption rates: ~3L water/person/day, ~1 rice pack/person/day, medical for ~15% of evacuees |
| **DSWD Family Food Pack composition** | Rice and supply unit calibration |

> **Transparency note:** This is a hackathon prototype. The training data is synthetic-but-Philippine-grounded. In production, this would use real NDRRMC incident logs and actual LGU stock inventory data. The in-app "View Dataset" modal states this clearly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+) |
| Charts | Custom SVG (zero external libraries) |
| ML Model | scikit-learn — LinearRegression |
| Backend API | Python 3.12, Flask, Flask-CORS |
| Model Serialization | joblib (.pkl file) |
| Frontend Hosting | Vercel |
| Backend Hosting | Render (recommended) or localhost |
| Fonts | Inter + JetBrains Mono (Google Fonts) |

---

## Scope and Limitations

### What the System Does

- Forecasts 72-hour demand for water, rice, and medical kits per evacuation center
- Classifies each camp as CRITICAL, WARNING, or STABLE based on current stock vs. predicted demand
- Provides exact dispatch quantities for the packing manifest
- Tracks dispatch execution via the Warehouse Kanban board
- Explains ML predictions in plain language via the ML Insights modal
- Operates without the ML server (fallback mode) when connectivity is unavailable

### What the System Does Not Do

- **No real-time stock data** — Stock levels are hardcoded per camp, not synced from a live inventory system
- **No real authentication** — Login screen accepts any credentials; no actual security
- **No database** — Dispatch records are not persisted; closing the browser loses session data
- **No multi-user support** — Built for single-user demo, not concurrent officer use
- **Three supply categories only** — Water, rice, medical kits. Blankets, hygiene kits, etc. are not modeled
- **Three camps only** — The demo covers three pre-configured Caloocan City camps
- **Typhoon events only** — PAGASA Signal input is typhoon-specific; earthquakes and floods are not modeled
- **Synthetic training data** — The ML model is not validated against real NDRRMC historical incident records

### What a Production Version Would Need

1. Real data pipeline from NDRRMC SitRep databases and LGU stock systems
2. Real-time stock sync via barcode scanning or digital inventory updates at camps
3. Multi-user access with role-based permissions (camp managers, district coordinators, DSWD)
4. Road condition integration to compute actual dispatch windows
5. More supply categories and multi-event support
6. Retraining on validated NDRRMC historical data before operational use

---

## Team

Built for a hackathon by Team ReliefSync — Caloocan City, NCR, June 2026.

- Frontend design and HTML/CSS system
- ML backend integration and API engineering

---

*ReliefSync is a hackathon prototype. Not validated for live emergency operations.*
