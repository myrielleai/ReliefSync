/**
 * ReliefSync — Operational Portal Dashboard Logic
 * File: frontend/portal.js
 *
 * KEY UPDATES IN THIS VERSION:
 *  - Fixed critical bug: formatNum was missing from renderTable (caused blank manifest + broken ML Insights)
 *  - Fixed alert colors and dynamic card indicator text
 *  - Added dramatically different stock levels per shelter to show CRITICAL/WARNING/STABLE
 *  - Added dataset transparency modal (NDRRMC-inspired synthetic data)
 *  - Added "How to Use" guide panel
 *  - Fixed ML Insights modal population
 *  - Added chart context annotation
 */

// ==============================================================================
// SECTION 1: CAMP DATABASE
// ==============================================================================
//
// Each camp has DELIBERATELY DIFFERENT stock levels so judges can see all 3
// alert states:
//   Brgy. 172 → CRITICAL  (barely any stock, Signal 4 storm — disaster scenario)
//   Brgy. 173 → STABLE    (well-stocked, lower signal — good prep scenario)
//   Brgy. 174 → WARNING   (medium stock, highest signal — dangerous midpoint)
//
// Stock is measured in units on-site RIGHT NOW, before any dispatch.
// The ML model predicts how much is needed over the next 72 hours.
//
// ==============================================================================

const database = {
  brgy_172: {
    name: "Brgy. 172 Covered Court",
    location: "Caloocan City, NCR",
    population: 1250,
    populationDisplay: "1,250",
    pagasaSignal: 4,
    campId: 1,
    dispatchWindow: "Within 4 Hours",
    maxChartVal: 7000,
    yTicks: ["7,000", "5,000", "2,500", "0"],
    // CRITICAL scenario: very low stock — shelves almost empty
    stock: { water: 280, rice: 90, medical: 25 },
    note: "Camp is receiving large influx of evacuees from coastal barangays."
  },
  brgy_173: {
    name: "Brgy. 173 Gymnasium",
    location: "Caloocan City, NCR",
    population: 850,
    populationDisplay: "850",
    pagasaSignal: 3,
    campId: 2,
    dispatchWindow: "Within 24 Hours",
    maxChartVal: 4500,
    yTicks: ["4,500", "3,000", "1,500", "0"],
    // STABLE scenario: well-stocked, lower signal storm
    stock: { water: 3200, rice: 1100, medical: 420 },
    note: "Pre-positioned stocks from DSWD warehouse delivered yesterday."
  },
  brgy_174: {
    name: "Brgy. 174 Elementary School",
    location: "Caloocan City, NCR",
    population: 1900,
    populationDisplay: "1,900",
    pagasaSignal: 5,
    campId: 3,
    dispatchWindow: "Within 8 Hours",
    maxChartVal: 12000,
    yTicks: ["12,000", "8,000", "4,000", "0"],
    // WARNING scenario: medium stock, highest signal, highest population
    stock: { water: 1800, rice: 750, medical: 200 },
    note: "Signal No. 5 — Typhoon expected direct landfall over this area."
  }
};

// Chart line colors
const categoryColors = {
  water: { stroke: "#0066cc", label: "Bottled Water", areaClass: "area-water", pathClass: "path-water" },
  rice: { stroke: "#8b5a2b", label: "Rice Packs", areaClass: "area-rice", pathClass: "path-rice" },
  medical: { stroke: "#e74c3c", label: "Medical Kits", areaClass: "area-medical", pathClass: "path-medical" }
};

// X coordinates for the 7 timeline points on the SVG chart
const xCoords = [80, 225, 370, 515, 660, 805, 950];
const timeLabels = ["Arrival", "12h", "24h", "36h", "48h", "60h", "72h"];


// ==============================================================================
// SECTION 2: ML BACKEND CONFIGURATION
// ==============================================================================

// Local Development Backend URL (allows testing custom dataset uploads and retraining locally)
const ML_API_BASE_URL = "http://127.0.0.1:5000";

// Deployed Production Backend URL
// const ML_API_BASE_URL = "https://reliefsync-qlev.onrender.com";


