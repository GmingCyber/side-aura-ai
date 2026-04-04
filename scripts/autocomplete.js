// autocomplete.js
class AuraAutocomplete {
    constructor(inputElement, aiClient) {
        this.input = inputElement;
        this.aiClient = aiClient;
        this.suggestion = '';
        this.suggestionElement = null;
        this.init();
    }

    init() {
        this.suggestionElement = document.createElement('div');
        this.suggestionElement.className = 'aura-autocomplete-suggestion';
        this.input.parentElement.style.position = 'relative';
        this.input.parentElement.appendChild(this.suggestionElement);

        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    async handleInput() {
        const text = this.input.value;
        if (text.length < 5) {
            this.clearSuggestion();
            return;
        }

        // Debounce or only suggest on space/punctuation
        if (text.endsWith(' ')) {
            try {
                const prompt = `Complete a seguinte frase de forma natural e curta (máximo 5 palavras): "${text}"`;
                const result = await this.aiClient.chat([{ role: 'user', content: prompt }]);
                this.suggestion = result.trim();
                this.showSuggestion();
            } catch (e) {
                console.error('Autocomplete error', e);
            }
        }
    }

    showSuggestion() {
        if (!this.suggestion) return;
        this.suggestionElement.textContent = this.suggestion;
        // Position suggestion element over input (simplified)
        this.suggestionElement.style.display = 'block';
    }

    clearSuggestion() {
        this.suggestion = '';
        this.suggestionElement.textContent = '';
        this.suggestionElement.style.display = 'none';
    }

    handleKeyDown(e) {
        if (e.key === 'Tab' && this.suggestion) {
            e.preventDefault();
            this.input.value += this.suggestion;
            this.clearSuggestion();
        } else if (e.key === 'Escape') {
            this.clearSuggestion();
        }
    }
}
