// Popup script for Security Browser Extension

document.addEventListener('DOMContentLoaded', function() {
    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const tab = tabs[0];
        
        // Get stored info for this tab
        chrome.storage.local.get('lastPageInfo', function(result) {
            const info = result.lastPageInfo;
            
            if (info) {
                // Update status
                const statusEl = document.getElementById('status');
                const infoEl = document.getElementById('info');
                const warningEl = document.getElementById('warning');
                
                if (info.isSecure) {
                    statusEl.className = 'status secure';
                    statusEl.textContent = '✓ Secure Connection (HTTPS)';
                } else {
                    statusEl.className = 'status insecure';
                    statusEl.textContent = '✗ Insecure Connection (HTTP)';
                    
                    if (info.loginForms > 0) {
                        warningEl.style.display = 'block';
                    }
                }
                
                // Update info
                document.getElementById('url').textContent = truncateUrl(info.url);
                document.getElementById('protocol').textContent = info.isSecure ? 'HTTPS' : 'HTTP';
                document.getElementById('forms').textContent = info.loginForms;
                document.getElementById('cookies').textContent = info.insecureCookies;
                
                infoEl.style.display = 'block';
            } else {
                document.getElementById('status').textContent = 'No data available';
            }
        });
    });
});

function truncateUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + (urlObj.pathname.length > 20 ? '...' : urlObj.pathname);
    } catch {
        return url.substring(0, 30) + '...';
    }
}
