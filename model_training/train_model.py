"""
╔══════════════════════════════════════════════════════════════════════════════╗
║              ReliefSync — Machine Learning Training Script                   ║
║              File: model_training/train_model.py                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  PURPOSE: This script trains a Linear Regression model on historical         ║
║  disaster relief data, then saves the trained model to disk as a .pkl file.  ║
║  You run this script ONCE before starting the Flask server.                  ║
║                                                                              ║
║  HOW TO RUN:                                                                 ║
║    cd model_training                                                         ║
║    python train_model.py                                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

# ==============================================================================
# IMPORTS — We need three libraries:
#   1. pandas   → Creates and manages our dataset (like Excel, but in Python)
#   2. sklearn  → Scikit-learn, our Machine Learning toolkit
#   3. joblib   → Saves (serializes) our trained model so Flask can load it later
# ==============================================================================
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os
import sys

# Fix: Windows terminals default to cp1252 encoding which can't render emoji.
# This line forces stdout to use UTF-8 so our print statements always work.
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

print("=" * 60)
print("  ReliefSync ML Engine — Model Training Initializing...")
print("=" * 60)


# ==============================================================================
# STEP 1: CREATE THE TRAINING DATASET
# ==============================================================================
#
# In the real world, this data would come from historical records —
# previous typhoon responses, past evacuee counts, actual supply ledgers.
#
# Since we're at a hackathon, we generate synthetic (fake but realistic) data
# that follows the SAME PATTERNS as real disaster logistics data would.
#
# Our dataset has 4 FEATURES (inputs) and 1 TARGET (output):
#
#   FEATURES (X) — The things we KNOW at the time of prediction:
#   ─────────────────────────────────────────────────────────────
#   camp_id            → Which evacuation center (1, 2, or 3)
#   supply_category_id → What type of supply we're predicting for:
#                          1 = Water, 2 = Rice, 3 = Medicine
#   current_population → How many evacuees are currently in the camp
#   pagasa_signal      → PAGASA Tropical Cyclone Wind Signal (1 to 5)
#
#   TARGET (y) — The thing we WANT TO PREDICT:
#   ─────────────────────────────────────────────────────────────
#   units_consumed → How many units of that supply will be needed in the next 72 hours
#
# ==============================================================================

# We'll create 900 historical "records" (rows) to train on.
# In data science, more data = better model.
TRAINING_RECORDS = 900

# Here we build a list of Python dictionaries. Each dictionary = one historical event.
# Think of it as one row in our "past disaster spreadsheet."
raw_data = []

for i in range(TRAINING_RECORDS):

    # --- Simulate varying conditions for each record ---

    # Which camp are we simulating? (1, 2, or 3, cycling through)
    camp_id = (i % 3) + 1

    # Which supply type? (1=Water, 2=Rice, 3=Medicine, cycling through)
    supply_category_id = (i % 3) + 1

    # Population varies between 300 (small camp) and 3000 (large camp)
    # We use a sine wave to make population naturally fluctuate, mimicking
    # how evacuation centers fill up as a storm approaches and then empty out.
    import math
    population_base = 1500
    population_fluctuation = math.sin(i * 0.15) * 1000
    population = int(population_base + population_fluctuation + (camp_id * 150))
    population = max(300, min(3000, population))  # Clamp to realistic range

    # PAGASA Signal: 1-5 scale (Signal No. 1 to Signal No. 5).
    pagasa_signal = int(max(1, min(5, round(3 + 2 * math.sin(i * 0.08)))))

    # --- Compute the TARGET value (units_consumed) ---
    #
    # We define the "ground truth" using domain knowledge of disaster logistics:
    #
    # WATER (supply_category_id == 1):
    #   Each person needs ~3 liters per day, so 9 liters over 72 hours.
    #   Higher PAGASA signals mean destroyed water lines, increasing reliance on bottled water.
    #   Formula: population * 3.0 * (1 + pagasa_signal * 0.15)
    #   → A camp of 1000 people in a Signal 4 storm needs: 1000 * 3.0 * 1.60 = 4,800 units
    #
    # RICE (supply_category_id == 2):
    #   Each person needs ~1 rice pack per day = 3 packs over 72 hours.
    #   Formula: population * 1.0 * (1 + pagasa_signal * 0.05)
    #
    # MEDICINE (supply_category_id == 3):
    #   Medicine is for treating the ~15% of evacuees who get sick (injuries, waterborne disease).
    #   Severe weather (Signal 4/5) worsens health conditions significantly.
    #   Formula: population * 0.15 * (1 + pagasa_signal * 0.25)
    #
    if supply_category_id == 1:   # Water
        units_consumed = population * 3.0 * (1 + pagasa_signal * 0.15)
    elif supply_category_id == 2: # Rice
        units_consumed = population * 1.0 * (1 + pagasa_signal * 0.05)
    else:                          # Medicine (supply_category_id == 3)
        units_consumed = population * 0.15 * (1 + pagasa_signal * 0.25)

    # Add some realistic randomness (noise). In real life, data is never perfectly clean.
    # We add ±10% random variation to simulate unpredictable factors
    # (e.g., late deliveries, waste, unexpected population surges).
    import random
    random.seed(i * 42)  # Fixed seed per record so results are reproducible
    noise = random.uniform(-0.10, 0.10)
    units_consumed = int(units_consumed * (1 + noise))
    units_consumed = max(0, units_consumed)  # Can't have negative supply needed

    # Append this record to our dataset list
    raw_data.append({
        "camp_id": camp_id,
        "supply_category_id": supply_category_id,
        "current_population": population,
        "pagasa_signal": pagasa_signal,
        "units_consumed": units_consumed
    })

# Convert our list of dictionaries into a Pandas DataFrame.
# A DataFrame is like an Excel spreadsheet: rows are records, columns are variables.
df = pd.DataFrame(raw_data)

print(f"\n✅ Dataset created: {len(df)} training records")
print(f"\n📊 Sample of our dataset (first 5 rows):")
print(df.head())
print(f"\n📈 Statistical Summary of our data:")
print(df.describe())


# ==============================================================================
# STEP 2: SEPARATE FEATURES (X) FROM TARGET (y)
# ==============================================================================
#
# Machine learning models need to know:
#   X = "These are the inputs (clues) I use to make my prediction"
#   y = "This is the answer I am trying to predict"
#
# Think of it like studying for an exam:
#   X = The questions (camp_id, population, weather, supply type)
#   y = The correct answers (how many units are actually needed)
#
# ==============================================================================

# X contains all our input features (the 4 columns the model will learn from)
X = df[["camp_id", "supply_category_id", "current_population", "pagasa_signal"]]

# y contains our target column (what we want the model to predict)
y = df["units_consumed"]

print(f"\n🔧 Feature matrix (X) shape: {X.shape} → {X.shape[0]} records, {X.shape[1]} features")
print(f"🎯 Target vector (y) shape: {y.shape}")


# ==============================================================================
# STEP 3: SPLIT DATA INTO TRAINING SET AND TEST SET
# ==============================================================================
#
# We can't use ALL our data to train the model, because then we'd have no
# way to test if it actually learned correctly.
#
# Imagine studying with answers visible → you memorize, you don't learn.
# A proper exam uses questions you've NEVER seen before.
#
# train_test_split() does this automatically:
#   - 80% of data → TRAINING SET (model learns from this)
#   - 20% of data → TEST SET (we evaluate accuracy on this unseen data)
#
# random_state=42 → Seeds the random split so results are reproducible.
#   (42 is a popular "magic number" in data science, from "The Hitchhiker's Guide")
#
# ==============================================================================

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,       # 20% goes to the test set
    random_state=42      # Makes the split reproducible every time we run this
)

print(f"\n✂️  Data split complete:")
print(f"   Training set: {len(X_train)} records (80%)")
print(f"   Test set:     {len(X_test)} records (20%)")


# ==============================================================================
# STEP 4: THE MACHINE LEARNING MODEL — LINEAR REGRESSION
# ==============================================================================
#
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  WHAT IS LINEAR REGRESSION? (Explained in Plain English)                │
# │                                                                         │
# │  Linear Regression answers the question:                                │
# │  "Can I draw a straight line through my data to predict new values?"    │
# │                                                                         │
# │  Simple example (1 feature):                                            │
# │    If we plot (population) on the X-axis and (water_demand) on Y-axis,  │
# │    a straight line emerges: more people → more water needed.            │
# │                                                                         │
# │  The math formula is:                                                   │
# │    y = m₁·x₁ + m₂·x₂ + m₃·x₃ + m₄·x₄ + b                            │
# │                                                                         │
# │  Where:                                                                 │
# │    y = predicted units_consumed                                         │
# │    x₁ = camp_id                                                         │
# │    x₂ = supply_category_id                                              │
# │    x₃ = current_population                                              │
# │    x₄ = pagasa_signal                                                   │
# │    m₁,m₂,m₃,m₄ = "weights" (how much each feature matters)            │
# │    b = "bias" / intercept (baseline value when all features = 0)        │
# │                                                                         │
# │  TRAINING = Finding the best values for m₁,m₂,m₃,m₄,b so the line     │
# │  fits as close to the actual data points as possible.                   │
# │                                                                         │
# │  WHY LINEAR REGRESSION (not a neural network, etc.)?                   │
# │  1. 📖 Highly interpretable — judges can see exactly what the model     │
# │     learned by checking the coefficients (m values)                     │
# │  2. ⚡ Extremely fast to train and predict (<1ms per prediction)        │
# │  3. 🎯 Works very well when relationships are actually linear (which    │
# │     supply logistics tend to be — more people = more supplies needed)   │
# └─────────────────────────────────────────────────────────────────────────┘
#
# ==============================================================================

print("\n🧠 Training Linear Regression model...")

# Create a LinearRegression model object.
# At this point it knows NOTHING — it hasn't seen any data yet.
model = LinearRegression()

# .fit() is where the actual learning happens.
# The algorithm looks at all X_train rows and y_train answers,
# then mathematically calculates the best possible m₁,m₂,m₃,m₄,b values.
# Under the hood, it uses a method called "Ordinary Least Squares" (OLS):
# it minimizes the sum of squared differences between predicted and actual values.
model.fit(X_train, y_train)

print("✅ Model training complete!")


# ==============================================================================
# STEP 5: EVALUATE THE MODEL'S ACCURACY
# ==============================================================================
#
# Now we test the model against the 20% data it has NEVER seen.
# This tells us if the model actually learned the pattern, or just memorized.
#
# We use two metrics:
#
# 1. MAE (Mean Absolute Error):
#    "On average, how many units off is our prediction?"
#    Example: MAE of 150 means on average we're wrong by ±150 units.
#    LOWER is better.
#
# 2. R² Score (R-Squared, "Coefficient of Determination"):
#    "What percentage of the variation in demand does our model explain?"
#    Scale: 0.0 to 1.0 (or 0% to 100%)
#    Example: R² = 0.95 means our model explains 95% of why demand changes.
#    HIGHER is better. 1.0 = perfect, 0.0 = no better than guessing the mean.
#
# ==============================================================================

# Generate predictions on the test set
y_predicted = model.predict(X_test)

# Calculate our accuracy metrics
mae = mean_absolute_error(y_test, y_predicted)
r2 = r2_score(y_test, y_predicted)

print(f"\n📊 Model Evaluation Results (on unseen test data):")
print(f"   Mean Absolute Error (MAE): {mae:.2f} units")
print(f"   → On average, our predictions are off by only {mae:.0f} units")
print(f"\n   R² Score: {r2:.4f} ({r2 * 100:.2f}%)")
print(f"   → Our model explains {r2 * 100:.1f}% of the variation in relief demand")

# Show the learned coefficients (the "m" values in our formula)
# These tell us HOW MUCH each feature influences the prediction.
print(f"\n🔍 What the model learned (feature coefficients):")
feature_names = ["camp_id", "supply_category_id", "current_population", "pagasa_signal"]
for name, coef in zip(feature_names, model.coef_):
    print(f"   {name:25s}: {coef:+.4f}")
print(f"   {'bias (intercept)':25s}: {model.intercept_:+.4f}")
print(f"\n   Interpretation: A positive coefficient means increasing that")
print(f"   feature INCREASES the predicted units needed.")
print(f"   The 'current_population' coefficient should be the largest,")
print(f"   meaning more people → the biggest driver of supply demand.")


# ==============================================================================
# STEP 6: SAVE THE TRAINED MODEL AS A .pkl FILE
# ==============================================================================
#
# After training, we "serialize" (save) the model to a file using joblib.
# Serialization converts the model object (which lives in RAM) into a file on disk.
#
# This is critical because:
#   - We only want to train ONCE (training can be slow for big models)
#   - The Flask server loads this pre-trained file when it starts up
#   - Every prediction request uses the same loaded model → instant responses
#
# .pkl = "pickle" format, a Python standard for saving Python objects to disk
#
# ==============================================================================

# Save the model into the model_training/ folder (same directory as this script)
model_output_path = os.path.join(os.path.dirname(__file__), "relief_model.pkl")
joblib.dump(model, model_output_path)

print(f"\n💾 Model saved successfully to: {model_output_path}")
print(f"\n{'=' * 60}")
print(f"  ✅ TRAINING COMPLETE! relief_model.pkl is ready.")
print(f"  Next step: Run backend/app.py to start the Flask API server.")
print(f"{'=' * 60}\n")