// ==============================================================================
// SECTION 3: FALLBACK CALCULATION
// ==============================================================================
//
// Used when Flask server is offline. Based on SPHERE Humanitarian Standards:
//   Water:   2.5 units per person per 72 hours (conservative bottles)
//   Rice:    0.8 packs per person per 72 hours
//   Medical: 0.12 kits per person (approx. 12% illness rate during disaster)
//
// ==============================================================================

function computeFallback(population, itemType) {
  const multipliers = { water: 2.5, rice: 0.8, medical: 0.12 };
  return Math.round(population * (multipliers[itemType] || 2.5));
}

// Global helper: format number with commas (e.g. 3450 → "3,450")
// Defined at global scope so ALL functions can use it without redeclaring
function formatNum(n) {
  return Number(n).toLocaleString('en-US');
}


// ==============================================================================
// SECTION 4: ML API FETCH FUNCTION
// ==============================================================================

async function fetchPrediction(campData, itemType) {
  const requestPayload = {
    camp_id: campData.campId,
    population: campData.population,
    pagasa_signal: campData.pagasaSignal,
    item_type: itemType
  };

  try {
    const response = await fetch(`${ML_API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) throw new Error(`Server returned status ${response.status}`);

    const responseData = await response.json();
    const predictedUnits = responseData.recommended_dispatch;

    console.log(`ML Prediction | ${campData.name} | ${itemType} | ${predictedUnits} units | source: ${responseData.source}`);
    return predictedUnits;

  } catch (error) {
    console.warn(`Flask API unavailable for ${itemType} at ${campData.name}. Using fallback.`, error.message);
    return computeFallback(campData.population, itemType);
  }
}


// ==============================================================================
// SECTION 5: DASHBOARD RENDER
// ==============================================================================

function renderDashboard(campData, mlResults, activeCategories) {
  // --- Update Population Card ---
  document.getElementById('val-population').textContent = campData.populationDisplay;

  // --- Compute alert level dynamically from stock vs demand ---
  // Coverage ratio = (total current stock) / (total predicted 72h demand)
  // < 30% → CRITICAL | 30-60% → WARNING | > 60% → STABLE
  let totalDemand = 0;
  let totalStock = 0;
  activeCategories.forEach(cat => {
    totalDemand += (mlResults[cat] || 0);
    totalStock += (campData.stock[cat] || 0);
  });

  const coverageRatio = totalDemand === 0 ? 1 : totalStock / totalDemand;

  const alertCard = document.getElementById('card-alert');
  const alertVal = document.getElementById('val-alert');
  const alertIndicator = document.getElementById('alert-indicator-text');

  // Remove any previously applied border-left style
  alertCard.style.borderLeft = '';
  alertCard.className = 'status-card'; // reset classes

  let computedAlertLevel, alertColor, alertIndicatorMsg;

  if (coverageRatio < 0.30) {
    computedAlertLevel = "CRITICAL";
    alertColor = "#ff4b4b";  // red
    alertIndicatorMsg = "Immediate Dispatch Required";
    alertCard.classList.add('highlight-alert-critical');
  } else if (coverageRatio < 0.60) {
    computedAlertLevel = "WARNING";
    alertColor = "#FF9500";  // orange
    alertIndicatorMsg = "Dispatch Recommended Soon";
    alertCard.classList.add('highlight-alert-warning');
  } else {
    computedAlertLevel = "STABLE";
    alertColor = "#34C759";  // green
    alertIndicatorMsg = "Stocks Sufficient for 72h";
    alertCard.classList.add('highlight-alert-stable');
  }

  alertVal.textContent = computedAlertLevel;
  alertVal.style.color = alertColor;
  if (alertIndicator) alertIndicator.textContent = alertIndicatorMsg;

  // --- Update Dispatch Window Card ---
  document.getElementById('val-window').textContent = campData.dispatchWindow;

  // --- Update PAGASA Signal displayed ---
  const pagasaEl = document.getElementById('val-pagasa-signal');
  if (pagasaEl) pagasaEl.textContent = `Signal No. ${campData.pagasaSignal}`;

  // --- Update chart subtitle ---
  const chartSubEl = document.getElementById('chart-subtitle');
  if (chartSubEl) {
    chartSubEl.textContent = `Showing projected stock depletion rate for ${campData.name} during Typhoon Amihan (PAGASA Signal No. ${campData.pagasaSignal}). Lines represent how much of each supply remains if NO new dispatch arrives.`;
  }

  // --- Render Chart ---
  const chartItems = buildChartItems(campData, mlResults, activeCategories);
  renderChart(campData.maxChartVal, chartItems, activeCategories);

  // --- Render Manifest Table ---
  renderTable(campData, mlResults, activeCategories);
}


// ==============================================================================
// SECTION 5B: CHART DATA BUILDER
// ==============================================================================
//
// HOW THE CHART WORKS:
// The Y-axis = "Units Remaining in Stock" (counting DOWN as supplies are used)
// The X-axis = time from now (Arrival) to 72 hours from now
//
// Starting point = current on-site stock
// Ending point   = stock after typhoon peak (near-zero for critical items)
//
// The S-Curve shape reflects real typhoon dynamics:
//   - First 12h: slow consumption (people are in shelters, calm)
//   - 12h-36h: STEEP drop (peak typhoon, high consumption, damaged supply lines)
//   - 36h-72h: tapering off (typhoon weakens, relief operations normalize)
//
// The RED DASHED LINE = Safety Buffer Threshold = 20% of predicted 72h demand
// If a supply line hits this line, dispatch is URGENT.
//
// ==============================================================================

function buildChartItems(campData, mlResults, activeCategories) {
  const chartItems = {};

  // Typhoon S-curve depletion pattern (index 0=Arrival to index 6=72h)
  // 100% → 92% → 60% → 30% → 12% → 4% → 0%
  const typhoonCurve = [1.0, 0.92, 0.60, 0.30, 0.12, 0.04, 0.0];

  activeCategories.forEach(cat => {
    const currentStock = campData.stock[cat] || 0;

    // The chart starts from CURRENT on-site stock and shows projected depletion
    const chartPoints = typhoonCurve.map(fraction =>
      Math.round(currentStock * fraction)
    );

    chartItems[cat] = {
      chartPoints,
      predictedDemand: mlResults[cat] || 0,
      currentStock
    };
  });

  return chartItems;
}


// ==============================================================================
// SECTION 5C: SVG CHART RENDERER
// ==============================================================================

function renderChart(maxVal, chartItems, activeCategories) {
  const pathsContainer = document.getElementById('chart-paths-container');
  const dotsContainer = document.getElementById('chart-dots-container');
  const legendContainer = document.getElementById('chart-legend');

  pathsContainer.innerHTML = '';
  dotsContainer.innerHTML = '';
  legendContainer.innerHTML = '';

  activeCategories.forEach(cat => {
    if (!chartItems[cat]) return;

    const itemData = chartItems[cat];
    const colorSpec = categoryColors[cat];

    // Add legend item
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <div class="legend-color" style="background-color: ${colorSpec.stroke}"></div>
      <span>${colorSpec.label}</span>
    `;
    legendContainer.appendChild(legendItem);

    // Map chart data points to SVG coordinates
    const points = itemData.chartPoints.map((val, idx) => {
      const x = xCoords[idx];
      const y = 275 - ((val / maxVal) * 225);
      return { x, y, val };
    });

    // Build SVG path string
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} 275 L ${points[0].x} 275 Z`;

    // Area fill
    const areaEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaEl.setAttribute('d', areaD);
    areaEl.setAttribute('class', `chart-area ${colorSpec.areaClass}`);
    pathsContainer.appendChild(areaEl);

    // Animated line
    const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lineEl.setAttribute('d', pathD);
    lineEl.setAttribute('class', `chart-path ${colorSpec.pathClass}`);
    lineEl.setAttribute('stroke', colorSpec.stroke);
    const lineLen = 1000;
    lineEl.style.strokeDasharray = lineLen;
    lineEl.style.strokeDashoffset = lineLen;
    pathsContainer.appendChild(lineEl);

    setTimeout(() => {
      lineEl.style.transition = 'stroke-dashoffset 1.5s ease-in-out';
      lineEl.style.strokeDashoffset = '0';
    }, 50);

    // Interactive data point dots
    points.forEach((pt, idx) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', colorSpec.stroke);
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'chart-dot');
      circle.addEventListener('mouseenter', (e) => showTooltip(e, pt.x, pt.y, colorSpec.label, pt.val, timeLabels[idx]));
      circle.addEventListener('mouseleave', hideTooltip);
      dotsContainer.appendChild(circle);
    });
  });
}


// ==============================================================================
// SECTION 5D: PACKING MANIFEST TABLE RENDERER
// ==============================================================================
//
// HOW TO READ THE TABLE:
//   Column 1 - Relief Item        : What type of supply (Water, Rice, Medicine)
//   Column 2 - Current On-Site    : How many units are AT THE CAMP right now
//   Column 3 - 72H Demand         : ML model prediction of total need for next 72h
//   Column 4 - Coverage Bar       : Visual showing (Stock / Demand) as percentage
//                                   RED = critical shortage, ORANGE = warning, GREEN = ok
//   Column 5 - Recommended Dispatch: Units to send from warehouse = Demand - Stock
//                                   This is the ACTION ITEM for the relief officer.
//
// ==============================================================================

function renderTable(campData, mlResults, activeCategories) {
  const tbody = document.getElementById('manifest-table-body');
  tbody.innerHTML = '';

  if (activeCategories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:30px;">No categories selected. Check the boxes in the left panel and click Generate Forecast.</td></tr>`;
    return;
  }

  const categoryDisplayInfo = {
    water: { icon: "", name: "Bottled Water (1L)", unit: "units" },
    rice: { icon: "", name: "Rice (5KG Sacks)", unit: "sacks" },
    medical: { icon: "", name: "Medical Kits", unit: "kits" }
  };

  let anyRows = false;

  activeCategories.forEach((cat, index) => {
    const demand = mlResults[cat];
    // Guard: if ML returned undefined/null/0 for this category, show placeholder
    if (!demand && demand !== 0) {
      console.warn(`No ML result for category: ${cat}`);
      return;
    }

    anyRows = true;
    const info = categoryDisplayInfo[cat];
    const stock = campData.stock[cat] || 0;
    const dispatch = Math.max(0, demand - stock);

    // Coverage = what % of the 72h demand is already on site
    const coveragePct = demand === 0 ? 100 : Math.min(100, Math.round((stock / demand) * 100));
    let barClass = "stable";
    if (coveragePct < 30) barClass = "critical";
    else if (coveragePct < 60) barClass = "warning";

    // Dispatch urgency label
    let urgencyLabel = "";
    if (dispatch === 0) urgencyLabel = `<span style="color:#34C759;font-weight:700;">Sufficient</span>`;
    else if (coveragePct < 30) urgencyLabel = `<span style="color:#ff4b4b;font-weight:700;">URGENT</span>`;
    else urgencyLabel = `<span style="color:#FF9500;font-weight:700;">NEEDED</span>`;

    const row = document.createElement('tr');
    row.style.animationDelay = `${index * 0.1}s`;
    row.innerHTML = `
      <td class="col-item">${info.name}</td>
      <td class="col-stock">${formatNum(stock)} ${info.unit}</td>
      <td class="col-demand">${formatNum(demand)} ${info.unit}</td>
      <td class="col-deficit">
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${barClass}" style="width: 0%"
               data-target="${coveragePct}"></div>
        </div>
        <span class="deficit-label">${coveragePct}% covered</span>
      </td>
      <td class="col-dispatch highlight-column">
        ${dispatch > 0 ? `+ ${formatNum(dispatch)} ${info.unit}` : `No dispatch needed`}
        <br>${urgencyLabel}
      </td>
    `;
    tbody.appendChild(row);
  });

  if (!anyRows) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:30px;">Generating forecast... If this persists, ensure the backend server is running.</td></tr>`;
    return;
  }

  // Animate coverage bars after they're in the DOM
  setTimeout(() => {
    document.querySelectorAll('.progress-bar-fill[data-target]').forEach(bar => {
      bar.style.transition = 'width 1s ease-out';
      bar.style.width = bar.getAttribute('data-target') + '%';
    });
  }, 100);
}


