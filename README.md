XEN Tracker for Ethereum

Overview

- Track and act on XEN mints, XENFTs, and XEN stakes on Ethereum Mainnet in a fast, privacy‑aware web UI.

- Unlike most XEN trackers that require you to manually enter each mint, ours needs only your Ethereum address. Just enter it once, hit “Scan,” and you’re set—no need to remember what to add later.
- And unlike trackers that rely on third-party servers and databases (which can go down when those services have outages), this tracker from Xen.pub runs entirely in your browser. It builds and maintains its own local data store, using only public Ethereum RPC endpoints and, optionally, a free Etherscan API key to fully scan XEN mints and related contracts.
 
- Pure front‑end (HTML/CSS/JS). Libraries: Web3.js, Tabulator, Chart.js/ECharts, Flatpickr.
- Wallet connects via MetaMask/Rabby; app only stays connected on Ethereum Mainnet.

- In addition to tracking, the app allows claiming directly from the UI: XENFT and Cointool mints, single‑wallet XENFT stakes, and batch‑claiming multiple Cointool mints.
- The entire solution is <a href="https://github.com/JozefJarosciak/xentracker" target="_blank"><u>open source</u></a>; you can self‑host it (or run locally).

Core Features

- Dashboard: Calendar badges + quick filter, filterable table (Tabulator), chart mirrors visible rows, gas watcher (5–60s) with countdown.
- Mint/Stake: Cointool or XENFT (Regular/APEX) minting; XEN staking with balance helpers and whole‑token rounding. Prompts to connect; requires Mainnet.
- Settings: Address list (mask toggle), Etherscan key (hint + default visible), RPC import/ranking with progress, backup/restore including privacy masks.
- Wallet: Connect/Disconnect toggle, wallet text mask, strict Mainnet gate (off‑Mainnet triggers prompt and disconnect).

Files

- index.html: Tabs and UI.
- css/style.css: Layout and masking styles.
- js/app.js: Dashboard, scanning, chart/calendar/gas, wallet, settings, backup.
- js/app-mint.js: Mint/Stake flows and staking helpers.

Tabs

- Dashboard: Calendar filter, table, and chart; gas watcher with countdown.
- Mint/Stake: Select action. Mint via Cointool/XENFT (APEX supports burn + auto‑approve). Stake with balance/percent helpers and whole‑token rounding.
- Settings: Addresses, API key (with hint and masking), RPC import/ranking with progress, and backup/restore.

Behavior

- Mainnet‑only: On connect or network change, the app enforces Ethereum Mainnet (otherwise prompts and disconnects).
- Privacy: Address/API key/wallet text masking persists locally and is included in backups.
- Chart: Plots only visible/filtered table rows; blank when the table is empty.

Charts and Tooltips

- The chart shows only the currently visible/filter‑matched table data.

Getting Started

- Serve locally and open in a modern browser. Note: Opening the file directly can work, but a local or cloud hosted http server is recommended.
- Settings: add addresses, paste Etherscan key (link provided), import/rank RPCs, and optionally adjust gas refresh and masking.
- Dashboard: choose a Scan mode, click Scan, filter via headers or calendar; chart mirrors the table.
- Mint/Stake: connect wallet (Mainnet required), configure options, and click Start Minting/Start Staking.
- Backup: export your settings (including masking) from the Settings tab.

Requirements

- Modern browser with ES2020 support.
- Injected wallet (MetaMask, Rabby) for mint/stake flows.
- Optional: Etherscan API key for richer scan functionality and higher reliability.

Privacy

- Masking: Ethereum addresses, API keys, and the wallet display text can be blurred. Mask state persists in local Storage and is included in backups.
- Data: The app stores settings in your browser only; backups/export are user‑initiated JSON files. The app does not store any private keys in the browser.

Troubleshooting

- RPC import stalls
  - The import button stays disabled while running. Stop the process or refresh the page, then try again with a different RPC. Wait for completion or check the progress panel for failures.
- Chart not updating
  - The chart mirrors the table; ensure filters are set as expected or clear them to repopulate.
- “Please switch your wallet to Ethereum Mainnet…”
  - The app enforces mainnet. Switch the network in your wallet and reconnect.

License (AGPL‑3.0)

- GNU Affero General Public License v3.
- Copyleft: derivatives must remain AGPL‑3.0.
- Network use = distribution: if you host a modified version, you must provide its complete corresponding source to users.
- Keep license notices; add no extra restrictions.
- Full text: https://www.gnu.org/licenses/agpl-3.0.html

Attribution

- Built with Tabulator, Chart.js, ECharts, Flatpickr, and Web3.js. Wallet provider via MetaMask/Rabby.
