"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              ReliefSync — Flask API Backend Server                           ║
║              File: backend/app.py                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PURPOSE: This is the "bridge" between our ML model and the web frontend.   ║
║  It's a web server that listens for requests from portal.js, runs the ML    ║
║  model's predict() function, and sends the result back as JSON.             ║
║  Also exposes endpoints for dataset viewing, template download, and         ║
║  uploading datasets to retrain the ML model dynamically in real time.       ║
║                                                                              ║
║  HOW TO RUN:                                                                 ║
║    1. Run training once (optional, server auto-runs it if missing):         ║
║       py -3.12 model_training/train_model.py                                 ║
║    2. Then, run:                                                             ║
║       py -3.12 backend/app.py                                                ║
║    3. Server starts at: http://127.0.0.1:5000                                ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

# ==============================================================================
# IMPORTS
# ==============================================================================
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import os
import sys

# Add project root to sys.path to easily import model_training
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from model_training.train_model import train_and_evaluate

# ==============================================================================
# APP INITIALIZATION
# ==============================================================================
app = Flask(__name__)
CORS(app)  # Preemptively prevent CORS errors

# ==============================================================================
# PATH CONFIGURATION & LOAD TRAINED MODEL
# ==============================================================================
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),   # .../ReliefSync/backend/
    "..",                         # Go up one level to .../ReliefSync/
    "model_training",             # Enter model_training/
    "relief_model.pkl"            # The model file name
)
DATASET_PATH = os.path.join(os.path.dirname(__file__), "dataset.csv")

try:
    # Ensure dataset.csv exists and model is trained
    if not os.path.exists(DATASET_PATH):
        print(f"✨ Initial dataset not found at {DATASET_PATH}. Running train_and_evaluate to build it...")
        train_and_evaluate(DATASET_PATH, MODEL_PATH)

    model = joblib.load(MODEL_PATH)
    print(f"✅ ML Model loaded successfully from: {os.path.abspath(MODEL_PATH)}")
except Exception as e:
    model = None
    print(f"⚠️  WARNING: Failed to load model or generate dataset: {e}")
    print("   Please run: cd model_training && py -3.12 train_model.py")


# ==============================================================================
# HELPER: CALCULATE FALLBACK VALUES (No-Server Fallback Math)
# ==============================================================================
def compute_fallback(population: int, item_type: str) -> int:
    """
    Simple formula-based fallback if the ML model is unavailable.
    """
    fallback_multipliers = {
        "water":   2.5,   # conservative estimate (bottles per person per 72h)
        "rice":    0.8,   # packs per person per 72h
        "medical": 0.12   # kits per person (proportion needing medical attention)
    }
    multiplier = fallback_multipliers.get(item_type, 2.5)
    return int(population * multiplier)


