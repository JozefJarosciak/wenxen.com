// Chain Mismatch Handler - Detects and handles wallet/app chain mismatches
export class ChainMismatchHandler {
    constructor() {
        this.currentToast = null;
        this.isHandlingMismatch = false;
        this.userDeclined = false;
        this.checkInterval = null;
        this.chainNames = {
            'ETHEREUM': 'Ethereum',
            'BASE': 'Base',
            'AVALANCHE': 'Avalanche',
            'BSC': 'BNB Smart Chain',
            'MOONBEAM': 'Moonbeam',
            'POLYGON': 'Polygon',
            'OPTIMISM': 'Optimism',
            '0x1': 'Ethereum',
            '0x2105': 'Base',
            '0xa86a': 'Avalanche',
            '0x38': 'BNB Smart Chain',
            '0x504': 'Moonbeam',
            '0x89': 'Polygon',
            '0xa': 'Optimism',
            '1': 'Ethereum',
            '8453': 'Base',
            '43114': 'Avalanche',
            '56': 'BNB Smart Chain',
            '1284': 'Moonbeam',
            '137': 'Polygon',
            '10': 'Optimism'
        };
        this.chainIds = {
            'ETHEREUM': '0x1',
            'BASE': '0x2105',
            'AVALANCHE': '0xa86a',
            'BSC': '0x38',
            'MOONBEAM': '0x504',
            'POLYGON': '0x89',
            'OPTIMISM': '0xa',
            '0x1': '0x1',
            '0x2105': '0x2105',
            '0xa86a': '0xa86a',
            '0x38': '0x38',
            '0x504': '0x504',
            '0x89': '0x89',
            '0xa': '0xa'
        };
    }

    // Initialize the mismatch handler
    initialize() {
        // Start periodic checking
        this.startChainMismatchDetection();
        
        // Listen for chain changes in wallet
        if (window.ethereum) {
            window.ethereum.on('chainChanged', (chainId) => {
                console.log('Wallet chain changed to:', chainId);
                // When wallet changes, sync the app to match
                this.handleWalletChainChange(chainId);
            });
        }
        
        // Listen for app chain changes
        window.addEventListener('chainChanged', () => {
            this.checkChainMismatch();
        });
    }
    
    // Handle wallet chain change - sync app to match wallet
    async handleWalletChainChange(chainIdHex) {
        const chainIdNum = parseInt(chainIdHex, 16);
        let targetChain = null;

        // Map chain ID to our chain key
        if (chainIdNum === 1) {
            targetChain = 'ETHEREUM';
        } else if (chainIdNum === 8453) {
            targetChain = 'BASE';
        } else if (chainIdNum === 43114) {
            targetChain = 'AVALANCHE';
        } else if (chainIdNum === 56) {
            targetChain = 'BSC';
        } else if (chainIdNum === 1284) {
            targetChain = 'MOONBEAM';
        } else if (chainIdNum === 137) {
            targetChain = 'POLYGON';
        } else if (chainIdNum === 10) {
            targetChain = 'OPTIMISM';
        }

        if (targetChain) {
            const currentChain = this.getAppChain();
            if (currentChain !== targetChain) {
                console.log(`Wallet changed to ${targetChain}, syncing app...`);
                // Hide any existing toast
                this.hideToast();
                this.userDeclined = false;

                // Switch app to match wallet
                if (window.chainManager) {
                    window.chainManager.setChain(targetChain);
                    // Show switching overlay
                    this.showSwitchingOverlay(targetChain);
                    // Reload page
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }
            }
        }
    }
    