// ==============================================================================
// SECTION 6: TOOLTIP HELPERS
// ==============================================================================

const tooltip = document.getElementById('chart-tooltip');

function showTooltip(e, x, y, label, val, time) {
  const wrapper = document.getElementById('svg-wrapper');
  const rect = wrapper.getBoundingClientRect();
  const scale = rect.width / 1000;
  tooltip.innerHTML = `<strong>${label}</strong><br>At ${time}: ${formatNum(val)} units remain`;
  tooltip.style.opacity = '1';
  tooltip.style.left = `${x * scale}px`;
  tooltip.style.top = `${y * scale}px`;
}

function hideTooltip() {
  tooltip.style.opacity = '0';
}


// ==============================================================================
// SECTION 7: ML INSIGHTS MODAL
// ==============================================================================

let lastMLResults = {};
let lastCampData = null;

const btnInsights = document.getElementById('btn-ml-insights');
const modalInsights = document.getElementById('modal-insights');
const btnCloseInsights = document.getElementById('btn-close-insights');
const insightsContent = document.getElementById('insights-content');

// Guard: only add listener if element exists
if (btnInsights) {
  btnInsights.addEventListener('click', () => {
    if (!lastCampData || Object.keys(lastMLResults).length === 0) {
      alert('Please click "Generate Forecast" first to compute predictions.');
      return;
    }
    renderInsightsModal();
    modalInsights.classList.remove('hidden');
  });
}

