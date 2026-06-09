/**
 * ReliefSync Warehouse Execution
 * Crew Interaction Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnDispatch = document.getElementById('btn-dispatch-truck');
  const btnPrint = document.getElementById('btn-print-tag');
  
  const toastPrint = document.getElementById('waybill-toast');
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

  // --- 2. Print Waybill Toast trigger ---
  btnPrint.addEventListener('click', () => {
    // Show toast
    toastPrint.classList.remove('hidden');
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      toastPrint.classList.add('hidden');
    }, 3000);
  });

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
