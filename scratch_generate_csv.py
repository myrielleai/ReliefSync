import csv
import random

# Generate a synthetic dataset modeled after real disaster relief consumption patterns
rows = []
rows.append(['camp_id', 'supply_category_id', 'current_population', 'pagasa_signal', 'units_consumed'])

for _ in range(150):
    camp_id = random.randint(1, 15)
    category = random.randint(1, 3)
    population = random.randint(300, 4500)
    signal = random.randint(1, 5)
    
    # Base consumption rules based on humanitarian standards (e.g. Sphere Standards)
    # Category 1 (Water): ~3 units per person per day
    # Category 2 (Rice): ~1 pack per family of 5, or ~0.2 per person
    # Category 3 (Medical): ~0.05 kits per person (mostly for vulnerable evacuees)
    if category == 1:
        base = population * 3.0
    elif category == 2:
        base = population * 0.4
    else:
        base = population * 0.15

    # Storm severity increases demand (stranded longer, higher casualty rate)
    severity_multiplier = 1.0 + (signal * 0.15)
    
    # Add natural variance (-10% to +10%)
    variance = random.uniform(0.9, 1.1)
    
    units = int(base * severity_multiplier * variance)
    rows.append([camp_id, category, population, signal, units])

with open('sample_typhoon_dataset.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print("Successfully generated 150 rows of synthetic typhoon data.")