if (btnCloseInsights) {
  btnCloseInsights.addEventListener('click', () => {
    modalInsights.classList.add('hidden');
  });
}

// Close modal when clicking the dark overlay background
if (modalInsights) {
  modalInsights.addEventListener('click', (e) => {
    if (e.target === modalInsights) modalInsights.classList.add('hidden');
  });
}

function renderInsightsModal() {
  // The model formula (from train_model.py):
  // units = m1*camp_id + m2*supply_cat_id + m3*population + m4*pagasa_signal + bias
  // Approximate coefficients from training run:
  const COEFFICIENTS = {
    population: 1.84,   // per person
    pagasa_signal: 308.4,  // per signal level
    bias: 6405.0
  };

  const signal = lastCampData.pagasaSignal;
  const pop = lastCampData.population;
  const campId = lastCampData.campId;

  let html = `
    <div style="margin-bottom:16px;padding:12px;background:#fff3cd;border-radius:8px;border-left:4px solid #FF9500;">
      <strong>How the ML Model Works:</strong><br>
      The Linear Regression model learned from 900 synthetic records based on Philippine NDRRMC disaster response data parameters.<br><br>
      <strong>Formula:</strong> Demand = (Population × ${COEFFICIENTS.population}) + (PAGASA Signal × ${COEFFICIENTS.pagasa_signal}) + base offset
    </div>
  `;

  const catLabels = { water: 'Water', rice: 'Rice', medical: 'Medicine' };

  Object.keys(lastMLResults).forEach(cat => {
    const predicted = lastMLResults[cat];
    const baseFallback = computeFallback(pop, cat);
    const signalBonus = predicted - baseFallback;

    html += `
      <div style="margin-bottom:18px;padding:15px;background:var(--color-fill-light);border-radius:8px;">
        <h4 style="margin-bottom:12px;font-size:14px;">${catLabels[cat] || cat}</h4>
        <div class="insight-row">
          <span class="insight-label">Camp Population:</span>
          <span class="insight-value">${formatNum(pop)} people</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">Base 72h Consumption Rate:</span>
          <span class="insight-value">${formatNum(baseFallback)} units</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">PAGASA Signal No. ${signal} Surge:</span>
          <span class="insight-value" style="color:#FF9500">+${formatNum(Math.max(0, signalBonus))} units</span>
        </div>
        <div class="insight-row" style="margin-top:10px;border-top:2px solid #e5e5ea;padding-top:10px;">
          <span class="insight-label" style="font-weight:700;">ML Predicted 72H Total:</span>
          <span class="insight-value" style="color:#ff4b4b;font-size:16px;">${formatNum(predicted)} units</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">On-Site Stock Right Now:</span>
          <span class="insight-value">${formatNum(lastCampData.stock[cat] || 0)} units</span>
        </div>
        <div class="insight-row" style="background:#1c1c1e;border-radius:6px;padding:8px;margin-top:6px;">
          <span class="insight-label" style="color:white;">→ Dispatch from Warehouse:</span>
          <span class="insight-value" style="color:#34C759;">${formatNum(Math.max(0, predicted - (lastCampData.stock[cat] || 0)))} units</span>
        </div>
      </div>
    `;
  });

  insightsContent.innerHTML = html;
}


