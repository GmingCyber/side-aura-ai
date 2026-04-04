// training-manager.js
class TrainingManager {
    constructor() {
        this.trainingData = [];
    }

    async loadTraining() {
        const result = await chrome.storage.local.get(['aura_training']);
        this.trainingData = result.aura_training || [];
        return this.trainingData;
    }

    async addTraining(type, content, name) {
        const item = {
            id: Date.now(),
            type, // 'file', 'url', 'text'
            content,
            name,
            timestamp: new Date().toISOString()
        };
        this.trainingData.push(item);
        await chrome.storage.local.set({ 'aura_training': this.trainingData });
        return item;
    }

    async removeTraining(id) {
        this.trainingData = this.trainingData.filter(t => t.id !== id);
        await chrome.storage.local.set({ 'aura_training': this.trainingData });
    }

    getContextForPrompt() {
        if (this.trainingData.length === 0) return '';
        
        let context = "\n\nCONHECIMENTO ADICIONAL (TREINAMENTO):\n";
        this.trainingData.forEach(item => {
            context += `--- ${item.name} ---\n${item.content}\n`;
        });
        return context;
    }
}
