# Adding a New Chain to WenXen.com

This blueprint provides a comprehensive, step-by-step guide for integrating a new blockchain network into WenXen.com. Follow these steps carefully to ensure complete data isolation and proper multi-chain functionality.

---

## Prerequisites

Before starting, gather the following information for the new chain:

### Required Information Checklist

- [ ] **Chain ID** (decimal format, e.g., `43114`)
- [ ] **Chain Name** (e.g., `Avalanche`)
- [ ] **Short Name** (uppercase, e.g., `AVAX`)
- [ ] **Native Currency** (name, symbol, decimals)
- [ ] **RPC Endpoints** (1 default + 5-6 fallback URLs)
- [ ] **Block Explorer** (name, base URL, API URL)
- [ ] **XEN Genesis Timestamp** (Unix timestamp)
- [ ] **XEN Genesis Date** (UTC date for verification)
- [ ] **XEN Deployment Block** (block number when XEN was deployed)

### Smart Contract Addresses

- [ ] **XEN Crypto** contract address
- [ ] **CoinTool** contract address
- [ ] **XENFT Torrent** contract address
- [ ] **XENFT Stake** contract address
- [ ] **Remint Helper** contract address (requires discovery - see Section 1)

---

## Section 1: Discover Remint Helper Address

The Remint Helper address is chain-specific and must be discovered through transaction analysis.

### Step 1.1: Identify CoinTool Contract

Verify the CoinTool contract address on the new chain via block explorer.

### Step 1.2: Create Discovery Tool

Create a temporary HTML tool to analyze CoinTool transactions:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Find [CHAIN] Remint Helper</title>
</head>
<body>
    <h1>Find [CHAIN_NAME] Remint Helper Address</h1>
    <button onclick="findHelper()">Find Helper Address</button>
    <div id="results"></div>

    <script>
        const API_KEY = 'YOUR_ETHERSCAN_API_KEY';
        const CHAIN_ID = [CHAIN_ID]; // e.g., 43114
        const COINTOOL_ADDRESS = '[COINTOOL_ADDRESS]';
        const REMINT_SELECTOR = '0xc2580804'; // Universal f() selector

        async function findHelper() {
            // Get recent transactions to CoinTool
            const url = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}&module=account&action=txlist&address=${COINTOOL_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === '1' && data.result) {
                // Filter for remint transactions (selector 0xc2580804)
                const remintTxs = data.result.filter(tx =>
                    tx.input && tx.input.startsWith('0xc2580804')
                );

                if (remintTxs.length > 0) {
                    // Extract helper address from call data
                    const tx = remintTxs[0];
                    const callData = tx.input;

                    // Helper address is in the nested call data
                    // Pattern: analyze transaction for delegatecall target
                    console.log('Sample remint transaction:', tx.hash);
                    console.log('Analyze this transaction to find the helper contract');

                    document.getElementById('results').innerHTML = `
                        <h3>Sample Remint Transaction:</h3>
                        <p>TX Hash: <a href="https://[explorer]/tx/${tx.hash}" target="_blank">${tx.hash}</a></p>
                        <p>Analyze the transaction's internal calls to find the helper address</p>
                    `;
                }
            }
        }
    </script>
