"""
ReliefSync — Standalone ML Retrain Test Script
===============================================
Run this file directly to test the retraining pipeline outside of the web UI.

Usage:
    py -3.12 model_training/test_retrain.py

What it does:
    1. Loads the existing backend/dataset.csv
    2. Optionally appends new synthetic data rows to simulate fresh data
    3. Trains a new LinearRegression model
    4. Evaluates it (R² Score, MAE)
    5. Saves the new model as model_training/relief_model.pkl
    6. Prints a detailed comparison of before-vs-after metrics
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
import joblib

# ─── PATH CONFIGURATION ──────────────────────────────────────────────────────
# Allow running from either the project root or model_training directory
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

DATASET_PATH = os.path.join(PROJECT_ROOT, "backend", "dataset.csv")
MODEL_PATH   = os.path.join(SCRIPT_DIR, "relief_model.pkl")

# ─── HELPER: PRINT WITH BOX ──────────────────────────────────────────────────
def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ─── STEP 1: LOAD EXISTING DATASET ───────────────────────────────────────────
section("STEP 1: Loading Dataset")

if not os.path.exists(DATASET_PATH):
    print(f"[ERROR] Dataset not found at: {DATASET_PATH}")
    print("Make sure backend/dataset.csv exists. Run train_model.py first.")
    sys.exit(1)

df = pd.read_csv(DATASET_PATH)
print(f"  ✅ Loaded {len(df):,} records from dataset.csv")
print(f"  Columns: {list(df.columns)}")
print(f"\n  Sample rows:")
print(df.head(5).to_string(index=False))

# ─── STEP 2: (OPTIONAL) APPEND SYNTHETIC NEW DATA ────────────────────────────
section("STEP 2: Appending Synthetic Test Data")

ADD_SYNTHETIC = True  # Set to False to skip this step

if ADD_SYNTHETIC:
    # Simulate 60 new records: high-signal storms with large populations
    np.random.seed(42)
    new_records = []
    for _ in range(60):
        camp_id            = np.random.randint(1, 4)
        supply_category_id = np.random.randint(1, 4)
        current_population = np.random.randint(500, 3000)
        pagasa_signal      = np.random.randint(3, 6)  # Signal 3-5 bias
        base_rate          = {1: 2.5, 2: 0.8, 3: 0.12}.get(supply_category_id, 2.0)
        noise              = np.random.normal(0, 0.15)
        units_consumed     = int(current_population * (base_rate + noise) * (1 + pagasa_signal * 0.05))
        units_consumed     = max(0, units_consumed)
        new_records.append({
            "camp_id":            camp_id,
            "supply_category_id": supply_category_id,
            "current_population": current_population,
            "pagasa_signal":      pagasa_signal,
            "units_consumed":     units_consumed
        })

    new_df = pd.DataFrame(new_records)
    df = pd.concat([df, new_df], ignore_index=True)
    print(f"  ✅ Appended {len(new_records)} synthetic records")
    print(f"  New total: {len(df):,} records")
else:
    print("  ⏭  Skipping synthetic data (ADD_SYNTHETIC = False)")

# ─── STEP 3: PREPARE FEATURES ────────────────────────────────────────────────
section("STEP 3: Preparing Features")

FEATURES = ["camp_id", "supply_category_id", "current_population", "pagasa_signal"]
TARGET   = "units_consumed"

missing = [col for col in FEATURES + [TARGET] if col not in df.columns]
if missing:
    print(f"[ERROR] Missing columns: {missing}")
    sys.exit(1)

X = df[FEATURES]
y = df[TARGET]

print(f"  Features: {FEATURES}")
print(f"  Target:   {TARGET}")
print(f"  Rows used for training: {len(X):,}")

# ─── STEP 4: TRAIN/TEST SPLIT ─────────────────────────────────────────────────
section("STEP 4: Train / Test Split (80/20)")

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"  Training samples: {len(X_train):,}")
print(f"  Testing  samples: {len(X_test):,}")

# ─── STEP 5: TRAIN MODEL ─────────────────────────────────────────────────────
section("STEP 5: Training LinearRegression Model")

model = LinearRegression()
model.fit(X_train, y_train)
print("  ✅ Model training complete.")

coef_info = dict(zip(FEATURES, model.coef_))
print(f"\n  Learned Coefficients:")
for feat, coef in coef_info.items():
    print(f"    {feat:<25}: {coef:+.4f}")
print(f"    {'intercept':<25}: {model.intercept_:+.4f}")

# ─── STEP 6: EVALUATE ─────────────────────────────────────────────────────────
section("STEP 6: Model Evaluation")

y_pred = model.predict(X_test)
r2  = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)

print(f"  R² Score (Accuracy):       {r2 * 100:.2f}%")
print(f"  MAE (Avg Error per Unit):  {mae:.1f} units")

if r2 >= 0.75:
    print(f"\n  ✅ Model quality: GOOD (R² ≥ 75%)")
elif r2 >= 0.50:
    print(f"\n  ⚠️  Model quality: MODERATE (R² 50–75%)")
else:
    print(f"\n  ❌ Model quality: POOR (R² < 50%) — Consider more data")

# ─── STEP 7: SAMPLE PREDICTIONS ───────────────────────────────────────────────
section("STEP 7: Sample Predictions")

test_cases = [
    {"camp_id": 1, "supply_category_id": 1, "current_population": 1250, "pagasa_signal": 4},
    {"camp_id": 2, "supply_category_id": 3, "current_population": 850,  "pagasa_signal": 3},
    {"camp_id": 3, "supply_category_id": 2, "current_population": 1900, "pagasa_signal": 5},
]
label_map = {1: "Water", 2: "Rice", 3: "Medical"}

for tc in test_cases:
    pred_df = pd.DataFrame([tc])
    pred    = int(model.predict(pred_df)[0])
    print(f"  Camp {tc['camp_id']} | {label_map[tc['supply_category_id']]:<8} | Pop {tc['current_population']:,} | Signal {tc['pagasa_signal']} → Predicted demand: {pred:,} units")

# ─── STEP 8: SAVE MODEL ───────────────────────────────────────────────────────
section("STEP 8: Saving Model")

joblib.dump(model, MODEL_PATH)
print(f"  ✅ Model saved to: {MODEL_PATH}")
print(f"  The Flask API will now use this model for live predictions.")

section("RETRAIN TEST COMPLETE")
print(f"  R²:  {r2 * 100:.2f}%    MAE: {mae:.1f} units")
print(f"  Model file: {MODEL_PATH}")
print()
