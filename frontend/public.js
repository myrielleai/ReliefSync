/**
 * ReliefSync — Public Accountability Dashboard JS
 * Fetches live ML predictions from the backend.
 * Falls back to localStorage cache if backend is offline.
 */

const ML_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "http://127.0.0.1:5000" 
    : "https://reliefsync-qlev.onrender.com";
const CACHE_PREFIX = 'reliefync_public_cache_';

const campDatabase = {
  brgy_172: {
    name: 'Brgy. 172 Covered Court',
    location: 'Caloocan City, NCR',
    population: 1250,
    pagasaSignal: 4,
    campId: 1,
    stock: { water: 280, rice: 90, medical: 25 }
  },
  brgy_173: {
    name: 'Brgy. 173 Gymnasium',
    location: 'Caloocan City, NCR',
    population: 850,
    pagasaSignal: 3,
    campId: 2,
    stock: { water: 3200, rice: 1100, medical: 420 }
  },
  brgy_174: {
    name: 'Brgy. 174 Elementary School',
    location: 'Caloocan City, NCR',
    population: 1900,
    pagasaSignal: 5,
    campId: 3,
    stock: { water: 1800, rice: 750, medical: 200 }
  }
};

const supplyItems = [
  { key: 'water',   label: 'Bottled Water (1L)',  unit: 'units',  supplyId: 1 },
  { key: 'rice',    label: 'Rice Packs (5kg)',     unit: 'sacks',  supplyId: 2 },
  { key: 'medical', label: 'Medical Kits',          unit: 'kits',   supplyId: 3 }
];

function formatNum(n) {
  return Number(n).toLocaleString('en-US');
}

function computeFallback(population, itemKey) {
  const rates = { water: 2.5, rice: 0.8, medical: 0.12 };
  return Math.round(population * (rates[itemKey] || 2.5));
}

