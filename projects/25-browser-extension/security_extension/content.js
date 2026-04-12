// Security Browser Extension - Project 25
// Content script for security indicators

(function() {
    'use strict';
    
    // Check HTTPS
    const isSecure = window.location.protocol === 'https:';
    
    // Check for login forms
    const forms = document.querySelectorAll('form');
    const loginForms = Array.from(forms).filter(form => {
        const inputs = form.querySelectorAll('input');
        return Array.from(inputs).some(input => 
            /password|passwd|pwd/i.test(input.name || input.id)
        );
    });
    
    // Check cookies security
    const cookies = document.cookie.split(';');
    const insecureCookies = cookies.filter(cookie => {
        return !cookie.includes('Secure') && !cookie.includes('HttpOnly');
    });
    
    // Report to popup
    const securityInfo = {
        url: window.location.href,
        isSecure: isSecure,
        loginForms: loginForms.length,
        insecureCookies: insecureCookies.length,
        timestamp: new Date().toISOString()
    };
    
    // Store for popup access
    chrome.storage.local.set({ lastPageInfo: securityInfo });
    
    // Add visual indicator for insecure pages
    if (!isSecure && loginForms.length > 0) {
        const warning = document.createElement('div');
        warning.id = 'security-warning';
        warning.innerHTML = `
            <div style="
                background: #ff4444;
                color: white;
                padding: 10px 20px;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 999999;
                font-family: Arial, sans-serif;
                font-size: 14px;
                text-align: center;
            ">
                ⚠️ Security Warning: This page uses HTTP. 
                Login credentials will be sent in plain text!
            </div>
        `;
        document.body.prepend(warning);
    }
    
    // Log for debugging
    console.log('[Security Extension] Page analyzed:', securityInfo);
    
})();
