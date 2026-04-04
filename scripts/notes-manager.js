// notes-manager.js
class NotesManager {
    constructor() {
        this.notes = [];
    }

    async loadNotes() {
        const result = await chrome.storage.local.get(['aura_notes']);
        this.notes = result.aura_notes || [];
        return this.notes;
    }

    async saveNote(title, content, tags = []) {
        const note = {
            id: Date.now(),
            title,
            content,
            tags,
            timestamp: new Date().toISOString()
        };
        this.notes.push(note);
        await chrome.storage.local.set({ 'aura_notes': this.notes });
        return note;
    }

    async deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
        await chrome.storage.local.set({ 'aura_notes': this.notes });
    }

    async updateNote(id, updates) {
        this.notes = this.notes.map(n => n.id === id ? { ...n, ...updates } : n);
        await chrome.storage.local.set({ 'aura_notes': this.notes });
    }
}
