// background.js
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            'aura_chat_history': [],
            'aura_current_model': 'google/gemini-2.0-flash-exp:free'
        });
        console.log('AURA AI Extension Installed');
    } else if (details.reason === 'update') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/aura-128.png',
            title: 'AURA AI Atualizada',
            message: `Versão ${chrome.runtime.getManifest().version} instalada com sucesso!`
        });
    }

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
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'aura-improve' || info.menuItemId === 'aura-summarize') {
        // Send message to content script or open popup
        chrome.action.openPopup();
    }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'processText') {
        // Store text to be processed in popup
        chrome.storage.local.set({ 'aura_pending_text': message.text, 'aura_pending_type': message.type });
        // Open popup
        chrome.action.openPopup();
    }
});
