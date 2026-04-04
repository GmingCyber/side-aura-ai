// openrouter-client.js
class AuraAIClient {
    constructor() {
        this.providers = [
            { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', key: '', models: ['google/gemini-2.0-flash-exp:free', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'deepseek/deepseek-chat'] },
            { id: 'google', name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', key: '', models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
            { id: 'anthropic', name: 'Anthropic', url: 'https://api.anthropic.com/v1', key: '', models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'] },
            { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com/v1', key: '', models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'] },
            { id: 'groq', name: 'Groq', url: 'https://api.groq.com/openai/v1', key: '', models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
            { id: 'custom', name: 'Custom Provider', url: '', key: '', models: [] }
        ];
        this.currentProviderId = 'openrouter';
        this.currentModel = 'google/gemini-2.0-flash-exp:free';
    }

    async loadConfig() {
        const result = await chrome.storage.local.get(['aura_providers', 'aura_current_provider', 'aura_current_model']);
        
        if (result.aura_providers) {
            // Update local providers with saved data
            result.aura_providers.forEach(saved => {
                const p = this.providers.find(p => p.id === saved.id);
                if (p) {
                    p.key = saved.key || p.key;
                    p.url = saved.url || p.url;
                    if (saved.models) p.models = [...new Set([...p.models, ...saved.models])];
                }
            });
        }
        
        this.currentProviderId = result.aura_current_provider || 'openrouter';
        this.currentModel = result.aura_current_model || 'google/gemini-2.0-flash-exp:free';
        
        console.log('Config Loaded:', { provider: this.currentProviderId, model: this.currentModel });
    }

    async saveProvider(providerId, updates) {
        const p = this.providers.find(p => p.id === providerId);
        if (p) {
            Object.assign(p, updates);
            // Save the entire providers array to ensure keys and URLs are persisted
            await chrome.storage.local.set({ 'aura_providers': this.providers });
            console.log(`Provider ${providerId} saved with updates:`, updates);
        }
    }

    async setModel(model) {
        this.currentModel = model;
        await chrome.storage.local.set({ 'aura_current_model': model });
    }

    async setProvider(providerId) {
        this.currentProviderId = providerId;
        await chrome.storage.local.set({ 'aura_current_provider': providerId });
        console.log('Active Provider Set to:', providerId);
    }

    getProvider() {
        return this.providers.find(p => p.id === this.currentProviderId) || this.providers[0];
    }

    async chat(messages, onStream = null) {
        await this.loadConfig();
        const provider = this.getProvider();
        const model = this.currentModel;

        if (!provider || !provider.key) {
            throw new Error(`API Key não configurada para ${provider?.name}. Vá em Configurações.`);
        }

        const headers = {
            'Authorization': `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
        };

        if (provider.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://aura-ai-extension.com';
            headers['X-Title'] = 'AURA AI Extension';
        }

        try {
            const response = await fetch(`${provider.url}/chat/completions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: !!onStream
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Erro no provedor ${provider.name}`);
            }

            if (onStream) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const json = JSON.parse(data);
                                const content = json.choices[0]?.delta?.content || '';
                                fullText += content;
                                onStream(content, fullText);
                            } catch (e) {}
                        }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.choices[0].message.content;
            }
        } catch (error) {
            console.error('AURA AI Chat Error:', error);
            throw error;
        }
    }
}
