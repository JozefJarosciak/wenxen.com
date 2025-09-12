# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

**WenXen.com** is a client-side web application that runs entirely in the browser. No build tools, bundlers, or package managers are required - simply open `index.html` in a browser.

### Local Development
- Open `index.html` directly in a web browser
- Works with `file://` protocol for offline development
- All functionality available locally except external API calls
- Browser developer tools are the primary debugging interface

### Testing
- Manual testing in browser using live Ethereum/Base networks or testnets
- Configure test addresses and API keys in Settings tab
- Use browser developer console for debugging and monitoring
- Test wallet connections using MetaMask or Rabby with test networks

## Architecture Overview

### Client-Side Only Architecture
The application is designed as a pure client-side solution with no backend servers:
- **Data Storage**: All data stored in browser's IndexedDB
- **Processing**: All logic runs in browser JavaScript
- **Blockchain Access**: Direct RPC calls to Ethereum/Base networks
- **API Integration**: External APIs (Etherscan/BaseScan) called directly from browser

### Modular JavaScript Architecture
The codebase uses ES6 modules with a clear separation of concerns:

#### Configuration Layer (`/js/config/`)
- `chainConfig.js`: Multi-chain configurations (contracts, RPCs, explorers)
- `configuration.js`: Dynamic config system with chain delegation

#### Data Layer (`/js/data/`)
- `indexedDbUtils.js`: Database operations and migrations
- `apiUtils.js`: External API communication (Etherscan, CoinGecko, DexScreener)

#### Blockchain Layer (`/js/blockchain/`)
- `web3Utils.js`: Web3 interaction utilities
- **Scanner System** (`/js/scanners/`): Block-based enumeration for transaction discovery
  - `cointool_scanner.js`: Cointool contract events
  - `xenft_scanner.js`: XENFT token discovery via block enumeration
  - `xenft_stake_scanner.js`: XENFT staking events
  - `xen_scanner.js`: Native XEN operations

#### UI Layer (`/js/ui/`)
- Modular UI components with global function exports
- `themeManager.js`: Theme switching (light/dark modes)
- `modalManager.js`: Privacy and onboarding modals
- `tabManager.js`: Main application tabs
- `tooltipManager.js`: Cross-platform tooltip system
- `toastManager.js`: Notification system
- `deployVersionManager.js`: Git commit history with collapsible details
- `xenValueToastManager.js`: Enhanced XEN value display with USD conversion

#### Application Core
- `main_app.js`: Application coordination and Tabulator table configuration
- `unified_view.js`: Data presentation and filtering
- `mint_flows.js`: On-chain transaction workflows
- `xen-breakdown.js`: XEN economics calculations

### Database Architecture
- **IndexedDB**: Browser-native database for persistent storage
- **Migration System**: Multiple safety levels (Ultra Safe, Super Safe, Safe, Standard)
- **Chain-Specific Storage**: Separate databases per blockchain network
- **Local Caching**: Block timestamps and API responses cached for performance

### Multi-Chain Support
The application supports multiple blockchain networks with unified interfaces:
- **Ethereum Mainnet**: Original XEN deployment
- **Base Network**: Layer 2 scaling solution
- **Chain Manager**: Automatic detection and switching between networks
- **Contract Addressing**: Chain-specific contract addresses and configurations

## Key Development Patterns

### Module Export Pattern
All UI modules export functionality to `window` object for global access:
```javascript
// Inside module
export const moduleManager = { /* functionality */ };

// Global access
window.moduleFunction = () => moduleManager.function();
```

### Scanner Architecture
All scanners use block enumeration method for maximum reliability:
- Block-based scanning with configurable chunk sizes
- Rate limiting to avoid API rate limits (200ms delays)
- Progress reporting with real-time updates
- Automatic RPC failover and retry logic
- Transaction filtering by contract address and event signatures

### Theme System
Multi-theme support with CSS variables:
- Base styles in `base.css`
- Theme-specific overrides in `theme-*.css`
- JavaScript theme manager handles switching and persistence
- Components designed to work across all themes

### Error Handling Strategy
- Graceful degradation when APIs fail
- Local fallback data for critical functionality
- User-friendly error messages via toast system
- Comprehensive console logging for debugging

## Deployment Options

### GitHub Pages (Recommended for Development)
- Static hosting from repository
- Automatic SSL and global CDN
- Zero configuration required

### AWS Lambda (Production)
```bash
# Deploy to AWS (Windows)
cd deployment
initial-configure-aws.bat      # First time setup
initial-deploy.bat            # Deploy infrastructure
wenxen-deploy.bat            # Update application
```

### Cost Monitoring (AWS)
```bash
# Generate cost reports
get-wenxen-costs.bat         # Quick cost check
RunAWSCosts.bat             # Detailed dashboard
```

## Critical Development Notes

### Scanner Performance
- **XENFT Scanning**: Block enumeration is slow (~50k transactions per chunk)
- **Rate Limiting**: Essential to avoid API throttling
- **Progress UI**: Must provide user feedback during long scans
- **Error Recovery**: Handle network timeouts and API failures gracefully

### Database Migrations
- Use appropriate safety level based on risk:
  - `databaseMigrationUltraSafe.js`: Maximum safety, slowest
  - `databaseMigrationSafe.js`: Balanced approach
  - `databaseMigration.js`: Standard migration
- Test migrations thoroughly before deployment

### Wallet Integration
- Support MetaMask and Rabby wallets
- Handle network switching automatically
- Validate chain ID matches expected network
- Graceful handling of wallet disconnection

### API Dependencies
- **Etherscan/BaseScan**: Transaction history and gas prices
- **CoinGecko/DexScreener**: XEN price data with automatic fallback
- **RPC Providers**: Multiple providers with failover logic
- **Rate Limiting**: Essential for all external API calls

### Security Considerations
- All API keys stored locally in browser
- No server-side data transmission
- Read-only blockchain access for scanning
- Wallet security handled by MetaMask/Rabby

## Git Workflow

### Commit Standards
- Local commits only (never push unless explicitly requested)
- Clean, professional commit messages
- Remove Claude attribution from commits per user preference

### Version Management
- Click-based commit history viewer in application
- Deployment version tracking with GitHub integration
- Automatic timestamp-based versioning

This application represents a comprehensive client-side solution for XEN ecosystem interaction across multiple blockchain networks, prioritizing user privacy and data sovereignty through local-only operations.