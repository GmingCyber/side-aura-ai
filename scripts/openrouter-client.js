// openrouter-client.js
class OpenRouterClient {
    constructor() {
        this.baseURL = 'https://openrouter.ai/api/v1';
        this.apiKey = null;
        this.currentModel = 'google/gemini-2.0-flash-exp:free'; // Default free model
    }

    async setApiKey(key) {
        this.apiKey = key;
        await chrome.storage.local.set({ 'aura_api_key': key });
    }

    async getApiKey() {
        if (this.apiKey) return this.apiKey;
        const result = await chrome.storage.local.get(['aura_api_key']);
        this.apiKey = result.aura_api_key;
        return this.apiKey;
    }

    async setModel(model) {
        this.currentModel = model;
        await chrome.storage.local.set({ 'aura_current_model': model });
    }

    async getModel() {
        const result = await chrome.storage.local.get(['aura_current_model']);
        return result.aura_current_model || this.currentModel;
    }

    async chat(messages, onStream = null) {
        const apiKey = await this.getApiKey();
        const model = await this.getModel();

        if (!apiKey) {
            throw new Error('API Key não configurada. Vá em Configurações.');
        }

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://aura-ai-extension.com', // Required by OpenRouter
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
                throw new Error(error.error?.message || 'Erro na requisição ao OpenRouter');
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
            console.error('OpenRouter Chat Error:', error);
            throw error;
        }
    }
}
