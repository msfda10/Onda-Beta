export interface OndaClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
  allowMultiple?: boolean;
}

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
  clarifyingQuestions?: OndaClarifyingQuestion[];
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
  clarifyingQuestions?: OndaClarifyingQuestion[];
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

/**
 * Conversa com o "Onda" no Chat — sem respostas prontas ou padronizadas
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

    const data = await res.json().catch(() => null);
    if (res.ok && data && typeof data.message === 'string' && data.message.trim()) {
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

      const parsedQuestions: OndaClarifyingQuestion[] | undefined = Array.isArray(
        data.clarifyingQuestions
      )
        ? data.clarifyingQuestions
            .filter(
              (q: unknown): q is Record<string, unknown> =>
                Boolean(q) &&
                typeof q === 'object' &&
                typeof (q as Record<string, unknown>).question === 'string' &&
                Array.isArray((q as Record<string, unknown>).options) &&
                ((q as Record<string, unknown>).options as unknown[]).length >= 2
            )
            .map((q: Record<string, unknown>, idx: number): OndaClarifyingQuestion => ({
              id:
                typeof q.id === 'string' && q.id.trim()
                  ? q.id.trim()
                  : `q_${idx + 1}`,
              question: String(q.question).trim(),
              options: (q.options as unknown[])
                .map((opt) => String(opt ?? '').trim())
                .filter(Boolean)
                .slice(0, 5),
              allowMultiple: Boolean(q.allowMultiple),
            }))
            .filter((q: OndaClarifyingQuestion) => Boolean(q.question) && q.options.length >= 2)
        : undefined;

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
        clarifyingQuestions:
          parsedQuestions && parsedQuestions.length > 0
            ? parsedQuestions
            : undefined,
      };
    }

    const errorDetail =
      data && typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : 'Não foi possível conectar à IA no momento. Verifique se a chave GEMINI_API_KEY está ativa.';

    return {
      message: errorDetail,
      mood: 'calmo',
    };
  } catch {
    return {
      message:
        'Não foi possível conectar ao servidor da IA no momento. Tente novamente em instantes.',
      mood: 'calmo',
    };
  }
}
