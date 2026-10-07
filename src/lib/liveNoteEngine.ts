export interface OndaConversationMessage {
  id: string;
  sender: 'onda' | 'user';
  text: string;
  mood?: string;
  updatedNoteTitle?: string;
  replaceEntireNoteContent?: string;
  autoApplyToNote?: boolean;
  writeToNoteLabel?: string;
  writeToNoteLines?: string[];
  smartTableLabel?: string;
  smartTableData?: string[][];
  polishedLines?: string[];
  ghostContinuation?: string;
  createdAt: string;
}

export interface OndaFriendResponse {
  message: string;
  mood: string;
  updatedNoteTitle?: string;
  replaceEntireNoteContent?: string;
  autoApplyToNote?: boolean;
  writeToNoteLabel?: string;
  writeToNoteLines?: string[];
  smartTableLabel?: string;
  smartTableData?: string[][];
  polishedLines?: string[];
  ghostContinuation?: string;
  autoWriteNow?: boolean;
}

export interface LiveNoteMetrics {
  currencyCount: number;
  currencyTotal: number;
  numberCount: number;
  numberTotal: number;
  wordCount: number;
  readingTimeSec: number;
}

/**
 * Avalia expressões matemáticas simples quando a linha termina com "=" (estilo Math Notes)
 */
export function evaluateInlineMath(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.endsWith('=')) return null;

  const exprPart = trimmed.slice(0, -1).trim();
  const match = exprPart.match(
    /([0-9]+(?:[.,][0-9]+)?(?:\s*[\+\-\*\/\%]\s*[0-9]+(?:[.,][0-9]+)?)+)$/
  );
  if (!match) return null;

  const rawMath = match[1].replace(/,/g, '.');
  if (!/^[0-9.\s\+\-\*\/\%\(\)]+$/.test(rawMath)) return null;

  try {
    const tokens = rawMath.match(/[0-9.]+|[\+\-\*\/]/g);
    if (!tokens || tokens.length < 3) return null;

    let current = parseFloat(tokens[0]);
    if (isNaN(current)) return null;

    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const nextVal = parseFloat(tokens[i + 1]);
      if (isNaN(nextVal)) return null;
      if (op === '+') current += nextVal;
      else if (op === '-') current -= nextVal;
      else if (op === '*') current *= nextVal;
      else if (op === '/') {
        if (nextVal === 0) return null;
        current /= nextVal;
      }
    }

    const formatted = Number.isInteger(current)
      ? current.toLocaleString('pt-BR')
      : current.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

    return `${trimmed} ${formatted}`;
  } catch {
    return null;
  }
}

/**
 * Dicionário rápido de autocorreção ortográfica e acentuação natural em tempo real
 */
const INSTANT_PT_CORRECTIONS: Record<string, string> = {
  nao: 'não',
  entao: 'então',
   tambem: 'também',
  tbm: 'também',
  tb: 'também',
  vc: 'você',
  vcs: 'vocês',
  pq: 'porque',
  qdo: 'quando',
  qnd: 'quando',
  amanha: 'amanhã',
  reuniao: 'reunião',
  orcamento: 'orçamento',
  acao: 'ação',
  acoes: 'ações',
  decisao: 'decisão',
  solucao: 'solução',
  atencao: 'atenção',
  informacao: 'informação',
  organizacao: 'organização',
  producao: 'produção',
  concluido: 'concluído',
  inicio: 'início',
  proximo: 'próximo',
  proxima: 'próxima',
  necessario: 'necessário',
   Estrategia: 'Estratégia',
  estrategia: 'estratégia',
  presiso: 'preciso',
  precizo: 'preciso',
  faser: 'fazer',
  faze: 'fazer',
  analize: 'análise',
  analise: 'análise',
  idéia: 'ideia',
  urg: 'urgente',
  hj: 'hoje',
  obg: 'obrigado',
  ctz: 'certeza',
  msg: 'mensagem',
  relatorio: 'relatório',
  horario: 'horário',
  facil: 'fácil',
  dificil: 'difícil',
  util: 'útil',
  nivel: 'nível',
  possivel: 'possível',
};

/**
 * Lapida uma linha instantaneamente (capitalização de início de frase + acentuação e correções claras)
 */