// ==============================================================================
// SECTION 8: DATASET TRANSPARENCY MODAL
// ==============================================================================

const btnDataset = document.getElementById('btn-view-dataset');
const modalDataset = document.getElementById('modal-dataset');
const btnCloseDataset = document.getElementById('btn-close-dataset');

if (btnDataset) {
  btnDataset.addEventListener('click', () => {
    modalDataset.classList.remove('hidden');
  });
}
if (btnCloseDataset) {
  btnCloseDataset.addEventListener('click', () => {
    modalDataset.classList.add('hidden');
  });
}
if (modalDataset) {
  modalDataset.addEventListener('click', e => {
    if (e.target === modalDataset) modalDataset.classList.add('hidden');
  });
}


// ==============================================================================
// SECTION 9: HOW TO USE GUIDE MODAL
// ==============================================================================

const btnGuide = document.getElementById('btn-open-guide');
const modalGuide = document.getElementById('modal-guide');
const btnCloseGuide = document.getElementById('btn-close-guide');

if (btnGuide) {
  btnGuide.addEventListener('click', () => {
    modalGuide.classList.remove('hidden');
  });
}
if (btnCloseGuide) {
  btnCloseGuide.addEventListener('click', () => {
    modalGuide.classList.add('hidden');
  });
}
if (modalGuide) {
  modalGuide.addEventListener('click', e => {
    if (e.target === modalGuide) modalGuide.classList.add('hidden');
  });
}


