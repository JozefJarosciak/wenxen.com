// Event Handlers Module - centralized event coordination and DOM event management
// Extracted from main_app.js for modular architecture

// ===== DOM Content Loaded Handler =====

// Main application initialization
async function initializeApplication() {
  // Cleanup incorrectly named databases on load
  if (window.cleanupIncorrectDatabases) {
    try {
      await window.cleanupIncorrectDatabases();
    } catch (e) {
      console.warn('Database cleanup failed:', e);
    }
  }
  // Chain-specific label updates
  if (window.updateChainSpecificLabels) {
    window.updateChainSpecificLabels();
  }

  // Listen for chain changes to update labels
  if (window.chainManager) {
    window.chainManager.onChainChange(() => {
      if (window.updateChainSpecificLabels) {
        window.updateChainSpecificLabels();
      }
    });
  }

  // Check for dashboard hash and activate Dashboard tab
  if (window.location.hash === '#dashboard') {
    // Clear the hash from URL
    history.replaceState(null, null, window.location.pathname + window.location.search);

    // Activate dashboard tab after a short delay to ensure everything is loaded
    setTimeout(() => {
      if (typeof window.setActiveTab === 'function') {
        window.setActiveTab('tab-dashboard');
      } else {
        // Fallback if setActiveTab isn't available yet
        const dashboardTab = document.getElementById('tab-dashboard');
        const dashboardBtn = document.querySelector('[data-target="tab-dashboard"]');
        if (dashboardTab && dashboardBtn) {
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
          dashboardTab.classList.add('active');
          dashboardBtn.classList.add('active');
        }
      }
    }, 500);
  }

  // Footer year update
  try {
    const y = document.getElementById('copyrightYear');
    if (y) y.textContent = String(new Date().getFullYear());
  } catch {}

  // Setup modal event handlers
  setupModalHandlers();

  // Setup privacy guard
  setupPrivacyGuard();

  // If About tab is active by default, ensure load
  try {
    const isAboutActive = document.getElementById('tab-about')?.classList.contains('active');
    if (isAboutActive && window.ensureAboutLoaded) {
      window.ensureAboutLoaded();
    }
  } catch {}

  // Check if onboarding should be shown on page load
  setTimeout(() => {
    if (window.shouldShowOnboarding?.() && window.showOnboardingModal) {
      window.showOnboardingModal();
    }
  }, 500); // Small delay to ensure everything is loaded
}

// ===== Modal Event Handlers =====

function setupModalHandlers() {
  // Footer privacy link
  const link = document.getElementById('privacyLink');
  if (link && window.openPrivacyModal) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.openPrivacyModal();
    });
  }

  // Modal buttons
  const acceptBtn = document.getElementById('privacyAcceptBtn');
  if (acceptBtn && window.acceptPrivacy) {
    acceptBtn.addEventListener('click', window.acceptPrivacy);
  }

  const declineBtn = document.getElementById('privacyDeclineBtn');
  if (declineBtn && window.declinePrivacy) {
    declineBtn.addEventListener('click', window.declinePrivacy);
  }

  // Onboarding modal button
  const onboardingBtn = document.getElementById('onboardingGetStartedBtn');
  if (onboardingBtn && window.completeOnboarding) {
    onboardingBtn.addEventListener('click', window.completeOnboarding);
  }
}

// ===== Privacy Guard System =====