export function autoPolishLineText(raw: string): string {
  if (!raw || raw.trim().length < 2) return raw;

  const leadingSpaces = raw.match(/^\s*/)?.[0] || '';
  const trailingSpaces = raw.match(/\s*$/)?.[0] || '';
  const core = raw.trim();

  const words = core.split(/\s+/).map((word) => {
    const cleanMatch = word.match(/^([("'“”‘’]*)([a-zA-ZÀ-ÿ]+)([,.;:!?)"'“”‘’]*)$/);
    if (!cleanMatch) return word;
    const [, prefix, letters, suffix] = cleanMatch;
    const lower = letters.toLowerCase();
    const replacement = INSTANT_PT_CORRECTIONS[lower];
    if (!replacement) return word;

    const isCapitalized =
      letters[0] === letters[0].toUpperCase() &&
      letters[0] !== letters[0].toLowerCase();
    const finalWord = isCapitalized
      ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
      : replacement;
    return `${prefix}${finalWord}${suffix}`;
  });

  let joined = words.join(' ');
  if (joined.length > 0 && /^[a-zà-ÿ]/.test(joined)) {
    joined = joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  return `${leadingSpaces}${joined}${trailingSpaces}`;
}

/**
 * Prediz uma continuação inteligente (Ghost Text) para a linha atual que o usuário pode aceitar com Tab
 */
export function predictLocalGhostContinuation(
  lineText: string,
  noteTitle: string,
  aiGhost?: string
): string | null {
  const trimmed = lineText.trim();
  if (trimmed.length < 4) return null;

  if (aiGhost && aiGhost.trim().length > 2) {
    const cleanGhost = aiGhost.trim();
    if (!trimmed.toLowerCase().endsWith(cleanGhost.toLowerCase())) {
      return cleanGhost.startsWith(' ') ? cleanGhost : ` ${cleanGhost}`;
    }
  }

  const lower = trimmed.toLowerCase();

  if (lower.endsWith('preciso') || lower.endsWith('preciso fazer')) {
    return ' definir a prioridade número 1 de hoje e concluir em 25 min';
  }
  if (lower.endsWith('meta') || lower.endsWith('objetivo')) {
    return ': entregar a primeira versão funcional até o fim da semana';
  }
  if (lower.endsWith('reunião') || lower.endsWith('reuniao')) {
    return ' — alinhar escopo, prazos e responsáveis principais';
  }
  if (lower.endsWith('comprar') || lower.endsWith('mercado')) {
    return ' os itens essenciais da semana e revisar o orçamento';
  }
  if (lower.endsWith('estudar') || lower.endsWith('aprender')) {
    return ' os conceitos-chave e resumir em 3 pontos práticos';
  }
  if (lower.endsWith('ideia') || lower.endsWith('projeto')) {
    return ' — validar o problema real e criar o primeiro protótipo';
  }
  if (lower.endsWith('orçamento') || lower.endsWith('custo') || lower.endsWith('gasto')) {
    return ' R$ 0,00 (definir teto máximo)';
  }
  if (noteTitle.trim().length > 3 && trimmed.length >= 8 && !trimmed.endsWith('.')) {
    return ` para avançar em ${noteTitle.trim().toLowerCase()}`;
  }

  return null;
}

/**
 * Extrai métricas vivas da nota (soma automática de valores R$, números, palavras e tempo)
 */
export function extractNoteMetrics(
  title: string,
  blocksText: string[]
): LiveNoteMetrics {
  const fullText = [title, ...blocksText].join('\n');
  const words = fullText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  let currencyCount = 0;
  let currencyTotal = 0;
  let numberCount = 0;
  let numberTotal = 0;

  for (const line of blocksText) {
    // Valores explícitos em R$ ou $
    const currencyMatches = line.matchAll(
      /(?:R\$|\$)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/gi
    );
    for (const m of currencyMatches) {
      const rawNum = m[1];
      const normalized =
        rawNum.includes(',') && rawNum.includes('.')
          ? rawNum.replace(/\./g, '').replace(',', '.')
          : rawNum.replace(',', '.');
      const val = parseFloat(normalized);
      if (!isNaN(val)) {
        currencyCount += 1;
        currencyTotal += val;
      }
    }

    // Linhas estilo "Item: 150" ou "Item - 250,00" sem R$
    if (!/(?:R\$|\$)/i.test(line)) {
      const trailingValueMatch = line.match(
        /(?:[:\-–=]\s*|\s+)([0-9]{2,6}(?:,[0-9]{1,2})?)\s*$/
      );
      if (trailingValueMatch) {
        const val = parseFloat(trailingValueMatch[1].replace(',', '.'));
        if (!isNaN(val) && val > 0 && val < 1000000) {
          numberCount += 1;
          numberTotal += val;
        }
      }
    }
  }

  return {
    currencyCount,
    currencyTotal,
    numberCount,
    numberTotal,
    wordCount: words.length,
    readingTimeSec: Math.max(5, Math.ceil((words.length / 200) * 60)),
  };
}

function buildNaturalConversationalReply(params: {
  userName?: string;
  noteTitle: string;
  noteContent: string;
  userMessage?: string;
  conversationHistory?: Array<{ sender: 'onda' | 'user'; text: string }>;
}): OndaFriendResponse {
  const firstName = params.userName ? params.userName.split(' ')[0] : '';
  const userText = (params.userMessage || '').trim();
  const lower = userText.toLowerCase();
  const hasNoteTitle =
    Boolean(params.noteTitle.trim()) && params.noteTitle.trim() !== 'Nova Nota';
  const noteName = hasNoteTitle ? params.noteTitle.trim() : '';

  const rawLines = params.noteContent
    .split('\n')
    .filter((l) => !l.startsWith('[[TABLE]]:'))
    .map((l) => l.replace(/^(##\s+|###\s+|>\s+|[☐☑•\-*]\s+|\d+\.\s+)/, '').trim())
    .filter(Boolean);

  // 1. Saudações e início de conversa ("olá", "oi", "bom dia", "boa tarde", "boa noite", "opa", "e aí")
  if (
    /^(ol[aá]|oi+|opa|e\s*a[ií]|hey|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|como\s+vai)[!?.]*$/i.test(
      lower
    )
  ) {
    if (/tudo\s+bem|como\s+vai/i.test(lower)) {
      return {
        message: `Tudo ótimo por aqui${firstName ? `, ${firstName}` : ''}! E com você? Como posso te ajudar hoje?`,
        mood: 'acolhedor',
      };
    }
    return {
      message: `Olá${firstName ? `, ${firstName}` : ''}! Tudo bem? No que posso te ajudar agora?`,
      mood: 'acolhedor',
    };
  }

  // 2. Perguntas sobre como o chat / Onda funciona
  if (
    /quem\s+[eé]\s+voc[eê]|o\s+que\s+voc[eê]\s+faz|como\s+voc[eê]\s+funciona|pode\s+me\s+ajudar/i.test(
      lower
    )
  ) {
    return {
      message: `Claro${firstName ? `, ${firstName}` : ''}! Podemos conversar sobre qualquer ideia, planejar tarefas ou, se você quiser, posso escrever, organizar ou montar checklists e tabelas direto na sua nota${noteName ? ` "${noteName}"` : ''}. O que você está pensando em fazer?`,
      mood: 'parceiro',
    };
  }

  // 3. Pedido explícito de tabela
  const wantsTable = /\b(tabela|planilha|quadro|colunas|cronograma\s+em\s+tabela)\b/i.test(
    lower
  );
  if (wantsTable) {
    const subject = noteName || 'Planejamento';
    const tableData: string[][] = /rotina|hor[aá]rio|dia|semana/i.test(
      `${lower} ${subject}`
    )
      ? [
          ['Período / Horário', 'Atividade', 'Prioridade'],
          ['Manhã (08:00)', 'Foco principal do dia', 'Alta'],
          ['Tarde (14:00)', 'Execução e demandas', 'Média'],
          ['Noite (19:00)', 'Revisão e descanso', 'Normal'],
        ]
      : [
          ['Item', 'Detalhe', 'Status'],
          ['1. Planejamento', `Definir escopo de ${subject}`, 'Em andamento'],
          ['2. Execução', 'Desenvolver atividades principais', 'Pendente'],
          ['3. Revisão', 'Validar entrega final', 'Pendente'],
        ];

    return {
      message: `Perfeito${firstName ? `, ${firstName}` : ''}! Preparei uma tabela estruturada para ${noteName ? `"${noteName}"` : 'sua nota'}. Você pode clicar abaixo para inserir direto na folha ou me dizer se quer mudar alguma coluna.`,
      mood: 'parceiro',
      smartTableLabel: 'Inserir tabela na nota',
      smartTableData: tableData,
    };
  }

  // 4. Pedido explícito para criar/organizar/escrever/ajustar a nota ou montar rotina/checklist
  const wantsNoteAction =
    /\b(organiz|ajust|melhor|corrig|reescrev|resum|estrutur|format|adicione|adicionar|escrev|crie|criar|monta|monte|coloca|coloque|insira|inserir|fa[cç]a\s+uma?\s+(?:lista|rotina|checklist|resumo))\b/i.test(
      lower
    );

  if (wantsNoteAction) {
    const topic = noteName || 'Minha Nota';
    const polished = rawLines.map((l) => autoPolishLineText(l));
    const isRoutine = /rotina|dia|manh[aã]|tarde|noite|hábito|habito/i.test(
      `${lower} ${topic}`
    );

    const newNoteContent =
      polished.length > 0
        ? [
            `## ${autoPolishLineText(topic)}`,
            ...polished.map((l) => `☐ ${l}`),
          ].join('\n')
        : isRoutine
        ? [
            `## Manhã`,
            `☐ Organizar as prioridades do dia`,
            `☐ Bloco de foco principal`,
            `## Tarde`,
            `☐ Resolver pendências e entregas`,
            `☐ Pausa rápida e revisão`,
            `## Noite`,
            `☐ Planejar o dia seguinte e descansar`,
          ].join('\n')
        : [
            `## ${autoPolishLineText(topic)}`,
            `☐ Definir objetivo principal`,
            `☐ Executar próximos passos`,
            `☐ Revisar resultados`,
          ].join('\n');

    return {
      message: `Pronto${firstName ? `, ${firstName}` : ''}! Já estruturei e atualizei a nota ${noteName ? `"${noteName}"` : ''} com base no que você pediu. Me avise se quiser acrescentar ou mudar algum ponto!`,
      mood: 'parceiro',
      replaceEntireNoteContent: newNoteContent,
      autoApplyToNote: true,
    };
  }

  // 5. Conversa livre / troca de ideias (sem automação forçada nem botões intrusivos)
  if (lower.endsWith('?')) {
    return {
      message: `Boa pergunta${firstName ? `, ${firstName}` : ''}! Para ${noteName ? `"${noteName}"` : 'isso'}, o melhor caminho é dividir em partes simples e focar no que traz mais resultado primeiro. Quer que a gente estruture ideias sobre isso juntos ou prefere que eu anote os pontos principais na folha?`,
      mood: 'pensativo',
    };
  }

  return {
    message: `Entendi${firstName ? `, ${firstName}` : ''}! Me conta mais sobre como você quer conduzir ${noteName ? `"${noteName}"` : 'isso'} — podemos ir conversando para amadurecer a ideia ou, quando quiser, você me pede e eu anoto ou organizo tudo lá na nota.`,
    mood: 'parceiro',
  };
}

/**
 * Conversa com o "Onda" no Chat — conversa fluida e natural, ajustando a nota somente quando pedido
 */
export async function talkToOndaFriend(params: {
  userName?: string;
  noteTitle: string;
  noteContent: string;
  userMessage?: string;
  conversationHistory?: Array<{ sender: 'onda' | 'user'; text: string }>;
  otherNotesSummary?: string;
}): Promise<OndaFriendResponse> {
  try {
    const res = await fetch('/api/ai/onda-friend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      return buildNaturalConversationalReply(params);
    }

    const data = await res.json();
    if (data && typeof data.message === 'string' && data.message.trim()) {
      let parsedTable: string[][] | undefined;
      if (typeof data.smartTableJson === 'string' && data.smartTableJson.trim()) {
        try {
          const candidate = JSON.parse(data.smartTableJson);
          if (
            Array.isArray(candidate) &&
            candidate.length >= 2 &&
            Array.isArray(candidate[0])
          ) {
            parsedTable = candidate.map((row: unknown[]) =>
              Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
            );
          }
        } catch {
          // ignora JSON inválido de tabela
        }
      }

      return {
        message: data.message.trim(),
        mood:
          typeof data.mood === 'string' && data.mood.trim()
            ? data.mood.trim()
            : 'parceiro',
        updatedNoteTitle:
          typeof data.updatedNoteTitle === 'string' && data.updatedNoteTitle.trim()
            ? data.updatedNoteTitle.trim()
            : undefined,
        replaceEntireNoteContent:
          typeof data.replaceEntireNoteContent === 'string' &&
          data.replaceEntireNoteContent.trim()
            ? data.replaceEntireNoteContent.trim()
            : undefined,
        autoApplyToNote: Boolean(data.autoApplyToNote),
        writeToNoteLabel:
          typeof data.writeToNoteLabel === 'string' && data.writeToNoteLabel.trim()
            ? data.writeToNoteLabel.trim()
            : undefined,
        writeToNoteLines:
          Array.isArray(data.writeToNoteLines) && data.writeToNoteLines.length > 0
            ? data.writeToNoteLines.filter(
                (s: unknown) => typeof s === 'string' && s.trim()
              )
            : undefined,
        smartTableLabel:
          typeof data.smartTableLabel === 'string' && data.smartTableLabel.trim()
            ? data.smartTableLabel.trim()
            : parsedTable
            ? 'Inserir tabela na nota'
            : undefined,
        smartTableData: parsedTable,
      };
    }

    return buildNaturalConversationalReply(params);
  } catch {
    return buildNaturalConversationalReply(params);
  }
}
