// training-manager.js
class TrainingManager {
    constructor() {
        this.categories = {
            text: [],
            files: [],
            sources: []
        };
    }

    async loadTraining() {
        const result = await chrome.storage.local.get(['aura_training_v2']);
        this.categories = result.aura_training_v2 || { text: [], files: [], sources: [] };
        return this.categories;
    }

    async addItem(category, item) {
        if (!this.categories[category]) this.categories[category] = [];
        const newItem = {
            id: Date.now(),
            ...item,
            timestamp: new Date().toISOString()
        };
        this.categories[category].push(newItem);
        await chrome.storage.local.set({ 'aura_training_v2': this.categories });
        return newItem;
    }

    async removeItem(category, id) {
        if (this.categories[category]) {
            this.categories[category] = this.categories[category].filter(item => item.id !== id);
            await chrome.storage.local.set({ 'aura_training_v2': this.categories });
        }
    }

    getContext() {
        return this.getContextForPrompt();
    }

    getContextForPrompt() {
        let context = "\n\n--- CONHECIMENTO DE TREINAMENTO ---\n";
        
        if (this.categories.text.length > 0) {
            context += "\n[TEXTOS E REGRAS]:\n";
            this.categories.text.forEach(t => context += `- ${t.title}: ${t.content}\n`);
        }
        
        if (this.categories.sources.length > 0) {
            context += "\n[FONTES E URLS]:\n";
            this.categories.sources.forEach(s => context += `- ${s.name}: ${s.content}\n`);
        }

        if (this.categories.files.length > 0) {
            context += "\n[ARQUIVOS]:\n";
            this.categories.files.forEach(f => context += `- ${f.name} (Processado)\n`);
        }

        return context === "\n\n--- CONHECIMENTO DE TREINAMENTO ---\n" ? "" : context;
    }
}
