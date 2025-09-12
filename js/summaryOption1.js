/* ===== OPTION 1: Card-Based Summary Layout Functions ===== */

window.summaryOption1 = {
  
  // Initialize Option 1 layout
  init() {
    const container = document.getElementById('summaryContainer');
    if (container) {
      container.classList.add('option1');
      this.transformExistingSummaries();
    }
  },

  // Transform existing summary divs into card layout
  transformExistingSummaries() {
    const container = document.getElementById('summaryContainer');
    if (!container) return;

    // Transform Cointool summary
    const cointoolDiv = document.getElementById('cointoolItemCount');
    if (cointoolDiv) {
      this.transformCointoolSummary(cointoolDiv);
    }

    // Transform XENFT summary
    const xenftDiv = document.getElementById('xenftItemCount');
    if (xenftDiv) {
      this.transformXenftSummary(xenftDiv);
    }

    // Transform Stakes summary
    const stakeDiv = document.getElementById('stakeItemCount');
    if (stakeDiv) {
      this.transformStakeSummary(stakeDiv);
    }

    // Transform XENFT Stakes summary
    const xenftStakeDiv = document.getElementById('stakeXenftItemCount');
    if (xenftStakeDiv) {
      this.transformXenftStakeSummary(xenftStakeDiv);
    }
  },

  // Transform Cointool summary into card format
  transformCointoolSummary(div) {
    const text = div.innerHTML;
    
    // Parse the existing text to extract metrics
    const metrics = this.parseCointoolText(text);
    if (!metrics) return;

    div.className = 'summary-card cointool';
    div.innerHTML = `
      <div class="summary-card-header">
        Cointool Mints
      </div>
      <div class="summary-card-content">
        <div class="metric total">
          <div class="metric-label">Total Mints</div>
          <div class="metric-value">${metrics.totalMints}</div>
        </div>
        <div class="metric total">
          <div class="metric-label">Total VMUs</div>
          <div class="metric-value">${metrics.totalVMUs}</div>
        </div>
        <div class="metric total">
          <div class="metric-label">Remints</div>
          <div class="metric-value">${metrics.remints}</div>
        </div>
        <div class="metric maturing">
          <div class="metric-label">Maturing</div>
          <div class="metric-value">${metrics.maturing}</div>
          <div class="metric-sublabel">VMUs</div>
        </div>
        <div class="metric claimable">
          <div class="metric-label">Claimable</div>
          <div class="metric-value">${metrics.claimable}</div>
          <div class="metric-sublabel">VMUs</div>
        </div>
      </div>
    `;
  },

  // Transform XENFT summary into card format
  transformXenftSummary(div) {
    const text = div.innerHTML;
    
    const metrics = this.parseXenftText(text);
    if (!metrics) return;

    div.className = 'summary-card xenft';
    div.innerHTML = `
      <div class="summary-card-header">
        XENFTs
      </div>
      <div class="summary-card-content">
        <div class="metric total">
          <div class="metric-label">Total XENFTs</div>
          <div class="metric-value">${metrics.totalCount}</div>
        </div>
        <div class="metric total">
          <div class="metric-label">Total VMUs</div>
          <div class="metric-value">${metrics.totalVMUs}</div>
          <div class="vmu-breakdown">
            <span class="vmu-type apex">Apex: ${metrics.apex}</span>
            <span class="vmu-type collector">Collector: ${metrics.collector}</span>
            <span class="vmu-type limited">Limited: ${metrics.limited}</span>
          </div>
        </div>
        <div class="metric maturing">
          <div class="metric-label">Maturing</div>
          <div class="metric-value">${metrics.maturing}</div>
          <div class="metric-sublabel">VMUs</div>
        </div>
        <div class="metric claimable">
          <div class="metric-label">Claimable</div>
          <div class="metric-value">${metrics.claimable}</div>
          <div class="metric-sublabel">Count</div>
        </div>
      </div>
    `;
  },

  // Transform Stakes summary into card format
  transformStakeSummary(div) {
    const text = div.innerHTML;
    
    const metrics = this.parseStakeText(text);
    if (!metrics) return;

    div.className = 'summary-card stake';
    div.innerHTML = `
      <div class="summary-card-header">
        XEN Stakes
      </div>
      <div class="summary-card-content">
        <div class="metric total">
          <div class="metric-label">Total Stakes</div>
          <div class="metric-value">${metrics.totalCount}</div>
        </div>
        <div class="metric maturing">
          <div class="metric-label">Maturing</div>
          <div class="metric-value">${metrics.maturing}</div>
          <div class="metric-sublabel">Stakes</div>
        </div>
        <div class="metric claimable">
          <div class="metric-label">Claimable</div>
          <div class="metric-value">${metrics.claimable}</div>
          <div class="metric-sublabel">Stakes</div>
        </div>
      </div>
    `;
  },

  // Transform XENFT Stakes summary into card format
  transformXenftStakeSummary(div) {
    const text = div.innerHTML;
    
    const metrics = this.parseXenftStakeText(text);
    if (!metrics) return;

    div.className = 'summary-card xenft-stake';
    div.innerHTML = `
      <div class="summary-card-header">
        XENFT Stakes
      </div>
      <div class="summary-card-content">
        <div class="metric total">
          <div class="metric-label">Total Staked</div>
          <div class="metric-value">${metrics.totalCount}</div>
        </div>
        <div class="metric maturing">
          <div class="metric-label">Maturing</div>
          <div class="metric-value">${metrics.maturing}</div>
          <div class="metric-sublabel">XENFTs</div>
        </div>
        <div class="metric claimable">
          <div class="metric-label">Claimable</div>
          <div class="metric-value">${metrics.claimable}</div>
          <div class="metric-sublabel">XENFTs</div>
        </div>
      </div>
    `;
  },

  // Parse Cointool text to extract metrics
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

  // Parse XENFT text to extract metrics
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

  // Parse Stakes text to extract metrics
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

  // Parse XENFT Stakes text to extract metrics
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

  // Remove Option 1 styling
  remove() {
    const container = document.getElementById('summaryContainer');
    if (container) {
      container.classList.remove('option1');
      // Restore original formatting would need to be implemented
      // This would require storing the original innerHTML before transformation
    }
  }
};

// Auto-initialize if this is the selected option
if (localStorage.getItem('summaryLayoutOption') === 'option1') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.summaryOption1.init(), 100);
  });
}