async function fetchOnePrediction(campData, itemKey) {
  const payload = {
    camp_id: campData.campId,
    population: campData.population,
    pagasa_signal: campData.pagasaSignal,
    item_type: itemKey
  };
  const resp = await fetch(`${ML_API}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error(`Server error ${resp.status}`);
  const data = await resp.json();
  return data.recommended_dispatch;
}

function showOfflineBanner(timestamp) {
  const banner = document.getElementById('offline-banner');
  const text = document.getElementById('offline-banner-text');
  if (banner) {
    banner.classList.remove('hidden');
    if (text && timestamp) {
      const d = new Date(timestamp);
      const formatted = d.toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      text.textContent = `Backend offline — showing last known data as of ${formatted}. Live predictions unavailable.`;
    }
  }
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.add('hidden');
}

function getAlertClass(ratio) {
  if (ratio < 0.30) return 'critical';
  if (ratio < 0.60) return 'warning';
  return 'stable';
}
function getAlertLabel(ratio) {
  if (ratio < 0.30) return 'CRITICAL';
  if (ratio < 0.60) return 'WARNING';
  return 'STABLE';
}

function renderDashboard(campKey, campData, results, fromCache, cacheTimestamp) {
  const dashboard = document.getElementById('pub-dashboard');
  const loading = document.getElementById('pub-loading');
  loading.classList.add('hidden');
  dashboard.classList.remove('hidden');

  // Camp meta
  document.getElementById('pub-camp-name').textContent     = campData.name;
  document.getElementById('pub-camp-location').textContent = campData.location;
  document.getElementById('pub-population').textContent    = formatNum(campData.population) + ' people';
  document.getElementById('pub-pagasa').textContent        = 'Signal No. ' + campData.pagasaSignal;

  // Last updated timestamp
  const now = new Date();
  const lastUpdatedEl = document.getElementById('pub-last-updated');
  if (fromCache && cacheTimestamp) {
    const d = new Date(cacheTimestamp);
    lastUpdatedEl.textContent = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) +
      ', ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  } else {
    lastUpdatedEl.textContent = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) +
      ', ' + now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  }

  // Compute worst-case per-item ratio (same logic as officer portal)
  let worstRatio = Infinity;
  let worstItemLabel = '';
  supplyItems.forEach(item => {
    const stock  = campData.stock[item.key] || 0;
    const demand = results[item.key] || 1;
    const ratio  = stock / demand;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worstItemLabel = item.label;
    }
  });

  const alertClass = getAlertClass(worstRatio);
  const alertLabel = getAlertLabel(worstRatio);

  // Alert badge
  const alertCard = document.getElementById('pub-alert-card');
  alertCard.className = 'pub-badge-card pub-badge-alert alert-' + alertClass;
  document.getElementById('pub-alert-level').textContent = alertLabel;

  // Alert indicator text
  const indicatorEl = document.getElementById('pub-alert-indicator');
  if (alertClass === 'critical') {
    indicatorEl.textContent = `${worstItemLabel} is critically low — this camp needs immediate resupply.`;
    indicatorEl.style.color = '#b91c1c';
  } else if (alertClass === 'warning') {
    indicatorEl.textContent = `${worstItemLabel} is below safe level — dispatch recommended within 24 hours.`;
    indicatorEl.style.color = '#c2410c';
  } else {
    indicatorEl.textContent = 'All supplies are sufficient for the next 72 hours based on current stock levels.';
    indicatorEl.style.color = '#15803d';
  }

  // Supply cards
  const grid = document.getElementById('pub-supply-grid');
  grid.innerHTML = '';

  supplyItems.forEach(item => {
    const stock   = campData.stock[item.key] || 0;
    const demand  = results[item.key] || 1;
    const ratio   = stock / demand;
    const pct     = Math.min(100, Math.round(ratio * 100));
    const cls     = getAlertClass(ratio);

    const card = document.createElement('div');
    card.className = 'pub-supply-card';
    card.innerHTML = `
      <div class="pub-supply-card-header">
        <span class="pub-supply-item-name">${item.label}</span>
        <span class="pub-coverage-badge ${cls}">${pct}% covered</span>
      </div>
      <div class="pub-supply-bar-track">
        <div class="pub-supply-bar-fill ${cls}" style="width: 0%" data-target="${pct}"></div>
      </div>
      <div class="pub-supply-stats">
        <div class="pub-stat">
          <span class="pub-stat-label">On-Site Stock</span>
          <span class="pub-stat-value">${formatNum(stock)} ${item.unit}</span>
        </div>
        <div class="pub-stat">
          <span class="pub-stat-label">AI Forecast (72h)</span>
          <span class="pub-stat-value">${formatNum(demand)} ${item.unit}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.pub-supply-bar-fill[data-target]').forEach(bar => {
      bar.style.transition = 'width 1s ease-out';
      bar.style.width = bar.getAttribute('data-target') + '%';
    });
  }, 80);
}

async function loadCampData(campKey) {
  const campData = campDatabase[campKey];
  const loading   = document.getElementById('pub-loading');
  const dashboard = document.getElementById('pub-dashboard');

  loading.classList.remove('hidden');
  dashboard.classList.add('hidden');
  hideOfflineBanner();

  try {
    // Attempt to fetch live predictions from the backend
    const predictions = {};
    for (const item of supplyItems) {
      predictions[item.key] = await fetchOnePrediction(campData, item.key);
    }

    // Cache successful result in localStorage
    const cachePayload = {
      timestamp: new Date().toISOString(),
      campKey,
      results: predictions
    };
    try {
      localStorage.setItem(CACHE_PREFIX + campKey, JSON.stringify(cachePayload));
    } catch(e) { /* storage full, ignore */ }

    renderDashboard(campKey, campData, predictions, false, null);

  } catch (err) {
    console.warn('Backend unreachable. Attempting to load from cache...', err.message);

    // Try to load from localStorage cache
    let cached = null;
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + campKey);
      if (raw) cached = JSON.parse(raw);
    } catch(e) { /* corrupt cache, ignore */ }

    if (cached && cached.results) {
      showOfflineBanner(cached.timestamp);
      renderDashboard(campKey, campData, cached.results, true, cached.timestamp);
    } else {
      // Total fallback: use SPHERE-based formula
      showOfflineBanner(null);
      const fallback = {};
      supplyItems.forEach(item => {
        fallback[item.key] = computeFallback(campData.population, item.key);
      });
      renderDashboard(campKey, campData, fallback, true, null);
    }
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('pub-camp-select');

  // Load default camp on page open
  loadCampData(select.value);

  // Reload whenever user changes camp
  select.addEventListener('change', () => {
    loadCampData(select.value);
  });
});
