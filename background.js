// background.js
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            'aura_chat_history': [],
            'aura_current_model': 'google/gemini-2.0-flash-exp:free',
            'aura_providers': [
                { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', key: '' }
            ],
            'aura_notes': [],
            'aura_training': []
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

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processText') {
        chrome.storage.local.set({ 'aura_pending_text': message.text, 'aura_pending_type': message.type });
        chrome.sidePanel.open({ tabId: sender.tab.id });
    }
});
