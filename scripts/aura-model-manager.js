// aura-model-manager.js
class AuraModelManager {
    constructor() {
        this.models = [];
        this.activeModelId = null;
    }

    async loadModels() {
        const result = await chrome.storage.local.get(['aura_personas', 'aura_active_persona_id']);
        this.models = result.aura_personas || [
            {
                id: 'default',
                title: 'AURA AI',
                description: 'Assistente geral inteligente e prestativo.',
                provider: 'openrouter',
                model: 'google/gemini-2.0-flash-exp:free',
                apiKey: '',
                icon: '🤖'
            }
        ];
        this.activeModelId = result.aura_active_persona_id || 'default';
        return this.models;
    }

    async addModel(modelData) {
        const newModel = {
            id: Date.now().toString(),
            ...modelData,
            timestamp: new Date().toISOString()
        };
        this.models.push(newModel);
        await chrome.storage.local.set({ 'aura_personas': this.models });
        return newModel;
    }

    async removeModel(id) {
        if (id === 'default') return;
        this.models = this.models.filter(m => m.id !== id);
        if (this.activeModelId === id) this.activeModelId = 'default';
        await chrome.storage.local.set({ 'aura_personas': this.models, 'aura_active_persona_id': this.activeModelId });
    }

    async setActiveModel(id) {
        this.activeModelId = id;
        await chrome.storage.local.set({ 'aura_active_persona_id': id });
    }

    getActiveModel() {
        return this.models.find(m => m.id === this.activeModelId) || this.models[0];
    }
}