</body>
</html>
```

### Step 1.3: Analyze Transaction

1. Run the discovery tool to find a remint transaction
2. Open the transaction in the block explorer
3. Look at "Internal Transactions" or "State Changes"
4. Find the contract that receives the delegatecall from CoinTool
5. This is your Remint Helper address

### Step 1.4: Verify Helper Bytecode

Verify the helper contract is exactly **1130 bytes**:

```javascript
const helperAddress = '[DISCOVERED_ADDRESS]';
const bytecode = await web3.eth.getCode(helperAddress);
const bytecodeLength = (bytecode.length - 2) / 2; // Remove '0x' and divide by 2
console.log(`Helper bytecode length: ${bytecodeLength} bytes`);
// Should output: "Helper bytecode length: 1130 bytes"
```

---

## Section 2: Update Chain Configuration

### File: `js/config/chainConfig.js`

Add the new chain configuration to the `SUPPORTED_CHAINS` object:

```javascript
export const SUPPORTED_CHAINS = {
  ETHEREUM: { /* existing */ },
  BASE: { /* existing */ },

  // ADD NEW CHAIN HERE
  [CHAIN_NAME_UPPERCASE]: {
    id: [CHAIN_ID],
    name: '[Chain Display Name]',
    shortName: '[SHORT_NAME]',
    nativeCurrency: {
      name: '[Currency Name]',
      symbol: '[SYMBOL]',
      decimals: 18
    },
    rpcUrls: {
      default: '[PRIMARY_RPC_URL]',
      fallback: [
        '[FALLBACK_RPC_1]',
        '[FALLBACK_RPC_2]',
        '[FALLBACK_RPC_3]',
        '[FALLBACK_RPC_4]',
        '[FALLBACK_RPC_5]',
        '[FALLBACK_RPC_6]'
      ]
    },
    explorer: {
      name: '[Explorer Name]',
      baseUrl: '[https://explorer.url]',
      apiUrl: '[https://api.explorer.url/api]',
      txUrl: '[https://explorer.url/tx/]',
      addressUrl: '[https://explorer.url/address/]',
      blockUrl: '[https://explorer.url/block/]'
    },
    contracts: {
      XEN_CRYPTO: '[XEN_CONTRACT_ADDRESS]',
      COINTOOL: '[COINTOOL_ADDRESS]',
      XENFT_TORRENT: '[XENFT_TORRENT_ADDRESS]',
      XENFT_STAKE: '[XENFT_STAKE_ADDRESS]',
      REMINT_HELPER: '[REMINT_HELPER_ADDRESS]' // From Section 1
    },
    events: {
      // These are universal across all chains
      COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37',
      REMINT_SELECTOR: '0xc2580804',
      CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8',
      CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
    },
    constants: {
      SALT_BYTES_TO_QUERY: '0x01',
      COINTOOL_SALT_BYTES: '0x29A2241A010000000000',
      XEN_GENESIS_TIMESTAMP: [UNIX_TIMESTAMP],
      XEN_GENESIS_DATE_MS: Date.UTC([YEAR], [MONTH-1], [DAY], [HOUR], [MINUTE], [SECOND], 0),
      XEN_DEPLOYMENT_BLOCK: [BLOCK_NUMBER],
      BASE_AMP: 3000
    },
    databases: {
      COINTOOL_DB: '[PREFIX]_DB_Cointool',
      XENFT_DB: '[PREFIX]_DB_Xenft',
      XEN_STAKE_DB: '[PREFIX]_DB_XenStake',
      XENFT_STAKE_DB: '[PREFIX]_DB_XenftStake'
    },
    dbVersions: {
      COINTOOL: 1,
      XENFT: 1,
      STAKE: 1
    },
    coingecko: {
      xenId: 'xen-crypto' // Same for all chains
    }
  }
};
```

**Database Prefix Convention:**
- Ethereum: `ETH_`
- Base: `BASE_`
- Avalanche: `AVAX_`
- **New Chain**: Use 3-5 letter abbreviation (e.g., `MATIC_`, `ARB_`, `OP_`)

---

## Section 3: Update UI Components

### File: `index.html`

Add the new chain to the network selector dropdown:

```html
<div id="networkDropdown" class="network-dropdown" hidden>
  <div class="network-dropdown-header">Select Network</div>

  <!-- Existing chains -->
  <button class="network-option" data-chain="ETHEREUM">
    <span class="network-option-icon">⟠</span>
    <span class="network-option-name">Ethereum</span>
    <span class="network-option-check" data-chain="ETHEREUM">✓</span>
  </button>

  <button class="network-option" data-chain="BASE">
    <span class="network-option-icon">🔵</span>
    <span class="network-option-name">Base</span>
    <span class="network-option-check" data-chain="BASE" style="display: none;">✓</span>
  </button>

  <button class="network-option" data-chain="AVALANCHE">
    <span class="network-option-icon">🔺</span>
    <span class="network-option-name">Avalanche</span>
    <span class="network-option-check" data-chain="AVALANCHE" style="display: none;">✓</span>
  </button>

  <!-- ADD NEW CHAIN HERE -->
  <button class="network-option" data-chain="[CHAIN_NAME_UPPERCASE]">
    <span class="network-option-icon">[EMOJI_ICON]</span>
    <span class="network-option-name">[Chain Display Name]</span>
    <span class="network-option-check" data-chain="[CHAIN_NAME_UPPERCASE]" style="display: none;">✓</span>
  </button>
