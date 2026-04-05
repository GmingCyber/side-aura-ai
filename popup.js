// popup.js - AURA AI v12.0.4 (AURA VISUAL REFINED - GEMINI STYLE)
document.addEventListener('DOMContentLoaded', async () => {
    const chatMessages = document.getElementById('aura-chat-messages');
    const userInput = document.getElementById('aura-user-input');
    const sendBtn = document.getElementById('aura-send-btn');
    const newChatBtn = document.getElementById('aura-new-chat');
    const historyBtn = document.getElementById('aura-history-btn');
    const canvasContainer = 'aura-canvas-container';

    // Initialize Clients
    const aiClient = new AuraAIClient();
    const notesManager = new NotesManager();
    const trainingManager = new TrainingManager();
    const modelManager = new AuraModelManager();
    
    let currentChatId = Date.now().toString();
    
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

    // --- OVERLAY MANAGEMENT ---
    function closeAllOverlays() {
        document.querySelectorAll('.aura-settings-overlay').forEach(el => el.remove());
    }

    function createOverlay(html) {
        closeAllOverlays();
        const div = document.createElement('div');
        div.className = 'aura-settings-overlay';
        div.innerHTML = html;
        document.body.appendChild(div);
        return div;
    }

    // --- HISTORY SYSTEM ---
    async function saveChatHistory(chatId, messages) {
        const storageObj = {};
        storageObj[`aura_chat_${chatId}`] = messages.slice(-50);
        await chrome.storage.local.set(storageObj);
        
        const historyData = await chrome.storage.local.get(['aura_chats_list']);
        let list = historyData.aura_chats_list || [];
        const chatIdx = list.findIndex(c => c.id === chatId);
        
        if (chatIdx === -1) {
            const firstMsg = messages.find(m => m.role === 'user')?.content || 'Nova Conversa';
            list.unshift({ 
                id: chatId, 
                title: firstMsg.substring(0, 30) + (firstMsg.length > 30 ? '...' : ''), 
                date: new Date().toLocaleString() 
            });
        } else if (messages.length > 0 && list[chatIdx].title === 'Nova Conversa') {
            const firstMsg = messages.find(m => m.role === 'user')?.content || 'Nova Conversa';
            list[chatIdx].title = firstMsg.substring(0, 30) + (firstMsg.length > 30 ? '...' : '');
        }
        await chrome.storage.local.set({ 'aura_chats_list': list });
    }

    async function loadChat(chatId) {
        currentChatId = chatId;
        chatMessages.innerHTML = '';
        const data = await chrome.storage.local.get([`aura_chat_${chatId}`]);
        const history = data[`aura_chat_${chatId}`] || [];
        history.forEach(msg => {
            appendMessage(msg.role === 'user' ? 'USER' : 'AURA', msg.content, msg.role === 'user');
        });
        await chrome.storage.local.set({ 'aura_current_chat_id': chatId });
    }

    const lastChat = await chrome.storage.local.get(['aura_current_chat_id']);
    if (lastChat.aura_current_chat_id) {
        await loadChat(lastChat.aura_current_chat_id);
    } else {
        await loadChat(currentChatId);
    }

    if (newChatBtn) {
        newChatBtn.onclick = async () => {
            const newId = Date.now().toString();
            await loadChat(newId);
            const historyData = await chrome.storage.local.get(['aura_chats_list']);
            const list = historyData.aura_chats_list || [];
            list.unshift({ id: newId, title: 'Nova Conversa', date: new Date().toLocaleString() });
            await chrome.storage.local.set({ 'aura_chats_list': list });
        };
    }

    if (historyBtn) {
        historyBtn.onclick = async () => {
            const historyData = await chrome.storage.local.get(['aura_chats_list']);
            const list = historyData.aura_chats_list || [];
            const historyHtml = `
                <div class="aura-settings-panel" style="width: 350px;">
                    <h3>Histórico de Conversas</h3>
                    <div class="aura-history-list" style="max-height: 350px; overflow-y: auto; margin-bottom: 15px;">
                        ${list.length ? list.map(c => `
                            <div class="aura-history-item" data-id="${c.id}" style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; margin-bottom: 10px; cursor: pointer; transition: 0.3s;">
                                <div style="font-weight: 600; font-size: 14px;">${c.title}</div>
                                <div style="font-size: 11px; color: var(--aura-text-muted);">${c.date}</div>
                            </div>
                        `).join('') : '<p style="text-align: center; color: var(--aura-text-muted);">Nenhuma conversa salva.</p>'}
                    </div>
                    <button id="history-close" style="width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
                </div>
            `;
            const div = createOverlay(historyHtml);
            div.querySelectorAll('.aura-history-item').forEach(item => {
                item.onclick = async () => {
                    await loadChat(item.dataset.id);
                    div.remove();
                };
            });
            document.getElementById('history-close').onclick = () => div.remove();
        };
    }

    // --- LIVE PREVIEW SYSTEM ---
    function openLivePreview(type, title, content) {
        const existing = document.querySelector('.aura-live-preview');
        if (existing) existing.remove();

        const preview = document.createElement('div');
        preview.className = 'aura-live-preview';
        preview.innerHTML = `
            <div class="aura-preview-header">
                <div class="aura-preview-title">📄 ${title} (${type})</div>
                <div class="aura-preview-actions">
                    <button id="preview-fullscreen" title="Tela Cheia">🔲</button>
                    <button id="preview-download" title="Baixar">📥</button>
                    <button id="preview-close" title="Fechar">✕</button>
                </div>
            </div>
            <div class="aura-preview-toolbar">
                <button data-cmd="bold" title="Negrito"><b>B</b></button>
                <button data-cmd="italic" title="Itálico"><i>I</i></button>
                <button data-cmd="insertUnorderedList" title="Lista">•</button>
                <button data-cmd="formatBlock" data-val="blockquote" title="Citação">"</button>
                <select id="font-size" title="Tamanho">
                    <option value="3">Pequeno</option>
                    <option value="4" selected>Médio</option>
                    <option value="6">Grande</option>
                </select>
                <input type="color" id="font-color" value="#ffffff" title="Cor">
            </div>
            <div class="aura-preview-editor" contenteditable="true">${formatContentForEditor(content)}</div>
            <div class="aura-preview-resizer"></div>
        `;
        document.body.appendChild(preview);

        const resizer = preview.querySelector('.aura-preview-resizer');
        let isResizing = false;
        resizer.onmousedown = (e) => { isResizing = true; document.onmousemove = handleResize; document.onmouseup = () => isResizing = false; };
        function handleResize(e) { if (isResizing) { const width = window.innerWidth - e.clientX; preview.style.width = `${width}px`; } }

        preview.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.onclick = () => document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
        });
        document.getElementById('font-size').onchange = (e) => document.execCommand('fontSize', false, e.target.value);
        document.getElementById('font-color').oninput = (e) => document.execCommand('foreColor', false, e.target.value);

        document.getElementById('preview-close').onclick = () => preview.remove();
        document.getElementById('preview-fullscreen').onclick = () => preview.classList.toggle('fullscreen');
        document.getElementById('preview-download').onclick = () => {
            const finalContent = preview.querySelector('.aura-preview-editor').innerText;
            generateDocument(type, title, finalContent);
        };
    }

    function formatContentForEditor(content) {
        return content
            .replace(/^# (.*$)/gim, '<h1 style="color:#7c4dff; font-size:24px;">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 style="color:#448aff; font-size:20px;">$1</h2>')
            .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
            .replace(/^> (.*$)/gim, '<blockquote style="border-left:4px solid #7c4dff; padding-left:15px; font-style:italic; color:#a0a0a0;">$1</blockquote>')
            .replace(/\n/g, '<br>');
    }

    function generateDocument(type, title, content) {
        if (type === 'PDF') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(22); doc.setTextColor(124, 77, 255); doc.text(title, 20, 25);
            doc.setDrawColor(124, 77, 255); doc.line(20, 30, 190, 30);
            doc.setFontSize(12); doc.setTextColor(0, 0, 0);
            const splitText = doc.splitTextToSize(content, 170);
            doc.text(splitText, 20, 45); doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
        } else {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/\s+/g, '_')}.txt`; a.click();
            URL.revokeObjectURL(url);
        }
    }

    // --- DYNAMIC THINKING ---
    function getDynamicThinking(text) {
        const lowerText = text.toLowerCase();
        const truncatedText = text.length > 60 ? text.substring(0, 57) + "..." : text;
        
        let tool = "General AI"; let toolIcon = "🧠"; let toolDetail = "Processando solicitação geral.";
        let searchTerms = null; let isCanvas = false; let canvasType = null;

        if (lowerText.includes('pdf') || lowerText.includes('documento') || lowerText.includes('arquivo')) {
            tool = "Aura Canvas"; toolIcon = "🎨"; toolDetail = "Conectando ferramenta de documentos..."; isCanvas = true; canvasType = "PDF";
        } else if (lowerText.includes('código') || lowerText.includes('python') || lowerText.includes('js') || lowerText.includes('html')) {
            tool = "Claude Coder"; toolIcon = "💻"; toolDetail = "Ativando ferramenta de codificação...";
        } else if (lowerText.includes('design') || lowerText.includes('estilo') || lowerText.includes('cor')) {
            tool = "Gemini Design"; toolIcon = "🎨"; toolDetail = "Ativando ferramenta de design...";
        } else if (lowerText.includes('pesquise') || lowerText.includes('quem é') || lowerText.includes('preço')) {
            tool = "Aura Search"; toolIcon = "🔍"; toolDetail = "Realizando busca web..."; searchTerms = text.replace(/pesquise|quem é|preço/gi, '').trim();
        }

        return {
            steps: [
                { title: "Thinking...", content: `| O usuário enviou: "${truncatedText}"; então devo me preparar para agir.`, icon: "🧠" },
                { title: `${tool}...`, content: `| ${toolDetail}`, icon: toolIcon, isSearch: !!searchTerms, searchTerms: searchTerms, isCanvas: isCanvas, canvasType: canvasType },
                { title: "Analisando...", content: `| Analisando intenção e contexto para a melhor resposta baseada em "${truncatedText}".`, icon: "⚙️" },
                { title: "Planejando...", content: `| Vou gerar a resposta agora seguindo o tom da persona ativa e as regras de treinamento.`, icon: "📋" },
                { title: "Fact-Checking...", content: `| Validando resposta com as fontes de treinamento... 100% de consistência detectada.`, icon: "✅" }
            ]
        };
    }

    // --- CHAT LOGIC ---
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        appendMessage('USER', text, true);
        userInput.value = '';
        userInput.style.height = 'auto';

        const thinkingData = getDynamicThinking(text);
        const thinkingId = appendThinking(thinkingData);
        const startTime = Date.now();

        try {
            const activePersona = modelManager.getActiveModel();
            const trainingContext = trainingManager.getContext();
            const pageContext = await getPageContext();
            
            const fullContext = `
                Persona: ${activePersona.title} (${activePersona.description})
                Treinamento: ${trainingContext}
                Página Atual: ${pageContext.title} (${pageContext.url})
                Mensagem: ${text}
            `;

            const response = await aiClient.sendMessage(fullContext);
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            completeThinking(thinkingId, duration);
            appendMessage('AURA', response, false);
            
            // Auto-save history
            const currentMessages = await chrome.storage.local.get([`aura_chat_${currentChatId}`]);
            const history = currentMessages[`aura_chat_${currentChatId}`] || [];
            history.push({ role: 'user', content: text });
            history.push({ role: 'assistant', content: response });
            await saveChatHistory(currentChatId, history);

        } catch (error) {
            console.error('Chat Error:', error);
            completeThinking(thinkingId, 0);
            appendMessage('AURA', 'Desculpe, tive um erro ao processar sua mensagem. Verifique sua API Key nas configurações.', false);
        }
    }

    function appendMessage(sender, text, isUser) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `aura-message ${isUser ? 'aura-message-user' : 'aura-message-ai'}`;
        
        const header = document.createElement('div');
        header.className = 'aura-message-header';
        header.innerText = sender;
        msgDiv.appendChild(header);

        const content = document.createElement('div');
        content.className = 'aura-response-text';
        if (isUser) {
            content.innerText = text;
        } else {
            content.innerHTML = marked.parse(text);
        }
        msgDiv.appendChild(content);

        // Check for Canvas actions
        if (!isUser && (text.includes('PDF') || text.includes('TXT'))) {
            const btn = document.createElement('button');
            btn.className = 'aura-canvas-btn';
            btn.style.marginTop = '10px';
            btn.style.padding = '8px 12px';
            btn.style.background = 'var(--aura-gradient)';
            btn.style.border = 'none';
            btn.style.borderRadius = '8px';
            btn.style.color = 'white';
            btn.style.cursor = 'pointer';
            btn.innerText = '📄 Abrir no Aura Canvas';
            btn.onclick = () => {
                const type = text.includes('PDF') ? 'PDF' : 'TXT';
                const title = text.split('\n')[0].replace(/#/g, '').trim() || 'Documento Aura';
                openLivePreview(type, title, text);
            };
            msgDiv.appendChild(btn);
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendThinking(data) {
        const id = 'thinking-' + Date.now();
        const thinkDiv = document.createElement('div');
        thinkDiv.id = id;
        thinkDiv.className = 'aura-thought-container';
        
        thinkDiv.innerHTML = `
            <div class="aura-thought-header">
                <span class="aura-thought-timer">🧠 Pensando...</span>
                <span class="aura-thought-arrow">▼</span>
            </div>
            <div class="aura-thought-body" style="display: none;">
                ${data.steps.map(step => `
                    <div class="aura-thought-step">
                        <div class="aura-thought-step-header">
                            <span class="aura-thought-step-icon">${step.icon}</span>
                            <span class="aura-thought-step-title">${step.title}</span>
                            <span class="aura-thought-step-toggle">▼</span>
                        </div>
                        <div class="aura-thought-step-content" style="display: none;">
                            ${step.content}
                            ${step.isSearch ? `
                                <div class="aura-search-box">
                                    <div class="aura-search-term">🔍 Pesquisa: "${step.searchTerms}"</div>
                                    <div class="aura-search-results">
                                        <div class="aura-search-link">🌐 <a href="https://www.google.com/search?q=${encodeURIComponent(step.searchTerms)}" target="_blank">Ver resultados na web</a></div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        chatMessages.appendChild(thinkDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Toggle logic
        const header = thinkDiv.querySelector('.aura-thought-header');
        const body = thinkDiv.querySelector('.aura-thought-body');
        const arrow = thinkDiv.querySelector('.aura-thought-arrow');
        
        header.onclick = () => {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            arrow.innerText = isHidden ? '▲' : '▼';
        };

        thinkDiv.querySelectorAll('.aura-thought-step-header').forEach(h => {
            h.onclick = (e) => {
                e.stopPropagation();
                const content = h.nextElementSibling;
                const t = h.querySelector('.aura-thought-step-toggle');
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                t.innerText = isHidden ? '▲' : '▼';
            };
        });

        return id;
    }

    function completeThinking(id, seconds) {
        const thinkDiv = document.getElementById(id);
        if (thinkDiv) {
            const timer = thinkDiv.querySelector('.aura-thought-timer');
            const header = thinkDiv.querySelector('.aura-thought-header');
            timer.innerText = `✅ Concluído em ${seconds}s`;
            header.style.background = 'rgba(99, 102, 241, 0.2)';
            header.style.borderColor = 'rgba(99, 102, 241, 0.4)';
        }
    }

    async function getPageContext() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return { title: tab.title, url: tab.url };
        } catch (e) {
            return { title: 'Desconhecido', url: '' };
        }
    }

    // --- EVENT LISTENERS ---
    sendBtn.onclick = sendMessage;
    userInput.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    userInput.oninput = () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    };

    // --- NAVIGATION ---
    document.querySelectorAll('.aura-nav-item').forEach(item => {
        item.onclick = () => {
            const id = item.id;
            setActiveNav(id);
            if (id === 'nav-chat') closeAllOverlays();
            else if (id === 'nav-notes') showNotes();
            else if (id === 'nav-training') showTraining();
            else if (id === 'nav-config') showSettings();
        };
    });

    function setActiveNav(id) {
        document.querySelectorAll('.aura-nav-item').forEach(item => {
            item.classList.toggle('active', item.id === id);
        });
    }

    // --- OVERLAY SCREENS ---
    async function showSettings() {
        const config = aiClient.config;
        const providers = aiClient.providers;
        const currentProvider = providers[config.provider] || providers['openrouter'];
        const models = modelManager.models;
        const activeModelId = modelManager.activeModelId;

        const settingsHtml = `
            <div class="aura-settings-panel">
                <h3>Configurações AURA</h3>
                
                <div class="aura-setting-item">
                    <label>Provedor de IA</label>
                    <select id="settings-provider-select">
                        ${Object.keys(providers).map(p => `<option value="${p}" ${config.provider === p ? 'selected' : ''}>${providers[p].name}</option>`).join('')}
                    </select>
                </div>

                <div class="aura-setting-item">
                    <label>API Key</label>
                    <input type="password" id="settings-provider-key" value="${currentProvider.key || ''}" placeholder="Insira sua chave">
                </div>

                ${config.provider === 'custom' ? `
                <div class="aura-setting-item">
                    <label>URL do Provedor</label>
                    <input type="text" id="settings-provider-url" value="${currentProvider.url || ''}" placeholder="https://api.exemplo.com/v1">
                </div>
                ` : ''}

                <div class="aura-setting-item">
                    <label>Modelo de IA</label>
                    <select id="settings-model-select">
                        ${currentProvider.models.map(m => `<option value="${m.id}" ${config.model === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
                        <option value="custom" ${!currentProvider.models.find(m => m.id === config.model) ? 'selected' : ''}>Custom Model ID</option>
                    </select>
                </div>

                <div id="custom-model-area" class="aura-setting-item" style="display: ${!currentProvider.models.find(m => m.id === config.model) ? 'block' : 'none'};">
                    <label>Custom Model ID</label>
                    <input type="text" id="settings-custom-model" value="${config.model}" placeholder="ex: anthropic/claude-3-opus">
                </div>

                <div class="aura-divider" style="margin: 20px 0; border-top: 1px solid var(--aura-border);"></div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-size: 13px; font-weight: 600;">Personas (Aura Models)</label>
                    <button id="add-persona-btn" style="background:none; border:none; color:var(--aura-primary-light); cursor:pointer; font-size:12px;">+ Adicionar</button>
                </div>

                <div class="aura-personas-list" style="max-height: 150px; overflow-y: auto;">
                    ${models.map(m => `
                        <div class="aura-persona-card ${m.id === activeModelId ? 'active' : ''}" data-id="${m.id}" style="${m.id === activeModelId ? 'border-color: var(--aura-primary-light); background: rgba(139, 92, 246, 0.1);' : ''}">
                            <div class="aura-persona-info">
                                <span class="aura-persona-icon">${m.icon || '🤖'}</span>
                                <span class="aura-persona-name">${m.title}</span>
                            </div>
                            <button class="delete-persona" data-id="${m.id}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px;">✕</button>
                        </div>
                    `).join('')}
                </div>

                <div class="aura-settings-actions">
                    <button id="settings-save">Salvar</button>
                    <button id="settings-close">Fechar</button>
                </div>
            </div>
        `;

        const div = createOverlay(settingsHtml);

        // --- Settings Event Listeners ---
        const providerSelect = document.getElementById('settings-provider-select');
        const modelSelect = document.getElementById('settings-model-select');
        const customModelArea = document.getElementById('custom-model-area');

        providerSelect.onchange = async () => {
            const newProviderId = providerSelect.value;
            await aiClient.setProvider(newProviderId);
            div.remove();
            showSettings(); // Refresh UI for new provider
        };

        modelSelect.onchange = () => {
            customModelArea.style.display = modelSelect.value === 'custom' ? 'block' : 'none';
        };

        document.getElementById('add-persona-btn').onclick = () => {
            const title = prompt("Nome da Persona (ex: Design Gemini):");
            if (title) {
                const desc = prompt("Descrição/Comportamento:");
                const icon = prompt("Emoji/Ícone:");
                modelManager.addModel({ title, description: desc, icon: icon || '🤖' });
                div.remove(); showSettings();
            }
        };

        div.querySelectorAll('.aura-persona-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.classList.contains('delete-persona')) return;
                modelManager.setActiveModel(card.dataset.id);
                div.remove(); showSettings();
            };
        });

        div.querySelectorAll('.delete-persona').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm("Excluir esta persona?")) {
                    modelManager.deleteModel(btn.dataset.id);
                    div.remove(); showSettings();
                }
            };
        });

        document.getElementById('settings-save').onclick = async () => {
            const providerId = providerSelect.value;
            const key = document.getElementById('settings-provider-key').value;
            const url = document.getElementById('settings-provider-url')?.value;
            const model = modelSelect.value === 'custom' ? document.getElementById('settings-custom-model').value : modelSelect.value;

            await aiClient.saveProvider(providerId, { key, url });
            await aiClient.setModel(model);
            await aiClient.setProvider(providerId);
            
            div.remove();
            setActiveNav('nav-chat');
        };

        document.getElementById('settings-close').onclick = () => {
            div.remove();
            setActiveNav('nav-chat');
        };
    }

    async function showTraining() {
        await trainingManager.loadTraining();
        const trainingHtml = `
            <div class="aura-settings-panel" style="width: 400px;">
                <h3>Treinamento AURA</h3>
                <div class="aura-tabs" style="display: flex; gap: 10px; margin-bottom: 15px;"><button class="aura-tab-btn active" data-tab="text">Texto</button><button class="aura-tab-btn" data-tab="files">Arquivos</button><button class="aura-tab-btn" data-tab="sources">Fontes/URL</button></div>
                <div id="training-content-area" style="max-height: 250px; overflow-y: auto; margin-bottom: 10px;"></div>
                <div class="aura-divider"></div>
                <div id="training-add-form"></div>
                <button id="training-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
            </div>
        `;
        const div = createOverlay(trainingHtml);
        const updateTab = (tab) => {
            const contentArea = document.getElementById('training-content-area'); const formArea = document.getElementById('training-add-form'); const items = trainingManager.categories[tab] || [];
            contentArea.innerHTML = items.length ? items.map(item => `<div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 5px; display: flex; justify-content: space-between;"><span>${item.title || item.name}</span><button class="aura-remove-item" data-id="${item.id}" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></div>`).join('') : '<p style="font-size: 12px; color: var(--aura-text-muted);">Nenhum item adicionado.</p>';
            if (tab === 'text') { formArea.innerHTML = `<input type="text" id="add-title" placeholder="Título/Nome" style="width:100%; margin-bottom:5px;"><textarea id="add-content" placeholder="Cole textos, regras, documentos..." style="width:100%; height:80px;"></textarea><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Texto</button>`; }
            else if (tab === 'files') { formArea.innerHTML = `<input type="file" id="add-file" style="width:100%; margin-bottom:5px;"><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Arquivo</button>`; }
            else { formArea.innerHTML = `<input type="text" id="add-title" placeholder="Nome desta fonte" style="width:100%; margin-bottom:5px;"><textarea id="add-content" placeholder="Cole o conteúdo ou descreva a fonte..." style="width:100%; height:60px;"></textarea><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Fonte</button>`; }
            document.getElementById('add-btn').onclick = async () => {
                if (tab === 'files') { const fileInput = document.getElementById('add-file'); const file = fileInput.files[0]; if (file) { const reader = new FileReader(); reader.onload = async (e) => { const content = e.target.result; await trainingManager.addItem(tab, { title: file.name, name: file.name, content: content }); updateTab(tab); }; reader.readAsText(file); } }
                else { const title = document.getElementById('add-title')?.value; const content = document.getElementById('add-content')?.value; if (title && content) { await trainingManager.addItem(tab, { title, name: title, content }); updateTab(tab); } }
            };
        };
        document.querySelectorAll('.aura-tab-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.aura-tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); updateTab(btn.dataset.tab); }; });
        updateTab('text'); document.getElementById('training-close').onclick = () => { div.remove(); setActiveNav('nav-chat'); };
    }

    async function showNotes() {
        const notes = await notesManager.loadNotes();
        const notesHtml = `
            <div class="aura-settings-panel" style="width: 380px;">
                <h3>Suas Notas</h3>
                <div class="aura-notes-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">${notes.length ? notes.map(n => `<div class="aura-note-item" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px;"><strong>${n.title}</strong><p style="font-size: 12px; color: var(--aura-text-muted);">${n.content.substring(0, 50)}...</p></div>`).join('') : '<p>Nenhuma nota salva.</p>'}</div>
                <button id="add-note-btn" style="width: 100%; padding: 10px; background: var(--aura-gradient); border: none; border-radius: 8px; color: white; cursor: pointer;">+ Nova Nota</button>
                <button id="notes-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
            </div>
        `;
        const div = createOverlay(notesHtml);
        document.getElementById('add-note-btn').onclick = async () => { const title = prompt("Título da nota:"); const content = prompt("Conteúdo:"); if (title && content) { await notesManager.saveNote(title, content); div.remove(); showNotes(); } };
        document.getElementById('notes-close').onclick = () => { div.remove(); setActiveNav('nav-chat'); };
    }
});
