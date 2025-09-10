# WenXen.com - Multi-Chain XEN Tracker

## Application Overview

**WenXen.com** is a lightweight, open-source, client-side web application for tracking XEN cryptocurrency tokens across multiple blockchain networks (Ethereum and Base). The application is designed to run entirely in the browser without requiring centralized servers, ensuring user privacy and data sovereignty.

## Core Purpose

The application solves the problem of manually tracking XEN token mints, stakes, and related activities across different platforms and blockchains. Instead of maintaining spreadsheets or multiple tracking systems, users can:

- Add their wallet addresses and API keys
- Automatically discover all past and future XEN-related transactions
- Monitor mint maturity dates and estimated returns
- Execute on-chain actions directly from the interface

## Architecture & Technology Stack

### Frontend Technologies
- **Pure HTML/CSS/JavaScript** - No framework dependencies
- **Web3.js** - Blockchain interaction
- **Tabulator** - Data tables and grids
- **Chart.js & ECharts** - Data visualization
- **Flatpickr** - Date picker components
- **Luxon** - Date/time manipulation library
- **Marked** - Markdown parsing for documentation
- **IndexedDB** - Local browser storage
- **MetaMask/Rabby** - Wallet connectivity

### Backend/Infrastructure
- **Client-side only** - All processing happens in the browser
- **AWS Lambda** - Optional serverless deployment via Terraform
- **CloudFront CDN** - Global content delivery
- **Route 53** - DNS management
- **GitHub Pages** - Alternative hosting option

## Key Features

### 1. Multi-Chain Support
- **Ethereum Mainnet**: Original XEN deployment
- **Base Network**: Layer 2 scaling solution
- Chain-specific configurations for contracts, RPCs, and explorers
- Automatic chain detection and switching

### 2. XEN Ecosystem Tracking
- **Cointool Mints**: Batch minting via Cointool platform
- **XENFTs**: NFT-based XEN tokens with torrent functionality
- **XENFT Stakes**: Staking XENFTs for additional rewards
- **Direct XEN Stakes**: Native XEN token staking
- **Claims & Re-mints**: Managing matured positions

### 3. On-Chain Actions
- Connect wallet (MetaMask/Rabby)
- Mint new XEN tokens via Cointool or XENFT
- Claim matured mints
- Stake XEN tokens
- Batch operations for multiple mints

### 4. Data Management
- **Local Storage**: All data stored in browser's IndexedDB
- **API Integration**: Etherscan/BaseScan for transaction history
- **Real-time Updates**: Gas prices, XEN prices, network status
- **Export/Import**: Backup and restore functionality

## File Structure

### Root Directory
- `index.html` - Main application entry point
- `README.md` - User documentation
- `README-AWS.md` - AWS deployment guide

### CSS Styling (`/css/`)
- `base.css` - Core application styles
- `theme-*.css` - Light, dark, retro, matrix themes

### JavaScript Architecture (`/js/`)

#### Configuration (`/js/config/`)
- `chainConfig.js` - Multi-chain configurations (contracts, RPCs, explorers)
- `configuration.js` - Dynamic config system with chain delegation

#### Core Utilities (`/js/utils/`)
- `dateUtils.js` - Date manipulation and formatting
- `mathUtils.js` - Mathematical calculations for XEN economics
- `storageUtils.js` - LocalStorage management
- `chainStorageUtils.js` - Chain-specific data storage
- `stringUtils.js` - String manipulation utilities
- `domUtils.js` - DOM manipulation helpers
- `rateLimiter.js` - API rate limiting utilities
- `migrationUtils.js` - Database migration utilities
- `dangerZoneHandler.js` - Database management and cleanup
- `dangerZoneDropdown.js` - Database management UI components
- `chainMismatchHandler.js` - Network switching utilities
- `databaseInitializer.js` - Database initialization
- `databaseMigration*.js` - Various migration safety levels

#### Blockchain Utilities (`/js/blockchain/`)
- `web3Utils.js` - Web3 and blockchain interaction utilities

#### UI Components (`/js/ui/`)
- `themeManager.js` - Theme switching and persistence
- `modalManager.js` - Modal dialogs and privacy management
- `tabManager.js` - Tab navigation system
- `tooltipManager.js` - Tooltip system for mobile/desktop
- `toastManager.js` - Notification system
- `networkSelector*.js` - Network switching interface variants (Fixed, Simple, Working)

#### Data Layer (`/js/data/`)
- `indexedDbUtils.js` - Database operations and migrations
- `apiUtils.js` - External API communication (Etherscan, CoinGecko)

#### Blockchain Scanners (`/js/scanners/`)
- `cointool_scanner.js` - Scans Cointool contract events
- `xenft_scanner.js` - XENFT scanning via block enumeration
- `xenft_stake_scanner.js` - Scans XENFT staking events
- `xen_scanner.js` - Scans native XEN operations

#### Main Application
- `main_app.js` - Application initialization and coordination
- `mint_flows.js` - Minting and staking workflows
- `unified_view.js` - Data presentation and tables
- `xen-breakdown.js` - XEN economics calculations
- `analytics.js` - Privacy-compliant analytics and tracking

### Smart Contract ABIs (`/ABI/`)
- `xen-ABI.js` - XEN token contract interface
- `xenft-ABI.js` - XENFT contract interface
- `xenft-stake-ABI.js` - XENFT staking contract
- `cointool-ABI.js` - Cointool minting contract

