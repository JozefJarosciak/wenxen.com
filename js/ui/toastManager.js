// Toast notification system - centralized toast management
export const toastManager = {
  // Show toast notification
  show(message, type = 'success') {
    // Remove existing toast if any
    this.removeExisting();
    
    // Create toast element
    const toast = this.createElement(message, type);
    
    // Add to document
    document.body.appendChild(toast);
    
    // Show with animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Auto-hide logic
    this.setupAutoHide(toast, message, type);
  },

  // Remove existing toast
  removeExisting() {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }
  },

  // Create toast element
  createElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
    `;
    
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      text-align: center;
      line-height: 1.4;
    `;
    
    // Process message for transaction hashes
    const processedMessage = this.processMessage(message);
    if (processedMessage.hasTransactionHash) {
      messageDiv.innerHTML = processedMessage.content;
    } else {
      messageDiv.textContent = processedMessage.content;
    }
    
    // Create OK button
    const okButton = this.createOkButton(toast);
    
    // Assemble toast
    toast.appendChild(messageDiv);
    toast.appendChild(okButton);
    
    return toast;
  },

  // Process message to handle transaction hashes
  processMessage(message) {
    const txHashRegex = /(0x[a-fA-F0-9]{64})/g;
    let hasTransactionHash = false;
    let processedContent = message;
    
    if (txHashRegex.test(message)) {
      hasTransactionHash = true;
      processedContent = message.replace(txHashRegex, (match) => {
        const etherscanUrl = `https://etherscan.io/tx/${match}`;
        const shortHash = `${match.slice(0, 6)}...${match.slice(-4)}`;
        return `<a href="${etherscanUrl}" target="_blank" rel="noopener noreferrer" style="color: #fff; text-decoration: underline; font-weight: bold;" title="${match}">${shortHash}</a>`;
      });
    }
    
    return {
      content: processedContent,
      hasTransactionHash,
      isSubmissionMessage: /submitted|claim|mint|stake|withdraw|end/i.test(message)
    };
  },

  // Create OK button
  createOkButton(toast) {
    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.4);
      color: #fff;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    `;
    
    // Hover effects
    okButton.addEventListener('mouseenter', () => {
      okButton.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    
    okButton.addEventListener('mouseleave', () => {
      okButton.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    // Click handler
    okButton.addEventListener('click', () => {
      this.hide(toast);
    });
    
    return okButton;
  },

  // Hide toast with animation
  hide(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.remove();
      }
    }, 500);
  },

  // Setup auto-hide behavior
  setupAutoHide(toast, message, type) {
    const processedMessage = this.processMessage(message);
    
    // For transaction submission messages, stay until OK is clicked
    if (processedMessage.hasTransactionHash && processedMessage.isSubmissionMessage) {
      // No auto-hide timeout
      return;
    }
    
    // Other messages auto-hide after 1 second
    setTimeout(() => {
      this.hide(toast);
    }, 1000);
  },

  // Show success toast
  success(message) {
    this.show(message, 'success');
  },

  // Show error toast
  error(message) {
    this.show(message, 'error');
  },

  // Show warning toast
  warning(message) {
    this.show(message, 'warning');
  },

  // Show info toast
  info(message) {
    this.show(message, 'info');
  },

  // Utility to show transaction submission
  transaction(hash, action = 'Transaction') {
    const message = `${action} submitted: ${hash}`;
    this.success(message);
  }
};

// Legacy global function for backward compatibility
window.showToast = (message, type) => toastManager.show(message, type);

// Export for module usage
export default toastManager;