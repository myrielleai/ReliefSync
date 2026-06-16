/**
 * ReliefSync — Warehouse Execution Script (v3)
 * Dynamic dispatch configuration, URL param handoff, truck selector,
 * adaptive Kanban board, live route updates.
 */

// ══════════════════════════════════════════════════════════════════
// SECTION 1: DATA DEFINITIONS
// ══════════════════════════════════════════════════════════════════

const LOCATIONS = {
  depot_central: {
    name: 'Central Depot',
    fullName: 'Central Depot — Quezon City',
    coords: [14.6541, 121.0651],
    type: 'depot',
    population: null
  },
  depot_north: {
    name: 'North Depot',
    fullName: 'North Depot — Caloocan North',
    coords: [14.7950, 121.0200],
    type: 'depot',
    population: null
  },
  brgy_172: {
    name: 'Brgy. 172 Covered Court',
    fullName: 'Brgy. 172 Covered Court — CRITICAL',
    coords: [14.7570, 121.0374],
    type: 'camp',
    status: 'CRITICAL',
    population: 1250,
    pagasaSignal: 4,
    // Default full manifest dispatch quantities from this camp
    manifest: [
      { id: 'water',   name: 'BOTTLED WATER (1L)',  qty: '2,950',  unit: 'UNITS' },
      { id: 'rice',    name: 'RICE (5KG SACKS)',     qty: '850',    unit: 'PACKS' },
      { id: 'medical', name: 'MEDICAL KITS',         qty: '95',     unit: 'KITS'  }
    ]
  },
  brgy_173: {
    name: 'Brgy. 173 Gymnasium',
    fullName: 'Brgy. 173 Gymnasium — STABLE',
    coords: [14.7630, 121.0580],
    type: 'camp',
    status: 'STABLE',
    population: 850,
    pagasaSignal: 3,
    manifest: [
      { id: 'water',   name: 'BOTTLED WATER (1L)',  qty: '1,200',  unit: 'UNITS' },
      { id: 'rice',    name: 'RICE (5KG SACKS)',     qty: '420',    unit: 'PACKS' },
      { id: 'medical', name: 'MEDICAL KITS',         qty: '55',     unit: 'KITS'  }
    ]
  },
  brgy_174: {
    name: 'Brgy. 174 Elementary School',
    fullName: 'Brgy. 174 Elementary School — WARNING',
    coords: [14.7400, 121.0470],
    type: 'camp',
    status: 'WARNING',
    population: 1900,
    pagasaSignal: 5,
    manifest: [
      { id: 'water',   name: 'BOTTLED WATER (1L)',  qty: '4,500',  unit: 'UNITS' },
      { id: 'rice',    name: 'RICE (5KG SACKS)',     qty: '1,400',  unit: 'PACKS' },
      { id: 'medical', name: 'MEDICAL KITS',         qty: '170',    unit: 'KITS'  }
    ]
  }
};

const FLEET = [
  { id: 'T1', label: 'TRUCK #1', driver: 'R. Dela Cruz', capacity: '5 tons', coords: [14.760, 121.040], status: 'available' },
  { id: 'T2', label: 'TRUCK #2', driver: 'M. Santos',    capacity: '3 tons', coords: [14.755, 121.060], status: 'en_route'  },
  { id: 'T3', label: 'TRUCK #3', driver: 'J. Reyes',     capacity: '5 tons', coords: [14.750, 121.035], status: 'available' },
  { id: 'T4', label: 'TRUCK #4', driver: 'A. Bautista',  capacity: '3 tons', coords: [14.770, 121.050], status: 'unloading' },
];

// ══════════════════════════════════════════════════════════════════
// SECTION 2: MISSION STATE
// ══════════════════════════════════════════════════════════════════

const mission = {
  type:       'manifest',   // 'manifest' | 'surplus'
  fromKey:    'depot_central',
  toKey:      'brgy_172',
  truck:      null,
  surplusItem: null,  // { item, qty, unit, name } from URL params
};

// ══════════════════════════════════════════════════════════════════
// SECTION 3: URL PARAMETER PARSING
// ══════════════════════════════════════════════════════════════════

function parseURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('type') === 'surplus') {
    mission.type = 'surplus';
    mission.fromKey = params.get('from') || 'brgy_173';
    mission.toKey   = params.get('to')   || 'brgy_172';
    mission.surplusItem = {
      item: params.get('item') || 'medical',
      qty:  parseInt(params.get('qty'))  || 0,
      unit: params.get('unit') || 'kits',
      name: params.get('name') || 'Medical Kits'
    };
  } else if (params.get('from')) {
    mission.fromKey = params.get('from');
  }
  if (params.get('to')) {
    mission.toKey = params.get('to');
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 4: DOM BOOT
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  parseURLParams();

  // Apply parsed state to selectors
  const fromSelect = document.getElementById('from-select');
  const toSelect   = document.getElementById('to-select');
  if (fromSelect) fromSelect.value = mission.fromKey;
  if (toSelect)   toSelect.value   = mission.toKey;

  // Apply dispatch type toggle
  setDispatchType(mission.type);

  // Build truck selector
  renderTruckSelector();

  // Build Kanban
  rebuildKanban();

  // Update banner
  updateBanner();

  // Wire config events
  wireConfigEvents();

  // Wire bottom action buttons
  wireBottomButtons();

  // Init map (deferred so DOM has layout)
  setTimeout(initRoutingMap, 200);

  // Collapse panel button
  const collapseBtn = document.getElementById('btn-collapse-config');
  const configGrid  = document.getElementById('config-grid');
  const surplusPreview = document.getElementById('surplus-preview');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const isCollapsed = configGrid.classList.toggle('collapsed');
      if (surplusPreview) surplusPreview.classList.toggle('collapsed', isCollapsed);
      collapseBtn.textContent = isCollapsed ? '▼ Expand' : '▲ Collapse';
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// SECTION 5: CONFIG WIRING
// ══════════════════════════════════════════════════════════════════

function wireConfigEvents() {
  // Dispatch type toggle buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setDispatchType(btn.dataset.type);
      rebuildKanban();
      updateBanner();
    });
  });

  // From/To selectors
  const fromSelect = document.getElementById('from-select');
  const toSelect   = document.getElementById('to-select');

  if (fromSelect) {
    fromSelect.addEventListener('change', () => {
      mission.fromKey = fromSelect.value;
      rebuildKanban();
      updateBanner();
      updateRoute();
    });
  }

  if (toSelect) {
    toSelect.addEventListener('change', () => {
      mission.toKey = toSelect.value;
      rebuildKanban();
      updateBanner();
      updateRoute();
    });
  }
}