</div>
```

**Icon Selection Tips:**
- Choose a unique emoji that represents the chain
- Examples: Ethereum ⟠, Base 🔵, Avalanche 🔺, Polygon 🟣, Arbitrum 🔷

---

## Section 4: Update Network Selector Logic

### File: `js/ui/networkSelector.js`

#### Update: Icon Mapping

```javascript
getChainIcon(chain) {
  const icons = {
    'ETHEREUM': '⟠',
    'BASE': '🔵',
    'AVALANCHE': '🔺',
    '[CHAIN_NAME_UPPERCASE]': '[EMOJI_ICON]' // ADD HERE
  };
  return icons[chain] || '🔗';
}
```

#### Update: Explorer Link Selector

```javascript
updateExplorerLinks() {
  const config = chainManager.getCurrentConfig();

  // Update any existing explorer links
  const links = document.querySelectorAll(
    'a[href*="etherscan.io"], ' +
    'a[href*="basescan.org"], ' +
    'a[href*="snowtrace.io"], ' +
    'a[href*="[new-explorer.url]"]' // ADD HERE
  );

  // ... rest of function
}
```

#### Update: Unsupported Chain Warning

```javascript
if (!chainKey) {
  console.log('Wallet switched to unsupported chain ID:', chainId);
  if (window.toastManager) {
    window.toastManager.showToast(
      `Chain ID ${chainId} is not supported. Please switch to Ethereum, Base, Avalanche, or [New Chain].`, // UPDATE HERE
      'warning'
    );
  }
}
```

### File: `js/ui/networkSelectorWorking.js`

#### Update: Icon Mapping (same as above)

```javascript
const icons = {
  'ETHEREUM': '⟠',
  'BASE': '🔵',
  'AVALANCHE': '🔺',
  '[CHAIN_NAME_UPPERCASE]': '[EMOJI_ICON]' // ADD HERE
};
iconEl.textContent = icons[currentChain] || '🔗';
```

---

## Section 5: Update Chain Mismatch Handler

### File: `js/utils/chainMismatchHandler.js`

This file handles wallet network switching and chain detection.

#### Update: Chain Name Mappings

```javascript
this.chainNames = {
  'ETHEREUM': 'Ethereum',
  'BASE': 'Base',
  'AVALANCHE': 'Avalanche',
  '[CHAIN_NAME_UPPERCASE]': '[Chain Display Name]', // ADD HERE
  '0x1': 'Ethereum',
  '0x2105': 'Base',
  '0xa86a': 'Avalanche',
  '[HEX_CHAIN_ID]': '[Chain Display Name]', // ADD HERE (e.g., '0x89' for Polygon)
  '1': 'Ethereum',
  '8453': 'Base',
  '43114': 'Avalanche',
  '[CHAIN_ID]': '[Chain Display Name]' // ADD HERE (decimal format)
};
```

**How to get Hex Chain ID:**
```javascript
const hexChainId = '0x' + [CHAIN_ID].toString(16);
// Example: 137 → '0x89' (Polygon)
//          42161 → '0xa4b1' (Arbitrum)
```

#### Update: Chain ID Mappings

```javascript
this.chainIds = {
  'ETHEREUM': '0x1',
  'BASE': '0x2105',
  'AVALANCHE': '0xa86a',
  '[CHAIN_NAME_UPPERCASE]': '[HEX_CHAIN_ID]', // ADD HERE
  '0x1': '0x1',
  '0x2105': '0x2105',
  '0xa86a': '0xa86a',
  '[HEX_CHAIN_ID]': '[HEX_CHAIN_ID]' // ADD HERE
};
```

#### Update: handleWalletChainChange Method

```javascript
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
  } else if (chainIdNum === [CHAIN_ID]) { // ADD HERE
    targetChain = '[CHAIN_NAME_UPPERCASE]';
  }

  if (targetChain) {
    // ... rest of function
  }
}
```

#### Update: normalizeChainId Method

```javascript
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
  // ADD HERE
  if (chainId === '[CHAIN_NAME_UPPERCASE]' || chainId === '[HEX_CHAIN_ID]' || chainId === '[CHAIN_ID]') {
    return '[HEX_CHAIN_ID]';
  }
  return chainId;
}
```

#### Update: addChainToWallet Method

```javascript
async addChainToWallet(chain) {
  const chainConfigs = {
    'BASE': { /* existing */ },
    'AVALANCHE': { /* existing */ },
    // ADD HERE
    '[CHAIN_NAME_UPPERCASE]': {
      chainId: '[HEX_CHAIN_ID]',
      chainName: '[Chain Display Name]',
      nativeCurrency: {
        name: '[Currency Name]',
        symbol: '[SYMBOL]',
        decimals: 18
      },
      rpcUrls: ['[PRIMARY_RPC_URL]'],
      blockExplorerUrls: ['[EXPLORER_BASE_URL]']
    }
  };
  // ... rest of function
}
```

#### Update: requestWalletSwitch Method

```javascript
if (error.code === 4902 && (
  targetChain === 'BASE' ||
  targetChain === 'AVALANCHE' ||
  targetChain === '[CHAIN_NAME_UPPERCASE]' // ADD HERE
)) {
  // ... try to add chain
}
```

---

## Section 6: Fix Database Isolation

**CRITICAL:** This ensures data from different chains doesn't mix.

### Files to Update

Update the chain prefix logic in these files to include the new chain:

#### Pattern to Find and Replace:

**OLD PATTERN:**
```javascript
const chainPrefix = currentChain === 'BASE' ? 'BASE' : (currentChain === 'AVALANCHE' ? 'AVAX' : 'ETH');
```

**NEW PATTERN:**
```javascript
const chainPrefix =
  currentChain === 'BASE' ? 'BASE' :
  (currentChain === 'AVALANCHE' ? 'AVAX' :
  (currentChain === '[CHAIN_NAME_UPPERCASE]' ? '[PREFIX]' : 'ETH'));
