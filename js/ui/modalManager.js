// Modal management - centralized modal operations
import { privacyStorage } from '../utils/storageUtils.js';

export const modalManager = {
  // Privacy Modal Management
  privacy: {
    open() {
      const modal = document.getElementById('privacyModal');
      if (!modal) return;
      
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.remove('hidden');
      
      // Focus first focusable element
      const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
    },

    close() {
      const modal = document.getElementById('privacyModal');
      if (!modal) return;
      
      // Blur any focused elements within the modal
      const focusedElement = modal.querySelector(':focus');
      if (focusedElement) {
        focusedElement.blur();
      }
      
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    },

    accept() {
      privacyStorage.setPrivacyAccepted(true);
      modalManager.settings.enableInputs(true);
      modalManager.privacy.close();
      
      // If setup is not complete, navigate to Settings
      if (!privacyStorage.isSetupComplete()) {
        setTimeout(() => {
          if (window.setActiveTab) {
            window.setActiveTab('tab-settings');
          }
        }, 300);
      }
    },

    decline() {
      privacyStorage.setPrivacyAccepted(false);
      modalManager.settings.enableInputs(false);
      modalManager.privacy.close();
    }
  },

  // Onboarding Modal Management
  onboarding: {
    shouldShow() {
      return !privacyStorage.isSetupComplete();
    },

    show() {
      const modal = document.getElementById('onboardingModal');
      if (!modal) return;
      
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.remove('hidden');
      
      // Focus first focusable element
      const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
    },

    hide() {
      const modal = document.getElementById('onboardingModal');
      if (!modal) return;
      
      // Blur any focused elements within the modal
      const focusedElement = modal.querySelector(':focus');
      if (focusedElement) {
        focusedElement.blur();
      }
      
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    },

    complete() {
      // Check if privacy needs to be accepted first
      if (!privacyStorage.isPrivacyAccepted()) {
        modalManager.onboarding.hide();
        setTimeout(() => {
          modalManager.privacy.open();
        }, 300);
        return;
      }
      
      // Mark onboarding as dismissed to prevent showing again
      privacyStorage.setOnboardingDismissed(true);
      
      modalManager.onboarding.hide();
      
      // Switch to Settings tab
      if (window.setActiveTab) {
        window.setActiveTab('tab-settings');
      }
    }
  },

  // Settings-related modal functions
  settings: {
    enableInputs(enabled) {
      const settingsTab = document.getElementById('tab-settings');
      if (!settingsTab) return;
      
      const selector = '#tab-settings input[type="text"], #tab-settings input[type="number"], #tab-settings textarea, #tab-settings select';
      const inputs = document.querySelectorAll(selector);
      
      inputs.forEach(input => {
        try {
          input.disabled = !enabled;
        } catch (error) {
          console.warn('Failed to toggle input state:', error);
        }
      });
    },

    ensurePrivacyConsent(currentTabId) {
      if (currentTabId !== 'tab-settings') return;
      
      if (!privacyStorage.isPrivacyAccepted()) {
        modalManager.settings.enableInputs(false);
        modalManager.privacy.open();
      } else {
        modalManager.settings.enableInputs(true);
      }
    }
  },

  // Generic modal utilities
  utils: {
    // Close modal on escape key
    handleEscape(event) {
      if (event.key === 'Escape') {
        // Close any open modals
        const openModals = document.querySelectorAll('.modal:not(.hidden), [role="dialog"]:not(.hidden)');
        openModals.forEach(modal => {
          if (modal.id === 'privacyModal') {
            modalManager.privacy.close();
          } else if (modal.id === 'onboardingModal') {
            modalManager.onboarding.hide();
          }
        });
      }
    },

    // Trap focus within modal
    trapFocus(modal, event) {
      if (!modal || modal.hidden || modal.classList.contains('hidden')) return;
      
      const focusableElements = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    }
  },

  // Initialize modal system
  initialize() {
    // Set up privacy modal buttons
    const acceptButton = document.getElementById('privacyAcceptBtn');
    if (acceptButton) {
      acceptButton.addEventListener('click', this.privacy.accept);
    }
    
    const declineButton = document.getElementById('privacyDeclineBtn');
    if (declineButton) {
      declineButton.addEventListener('click', this.privacy.decline);
    }
    
    // Set up onboarding modal buttons
    const getStartedButton = document.getElementById('onboardingGetStartedBtn');
    if (getStartedButton) {
      getStartedButton.addEventListener('click', () => this.onboarding.complete());
    }
    
    const onboardingCloseBtn = document.getElementById('onboardingCloseBtn');
    if (onboardingCloseBtn) {
      onboardingCloseBtn.addEventListener('click', () => {
        // Mark onboarding as dismissed so it doesn't show again
        privacyStorage.setOnboardingDismissed(true);
        this.onboarding.hide();
      });
    }
    
    // Set up privacy link in footer
    const privacyLink = document.getElementById('privacyLink');
    if (privacyLink) {
      privacyLink.addEventListener('click', (event) => {
        event.preventDefault();
        this.privacy.open();
      });
    }
    
    // Set up keyboard handling
    document.addEventListener('keydown', this.utils.handleEscape);
    
    // Set up focus trap for modals
    document.addEventListener('keydown', (event) => {
      const privacyModal = document.getElementById('privacyModal');
      const onboardingModal = document.getElementById('onboardingModal');
      
      if (privacyModal && !privacyModal.classList.contains('hidden')) {
        this.utils.trapFocus(privacyModal, event);
      } else if (onboardingModal && !onboardingModal.classList.contains('hidden')) {
        this.utils.trapFocus(onboardingModal, event);
      }
    });
    
    // Set up settings input blocking
    const settingsRoot = document.getElementById('tab-settings');
    if (settingsRoot) {
      settingsRoot.addEventListener('focusin', (event) => {
        if (!privacyStorage.isPrivacyAccepted()) {
          const target = event.target;
          if (target && target.matches('input, textarea, select')) {
            try {
              target.blur();
            } catch (error) {
              console.warn('Failed to blur input:', error);
            }
            modalManager.settings.enableInputs(false);
            modalManager.privacy.open();
          }
        }
      });
    }
    
    // Global click blocker for interactive elements
    document.addEventListener('click', (event) => {
      try {
        if (privacyStorage.isPrivacyAccepted()) return;

        const target = event.target;

        // CRITICAL: Allow ALL clicks on modal buttons and close buttons
        // Check if target is inside a modal or IS a modal button
        const privacyModal = document.getElementById('privacyModal');
        const onboardingModal = document.getElementById('onboardingModal');

        // Allow any click inside modals (including all buttons)
        if (privacyModal && !privacyModal.classList.contains('hidden')) {
          if (privacyModal.contains(target)) return;
        }

        if (onboardingModal && !onboardingModal.classList.contains('hidden')) {
          if (onboardingModal.contains(target)) return;
        }

        // Allow privacy link clicks
        if (target && (target.id === 'privacyLink' || target.closest('#privacyLink'))) return;

        // Block interactive elements outside modals
        const interactiveSelector = 'button, input[type="button"], input[type="submit"], .btn, .btn-secondary, .btn-mint, .button-like, .chip, .claim-button, .tab-button, .split-caret, .collapsible-toggle, .toggle, [role="button"]';
        const formSelector = 'input, textarea, select';

        const isInteractive = !!(target.closest && target.closest(interactiveSelector));
        const isForm = !!(target.closest && target.closest(formSelector));

        if (isInteractive || isForm) {
          event.preventDefault();
          event.stopImmediatePropagation();
          modalManager.privacy.open();
        }
      } catch (error) {
        console.warn('Failed to handle click blocking:', error);
      }
    }, true);
    
    // Show onboarding if needed
    setTimeout(() => {
      if (this.onboarding.shouldShow()) {
        this.onboarding.show();
      }
    }, 500);
  }
};

// Legacy global functions for backward compatibility
window.isPrivacyAccepted = () => privacyStorage.isPrivacyAccepted();
window.isSetupComplete = () => privacyStorage.isSetupComplete();
window.openPrivacyModal = () => modalManager.privacy.open();
window.closePrivacyModal = () => modalManager.privacy.close();
window.acceptPrivacy = () => modalManager.privacy.accept();
window.declinePrivacy = () => modalManager.privacy.decline();
window.shouldShowOnboarding = () => modalManager.onboarding.shouldShow();
window.showOnboardingModal = () => modalManager.onboarding.show();
window.hideOnboardingModal = () => modalManager.onboarding.hide();
window.completeOnboarding = () => modalManager.onboarding.complete();
window.setSettingsTextInputsEnabled = (enabled) => modalManager.settings.enableInputs(enabled);
window.ensurePrivacyConsentOnSettings = (tabId) => modalManager.settings.ensurePrivacyConsent(tabId);

// Auto-initialize when module loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => modalManager.initialize());
} else {
  modalManager.initialize();
}