function setDispatchType(type) {
  mission.type = type;

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const surplusPreview = document.getElementById('surplus-preview');
  if (surplusPreview) {
    if (type === 'surplus' && mission.surplusItem) {
      surplusPreview.classList.remove('hidden');
      const qty = mission.surplusItem.qty > 0
        ? `${mission.surplusItem.qty.toLocaleString()} ${mission.surplusItem.unit}`
        : 'Qty not specified';
      document.getElementById('surplus-preview-text').textContent =
        `${mission.surplusItem.name} — ${qty}`;
    } else {
      surplusPreview.classList.add('hidden');
    }
  }

  // Update banner badge
  const typeBadge = document.getElementById('banner-type-badge');
  if (typeBadge) {
    typeBadge.textContent = type === 'surplus' ? 'SURPLUS TRANSFER' : 'FULL DISPATCH';
    typeBadge.style.background = type === 'surplus' ? '#7c3aed' : '#1a3a8f';
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 6: TRUCK SELECTOR
// ══════════════════════════════════════════════════════════════════

function renderTruckSelector() {
  const container = document.getElementById('truck-selector');
  if (!container) return;
  container.innerHTML = '';

  FLEET.forEach(truck => {
    const card = document.createElement('div');
    card.className = `truck-card truck-${truck.status}`;
    card.dataset.truckId = truck.id;

    const statusLabel = { available: '🟢 Available', en_route: '🟡 En Route', unloading: '🔴 Unloading' }[truck.status] || truck.status;

    card.innerHTML = `
      <div class="truck-card-top">
        <span class="truck-label">${truck.label}</span>
        <span class="truck-status-tag truck-status-${truck.status}">${statusLabel}</span>
      </div>
      <div class="truck-card-detail">
        <span>👤 ${truck.driver}</span>
        <span>⚖️ ${truck.capacity}</span>
      </div>
      ${truck.status === 'available' ? '<button class="truck-assign-btn" data-truck-id="' + truck.id + '">Assign →</button>' : '<span class="truck-unavailable-note">Currently unavailable</span>'}
    `;
    container.appendChild(card);

    if (truck.status === 'available') {
      card.querySelector('.truck-assign-btn').addEventListener('click', () => assignTruck(truck));
    }
  });
}

function assignTruck(truck) {
  mission.truck = truck;

  // Highlight selected card
  document.querySelectorAll('.truck-card').forEach(c => c.classList.remove('truck-selected'));
  const selectedCard = document.querySelector(`[data-truck-id="${truck.id}"]`);
  if (selectedCard) selectedCard.classList.add('truck-selected');

  // Update banner and assigned unit stat
  updateBanner();
  const assignedVal = document.getElementById('assigned-unit-val');
  if (assignedVal) assignedVal.textContent = `${truck.label} — ${truck.driver}`;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 7: KANBAN BOARD
// ══════════════════════════════════════════════════════════════════

function getKanbanItems() {
  if (mission.type === 'surplus' && mission.surplusItem && mission.surplusItem.qty > 0) {
    return [{
      id: mission.surplusItem.item,
      name: mission.surplusItem.name.toUpperCase(),
      qty:  mission.surplusItem.qty.toLocaleString(),
      unit: mission.surplusItem.unit.toUpperCase()
    }];
  }

  // Full manifest: from the destination camp's needs
  const toData = LOCATIONS[mission.toKey];
  if (toData && toData.manifest) {
    return toData.manifest.map(m => ({
      id:   m.id,
      name: m.name,
      qty:  m.qty,
      unit: m.unit
    }));
  }

  // Fallback for depot-to-depot or unrecognized
  return [
    { id: 'water',   name: 'BOTTLED WATER (1L)', qty: '—', unit: 'UNITS' },
    { id: 'rice',    name: 'RICE (5KG SACKS)',    qty: '—', unit: 'PACKS' },
    { id: 'medical', name: 'MEDICAL KITS',         qty: '—', unit: 'KITS'  }
  ];
}

function rebuildKanban() {
  const items = getKanbanItems();

  const pendingZone = document.getElementById('zone-pending');
  const loadingZone = document.getElementById('zone-loading');
  const loadedZone  = document.getElementById('zone-loaded');
  if (!pendingZone) return;

  // Reset all zones
  pendingZone.innerHTML = '';
  loadingZone.innerHTML = '';
  loadedZone.innerHTML  = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.id = `card-${item.id}`;
    card.innerHTML = `
      <span class="item-name">${item.name}</span>
      <span class="load-quantity">${item.qty} ${item.unit}</span>
    `;
    pendingZone.appendChild(card);
  });

  // Re-wire drag-and-drop
  wireDragAndDrop();
  updateKanbanCounts();
  updateKanbanMetaLabel();
  checkDispatchStatus();
}

function wireDragAndDrop() {
  const cards    = document.querySelectorAll('.kanban-card');
  const dropzones = document.querySelectorAll('.kanban-dropzone');

  cards.forEach(card => {
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend',   () => {
      card.classList.remove('dragging');
      updateKanbanCounts();
      checkDispatchStatus();
    });
  });

  dropzones.forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const dragging = document.querySelector('.dragging');
      if (dragging) {
        zone.appendChild(dragging);
        updateKanbanCounts();
        checkDispatchStatus();
      }
    });
  });
}

function updateKanbanCounts() {
  const zones = { pending: 'count-pending', loading: 'count-loading', loaded: 'count-loaded' };
  Object.entries(zones).forEach(([zoneId, countId]) => {
    const zone  = document.getElementById(`zone-${zoneId}`);
    const count = document.getElementById(countId);
    if (zone && count) count.textContent = zone.children.length;
  });
}