```

**Alternative (cleaner) approach:**
```javascript
const chainPrefixMap = {
  'ETHEREUM': 'ETH',
  'BASE': 'BASE',
  'AVALANCHE': 'AVAX',
  '[CHAIN_NAME_UPPERCASE]': '[PREFIX]'
};
const chainPrefix = chainPrefixMap[currentChain] || 'ETH';
```

### Files Requiring Updates:

1. **js/main_app.js** - Multiple locations (~6 places):
   - `openDB()` function
   - `deleteAllDataWithStorage()` function
   - `deleteAllScanData()` function
   - Legacy settings apply function
   - Export backup function
   - Import backup function

2. **js/scanners/cointool_scanner.js**:
   - `openCointoolDB()` function

3. **js/scanners/xenft_scanner.js**:
   - `openDB()` function

4. **js/scanners/xenft_stake_scanner.js**:
   - `openDB()` function

### Search Command to Find All Locations:

```bash
# Find all instances that need updating
grep -n "chainPrefix.*BASE.*ETH\|BASE.*?.*:.*ETH" js/main_app.js js/scanners/*.js
```

---

## Section 7: Update Documentation

### File: `CHAIN_COMPARISON.md`

Add the new chain to all comparison tables and sections.

#### Update: Quick Reference Table

```markdown
| Category | Ethereum | Base | Avalanche | [New Chain] |
|----------|----------|------|-----------|-------------|
| **Chain ID** | 1 | 8453 | 43114 | [CHAIN_ID] |
| **Short Name** | ETH | BASE | AVAX | [SHORT_NAME] |
| **Explorer** | Etherscan | BaseScan | SnowTrace | [Explorer Name] |
| **XEN Launch** | Oct 8, 2022 | Aug 25, 2023 | Oct 13, 2022 | [Launch Date] |
| **Deployment Block** | 15,704,871 | 3,098,388 | 27,265,450 | [BLOCK_NUMBER] |
```

#### Add: Network Details Section

```markdown
### [Chain Name]
- **Chain ID**: [CHAIN_ID]
- **Name**: [Chain Display Name]
- **Short Name**: [SHORT_NAME]
- **Native Currency**: [Currency Name] ([SYMBOL]), 18 decimals
- **Explorer**: [[Explorer Name]]([EXPLORER_URL])
```

#### Add: RPC Endpoints Section

```markdown
### [Chain Name]
- **Default**: `[PRIMARY_RPC]`
- **Fallback**:
  - `[FALLBACK_1]`
  - `[FALLBACK_2]`
  - `[FALLBACK_3]`
  - `[FALLBACK_4]`
  - `[FALLBACK_5]`
```

#### Update: Smart Contract Addresses Table

```markdown
| Contract | Ethereum | Base | Avalanche | [New Chain] |
|----------|----------|------|-----------|-------------|
| **XEN Crypto** | 0x0645... | 0xffcb... | 0xC0C5... | [XEN_ADDRESS] |
| **CoinTool** | 0x0dE8... | 0x9Ec1... | 0x9Ec1... | [COINTOOL_ADDRESS] |
| **XENFT Torrent** | 0x0a25... | 0x3790... | 0x94d9... | [XENFT_ADDRESS] |
| **XENFT Stake** | 0xfEdA... | 0xfC0e... | 0x1Ac1... | [XENFT_STAKE_ADDRESS] |
| **Remint Helper** | 0xc7ba... | 0xc82b... ✅ | 0xd8fb... ✅ | [HELPER_ADDRESS] ✅ |
```

#### Update: XEN Protocol Constants Table

```markdown
| Constant | Ethereum | Base | Avalanche | [New Chain] |
|----------|----------|------|-----------|-------------|
| **Genesis Timestamp** | 1665250163 | 1692986123 | 1665700430 | [TIMESTAMP] |
| **Genesis Date** | Oct 8, 2022 00:00 UTC | Aug 25, 2023 16:13 UTC | Oct 13, 2022 19:40 UTC | [FORMATTED_DATE] |
| **Deployment Block** | 15,704,871 | 3,098,388 | 27,265,450 | [BLOCK_NUMBER] |
```

#### Update: Database Configuration Section

```markdown
### [Chain Name]
- **CoinTool**: `[PREFIX]_DB_Cointool` (v1)
- **XENFT**: `[PREFIX]_DB_Xenft` (v1)
- **XEN Stake**: `[PREFIX]_DB_XenStake` (v1)
- **XENFT Stake**: `[PREFIX]_DB_XenftStake` (v1)
```

---

## Section 8: Testing Checklist

Before considering the integration complete, test all functionality:

### Pre-Integration Tests

- [ ] Verified all contract addresses on block explorer
- [ ] Confirmed Remint Helper is exactly 1130 bytes
- [ ] Verified XEN genesis timestamp and deployment block
- [ ] Tested at least one RPC endpoint for connectivity

### Post-Integration Tests

#### UI & Display
- [ ] Chain appears in network selector dropdown
- [ ] Correct icon displays for the chain
- [ ] Chain name displays correctly in header
- [ ] Network badge updates when switching

#### Wallet Integration
- [ ] Wallet prompts to switch networks
- [ ] Can add chain to wallet (if not already present)
- [ ] Chain ID validation works correctly
- [ ] Mismatch warnings display properly

#### Data Isolation
- [ ] Switching to new chain shows empty database (first time)
- [ ] Scanning creates chain-specific database ([PREFIX]_DB_*)
- [ ] Switching back to Ethereum shows Ethereum data
- [ ] Switching to new chain again shows saved new chain data
- [ ] No data cross-contamination between chains
- [ ] Can verify in browser DevTools → Application → IndexedDB

#### Scanning Functionality
- [ ] CoinTool scanner works on new chain
- [ ] XENFT scanner works on new chain
- [ ] XENFT Stake scanner works on new chain
- [ ] XEN Stake scanner works on new chain
- [ ] Progress displays correctly
- [ ] Error messages are chain-specific

#### Transaction Operations
- [ ] Can view transactions on correct explorer
- [ ] Remint helper address is correct
- [ ] Transaction links use correct explorer
- [ ] Block explorer API returns correct data

#### Settings & Storage
- [ ] RPC endpoints save/load correctly for new chain
- [ ] Addresses save/load correctly for new chain
- [ ] Settings are chain-specific
- [ ] Export backup includes new chain data
- [ ] Import backup restores new chain data correctly

---

## Section 9: Commit Strategy

Follow this commit sequence for clean git history:

### Commit 1: Add Chain Configuration
```bash
git add js/config/chainConfig.js CHAIN_COMPARISON.md
git commit -m "Add [Chain Name] network support

- Added complete [Chain Name] configuration (chain ID [CHAIN_ID])
- Configured [N] RPC endpoints with fallbacks
- Added all smart contract addresses including verified Remint Helper
- Set XEN genesis constants ([Launch Date] launch, block [BLOCK_NUMBER])
- Created [PREFIX]-prefixed database names for data isolation
- Updated CHAIN_COMPARISON.md with [Chain Name] details
- Verified Remint Helper: [ADDRESS] (1130 bytes)

WenXen.com now supports Ethereum, Base, Avalanche, and [Chain Name] networks."
```

### Commit 2: Add UI Integration
```bash
git add index.html js/ui/networkSelector.js js/ui/networkSelectorWorking.js
git commit -m "Add [Chain Name] to network selector UI

- Added [Chain Name] option to network dropdown with [icon] icon
- Updated network selector JavaScript with [Chain Name] support
- Added [Chain Name] to explorer link handling
- Updated unsupported chain warning message"
```

### Commit 3: Add Wallet Integration
```bash
git add js/utils/chainMismatchHandler.js
git commit -m "Add [Chain Name] wallet switching support

- Added [Chain Name] chain ID mappings ([CHAIN_ID] / [HEX_CHAIN_ID])
- Updated chain name mappings for [Chain Name]
- Added [Chain Name] to normalizeChainId method
- Added [Chain Name] chain configuration for wallet_addEthereumChain
- Updated requestWalletSwitch to handle [Chain Name] chain addition"
```

### Commit 4: Fix Data Isolation
```bash
git add js/main_app.js js/scanners/*.js
git commit -m "Fix [Chain Name] data isolation across all database operations

- Fixed database prefix hardcoding in main_app.js
- Fixed database prefix in all scanners (cointool, xenft, xenft_stake)
- All database operations now properly handle [CHAIN_NAME_UPPERCASE] chain
- Database names: ETH_DB_* / BASE_DB_* / AVAX_DB_* / [PREFIX]_DB_*
- Prevents data cross-contamination between chains
- Ensures complete data isolation for [Chain Name] network"
```

---

## Section 10: Common Issues & Solutions

### Issue: Remint Helper Not Found

**Symptom:** Cannot find Remint Helper address for the new chain.

**Solution:**
1. Verify CoinTool contract has remint functionality
2. Find recent remint transactions (selector `0xc2580804`)
3. Analyze internal transactions to find the helper
4. Some chains may not have a Remint Helper - in this case, the field can be set to `null` or `'0x0000000000000000000000000000000000000000'`

### Issue: Wrong Database Prefix

**Symptom:** New chain shows data from another chain.

**Solution:**
1. Search all files for `chainPrefix` logic
2. Ensure new chain is included in all ternary operators
3. Use the cleaner `chainPrefixMap` approach for better maintainability
4. Clear browser cache and IndexedDB
5. Test with browser DevTools → Application → IndexedDB

### Issue: RPC Endpoints Not Working

**Symptom:** Cannot connect to the new chain's RPC.

**Solution:**
1. Test each RPC endpoint manually using curl or Postman
2. Verify endpoints support required methods (`eth_chainId`, `eth_getBlockNumber`, etc.)
3. Check for CORS restrictions
4. Ensure endpoints are HTTPS (not HTTP)
5. Add more fallback RPCs from public sources

### Issue: Explorer API Returns Errors

**Symptom:** Scanning fails with API errors.

**Solution:**
1. Verify the explorer supports Etherscan V2 API format
2. Check API key works with the new chain
3. Test API endpoint manually: `https://api.etherscan.io/v2/api?chainid=[CHAIN_ID]&module=proxy&action=eth_blockNumber&apikey=[KEY]`
4. Some explorers may not be fully compatible - may need custom adapter

### Issue: Wallet Won't Switch Chains

**Symptom:** Wallet switching fails or doesn't prompt.

**Solution:**
1. Verify hex chain ID is correct: `'0x' + chainId.toString(16)`
2. Check chain is not already added to wallet with different parameters
3. Test `wallet_addEthereumChain` parameters manually
4. Some wallets may require chain to be added manually first

---

## Section 11: Verification Script

Run this script in browser console to verify integration:

```javascript
// Verification script for new chain integration
async function verifyChainIntegration(chainName) {
  console.log(`=== Verifying ${chainName} Integration ===\n`);

  // 1. Check configuration exists
  const config = window.SUPPORTED_CHAINS[chainName];
  console.log('✓ Configuration found:', !!config);

  if (!config) {
    console.error('❌ Configuration missing!');
    return;
  }

  // 2. Verify required fields
  const requiredFields = ['id', 'name', 'shortName', 'nativeCurrency', 'rpcUrls', 'explorer', 'contracts', 'events', 'constants', 'databases'];
  requiredFields.forEach(field => {
    console.log(`✓ Has ${field}:`, !!config[field]);
  });

  // 3. Test chain manager
  window.chainManager.setChain(chainName);
  const currentChain = window.chainManager.getCurrentChain();
  console.log('✓ Chain manager works:', currentChain === chainName);

  // 4. Check database names
  const dbNames = config.databases;
  console.log('✓ Database names:', dbNames);

  // 5. Verify hex chain ID
  const hexChainId = '0x' + config.id.toString(16);
  console.log('✓ Hex chain ID:', hexChainId);

  // 6. Test RPC connectivity
  console.log('\nTesting RPC connectivity...');
  const web3 = new Web3(config.rpcUrls.default);
  try {
    const blockNumber = await web3.eth.getBlockNumber();
    console.log('✓ RPC works! Current block:', blockNumber);
  } catch (error) {
    console.error('❌ RPC failed:', error.message);
  }

  // 7. Check UI elements
  const dropdown = document.querySelector(`[data-chain="${chainName}"]`);
  console.log('✓ UI dropdown element exists:', !!dropdown);

  console.log('\n=== Verification Complete ===');
}

// Usage:
verifyChainIntegration('[CHAIN_NAME_UPPERCASE]');
```

---

## Section 12: Quick Reference

### Chain Configuration Template

```javascript
{
  id: [CHAIN_ID],
  name: '[Display Name]',
  shortName: '[SHORT]',
  nativeCurrency: { name: '[Name]', symbol: '[SYM]', decimals: 18 },
  rpcUrls: { default: '[RPC]', fallback: ['...'] },
  explorer: { name: '[Name]', baseUrl: '[URL]', apiUrl: '[API]', txUrl: '[TX]', addressUrl: '[ADDR]', blockUrl: '[BLOCK]' },
  contracts: { XEN_CRYPTO: '[ADDR]', COINTOOL: '[ADDR]', XENFT_TORRENT: '[ADDR]', XENFT_STAKE: '[ADDR]', REMINT_HELPER: '[ADDR]' },
  events: { COINTOOL_MINT_TOPIC: '0xe914...', REMINT_SELECTOR: '0xc258...', CLAIM_MINT_REWARD_SELECTOR: '0xa230...', CLAIM_AND_STAKE_SELECTOR: '0xf2f4...' },
  constants: { SALT_BYTES_TO_QUERY: '0x01', COINTOOL_SALT_BYTES: '0x29A2...', XEN_GENESIS_TIMESTAMP: [TS], XEN_GENESIS_DATE_MS: Date.UTC(...), XEN_DEPLOYMENT_BLOCK: [BLOCK], BASE_AMP: 3000 },
  databases: { COINTOOL_DB: '[PRE]_DB_Cointool', XENFT_DB: '[PRE]_DB_Xenft', XEN_STAKE_DB: '[PRE]_DB_XenStake', XENFT_STAKE_DB: '[PRE]_DB_XenftStake' },
  dbVersions: { COINTOOL: 1, XENFT: 1, STAKE: 1 },
  coingecko: { xenId: 'xen-crypto' }
}
```

### Database Prefix Examples

- Ethereum: `ETH`
- Base: `BASE`
- Avalanche: `AVAX`
- Polygon: `MATIC`
- Arbitrum: `ARB`
- Optimism: `OP`
- Fantom: `FTM`
- Binance Smart Chain: `BSC`

### Universal Event Signatures

These are the same across all EVM chains:

```javascript
COINTOOL_MINT_TOPIC: '0xe9149e1b5059238baed02fa659dbf4bd932fbcf760a431330df4d934bc942f37'
REMINT_SELECTOR: '0xc2580804'
CLAIM_MINT_REWARD_SELECTOR: '0xa2309ff8'
CLAIM_AND_STAKE_SELECTOR: '0xf2f4eb26'
```

---

## Completion Checklist

- [ ] Discovered Remint Helper address
- [ ] Added chain configuration to `chainConfig.js`
- [ ] Updated `index.html` with network option
- [ ] Updated `networkSelector.js` with icon
- [ ] Updated `networkSelectorWorking.js` with icon
- [ ] Updated `chainMismatchHandler.js` with all mappings
- [ ] Fixed database isolation in `main_app.js`
- [ ] Fixed database isolation in all scanners
- [ ] Updated `CHAIN_COMPARISON.md` documentation
- [ ] Tested all functionality (see Section 8)
- [ ] Made clean commits (see Section 9)
- [ ] Verified integration with script (see Section 11)

---

**Note:** This blueprint is based on the Avalanche integration (commits e68a69e, b215c2f, c19c195). Follow it carefully to ensure complete and correct integration of any new blockchain network.

**Last Updated:** Based on Avalanche integration completed January 2025
