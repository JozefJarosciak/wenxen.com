# Repository Guidelines

WenXen.com is a client-side multi-chain XEN tracker. These notes highlight conventions that keep contributions aligned with production.

## Project Structure & Module Organization
- `index.html` bootstraps the app and loads modules from `js/`. UI widgets live in `js/ui/`, analytics logic in `js/analytics/`, and chain-specific code in `js/config/` and `js/blockchain/`.
- Shared utilities remain under `js/utils/` and `js/core/` (formatting, orchestration), while static assets are in `css/`, `diagrams/`, and `ABI/`.
- Deployment scripts and infrastructure-as-code stay in `deployment/` (PowerShell, BAT, Terraform); avoid mixing runtime assets into that tree.

## Build, Test, and Development Commands
- `python3 -m http.server 8001` (repo root): serve the site locally; the Windows helper `python-server.bat` mirrors this and auto-opens a browser.
- `python -m http.server 8001 --directory deployment` helps when previewing generated cost dashboards.
- Manual bundling is unnecessary—the project ships as static HTML/CSS/JS and loads modules directly in the browser.

## Coding Style & Naming Conventions
- Use modern ES modules with `const`/`let`; prefer arrow functions for utilities and camelCase identifiers (`formatTinyPrice`, `chainManager`).
- Indent JavaScript with two spaces and keep inline documentation as concise `//` comments ahead of complex blocks.
- CSS selectors follow lowercase dash-separated naming (`#progressContainer`, `.flatpickr-today-btn`). Keep theme variants in `theme-light.css` and `theme-dark.css` synchronized.

## Testing Guidelines
- There is no automated harness today. Supply manual verification steps that cover wallet detection, multi-chain scans, and mint actions whenever behavior changes.
- When adding modules, include lightweight self-checks (guard clauses, early returns) and gate debug logging behind existing flags to avoid console noise.

## Commit & Pull Request Guidelines
- Follow the repository’s imperative commit style (`Fix calendar reset on auto-refresh`, `Implement filter button functionality`); keep subjects under ~72 characters.
- PRs should summarize user-facing impact, list manual test steps, attach relevant screenshots for UI updates, and link GitHub issues or TODO references when available.

## Security & Configuration Tips
- Never hard-code private RPC keys or wallet secrets; configuration belongs in `js/config/chainConfig.js`, which expects public RPC endpoints and contract metadata.
- Confirm infrastructure updates by running `terraform plan` inside `deployment/` and include the resulting diff or summary in the PR description.