function updateKanbanMetaLabel() {
  const fromName = LOCATIONS[mission.fromKey]?.name || mission.fromKey;
  const toName   = LOCATIONS[mission.toKey]?.name   || mission.toKey;
  const label    = document.getElementById('kanban-route-label');
  if (label) label.textContent = `${fromName} → ${toName}`;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 8: DISPATCH STATUS CHECK
// ══════════════════════════════════════════════════════════════════

function checkDispatchStatus() {
  const btnDispatch  = document.getElementById('btn-dispatch-truck');
  const statusText   = document.getElementById('dispatch-status-text');
  const loadedZone   = document.getElementById('zone-loaded');
  const pendingZone  = document.getElementById('zone-pending');
  const loadingZone  = document.getElementById('zone-loading');
  if (!btnDispatch || !loadedZone) return;

  const totalCards  = document.querySelectorAll('.kanban-card').length;
  const loadedCards = loadedZone.children.length;

  // Unlock when at least 1 card is loaded AND a truck is assigned
  const canDispatch = loadedCards >= 1 && !!mission.truck;
  btnDispatch.disabled = !canDispatch;

  if (!mission.truck) {
    statusText.textContent = '⚠️ Assign a truck above before dispatching.';
    statusText.style.color = '#d97706';
  } else if (loadedCards === 0) {
    statusText.textContent = 'Move at least 1 item to "LOADED" to unlock dispatch.';
    statusText.style.color = '#555';
  } else if (loadedCards < totalCards) {
    statusText.textContent = `${loadedCards} of ${totalCards} items loaded — ready to dispatch partial load.`;
    statusText.style.color = '#2563eb';
  } else {
    statusText.textContent = `✅ All ${totalCards} items loaded on ${mission.truck.label}. Ready to dispatch!`;
    statusText.style.color = '#16a34a';
  }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 9: BANNER UPDATE
// ══════════════════════════════════════════════════════════════════

function updateBanner() {
  const badge = document.getElementById('banner-truck-badge');
  if (!badge) return;
  const truckLabel = mission.truck ? mission.truck.label : 'Unassigned';
  const toName     = LOCATIONS[mission.toKey]?.name || mission.toKey;
  badge.textContent = `${truckLabel} — ${toName}`;
}

// ══════════════════════════════════════════════════════════════════
// SECTION 10: BOTTOM BUTTON WIRING
// ══════════════════════════════════════════════════════════════════

function wireBottomButtons() {
  const btnPrint    = document.getElementById('btn-print-tag');
  const btnDispatch = document.getElementById('btn-dispatch-truck');
  const btnReturn   = document.getElementById('btn-return-portal');
  const btnNew      = document.getElementById('btn-new-mission');

  if (btnPrint) btnPrint.addEventListener('click', printWaybill);
  if (btnDispatch) btnDispatch.addEventListener('click', onDispatchConfirm);
  if (btnReturn) btnReturn.addEventListener('click', () => { window.location.href = 'portal.html'; });
  if (btnNew) btnNew.addEventListener('click', () => {
    document.getElementById('dispatch-success-overlay').classList.add('hidden');
    window.location.href = 'warehouse.html';
  });
}

function onDispatchConfirm() {
  const overlay = document.getElementById('dispatch-success-overlay');
  const title   = document.getElementById('success-truck-title');
  const receipt = document.getElementById('dispatch-receipt-body');
  if (!overlay) return;

  const truckLabel = mission.truck?.label || 'TRUCK #?';
  const toData     = LOCATIONS[mission.toKey];
  const fromData   = LOCATIONS[mission.fromKey];

  // Collect ONLY the items that are in the LOADED zone
  const loadedItems = [];
  document.querySelectorAll('#zone-loaded .kanban-card').forEach(card => {
    const name = card.querySelector('.item-name')?.textContent.trim()    || '';
    const qty  = card.querySelector('.load-quantity')?.textContent.trim() || '';
    loadedItems.push({ name, qty });
  });

  const txRef = '#TX-' + Math.floor(1000000 + Math.random() * 9000000) + '-M';
  const cargoList = loadedItems.map(i => `<li>${i.qty} — ${i.name}</li>`).join('');

  if (title)   title.textContent = `${truckLabel} DISPATCHED`;
  if (receipt) receipt.innerHTML = `
    <p><strong>From:</strong> ${fromData?.name || mission.fromKey}</p>
    <p><strong>Destination:</strong> ${toData?.name || mission.toKey}</p>
    <p><strong>Cargo Dispatched:</strong></p>
    <ul>${cargoList}</ul>
    <p class="ledger-tag">Transaction locked to LGU Ledger. Ref: <strong>${txRef}</strong></p>
  `;

  // ── Persist stock changes to localStorage so the portal dashboard updates ──
  persistDispatchToStorage(loadedItems, mission.toKey, mission.fromKey, txRef, truckLabel);

  overlay.classList.remove('hidden');
}

/**
 * Write dispatched quantities to localStorage so portal.js can apply them
 * on next load / when it checks for pending updates.
 */
function persistDispatchToStorage(loadedItems, toKey, fromKey, txRef, truckLabel) {
  // Map item name keywords to supply category keys used in portal.js
  function nameToKey(name) {
    const n = name.toLowerCase();
    if (n.includes('water'))   return 'water';
    if (n.includes('rice'))    return 'rice';
    if (n.includes('medical')) return 'medical';
    return null;
  }

  function parseQty(qtyStr) {
    // e.g. "2,950 UNITS" → 2950
    return parseInt(qtyStr.replace(/[^0-9]/g, '')) || 0;
  }

  // Read existing pending dispatches
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem('rs_pending_dispatches') || '[]'); } catch(e) {}

  const entry = {
    toKey,
    fromKey,
    txRef,
    truckLabel,
    timestamp: Date.now(),
    items: loadedItems
      .map(item => ({ key: nameToKey(item.name), qty: parseQty(item.qty) }))
      .filter(i => i.key && i.qty > 0)
  };

  pending.push(entry);
  localStorage.setItem('rs_pending_dispatches', JSON.stringify(pending));
}

