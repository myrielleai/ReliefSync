/**
 * ReliefSync Enterprise Portal
 * Secure Authentication Interactivity
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const btnAuth = document.getElementById('btn-authenticate');
  const btnText = btnAuth.querySelector('.btn-text');
  const btnSpinner = btnAuth.querySelector('.btn-spinner');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Disable inputs and button
    btnAuth.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    
    // Disable form inputs during auth checks
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => input.disabled = true);

    // Simulate secure network handshakes / authorization validation
    setTimeout(() => {
      // Re-enable form fields (if they fail, but redirect on success)
      // Redirect to the operational portal
      window.location.href = 'portal.html';
    }, 1400);
  });
});
