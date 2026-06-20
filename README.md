# Multi-Chain XEN Tracker ([WenXEN.com](https://wenxen.com))

## What is WenXen?

Welcome to **WenXen.com** — a lightweight, open-source tracker for **[XEN](https://xen.pub)** tokens across multiple blockchains.

Tired of logging every XEN mint by hand? 🥱 Just add your wallet address and a free API key, and WenXen automatically discovers all your mints (past & future) on supported chains. No more spreadsheets, no more forgotten entries.

Everything runs **100% in your browser**, with no hosted portfolio database, meaning your data always stays with you. On [wenxen.com](https://wenxen.com), Google Analytics and Statcounter are enabled by default for usage analytics and can be turned off in Settings. Local and self-hosted copies default to tracking off.

---

## Core Features

- 🔍 **Automatic Tracking**
    - XEN Cointool mints
    - XENFTs
    - XENFT Stakes
    - XEN stakes across supported chains
    - Historical and future mints discovered from wallet addresses

- ⚡ **On-Chain Actions** (directly in the interface)
    - Claim or create XENFTs
    - Claim or create Cointool mints
    - Claim or create XENFT Stakes
    - Batch-claim multiple Cointool mints at once
    - Local submitted-state tracking for pending or wallet-queued claims

- 📅 **Dashboard & Calendar**
    - Month/day filtering for maturing, claimable, and historical mints
    - Breakdown tables by mint type and address
    - Progress bars for mint maturity and stake timelines
    - CSV/JSON export for filtered table views

- 🚀 **Large Wallet Performance**
    - Browser-local IndexedDB storage with summary indexes
    - Background processing for large mint histories
    - Fast reloads for wallets with hundreds of thousands of mints

- 🛠️ **Settings & Recovery**
    - Per-chain addresses, API keys, custom RPCs, and RPC latency checks
    - Compressed backup export/import for large local databases
    - Chain-aware Cointool remint defaults and gas/network utilities

*(Future updates will extend support to additional XEN-related contracts.)*

---

## Screenshot

<img width="2000" height="1229" alt="image" src="https://github.com/user-attachments/assets/5d5b90eb-7e55-4e65-9454-39ee4c68182e" />


---

## Architecture & Principles

- **Client-Side Operation**  
  All portfolio logic runs in the browser, storing data locally. Hosted usage analytics can be disabled in Settings, and local/self-hosted copies run with tracking off by default.

- **Open Source & Self-Hostable**  
  Built with pure HTML/CSS/JS, hosted on [GitHub](https://github.com/JozefJarosciak/wenxen.com). You can easily self-host or run it from a local file. You can also contribute and enhance the open source code.

- **Wallet Connectivity**  
  Securely connect via MetaMask or Rabby to supported blockchain networks.

---

## License (AGPL-3.0)

- GNU Affero General Public License v3.
- Copyleft: derivatives must remain AGPL-3.0.
- Hosting a modified version counts as distribution → you must provide complete corresponding source code.
- Keep license notices, add no extra restrictions.
- [Full text](https://www.gnu.org/licenses/agpl-3.0.html)

---

## Built With

Tabulator · Chart.js · ECharts · Flatpickr · Web3.js
Wallet connectivity via MetaMask & Rabby