// ══════════════════════════════════════════════════════════════════
// SECTION 11: WAYBILL PRINTING
// ══════════════════════════════════════════════════════════════════

function generateWaybillNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `WB-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function formatNow() {
  return new Date().toLocaleString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function buildWaybillHTML({ waybillNo, issuedDate, txRef, truckLabel, fromName, toName, toData, cargoItems, signed }) {
  const cargoRows = cargoItems.map((item, i) => `
    <tr>
      <td class="wb-cargo-num">${i + 1}</td>
      <td class="wb-cargo-name">${item.name}</td>
      <td class="wb-cargo-qty">${item.qty}</td>
    </tr>`).join('');

  const sigBlocks = [
    { label: 'Relief Officer',           name: signed?.officer  || '',  sub: 'Name & Date' },
    { label: 'Truck Driver / Courier',   name: signed?.driver   || '',  sub: 'Name & Date' },
    { label: 'Received By (Camp)',        name: signed?.receiver || '',  sub: 'Name, Position & Date' }
  ];

  const sigHTML = sigBlocks.map(s => `
    <div class="wb-sig-block">
      <div class="wb-sig-line">${s.name ? `<span class="wb-sig-filled">${s.name}</span>` : ''}</div>
      <div class="wb-sig-label">${s.label}</div>
      <div class="wb-sig-name">${s.name ? `<em>${s.sub}</em>` : s.sub}</div>
    </div>`).join('');

  const popText  = toData?.population ? `${toData.population.toLocaleString()} evacuees` : 'N/A';
  const sigText  = toData?.pagasaSignal ? `Signal No. ${toData.pagasaSignal}` : 'N/A';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dispatch Waybill ${waybillNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px; max-width: 680px; margin: 0 auto; }
    .wb-header { text-align: center; border-bottom: 3px double #111; padding-bottom: 14px; margin-bottom: 18px; }
    .wb-republic { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
    .wb-title { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 2px; }
    .wb-subtitle { font-size: 12px; color: #555; }
    .wb-type-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; background: #1a3a8f; color: #fff; font-size: 11px; font-weight: 700; border-radius: 12px; letter-spacing: 0.5px; }
    .wb-signed-stamp { display: inline-block; margin-left: 8px; padding: 2px 10px; background: #16a34a; color: #fff; font-size: 11px; font-weight: 700; border-radius: 12px; }
    .wb-section { border: 1px solid #ccc; border-radius: 6px; margin-bottom: 14px; overflow: hidden; }
    .wb-section-header { background: #f0f0f0; padding: 7px 14px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #444; border-bottom: 1px solid #ccc; }
    .wb-section-body { padding: 12px 14px; }
    .wb-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .wb-meta-item { display: flex; flex-direction: column; gap: 2px; }
    .wb-meta-label { font-size: 10px; font-weight: 700; color: #777; text-transform: uppercase; }
    .wb-meta-value { font-size: 13px; font-weight: 600; color: #111; }
    .wb-meta-value.waybill-no { font-size: 16px; font-weight: 800; color: #1a3a8f; font-family: monospace; }
    table.wb-cargo-table { width: 100%; border-collapse: collapse; }
    .wb-cargo-table th { background: #f0f0f0; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #ccc; }
    .wb-cargo-table td { padding: 10px; border-bottom: 1px solid #eee; font-size: 13px; }
    .wb-cargo-table tr:last-child td { border-bottom: none; }
    .wb-cargo-num  { width: 40px; color: #888; font-weight: 600; }
    .wb-cargo-name { font-weight: 600; }
    .wb-cargo-qty  { font-weight: 700; color: #1a3a8f; text-align: right; }
    .wb-sig-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .wb-sig-block { display: flex; flex-direction: column; gap: 4px; }
    .wb-sig-line { border-bottom: 1.5px solid #333; height: 36px; margin-bottom: 4px; display: flex; align-items: flex-end; padding-bottom: 4px; }
    .wb-sig-filled { font-size: 14px; font-family: Georgia, serif; font-style: italic; color: #111; font-weight: 700; }
    .wb-sig-label { font-size: 10px; color: #555; font-weight: 700; text-transform: uppercase; }
    .wb-sig-name  { font-size: 10px; color: #999; font-style: italic; }
    .wb-footer-note { text-align: center; font-size: 10px; color: #888; margin-top: 18px; padding-top: 10px; border-top: 1px solid #eee; }
    .wb-tx-ref { text-align: right; font-size: 11px; font-weight: 700; color: #1a3a8f; font-family: monospace; margin-top: 10px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="wb-header">
    <div class="wb-republic">Republic of the Philippines &nbsp;•&nbsp; DSWD / NDRRMC Operations</div>
    <div class="wb-title">ReliefSync — Dispatch Waybill</div>
    <div class="wb-subtitle">Supply Delivery and Acknowledgment Receipt</div>
    <span class="wb-type-badge">${signed ? 'COMPLETED DISPATCH' : 'PENDING DISPATCH'}</span>
    ${signed ? '<span class="wb-signed-stamp">✓ SIGNED</span>' : ''}
  </div>

  <div class="wb-section">
    <div class="wb-section-header">Document Reference</div>
    <div class="wb-section-body">
      <div class="wb-meta-grid">
        <div class="wb-meta-item">
          <span class="wb-meta-label">Waybill No.</span>
          <span class="wb-meta-value waybill-no">${waybillNo}</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Date &amp; Time Issued</span>
          <span class="wb-meta-value">${issuedDate}</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Issued By</span>
          <span class="wb-meta-value">ReliefSync — Relief Officer Portal</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Truck / Unit</span>
          <span class="wb-meta-value">${truckLabel}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="wb-section">
    <div class="wb-section-header">Route</div>
    <div class="wb-section-body">
      <div class="wb-meta-grid">
        <div class="wb-meta-item">
          <span class="wb-meta-label">Origin</span>
          <span class="wb-meta-value">${fromName}</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Destination</span>
          <span class="wb-meta-value">${toName}</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Evacuee Population</span>
          <span class="wb-meta-value">${popText}</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">PAGASA Signal</span>
          <span class="wb-meta-value">${sigText}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="wb-section">
    <div class="wb-section-header">Cargo Manifest</div>
    <table class="wb-cargo-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Supply Item</th>
          <th style="text-align:right">Quantity Dispatched</th>
        </tr>
      </thead>
      <tbody>${cargoRows}</tbody>
    </table>
  </div>

  <div class="wb-section">
    <div class="wb-section-header">Authorization Signatures</div>
    <div class="wb-section-body">
      <div class="wb-sig-grid">${sigHTML}</div>
    </div>
  </div>

  <div class="wb-tx-ref">Transaction Ref: ${txRef}</div>
  <div class="wb-footer-note">
    This document is system-generated by ReliefSync. Keep one copy at the depot and one copy at the receiving evacuation center.
    For discrepancies, contact the DSWD Operations Center immediately.
  </div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
}

function printWaybill() {
  // Collect current cargo from the LOADED Kanban zone only
  const cargoItems = [];
  document.querySelectorAll('#zone-loaded .kanban-card').forEach(card => {
    const name = card.querySelector('.item-name')?.textContent.trim()    || '';
    const qty  = card.querySelector('.load-quantity')?.textContent.trim() || '';
    if (name) cargoItems.push({ name, qty });
  });

  const fromData = LOCATIONS[mission.fromKey];
  const toData   = LOCATIONS[mission.toKey];

  const html = buildWaybillHTML({
    waybillNo:  generateWaybillNumber(),
    issuedDate: formatNow(),
    txRef:      '#TX-' + Math.floor(1000000 + Math.random() * 9000000) + '-M',
    truckLabel: mission.truck?.label || 'Unassigned',
    fromName:   fromData?.name || mission.fromKey,
    toName:     toData?.name   || mission.toKey,
    toData,
    cargoItems,
    signed:     null   // UNSIGNED — blank signature blocks
  });

  const win = window.open('', '_blank', 'width=720,height=900');
  if (win) { win.document.write(html); win.document.close(); }
  else { alert('Pop-up blocked. Please allow pop-ups to print the waybill.'); }
}

// ══════════════════════════════════════════════════════════════════
// SECTION 12: MAP — dynamic route updates
// ══════════════════════════════════════════════════════════════════

let leafletMap     = null;
let routeLayer     = null;

function makeIcon(color) {
  return L.icon({
    iconUrl:    `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize:   [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
  });
}

