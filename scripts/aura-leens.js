// aura-leens.js
class AuraLeens {
    constructor(aiClient) {
        this.aiClient = aiClient;
    }

    async analyzeContext(type, content) {
        const prompts = {
            'leens': 'Analise profundamente o seguinte contexto da página. Identifique os pontos principais, o tom e sugira 3 ações ou perguntas que o usuário pode fazer sobre isso:',
            'improve': 'Melhore o seguinte texto, tornando-o mais claro, profissional e impactante, mantendo o sentido original:',
            'summarize': 'Resuma o seguinte conteúdo de forma executiva, destacando apenas o que é essencial:',
            'translate': 'Traduza o seguinte texto para o idioma oposto (Português <-> Inglês) mantendo as nuances culturais:'
        };

        const systemPrompt = "Você é o AURA LEENS, um módulo de visão e análise contextual de alta precisão. Sua resposta deve ser elegante, estruturada e direta.";
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${prompts[type] || prompts['leens']}\n\nCONTEÚDO:\n${content}` }
        ];

        return await this.aiClient.chat(messages);
    }
}
