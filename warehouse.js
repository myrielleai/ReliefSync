/**
 * ReliefSync Warehouse Execution
 * Crew Interaction Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const chkWater = document.getElementById('chk-water');
  const chkRice = document.getElementById('chk-rice');
  const btnDispatch = document.getElementById('btn-dispatch-truck');
  const btnPrint = document.getElementById('btn-print-tag');
  
  const toastPrint = document.getElementById('waybill-toast');
  const overlaySuccess = document.getElementById('dispatch-success-overlay');
  const btnReturn = document.getElementById('btn-return-portal');

  // --- 1. Handle checklist toggles ---
  const handleCheckChange = (checkbox) => {
    const row = checkbox.closest('.checklist-row');
    const statusTag = row.querySelector('.row-status-tag');
    
    if (checkbox.checked) {
      row.classList.add('checked-row');
      statusTag.textContent = 'LOADED';
    } else {
      row.classList.remove('checked-row');
      statusTag.textContent = 'PENDING';
    }
    
    // Dispatch is only enabled if all manifests are checked/loaded
    btnDispatch.disabled = !(chkWater.checked && chkRice.checked);
  };

  chkWater.addEventListener('change', () => handleCheckChange(chkWater));
  chkRice.addEventListener('change', () => handleCheckChange(chkRice));

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
