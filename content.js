// content.js - AURA AI v3.6.0
class AuraContent {
    constructor() {
        this.floatingMenu = null;
        this.selectedText = '';
        this.init();
    }

    init() {
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        
        // Listen for messages from background/popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'getSelectedText') {
                sendResponse({ text: this.selectedText });
            }
        });
    }

    handleMouseDown(e) {
        // If clicking outside the menu, remove it
        if (this.floatingMenu && !this.floatingMenu.contains(e.target)) {
            this.removeFloatingMenu();
        }
    }

    handleMouseUp(e) {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        // Only show if text is selected and it's not inside our menu
        if (text && text.length > 1 && (!this.floatingMenu || !this.floatingMenu.contains(e.target))) {
            this.selectedText = text;
            this.showFloatingMenu(e.pageX, e.pageY);
        }
    }

    showFloatingMenu(x, y) {
        this.removeFloatingMenu();

        this.floatingMenu = document.createElement('div');
        this.floatingMenu.className = 'aura-floating-menu';
        // Position slightly above the selection
        this.floatingMenu.style.left = `${x}px`;
        this.floatingMenu.style.top = `${y + 10}px`;

        const actions = [
            { id: 'improve', label: 'Melhorar', icon: '✨' },
            { id: 'summarize', label: 'Resumir', icon: '📝' },
            { id: 'translate', label: 'Traduzir', icon: '🌐' },
            { id: 'chat', label: 'Chat', icon: '💬' }
        ];

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'aura-menu-btn';
            btn.innerHTML = `<span class="aura-btn-icon">${action.icon}</span> <span class="aura-btn-text">${action.label}</span>`;
            
            // Use mousedown to trigger before selection is lost
            btn.onmousedown = (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.handleAction(action.id);
            };
            
            this.floatingMenu.appendChild(btn);
        });

        document.body.appendChild(this.floatingMenu);
    }

    removeFloatingMenu() {
        if (this.floatingMenu) {
            this.floatingMenu.remove();
            this.floatingMenu = null;
        }
    }

    handleAction(actionId) {
        console.log(`AURA Action Triggered: ${actionId}`);
        chrome.runtime.sendMessage({ 
            action: 'processText', 
            type: actionId, 
            text: this.selectedText 
        });
        this.removeFloatingMenu();
    }
}

// Inject CSS for floating menu with premium look
const style = document.createElement('style');
style.textContent = `
    .aura-floating-menu {
        position: absolute;
        z-index: 2147483647;
        background: #0f172a;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 4px;
        display: flex;
        gap: 2px;
        box-shadow: 0 10px 30px -5px rgba(0,0,0,0.5), 0 0 15px rgba(99, 102, 241, 0.2);
        animation: auraFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: auto;
        user-select: none;
    }
    .aura-menu-btn {
        background: transparent;
        border: none;
        color: #e2e8f0;
        padding: 6px 10px;
        border-radius: 7px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .aura-menu-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #818cf8;
        transform: translateY(-1px);
    }
    .aura-btn-icon {
        font-size: 14px;
    }
    @keyframes auraFadeIn {
        from { opacity: 0; transform: translateY(8px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
`;
document.head.appendChild(style);

// Initialize
if (window.auraContentInstance) {
    // Clean up if already exists
    window.auraContentInstance.removeFloatingMenu();
}
window.auraContentInstance = new AuraContent();
