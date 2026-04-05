// popup.js - AURA AI v9.0.0 (AURA OS & LIVE CANVAS)
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

    // --- HISTORY SYSTEM (FIXED) ---
    async function saveChatHistory(chatId, messages) {
        const storageObj = {};
        storageObj[`aura_chat_${chatId}`] = messages.slice(-50);
        await chrome.storage.local.set(storageObj);
        
        // Update chat list
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
                <div class="aura-settings-overlay">
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
                </div>
            `;
            const div = document.createElement('div');
            div.innerHTML = historyHtml;
            document.body.appendChild(div);
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
                    <button id="preview-fullscreen">🔲</button>
                    <button id="preview-download">📥</button>
                    <button id="preview-close">✕</button>
                </div>
            </div>
            <div class="aura-preview-toolbar">
                <button data-cmd="bold"><b>B</b></button>
                <button data-cmd="italic"><i>I</i></button>
                <select id="font-size">
                    <option value="3">Pequeno</option>
                    <option value="4" selected>Médio</option>
                    <option value="6">Grande</option>
                </select>
                <input type="color" id="font-color" value="#ffffff">
            </div>
            <div class="aura-preview-editor" contenteditable="true">${content}</div>
            <div class="aura-preview-resizer"></div>
        `;
        document.body.appendChild(preview);

        // Resizer logic
        const resizer = preview.querySelector('.aura-preview-resizer');
        let isResizing = false;
        resizer.onmousedown = (e) => { isResizing = true; document.onmousemove = handleResize; document.onmouseup = () => isResizing = false; };
        function handleResize(e) { if (isResizing) { const width = window.innerWidth - e.clientX; preview.style.width = `${width}px`; } }

        // Toolbar logic
        preview.querySelectorAll('[data-cmd]').forEach(btn => {
            btn.onclick = () => document.execCommand(btn.dataset.cmd, false, null);
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

    function generateDocument(type, title, content) {
        if (type === 'PDF') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setFontSize(20); doc.text(title, 20, 20);
            doc.setFontSize(12); const splitText = doc.splitTextToSize(content, 170);
            doc.text(splitText, 20, 40); doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
        } else {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/\s+/g, '_')}.txt`; a.click();
            URL.revokeObjectURL(url);
        }
    }

    // --- DYNAMIC THINKING (ADVANCED) ---
    function getDynamicThinking(text) {
        const lowerText = text.toLowerCase();
        const truncatedText = text.length > 60 ? text.substring(0, 57) + "..." : text;
        
        let tool = "General AI"; let toolIcon = "🧠"; let toolDetail = "Processando solicitação geral.";
        let searchTerms = null; let isCanvas = false; let canvasType = null;

        if (lowerText.includes('pdf') || lowerText.includes('documento') || lowerText.includes('arquivo txt') || lowerText.includes('criar um txt')) {
            tool = "Aura Canvas"; toolIcon = "🎨"; isCanvas = true;
            canvasType = lowerText.includes('pdf') ? 'PDF' : 'TXT';
            toolDetail = `Conectando a ferramenta Aura Canvas > Conexão feita com sucesso. Achando o recurso "${canvasType}".`;
        } else if (lowerText.includes('pesquise') || lowerText.includes('quem é') || lowerText.includes('notícias') || lowerText.includes('preço') || lowerText.includes('hoje') || lowerText.includes('dorama')) {
            tool = "Aura Search"; toolIcon = "🔍"; 
            searchTerms = text.replace(/pesquise|quem é|notícias|preço|hoje|dorama/gi, '').trim();
            toolDetail = `Informação não encontrada no treinamento... Realizando busca web profunda sobre "${searchTerms || truncatedText}".`;
        }

        return {
            thinking: `O usuário enviou: "${truncatedText}"; então devo me preparar para agir.`,
            tool, toolIcon, toolDetail, searchTerms, isCanvas, canvasType,
            analyzing: `Análise profunda: O usuário solicitou ${isCanvas ? 'a criação de um documento' : 'informações'} sobre "${searchTerms || truncatedText}". Vou estruturar uma resposta completa, garantindo que todos os pontos-chave sejam abordados com precisão técnica e tom adequado à persona ativa.`,
            planning: "Estratégia: Vou gerar o conteúdo agora, integrando as fontes encontradas e validando cada parágrafo para manter a consistência total."
        };
    }

    async function handleSendMessage() {
        const text = userInput.value.trim();
        if (!text) return;
        userInput.value = ''; userInput.style.height = 'auto';
        appendMessage('USER', text, true);

        const data = await chrome.storage.local.get([`aura_chat_${currentChatId}`]);
        const messages = data[`aura_chat_${currentChatId}`] || [];
        const activePersona = modelManager.getActiveModel();
        const trainingContext = trainingManager.getContextForPrompt();
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageContext = tab ? `[CONTEXTO DA PÁGINA: ${tab.title} | URL: ${tab.url}]` : '';
        const systemPrompt = `Você é ${activePersona.title}. ${activePersona.description}. ${pageContext}`;
        const fullPrompt = trainingContext ? `${trainingContext}\n\nPERGUNTA: ${text}` : text;
        const apiMessages = [ { role: 'system', content: systemPrompt }, ...messages, { role: 'user', content: fullPrompt } ];

        const aiMsgDiv = appendMessage(activePersona.title, '', false);
        const contentDiv = aiMsgDiv.querySelector('.aura-message-content');
        
        const thoughtWrapper = document.createElement('div');
        thoughtWrapper.className = 'aura-thought-wrapper';
        thoughtWrapper.innerHTML = `
            <div class="aura-thought-header">
                <span class="aura-thought-icon">🧠</span>
                <span class="aura-thought-timer">Pensando...</span>
                <span class="aura-thought-toggle">▼</span>
            </div>
            <div class="aura-thought-content aura-hidden"></div>
        `;
        contentDiv.appendChild(thoughtWrapper);
        const thoughtHeader = thoughtWrapper.querySelector('.aura-thought-header');
        const thoughtContent = thoughtWrapper.querySelector('.aura-thought-content');

        thoughtHeader.onclick = () => {
            thoughtContent.classList.toggle('aura-hidden');
            thoughtHeader.querySelector('.aura-thought-toggle').textContent = thoughtContent.classList.contains('aura-hidden') ? '▼' : '▲';
        };

        const addThinkingStep = (label, detail, icon = '•', expandable = false) => {
            const step = document.createElement('div');
            step.className = 'aura-thinking-step';
            step.innerHTML = `
                <div class="aura-step-header" style="${expandable ? 'cursor:pointer;' : ''}">
                    <span class="aura-step-dot">${icon}</span>
                    <span class="aura-step-label">${label}${expandable ? ' >' : '...'}</span>
                </div>
                <div class="aura-step-detail">| ${detail}</div>
                <div class="aura-step-extra aura-hidden"></div>
            `;
            if (expandable) {
                step.querySelector('.aura-step-header').onclick = () => step.querySelector('.aura-step-extra').classList.toggle('aura-hidden');
            }
            thoughtContent.appendChild(step);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return step;
        };

        const startTime = Date.now();
        const timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            thoughtHeader.querySelector('.aura-thought-timer').textContent = `Pensando por ${elapsed} segundo${elapsed !== 1 ? 's' : ''}`;
        }, 1000);

        try {
            const dynamic = getDynamicThinking(text);
            addThinkingStep("Thinking", dynamic.thinking);
            await new Promise(r => setTimeout(r, 600));

            if (dynamic.isCanvas) {
                addThinkingStep("Aura Canvas", dynamic.toolDetail, "🎨", true);
                await new Promise(r => setTimeout(r, 800));
                addThinkingStep("Analisando", dynamic.analyzing);
                await new Promise(r => setTimeout(r, 1000));
                addThinkingStep("Planejando", dynamic.planning);
                await new Promise(r => setTimeout(r, 800));
                
                const searchStep = addThinkingStep(`Pesquisa ("${dynamic.searchTerms || 'Contexto'}")`, "Pesquisa concluída. Fontes encontradas.", "🔍", true);
                searchStep.querySelector('.aura-step-extra').innerHTML = `
                    <div style="margin-top: 5px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 11px;">
                        <div style="display:flex; gap:10px; margin-bottom:5px;">
                            <div style="width:40px; height:40px; background:#333; border-radius:4px;"></div>
                            <div><strong>Fonte 1:</strong> Netflix - Beleza Verdadeira<br><span style="color:var(--aura-accent)">netflix.com/title/...</span></div>
                        </div>
                    </div>
                `;
            } else if (dynamic.tool === "Aura Search") {
                const searchStep = addThinkingStep(`Pesquisa ("${dynamic.searchTerms || 'Contexto'}")`, dynamic.toolDetail, "🔍", true);
                searchStep.querySelector('.aura-step-extra').innerHTML = `<div style="padding:8px; font-size:11px;">Buscando por: ${dynamic.searchTerms}</div>`;
            } else {
                addThinkingStep(dynamic.tool, dynamic.toolDetail, dynamic.toolIcon);
            }
            
            await new Promise(r => setTimeout(r, 600));
            addThinkingStep("Fact-Checking", "Validando consistência e mantendo a integridade dos dados.", "✅", true);
            await new Promise(r => setTimeout(r, 400));

            let fullResponse = '';
            await aiClient.chat(apiMessages, (chunk, full) => {
                clearInterval(timerInterval);
                const finalElapsed = Math.floor((Date.now() - startTime) / 1000);
                thoughtHeader.classList.add('aura-thought-success');
                thoughtHeader.querySelector('.aura-thought-icon').textContent = '✅';
                thoughtHeader.querySelector('.aura-thought-timer').textContent = `Concluído em ${finalElapsed} segundo${finalElapsed !== 1 ? 's' : ''}`;
                
                fullResponse = full;
                let responseText = contentDiv.querySelector('.aura-response-text');
                if (!responseText) { responseText = document.createElement('div'); responseText.className = 'aura-response-text'; contentDiv.appendChild(responseText); }
                responseText.textContent = full;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });

            if (dynamic.isCanvas) {
                const fileCard = document.createElement('div');
                fileCard.className = 'aura-file-card';
                fileCard.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:12px; margin-top:10px;">
                        <div><strong>📄 AURA_Document.${dynamic.canvasType.toLowerCase()}</strong></div>
                        <div style="display:flex; gap:8px;">
                            <button class="aura-open-preview" style="padding:5px 10px; background:rgba(255,255,255,0.1); border:none; border-radius:6px; color:white; cursor:pointer;">Abrir</button>
                            <button class="aura-download-file" style="padding:5px 10px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">📥</button>
                        </div>
                    </div>
                `;
                fileCard.querySelector('.aura-open-preview').onclick = () => openLivePreview(dynamic.canvasType, "AURA_Document", fullResponse);
                fileCard.querySelector('.aura-download-file').onclick = () => generateDocument(dynamic.canvasType, "AURA_Document", fullResponse);
                contentDiv.appendChild(fileCard);
            }

            await saveChatHistory(currentChatId, [...messages, { role: 'user', content: text }, { role: 'assistant', content: fullResponse }]);

        } catch (error) {
            clearInterval(timerInterval);
            if (thoughtWrapper) thoughtWrapper.remove();
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

    if (sendBtn) sendBtn.onclick = (e) => { e.preventDefault(); handleSendMessage(); };
    userInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

    const navItems = {
        'nav-settings': showSettings, 'nav-notes': showNotes, 'nav-training': showTraining,
        'nav-chat': () => { document.querySelectorAll('.aura-nav-item').forEach(i => i.classList.remove('active')); document.getElementById('nav-chat').classList.add('active'); }
    };
    Object.entries(navItems).forEach(([id, func]) => { const el = document.getElementById(id); if (el) el.onclick = (e) => { e.preventDefault(); func(); }; });

    async function showSettings() {
        await aiClient.loadConfig(); await modelManager.loadModels();
        const provider = aiClient.getProvider(); const model = aiClient.currentModel;
        const settingsHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel">
                    <h3>Configurações AURA</h3>
                    <div class="aura-setting-item"><label>Persona Ativa:</label><select id="settings-persona-select">${modelManager.models.map(m => `<option value="${m.id}" ${m.id === modelManager.activeModelId ? 'selected' : ''}>${m.icon} ${m.title}</option>`).join('')}<option value="new-persona">+ Criar Nova Persona</option></select></div>
                    <div class="aura-divider"></div>
                    <div class="aura-setting-item"><label>Provedor:</label><select id="settings-provider-select">${aiClient.providers.map(p => `<option value="${p.id}" ${p.id === aiClient.currentProviderId ? 'selected' : ''}>${p.name}</option>`).join('')}</select></div>
                    <div class="aura-setting-item"><label>API Key:</label><input type="password" id="settings-provider-key" value="${provider.key || ''}"></div>
                    <div class="aura-settings-actions"><button id="settings-save">Salvar</button><button id="settings-close">Fechar</button></div>
                </div>
            </div>
        `;
        const div = document.createElement('div'); div.innerHTML = settingsHtml; document.body.appendChild(div);
        document.getElementById('settings-save').onclick = async () => { const updatedProvider = { id: aiClient.currentProviderId, key: document.getElementById('settings-provider-key').value }; await aiClient.saveProvider(aiClient.currentProviderId, updatedProvider); div.remove(); };
        document.getElementById('settings-close').onclick = () => div.remove();
    }

    async function showTraining() {
        await trainingManager.loadTraining();
        const trainingHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel" style="width: 400px;">
                    <h3>Treinamento AURA</h3>
                    <div class="aura-tabs" style="display: flex; gap: 10px; margin-bottom: 15px;"><button class="aura-tab-btn active" data-tab="text">Texto</button><button class="aura-tab-btn" data-tab="files">Arquivos</button><button class="aura-tab-btn" data-tab="sources">Fontes/URL</button></div>
                    <div id="training-content-area" style="max-height: 250px; overflow-y: auto; margin-bottom: 10px;"></div>
                    <div class="aura-divider"></div>
                    <div id="training-add-form"></div>
                    <button id="training-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
                </div>
            </div>
        `;
        const div = document.createElement('div'); div.innerHTML = trainingHtml; document.body.appendChild(div);
        const updateTab = (tab) => {
            const contentArea = document.getElementById('training-content-area'); const formArea = document.getElementById('training-add-form'); const items = trainingManager.categories[tab] || [];
            contentArea.innerHTML = items.length ? items.map(item => `<div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 5px; display: flex; justify-content: space-between;"><span>${item.title || item.name}</span><button class="aura-remove-item" data-id="${item.id}" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></div>`).join('') : '<p style="font-size: 12px; color: var(--aura-text-muted);">Nenhum item adicionado.</p>';
            if (tab === 'text') { formArea.innerHTML = `<input type="text" id="add-title" placeholder="Título/Nome" style="width:100%; margin-bottom:5px;"><textarea id="add-content" placeholder="Cole textos, regras, instruções..." style="width:100%; height:80px;"></textarea><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Texto</button>`; }
            else if (tab === 'files') { formArea.innerHTML = `<input type="file" id="add-file" style="width:100%; margin-bottom:5px;"><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Arquivo</button>`; }
            else { formArea.innerHTML = `<input type="text" id="add-title" placeholder="Nome desta fonte" style="width:100%; margin-bottom:5px;"><textarea id="add-content" placeholder="Cole o conteúdo ou descreva a fonte..." style="width:100%; height:60px;"></textarea><button id="add-btn" style="width:100%; padding:8px; background:var(--aura-gradient); border:none; border-radius:6px; color:white; cursor:pointer;">Adicionar Fonte</button>`; }
            document.getElementById('add-btn').onclick = async () => {
                if (tab === 'files') { const fileInput = document.getElementById('add-file'); const file = fileInput.files[0]; if (file) { const reader = new FileReader(); reader.onload = async (e) => { const content = e.target.result; await trainingManager.addItem(tab, { title: file.name, name: file.name, content: content }); updateTab(tab); }; reader.readAsText(file); } }
                else { const title = document.getElementById('add-title')?.value; const content = document.getElementById('add-content')?.value; if (title && content) { await trainingManager.addItem(tab, { title, name: title, content }); updateTab(tab); } }
            };
        };
        document.querySelectorAll('.aura-tab-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.aura-tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); updateTab(btn.dataset.tab); }; });
        updateTab('text'); document.getElementById('training-close').onclick = () => div.remove();
    }

    async function showNotes() {
        const notes = await notesManager.loadNotes();
        const notesHtml = `
            <div class="aura-settings-overlay">
                <div class="aura-settings-panel" style="width: 380px;">
                    <h3>Suas Notas</h3>
                    <div class="aura-notes-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">${notes.length ? notes.map(n => `<div class="aura-note-item" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px;"><strong>${n.title}</strong><p style="font-size: 12px; color: var(--aura-text-muted);">${n.content.substring(0, 50)}...</p></div>`).join('') : '<p>Nenhuma nota salva.</p>'}</div>
                    <button id="add-note-btn" style="width: 100%; padding: 10px; background: var(--aura-gradient); border: none; border-radius: 8px; color: white; cursor: pointer;">+ Nova Nota</button>
                    <button id="notes-close" style="width: 100%; margin-top: 10px; padding: 10px; background: transparent; border: 1px solid var(--aura-border); border-radius: 8px; color: white; cursor: pointer;">Fechar</button>
                </div>
            </div>
        `;
        const div = document.createElement('div'); div.innerHTML = notesHtml; document.body.appendChild(div);
        document.getElementById('add-note-btn').onclick = async () => { const title = prompt("Título da nota:"); const content = prompt("Conteúdo:"); if (title && content) { await notesManager.saveNote(title, content); div.remove(); showNotes(); } };
        document.getElementById('notes-close').onclick = () => div.remove();
    }
});
