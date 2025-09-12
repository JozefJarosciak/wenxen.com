/* ===== OPTION 2: Professional Table Layout Functions ===== */

window.summaryOption2 = {
  
  // Initialize Option 2 layout
  init() {
    const container = document.getElementById('summaryContainer');
    if (container) {
      container.classList.add('option2');
      this.createTableStructure();
      this.populateTableFromExistingSummaries();
      // Ensure original summaries stay hidden
      this.hideOriginalSummaries();
      // Add mobile labels
      this.addMobileLabels();
      // Update table structure based on claimable data
      this.updateTableStructure();
    }
  },

  // Add mobile data labels to all table cells
  addMobileLabels() {
    const container = document.getElementById('summaryContainer');
    if (!container || !container.classList.contains('option2')) return;
    
    const rows = container.querySelectorAll('.summary-table tbody tr:not(.detail-row)');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const labels = ['Type', 'Total', 'VMUs', 'Maturing', 'Claimable', 'Est. XEN', 'Progress'];
      cells.forEach((cell, index) => {
        if (labels[index] && !cell.hasAttribute('data-label')) {
          cell.setAttribute('data-label', labels[index]);
        }
      });
    });
  },

  // Hide original summary divs
  hideOriginalSummaries() {
    const itemCount = document.getElementById('itemCount');
    const xenftItemCount = document.getElementById('xenftItemCount');
    const stakeItemCount = document.getElementById('stakeItemCount');
    const stakeXenftItemCount = document.getElementById('stakeXenftItemCount');
    const perAddressSummary = document.getElementById('perAddressSummary');

    // Hide per-address summary blocks that are created dynamically
    const xenftPerAddressSummary = document.getElementById('xenftPerAddressSummary');
    const stakePerAddressSummary = document.getElementById('stakePerAddressSummary');
    const stakeRegularPerAddressSummary = document.getElementById('stakeRegularPerAddressSummary');

    if (itemCount) itemCount.style.display = 'none';
    if (xenftItemCount) xenftItemCount.style.display = 'none';
    if (stakeItemCount) stakeItemCount.style.display = 'none';
    if (stakeXenftItemCount) stakeXenftItemCount.style.display = 'none';
    if (perAddressSummary) perAddressSummary.style.display = 'none';
    if (xenftPerAddressSummary) xenftPerAddressSummary.style.display = 'none';
    if (stakePerAddressSummary) stakePerAddressSummary.style.display = 'none';
    if (stakeRegularPerAddressSummary) stakeRegularPerAddressSummary.style.display = 'none';
  },

  // Create the table structure
  createTableStructure() {
    const container = document.getElementById('summaryContainer');
    if (!container) return;

    // Hide original summary divs instead of removing them
    this.hideOriginalSummaries();

    // Create table if it doesn't exist
    if (!document.getElementById('summaryTableContainer')) {
      const tableContainer = document.createElement('div');
      tableContainer.id = 'summaryTableContainer';
      tableContainer.innerHTML = `
        <table class="summary-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Total Count</th>
              <th>VMUs / Details</th>
              <th>Maturing</th>
              <th>Claimable</th>
              <th>Est. XEN</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody id="summaryTableBody">
            <!-- Rows will be populated dynamically -->
          </tbody>
        </table>
      `;
      container.appendChild(tableContainer);
    }
  },

  // Check if any row has claimable items
  hasAnyClaimable() {
    // Check Cointool
    const cointoolDiv = document.getElementById('itemCount');
    if (cointoolDiv && cointoolDiv.innerHTML.trim()) {
      const metrics = this.parseCointoolText(cointoolDiv.innerHTML);
      if (metrics && this.parseNumber(metrics.claimable) > 0) return true;
    }

    // Check XENFT
    const xenftDiv = document.getElementById('xenftItemCount');
    if (xenftDiv && xenftDiv.innerHTML.trim()) {
      const metrics = this.parseXenftText(xenftDiv.innerHTML);
      if (metrics && this.parseNumber(metrics.claimable) > 0) return true;
    }

    // Check Stakes
    const stakeDiv = document.getElementById('stakeItemCount');
    if (stakeDiv && stakeDiv.innerHTML.trim()) {
      const metrics = this.parseStakeText(stakeDiv.innerHTML);
      if (metrics && this.parseNumber(metrics.claimable) > 0) return true;
    }

    // Check XENFT Stakes
    const xenftStakeDiv = document.getElementById('stakeXenftItemCount');
    if (xenftStakeDiv && xenftStakeDiv.innerHTML.trim()) {
      const metrics = this.parseXenftStakeText(xenftStakeDiv.innerHTML);
      if (metrics && this.parseNumber(metrics.claimable) > 0) return true;
    }

    return false;
  },

  // Update table structure based on claimable visibility
  updateTableStructure() {
    const hasClaimable = this.hasAnyClaimable();
    const table = document.querySelector('.summary-table');
    if (!table) return;

    // Update header
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
      const claimableHeader = headerRow.children[4]; // 5th column (0-indexed)
      if (claimableHeader) {
        claimableHeader.style.display = hasClaimable ? '' : 'none';
      }
    }

    // Update all data rows
    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
      const claimableCell = row.children[4]; // 5th column (0-indexed)
      if (claimableCell) {
        claimableCell.style.display = hasClaimable ? '' : 'none';
      }
    });
  },

  // Populate table from existing summary divs
  populateTableFromExistingSummaries() {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Add rows for each type
    this.addCointoolRow(tbody);
    this.addXenftRow(tbody);
    this.addStakeRow(tbody);
    this.addXenftStakeRow(tbody);

    // Update table structure based on claimable data
    this.updateTableStructure();
  },

  // Add Cointool row
  addCointoolRow(tbody) {
    // The Cointool summary is stored in 'itemCount' div, not 'cointoolItemCount'
    const cointoolDiv = document.getElementById('itemCount');
    if (!cointoolDiv || !cointoolDiv.innerHTML.trim()) {
      // If no data yet, add a placeholder row
      const row = document.createElement('tr');
      row.className = 'cointool';
      row.innerHTML = `
        <td data-label="Type">
          <div class="type-cell">
            <span>Cointool</span>
          </div>
        </td>
        <td class="metric-cell total" data-label="Total">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell total" data-label="VMUs">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell maturing" data-label="Maturing">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell claimable" data-label="Claimable">
          <div class="metric-primary">0</div>
        </td>
        <td class="xen-reward" data-label="Est. XEN">
          <div class="xen-amount">0</div>
          <div class="xen-usd"></div>
        </td>
        <td data-label="Progress">
          <div class="progress-indicator">
            <div class="progress-fill maturing" style="width: 0%"></div>
          </div>
          <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
            0% maturing
          </div>
        </td>
      `;
      tbody.appendChild(row);
      return;
    }

    const metrics = this.parseCointoolText(cointoolDiv.innerHTML);
    if (!metrics) return;

    const row = document.createElement('tr');
    row.className = 'cointool expandable';
    
    // Calculate progress percentages
    const totalVMUs = this.parseNumber(metrics.totalVMUs);
    const maturingVMUs = this.parseNumber(metrics.maturing);
    const claimableVMUs = this.parseNumber(metrics.claimable);
    const maturingPercent = totalVMUs > 0 ? Math.round((maturingVMUs / totalVMUs) * 100) : 0;
    const claimablePercent = totalVMUs > 0 ? Math.round((claimableVMUs / totalVMUs) * 100) : 0;

    // Calculate XEN rewards
    const xenRewards = this.calculateXenRewards('Cointool');

    row.innerHTML = `
      <td data-label="Type">
        <div class="type-cell">
          <span>Cointool</span>
        </div>
      </td>
      <td class="metric-cell total" data-label="Total">
        <div class="metric-primary">${metrics.totalMints}</div>
      </td>
      <td class="metric-cell total" data-label="VMUs">
        <div class="metric-primary">${metrics.totalVMUs}</div>
        <div style="font-size: 10px; color: #6c757d; margin-top: 2px;">
          R: ${metrics.remints}
        </div>
      </td>
      <td class="metric-cell maturing" data-label="Maturing">
        <div class="metric-primary">${metrics.maturing}</div>
      </td>
      <td class="metric-cell claimable" data-label="Claimable">
        <div class="metric-primary">${metrics.claimable}</div>
      </td>
      <td class="xen-reward" data-label="Est. XEN">
        <div class="xen-amount">${this.formatXenAmount(xenRewards.xen)}</div>
        <div class="xen-usd">${this.formatUsdAmount(xenRewards.usd)}</div>
      </td>
      <td data-label="Progress">
        <div class="progress-indicator">
          <div class="progress-fill maturing" style="width: ${Math.min(maturingPercent, 100)}%"></div>
        </div>
        <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
          ${maturingPercent}% maturing
        </div>
      </td>
    `;

    // Add click handler
    row.addEventListener('click', (e) => this.handleRowClick(e, 'Cointool'));

    tbody.appendChild(row);
  },

  // Add XENFT row
  addXenftRow(tbody) {
    const xenftDiv = document.getElementById('xenftItemCount');
    if (!xenftDiv || !xenftDiv.innerHTML.trim()) {
      // Add placeholder row if no data
      const row = document.createElement('tr');
      row.className = 'xenft';
      row.innerHTML = `
        <td>
          <div class="type-cell">
            <span>XENFTs</span>
          </div>
        </td>
        <td class="metric-cell total">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell total">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell maturing">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell claimable">
          <div class="metric-primary">0</div>
        </td>
        <td class="xen-reward">
          <div class="xen-amount">0</div>
          <div class="xen-usd"></div>
        </td>
        <td>
          <div class="progress-indicator">
            <div class="progress-fill maturing" style="width: 0%"></div>
          </div>
          <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
            0% maturing
          </div>
        </td>
      `;
      tbody.appendChild(row);
      return;
    }

    const metrics = this.parseXenftText(xenftDiv.innerHTML);
    if (!metrics) return;

    const row = document.createElement('tr');
    row.className = 'xenft expandable';
    
    // Calculate progress
    const totalVMUs = this.parseNumber(metrics.totalVMUs);
    const maturingVMUs = this.parseNumber(metrics.maturing);
    const maturingPercent = totalVMUs > 0 ? Math.round((maturingVMUs / totalVMUs) * 100) : 0;

    // Calculate XEN rewards
    const xenRewards = this.calculateXenRewards('XENFT');

    row.innerHTML = `
      <td>
        <div class="type-cell">
          <span>XENFTs</span>
        </div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">${metrics.totalCount}</div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">${metrics.totalVMUs}</div>
        <div class="vmu-details">
          <span class="vmu-badge apex">A:${metrics.apex}</span>
          <span class="vmu-badge collector">C:${metrics.collector}</span>
          <span class="vmu-badge limited">L:${metrics.limited}</span>
        </div>
      </td>
      <td class="metric-cell maturing">
        <div class="metric-primary">${metrics.maturing}</div>
      </td>
      <td class="metric-cell claimable">
        <div class="metric-primary">${metrics.claimable}</div>
      </td>
      <td class="xen-reward">
        <div class="xen-amount">${this.formatXenAmount(xenRewards.xen)}</div>
        <div class="xen-usd">${this.formatUsdAmount(xenRewards.usd)}</div>
      </td>
      <td>
        <div class="progress-indicator">
          <div class="progress-fill maturing" style="width: ${Math.min(maturingPercent, 100)}%"></div>
        </div>
        <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
          ${maturingPercent}% maturing
        </div>
      </td>
    `;

    // Add click handler
    row.addEventListener('click', (e) => this.handleRowClick(e, 'XENFT'));

    tbody.appendChild(row);
  },

  // Add Stakes row
  addStakeRow(tbody) {
    const stakeDiv = document.getElementById('stakeItemCount');
    if (!stakeDiv || !stakeDiv.innerHTML.trim()) {
      // Add placeholder row if no data
      const row = document.createElement('tr');
      row.className = 'stake';
      row.innerHTML = `
        <td>
          <div class="type-cell">
            <span>Stakes</span>
          </div>
        </td>
        <td class="metric-cell total">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell total">
          <div class="metric-primary">—</div>
        </td>
        <td class="metric-cell maturing">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell claimable">
          <div class="metric-primary">0</div>
        </td>
        <td class="xen-reward">
          <div class="xen-amount">0</div>
          <div class="xen-usd"></div>
        </td>
        <td>
          <div class="progress-indicator">
            <div class="progress-fill claimable" style="width: 0%"></div>
          </div>
          <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
            0% ready
          </div>
        </td>
      `;
      tbody.appendChild(row);
      return;
    }

    const metrics = this.parseStakeText(stakeDiv.innerHTML);
    if (!metrics) return;

    const row = document.createElement('tr');
    row.className = 'stake expandable';
    
    // Calculate progress
    const totalCount = this.parseNumber(metrics.totalCount);
    const claimableCount = this.parseNumber(metrics.claimable);
    const claimablePercent = totalCount > 0 ? Math.round((claimableCount / totalCount) * 100) : 0;

    // Calculate XEN rewards
    const xenRewards = this.calculateXenRewards('Stake');

    row.innerHTML = `
      <td>
        <div class="type-cell">
          <span>Stakes</span>
        </div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">${metrics.totalCount}</div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">—</div>
      </td>
      <td class="metric-cell maturing">
        <div class="metric-primary">${metrics.maturing}</div>
      </td>
      <td class="metric-cell claimable">
        <div class="metric-primary">${metrics.claimable}</div>
      </td>
      <td class="xen-reward">
        <div class="xen-amount">${this.formatXenAmount(xenRewards.xen)}</div>
        <div class="xen-usd">${this.formatUsdAmount(xenRewards.usd)}</div>
      </td>
      <td>
        <div class="progress-indicator">
          <div class="progress-fill claimable" style="width: ${Math.min(claimablePercent, 100)}%"></div>
        </div>
        <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
          ${claimablePercent}% ready
        </div>
      </td>
    `;

    // Add click handler
    row.addEventListener('click', (e) => this.handleRowClick(e, 'Stake'));

    tbody.appendChild(row);
  },

  // Add XENFT Stakes row
  addXenftStakeRow(tbody) {
    const xenftStakeDiv = document.getElementById('stakeXenftItemCount');
    if (!xenftStakeDiv || !xenftStakeDiv.innerHTML.trim()) {
      // Add placeholder row if no data
      const row = document.createElement('tr');
      row.className = 'xenft-stake';
      row.innerHTML = `
        <td>
          <div class="type-cell">
            <span>XENFT Stakes</span>
          </div>
        </td>
        <td class="metric-cell total">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell total">
          <div class="metric-primary">—</div>
        </td>
        <td class="metric-cell maturing">
          <div class="metric-primary">0</div>
        </td>
        <td class="metric-cell claimable">
          <div class="metric-primary">0</div>
        </td>
        <td class="xen-reward">
          <div class="xen-amount">0</div>
          <div class="xen-usd"></div>
        </td>
        <td>
          <div class="progress-indicator">
            <div class="progress-fill claimable" style="width: 0%"></div>
          </div>
          <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
            0% ready
          </div>
        </td>
      `;
      tbody.appendChild(row);
      return;
    }

    const metrics = this.parseXenftStakeText(xenftStakeDiv.innerHTML);
    if (!metrics) return;

    const row = document.createElement('tr');
    row.className = 'xenft-stake expandable';
    
    // Calculate progress
    const totalCount = this.parseNumber(metrics.totalCount);
    const claimableCount = this.parseNumber(metrics.claimable);
    const claimablePercent = totalCount > 0 ? Math.round((claimableCount / totalCount) * 100) : 0;

    // Calculate XEN rewards
    const xenRewards = this.calculateXenRewards('Stake XENFT');

    row.innerHTML = `
      <td>
        <div class="type-cell">
          <span>XENFT Stakes</span>
        </div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">${metrics.totalCount}</div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">—</div>
      </td>
      <td class="metric-cell maturing">
        <div class="metric-primary">${metrics.maturing}</div>
      </td>
      <td class="metric-cell claimable">
        <div class="metric-primary">${metrics.claimable}</div>
      </td>
      <td class="xen-reward">
        <div class="xen-amount">${this.formatXenAmount(xenRewards.xen)}</div>
        <div class="xen-usd">${this.formatUsdAmount(xenRewards.usd)}</div>
      </td>
      <td>
        <div class="progress-indicator">
          <div class="progress-fill claimable" style="width: ${Math.min(claimablePercent, 100)}%"></div>
        </div>
        <div style="text-align: center; font-size: 9px; color: #6c757d; margin-top: 2px;">
          ${claimablePercent}% ready
        </div>
      </td>
    `;

    // Add click handler
    row.addEventListener('click', (e) => this.handleRowClick(e, 'Stake XENFT'));

    tbody.appendChild(row);
  },

  // Parse number from formatted string
  parseNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[,\s]/g, ''), 10) || 0;
  },

  // Calculate XEN rewards for a data type
  calculateXenRewards(dataType) {
    if (!window._allUnifiedRows) return { xen: 0, usd: 0 };

    const rows = window._allUnifiedRows.filter(r => r.SourceType === dataType);
    let totalXen = 0;

    for (const row of rows) {
      if (typeof window.estimateXENForRow === 'function') {
        const xenEstimate = window.estimateXENForRow(row);
        totalXen += xenEstimate || 0;
      }
    }

    // Calculate USD value
    let usdValue = 0;
    if (typeof window.xenUsdPrice === 'number' && window.xenUsdPrice > 0) {
      usdValue = totalXen * window.xenUsdPrice;
    }

    return { xen: totalXen, usd: usdValue };
  },

  // Format XEN amount for display with thousand separators
  formatXenAmount(amount) {
    if (amount === 0) return '0';
    // Always format as billions with 3 decimal places and thousand separators
    const billions = (amount / 1000000000).toFixed(3);
    // Add thousand separators to the number part (before the decimal)
    const parts = billions.split('.');
    parts[0] = parseInt(parts[0]).toLocaleString();
    return parts.join('.') + 'B';
  },

  // Format USD amount for display
  formatUsdAmount(amount) {
    if (amount === 0) return '';
    if (amount < 0.01) return '<$0.01';
    if (amount < 1000) return '$' + amount.toFixed(2);
    if (amount < 1000000) return '$' + (amount / 1000).toFixed(1) + 'K';
    return '$' + (amount / 1000000).toFixed(1) + 'M';
  },

  // Handle row click for expansion
  handleRowClick(event, rowType) {
    const row = event.currentTarget;
    const isExpanded = row.classList.contains('expanded');
    
    if (isExpanded) {
      // Collapse: remove expanded class and detail rows
      row.classList.remove('expanded');
      this.removeDetailRows(row);
    } else {
      // Expand: add expanded class and detail rows
      row.classList.add('expanded');
      this.addDetailRows(row, rowType);
    }
  },

  // Add detail rows showing per-address breakdown
  addDetailRows(parentRow, dataType) {
    if (!window._allUnifiedRows) return;

    const rows = window._allUnifiedRows.filter(r => r.SourceType === dataType);
    const addressSummary = {};

    // Group by address
    for (const row of rows) {
      const address = row.Owner || row.Address || 'Unknown';
      if (!addressSummary[address]) {
        addressSummary[address] = {
          count: 0,
          vmus: 0,
          maturing: 0,
          claimable: 0,
          xenRewards: 0
        };
      }

      addressSummary[address].count++;
      addressSummary[address].vmus += Number(row.VMUs) || 0;

      // Calculate status counts
      const status = this.computeLiveStatus(row);
      if (status === 'Maturing') {
        if (dataType === 'Cointool' || dataType === 'XENFT') {
          addressSummary[address].maturing += Number(row.VMUs) || 0;
        } else {
          addressSummary[address].maturing++;
        }
      } else if (status === 'Claimable') {
        if (dataType === 'Cointool') {
          addressSummary[address].claimable += Number(row.VMUs) || 0;
        } else {
          addressSummary[address].claimable++;
        }
      }

      // Calculate XEN rewards
      if (typeof window.estimateXENForRow === 'function') {
        addressSummary[address].xenRewards += window.estimateXENForRow(row) || 0;
      }
    }

    // Create detail rows
    const sortedAddresses = Object.keys(addressSummary).sort();
    for (let i = 0; i < sortedAddresses.length; i++) {
      const address = sortedAddresses[i];
      const summary = addressSummary[address];
      
      const detailRow = document.createElement('tr');
      detailRow.className = 'detail-row';
      detailRow.innerHTML = this.createDetailRowHTML(address, summary, dataType);
      
      // Insert after parent row
      parentRow.parentNode.insertBefore(detailRow, parentRow.nextSibling);
    }
  },

  // Create HTML for detail row
  createDetailRowHTML(address, summary, dataType) {
    const shortAddress = address === 'Unknown' ? 'Unknown' : 
      address.substring(0, 6) + '...' + address.substring(address.length - 4);
    
    const xenRewards = this.calculateXenRewards(dataType);
    const usdValue = this.formatUsdAmount(summary.xenRewards * (window.xenUsdPrice || 0));
    const hasClaimable = this.hasAnyClaimable();

    let maturingLabel, claimableLabel;
    if (dataType === 'Cointool' || dataType === 'XENFT') {
      maturingLabel = 'VMUs';
      claimableLabel = dataType === 'Cointool' ? 'VMUs' : 'Count';
    } else {
      maturingLabel = dataType === 'Stake XENFT' ? 'XENFTs' : 'Stakes';
      claimableLabel = maturingLabel;
    }

    const claimableColumnStyle = hasClaimable ? '' : 'style="display: none;"';

    return `
      <td>
        <div class="type-cell">
          <span title="${address}">${shortAddress}</span>
        </div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">${summary.count.toLocaleString()}</div>
      </td>
      <td class="metric-cell total">
        <div class="metric-primary">${summary.vmus > 0 ? summary.vmus.toLocaleString() : '—'}</div>
      </td>
      <td class="metric-cell maturing">
        <div class="metric-primary">${summary.maturing.toLocaleString()}</div>
      </td>
      <td class="metric-cell claimable" ${claimableColumnStyle}>
        <div class="metric-primary">${summary.claimable.toLocaleString()}</div>
      </td>
      <td class="xen-reward">
        <div class="xen-amount">${this.formatXenAmount(summary.xenRewards)}</div>
        <div class="xen-usd">${usdValue}</div>
      </td>
      <td>
        <div style="text-align: center; font-size: 11px; color: #6c757d;">
          
        </div>
      </td>
    `;
  },

  // Remove detail rows
  removeDetailRows(parentRow) {
    let nextRow = parentRow.nextElementSibling;
    while (nextRow && nextRow.classList.contains('detail-row')) {
      const toRemove = nextRow;
      nextRow = nextRow.nextElementSibling;
      toRemove.remove();
    }
  },

  // Compute live status (simplified version)
  computeLiveStatus(row) {
    if (typeof window.computeLiveStatus === 'function') {
      return window.computeLiveStatus(row);
    }
    // Fallback logic
    return row.Status || 'Unknown';
  },

  // Parse Cointool text to extract metrics (reuse from Option 1)
  parseCointoolText(text) {
    const totalMintsMatch = text.match(/Cointool Mints:<\/strong>\s*([\d,]+)/);
    const totalVMUsMatch = text.match(/Total VMUs:<\/strong>\s*([\d,]+)/);
    const remintsMatch = text.match(/Remints:<\/strong>\s*([\d,]+)/);
    const maturingMatch = text.match(/Maturing:<\/strong>\s*([\d,]+)/);
    const claimableMatch = text.match(/Claimable:<\/strong>\s*([\d,]+)/);

    if (!totalMintsMatch) return null;

    return {
      totalMints: totalMintsMatch[1] || '0',
      totalVMUs: totalVMUsMatch ? totalVMUsMatch[1] : '0',
      remints: remintsMatch ? remintsMatch[1] : '0',
      maturing: maturingMatch ? maturingMatch[1] : '0',
      claimable: claimableMatch ? claimableMatch[1] : '0'
    };
  },

  // Parse XENFT text to extract metrics (reuse from Option 1)
  parseXenftText(text) {
    const totalCountMatch = text.match(/XENFTs:<\/strong>\s*([\d,]+)/);
    const totalVMUsMatch = text.match(/Total VMUs:<\/strong>\s*([\d,]+)/);
    const apexMatch = text.match(/Apex:\s*([\d,]+)/);
    const collectorMatch = text.match(/Collector:\s*([\d,]+)/);
    const limitedMatch = text.match(/Limited:\s*([\d,]+)/);
    const maturingMatch = text.match(/Maturing:<\/strong>\s*([\d,]+)/);
    const claimableMatch = text.match(/Claimable:<\/strong>\s*([\d,]+)/);

    if (!totalCountMatch) return null;

    return {
      totalCount: totalCountMatch[1] || '0',
      totalVMUs: totalVMUsMatch ? totalVMUsMatch[1] : '0',
      apex: apexMatch ? apexMatch[1] : '0',
      collector: collectorMatch ? collectorMatch[1] : '0',
      limited: limitedMatch ? limitedMatch[1] : '0',
      maturing: maturingMatch ? maturingMatch[1] : '0',
      claimable: claimableMatch ? claimableMatch[1] : '0'
    };
  },

  // Parse Stakes text to extract metrics (reuse from Option 1)
  parseStakeText(text) {
    const totalCountMatch = text.match(/Stakes:<\/strong>\s*([\d,]+)/);
    const maturingMatch = text.match(/Maturing:<\/strong>\s*([\d,]+)/);
    const claimableMatch = text.match(/Claimable:<\/strong>\s*([\d,]+)/);

    if (!totalCountMatch) return null;

    return {
      totalCount: totalCountMatch[1] || '0',
      maturing: maturingMatch ? maturingMatch[1] : '0',
      claimable: claimableMatch ? claimableMatch[1] : '0'
    };
  },

  // Parse XENFT Stakes text to extract metrics (reuse from Option 1)
  parseXenftStakeText(text) {
    const totalCountMatch = text.match(/XENFT Stakes:<\/strong>\s*([\d,]+)/);
    const maturingMatch = text.match(/Maturing:<\/strong>\s*([\d,]+)/);
    const claimableMatch = text.match(/Claimable:<\/strong>\s*([\d,]+)/);

    if (!totalCountMatch) return null;

    return {
      totalCount: totalCountMatch[1] || '0',
      maturing: maturingMatch ? maturingMatch[1] : '0',
      claimable: claimableMatch ? claimableMatch[1] : '0'
    };
  },

  // Refresh table data (can be called when data updates)
  refresh() {
    const tbody = document.getElementById('summaryTableBody');
    if (tbody) {
      // Clear existing rows
      tbody.innerHTML = '';
      // Repopulate
      this.populateTableFromExistingSummaries();
      // Ensure original summaries stay hidden
      this.hideOriginalSummaries();
      // Re-add mobile labels
      this.addMobileLabels();
      // Update table structure based on claimable data
      this.updateTableStructure();
      // Hide dynamically created per-address summaries with a slight delay
      // since they're created after the main summary updates
      setTimeout(() => this.hideOriginalSummaries(), 10);
    }
  },

  // Remove Option 2 styling
  remove() {
    const container = document.getElementById('summaryContainer');
    if (container) {
      container.classList.remove('option2');
      // Restore original formatting would need to be implemented
    }
  }
};

