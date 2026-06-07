/**
 * ReliefSync — B2G Landing Page Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // --- 1. Deploy Request Modal Controls ---
  const btnDeployCta = document.getElementById('btn-deploy-cta');
  const modalDeploy = document.getElementById('modal-deploy');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const formDeploy = document.getElementById('deploy-request-form');
  const successState = document.getElementById('modal-success-state');
  const btnSuccessOk = document.getElementById('btn-success-ok');

  // Open Deploy Modal
  btnDeployCta.addEventListener('click', () => {
    modalDeploy.classList.add('active');
  });

  // Close Deploy Modal
  const closeDeployModal = () => {
    modalDeploy.classList.remove('active');
    setTimeout(() => {
      // Reset form view when transitions complete
      formDeploy.classList.remove('hidden');
      successState.classList.add('hidden');
      formDeploy.reset();
    }, 300);
  };

  btnCloseModal.addEventListener('click', closeDeployModal);
  btnSuccessOk.addEventListener('click', closeDeployModal);

  // Close on backdrop click
  modalDeploy.addEventListener('click', (e) => {
    if (e.target === modalDeploy) {
      closeDeployModal();
    }
  });

  // Form Submit Handler (Simulated API Post)
  formDeploy.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Animate transition to success state
    formDeploy.classList.add('hidden');
    successState.classList.remove('hidden');
  });


  // --- 2. Info Modals for Impact Metrics & Documentation ---
  const modalInfo = document.getElementById('modal-info');
  const btnCloseInfo = document.getElementById('btn-close-info');
  const btnInfoOk = document.getElementById('btn-info-ok');
  const infoTitle = document.getElementById('info-modal-title');
  const infoContent = document.getElementById('info-modal-content');
  
  const linkImpact = document.getElementById('link-impact');
  const linkDocs = document.getElementById('link-docs');

  const infoData = {
    impact: {
      title: "Impact Metrics & Operations (Q2 2026)",
      content: `
        <p>ReliefSync is deployed in municipal disaster centers to streamline high-volume emergency responses. Our operational indicators highlight the efficiency gains achieved by transitioning from spreadsheet models to predictive logic:</p>
        
        <h4>Key Accomplishments</h4>
        <p><strong>• 38 Municipal Partnerships:</strong> Deployed in cities and towns across highly critical storm-surge zones.</p>
        <p><strong>• 2.4M Units of Relief Optimized:</strong> Successfully tracked and prioritized dispatch for food, medical kits, and clean water.</p>
        <p><strong>• 42% Reduction in Transit Waste:</strong> Optimized routes and volumes to reduce double-trip fuel logs and vehicle wear.</p>
        <p><strong>• 98.6% Forecasting Precision:</strong> 72-hour camp demands computed within small margins of error.</p>
      `
    },
    docs: {
      title: "Engine Documentation & Integration",
      content: `
        <p>ReliefSync integrates with local government registries (LGU) and disaster monitoring agencies to automate packing manifests. By utilizing client-side tools and light API requests, integration takes hours rather than weeks.</p>
        
        <h4>Core Modules</h4>
        <p><strong>1. Time-Series Predictor:</strong> Analyzes arrival headcounts and maps the decay rates of crucial stockpiles (water, grains, medical items).</p>
        <p><strong>2. Packing Optimizer:</strong> Matches 72-hour forecasts with on-site depot metrics to recommend dispatch lists with no manual calculations.</p>
        <p><strong>3. Dispatch API:</strong> Simple webhooks that export packing lists in CSV, JSON, or PDF formats to coordinate with field logistics teams.</p>
      `
    }
  };

  const openInfoModal = (type) => {
    const data = infoData[type];
    if (!data) return;
    
    infoTitle.textContent = data.title;
    infoContent.innerHTML = data.content;
    modalInfo.classList.add('active');
  };

  const closeInfoModal = () => {
    modalInfo.classList.remove('active');
  };

  linkImpact.addEventListener('click', (e) => {
    e.preventDefault();
    openInfoModal('impact');
  });

  linkDocs.addEventListener('click', (e) => {
    e.preventDefault();
    openInfoModal('docs');
  });

  btnCloseInfo.addEventListener('click', closeInfoModal);
  btnInfoOk.addEventListener('click', closeInfoModal);
  
  // Close on backdrop click
  modalInfo.addEventListener('click', (e) => {
    if (e.target === modalInfo) {
      closeInfoModal();
    }
  });

  // Support ESC key to close any active modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDeployModal();
      closeInfoModal();
    }
  });

});
