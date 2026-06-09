"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              ReliefSync — Flask API Backend Server                           ║
║              File: backend/app.py                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PURPOSE: This is the "bridge" between our ML model and the web frontend.   ║
║  It's a web server that listens for requests from portal.js, runs the ML    ║
║  model's predict() function, and sends the result back as JSON.             ║
║                                                                              ║
║  HOW TO RUN:                                                                 ║
║    1. First, run: cd model_training && python train_model.py                 ║
║    2. Then, run: cd backend && python app.py                                 ║
║    3. Server starts at: http://127.0.0.1:5000                                ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

# ==============================================================================
# IMPORTS
# ==============================================================================
#   flask       → The web framework that turns this Python script into a server
#   Flask       → The main application object
#   request     → Reads incoming JSON data from the frontend
#   jsonify     → Converts Python dicts into properly formatted JSON responses
#   CORS        → Cross-Origin Resource Sharing fix (explained below)
#   joblib      → Loads our pre-trained .pkl model file from disk
#   numpy       → Numerical array library (sklearn needs inputs as numpy arrays)
#   os          → Operating system utilities (for building file paths)
# ==============================================================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

# ==============================================================================
# APP INITIALIZATION
# ==============================================================================
#
# Flask(__name__) creates our web application.
# __name__ is a Python built-in that equals the name of the current file/module.
# Flask uses it to locate resources relative to this file's location.
#
# ==============================================================================

app = Flask(__name__)

# ==============================================================================
# CORS — CROSS-ORIGIN RESOURCE SHARING (VERY IMPORTANT FOR DEMOS!)
# ==============================================================================
#
# By default, browsers BLOCK web pages from making requests to a different
# "origin" (domain + port). This is a security feature called Same-Origin Policy.
#
# Our situation:
#   - Frontend (portal.html) is served from: file:// or http://127.0.0.1 (any port)
#   - Flask backend runs on:                  http://127.0.0.1:5000
#
# Without CORS enabled on Flask, the browser would block the fetch() call
# from portal.js, even though both are on localhost. You'd see:
#   "Access to fetch at 'http://127.0.0.1:5000' from origin '...' has been
#    blocked by CORS policy"
#
# CORS(app) tells Flask to include the right HTTP headers that tell the browser:
#   "Yes, it's okay — this server allows requests from any origin."
#
# For a hackathon demo, this is the correct approach.
#
# ==============================================================================

CORS(app)  # This single line prevents the most common demo-killing error!


# ==============================================================================
# LOAD THE PRE-TRAINED ML MODEL AT SERVER STARTUP
# ==============================================================================
#
# We load the model ONCE when the server starts, not on every request.
#
# WHY? Because loading a .pkl file involves reading from disk and rebuilding
# the model object in memory — that takes ~50-200ms. If we did that for every
# single API request, the dashboard would feel very slow.
#
# By loading it once at startup and storing it in the global 'model' variable,
# every subsequent prediction call takes <1ms.
#
# ==============================================================================

# Build the path to the model file.
# os.path.dirname(__file__) → the directory where THIS file (app.py) lives: /backend/
# os.path.join → safely joins path segments with the correct OS separator (/ or \)
# So: /ReliefSync/backend/../model_training/relief_model.pkl
#      which resolves to: /ReliefSync/model_training/relief_model.pkl
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),   # .../ReliefSync/backend/
    "..",                         # Go up one level to .../ReliefSync/
    "model_training",             # Enter model_training/
    "relief_model.pkl"            # The model file name
)

# Try to load the model. We use try/except so the server doesn't crash
# if the .pkl file hasn't been generated yet.
try:
    model = joblib.load(MODEL_PATH)
    print(f"✅ ML Model loaded successfully from: {os.path.abspath(MODEL_PATH)}")
except FileNotFoundError:
    model = None
    print("⚠️  WARNING: relief_model.pkl not found.")
    print("   Please run: cd model_training && python train_model.py")
    print("   The server will start, but /api/predict will return fallback values.")


# ==============================================================================
# HELPER: CALCULATE FALLBACK VALUES (No-Server Fallback Math)
# ==============================================================================
#
# This function computes a simple estimate WITHOUT using the ML model.
# It mirrors the fallback formulas in portal.js.
# If something goes wrong with the model, we still return a sensible number.
#
# This ensures the Flask server NEVER sends a 500 error to the frontend.
#
# ==============================================================================