function setupPrivacyGuard() {
  // Defensive: if user focuses a settings field without consent, block and show modal
  const settingsRoot = document.getElementById('tab-settings');
  if (settingsRoot) {
    settingsRoot.addEventListener('focusin', (e) => {
      if (!window.isPrivacyAccepted?.()) {
        const t = e.target;
        if (t && (t.matches('input, textarea, select'))) {
          try { t.blur(); } catch {}
          if (window.setSettingsTextInputsEnabled) {
            window.setSettingsTextInputsEnabled(false);
          }
          if (window.openPrivacyModal) {
            window.openPrivacyModal();
          }
        }
      }
    });
  }

  // Global guard: block clicks on buttons/interactive controls until privacy accepted
  document.addEventListener('click', function(e){
    try {
      if (window.isPrivacyAccepted?.()) return; // ok
      const target = e.target;

      // Allow interactions inside the privacy modal itself
      const privacyModal = document.getElementById('privacyModal');
      if (privacyModal && privacyModal.contains(target)) return;

      // Allow interactions inside the onboarding modal itself
      const onboardingModal = document.getElementById('onboardingModal');
      if (onboardingModal && onboardingModal.contains(target)) return;

      // Allow explicit privacy link to open the modal (we open it below anyway)
      if (target && (target.id === 'privacyLink' || target.closest('#privacyLink'))) return;

      const buttonishSel = 'button, input[type="button"], input[type="submit"], .btn, .btn-secondary, .btn-mint, .button-like, .chip, .claim-button, .tab-button, .split-caret, .collapsible-toggle, .toggle, [role="button"]';
      const formishSel = 'input, textarea, select';
      const isButtonish = !!(target.closest && target.closest(buttonishSel));
      const isFormish = !!(target.closest && target.closest(formishSel));

      if (isButtonish || isFormish) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (window.openPrivacyModal) {
          window.openPrivacyModal();
        }
      }
    } catch {}
  }, true);
}

// ===== RPC Import Event Handler =====

function setupRPCImportHandler() {
  const btn = document.getElementById("importRpcBtn");
  if (btn && window.importAndRankRPCs) {
    btn.addEventListener("click", window.importAndRankRPCs);
  }
}

// ===== Input Validation Handlers =====

function setupInputValidation() {
  // Add input clamping for numeric inputs
  document.querySelectorAll('input[type="number"]').forEach(input => {
    if (input.hasAttribute('min') || input.hasAttribute('max')) {
      input.addEventListener('input', function() {
        const min = parseInt(this.getAttribute('min')) || 0;
        const max = parseInt(this.getAttribute('max')) || Infinity;
        let val = parseInt(this.value) || 0;

        if (val < min) val = min;
        if (val > max) val = max;

        this.value = val;
      });
    }
  });
}

// ===== Badge Event Handlers =====

function setupBadgeHandlers() {
  const badge = document.getElementById("estXenTotal");
  if (badge && window.showXENTotalTooltip) {
    // Badge hover handlers for tooltip
    badge.addEventListener('mouseenter', (e) => {
      if (badge.dataset.breakdown) {
        try {
          const breakdown = JSON.parse(badge.dataset.breakdown);
          if (Object.keys(breakdown).length > 0) {
            window.showXENTotalTooltip(e, breakdown);
          }
        } catch {}
      }
    });

    badge.addEventListener('mouseleave', () => {
      // Remove tooltip on mouse leave
      document.querySelectorAll('.xen-breakdown-tooltip').forEach(el => el.remove());
    });
  }
}

// ===== Theme Event Handlers =====

function setupThemeHandlers() {
  // Theme change handlers are managed by themeManager.js
  // This is just a placeholder for any additional theme-related events
  document.addEventListener('themeChanged', (e) => {
    // Update iframe themes if About tab is loaded
    if (window.syncIframeThemes) {
      window.syncIframeThemes();
    }

    // Update theme menu UI
    if (window.updateThemeMenuUI) {
      window.updateThemeMenuUI();
    }
  });
}

// ===== Module Initialization =====

// Initialize event handlers when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApplication();
  setupRPCImportHandler();
  setupInputValidation();
  setupBadgeHandlers();
  setupThemeHandlers();
});

// Also setup on page load for safety
window.addEventListener("DOMContentLoaded", () => {
  setupRPCImportHandler();
});

// ===== Export Module Functions =====
export const eventHandlers = {
  initializeApplication,
  setupModalHandlers,
  setupPrivacyGuard,
  setupRPCImportHandler,
  setupInputValidation,
  setupBadgeHandlers,
  setupThemeHandlers
};

// ===== Global Function Exports for Backward Compatibility =====
window.initializeApplication = initializeApplication;
window.setupModalHandlers = setupModalHandlers;
window.setupPrivacyGuard = setupPrivacyGuard;

export default eventHandlers;