function initRoutingMap() {
  const mapContainer = document.getElementById('dispatch-map');
  if (!mapContainer || typeof L === 'undefined') return;

  leafletMap = L.map('dispatch-map').setView([14.755, 121.045], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(leafletMap);

  // All camp + depot markers
  Object.entries(LOCATIONS).forEach(([key, loc]) => {
    const color = loc.type === 'depot' ? 'blue'
                : loc.status === 'CRITICAL' ? 'red'
                : loc.status === 'WARNING'  ? 'orange'
                : 'green';
    const popupText = loc.type === 'depot'
      ? `<b>🏭 ${loc.name}</b><br><small>Supply Depot</small>`
      : `<b>${loc.name}</b><br>👥 ${loc.population?.toLocaleString()} evacuees<br><b style="color:${color === 'red' ? '#b91c1c' : color === 'orange' ? '#c2410c' : '#15803d'}">${loc.status}</b>`;
    L.marker(loc.coords, { icon: makeIcon(color) }).addTo(leafletMap).bindPopup(popupText);
  });

  // Fleet truck markers (grey)
  FLEET.forEach(truck => {
    L.circleMarker(truck.coords, { radius: 7, color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 0.8 })
      .addTo(leafletMap)
      .bindPopup(`<b>🚚 ${truck.label}</b><br>${truck.driver}<br><small>${truck.status === 'available' ? '🟢 Available' : '🔴 Busy'}</small>`);
  });

  // Map legend
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.style.cssText = 'background:white;padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.8;border:2px solid #ccc;font-family:Inter,sans-serif;';
    div.innerHTML = `<strong style="display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;">Legend</strong>
      🔵 Depot &nbsp; 🔴 Critical &nbsp; 🟠 Warning<br>
      🟢 Stable &nbsp; ⚫ Fleet Unit<br>
      <span style="color:#1a3a8f;">━ Active Route</span>`;
    return div;
  };
  legend.addTo(leafletMap);

  updateRoute();
}

