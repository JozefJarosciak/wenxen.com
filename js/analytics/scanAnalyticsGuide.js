// Scan Analytics Dashboard Guide - Instructions for setting up GA4 reports for scan operations
export const scanAnalyticsGuide = {

  // Complete breakdown of what scan data is tracked
  getTrackedScanData() {
    return {
      events: {
        'scan_operation': {
          description: 'Main scan tracking event',
          actions: ['start', 'complete', 'cancel', 'error'],
          parameters: [
            'scan_type', 'scan_mode', 'action', 'force_rescan',
            'address_count', 'chain', 'scan_duration', 'items_found',
            'scan_success', 'scan_cancelled', 'error_occurred',
            'timestamp', 'session_id', 'page_section'
          ]
        },
        'component_interaction': {
          description: 'Scan mode selection changes',
          component: 'scan_mode_select',
          parameters: ['previous_mode', 'new_mode', 'chain']
        }
      },

      scanTypes: [
        'all', 'cointool', 'xenft', 'stake-xenft', 'stake'
      ],

      chains: [
        'ethereum', 'base'
      ],

      actionFlow: [
        'start → complete (success)',
        'start → cancel (user stopped)',
        'start → error (failure)',
        'mode_change (scan type selection)'
      ]
    };
  },

  // GA4 Dashboard Setup Instructions
  getGA4SetupInstructions() {
    return {

      step1_customDimensions: {
        title: "1. Create Custom Dimensions",
        instructions: "Go to GA4 → Configure → Custom Definitions → Create custom dimensions",
        dimensions: [
          {
            name: "Scan Type",
            parameter: "scan_type",
            scope: "Event",
            description: "Type of scan performed (all, cointool, xenft, etc.)"
          },
          {
            name: "Scan Action",
            parameter: "action",
            scope: "Event",
            description: "Scan action (start, complete, cancel, error)"
          },
          {
            name: "Blockchain Chain",
            parameter: "chain",
            scope: "Event",
            description: "Blockchain network (ethereum, base)"
          },
          {
            name: "Address Count",
            parameter: "address_count",
            scope: "Event",
            description: "Number of addresses being scanned"
          },
          {
            name: "Scan Duration",
            parameter: "scan_duration",
            scope: "Event",
            description: "Time taken for scan in seconds"
          },
          {
            name: "Items Found",
            parameter: "items_found",
            scope: "Event",
            description: "Number of items discovered in scan"
          },
          {
            name: "Scan Success",
            parameter: "scan_success",
            scope: "Event",
            description: "Whether scan completed successfully"
          }
        ]
      },

      step2_conversions: {
        title: "2. Set Up Conversions",
        instructions: "GA4 → Configure → Conversions → New conversion event",
        conversions: [
          {
            name: "scan_completion",
            condition: "event_name = scan_operation AND action = complete",
            description: "Track successful scan completions"
          },
          {
            name: "scan_error",
            condition: "event_name = scan_operation AND action = error",
            description: "Track scan failures for debugging"
          }
        ]
      },

      step3_reports: {
        title: "3. Create Custom Reports",
        reports: [
          {
            name: "Scan Operations Overview",
            type: "Exploration → Free Form",
            dimensions: ["Event name", "Custom:Scan Type", "Custom:Scan Action"],
            metrics: ["Event count", "Total users"],
            description: "Overall scan usage patterns"
          },
          {
            name: "Scan Performance Analysis",
            type: "Exploration → Free Form",
            dimensions: ["Custom:Scan Type", "Custom:Chain", "Custom:Scan Duration"],
            metrics: ["Event count", "Average scan duration"],
            description: "Performance metrics by scan type and chain"
          },
          {
            name: "Scan Success Rates",
            type: "Exploration → Free Form",
            dimensions: ["Custom:Scan Type", "Custom:Scan Success"],
            metrics: ["Event count", "Conversion rate"],
            description: "Success/failure analysis"
          },
          {
            name: "User Scan Behavior",
            type: "Exploration → Path Exploration",
            startingPoint: "scan_operation (action=start)",
            description: "User journey through scan process"
          }
        ]
      }
    };
  },

  // Pre-built GA4 report configurations
  getReportConfigurations() {
    return {

      scanOverviewReport: {
        name: "WenXen Scan Operations Dashboard",
        description: "Complete overview of all scan operations",
        visualization: "Table",
        dimensions: [
          "Custom:Scan Type",
          "Custom:Scan Action",
          "Custom:Chain"
        ],
        metrics: [
          "Event count",
          "Total users",
          "Sessions with events"
        ],
        filters: [
          "Event name exactly matches scan_operation"
        ]
      },

      scanPerformanceReport: {
        name: "Scan Performance Metrics",
        description: "Duration and success rate analysis",
        visualization: "Line chart",
        dimensions: [
          "Date",
          "Custom:Scan Type"
        ],
        metrics: [
          "Average Custom:Scan Duration",
          "Custom:Items Found (sum)"
        ],
        filters: [
          "Custom:Scan Action exactly matches complete"
        ]
      },

      scanFunnelReport: {
        name: "Scan Completion Funnel",
        description: "Track scan start to completion rates",
        visualization: "Funnel exploration",
        steps: [
          {
            name: "Scan Started",
            condition: "Event name = scan_operation AND action = start"
          },
          {
            name: "Scan Completed",
            condition: "Event name = scan_operation AND action = complete"
          }
        ]
      },

      chainUsageReport: {
        name: "Blockchain Network Usage",
        description: "Scan distribution across Ethereum and Base",
        visualization: "Pie chart",
        dimensions: [
          "Custom:Chain"
        ],
        metrics: [
          "Event count",
          "Total users"
        ]
      }
    };
  },

  // Quick setup checklist
  getSetupChecklist() {
    return [
      {
        task: "Create Custom Dimensions",
        description: "Add scan_type, action, chain, scan_duration, items_found dimensions",
        location: "GA4 → Configure → Custom definitions",
        status: "required"
      },
      {
        task: "Set Up Conversion Events",
        description: "Track scan completions and errors as conversions",
        location: "GA4 → Configure → Conversions",
        status: "recommended"
      },
      {
        task: "Create Scan Dashboard",
        description: "Build custom report for scan operations overview",
        location: "GA4 → Explore → Free Form",
        status: "recommended"
      },
      {
        task: "Enable Real-time Monitoring",
        description: "Monitor scan events in real-time during testing",
        location: "GA4 → Reports → Realtime",
        status: "optional"
      },
      {
        task: "Set Up Alerts",
        description: "Get notified when scan error rates are high",
        location: "GA4 → Configure → Intelligence",
        status: "optional"
      }
    ];
  },

  // Sample queries for GA4 reports
  getSampleQueries() {
    return {

      // Most popular scan types
      popularScanTypes: {
        title: "Most Used Scan Types",
        dimensions: ["Custom:Scan Type"],
        metrics: ["Event count"],
        filters: ["Event name = scan_operation", "Custom:Scan Action = start"],
        orderBy: "Event count DESC"
      },

      // Average scan duration by type
      averageDuration: {
        title: "Average Scan Duration by Type",
        dimensions: ["Custom:Scan Type"],
        metrics: ["Average Custom:Scan Duration"],
        filters: ["Event name = scan_operation", "Custom:Scan Action = complete"]
      },

      // Scan success rates
      successRates: {
        title: "Scan Success Rates",
        dimensions: ["Custom:Scan Type", "Custom:Scan Success"],
        metrics: ["Event count"],
        filters: ["Event name = scan_operation", "Custom:Scan Action IN (complete, error)"]
      },

      // Chain preference analysis
      chainUsage: {
        title: "Blockchain Network Preference",
        dimensions: ["Custom:Chain", "Custom:Scan Type"],
        metrics: ["Event count", "Total users"],
        filters: ["Event name = scan_operation"]
      },

      // Error analysis
      errorAnalysis: {
        title: "Scan Error Breakdown",
        dimensions: ["Custom:Scan Type", "Custom:Chain"],
        metrics: ["Event count"],
        filters: ["Event name = scan_operation", "Custom:Scan Action = error"]
      }
    };
  },

  // Generate setup instructions
  generateSetupInstructions() {
    console.log('📊 WenXen Scan Analytics Setup Guide');
    console.log('=====================================');

    const setup = this.getGA4SetupInstructions();

    Object.entries(setup).forEach(([key, section]) => {
      console.log(`\n${section.title}`);
      console.log('-'.repeat(section.title.length));
      console.log(section.instructions);

      if (section.dimensions) {
        console.log('\nCustom Dimensions to Create:');
        section.dimensions.forEach(dim => {
          console.log(`• ${dim.name}: ${dim.parameter} (${dim.scope})`);
          console.log(`  ${dim.description}`);
        });
      }

      if (section.conversions) {
        console.log('\nConversion Events to Create:');
        section.conversions.forEach(conv => {
          console.log(`• ${conv.name}: ${conv.condition}`);
          console.log(`  ${conv.description}`);
        });
      }

      if (section.reports) {
        console.log('\nReports to Create:');
        section.reports.forEach(report => {
          console.log(`• ${report.name} (${report.type})`);
          console.log(`  ${report.description}`);
        });
      }
    });
  },

  // Print current scan tracking status
  printTrackingStatus() {
    const data = this.getTrackedScanData();

    console.log('🎯 Current Scan Tracking Configuration');
    console.log('====================================');
    console.log(`Events: ${Object.keys(data.events).join(', ')}`);
    console.log(`Scan Types: ${data.scanTypes.join(', ')}`);
    console.log(`Chains: ${data.chains.join(', ')}`);
    console.log(`Action Flow: ${data.actionFlow.join(' | ')}`);

    console.log('\n📈 Available Analytics Breakdowns:');
    console.log('• Scan operations by type (all, cointool, xenft, stake)');
    console.log('• Success vs failure rates');
    console.log('• Duration analysis');
    console.log('• Chain usage (Ethereum vs Base)');
    console.log('• Items found per scan');
    console.log('• User scan behavior patterns');
  }
};

// Global access
window.scanAnalyticsGuide = scanAnalyticsGuide;

// Auto-display in development
if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      console.log('📊 Scan Analytics Guide loaded');
      console.log('💡 Run scanAnalyticsGuide.generateSetupInstructions() for GA4 setup');
      console.log('📈 Run scanAnalyticsGuide.printTrackingStatus() to see current tracking');
    }, 4000);
  });
}

export default scanAnalyticsGuide;