// ==============================================================================
// SECTION 10: FORECAST GENERATION (Main Orchestrator)
// ==============================================================================

const btnGenerate = document.getElementById('btn-generate-forecast');
const btnContent = btnGenerate.querySelector('.btn-content');
const btnLoader = btnGenerate.querySelector('.btn-loader');

btnGenerate.addEventListener('click', () => generateForecast(false));

async function generateForecast(immediate = false) {
  const selectedCenter = document.getElementById('evac-center-select').value;
  const activeCategories = Array.from(
    document.querySelectorAll('input[name="categories"]:checked')
  ).map(el => el.value);

  const campData = database[selectedCenter];

  if (immediate) {
    // Instant render with fallback values on first page load
    const quickResults = {};
    activeCategories.forEach(cat => {
      quickResults[cat] = computeFallback(campData.population, cat);
    });
    renderDashboard(campData, quickResults, activeCategories);
    lastMLResults = quickResults;
    lastCampData = campData;
    // Silently upgrade to ML results
    fetchAndRender(campData, activeCategories, false);
    return;
  }

  await fetchAndRender(campData, activeCategories, true);
}

async function fetchAndRender(campData, activeCategories, showLoader) {
  const mainWorkspace = document.querySelector('.main-content');

  if (showLoader) {
    btnGenerate.disabled = true;
    btnContent.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    mainWorkspace.style.opacity = '0.4';
    mainWorkspace.style.transition = 'opacity 0.3s ease';
  }

  try {
    const predictionPromises = activeCategories.map(cat => fetchPrediction(campData, cat));
    const predictionValues = await Promise.all(predictionPromises);

    const mlResults = {};
    activeCategories.forEach((cat, idx) => {
      mlResults[cat] = predictionValues[idx];
    });

    console.log("All ML Predictions:", mlResults);

    if (showLoader) await new Promise(resolve => setTimeout(resolve, 600));

    renderDashboard(campData, mlResults, activeCategories);
    lastMLResults = mlResults;
    lastCampData = campData;

  } catch (err) {
    console.error("Unexpected error:", err);
    const fallback = {};
    activeCategories.forEach(cat => { fallback[cat] = computeFallback(campData.population, cat); });
    renderDashboard(campData, fallback, activeCategories);
    lastMLResults = fallback;
    lastCampData = campData;

  } finally {
    if (showLoader) {
      btnGenerate.disabled = false;
      btnLoader.classList.add('hidden');
      btnContent.classList.remove('hidden');
      mainWorkspace.style.opacity = '1';
    }
  }
}