# ==============================================================================
# API ENDPOINT: POST /api/predict
# ==============================================================================
@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Accepts a JSON body with evacuation center parameters,
    runs the ML model, and returns the recommended dispatch quantity.
    """
    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({
                "error": "No JSON data received",
                "message": "Request body must contain JSON with camp_id, population, pagasa_signal, item_type"
            }), 400

    except Exception as parse_error:
        return jsonify({
            "error": "Failed to parse request body",
            "message": str(parse_error)
        }), 400

    try:
        camp_id = int(payload.get("camp_id", 1))
        population = int(payload.get("population", 1000))
        pagasa_signal = int(payload.get("pagasa_signal", 2))
        item_type = str(payload.get("item_type", "water")).lower().strip()

        item_type_map = {
            "water":   1,
            "rice":    2,
            "medical": 3
        }
        supply_category_id = item_type_map.get(item_type, 1)

        # Basic sanity checks — clamp values to valid ranges
        camp_id = max(1, min(3, camp_id))
        population = max(1, min(50000, population))
        pagasa_signal = max(1, min(5, pagasa_signal))

        print(f"📩 Prediction Request: Camp {camp_id} | Pop {population} | PAGASA Signal {pagasa_signal} | Item: {item_type}")

    except (ValueError, TypeError) as field_error:
        return jsonify({
            "error": "Invalid field types",
            "message": f"All numeric fields must be numbers. Detail: {str(field_error)}"
        }), 422

    try:
        if model is None:
            dispatch_qty = compute_fallback(population, item_type)
            source = "fallback_formula"
            print(f"⚠️  Model not loaded, using fallback formula → {dispatch_qty} units")
        else:
            features = np.array([[
                camp_id,
                supply_category_id,
                population,
                pagasa_signal
            ]])

            # Run prediction
            raw_prediction = model.predict(features)
            dispatch_qty = max(0, int(round(raw_prediction[0])))

            # SPHERE Minimum Floor to prevent near-zero predictions
            sphere_floors = {
                "water":   int(population * 2.0),
                "rice":    int(population * 0.5),
                "medical": int(population * 0.05)
            }
            floor = sphere_floors.get(item_type, 0)
            dispatch_qty = max(dispatch_qty, floor)

            source = "ml_model"
            print(f"ML Prediction (post-floor) = {dispatch_qty} units")

    except Exception as model_error:
        print(f"❌ Model prediction failed: {str(model_error)}")
        dispatch_qty = compute_fallback(population, item_type)
        source = "fallback_formula_on_error"

    response_data = {
        "recommended_dispatch": dispatch_qty,
        "model_used": "linear_regression",
        "source": source,
        "inputs": {
            "camp_id": camp_id,
            "supply_category_id": supply_category_id,
            "population": population,
            "pagasa_signal": pagasa_signal,
            "item_type": item_type
        }
    }

    print(f"📤 Response sent: {response_data}\n")
    return jsonify(response_data), 200


# ==============================================================================
# DATASET MANAGEMENT API ENDPOINTS
# ==============================================================================
@app.route("/api/dataset", methods=["GET"])
def get_dataset():
    """
    Returns the active dataset loaded in the backend as a paginated JSON response.
    Query parameters:
      page: Page number (1-indexed, default: 1)
      limit: Records per page (default: 50)
    """
    try:
        if not os.path.exists(DATASET_PATH):
            train_and_evaluate(DATASET_PATH, MODEL_PATH)

        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))

        # Read CSV using Pandas
        df = pd.read_csv(DATASET_PATH)
        total_rows = len(df)
        pages = (total_rows + limit - 1) // limit

        start_idx = (page - 1) * limit
        end_idx = start_idx + limit

        subset = df.iloc[start_idx:end_idx]
        data = subset.to_dict(orient="records")

        return jsonify({
            "data": data,
            "total_rows": total_rows,
            "pages": pages,
            "current_page": page,
            "limit": limit
        }), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to read dataset",
            "message": str(e)
        }), 500


@app.route("/api/dataset/download", methods=["GET"])
def download_dataset():
    """
    Downloads the current dataset.csv file as a template/file attachment.
    """
    try:
        if not os.path.exists(DATASET_PATH):
            train_and_evaluate(DATASET_PATH, MODEL_PATH)

        return send_file(
            DATASET_PATH,
            as_attachment=True,
            download_name="reliefsync_historical_dataset.csv",
            mimetype="text/csv"
        )
    except Exception as e:
        return jsonify({
            "error": "Failed to download dataset",
            "message": str(e)
        }), 500


@app.route("/api/dataset/upload", methods=["POST"])
def upload_dataset():
    """
    Uploads a new CSV dataset, validates its columns, saves it,
    retrains the ML model (saving a new pkl), and reloads the model.
    """
    global model
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file part in the request payload"}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No selected file"}), 400

        if not file.filename.endswith(".csv"):
            return jsonify({"error": "Invalid file format. Only CSV files are supported."}), 400

        # Save upload to a temp path
        temp_path = DATASET_PATH + ".tmp"
        file.save(temp_path)

        try:
            # Validate headers using Pandas
            df_temp = pd.read_csv(temp_path)
            required_cols = ["camp_id", "supply_category_id", "current_population", "pagasa_signal", "units_consumed"]
            for col in required_cols:
                if col not in df_temp.columns:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                    return jsonify({
                        "error": f"Invalid CSV schema. Missing required column: '{col}'",
                        "message": f"CSV must contain precisely these columns: {', '.join(required_cols)}"
                      }), 400

            # If valid, overwrite the active dataset
            if os.path.exists(DATASET_PATH):
                os.remove(DATASET_PATH)
            os.rename(temp_path, DATASET_PATH)

            # Retrain model dynamically
            metrics = train_and_evaluate(DATASET_PATH, MODEL_PATH)

            # Reload newly trained model into memory
            model = joblib.load(MODEL_PATH)

            return jsonify({
                "status": "success",
                "message": "Dataset uploaded and ML model successfully retrained!",
                "metrics": metrics
            }), 200

        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({
                "error": "Failed to parse or retrain model on the uploaded CSV",
                "message": str(e)
            }), 400

    except Exception as e:
        return jsonify({
            "error": "File upload process encountered an error",
            "message": str(e)
        }), 500


# ==============================================================================
# HEALTH CHECK ENDPOINT: GET /api/health
# ==============================================================================
@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Simple health check endpoint.
    """
    model_status = "loaded" if model is not None else "not_loaded (run train_model.py)"

    return jsonify({
        "status": "✅ ReliefSync API is running!",
        "model_status": model_status,
        "endpoints": {
            "POST /api/predict": "Run ML prediction for a relief item",
            "GET  /api/dataset": "Get active paginated dataset records",
            "GET  /api/dataset/download": "Download current active dataset as CSV",
            "POST /api/dataset/upload": "Upload CSV and retrain ML model",
            "GET  /api/health": "Health check"
        },
        "version": "1.0.0 (Hackathon Build)"
    }), 200


# ==============================================================================
# RUN THE SERVER
# ==============================================================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    is_debug = os.environ.get("FLASK_ENV", "development") != "production"

    print("\n" + "=" * 60)
    print("  ReliefSync Flask API Server Starting...")
    print("=" * 60)
    print(f"  Server running at: http://0.0.0.0:{port}")
    print(f"  Health check:     http://0.0.0.0:{port}/api/health")
    print(f"  Predict endpoint: POST http://0.0.0.0:{port}/api/predict")
    print(f"  Debug mode: {is_debug}")
    print("=" * 60 + "\n")

    app.run(
        debug=is_debug,
        host="0.0.0.0",
        port=port
    )
