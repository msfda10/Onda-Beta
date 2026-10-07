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

    const historyText = Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `Histórico da conversa:\n${conversationHistory
          .slice(-10)
          .map((m: { sender: string; text: string }) => `${m.sender === 'user' ? (firstName || 'Usuário') : 'Onda'}: ${m.text}`)
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
                  description:
                    'Sua resposta natural e fluida na conversa com o usuário.',
                },
                mood: {
                  type: Type.STRING,
                  description:
                    'O tom da resposta: "acolhedor", "animado", "pensativo", "parceiro" ou "calmo".',
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
