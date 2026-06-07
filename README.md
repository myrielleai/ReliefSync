# ReliefSync — Disaster Logistics Engine

ReliefSync is a high-fidelity disaster logistics optimization system. It is designed to run predictive demand forecasting for evacuation centers during crisis events, delivering real-time manifest requirements with zero guesswork.

## 🎨 Design System & Visuals

The application is built to fit a **Standard 16:9 Desktop Presentation Frame ($1920 \times 1080$)** to ensure perfect rendering during pitches, exhibitions, and reviews.

- **Theme**: Strict industrial grayscale layout utilizing high-contrast typography, crisp borders, and subtle panel shadows.
- **Accent Color**: Vivid safety Red (`#D32F2F`) and Warning Orange (`#FF9500`) are used exclusively for critical status indicators (e.g., "CRITICAL" levels, threshold crossings) to draw immediate attention.
- **Responsive Presentation**: The page dynamically scales to fit any screen resolution while preserving the exact layout proportions, canvas borders, and 16:9 grid spacing.
- **Typography**: Inter (UI elements and headers) and JetBrains Mono (operational metrics, inventory counts, timestamps).

## 🚀 Key Features

1. **Active Control Panel (Sidebar)**
   - Evacuation Center selectors linked to distinct camp metrics.
   - Live date toggles.
   - Inventory category filters that dynamically inject and remove items from the dashboard.
   
2. **Camp Demographics (Row A)**
   - Real-time headcount tracker.
   - Dynamic alert level displays.
   - Logistics urgency countdown.
   
3. **Predictive Demand Graph (Row B)**
   - Interactive, high-performance SVG line chart.
   - Customized area gradient overlays matching grayscale values.
   - Dotted **Safety Buffer Threshold** indicating when stock runs dangerously low.
   - Dynamic tooltips rendering precise remaining quantities on point hover.

4. **Actionable Packing Manifest (Row C)**
   - Live inventory logs displaying 72H Demand, On-Site Stock, and Recommended Dispatch.
   - A distinct border and background highlight on the **Recommended Dispatch Quantity** column, giving logistics coordinators a direct, actionable solution calculated by machine learning.
   - 1.2-second forecasting delay simulating live neural network computation.

## 🛠️ Tech Stack & Requirements

- **HTML5** & semantic page layouts.
- **Vanilla CSS3** with custom design variables, transformations, and staggering keyframe animations.
- **Vanilla JavaScript** (ES6+) for interactive canvas resizing, chart generation, and data modeling.
- **Zero external dependencies** (no frameworks, no bundlers, no external graph libraries) ensuring instant loading and absolute safety.

## ⚙️ Running Locally

Simply open the file directly in any modern desktop web browser:
1. Double-click `index.html` or open it via file path.
2. For local hosting: run any basic HTTP server (e.g. `npx serve .` or `python -m http.server`).
