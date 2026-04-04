// background.js - AURA AI v3.6.0
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            'aura_chat_history': [],
            'aura_current_model': 'google/gemini-2.0-flash-exp:free',
            'aura_providers': [
                { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', key: '', models: ['google/gemini-2.0-flash-exp:free', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'] }
            ],
            'aura_notes': [],
            'aura_training_v2': { text: [], files: [], sources: [] }
        });
        console.log('AURA AI Extension Installed');
    }

    // Configure Side Panel behavior
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));

    // Create context menu
    chrome.contextMenus.create({
        id: 'aura-improve',
        title: '✨ Melhorar com AURA AI',
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: 'aura-summarize',
        title: '📝 Resumir com AURA AI',
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: 'aura-leens',
        title: '🔍 Analisar com Aura Leens',
        contexts: ['all']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'aura-improve' || info.menuItemId === 'aura-summarize' || info.menuItemId === 'aura-leens') {
        chrome.sidePanel.open({ tabId: tab.id });
        if (info.selectionText) {
            chrome.storage.local.set({ 
                'aura_pending_text': info.selectionText, 
                'aura_pending_type': info.menuItemId.replace('aura-', '') 
            });
        }
    }
});

// Listen for messages from content scripts (Floating Menu)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processText') {
        console.log('AURA Background: Processing text from floating menu:', message.type);
        
        // Store pending action in storage
        chrome.storage.local.set({ 
            'aura_pending_text': message.text, 
            'aura_pending_type': message.type 
        }, () => {
            // Open the side panel for the current tab
            if (sender.tab && sender.tab.id) {
                chrome.sidePanel.open({ tabId: sender.tab.id })
                    .then(() => console.log('AURA Side Panel Opened'))
                    .catch((err) => console.error('Error opening side panel:', err));
            }
        });
    }
});