// Auto-initialize Option 2 layout
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Option 2 layout with a short delay to ensure all elements are present
  setTimeout(() => {
    window.summaryOption2.init();
    
    // Hook into existing summary update functions to refresh the table
    const originalUpdateSummaryStats = window.updateSummaryStats;
    const originalUpdateStakeSummaryLine = window.updateStakeSummaryLine;
    const originalUpdateXenftSummaryLine = window.updateXenftSummaryLine;
    const originalUpdateStakeXenftSummaryLine = window.updateStakeXenftSummaryLine;
    
    // Override summary update functions to also refresh our table
    if (typeof originalUpdateSummaryStats === 'function') {
      window.updateSummaryStats = function() {
        originalUpdateSummaryStats.apply(this, arguments);
        setTimeout(() => window.summaryOption2.refresh(), 50);
      };
    }
    
    if (typeof originalUpdateStakeSummaryLine === 'function') {
      window.updateStakeSummaryLine = function() {
        originalUpdateStakeSummaryLine.apply(this, arguments);
        setTimeout(() => window.summaryOption2.refresh(), 50);
      };
    }
    
    if (typeof originalUpdateXenftSummaryLine === 'function') {
      window.updateXenftSummaryLine = function() {
        originalUpdateXenftSummaryLine.apply(this, arguments);
        setTimeout(() => window.summaryOption2.refresh(), 50);
      };
    }
    
    if (typeof originalUpdateStakeXenftSummaryLine === 'function') {
      window.updateStakeXenftSummaryLine = function() {
        originalUpdateStakeXenftSummaryLine.apply(this, arguments);
        setTimeout(() => window.summaryOption2.refresh(), 50);
      };
    }
    
  }, 500);
});

// Also refresh when data changes
if (typeof window.addEventListener !== 'undefined') {
  // Listen for custom events that might indicate data updates
  window.addEventListener('unifiedDataRefresh', () => {
    setTimeout(() => window.summaryOption2.refresh(), 100);
  });
  
  // Listen for tabulator table updates
  window.addEventListener('tabulatorDataRefresh', () => {
    setTimeout(() => window.summaryOption2.refresh(), 100);
  });
}