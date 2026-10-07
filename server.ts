import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

function getApiKey(): string | undefined {
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

function createServerGenAi(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

let lastInvalidKey: string | null = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * Rota do "Onda" — O amigo de verdade presente nas notas do usuário.
   */
  app.post('/api/ai/onda-friend', async (req, res) => {
    const apiKey = getApiKey();
    const {
      userName = '',
      noteTitle = '',
      noteContent = '',
      userMessage = '',
      conversationHistory = [],
      otherNotesSummary = '',
    } = req.body || {};

    if (!noteTitle.trim() && !noteContent.trim() && !userMessage.trim()) {
      res.json(null);
      return;
    }

    if (!apiKey || apiKey === lastInvalidKey) {
      res.json(null);
      return;
    }

    const ai = createServerGenAi(apiKey);
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

    const historyText = Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `Histórico da conversa:\n${conversationHistory
          .slice(-12)
          .map((m: { sender: string; text: string }) => `${m.sender === 'user' ? (firstName || 'Usuário') : 'Onda'}: ${m.text}`)
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
                  description:
                    'Sua resposta natural e fluida na conversa com o usuário.',
                },
                mood: {
                  type: Type.STRING,
                  description:
                    'O tom da resposta: "acolhedor", "animado", "pensativo", "parceiro" ou "calmo".',
                },
                clarifyingQuestions: {
                  type: Type.ARRAY,
                  description:
                    'Preencha SOMENTE quando o pedido do usuário for amplo e realmente precisar de 2 a 4 perguntas rápidas de múltipla escolha antes de montar a nota. Caso contrário, deixe vazio.',
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
                  description:
                    'Opcional: rótulo do botão APENAS se o usuário pediu sugestões de itens para inserir na nota. Caso contrário, deixe vazio.',
                },
                writeToNoteLines: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description:
                    'Opcional: linhas para adicionar à nota APENAS quando solicitado pelo usuário. Deixe vazio em conversas normais.',
                },
                smartTableLabel: {
                  type: Type.STRING,
                  description:
                    'Opcional: rótulo do botão de tabela APENAS se o usuário pediu uma tabela.',
                },
                smartTableJson: {
                  type: Type.STRING,
                  description:
                    'Opcional: JSON 2D de tabela APENAS quando o usuário pedir uma tabela.',
                },
                updatedNoteTitle: {
                  type: Type.STRING,
                  description:
                    'Opcional: novo título da nota APENAS quando o usuário pedir para renomear ou criar a nota.',
                },
                replaceEntireNoteContent: {
                  type: Type.STRING,
                  description:
                    'Opcional: conteúdo completo atualizado da nota APENAS quando o usuário pedir para escrever, organizar, editar ou ajustar a nota.',
                },
                autoApplyToNote: {
                  type: Type.BOOLEAN,
                  description:
                    'True APENAS quando o usuário pedir explicitamente para você escrever, organizar ou alterar a nota.',
                },
              },
              required: ['message', 'mood'],
            },
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        res.json(parsed);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('API_KEY_INVALID') ||
          msg.includes('API key not valid') ||
          msg.includes('PERMISSION_DENIED')
        ) {
          lastInvalidKey = apiKey;
          break;
        }
      }
    }

    res.json(null);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