    // Show switching overlay
    showSwitchingOverlay(targetChain) {
        const chainName = this.chainNames[targetChain] || targetChain;
        const overlay = document.createElement('div');
        overlay.className = 'chain-switching-overlay';
        overlay.innerHTML = `
            <div class="chain-switching-modal">
                <div class="chain-switching-spinner"></div>
                <div class="chain-switching-title">Switching to ${chainName}</div>
                <div class="chain-switching-message">Please wait...</div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // Start periodic chain mismatch detection
    startChainMismatchDetection() {
        // Check every 5 seconds to reduce load on Firefox
        this.checkInterval = setInterval(() => {
            // Only check if no toast is showing and user hasn't declined
            // Also check if there's a connected wallet
            if (!this.currentToast && !this.userDeclined && window.connectedAccount) {
                this.checkChainMismatch();
            }
        }, 5000);
    }

    // Stop detection
    stopChainMismatchDetection() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // Check for chain mismatch
    async checkChainMismatch() {
        try {
            // Get current app chain
            const appChain = this.getAppChain();
            if (!appChain) return;

            // Get wallet chain
            const walletChain = await this.getWalletChain();
            if (!walletChain) return;

            // Normalize chain IDs for comparison
            const normalizedAppChain = this.normalizeChainId(appChain);
            const normalizedWalletChain = this.normalizeChainId(walletChain);

            // Check if there's a mismatch
            if (normalizedAppChain !== normalizedWalletChain) {
                // Only show toast if not already showing and not handling
                if (!this.currentToast && !this.isHandlingMismatch && !this.userDeclined) {
                    console.log(`Chain mismatch detected: App on ${appChain}, Wallet on ${walletChain}`);
                    this.handleChainMismatch(appChain, walletChain);
                }
            } else if (normalizedAppChain === normalizedWalletChain) {
                // Chains match, remove toast if exists and reset flags
                if (this.currentToast) {
                    this.hideToast();
                }
                this.userDeclined = false; // Reset decline flag when chains match
            }
        } catch (error) {
            console.error('Error checking chain mismatch:', error);
        }
    }

    // Get current app chain
    getAppChain() {
        // Try to get from chainManager
        if (window.chainManager && window.chainManager.currentChain) {
            return window.chainManager.currentChain;
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('selectedChain');
        return stored || 'ETHEREUM';
    }

    // Get wallet chain
    async getWalletChain() {
        if (!window.ethereum) return null;

        try {
            // Check if wallet is available and connected
            if (!window.ethereum.isConnected || !window.ethereum.isConnected()) {
                return null;
            }

            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            return chainId;
        } catch (error) {
            // Don't spam console with wallet errors - just return null silently
            // These are common when wallet is not connected or available
            return null;
        }
    }

    // Normalize chain ID for comparison
    normalizeChainId(chainId) {
        if (chainId === 'ETHEREUM' || chainId === '0x1' || chainId === '1') {
            return '0x1';
        }
        if (chainId === 'BASE' || chainId === '0x2105' || chainId === '8453') {
            return '0x2105';
        }
        if (chainId === 'AVALANCHE' || chainId === '0xa86a' || chainId === '43114') {
            return '0xa86a';
        }
        if (chainId === 'BSC' || chainId === '0x38' || chainId === '56') {
            return '0x38';
        }
        if (chainId === 'MOONBEAM' || chainId === '0x504' || chainId === '1284') {
            return '0x504';
        }
        if (chainId === 'POLYGON' || chainId === '0x89' || chainId === '137') {
            return '0x89';
        }
        if (chainId === 'OPTIMISM' || chainId === '0xa' || chainId === '10') {
            return '0xa';
        }
        return chainId;
    }

    // Handle chain mismatch
    handleChainMismatch(appChain, walletChain) {
        // Prevent multiple toasts
        if (this.isHandlingMismatch || this.currentToast) return;
        
        this.isHandlingMismatch = true;

        const appChainName = this.chainNames[appChain] || appChain;
        const walletChainName = this.chainNames[walletChain] || walletChain;

        this.showToast(appChainName, walletChainName, appChain);
    }

    // Show toast notification
    showToast(appChainName, walletChainName, targetChain) {
        // If toast already exists, don't create another
        if (this.currentToast) {
            console.log('Toast already exists, skipping creation');
            return;
        }

        // Create toast HTML
        const toastHTML = `
            <div id="chainMismatchToast" style="
                position: fixed;
                top: 80px;
                right: 20px;
                background: white;
                border: 2px solid #f59e0b;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 400px;
                animation: slideIn 0.3s ease-out;
            ">
                <style>
                    @keyframes slideIn {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOut {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                    }
                    .toast-closing {
                        animation: slideOut 0.3s ease-out;
                    }
                </style>
                <div style="display: flex; align-items: start; gap: 12px;">
                    <div style="flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                                  stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
                            Chain Mismatch Detected
                        </h4>
                        <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 14px; line-height: 1.5;">
                            App is on <strong>${appChainName}</strong> but your wallet is on <strong>${walletChainName}</strong>.
                            Would you like to switch your wallet to <strong>${appChainName}</strong>?
                        </p>
                        <div style="display: flex; gap: 8px;">
                            <button id="switchChainBtn" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                                transition: transform 0.2s;
                            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                Switch Wallet to ${appChainName}
                            </button>
                            <button id="manualSwitchBtn" style="
                                background: #f3f4f6;
                                color: #4b5563;
                                border: 1px solid #d1d5db;
                                padding: 8px 16px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 500;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                                I'll Switch Manually
                            </button>
                        </div>
                        <div id="switchStatus" style="margin-top: 8px; display: none;">
                            <span style="color: #059669; font-size: 13px;">✓ Switching chain...</span>
                        </div>
                        <div id="switchError" style="margin-top: 8px; display: none;">
                            <span style="color: #dc2626; font-size: 13px;">✗ Failed to switch. Please switch manually in your wallet.</span>
                        </div>
                    </div>
                    <button id="closeToastBtn" style="
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 4px;
                        color: #9ca3af;
                        transition: color 0.2s;
                    " onmouseover="this.style.color='#4b5563'" onmouseout="this.style.color='#9ca3af'">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Check one more time if toast already exists (race condition prevention)
        if (this.currentToast || document.getElementById('chainMismatchToast')) {
            console.log('Toast already in DOM, skipping');
            return;
        }

        // Add toast to page
        const toastContainer = document.createElement('div');
        toastContainer.innerHTML = toastHTML;
        document.body.appendChild(toastContainer);
        this.currentToast = toastContainer;

        // Add event listeners
        const switchBtn = document.getElementById('switchChainBtn');
        const manualBtn = document.getElementById('manualSwitchBtn');
        const closeBtn = document.getElementById('closeToastBtn');

        switchBtn.addEventListener('click', async () => {
            await this.switchChain(targetChain);
        });

        manualBtn.addEventListener('click', () => {
            this.userDeclined = true;
            this.hideToast();
        });

        closeBtn.addEventListener('click', () => {
            this.userDeclined = true;
            this.hideToast();
        });
    }

    // Switch chain in wallet
    async switchChain(targetChain) {
        const statusDiv = document.getElementById('switchStatus');
        const errorDiv = document.getElementById('switchError');
        const switchBtn = document.getElementById('switchChainBtn');
        
        // Show status
        statusDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        switchBtn.disabled = true;
        switchBtn.style.opacity = '0.5';
        switchBtn.style.cursor = 'not-allowed';

        try {
            const chainId = this.chainIds[targetChain];
            
            // Try to switch chain
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });

            // Wait a bit for the switch to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify the switch was successful
            const newChainId = await this.getWalletChain();
            const normalizedNew = this.normalizeChainId(newChainId);
            const normalizedTarget = this.normalizeChainId(chainId);

            if (normalizedNew === normalizedTarget) {
                // Success! Hide toast
                statusDiv.innerHTML = '<span style="color: #059669; font-size: 13px;">✓ Chain switched successfully!</span>';
                setTimeout(() => {
                    this.hideToast();
                }, 1500);
            } else {
                // Failed to switch
                throw new Error('Chain switch failed');
            }

        } catch (error) {
            console.error('Error switching chain:', error);
            
            // Check if chain needs to be added
            if (error.code === 4902) {
                // Chain not added to wallet, try to add it
                await this.addChainToWallet(targetChain);
            } else {
                // Show error
                statusDiv.style.display = 'none';
                errorDiv.style.display = 'block';
                switchBtn.disabled = false;
                switchBtn.style.opacity = '1';
                switchBtn.style.cursor = 'pointer';
            }
        }
    }

    // Add chain to wallet
    async addChainToWallet(chain) {
        const chainConfigs = {
            'BASE': {
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18
                },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
            },
            'AVALANCHE': {
                chainId: '0xa86a',
                chainName: 'Avalanche C-Chain',
                nativeCurrency: {
                    name: 'Avalanche',
                    symbol: 'AVAX',
                    decimals: 18
                },
                rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                blockExplorerUrls: ['https://snowtrace.io']
            },
            'BSC': {
                chainId: '0x38',
                chainName: 'BNB Smart Chain',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                rpcUrls: ['https://bsc-dataseed1.binance.org'],
                blockExplorerUrls: ['https://bscscan.com']
            },
            'MOONBEAM': {
                chainId: '0x504',
                chainName: 'Moonbeam',
                nativeCurrency: {
                    name: 'Glimmer',
                    symbol: 'GLMR',
                    decimals: 18
                },
                rpcUrls: ['https://rpc.api.moonbeam.network'],
                blockExplorerUrls: ['https://moonscan.io']
            },
            'POLYGON': {
                chainId: '0x89',
                chainName: 'Polygon',
                nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18
                },
                rpcUrls: ['https://polygon-rpc.com'],
                blockExplorerUrls: ['https://polygonscan.com']
            },
            'OPTIMISM': {
                chainId: '0xa',
                chainName: 'Optimism',
                nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18
                },
                rpcUrls: ['https://mainnet.optimism.io'],
                blockExplorerUrls: ['https://optimistic.etherscan.io']
            }
        };

        const config = chainConfigs[chain];
        if (!config) {
            throw new Error('Chain configuration not found');
        }

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [config],
            });

            // Try switching again
            await this.switchChain(chain);
        } catch (error) {
            console.error('Error adding chain:', error);
            const errorDiv = document.getElementById('switchError');
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = '<span style="color: #dc2626; font-size: 13px;">✗ Failed to add chain. Please add it manually in your wallet.</span>';
        }
    }

    // Hide toast
    hideToast() {
        if (this.currentToast) {
            const toast = this.currentToast.querySelector('#chainMismatchToast');
            if (toast) {
                toast.classList.add('toast-closing');
                setTimeout(() => {
                    if (this.currentToast && this.currentToast.parentNode) {
                        this.currentToast.parentNode.removeChild(this.currentToast);
                    }
                    this.currentToast = null;
                    this.isHandlingMismatch = false;
                }, 300);
            } else {
                if (this.currentToast && this.currentToast.parentNode) {
                    this.currentToast.parentNode.removeChild(this.currentToast);
                }
                this.currentToast = null;
                this.isHandlingMismatch = false;
            }
        } else {
            this.isHandlingMismatch = false;
        }
        
        // Also remove any orphaned toasts (cleanup)
        const orphanedToasts = document.querySelectorAll('#chainMismatchToast');
        orphanedToasts.forEach(toast => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast.parentNode);
            }
        });
    }

    // Request wallet to switch to a specific chain (called from network selector)
    async requestWalletSwitch(targetChain) {
        try {
            const chainId = this.chainIds[targetChain];
            
            // Try to switch chain
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            });
            
            // Wait a bit for the switch to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify the switch was successful
            const newChainId = await this.getWalletChain();
            const normalizedNew = this.normalizeChainId(newChainId);
            const normalizedTarget = this.normalizeChainId(chainId);
            
            return normalizedNew === normalizedTarget;
        } catch (error) {
            console.error('Error switching wallet chain:', error);
            
            // If chain not found, try to add it
            if (error.code === 4902 && (targetChain === 'BASE' || targetChain === 'AVALANCHE' || targetChain === 'BSC' || targetChain === 'MOONBEAM' || targetChain === 'POLYGON' || targetChain === 'OPTIMISM')) {
                try {
                    await this.addChainToWallet(targetChain);
                    // Try switching again
                    return await this.requestWalletSwitch(targetChain);
                } catch (addError) {
                    console.error('Failed to add chain:', addError);
                    return false;
                }
            }
            
            return false;
        }
    }
    
    // Clean up
    destroy() {
        this.stopChainMismatchDetection();
        this.hideToast();
        
        if (window.ethereum) {
            window.ethereum.removeAllListeners('chainChanged');
        }
    }
}

// Create and export singleton instance
export const chainMismatchHandler = new ChainMismatchHandler();

// Auto-initialize when imported
if (typeof window !== 'undefined') {
    // Wait for DOM and ethereum to be ready
    const initHandler = () => {
        if (window.ethereum) {
            chainMismatchHandler.initialize();
            // Chain mismatch handler initialized
        } else {
            // Retry after a delay if ethereum not ready
            setTimeout(initHandler, 1000);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHandler);
    } else {
        initHandler();
    }
}

export default chainMismatchHandler;