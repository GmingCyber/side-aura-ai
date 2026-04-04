// content.js
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
        if (this.floatingMenu && !this.floatingMenu.contains(e.target)) {
            this.removeFloatingMenu();
        }
    }

    handleMouseUp(e) {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 2) {
            this.selectedText = text;
            this.showFloatingMenu(e.pageX, e.pageY);
        }
    }

    showFloatingMenu(x, y) {
        this.removeFloatingMenu();

        this.floatingMenu = document.createElement('div');
        this.floatingMenu.className = 'aura-floating-menu';
        this.floatingMenu.style.left = `${x}px`;
        this.floatingMenu.style.top = `${y + 10}px`;

        const actions = [
            { id: 'improve', label: '✨ Melhorar', icon: '🪄' },
            { id: 'summarize', label: '📝 Resumir', icon: '📄' },
            { id: 'translate', label: '🌐 Traduzir', icon: '🌍' },
            { id: 'chat', label: '💬 Chat', icon: '🤖' }
        ];

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'aura-menu-btn';
            btn.innerHTML = `<span>${action.icon}</span> ${action.label}`;
            btn.onclick = () => this.handleAction(action.id);
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
        console.log(`AURA Action: ${actionId} on text: ${this.selectedText}`);
        // Open extension popup or send message to background
        chrome.runtime.sendMessage({ 
            action: 'processText', 
            type: actionId, 
            text: this.selectedText 
        });
        this.removeFloatingMenu();
    }
}

// Inject CSS for floating menu
const style = document.createElement('style');
style.textContent = `
    .aura-floating-menu {
        position: absolute;
        z-index: 999999;
        background: #1e293b;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 6px;
        display: flex;
        gap: 4px;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4);
        animation: auraFadeIn 0.2s ease-out;
    }
    .aura-menu-btn {
        background: transparent;
        border: none;
        color: #f8fafc;
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        transition: all 0.2s;
    }
    .aura-menu-btn:hover {
        background: rgba(99, 102, 241, 0.2);
        color: #8b5cf6;
    }
    @keyframes auraFadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

new AuraContent();