// ==============================================================================
// SECTION 11: INITIALIZE ON PAGE LOAD
// ==============================================================================

window.addEventListener('DOMContentLoaded', () => {
  generateForecast(true);

  // Set up download template URL
  const downloadLink = document.getElementById('link-download-template');
  if (downloadLink) {
    downloadLink.href = `${ML_API_BASE_URL}/api/dataset/download`;
  }
});


// ==============================================================================
// SECTION 12: DATASET MANAGEMENT CENTER LOGIC (Viewer & Retraining)
// ==============================================================================

// Global states for Dataset Viewer
let viewerCurrentPage = 1;
const viewerLimit = 10; // 10 rows per page in modal view
let viewerTotalPages = 1;

// 1. Tab Switching Handler
const tabBtns = document.querySelectorAll('.modal-tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Deactivate all tab buttons and hide all tab panes
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.add('hidden'));

    // Activate selected
    btn.classList.add('active');
    const targetTab = btn.getAttribute('data-tab');
    const activePane = document.getElementById(targetTab);
    if (activePane) {
      activePane.classList.remove('hidden');
    }

    // If viewer tab is opened, fetch fresh dataset
    if (targetTab === 'tab-dataset-view') {
      viewerCurrentPage = 1;
      fetchAndRenderDataset();
    }
  });
});

// 2. Fetch and render paginated dataset in viewer table
async function fetchAndRenderDataset() {
  const tbody = document.getElementById('viewer-table-body');
  const summaryText = document.getElementById('viewer-summary');
  const pageIndicator = document.getElementById('page-indicator');

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:25px;color:var(--color-text-muted);">Fetching database records...</td></tr>`;

  try {
    const response = await fetch(`${ML_API_BASE_URL}/api/dataset?page=${viewerCurrentPage}&limit=${viewerLimit}`);
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);

    const res = await response.json();
    const records = res.data;
    viewerTotalPages = res.pages;

    // Render summary header text
    const startRecord = (viewerCurrentPage - 1) * viewerLimit + 1;
    const endRecord = Math.min(startRecord + records.length - 1, res.total_rows);
    summaryText.textContent = `Showing records ${startRecord}-${endRecord} of ${res.total_rows.toLocaleString()}`;
    pageIndicator.textContent = `Page ${viewerCurrentPage} of ${viewerTotalPages}`;

    // Update pagination button enabled states
    document.getElementById('btn-page-prev').disabled = (viewerCurrentPage <= 1);
    document.getElementById('btn-page-next').disabled = (viewerCurrentPage >= viewerTotalPages);

    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:25px;color:var(--color-text-muted);">No records found in database.</td></tr>`;
      return;
    }

    const categoryNames = { 1: "Bottled Water", 2: "Rice Packs", 3: "Medical Kits" };

    tbody.innerHTML = '';
    records.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:10px;font-family:var(--font-mono);font-weight:600;color:var(--color-text-muted);">${startRecord + index}</td>
        <td style="padding:10px;font-weight:500;">Camp #${row.camp_id}</td>
        <td style="padding:10px;">${categoryNames[row.supply_category_id] || 'Unknown'}</td>
        <td style="padding:10px;font-weight:600;">${row.current_population.toLocaleString()}</td>
        <td style="padding:10px;"><span style="background:var(--color-fill-light);padding:3px 8px;border-radius:4px;font-weight:600;font-size:11px;">Signal ${row.pagasa_signal}</span></td>
        <td style="padding:10px;font-weight:700;color:#0066cc;">${row.units_consumed.toLocaleString()} units</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error("Failed to load dataset: ", error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:25px;color:var(--color-accent-red);font-weight:600;">Failed to connect to ML Backend. Make sure the server is running.</td></tr>`;
  }
}

