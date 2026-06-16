/**
 * ReliefSync Warehouse Execution
 * Crew Interaction Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnDispatch = document.getElementById('btn-dispatch-truck');
  const btnPrint = document.getElementById('btn-print-tag');
  
  const overlaySuccess = document.getElementById('dispatch-success-overlay');
  const btnReturn = document.getElementById('btn-return-portal');

  // --- 1. Handle Drag and Drop for Kanban Board ---
  const cards = document.querySelectorAll('.kanban-card');
  const dropzones = document.querySelectorAll('.kanban-dropzone');
  
  // Track total items to know when dispatch is ready
  const totalItems = cards.length;

  cards.forEach(card => {
    card.addEventListener('dragstart', () => {
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      checkDispatchStatus();
    });
  });

  dropzones.forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const draggingCard = document.querySelector('.dragging');
      if (draggingCard) {
        zone.appendChild(draggingCard);
      }
    });
  });

  // Enable dispatch only if all cards are in the 'zone-loaded' dropzone
  function checkDispatchStatus() {
    const loadedZone = document.getElementById('zone-loaded');
    if (loadedZone && loadedZone.children.length === totalItems) {
      btnDispatch.disabled = false;
    } else {
      btnDispatch.disabled = true;
    }
  }

  // --- 2. Print Waybill: Opens actual browser print dialog with formatted document ---
  btnPrint.addEventListener('click', () => {
    printWaybill();
  });

  function generateWaybillNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `WB-${dateStr}-${rand}`;
  }

  function formatNow() {
    const now = new Date();
    return now.toLocaleString('en-PH', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function printWaybill() {
    const waybillNo  = generateWaybillNumber();
    const issuedDate = formatNow();
    const txRef      = document.querySelector('.ledger-tag strong') 
                        ? document.querySelector('.ledger-tag strong').textContent 
                        : '#TX-' + Math.floor(1000000 + Math.random() * 9000000) + '-M';

    // Read cargo from the Kanban cards (wherever they are on the board)
    const cargoItems = [];
    document.querySelectorAll('.kanban-card').forEach(card => {
      const name = card.querySelector('.item-name') ? card.querySelector('.item-name').textContent.trim() : '';
      const qty  = card.querySelector('.load-quantity') ? card.querySelector('.load-quantity').textContent.trim() : '';
      if (name) cargoItems.push({ name, qty });
    });

    const cargoRows = cargoItems.map((item, i) =>
      `<tr>
        <td class="wb-cargo-num">${i + 1}</td>
        <td class="wb-cargo-name">${item.name}</td>
        <td class="wb-cargo-qty">${item.qty}</td>
      </tr>`
    ).join('');

    const waybillHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dispatch Waybill ${waybillNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 32px;
      max-width: 680px;
      margin: 0 auto;
    }
    .wb-header {
      text-align: center;
      border-bottom: 3px double #111;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .wb-republic {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 4px;
    }
    .wb-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin-bottom: 2px;
    }
    .wb-subtitle {
      font-size: 12px;
      color: #555;
    }
    .wb-section {
      border: 1px solid #ccc;
      border-radius: 6px;
      margin-bottom: 14px;
      overflow: hidden;
    }
    .wb-section-header {
      background: #f0f0f0;
      padding: 7px 14px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #444;
      border-bottom: 1px solid #ccc;
    }
    .wb-section-body {
      padding: 12px 14px;
    }
    .wb-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
    }
    .wb-meta-item { display: flex; flex-direction: column; gap: 2px; }
    .wb-meta-label { font-size: 10px; font-weight: 700; color: #777; text-transform: uppercase; }
    .wb-meta-value { font-size: 13px; font-weight: 600; color: #111; }
    .wb-meta-value.waybill-no { font-size: 16px; font-weight: 800; color: #1a3a8f; font-family: monospace; }
    table.wb-cargo-table { width: 100%; border-collapse: collapse; }
    .wb-cargo-table th {
      background: #f0f0f0;
      padding: 8px 10px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #555;
      border-bottom: 1px solid #ccc;
    }
    .wb-cargo-table td {
      padding: 10px 10px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .wb-cargo-table tr:last-child td { border-bottom: none; }
    .wb-cargo-num  { width: 40px; color: #888; font-weight: 600; }
    .wb-cargo-name { font-weight: 600; }
    .wb-cargo-qty  { font-weight: 700; color: #1a3a8f; text-align: right; }
    .wb-sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }
    .wb-sig-block { display: flex; flex-direction: column; gap: 4px; }
    .wb-sig-line {
      border-bottom: 1.5px solid #333;
      height: 36px;
      margin-bottom: 4px;
    }
    .wb-sig-label { font-size: 10px; color: #555; font-weight: 600; text-transform: uppercase; }
    .wb-sig-name  { font-size: 10px; color: #999; font-style: italic; }
    .wb-footer-note {
      text-align: center;
      font-size: 10px;
      color: #888;
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
    .wb-tx-ref {
      text-align: right;
      font-size: 11px;
      font-weight: 700;
      color: #1a3a8f;
      font-family: monospace;
      margin-top: 10px;
    }
    @media print {
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="wb-header">
    <div class="wb-republic">Republic of the Philippines &nbsp;&bull;&nbsp; DSWD / NDRRMC Operations</div>
    <div class="wb-title">ReliefSync — Dispatch Waybill</div>
    <div class="wb-subtitle">Supply Delivery and Acknowledgment Receipt</div>
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
          <span class="wb-meta-label">Truck No.</span>
          <span class="wb-meta-value">TRUCK #1</span>
        </div>
      </div>
    </div>
  </div>

  <div class="wb-section">
    <div class="wb-section-header">Destination</div>
    <div class="wb-section-body">
      <div class="wb-meta-grid">
        <div class="wb-meta-item">
          <span class="wb-meta-label">Evacuation Center</span>
          <span class="wb-meta-value">Brgy. 172 Covered Court</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Location</span>
          <span class="wb-meta-value">Caloocan City, NCR</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">Population Served</span>
          <span class="wb-meta-value">1,250 evacuees</span>
        </div>
        <div class="wb-meta-item">
          <span class="wb-meta-label">PAGASA Signal</span>
          <span class="wb-meta-value">Signal No. 4</span>
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
      <tbody>
        ${cargoRows}
      </tbody>
    </table>
  </div>

  <div class="wb-section">
    <div class="wb-section-header">ML Forecast Basis (ReliefSync AI Engine)</div>
    <div class="wb-section-body">
      <p style="font-size:12px;color:#444;line-height:1.6;">
        Dispatch quantities were determined by the ReliefSync machine learning model (Linear Regression, R&sup2; = 79.38%).
        The model computed 72-hour demand based on camp population (1,250 persons), PAGASA Signal No. 4,
        and SPHERE Humanitarian Standards. Dispatch = Predicted 72h Demand &minus; Current On-Site Stock.
      </p>
    </div>
  </div>

  <div class="wb-section">
    <div class="wb-section-header">Authorization Signatures</div>
    <div class="wb-section-body">
      <div class="wb-sig-grid">
        <div class="wb-sig-block">
          <div class="wb-sig-line"></div>
          <div class="wb-sig-label">Relief Officer</div>
          <div class="wb-sig-name">Name &amp; Date</div>
        </div>
        <div class="wb-sig-block">
          <div class="wb-sig-line"></div>
          <div class="wb-sig-label">Truck Driver / Courier</div>
          <div class="wb-sig-name">Name &amp; Date</div>
        </div>
        <div class="wb-sig-block">
          <div class="wb-sig-line"></div>
          <div class="wb-sig-label">Received By (Camp)</div>
          <div class="wb-sig-name">Name, Position &amp; Date</div>
        </div>
      </div>
    </div>
  </div>

  <div class="wb-tx-ref">Transaction Ref: ${txRef}</div>

  <div class="wb-footer-note">
    This document is system-generated by ReliefSync. Keep one copy at the depot and one copy at the receiving evacuation center.
    For discrepancies, contact the DSWD Operations Center immediately.
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    // Open waybill in a new window and trigger print
    const printWindow = window.open('', '_blank', 'width=720,height=900');
    if (printWindow) {
      printWindow.document.write(waybillHTML);
      printWindow.document.close();
    } else {
      alert('Pop-up blocked. Please allow pop-ups for this site to print the waybill.');
    }
  }

  // --- 3. Confirm Load & Dispatch Overlay ---
  btnDispatch.addEventListener('click', () => {
    overlaySuccess.classList.remove('hidden');
  });

  // --- 4. Return to Dispatch Portal redirect ---
  btnReturn.addEventListener('click', () => {
    // Redirect back to main dashboard
    window.location.href = 'portal.html';
  });
});

