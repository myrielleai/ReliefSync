"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              ReliefSync — Machine Learning Training Script                   ║
║              File: model_training/train_model.py                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PURPOSE: This script trains a Linear Regression model on disaster           ║
║  relief data, then saves the trained model to disk as a .pkl file.           ║
║  Supports programmatic retraining on custom datasets via the backend.       ║
║                                                                              ║
║  HOW TO RUN STANDALONE:                                                      ║
║    cd model_training                                                         ║
║    py -3.12 train_model.py                                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os
import sys

# Force UTF-8 encoding for standard output to support clean console logs
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass


def generate_synthetic_data(num_records=900):
    """
    Generates synthetic but Philippine-grounded disaster relief data.
    Based on PAGASA signals, shelter populations, and SPHERE humanitarian standards.
    """
    import math
    import random
    raw_data = []

    for i in range(num_records):
        # Which camp are we simulating? (1, 2, or 3, cycling through)
        camp_id = (i % 3) + 1

        # Which supply type? (1=Water, 2=Rice, 3=Medicine, cycling through)
        supply_category_id = (i % 3) + 1

        # Population varies between 300 (small camp) and 3000 (large camp)
        population_base = 1500
        population_fluctuation = math.sin(i * 0.15) * 1000
        population = int(population_base + population_fluctuation + (camp_id * 150))
        population = max(300, min(3000, population))  # Clamp to realistic range

        # PAGASA Signal: 1-5 scale (Signal No. 1 to Signal No. 5).
        pagasa_signal = int(max(1, min(5, round(3 + 2 * math.sin(i * 0.08)))))

        # Compute units_consumed based on domain formulas
        if supply_category_id == 1:   # Water
            units_consumed = population * 3.0 * (1 + pagasa_signal * 0.15)
        elif supply_category_id == 2: # Rice
            units_consumed = population * 1.0 * (1 + pagasa_signal * 0.05)
        else:                          # Medicine (supply_category_id == 3)
            units_consumed = population * 0.15 * (1 + pagasa_signal * 0.25)

        # Add ±10% random variation (noise)
        random.seed(i * 42)  # Fixed seed per record so results are reproducible
        noise = random.uniform(-0.10, 0.10)
        units_consumed = int(units_consumed * (1 + noise))
        units_consumed = max(0, units_consumed)  # Can't have negative supply needed

        # Append this record
        raw_data.append({
            "camp_id": camp_id,
            "supply_category_id": supply_category_id,
            "current_population": population,
            "pagasa_signal": pagasa_signal,
            "units_consumed": units_consumed
        })

    return pd.DataFrame(raw_data)


def train_and_evaluate(dataset_path=None, pkl_output_path=None):
    """
    Loads a dataset (or generates it if missing), trains a Linear Regression model,
    saves the model as a pickle file, and returns performance metrics.
    """
    if dataset_path is None:
        dataset_path = os.path.join(os.path.dirname(__file__), "..", "backend", "dataset.csv")
    if pkl_output_path is None:
        pkl_output_path = os.path.join(os.path.dirname(__file__), "relief_model.pkl")

    dataset_path = os.path.abspath(dataset_path)
    pkl_output_path = os.path.abspath(pkl_output_path)

    # 1. LOAD OR GENERATE DATASET
    if os.path.exists(dataset_path):
        print(f"📊 Loading dataset from file: {dataset_path}")
        df = pd.read_csv(dataset_path)
    else:
        print(f"✨ Dataset file not found. Generating default synthetic dataset at: {dataset_path}")
        df = generate_synthetic_data(900)
        # Ensure directories exist
        os.makedirs(os.path.dirname(dataset_path), exist_ok=True)
        df.to_csv(dataset_path, index=False)
        print("✅ Default dataset.csv generated successfully.")

    # Validate columns
    required_cols = ["camp_id", "supply_category_id", "current_population", "pagasa_signal", "units_consumed"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Uploaded CSV is missing the required column: '{col}'")

    # Clean data (ensure data types are numeric)
    df["camp_id"] = pd.to_numeric(df["camp_id"], errors="coerce").fillna(1).astype(int)
    df["supply_category_id"] = pd.to_numeric(df["supply_category_id"], errors="coerce").fillna(1).astype(int)
    df["current_population"] = pd.to_numeric(df["current_population"], errors="coerce").fillna(100).astype(int)
    df["pagasa_signal"] = pd.to_numeric(df["pagasa_signal"], errors="coerce").fillna(1).astype(int)
    df["units_consumed"] = pd.to_numeric(df["units_consumed"], errors="coerce").fillna(0).astype(int)

    # 2. SEPARATE FEATURES (X) FROM TARGET (y)
    X = df[["camp_id", "supply_category_id", "current_population", "pagasa_signal"]]
    y = df["units_consumed"]

    # 3. SPLIT DATA INTO TRAINING SET AND TEST SET (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42
    )

    # 4. TRAIN THE LINEAR REGRESSION MODEL
    model = LinearRegression()
    model.fit(X_train, y_train)

    # 5. EVALUATE THE MODEL'S ACCURACY
    y_predicted = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_predicted)
    r2 = r2_score(y_test, y_predicted)

    # 6. SAVE THE TRAINED MODEL AS A .pkl FILE
    os.makedirs(os.path.dirname(pkl_output_path), exist_ok=True)
    joblib.dump(model, pkl_output_path)

    # Extract coefficients
    coefs = {
        "camp_id": float(model.coef_[0]),
        "supply_category_id": float(model.coef_[1]),
        "current_population": float(model.coef_[2]),
        "pagasa_signal": float(model.coef_[3]),
        "intercept": float(model.intercept_)
    }

    results = {
        "mae": float(mae),
        "r2": float(r2),
        "coefficients": coefs,
        "records_count": len(df)
    }

    print(f"✅ Model trained on {results['records_count']} rows successfully!")
    print(f"   R² Score: {r2 * 100:.2f}% | MAE: {mae:.2f} units")
    print(f"   Model saved to: {pkl_output_path}")

    return results


# ==============================================================================
# CLI EXECUTION ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("  ReliefSync ML Engine — Model Training Initializing...")
    print("=" * 60)

    default_dataset = os.path.join(os.path.dirname(__file__), "..", "backend", "dataset.csv")
    default_pkl = os.path.join(os.path.dirname(__file__), "relief_model.pkl")

    metrics = train_and_evaluate(default_dataset, default_pkl)

    print("\n📈 Statistical Summary of Training Run:")
    print(f"   Total Records Used: {metrics['records_count']}")
    print(f"   R-Squared (R²):     {metrics['r2']:.4f} ({metrics['r2'] * 100:.2f}%)")
    print(f"   Mean Absolute Error: {metrics['mae']:.2f} units")
    print("\n🔍 Learned Coefficients:")
    for key, val in metrics['coefficients'].items():
        print(f"   {key:25s}: {val:+.4f}")
    print("\n🎉 TRAINING RUN SUCCESSFUL!\n")
