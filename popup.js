// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const chatMessages = document.getElementById('aura-chat-messages');
    const userInput = document.getElementById('aura-user-input');
    const sendBtn = document.getElementById('aura-send-btn');
    const canvasContainer = 'aura-canvas-container';

    // Initialize Three.js Effect
    if (typeof AuraOpeningEffect !== 'undefined') {
        new AuraOpeningEffect(canvasContainer);
    }

    // Initialize OpenRouter Client
    const aiClient = new OpenRouterClient();
    
    // Load existing messages (if any)
    const savedMessages = await chrome.storage.local.get(['aura_chat_history']);
    if (savedMessages.aura_chat_history) {
        // Render history
        savedMessages.aura_chat_history.forEach(msg => {
            appendMessage(msg.role === 'user' ? 'USER' : 'AURA', msg.content, msg.role === 'user');
        });
    }

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    });

    // Send message function
    async function handleSendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // Clear input
        userInput.value = '';
        userInput.style.height = 'auto';

        // Add user message to UI
        appendMessage('USER', text, true);

        // Prepare messages for API
        const history = await chrome.storage.local.get(['aura_chat_history']);
        const messages = history.aura_chat_history || [];
        messages.push({ role: 'user', content: text });

        // Add AI placeholder
        const aiMsgDiv = appendMessage('AURA', 'Pensando...', false);
        const contentDiv = aiMsgDiv.querySelector('.aura-message-content');
        contentDiv.innerHTML = '<span class="aura-typing">...</span>';

        try {
            let fullResponse = '';
            await aiClient.chat(messages, (chunk, full) => {
                fullResponse = full;
                contentDiv.textContent = full;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });

            // Save to history
            messages.push({ role: 'assistant', content: fullResponse });
            await chrome.storage.local.set({ 'aura_chat_history': messages.slice(-20) }); // Keep last 20

        } catch (error) {
            contentDiv.textContent = `Erro: ${error.message}`;
            contentDiv.classList.add('aura-error');
        }
    }

    function appendMessage(sender, text, isUser) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `aura-message ${isUser ? 'aura-message-user' : 'aura-message-ai'}`;
        
        const header = document.createElement('div');
        header.className = 'aura-message-header';
        header.textContent = sender;
        
        const content = document.createElement('div');
        content.className = 'aura-message-content';
        content.textContent = text;
        
        msgDiv.appendChild(header);
        msgDiv.appendChild(content);
        chatMessages.appendChild(msgDiv);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    // Event Listeners
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Navigation (Placeholders)
    document.querySelectorAll('.aura-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.aura-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            // Logic to switch panels would go here
            if (item.id === 'nav-settings') {
                showSettings();
            }
        });
    });

    async function showSettings() {
        const apiKey = await aiClient.getApiKey() || '';
        const model = await aiClient.getModel();
        
        const settingsHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel">
                    <h3>Configurações</h3>
                    <div class="aura-setting-item">
                        <label>OpenRouter API Key:</label>
                        <input type="password" id="settings-api-key" value="${apiKey}" placeholder="sk-or-v1-...">
                    </div>
                    <div class="aura-setting-item">
                        <label>Modelo:</label>
                        <select id="settings-model">
                            <option value="google/gemini-2.0-flash-exp:free" ${model.includes('gemini') ? 'selected' : ''}>Gemini 2.0 Flash (Grátis)</option>
                            <option value="anthropic/claude-3.5-sonnet" ${model.includes('claude') ? 'selected' : ''}>Claude 3.5 Sonnet</option>
                            <option value="openai/gpt-4o" ${model.includes('gpt-4o') ? 'selected' : ''}>GPT-4o</option>
                        </select>
                    </div>
                    <div class="aura-settings-actions">
                        <button id="settings-save">Salvar</button>
                        <button id="settings-close">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        
        const div = document.createElement('div');
        div.innerHTML = settingsHtml;
        document.body.appendChild(div);
        
        document.getElementById('settings-save').onclick = async () => {
            const newKey = document.getElementById('settings-api-key').value;
            const newModel = document.getElementById('settings-model').value;
            await aiClient.setApiKey(newKey);
            await aiClient.setModel(newModel);
            div.remove();
        };
        
        document.getElementById('settings-close').onclick = () => div.remove();
    }
});