### AWS Deployment (`/deployment/`)
- `main.tf` - Terraform infrastructure definition
- `lambda_function.py` - AWS Lambda handler for static hosting
- `*.ps1`, `*.bat` - Deployment automation scripts
- Cost monitoring and visualization tools

## Data Flow

### 1. Initialization
1. Load chain configurations
2. Initialize database connections
3. Check privacy acceptance and settings
4. Load user addresses and API keys
5. Connect to blockchain RPCs

### 2. Scanning Process

#### XENFT Scanning (Block Enumeration Method)
1. User clicks "Scan XENFTs" button
2. Application enumerates blockchain blocks for contract events
3. Filters transactions by XENFT contract interactions
4. Parses transaction logs and events for token creation
5. Queries blockchain for token details (metadata, VMU count, etc.)
6. Stores discovered XENFTs in IndexedDB
7. Updates UI with progress and results

### 3. Data Presentation
1. Retrieve data from IndexedDB
2. Calculate maturity dates and estimated returns
3. Render interactive tables with Tabulator
4. Display charts for VMU (Virtual Mining Unit) analysis
5. Enable filtering and export options

### 4. On-Chain Actions
1. User selects action (mint, claim, stake)
2. Application prepares transaction parameters
3. MetaMask/Rabby prompts for transaction approval
4. Transaction submitted to blockchain
5. Application monitors for confirmation

## Security & Privacy

### Client-Side Security
- **No server-side data storage** - All data remains in user's browser
- **Local API key storage** - API keys never transmitted to WenXen servers
- **Read-only blockchain access** - Scanning operations don't modify blockchain state
- **Wallet security** - Relies on MetaMask/Rabby for key management

### Data Privacy
- **GDPR Compliant** - No personal data collection
- **Analytics Optional** - Google Analytics only tracks usage patterns
- **Open Source** - Complete transparency of code and operations
- **Self-Hostable** - Users can run their own instance

## Deployment Options

### 1. GitHub Pages (Free)
- Static hosting from GitHub repository
- Automatic SSL certificates
- Global CDN via GitHub's infrastructure

### 2. AWS Lambda (Serverless)
- Pay-per-request pricing model (~$1-3/month for 10k visits)
- Global CloudFront CDN distribution
- Custom domain support with Route 53
- Terraform-managed infrastructure

### 3. Local Development
- Run directly from file system
- No deployment required
- Full functionality available offline (except API calls)

## Business Model & Licensing

### Open Source License
- **AGPL-3.0** - Strong copyleft license
- **Commercial Use Allowed** - With source code disclosure requirements
- **Derivative Works** - Must remain AGPL-3.0 licensed
- **Self-Hosting Encouraged** - Users can run their own instances

### Monetization
- **No direct monetization** - Application is provided free
- **Donation Links** - Optional user contributions
- **Educational Purpose** - Demonstrates XEN ecosystem tools

## Future Roadmap

### Planned Features
- Additional blockchain support (Polygon, Avalanche, BSC)
- Advanced analytics and portfolio management
- Bulk operation optimizations
- Mobile-responsive improvements
- Integration with additional XEN protocols

### Technical Debt
- Database migration system consolidation
- Code modularization improvements
- Test coverage expansion
- Performance optimization for XENFT scanning (block enumeration is slow)
- Performance optimization for XEN stake scanning (block enumeration is slow)

## Development Workflow

### Local Development
1. Clone repository
2. Open `index.html` in browser
3. Configure settings (addresses, API keys)
4. Test functionality with live or test networks

### AWS Deployment
1. Install AWS CLI and Terraform
2. Configure AWS credentials
3. Run deployment scripts in `/deployment/`
4. Verify CloudFront distribution and custom domain

### Contributing
1. Fork repository on GitHub
2. Create feature branch
3. Implement changes with appropriate testing
4. Submit pull request with detailed description
5. Maintain AGPL-3.0 license compatibility

## Key Metrics & Performance

### Scan Performance

#### Block-Based Scanning Performance  
- **Ethereum**: ~50,000 transactions per chunk
- **Base**: Optimized for lower transaction volume
- **Rate Limiting**: 200ms delay between API calls to avoid rate limits
- **Caching**: Block timestamps cached locally for efficiency
- **Progress Reporting**: Real-time updates during block enumeration
- **Error Handling**: Automatic RPC failover and retry logic

### User Experience
- **First Load**: <2 seconds on modern browsers
- **Subsequent Loads**: <500ms with browser caching
- **Data Export**: CSV and JSON formats supported
- **Mobile Support**: Responsive design with touch optimizations

This application represents a comprehensive solution for XEN ecosystem participation, combining user sovereignty with powerful tracking and interaction capabilities across multiple blockchain networks.

## Recent Changes & Architecture Updates

### Scanner Implementation (Updated: September 2024)
- **Reverted to Block-Based Scanning**: All scanners now use proven block enumeration methods for maximum reliability
- **Removed Fast Scanning**: Transaction history-based scanning was removed due to reliability concerns
- **Simplified Architecture**: Focus on stable, thoroughly tested legacy scanning implementations
- **Enhanced Database Migrations**: Multiple safety levels for database operations (Ultra Safe, Super Safe, Safe, Standard)

### File Structure Changes
- **Removed**: `fast_token_scanner.js` - Fast scanning implementation removed
- **Enhanced**: Multiple utility files added for better modularity
- **Added**: Network selector variants for improved chain switching
- **Improved**: Database migration system with multiple safety levels