# XEN Tracker for Ethereum (WenXEN.com)

## Overview

A client-side, open-source frontend application for tracking and managing XEN assets on the Ethereum Mainnet. The tracker automates asset discovery by scanning the blockchain using a public Ethereum RPC endpoint and a free Etherscan API key, eliminating the need for manual data entry.

## Architecture & Principles

-   **Client-Side Operation**: The application operates entirely within the user's browser, building and maintaining its own local data store. This eliminates reliance on centralized third-party servers, preventing downtime and enhancing user privacy.
-   **Open Source & Self-Hostable**: As a pure HTML/CSS/JS application, the full source code is hosted on [GitHub](https://github.com/JozefJarosciak/wenxen.com). It can be easily self-hosted or run from a local file for complete transparency and security.
-   **Wallet Connectivity**: Secure wallet connections are managed via MetaMask or Rabby, with operations restricted to the Ethereum Mainnet.

## Core Functionality

### Tracking
The application provides detailed tracking for:
-   XEN Cointool mints
-   XENFTs
-   XENFT Stakes
-   XEN stakes on Ethereum Mainnet

### On-Chain Actions
Users can perform claims directly from the interface:
-   Claim/Create XENFTs
-   Claim/Create Cointool mints  
-   Claim/Create XENFT Stakes  
-   Execute batch-claims for multiple Cointool mints

**Future development will include support for additional XEN-related smart contracts.*

## License (AGPL‑3.0)

- GNU Affero General Public License v3.
- Copyleft: derivatives must remain AGPL‑3.0.
- Network use = distribution: if you host a modified version, you must provide its complete corresponding source to users.
- Keep license notices; add no extra restrictions.
- Full text: https://www.gnu.org/licenses/agpl-3.0.html

## Attribution

- Built with Tabulator, Chart.js, ECharts, Flatpickr, and Web3.js. Wallet provider via MetaMask/Rabby.
