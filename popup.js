// popup.js
document.addEventListener('DOMContentLoaded', async () => {
    const chatMessages = document.getElementById('aura-chat-messages');
    const userInput = document.getElementById('aura-user-input');
    const sendBtn = document.getElementById('aura-send-btn');
    const canvasContainer = 'aura-canvas-container';

    // Initialize Clients
    const aiClient = new AuraAIClient();
    const notesManager = new NotesManager();
    const trainingManager = new TrainingManager();
    
    await aiClient.loadConfig();
    await notesManager.loadNotes();
    await trainingManager.loadTraining();

    // Initialize Three.js Effect
    if (typeof AuraOpeningEffect !== 'undefined') {
        new AuraOpeningEffect(canvasContainer);
    }

    // Load existing messages
    const savedMessages = await chrome.storage.local.get(['aura_chat_history']);
    if (savedMessages.aura_chat_history) {
        savedMessages.aura_chat_history.forEach(msg => {
            appendMessage(msg.role === 'user' ? 'USER' : 'AURA', msg.content, msg.role === 'user');
        });
    }

    // Check for pending actions from context menu
    const pending = await chrome.storage.local.get(['aura_pending_text', 'aura_pending_type']);
    if (pending.aura_pending_text) {
        const prompt = `Ação: ${pending.aura_pending_type}\nTexto: ${pending.aura_pending_text}`;
        userInput.value = prompt;
        await chrome.storage.local.remove(['aura_pending_text', 'aura_pending_type']);
        handleSendMessage();
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

        userInput.value = '';
        userInput.style.height = 'auto';

        appendMessage('USER', text, true);

        const history = await chrome.storage.local.get(['aura_chat_history']);
        const messages = history.aura_chat_history || [];
        
        // Add training context if available
        const trainingContext = trainingManager.getContextForPrompt();
        const fullPrompt = trainingContext ? `${trainingContext}\n\nPERGUNTA: ${text}` : text;
        
        messages.push({ role: 'user', content: fullPrompt });

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

            messages.push({ role: 'assistant', content: fullResponse });
            await chrome.storage.local.set({ 'aura_chat_history': messages.slice(-20) });

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

    // Navigation
    document.querySelectorAll('.aura-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.aura-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            if (item.id === 'nav-settings') showSettings();
            if (item.id === 'nav-notes') showNotes();
            if (item.id === 'nav-training') showTraining();
            if (item.id === 'nav-chat') {
                // Refresh chat view if needed
            }
        });
    });

    async function showSettings() {
        await aiClient.loadConfig();
        const provider = aiClient.getProvider();
        const model = aiClient.currentModel;
        
        const settingsHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel">
                    <h3>Configurações AURA</h3>
                    <div class="aura-setting-item">
                        <label>Provedor:</label>
                        <select id="settings-provider-select">
                            ${aiClient.providers.map(p => `<option value="${p.id}" ${p.id === aiClient.currentProviderId ? 'selected' : ''}>${p.name}</option>`).join('')}
                            <option value="new">+ Adicionar Provedor</option>
                        </select>
                    </div>
                    <div id="provider-details">
                        <div class="aura-setting-item">
                            <label>URL Base:</label>
                            <input type="text" id="settings-provider-url" value="${provider.url}">
                        </div>
                        <div class="aura-setting-item">
                            <label>API Key:</label>
                            <input type="password" id="settings-provider-key" value="${provider.key}">
                        </div>
                    </div>
                    <div class="aura-setting-item">
                        <label>Modelo (ID):</label>
                        <input type="text" id="settings-model-id" value="${model}" placeholder="ex: anthropic/claude-3.5-sonnet">
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
            const updatedProvider = {
                id: aiClient.currentProviderId,
                name: provider.name,
                url: document.getElementById('settings-provider-url').value,
                key: document.getElementById('settings-provider-key').value
            };
            await aiClient.saveProvider(updatedProvider);
            await aiClient.setModel(document.getElementById('settings-model-id').value);
            div.remove();
        };
        
        document.getElementById('settings-close').onclick = () => div.remove();
    }

    async function showNotes() {
        const notes = await notesManager.loadNotes();
        const notesHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel" style="width: 380px;">
                    <h3>Suas Notas</h3>
                    <div class="aura-notes-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
                        ${notes.length ? notes.map(n => `
                            <div class="aura-note-item" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                                <strong>${n.title}</strong>
                                <p style="font-size: 12px; color: var(--aura-text-muted);">${n.content.substring(0, 50)}...</p>
                            </div>
                        `).join('') : '<p>Nenhuma nota salva.</p>'}
                    </div>
                    <button id="add-note-btn" style="width: 100%; padding: 10px; background: var(--aura-gradient); border: none; border-radius: 8px; color: white; cursor: pointer;">+ Nova Nota</button>
                    <button id="notes-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = notesHtml;
        document.body.appendChild(div);
        
        document.getElementById('add-note-btn').onclick = async () => {
            const title = prompt("Título da nota:");
            const content = prompt("Conteúdo:");
            if (title && content) {
                await notesManager.saveNote(title, content);
                div.remove();
                showNotes();
            }
        };
        document.getElementById('notes-close').onclick = () => div.remove();
    }

    async function showTraining() {
        const training = await trainingManager.loadTraining();
        const trainingHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel">
                    <h3>Treinamento AURA</h3>
                    <div class="aura-training-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
                        ${training.length ? training.map(t => `
                            <div style="font-size: 12px; margin-bottom: 5px;">✅ ${t.name} (${t.type})</div>
                        `).join('') : '<p>Nenhum contexto adicionado.</p>'}
                    </div>
                    <div class="aura-setting-item">
                        <label>Adicionar URL para Contexto:</label>
                        <input type="text" id="training-url" placeholder="https://...">
                    </div>
                    <button id="add-training-btn" style="width: 100%; padding: 10px; background: var(--aura-gradient); border: none; border-radius: 8px; color: white; cursor: pointer;">Adicionar Contexto</button>
                    <button id="training-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = trainingHtml;
        document.body.appendChild(div);
        
        document.getElementById('add-training-btn').onclick = async () => {
            const url = document.getElementById('training-url').value;
            if (url) {
                await trainingManager.addTraining('url', url, url);
                div.remove();
                showTraining();
            }
        };
        document.getElementById('training-close').onclick = () => div.remove();
    }
});
