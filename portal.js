/**
 * ReliefSync — Disaster Logistics Engine
 * Operational Portal Dashboard Logic
 */

// --- 1. Mock Database for Evacuation Centers ---
const database = {
  brgy_172: {
    name: "Brgy. 172 Covered Court",
    population: "1,250",
    alertLevel: "CRITICAL",
    dispatchWindow: "Within 4 Hours",
    maxChartVal: 4000,
    yTicks: ["4,000", "2,500", "1,000", "0"],
    bufferVal: 1688,
    items: {
      water: {
        name: "💧 Bottled Water (1L)",
        demand: "3,750 Units",
        stock: "800 Units",
        recommended: "➕ 2,950 Units",
        chartPoints: [3500, 2800, 2100, 1500, 1000, 600, 400]
      },
      rice: {
        name: "🌾 Rice (5KG Packs)",
        demand: "1,250 Packs",
        stock: "400 Packs",
        recommended: "➕ 850 Packs",
        chartPoints: [1200, 1050, 850, 700, 550, 420, 300]
      },
      medical: {
        name: "🩹 Medical Kits",
        demand: "500 Kits",
        stock: "150 Kits",
        recommended: "➕ 350 Units",
        chartPoints: [480, 400, 350, 280, 210, 180, 120]
      }
    }
  },
  brgy_173: {
    name: "Brgy. 173 Gymnasium",
    population: "850",
    alertLevel: "WARNING",
    dispatchWindow: "Within 12 Hours",
    maxChartVal: 3000,
    yTicks: ["3,000", "2,000", "1,000", "0"],
    bufferVal: 1266,
    items: {
      water: {
        name: "💧 Bottled Water (1L)",
        demand: "2,550 Units",
        stock: "1,200 Units",
        recommended: "➕ 1,350 Units",
        chartPoints: [2500, 2200, 1900, 1600, 1300, 1100, 900]
      },
      rice: {
        name: "🌾 Rice (5KG Packs)",
        demand: "850 Packs",
        stock: "500 Packs",
        recommended: "➕ 350 Packs",
        chartPoints: [850, 750, 650, 580, 500, 420, 350]
      },
      medical: {
        name: "🩹 Medical Kits",
        demand: "340 Kits",
        stock: "200 Kits",
        recommended: "➕ 140 Units",
        chartPoints: [340, 310, 280, 250, 220, 190, 160]
      }
    }
  },
  brgy_174: {
    name: "Brgy. 174 Elementary School",
    population: "1,900",
    alertLevel: "CRITICAL",
    dispatchWindow: "Immediate (2h)",
    maxChartVal: 6000,
    yTicks: ["6,000", "4,000", "2,000", "0"],
    bufferVal: 2533,
    items: {
      water: {
        name: "💧 Bottled Water (1L)",
        demand: "5,700 Units",
        stock: "900 Units",
        recommended: "➕ 4,800 Units",
        chartPoints: [5500, 4300, 3100, 2100, 1400, 800, 450]
      },
      rice: {
        name: "🌾 Rice (5KG Packs)",
        demand: "1,900 Packs",
        stock: "600 Packs",
        recommended: "➕ 1,300 Packs",
        chartPoints: [1800, 1500, 1200, 900, 650, 450, 320]
      },
      medical: {
        name: "🩹 Medical Kits",
        demand: "760 Kits",
        stock: "300 Kits",
        recommended: "➕ 460 Units",
        chartPoints: [700, 620, 540, 450, 350, 260, 180]
      }
    }
  }
};

// Colors matching the grayscale hierarchy
const categoryColors = {
  water: { stroke: "#0066cc", label: "Bottled Water", areaClass: "area-water", pathClass: "path-water" },
  rice: { stroke: "#8b5a2b", label: "Rice Packs", areaClass: "area-rice", pathClass: "path-rice" },
  medical: { stroke: "#8e8e93", label: "Medical Kits", areaClass: "area-medical", pathClass: "path-medical" }
};

// X Coordinates for the 7 timeline milestones on the SVG (0h, 12h, 24h, 36h, 48h, 60h, 72h)
const xCoords = [80, 225, 370, 515, 660, 805, 950];
const timeLabels = ["Arrival", "12h", "24h", "36h", "48h", "60h", "72h"];

// --- 2. Render Dashboard Elements ---
function renderDashboard(data, activeCategories) {
  // Update Live Camp Status Cards
  document.getElementById('val-population').textContent = data.population;
  const alertCard = document.getElementById('card-alert');
  const alertVal = document.getElementById('val-alert');
  alertVal.textContent = data.alertLevel;
  
  if (data.alertLevel === "CRITICAL") {
    alertVal.style.color = "var(--color-accent-red)";
    alertCard.style.borderLeft = "4px solid var(--color-accent-red)";
  } else {
    alertVal.style.color = "#FF9500";
    alertCard.style.borderLeft = "4px solid #FF9500";
  }
  
  document.getElementById('val-window').textContent = data.dispatchWindow;
  
  // Update Y-Axis Ticks
  const yLabels = document.querySelectorAll('.label-y');
  data.yTicks.forEach((tick, idx) => {
    if (yLabels[idx]) yLabels[idx].textContent = tick;
  });

  // Render SVG Chart Lines
  renderChart(data, activeCategories);

  // Render Manifest Table Rows
  renderTable(data, activeCategories);
}

