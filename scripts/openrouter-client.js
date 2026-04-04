// openrouter-client.js
class AuraAIClient {
    constructor() {
        this.providers = [];
        this.currentProviderId = 'openrouter';
        this.currentModel = 'google/gemini-2.0-flash-exp:free';
    }

    async loadConfig() {
        const result = await chrome.storage.local.get(['aura_providers', 'aura_current_provider', 'aura_current_model']);
        this.providers = result.aura_providers || [
            { id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', key: '' }
        ];
        this.currentProviderId = result.aura_current_provider || 'openrouter';
        this.currentModel = result.aura_current_model || 'google/gemini-2.0-flash-exp:free';
    }

    async saveProvider(provider) {
        const index = this.providers.findIndex(p => p.id === provider.id);
        if (index >= 0) {
            this.providers[index] = provider;
        } else {
            this.providers.push(provider);
        }
        await chrome.storage.local.set({ 'aura_providers': this.providers });
    }

    async setModel(model) {
        this.currentModel = model;
        await chrome.storage.local.set({ 'aura_current_model': model });
    }

    async setProvider(providerId) {
        this.currentProviderId = providerId;
        await chrome.storage.local.set({ 'aura_current_provider': providerId });
    }

    getProvider() {
        return this.providers.find(p => p.id === this.currentProviderId) || this.providers[0];
    }

    async chat(messages, onStream = null) {
        await this.loadConfig();
        const provider = this.getProvider();
        const model = this.currentModel;

        if (!provider || !provider.key) {
            throw new Error(`API Key não configurada para o provedor ${provider?.name || 'selecionado'}. Vá em Configurações.`);
        }

        try {
            const response = await fetch(`${provider.url}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${provider.key}`,
                    'HTTP-Referer': 'https://aura-ai-extension.com',
                    'X-Title': 'AURA AI Extension',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: !!onStream
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Erro na requisição ao provedor de IA');
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
                            } catch (e) {
                                console.error('Error parsing stream chunk', e);
                            }
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
