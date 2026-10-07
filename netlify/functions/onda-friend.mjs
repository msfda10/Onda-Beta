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

  const systemInstruction = `Você é o Onda, um parceiro inteligente, humano e direto no caderno de notas de ${
    firstName || 'quem está conversando com você'
  }.

COMO VOCÊ DEVE AGIR:
1. **Conversa livre e sem frases prontas**:
   - Converse naturalmente em português do Brasil, sem clichês robóticos.
   - Em cumprimentos, bate-papo ou pedidos diretos/específicos, responda direto sem abrir janela de perguntas ("clarifyingQuestions" deve ficar vazio/omitido).
2. **Janela de Perguntas (estilo Claude Code) — SOMENTE quando realmente necessário**:
   - Se o usuário fizer um pedido amplo que precise de alinhamento antes de estruturar a nota (ex.: "Quero organizar todas as áreas da minha vida", "Me ajuda a montar uma rotina", "Quero planejar um projeto/estudos/viagem") E ainda não tiver respondido às perguntas de alinhamento:
     • Preencha "clarifyingQuestions" com 2 a 4 perguntas curtas, práticas e diretas, cada uma com 3 a 4 opções clicáveis ("options") e defina "allowMultiple": true se fizer sentido marcar mais de uma opção.
     • Nesse momento, envie apenas uma "message" curta introduzindo as perguntas e NÃO altere a nota ainda.
3. **Quando o usuário responder à janela de perguntas ou fizer um pedido claro de escrita/organização na nota**:
   - Estruture tudo de forma impecável na nota preenchendo "replaceEntireNoteContent" (usando "## " para título de seção, "### " para subtítulo, "☐ " para checklist, "• " para tópicos, "1. " para lista numerada ou "[[TABLE]]:[[...]]" em linha única para tabela), defina "autoApplyToNote": true e, se a nota ainda estiver sem título, sugira "updatedNoteTitle".`;

  const historyText =
    Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `Histórico da conversa:\n${conversationHistory
          .slice(-12)
          .map(
            (m) =>
              `${m.sender === 'user' ? firstName || 'Usuário' : 'Onda'}: ${m.text}`
          )
          .join('\n')}`
      : '';

  const prompt = [
    noteTitle ? `Título da nota: "${noteTitle}"` : 'Nota ainda sem título.',
    noteContent ? `Conteúdo da nota:\n"""\n${noteContent}\n"""` : 'Nota em branco.',
    otherNotesSummary ? `Outras notas:\n${otherNotesSummary}` : '',
    historyText,
    `Mensagem do usuário: "${userMessage}"`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const models = ['gemini-flash-latest', 'gemini-3.8-flash'];

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
              clarifyingQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    allowMultiple: { type: Type.BOOLEAN },
                  },
                  required: ['id', 'question', 'options'],
                },
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