// --- 3. Draw SVG Line Chart Dynamically ---
function renderChart(data, activeCategories) {
  const pathsContainer = document.getElementById('chart-paths-container');
  const dotsContainer = document.getElementById('chart-dots-container');
  const legendContainer = document.getElementById('chart-legend');
  
  pathsContainer.innerHTML = '';
  dotsContainer.innerHTML = '';
  legendContainer.innerHTML = '';
  
  const maxVal = data.maxChartVal;
  
  activeCategories.forEach(cat => {
    if (!data.items[cat]) return;
    
    const itemData = data.items[cat];
    const colorSpec = categoryColors[cat];
    
    // Add Legend Item
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <div class="legend-color" style="background-color: ${colorSpec.stroke}"></div>
      <span>${colorSpec.label}</span>
    `;
    legendContainer.appendChild(legendItem);
    
    // Calculate SVG coordinates
    const points = itemData.chartPoints.map((val, idx) => {
      const x = xCoords[idx];
      const y = 275 - ((val / maxVal) * 225);
      return { x, y, val };
    });
    
    // Create Line Path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    
    const areaD = `${pathD} L ${points[points.length - 1].x} 275 L ${points[0].x} 275 Z`;
    
    // Inject Area Element
    const areaElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaElement.setAttribute('d', areaD);
    areaElement.setAttribute('class', `chart-area ${colorSpec.areaClass}`);
    pathsContainer.appendChild(areaElement);
    
    // Inject Line Element
    const lineElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lineElement.setAttribute('d', pathD);
    lineElement.setAttribute('class', `chart-path ${colorSpec.pathClass}`);
    lineElement.setAttribute('stroke', colorSpec.stroke);
    
    const length = 1000;
    lineElement.style.strokeDasharray = length;
    lineElement.style.strokeDashoffset = length;
    pathsContainer.appendChild(lineElement);
    
    setTimeout(() => {
      lineElement.style.transition = 'stroke-dashoffset 1.5s ease-in-out';
      lineElement.style.strokeDashoffset = '0';
    }, 50);
    
    // Draw Interactive Circles
    points.forEach((pt, idx) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', colorSpec.stroke);
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'chart-dot');
      
      circle.addEventListener('mouseenter', (e) => {
        showTooltip(e, pt.x, pt.y, colorSpec.label, pt.val, timeLabels[idx]);
      });
      circle.addEventListener('mouseleave', hideTooltip);
      
      dotsContainer.appendChild(circle);
    });
  });
}

// --- 4. Render Packing Manifest Table ---
function renderTable(data, activeCategories) {
  const tbody = document.getElementById('manifest-table-body');
  tbody.innerHTML = '';
  
  if (activeCategories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 30px;">No categories selected. Check boxes in the control panel to generate manifest.</td></tr>`;
    return;
  }
  
  activeCategories.forEach((cat, index) => {
    if (!data.items[cat]) return;
    const item = data.items[cat];
    
    const row = document.createElement('tr');
    row.style.animationDelay = `${index * 0.1}s`;
    row.innerHTML = `
      <td class="col-item">${item.name}</td>
      <td class="col-demand">${item.demand}</td>
      <td class="col-stock">${item.stock}</td>
      <td class="col-dispatch highlight-column">${item.recommended}</td>
    `;
    tbody.appendChild(row);
  });
}

// --- 5. Tooltip Helpers for SVG ---
const tooltip = document.getElementById('chart-tooltip');

function showTooltip(e, x, y, label, val, time) {
  const wrapper = document.getElementById('svg-wrapper');
  const rect = wrapper.getBoundingClientRect();
  const scale = rect.width / 1000;
  
  tooltip.innerHTML = `<strong>${label}</strong><br>Time: ${time}<br>Stock: ${val.toLocaleString()} units`;
  tooltip.style.opacity = '1';
  tooltip.style.left = `${x * scale}px`;
  tooltip.style.top = `${y * scale}px`;
}

function hideTooltip() {
  tooltip.style.opacity = '0';
}

// --- 6. Primary Action: Forecast Generation ---
const btnGenerate = document.getElementById('btn-generate-forecast');
const btnContent = btnGenerate.querySelector('.btn-content');
const btnLoader = btnGenerate.querySelector('.btn-loader');

btnGenerate.addEventListener('click', () => {
  generateForecast(false);
});

function generateForecast(immediate = false) {
  const selectedCenter = document.getElementById('evac-center-select').value;
  const activeCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked')).map(el => el.value);
  const data = database[selectedCenter];
  
  if (immediate) {
    renderDashboard(data, activeCategories);
    return;
  }
  
  btnGenerate.disabled = true;
  btnContent.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  
  const mainWorkspace = document.querySelector('.main-content');
  mainWorkspace.style.opacity = '0.4';
  mainWorkspace.style.transition = 'opacity 0.3s ease';
  
  setTimeout(() => {
    renderDashboard(data, activeCategories);
    btnGenerate.disabled = false;
    btnLoader.classList.add('hidden');
    btnContent.classList.remove('hidden');
    mainWorkspace.style.opacity = '1';
  }, 1200);
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  generateForecast(true);
});