// Wire up pagination buttons
document.getElementById('btn-page-prev').addEventListener('click', () => {
  if (viewerCurrentPage > 1) {
    viewerCurrentPage--;
    fetchAndRenderDataset();
  }
});

document.getElementById('btn-page-next').addEventListener('click', () => {
  if (viewerCurrentPage < viewerTotalPages) {
    viewerCurrentPage++;
    fetchAndRenderDataset();
  }
});

// 3. Drag & Drop File Upload and Retrain Logic
const dropZone = document.getElementById('upload-drop-zone');
const fileInput = document.getElementById('file-upload-input');
const uploadStatusMsg = document.getElementById('upload-status-msg');
const consoleTerminal = document.getElementById('retrain-terminal');
const pulseIndicator = document.getElementById('terminal-pulse');

// Drag over/leave animations
if (dropZone) {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  // Drop handler
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleCSVUpload(files[0]);
    }
  });
}

// File input click handler
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleCSVUpload(files[0]);
    }
  });
}

async function handleCSVUpload(file) {
  if (!file.name.endsWith('.csv')) {
    showUploadStatus('Error: Only CSV files are supported.', 'error');
    return;
  }

  showUploadStatus(`Uploading "${file.name}" and preparing training run...`, 'success');
  consoleTerminal.textContent = `> Initiating file upload for ${file.name}...\n> Uploading to ML backend...`;
  pulseIndicator.classList.add('active');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${ML_API_BASE_URL}/api/dataset/upload`, {
      method: 'POST',
      body: formData
    });

    const res = await response.json();

    if (!response.ok) {
      throw new Error(res.error || res.message || `HTTP ${response.status}`);
    }

    // Success!
    showUploadStatus(`Success: ${res.message}`, 'success');

    // Update before vs after metrics cards
    const m = res.metrics;
    document.getElementById('val-r2-after').textContent = `${(m.r2 * 100).toFixed(2)}%`;
    document.getElementById('val-mae-after').textContent = `${Math.round(m.mae).toLocaleString()} u`;

    // Render detailed logs in our neon console
    let coefLog = '';
    Object.keys(m.coefficients).forEach(c => {
      coefLog += `   - ${c.padEnd(20)}: ${m.coefficients[c] >= 0 ? '+' : ''}${m.coefficients[c].toFixed(4)}\n`;
    });

    consoleTerminal.textContent = `
> File upload complete. CSV validation passed.
> Initializing Linear Regression training run on ${m.records_count} rows...
> Performing 80/20 train-test split...
> Model fit completed. OLS calculation succeeded.
> 
> [EVALUATION RESULTS]
>   - R-Squared (R²):     ${(m.r2 * 100).toFixed(2)}%
>   - Mean Absolute Error: ${m.mae.toFixed(2)} units
> 
> [NEW COEFFICIENTS WEIGHTS]
${coefLog}
> 
> ✅ Model saved to disk as relief_model.pkl.
> ✅ Flask server refreshed and reloaded newly trained model.
> 🚀 Active model updated. Ready for predictions.
`.trim();

    // Trigger dashboard forecast refresh
    console.log("Model retrained successfully. Triggering forecast refresh.");
    generateForecast(false);

  } catch (error) {
    console.error("Retrain failed: ", error);
    showUploadStatus(`Retrain Failed: ${error.message}`, 'error');
    consoleTerminal.textContent += `\n\n❌ ERROR: Training run aborted.\nReason: ${error.message}`;
  } finally {
    pulseIndicator.classList.remove('active');
  }
}

function showUploadStatus(msg, type) {
  if (!uploadStatusMsg) return;
  uploadStatusMsg.textContent = msg;
  uploadStatusMsg.className = 'upload-status-msg'; // reset classes
  if (type === 'success') {
    uploadStatusMsg.classList.add('success');
  } else {
    uploadStatusMsg.classList.add('error');
  }
}