def compute_fallback(population: int, item_type: str) -> int:
    """
    Simple formula-based fallback if the ML model is unavailable.

    Parameters:
        population (int): Number of evacuees in the camp
        item_type  (str): 'water', 'rice', or 'medical'

    Returns:
        int: Estimated units needed over 72 hours
    """
    # These multipliers are based on SPHERE standards for humanitarian response:
    # Water: 15 liters per person per day = ~3 bottles per day → 9 per 72h
    # Rice:  3 packs per person per 72 hours (1 per meal, 1 meal of rice per day avg)
    # Medicine: approximately 15% of population will need medical attention
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
#
# This is the main route — the URL that portal.js sends data to.
#
# @app.route — a "decorator" that registers this function as the handler
#   for HTTP POST requests to the URL '/api/predict'.
#
# HTTP Methods:
#   GET  → "Give me data" (used for loading pages)
#   POST → "Here is my data, process it" (used for sending form data, API calls)
#   We use POST because the frontend is SENDING data TO the server.
#
# ==============================================================================

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Accepts a JSON body with evacuation center parameters,
    runs the ML model, and returns the recommended dispatch quantity.

    Expected JSON Input from portal.js:
    {
        "camp_id": 1,           (integer: 1, 2, or 3)
        "population": 1250,     (integer: number of evacuees)
        "pagasa_signal": 4,     (integer: PAGASA Signal 1 to 5)
        "item_type": "water"    (string: "water", "rice", or "medical")
    }

    JSON Response sent back to portal.js:
    {
        "recommended_dispatch": 3450,
        "model_used": "linear_regression",
        "source": "ml_model"
    }
    """

    # --- A. PARSE INCOMING JSON ---
    # request.get_json() extracts the JSON body sent by fetch() in portal.js.
    # If the Content-Type header isn't set correctly, force=True still parses it.
    try:
        payload = request.get_json(force=True)

        if not payload:
            # The frontend sent an empty or malformed body
            return jsonify({
                "error": "No JSON data received",
                "message": "Request body must contain JSON with camp_id, population, pagasa_signal, item_type"
            }), 400  # HTTP 400 = Bad Request

    except Exception as parse_error:
        return jsonify({
            "error": "Failed to parse request body",
            "message": str(parse_error)
        }), 400

    # --- B. EXTRACT AND VALIDATE FIELDS ---
    # We use .get() with defaults so we never crash on missing keys.
    # Then we convert to the correct types with int() / float().
    try:
        camp_id = int(payload.get("camp_id", 1))
        population = int(payload.get("population", 1000))
        pagasa_signal = int(payload.get("pagasa_signal", 2))
        item_type = str(payload.get("item_type", "water")).lower().strip()

        # Convert item_type string to the numeric ID our model was trained on:
        #   "water"   → 1
        #   "rice"    → 2
        #   "medical" → 3
        item_type_map = {
            "water":   1,
            "rice":    2,
            "medical": 3
        }
        supply_category_id = item_type_map.get(item_type, 1)

        # Basic sanity checks — clamp values to valid ranges
        camp_id = max(1, min(3, camp_id))           # Must be 1, 2, or 3
        population = max(1, min(50000, population)) # At least 1, max 50,000
        pagasa_signal = max(1, min(5, pagasa_signal)) # Signal 1 to 5

        print(f"📩 Received prediction request:")
        print(f"   Camp ID: {camp_id} | Population: {population} | "
              f"PAGASA Signal: {pagasa_signal} | Item: {item_type} (id={supply_category_id})")

    except (ValueError, TypeError) as field_error:
        # This catches cases where e.g. someone sends population="lots" instead of 1000
        return jsonify({
            "error": "Invalid field types",
            "message": f"All numeric fields must be numbers. Detail: {str(field_error)}"
        }), 422  # HTTP 422 = Unprocessable Entity

    # --- C. RUN THE ML MODEL ---
    try:
        if model is None:
            # Model wasn't loaded (train_model.py hasn't been run yet)
            # Fall back to our formula-based calculation
            dispatch_qty = compute_fallback(population, item_type)
            source = "fallback_formula"
            print(f"⚠️  Model not loaded, using fallback formula → {dispatch_qty} units")

        else:
            # =================================================================
            # THE PREDICTION STEP — This is the heart of the backend!
            # =================================================================
            #
            # We create a 2D numpy array from our 4 features.
            # Shape: [[camp_id, supply_category_id, population, pagasa_signal]]
            #
            # WHY a 2D array? sklearn's predict() always expects a 2D input
            # because it's designed to predict on MULTIPLE rows at once.
            # We have 1 row, so we wrap it: [[...]] instead of [...]
            #
            # model.predict() applies our learned formula:
            #   y = m₁·camp_id + m₂·supply_cat_id + m₃·population + m₄·pagasa_signal + b
            #
            # It returns an array of predictions — we grab [0] for our single result.
            #
            # =================================================================
            features = np.array([[
                camp_id,
                supply_category_id,
                population,
                pagasa_signal
            ]])

            # Run the prediction
            raw_prediction = model.predict(features)

            # Convert from numpy float to regular Python int (JSON-serializable)
            dispatch_qty = max(0, int(round(raw_prediction[0])))

            # ─── SPHERE Minimum Floor ───────────────────────────────────────
            # The linear model can produce near-zero values for medical kits
            # at lower PAGASA signals due to coefficient cancellation.
            # Apply SPHERE minimum standards as a floor:
            #   Water:   at least 2 units per person (extremely conservative)
            #   Rice:    at least 0.5 packs per person
            #   Medical: at least 5% of population (SPHERE: treat 1 in 20 evacuees)
            sphere_floors = {
                "water":   int(population * 2.0),
                "rice":    int(population * 0.5),
                "medical": int(population * 0.05)
            }
            floor = sphere_floors.get(item_type, 0)
            dispatch_qty = max(dispatch_qty, floor)
            # ────────────────────────────────────────────────────────────────

            source = "ml_model"
            print(f"ML Prediction (post-floor) = {dispatch_qty} units")


    except Exception as model_error:
        # If the model crashes for any reason, fall back gracefully
        # We NEVER want the server to return a 500 error during a live demo
        print(f"❌ Model prediction failed: {str(model_error)}")
        print(f"   Falling back to formula-based calculation...")
        dispatch_qty = compute_fallback(population, item_type)
        source = "fallback_formula_on_error"

    # --- D. SEND THE RESPONSE BACK TO FRONTEND ---
    # jsonify() converts our Python dictionary into a proper JSON HTTP response.
    # HTTP 200 = OK (success)
    response_data = {
        "recommended_dispatch": dispatch_qty,   # The key number portal.js will use
        "model_used": "linear_regression",      # For transparency / judge questions
        "source": source,                        # Was this ML or fallback?
        "inputs": {                              # Echo back what we received (for debugging)
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
# HEALTH CHECK ENDPOINT: GET /api/health
# ==============================================================================
#
# This is a simple endpoint that lets you quickly verify the server is running.
# Open http://127.0.0.1:5000/api/health in your browser during a demo to
# confirm everything is live before presenting to judges.
#
# ==============================================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Simple health check endpoint.
    Visit http://127.0.0.1:5000/api/health to verify the server is alive.
    """
    model_status = "loaded" if model is not None else "not_loaded (run train_model.py)"

    return jsonify({
        "status": "✅ ReliefSync API is running!",
        "model_status": model_status,
        "endpoints": {
            "POST /api/predict": "Run ML prediction for a supply category",
            "GET  /api/health":  "This health check"
        },
        "version": "1.0.0 (Hackathon Build)"
    }), 200


