// Toast notification system with clickable transaction hash links and OK button
window.showToast = function(message, type = 'success') {
  // Remove existing toast if any
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.display = 'flex';
  toast.style.flexDirection = 'column';
  toast.style.alignItems = 'center';
  toast.style.gap = '10px';
  toast.style.padding = '16px 20px';
  
  // Create message container
  const messageDiv = document.createElement('div');
  messageDiv.style.textAlign = 'center';
  messageDiv.style.lineHeight = '1.4';
  
  // Check if message contains a transaction hash and make it clickable with shortened display
  const txHashRegex = /(0x[a-fA-F0-9]{64})/g;
  let processedMessage = message;
  let isTransactionMessage = false;
  
  if (txHashRegex.test(message)) {
    isTransactionMessage = true;
    processedMessage = message.replace(txHashRegex, (match) => {
      const etherscanUrl = `https://etherscan.io/tx/${match}`;
      const shortHash = `${match.slice(0, 6)}...${match.slice(-4)}`; // 0x1234...abcd
      return `<a href="${etherscanUrl}" target="_blank" rel="noopener noreferrer" style="color: #fff; text-decoration: underline; font-weight: bold;" title="${match}">${shortHash}</a>`;
    });
  }
  
  // Check if this is a transaction submission message (submitted, claim, mint, stake, etc.)
  const isSubmissionMessage = /submitted|claim|mint|stake|withdraw|end/i.test(message);
  
  // Set the content (HTML if transaction hash, otherwise text)
  if (processedMessage !== message) {
    messageDiv.innerHTML = processedMessage;
  } else {
    messageDiv.textContent = processedMessage;
  }
  
  // Create OK button
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
  
  // OK button hover effect
  okButton.addEventListener('mouseenter', () => {
    okButton.style.background = 'rgba(255, 255, 255, 0.3)';
  });
  okButton.addEventListener('mouseleave', () => {
    okButton.style.background = 'rgba(255, 255, 255, 0.2)';
  });
  
  // Close toast when OK is clicked
  okButton.addEventListener('click', () => {
    hideToast();
  });
  
  // Hide toast function
  const hideToast = () => {
    if (toast && toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.remove();
        }
      }, 500);
    }
  };
  
  // Assemble toast
  toast.appendChild(messageDiv);
  toast.appendChild(okButton);
  
  // Add to document
  document.body.appendChild(toast);
  
  // Show toast with animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // For transaction submission messages, stay until OK is clicked
  // For other messages, auto-hide after 8 seconds
  if (isTransactionMessage && isSubmissionMessage) {
    // Transaction submission messages stay until user clicks OK
    // No auto-hide timeout
  } else {
    // Other messages auto-hide after 8 seconds
    setTimeout(() => {
      hideToast();
    }, 8000);
  }
};