function updateRoute() {
  if (!leafletMap) return;

  const fromLoc = LOCATIONS[mission.fromKey];
  const toLoc   = LOCATIONS[mission.toKey];
  if (!fromLoc || !toLoc) return;

  // Remove old route
  if (routeLayer) {
    leafletMap.removeLayer(routeLayer);
    routeLayer = null;
  }

  document.getElementById('travel-time-val').textContent = 'Calculating...';
  document.getElementById('travel-dist-val').textContent = '-- km';

  const url = `https://router.project-osrm.org/route/v1/driving/${fromLoc.coords[1]},${fromLoc.coords[0]};${toLoc.coords[1]},${toLoc.coords[0]}?overview=full&geometries=geojson`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      if (!data.routes?.length) return;
      const route = data.routes[0];
      const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
      routeLayer = L.polyline(latlngs, { color: '#1a3a8f', weight: 5, opacity: 0.85 }).addTo(leafletMap);

      document.getElementById('travel-time-val').textContent = `${Math.round(route.duration / 60)} mins`;
      document.getElementById('travel-dist-val').textContent = `${(route.distance / 1000).toFixed(1)} km`;
    })
    .catch(() => {
      document.getElementById('travel-time-val').textContent = 'Offline';
      document.getElementById('travel-dist-val').textContent = '--';
    });
}
