// popup.js - AURA AI v3.6.0
document.addEventListener('DOMContentLoaded', async () => {
    const chatMessages = document.getElementById('aura-chat-messages');
    const userInput = document.getElementById('aura-user-input');
    const sendBtn = document.getElementById('aura-send-btn');
    const canvasContainer = 'aura-canvas-container';

    // Initialize Clients
    const aiClient = new AuraAIClient();
    const notesManager = new NotesManager();
    const trainingManager = new TrainingManager();
    const modelManager = new AuraModelManager();
    
    // Load all configs
    try {
        await aiClient.loadConfig();
        await notesManager.loadNotes();
        await trainingManager.loadTraining();
        await modelManager.loadModels();
        console.log('AURA AI Initialized');
    } catch (e) {
        console.error('Initialization Error:', e);
    }

    // Initialize Three.js Effect
    if (typeof AuraOpeningEffect !== 'undefined') {
        try {
            new AuraOpeningEffect(canvasContainer);
        } catch (e) {
            console.error('Three.js Error:', e);
        }
    }

    // Load existing messages
    const savedMessages = await chrome.storage.local.get(['aura_chat_history']);
    if (savedMessages.aura_chat_history) {
        savedMessages.aura_chat_history.forEach(msg => {
            appendMessage(msg.role === 'user' ? 'USER' : 'AURA', msg.content, msg.role === 'user');
        });
    }

    // Check for pending actions
    async function checkPendingActions() {
        const pending = await chrome.storage.local.get(['aura_pending_text', 'aura_pending_type']);
        if (pending.aura_pending_text) {
            const actionLabels = {
                'improve': 'Melhorar',
                'summarize': 'Resumir',
                'shorten': 'Encurtar',
                'chat': 'Chat',
                'translate': 'Traduzir',
                'leens': 'Analisar'
            };
            const label = actionLabels[pending.aura_pending_type] || pending.aura_pending_type;
            userInput.value = `Ação: ${label}\nTexto: ${pending.aura_pending_text}`;
            await chrome.storage.local.remove(['aura_pending_text', 'aura_pending_type']);
            handleSendMessage();
        }
    }
    
    checkPendingActions();
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.aura_pending_text) checkPendingActions();
    });

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
        
        const trainingContext = trainingManager.getContextForPrompt();
        const activePersona = modelManager.getActiveModel();
        
        // Aura Leens Context
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageContext = tab ? `[CONTEXTO DA PÁGINA: ${tab.title} | URL: ${tab.url}]` : '';

        const systemPrompt = `Você é ${activePersona.title}. ${activePersona.description}. ${pageContext}`;
        const fullPrompt = trainingContext ? `${trainingContext}\n\nPERGUNTA: ${text}` : text;
        
        const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages,
            { role: 'user', content: fullPrompt }
        ];

        // Thinking & Building Mode Visual
        const aiMsgDiv = appendMessage(activePersona.title, '', false);
        const contentDiv = aiMsgDiv.querySelector('.aura-message-content');
        
        const thinkingIndicator = document.createElement('div');
        thinkingIndicator.className = 'aura-thinking-mode';
        thinkingIndicator.innerHTML = `
            <div class="aura-thinking-dots">
                <span></span><span></span><span></span>
            </div>
            <span class="aura-thinking-text">Thinking & Building Mode...</span>
        `;
        contentDiv.appendChild(thinkingIndicator);

        try {
            await aiClient.loadConfig();
            
            if (activePersona.id !== 'default') {
                await aiClient.setProvider(activePersona.provider);
                await aiClient.setModel(activePersona.model);
                const p = aiClient.providers.find(p => p.id === activePersona.provider);
                if (p && activePersona.apiKey) p.key = activePersona.apiKey;
            }

            let fullResponse = '';
            await aiClient.chat(apiMessages, (chunk, full) => {
                if (thinkingIndicator) thinkingIndicator.remove();
                fullResponse = full;
                contentDiv.textContent = full;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });

            const newHistory = [...messages, { role: 'user', content: text }, { role: 'assistant', content: fullResponse }];
            await chrome.storage.local.set({ 'aura_chat_history': newHistory.slice(-20) });

        } catch (error) {
            if (thinkingIndicator) thinkingIndicator.remove();
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
    if (sendBtn) {
        sendBtn.onclick = (e) => {
            e.preventDefault();
            handleSendMessage();
        };
    }

    userInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Navigation
    const navItems = {
        'nav-settings': showSettings,
        'nav-notes': showNotes,
        'nav-training': showTraining,
        'nav-chat': () => {
            document.querySelectorAll('.aura-nav-item').forEach(i => i.classList.remove('active'));
            document.getElementById('nav-chat').classList.add('active');
        }
    };

    Object.entries(navItems).forEach(([id, func]) => {
        const el = document.getElementById(id);
        if (el) el.onclick = (e) => {
            e.preventDefault();
            func();
        };
    });

    async function showSettings() {
        await aiClient.loadConfig();
        await modelManager.loadModels();
        const provider = aiClient.getProvider();
        const model = aiClient.currentModel;
        
        const settingsHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel">
                    <h3>Configurações AURA</h3>
                    <div class="aura-setting-item">
                        <label>Persona Ativa:</label>
                        <select id="settings-persona-select">
                            ${modelManager.models.map(m => `<option value="${m.id}" ${m.id === modelManager.activeModelId ? 'selected' : ''}>${m.icon} ${m.title}</option>`).join('')}
                            <option value="new-persona">+ Criar Nova Persona</option>
                        </select>
                    </div>
                    <div class="aura-divider"></div>
                    <div class="aura-setting-item">
                        <label>Provedor:</label>
                        <select id="settings-provider-select">
                            ${aiClient.providers.map(p => `<option value="${p.id}" ${p.id === aiClient.currentProviderId ? 'selected' : ''}>${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="aura-setting-item">
                        <label>API Key:</label>
                        <input type="password" id="settings-provider-key" value="${provider.key || ''}">
                    </div>
                    <div class="aura-setting-item">
                        <label>Modelo:</label>
                        <select id="settings-model-select">
                            ${provider.models.map(m => `<option value="${m}" ${m === model ? 'selected' : ''}>${m}</option>`).join('')}
                            <option value="custom" ${!provider.models.includes(model) ? 'selected' : ''}>Custom Model ID</option>
                        </select>
                    </div>
                    <div class="aura-setting-item" id="custom-model-container" style="display: ${provider.models.includes(model) ? 'none' : 'block'};">
                        <label>Custom Model ID:</label>
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

        const providerSelect = document.getElementById('settings-provider-select');
        const modelSelect = document.getElementById('settings-model-select');
        const customModelContainer = document.getElementById('custom-model-container');

        providerSelect.onchange = async () => {
            await aiClient.setProvider(providerSelect.value);
            div.remove();
            showSettings();
        };

        modelSelect.onchange = () => {
            customModelContainer.style.display = modelSelect.value === 'custom' ? 'block' : 'none';
        };
        
        document.getElementById('settings-persona-select').onchange = async (e) => {
            if (e.target.value === 'new-persona') {
                div.remove();
                showNewPersonaPanel();
            } else {
                await modelManager.setActiveModel(e.target.value);
                const persona = modelManager.getActiveModel();
                await aiClient.setProvider(persona.provider);
                await aiClient.setModel(persona.model);
                div.remove();
                showSettings();
            }
        };
        
        document.getElementById('settings-save').onclick = async () => {
            const updatedProvider = { id: aiClient.currentProviderId, key: document.getElementById('settings-provider-key').value };
            await aiClient.saveProvider(aiClient.currentProviderId, updatedProvider);
            const finalModel = modelSelect.value === 'custom' ? document.getElementById('settings-model-id').value : modelSelect.value;
            await aiClient.setModel(finalModel);
            div.remove();
        };
        
        document.getElementById('settings-close').onclick = () => div.remove();
    }

    function showNewPersonaPanel() {
        const html = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel">
                    <h3>Criar Nova Persona</h3>
                    <div class="aura-setting-item"><label>Título:</label><input type="text" id="persona-title" placeholder="ex: Design Gemini"></div>
                    <div class="aura-setting-item"><label>Descrição:</label><textarea id="persona-desc" placeholder="Como a IA deve se comportar..."></textarea></div>
                    <div class="aura-setting-item"><label>Provedor:</label><select id="persona-provider">${aiClient.providers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
                    <div class="aura-setting-item"><label>API Key (Opcional):</label><input type="password" id="persona-key" placeholder="Vazio para usar global"></div>
                    <div class="aura-setting-item"><label>Modelo ID:</label><input type="text" id="persona-model" placeholder="ex: google/gemini-2.0-flash-exp:free"></div>
                    <div class="aura-settings-actions"><button id="persona-save">Salvar Persona</button><button id="persona-cancel">Cancelar</button></div>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);
        document.getElementById('persona-save').onclick = async () => {
            const data = { title: document.getElementById('persona-title').value, description: document.getElementById('persona-desc').value, provider: document.getElementById('persona-provider').value, apiKey: document.getElementById('persona-key').value, model: document.getElementById('persona-model').value, icon: '✨' };
            if (data.title && data.model) {
                const newPersona = await modelManager.addModel(data);
                await modelManager.setActiveModel(newPersona.id);
                div.remove();
                showSettings();
            }
        };
        document.getElementById('persona-cancel').onclick = () => div.remove();
    }

    async function showTraining() {
        await trainingManager.loadTraining();
        const trainingHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel" style="width: 400px;">
                    <h3>Treinamento AURA</h3>
                    <div class="aura-tabs" style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <button class="aura-tab-btn active" data-tab="text">Texto</button>
                        <button class="aura-tab-btn" data-tab="files">Arquivos</button>
                        <button class="aura-tab-btn" data-tab="sources">Fontes/URL</button>
                    </div>
                    <div id="training-content-area" style="max-height: 250px; overflow-y: auto; margin-bottom: 10px;"></div>
                    <div class="aura-divider"></div>
                    <div id="training-add-form"></div>
                    <button id="training-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = trainingHtml;
        document.body.appendChild(div);

        const updateTab = (tab) => {
            const contentArea = document.getElementById('training-content-area');
            const formArea = document.getElementById('training-add-form');
            const items = trainingManager.categories[tab] || [];
            contentArea.innerHTML = items.length ? items.map(item => `<div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 5px; display: flex; justify-content: space-between;"><span>${item.title || item.name}</span><button class="aura-remove-item" data-id="${item.id}" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></div>`).join('') : '<p style="font-size: 12px; color: var(--aura-text-muted);">Nenhum item adicionado.</p>';
            if (tab === 'text') {
                formArea.innerHTML = `<input type="text" id="add-title" placeholder="Título/Nome" style="width:100%; margin-bottom:5px;"><textarea id="add-content" placeholder="Cole textos, regras, instruções..." style="width:100%; height:80px;"></textarea><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Texto</button>`;
            } else if (tab === 'files') {
                formArea.innerHTML = `<input type="file" id="add-file" style="width:100%; margin-bottom:5px;"><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Arquivo</button>`;
            } else {
                formArea.innerHTML = `<input type="text" id="add-title" placeholder="Nome desta fonte" style="width:100%; margin-bottom:5px;"><textarea id="add-content" placeholder="Cole o conteúdo ou descreva a fonte..." style="width:100%; height:60px;"></textarea><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Fonte</button>`;
            }
            document.getElementById('add-btn').onclick = async () => {
                const title = document.getElementById('add-title')?.value || document.getElementById('add-file')?.files[0]?.name;
                const content = document.getElementById('add-content')?.value || "Arquivo processado";
                if (title) { await trainingManager.addItem(tab, { title, name: title, content }); updateTab(tab); }
            };
            document.querySelectorAll('.aura-remove-item').forEach(btn => { btn.onclick = async () => { await trainingManager.removeItem(tab, parseInt(btn.dataset.id)); updateTab(tab); }; });
        };

        document.querySelectorAll('.aura-tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.aura-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateTab(btn.dataset.tab);
            };
        });
        updateTab('text');
        document.getElementById('training-close').onclick = () => div.remove();
    }

    async function showNotes() {
        const notes = await notesManager.loadNotes();
        const notesHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel" style="width: 380px;">
                    <h3>Suas Notas</h3>
                    <div class="aura-notes-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
                        ${notes.length ? notes.map(n => `<div class="aura-note-item" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px;"><strong>${n.title}</strong><p style="font-size: 12px; color: var(--aura-text-muted);">${n.content.substring(0, 50)}...</p></div>`).join('') : '<p>Nenhuma nota salva.</p>'}
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
            if (title && content) { await notesManager.saveNote(title, content); div.remove(); showNotes(); }
        };
        document.getElementById('notes-close').onclick = () => div.remove();
    }
});
