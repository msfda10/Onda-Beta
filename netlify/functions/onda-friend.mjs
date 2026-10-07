import { GoogleGenAI, Type } from '@google/genai';

function getApiKey() {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
    process.env.GOOGLE_API_KEY,
  ];
  for (const key of candidates) {
    if (
      key &&
      typeof key === 'string' &&
      key.trim().length > 10 &&
      key.trim() !== 'MY_GEMINI_API_KEY' &&
      !key.includes('YOUR_')
    ) {
      return key.trim();
    }
  }
  return undefined;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    body = {};
  }

  const {
    userName = '',
    noteTitle = '',
    noteContent = '',
    userMessage = '',
    conversationHistory = [],
    otherNotesSummary = '',
  } = body;

  if (!noteTitle.trim() && !noteContent.trim() && !userMessage.trim()) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const firstName = userName ? userName.split(' ')[0] : '';

  const systemInstruction = `Você é o **Onda**, um parceiro de conversa inteligente, natural e prestativo dentro do caderno de notas de ${
    firstName || 'quem está conversando com você'
  }.

REGRAS ESSENCIAIS DE CONVERSA NATURAL:
1. **Converse com naturalidade, sem respostas robotizadas ou automáticas**:
   - Se o usuário apenas cumprimentar ("Olá", "Oi", "Tudo bem?", "Bom dia"), puxar assunto, tirar uma dúvida ou trocar ideias, responda de forma humana, fluida e natural, como em uma conversa real.
   - **NÃO** empurre botões, **NÃO** altere a nota e **NÃO** preencha "replaceEntireNoteContent", "writeToNoteLines" nem "smartTableJson" se o usuário estiver apenas conversando ou cumprimentando! Deixe esses campos vazios/omitidos até que façam sentido no que o usuário pedir.
2. **Ajude na nota à medida que o usuário pedir**:
   - Você conhece o título atual ("${noteTitle || 'Sem título'}") e o conteúdo da nota aberta.
   - Somente quando o usuário pedir para escrever, adicionar, organizar, ajustar, resumir, criar uma rotina/lista/tabela ou alterar algo na nota:
     • Preencha "replaceEntireNoteContent" com o conteúdo atualizado da nota (usando "## " para título de seção, "### " para subtítulo, "☐ " para checklist pendente, "☑ " para concluído, "• " para tópicos, "1. " para lista numerada, "> " para citação, ou "[[TABLE]]:[[...]]" em linha única para tabela) e defina "autoApplyToNote": true para aplicar direto na nota, OU
     • Preencha "writeToNoteLines" / "smartTableJson" se quiser oferecer blocos específicos para ele inserir.`;

  const historyText =
    Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `Histórico da conversa:\n${conversationHistory
          .slice(-10)
          .map(
            (m) =>
              `${m.sender === 'user' ? firstName || 'Usuário' : 'Onda'}: ${m.text}`
          )
          .join('\n')}`
      : '';

  const prompt = [
    firstName ? `Nome do usuário: ${firstName}` : '',
    noteTitle ? `Título da nota aberta: "${noteTitle}"` : 'Nota aberta ainda sem título.',
    noteContent
      ? `Conteúdo atual da nota aberta:\n"""\n${noteContent}\n"""`
      : 'O corpo da nota está em branco no momento.',
    otherNotesSummary
      ? `Resumo de outras notas do usuário (contexto):\n${otherNotesSummary}`
      : '',
    historyText,
    `Mensagem atual do usuário: "${userMessage}"\nResponda naturalmente à mensagem dele(a). Só preencha campos de edição da nota se ele(a) tiver pedido para escrever, organizar ou ajustar algo na nota.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const models = ['gemini-3.8-flash', 'gemini-flash-latest'];

  for (const modelName of models) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.75,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: {
                type: Type.STRING,
                description: 'Sua resposta natural e fluida na conversa com o usuário.',
              },
              mood: {
                type: Type.STRING,
                description: 'O tom da resposta: "acolhedor", "animado", "pensativo", "parceiro" ou "calmo".',
              },
              writeToNoteLabel: {
                type: Type.STRING,
              },
              writeToNoteLines: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              smartTableLabel: {
                type: Type.STRING,
              },
              smartTableJson: {
                type: Type.STRING,
              },
              updatedNoteTitle: {
                type: Type.STRING,
              },
              replaceEntireNoteContent: {
                type: Type.STRING,
              },
              autoApplyToNote: {
                type: Type.BOOLEAN,
              },
            },
            required: ['message', 'mood'],
          },
        },
      });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: response.text || '{}',
      };
    } catch {
      // Tenta o próximo modelo
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(null),
  };
};
