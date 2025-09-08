// Google Analytics 4 (GA4) Support
// Tracking ID: G-333LEVEH6W

(function() {
  'use strict';
  
  // Only initialize if not already loaded
  if (window.gtag) {
    console.log('Google Analytics already initialized');
    return;
  }
  
  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Define gtag function
  function gtag() {
    dataLayer.push(arguments);
  }
  
  // Make gtag available globally
  window.gtag = gtag;
  
  // Initialize with current timestamp
  gtag('js', new Date());
  
  // Configure GA4 with tracking ID
  gtag('config', 'G-333LEVEH6W', {
    // Enhanced measurement features
    page_title: document.title,
    page_location: window.location.href,
    // Privacy-friendly settings
    anonymize_ip: true,
    allow_ad_personalization_signals: false
  });
  
  // Load the gtag script dynamically
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-333LEVEH6W';
  
  // Insert script before the first existing script tag
  const firstScript = document.getElementsByTagName('script')[0];
  firstScript.parentNode.insertBefore(script, firstScript);
  
  // Helper function to track custom events
  window.trackEvent = function(action, category, label, value) {
    if (window.gtag) {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }
  };
  
  // Track page views for SPA navigation
  window.trackPageView = function(page_title, page_location) {
    if (window.gtag) {
      gtag('config', 'G-333LEVEH6W', {
        page_title: page_title || document.title,
        page_location: page_location || window.location.href
      });
    }
  };
  
})();