/**
 * ReliefSync — Research Page JS
 * Handles animated counters and the illustrative ML bar chart.
 */

// ─── Animated Counters ──────────────────────────────────────────────────────
function animateCounter(el, target, duration = 1500) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = Math.round(start).toLocaleString();
    if (start >= target) clearInterval(timer);
  }, 16);
}

function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'));
        animateCounter(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('.impact-number[data-target]').forEach(el => observer.observe(el));
}

// ─── ML Bar Chart Demo ───────────────────────────────────────────────────────
function buildBarChart() {
  const container = document.getElementById('ml-chart');
  if (!container) return;

  // Pairs of [actual, predicted] — simplified illustrative values
  const pairs = [
    [3100, 2950], [680,  720],  [92,  85],
    [2700, 2820], [540,  490],  [71,  80],
    [4200, 3900], [1100, 1050], [130, 120],
    [1800, 1950], [390,  410],  [56,  62],
    [3500, 3300], [870,  900],  [110, 105],
    [2200, 2400], [620,  580],  [88,  95],
  ];

  const maxVal = Math.max(...pairs.flat());
  const height = 180;

  pairs.forEach(([actual, predicted]) => {
    const pair = document.createElement('div');
    pair.className = 'bar-pair';

    const actualBar = document.createElement('div');
    actualBar.className = 'bar actual';
    actualBar.style.height = '0px';
    actualBar.title = `Actual: ${actual.toLocaleString()} units`;

    const predictedBar = document.createElement('div');
    predictedBar.className = 'bar predicted';
    predictedBar.style.height = '0px';
    predictedBar.title = `Predicted: ${predicted.toLocaleString()} units`;

    pair.appendChild(actualBar);
    pair.appendChild(predictedBar);
    container.appendChild(pair);

    // Animate in after a short delay
    setTimeout(() => {
      actualBar.style.height    = `${Math.round((actual    / maxVal) * height)}px`;
      predictedBar.style.height = `${Math.round((predicted / maxVal) * height)}px`;
    }, 300);
  });
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initCounters();
  buildBarChart();
});