# ==============================================================================
# RUN THE SERVER
# ==============================================================================
#
# app.run() starts Flask's built-in development web server.
#
# Parameters:
#   debug=True  → Hot-reloads when you save changes to this file.
#                 Also shows detailed error messages in the browser.
#                 NOTE: Never use debug=True in production!
#
#   host="0.0.0.0" → Makes the server accessible from ALL network interfaces,
#                    not just localhost. This means other devices on your WiFi
#                    can access your demo if needed (great for demos on projectors!).
#
#   port=5000 → The port number. http://127.0.0.1:5000 in your browser.
#               If port 5000 is taken, change this to 5001, 8000, etc.
#
# if __name__ == "__main__" → Only run the server if this script is run directly.
#   This prevents the server from starting if this file is imported by another module.
#
# ==============================================================================

if __name__ == "__main__":
    import os

    # Render (and most cloud platforms) injects a PORT environment variable.
    # Locally, we default to 5000.
    # This one line makes the server work both locally AND on Render with zero changes.
    port = int(os.environ.get("PORT", 5000))

    # Disable debug mode in production (Render sets FLASK_ENV=production)
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
        debug=is_debug,   # False on Render (FLASK_ENV=production), True locally
        host="0.0.0.0",   # Accept connections from any network interface
        port=port         # 5000 locally, Render's PORT env variable in the cloud
    )
