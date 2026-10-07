import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  Menu,
  X,
  Search,
  Pin,
  ChevronDown,
  Trash2,
  ListTodo,
  Table2,
  SquarePen,
  Check,
  List,
  ListOrdered,
  Quote,
  Plus,
  FileText,
  Send,
  MessageSquare,
} from 'lucide-react';
import { SidebarAccount } from './components/SidebarAccount.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { AccountModal } from './components/AccountModal.tsx';
import {
  SettingsModal,
  OndaPreferences,
  loadOndaPreferences,
} from './components/SettingsModal.tsx';
import AnimatedGradient, { GradientConfig } from './components/ui/animated-gradient.tsx';
import { cn } from './lib/utils.ts';
import {
  talkToOndaFriend,
  OndaConversationMessage,
} from './lib/liveNoteEngine.ts';
import ondaFullLogoSrc from './assets/images/onda_full_logo_1791169131743.jpg';
import ondaWaveOLogoSrc from './assets/images/onda_wave_o_logo.jpg';
import {
  auth,
  logoutUser,
  onAuthStateChanged,
  db,
  OperationType,
  handleFirestoreError,
} from './lib/firebase.ts';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

interface UserData {
  uid?: string;
  name: string;
  email: string;
  role?: string;
  photoURL?: string;
  avatarColor?: string;
}

export interface NoteItem {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  content: string;
  itemType: 'note';
  completed: boolean; // Indicador de nota fixada (Pinned)
  createdAt: string;
  updatedAt: string;
}

export type NoteBlockType =
  | 'body'
  | 'heading'
  | 'subheading'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'table';

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text: string;
  checked?: boolean;
  tableData?: string[][];
}

let cachedTransparentFullLogo: string | null = null;
let cachedTransparentWaveO: string | null = null;
let cachedSquareFavicon: string | null = null;

function applyOndaFaviconFromTransparentUrl(transparentUrl: string) {
  if (typeof document === 'undefined') return;
  // Oculta o segundo "Onda" em texto na aba do navegador para exibir somente a logo
  document.title = '\u2060';

  if (cachedSquareFavicon) {
    const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (link) {
      link.type = 'image/png';
      link.href = cachedSquareFavicon;
    }
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(img, 0, 0);
      const { data, width, height } = tempCtx.getImageData(0, 0, img.width, img.height);
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      // Recorta 100% das bordas transparentes e sombras suaves para ocupar o limite máximo do ícone
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 95) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const cropW = maxX > minX ? maxX - minX + 1 : width;
      const cropH = maxY > minY ? maxY - minY + 1 : height;
      const sx = maxX > minX ? minX : 0;
      const sy = maxY > minY ? minY : 0;

      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = Math.min(size / cropW, size / cropH);
      const drawW = cropW * scale;
      const drawH = cropH * scale;
      const drawX = (size - drawW) / 2;
      const drawY = (size - drawH) / 2;

      ctx.drawImage(tempCanvas, sx, sy, cropW, cropH, drawX, drawY, drawW, drawH);
      const squarePng = canvas.toDataURL('image/png');
      cachedSquareFavicon = squarePng;

      let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = 'image/png';
      link.href = squarePng;

      const appleLink = document.getElementById('onda-apple-icon') as HTMLLinkElement | null;
      if (appleLink) {
        appleLink.href = squarePng;
      }
    } catch {
      // ignora erro de canvas
    }
  };
  img.src = transparentUrl;
}

function processBlackBgImage(
  src: string,
  w: number,
  h: number,
  onReady: (url: string) => void
) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onReady(src);
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const maxChannel = Math.max(r, g, b);

        if (maxChannel < 22) {
          data[i + 3] = 0;
        } else if (maxChannel < 56 && b < 75) {
          const alphaFactor = (maxChannel - 22) / (56 - 22);
          data[i + 3] = Math.round(alphaFactor * 255);
        }
      }

      let minX = w,
        minY = h,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 25) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      if (maxX > minX && maxY > minY) {
        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const pad = 16;

        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = cropW;
        cleanCanvas.height = cropH;
        const cleanCtx = cleanCanvas.getContext('2d');

        const darkBevelCanvas = document.createElement('canvas');
        darkBevelCanvas.width = cropW;
        darkBevelCanvas.height = cropH;
        const darkCtx = darkBevelCanvas.getContext('2d');

        if (cleanCtx && darkCtx) {
          cleanCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

          darkCtx.drawImage(cleanCanvas, 0, 0);
          darkCtx.globalCompositeOperation = 'source-in';
          darkCtx.fillStyle = '#081d52';
          darkCtx.fillRect(0, 0, cropW, cropH);

          const trimmedCanvas = document.createElement('canvas');
          trimmedCanvas.width = cropW + pad * 2;
          trimmedCanvas.height = cropH + pad * 2;
          const trimmedCtx = trimmedCanvas.getContext('2d');

          if (trimmedCtx) {
            trimmedCtx.save();
            trimmedCtx.shadowColor = 'rgba(6, 18, 56, 0.68)';
            trimmedCtx.shadowBlur = 14;
            trimmedCtx.shadowOffsetX = 3;
            trimmedCtx.shadowOffsetY = 9;
            trimmedCtx.drawImage(darkBevelCanvas, pad, pad);
            trimmedCtx.restore();

            for (let depth = 5; depth >= 1; depth--) {
              trimmedCtx.globalAlpha = 0.24;
              trimmedCtx.drawImage(
                darkBevelCanvas,
                pad + depth * 0.55,
                pad + depth * 1.05
              );
            }

            trimmedCtx.globalAlpha = 1;
            trimmedCtx.filter = 'contrast(1.08) saturate(1.14) brightness(1.04)';
            trimmedCtx.drawImage(cleanCanvas, pad, pad);
            trimmedCtx.filter = 'none';

            onReady(trimmedCanvas.toDataURL('image/png'));
            return;
          }
        }
      }

      onReady(canvas.toDataURL('image/png'));
    } catch {
      onReady(src);
    }
  };
  img.src = src;
}

function OndaLogo3D({ className = 'h-9 sm:h-10 w-auto' }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(cachedTransparentFullLogo);

  useEffect(() => {
    if (cachedTransparentFullLogo) {
      setLogoUrl(cachedTransparentFullLogo);
      applyOndaFaviconFromTransparentUrl(cachedTransparentFullLogo);
      return;
    }
    processBlackBgImage(ondaFullLogoSrc, 640, 320, (url) => {
      cachedTransparentFullLogo = url;
      setLogoUrl(url);
      applyOndaFaviconFromTransparentUrl(url);
    });
  }, []);

  if (!logoUrl) {
    return <div className={cn(className, 'w-28')} />;
  }

  return (
    <img
      src={logoUrl}
      alt="Onda"
      draggable={false}
      referrerPolicy="no-referrer"
      className={cn(className, 'object-contain select-none')}
    />
  );
}

function OndaWaveOIcon({ className = 'h-9 sm:h-10 w-auto' }: { className?: string }) {
  const [iconUrl, setIconUrl] = useState<string | null>(cachedTransparentWaveO);

  useEffect(() => {
    if (cachedTransparentWaveO) {
      setIconUrl(cachedTransparentWaveO);
      return;
    }
    processBlackBgImage(ondaWaveOLogoSrc, 384, 384, (url) => {
      cachedTransparentWaveO = url;
      setIconUrl(url);
    });
  }, []);

  if (!iconUrl) {
    return <div className={cn(className, 'w-9')} />;
  }

  return (
    <img
      src={iconUrl}
      alt="Onda"
      draggable={false}
      referrerPolicy="no-referrer"
      className={cn(className, 'object-contain select-none')}
    />
  );
}

function createBlockId(): string {
  return `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function parseContentToBlocks(rawContent: string): NoteBlock[] {
  if (!rawContent) {
    return [{ id: createBlockId(), type: 'body', text: '' }];
  }

  const lines = rawContent.split('\n');
  const blocks: NoteBlock[] = [];

  for (const line of lines) {
    if (line.startsWith('[[TABLE]]:')) {
      try {
        const parsed = JSON.parse(line.slice('[[TABLE]]:'.length));
        if (Array.isArray(parsed) && parsed.length > 0) {
          blocks.push({
            id: createBlockId(),
            type: 'table',
            text: '',
            tableData: parsed,
          });
          continue;
        }
      } catch {
        // fallback para texto normal
      }
    }

    if (line.startsWith('## ')) {
      blocks.push({ id: createBlockId(), type: 'heading', text: line.slice(3) });
    } else if (line.startsWith('### ')) {
      blocks.push({ id: createBlockId(), type: 'subheading', text: line.slice(4) });
    } else if (line.startsWith('☐ ')) {
      blocks.push({
        id: createBlockId(),
        type: 'todo',
        text: line.slice(2),
        checked: false,
      });
    } else if (line.startsWith('☑ ')) {
      blocks.push({
        id: createBlockId(),
        type: 'todo',
        text: line.slice(2),
        checked: true,
      });
    } else if (line.startsWith('• ')) {
      blocks.push({ id: createBlockId(), type: 'bullet', text: line.slice(2) });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        id: createBlockId(),
        type: 'numbered',
        text: line.replace(/^\d+\.\s/, ''),
      });
    } else if (line.startsWith('> ')) {
      blocks.push({ id: createBlockId(), type: 'quote', text: line.slice(2) });
    } else {
      blocks.push({ id: createBlockId(), type: 'body', text: line });
    }
  }

  return blocks.length > 0 ? blocks : [{ id: createBlockId(), type: 'body', text: '' }];
}

function serializeBlocksToContent(blocks: NoteBlock[]): string {
  let numCounter = 0;
  return blocks
    .map((b) => {
      if (b.type === 'numbered') {
        numCounter += 1;
      } else {
        numCounter = 0;
      }

      switch (b.type) {
        case 'heading':
          return `## ${b.text}`;
        case 'subheading':
          return `### ${b.text}`;
        case 'todo':
          return `${b.checked ? '☑' : '☐'} ${b.text}`;
        case 'bullet':
          return `• ${b.text}`;
        case 'numbered':
          return `${numCounter}. ${b.text}`;
        case 'quote':
          return `> ${b.text}`;
        case 'table':
          return `[[TABLE]]:${JSON.stringify(
            b.tableData || [
              ['Coluna 1', 'Coluna 2'],
              ['', ''],
            ]
          )}`;
        case 'body':
        default:
          return b.text;
      }
    })
    .join('\n');
}

function formatSidebarNoteDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Hoje, ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Ontem, ${timeStr}`;
    }

    const dayMonth = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    })
      .format(date)
      .replace('.', '');
    return `${dayMonth}, ${timeStr}`;
  } catch {
    return '';
  }
}

function formatChatDayHeader(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
    const fullDate = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Editado hoje · ${fullDate} às ${timeStr}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Editado ontem · ${fullDate} às ${timeStr}`;
    }

    return `Editado em ${fullDate} às ${timeStr}`;
  } catch {
    return '';
  }
}

function getNotePreviewLine(content: string): string {
  if (!content) return '';
  const lines = content.split('\n');
  for (const raw of lines) {
    if (raw.startsWith('[[TABLE]]:')) {
      return 'Tabela estruturada';
    }
    const cleaned = raw
      .replace(/^(##\s+|###\s+|>\s+|[☐☑•\-*]\s+|\d+\.\s+)/, '')
      .trim();
    if (cleaned.length > 0) return cleaned;
  }
  return '';
}

function getNoteChecklistProgress(content: string): { done: number; total: number } | null {
  if (!content) return null;
  const lines = content.split('\n');
  let done = 0;
  let total = 0;
  for (const line of lines) {
    if (line.startsWith('☐ ')) {
      total += 1;
    } else if (line.startsWith('☑ ')) {
      total += 1;
      done += 1;
    }
  }
  return total > 0 ? { done, total } : null;
}

function AutoResizeBlockInput({
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  className,
  inputRef,
}: {
  value: string;
  onChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  placeholder?: string;
  className?: string;
  inputRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(26, el.scrollHeight)}px`;
  }, [value, className]);

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        inputRef(el);
      }}
      rows={1}
      value={value}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={cn(
        'w-full resize-none overflow-hidden bg-transparent focus:outline-none select-text',
        className
      )}
    />
  );
}

/**
 * Superfície com brilho líquido que acompanha o movimento do cursor nas bordas
 */
function CursorGlowSurface({
  children,
  className,
  radiusPx,
  radius = 140,
  enabled = true,
  onClick,
  as = 'div',
  type = 'button',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  radiusPx?: number;
  radius?: number;
  enabled?: boolean;
  onClick?: () => void;
  as?: 'div' | 'button';
  type?: 'button' | 'submit';
  title?: string;
}) {
  const boxRef = useRef<HTMLElement | null>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const circleRadius = radius || 140;

  useEffect(() => {
    if (!enabled) {
      if (glowRef.current) glowRef.current.style.opacity = '0';
      return;
    }
    const handleMove = (e: MouseEvent) => {
      if (!boxRef.current || !glowRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = Math.max(0, -x, x - rect.width);
      const dy = Math.max(0, -y, y - rect.height);
      const dist = Math.hypot(dx, dy);
      const threshold = 115;

      if (dist < threshold) {
        const opacity = Math.max(0, 1 - dist / threshold);
        glowRef.current.style.opacity = String(opacity);
        glowRef.current.style.background = `radial-gradient(${circleRadius}px circle at ${x}px ${y}px, rgba(255,255,255,1) 0%, rgba(255,255,255,0.55) 42%, transparent 80%)`;
      } else {
        glowRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [enabled, circleRadius]);

  const glowOverlay = (
    <div
      ref={glowRef}
      style={{
        borderRadius: radiusPx ? `${radiusPx}px` : 'inherit',
        padding: '1.5px',
        WebkitMask:
          'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        opacity: 0,
        filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.95))',
      }}
      className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-150"
    />
  );

  if (as === 'button') {
    return (
      <button
        ref={(el) => {
          boxRef.current = el;
        }}
        type={type}
        title={title}
        onClick={onClick}
        style={radiusPx ? { borderRadius: `${radiusPx}px` } : undefined}
        className={cn('relative', className)}
      >
        {glowOverlay}
        {children}
      </button>
    );
  }

  return (
    <div
      ref={(el) => {
        boxRef.current = el;
      }}
      title={title}
      onClick={onClick}
      style={radiusPx ? { borderRadius: `${radiusPx}px` } : undefined}
      className={cn('relative', className)}
    >
      {glowOverlay}
      {children}
    </div>
  );
}

/**
 * Moldura da janela principal com iluminação de proximidade nas bordas
 * e no traço divisório central.
 */
function GlassWindowFrame({
  gradientConfig,
  spotlightId,
  isLocked,
  children,
}: {
  gradientConfig: GradientConfig;
  spotlightId: string;
  isLocked: boolean;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const borderGradRef = useRef<SVGRadialGradientElement>(null);
  const borderRectRef = useRef<SVGRectElement>(null);
  const dividerSpotlightRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const proximityVal = useMotionValue(0);

  const activeScale = useSpring(useTransform(proximityVal, [0, 1], [1, 1.005]), {
    stiffness: 280,
    damping: 30,
    mass: 0.7,
  });

  const rotateX = useSpring(useTransform(mouseY, [-400, 400], [1.2, -1.2]), {
    stiffness: 280,
    damping: 30,
    mass: 0.7,
  });
  const rotateY = useSpring(useTransform(mouseX, [-600, 600], [-1.2, 1.2]), {
    stiffness: 280,
    damping: 30,
    mass: 0.7,
  });

  useEffect(() => {
    if (isLocked) {
      proximityVal.set(0);
      mouseX.set(0);
      mouseY.set(0);
      if (borderRectRef.current) borderRectRef.current.style.opacity = '0';
      if (dividerSpotlightRef.current) dividerSpotlightRef.current.style.opacity = '0';
      return;
    }

    let latestClientX = 0;
    let latestClientY = 0;

    const processPointer = () => {
      rafIdRef.current = null;
      if (!windowRef.current) return;
      const rect = windowRef.current.getBoundingClientRect();

      const x = latestClientX - rect.left;
      const y = latestClientY - rect.top;

      const dxOutside = Math.max(0, -x, x - rect.width);
      const dyOutside = Math.max(0, -y, y - rect.height);
      const distOutside = Math.sqrt(dxOutside * dxOutside + dyOutside * dyOutside);

      const THRESHOLD = 180;

      if (distOutside < THRESHOLD) {
        const proximity = Math.max(0, 1 - distOutside / THRESHOLD);
        proximityVal.set(proximity);
        mouseX.set((x - rect.width / 2) * proximity);
        mouseY.set((y - rect.height / 2) * proximity);

        if (borderGradRef.current) {
          borderGradRef.current.setAttribute('cx', String(x));
          borderGradRef.current.setAttribute('cy', String(y));
        }
        if (borderRectRef.current) {
          borderRectRef.current.style.opacity = String(proximity);
        }

        if (dividerSpotlightRef.current) {
          const dividerX = dividerSpotlightRef.current.offsetLeft || 340;
          const distToDividerX = Math.abs(x - dividerX);
          const distToDivider = Math.hypot(distToDividerX, dyOutside);
          const DIVIDER_THRESHOLD = 145;

          if (distToDivider < DIVIDER_THRESHOLD) {
            const divProximity = Math.max(0, 1 - distToDivider / DIVIDER_THRESHOLD);
            dividerSpotlightRef.current.style.opacity = String(divProximity);
            dividerSpotlightRef.current.style.background = `radial-gradient(160px circle at 1.5px ${y}px, #ffffff 0%, rgba(255, 255, 255, 0.95) 35%, rgba(255, 255, 255, 0.35) 65%, transparent 85%)`;
          } else {
            dividerSpotlightRef.current.style.opacity = '0';
          }
        }
      } else {
        if (proximityVal.get() !== 0) {
          proximityVal.set(0);
          mouseX.set(0);
          mouseY.set(0);
          if (borderRectRef.current) borderRectRef.current.style.opacity = '0';
          if (dividerSpotlightRef.current) dividerSpotlightRef.current.style.opacity = '0';
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      latestClientX = e.clientX;
      latestClientY = e.clientY;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(processPointer);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isLocked, mouseX, mouseY, proximityVal]);

  return (
    <div className="w-full h-full [perspective:1000px]">
      <motion.div
        ref={windowRef}
        style={{
          scale: activeScale,
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          boxShadow:
            '0 0 24px 2px rgba(255, 255, 255, 0.35), 0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        }}
        className={cn(
          'relative w-full h-full flex overflow-hidden rounded-3xl transition-shadow duration-500',
          isLocked && 'pointer-events-none select-none opacity-85 scale-[0.995]'
        )}
      >
        {/* LINHA BASE PERIMETRAL */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none z-30 transition-all duration-500"
          style={{
            border: '1px solid rgba(255, 255, 255, 0.65)',
            boxShadow:
              '0 0 16px 2px rgba(255, 255, 255, 0.35), inset 0 0 16px 2px rgba(255, 255, 255, 0.35)',
          }}
        />

        {/* SPOTLIGHT BRANCO DINÂMICO AO REDOR DAS BORDAS E CANTOS */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
          style={{ borderRadius: '1.5rem' }}
        >
          <defs>
            <radialGradient
              id={spotlightId}
              ref={borderGradRef}
              cx="0"
              cy="0"
              r="260"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect
            ref={borderRectRef}
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="23"
            ry="23"
            fill="none"
            stroke={`url(#${spotlightId})`}
            strokeWidth="2"
            style={{
              opacity: 0,
              filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.9))',
              transition: 'opacity 150ms ease-out',
            }}
          />
        </svg>

        {/* Fundo interno translúcido com desfoque sutil */}
        <div className="absolute inset-0 blur-[3px] scale-105 pointer-events-none transform-gpu">
          <AnimatedGradient
            config={gradientConfig}
            lowRes
            noise={{ opacity: 0.03, scale: 1 }}
            className="w-full h-full opacity-35"
          />
        </div>
        <div className="absolute inset-0 bg-white/[0.18] dark:bg-slate-950/[0.32] pointer-events-none z-[1]" />

        {/* LINHA VERTICAL FIXA NA DIVISÃO DO SIDEBAR COM SPOTLIGHT DE PROXIMIDADE REAL */}
        <div
          className="hidden md:block absolute top-0 bottom-0 left-72 sm:left-80 md:left-[336px] lg:left-[356px] w-[1px] pointer-events-none z-30 transition-all duration-500"
          style={{
            background: 'rgba(255, 255, 255, 0.65)',
            boxShadow: '0 0 14px 1.5px rgba(255, 255, 255, 0.32)',
          }}
        />
        <div
          ref={dividerSpotlightRef}
          className="hidden md:block absolute top-0 bottom-0 left-72 sm:left-80 md:left-[336px] lg:left-[356px] -ml-[1.5px] w-[3px] pointer-events-none transition-opacity duration-150 z-30"
          style={{
            opacity: 0,
            filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.95))',
          }}
        />

        {/* Conteúdo interno da janela (Sidebar + Main) */}
        <div className="relative z-10 flex flex-col md:flex-row w-full h-full">{children}</div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    }
    return false;
  });

  const [user, setUser] = useState<UserData | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Modais de Perfil e Configurações
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [preferences, setPreferences] = useState<OndaPreferences>(() => loadOndaPreferences());

  // Modo da Janela Principal ('note' | 'chat') e seletor ao clicar na logo O
  const [viewMode, setViewMode] = useState<'note' | 'chat'>('note');
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState<boolean>(false);
  const [oRollAngle, setORollAngle] = useState<number>(0);

  // Estados do Sistema de Notas
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPinnedCollapsed, setIsPinnedCollapsed] = useState<boolean>(false);
  const [isFormatMenuOpen, setIsFormatMenuOpen] = useState<boolean>(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Estados do Chat com o Onda (somente quando o usuário conversa no modo Chat)
  const [isOndaThinking, setIsOndaThinking] = useState<boolean>(false);
  const [ondaConversations, setOndaConversations] = useState<
    Record<string, OndaConversationMessage[]>
  >({});
  const [ondaInput, setOndaInput] = useState<string>('');
  const [addedLinesFeedback, setAddedLinesFeedback] = useState<string | null>(null);
  const [addedTableFeedback, setAddedTableFeedback] = useState<string | null>(null);
  const [appliedNoteFeedback, setAppliedNoteFeedback] = useState<string | null>(null);

  // Rascunho local da nota ativa (Título + Blocos Visuais Ricos)
  const [titleDraft, setTitleDraft] = useState<string>('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([
    { id: 'initial_blk', type: 'body', text: '' },
  ]);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveFnRef = useRef<(() => Promise<void>) | null>(null);
  const ondaScrollRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Fecha menu Aa ou menu de botão direito ao clicar fora
  useEffect(() => {
    if (!isFormatMenuOpen && !contextMenuPos) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (isFormatMenuOpen && formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setIsFormatMenuOpen(false);
      }
      if (contextMenuPos && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isFormatMenuOpen, contextMenuPos]);

  // Sincroniza estado de autenticação real com o Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let role = 'Criador & Estrategista';
        let customPhotoURL: string | undefined = firebaseUser.photoURL || undefined;
        let customName = firebaseUser.displayName || 'Usuário Onda';

        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role) role = data.role;
            if (data.name) customName = data.name;
            if ('photoURL' in data) {
              customPhotoURL = data.photoURL || undefined;
            }
          }
        } catch (e) {
          console.warn('Não foi possível buscar perfil do Firestore:', e);
        }

        const userData: UserData = {
          uid: firebaseUser.uid,
          name: customName,
          email: firebaseUser.email || '',
          photoURL: customPhotoURL,
          role,
        };

        setUser(userData);
      } else {
        setUser(null);
      }
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  // Sincroniza Notas no Firestore (coleção users/{uid}/items)
  useEffect(() => {
    if (!user?.uid) {
      setNotes([]);
      setActiveNoteId(null);
      return;
    }

    const path = `users/${user.uid}/items`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: NoteItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const created = d.createdAt || new Date().toISOString();
          return {
            id: docSnap.id,
            userId: d.userId || user.uid!,
            categoryId: d.categoryId || 'icloud_notes',
            title: typeof d.title === 'string' ? d.title : '',
            content: typeof d.content === 'string' ? d.content : '',
            itemType: 'note',
            completed: Boolean(d.completed),
            createdAt: created,
            updatedAt: d.updatedAt || created,
          };
        });

        loaded.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        setNotes(loaded);
        setActiveNoteId((prev) => {
          if (prev && loaded.some((n) => n.id === prev)) return prev;
          return loaded.length > 0 ? loaded[0].id : null;
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  // Carrega a nota ativa nos blocos visuais quando o ID da nota selecionada muda
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingSaveFnRef.current) {
      const flush = pendingSaveFnRef.current;
      pendingSaveFnRef.current = null;
      void flush();
    }

    if (activeNote) {
      setTitleDraft(activeNote.title === 'Nova Nota' ? '' : activeNote.title);
      const parsed = parseContentToBlocks(activeNote.content || '');
      setBlocks(parsed);
      setFocusedBlockId(parsed[0]?.id || null);
    } else {
      setTitleDraft('');
      setBlocks([{ id: createBlockId(), type: 'body', text: '' }]);
      setFocusedBlockId(null);
    }
    setOndaInput('');
    setIsFormatMenuOpen(false);
  }, [activeNote?.id]);

  // Persiste alterações da nota no Firestore com debounce e flush seguro
  const persistNoteChanges = useCallback(
    (noteId: string, nextTitle: string, nextBlocks: NoteBlock[], currentNote?: NoteItem) => {
      if (!user?.uid) return;
      const now = new Date().toISOString();
      const serializedContent = serializeBlocksToContent(nextBlocks).slice(0, 9500);
      const cleanTitle = nextTitle.trim().slice(0, 480) || 'Nova Nota';

      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, title: cleanTitle, content: serializedContent, updatedAt: now }
            : n
        )
      );

      const performSave = async () => {
        try {
          await setDoc(
            doc(db, 'users', user.uid!, 'items', noteId),
            {
              id: noteId,
              userId: user.uid!,
              categoryId: currentNote?.categoryId || 'icloud_notes',
              title: cleanTitle,
              content: serializedContent,
              itemType: 'note',
              completed: Boolean(currentNote?.completed),
              createdAt: currentNote?.createdAt || now,
              updatedAt: now,
            },
            { merge: true }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/items/${noteId}`);
        }
      };

      pendingSaveFnRef.current = performSave;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        pendingSaveFnRef.current = null;
        void performSave();
      }, 260);
    },
    [user?.uid]
  );

  const updateBlocksAndPersist = useCallback(
    (nextBlocks: NoteBlock[]) => {
      const safeBlocks =
        nextBlocks.length > 0
          ? nextBlocks
          : [{ id: createBlockId(), type: 'body' as NoteBlockType, text: '' }];
      setBlocks(safeBlocks);
      if (activeNote) {
        persistNoteChanges(activeNote.id, titleDraft, safeBlocks, activeNote);
      }
    },
    [activeNote, persistNoteChanges, titleDraft]
  );

  // Insere linhas sugeridas pelo Onda diretamente na nota
  const handleInsertOndaLines = useCallback(
    (linesToInsert: string[], msgId?: string) => {
      if (!activeNote || !linesToInsert.length) return;

      const createdBlocks: NoteBlock[] = linesToInsert.map((rawLine) => {
        const clean = rawLine.replace(/^[☐☑•\-*]\s*/, '').trim();
        return {
          id: createBlockId(),
          type: 'todo',
          text: clean,
          checked: false,
        };
      });

      setBlocks((prev) => {
        const isSingleEmpty =
          prev.length === 1 && prev[0].type === 'body' && !prev[0].text.trim();
        const next = isSingleEmpty ? createdBlocks : [...prev, ...createdBlocks];
        persistNoteChanges(activeNote.id, titleDraft, next, activeNote);
        return next;
      });

      if (msgId) {
        setAddedLinesFeedback(msgId);
        setTimeout(() => {
          setAddedLinesFeedback((prev) => (prev === msgId ? null : prev));
        }, 2000);
      }
    },
    [activeNote, persistNoteChanges, titleDraft]
  );

  // Insere tabela inteligente gerada pelo Onda diretamente na folha
  const handleInsertOndaTable = useCallback(
    (tableData: string[][], msgId?: string) => {
      if (!activeNote || !tableData.length) return;
      const newTableBlock: NoteBlock = {
        id: createBlockId(),
        type: 'table',
        text: '',
        tableData,
      };
      const trailingBody: NoteBlock = {
        id: createBlockId(),
        type: 'body',
        text: '',
      };

      setBlocks((prev) => {
        const next = [...prev, newTableBlock, trailingBody];
        persistNoteChanges(activeNote.id, titleDraft, next, activeNote);
        return next;
      });

      if (msgId) {
        setAddedTableFeedback(msgId);
        setTimeout(() => {
          setAddedTableFeedback((prev) => (prev === msgId ? null : prev));
        }, 2000);
      }
    },
    [activeNote, persistNoteChanges, titleDraft]
  );

  // Aplica substituição ou ajuste completo da nota feito pela IA no Chat
  const handleApplyNoteAdjustment = useCallback(
    (newTitle?: string, newContent?: string, msgId?: string) => {
      if (!activeNote) return;
      const finalTitle = newTitle?.trim() ? newTitle.trim() : titleDraft;
      const finalBlocks =
        typeof newContent === 'string' && newContent.trim()
          ? parseContentToBlocks(newContent)
          : blocks;

      setTitleDraft(finalTitle);
      setBlocks(finalBlocks);
      persistNoteChanges(activeNote.id, finalTitle, finalBlocks, activeNote);

      if (msgId) {
        setAppliedNoteFeedback(msgId);
        setTimeout(() => {
          setAppliedNoteFeedback((prev) => (prev === msgId ? null : prev));
        }, 2200);
      }
    },
    [activeNote, titleDraft, blocks, persistNoteChanges]
  );

  // Conversa com o Onda exclusivamente na aba Chat e permite que ele ajuste a nota ativa
  const sendChatMessageToOnda = useCallback(
    async (userMsg: string) => {
      if (!activeNote || !userMsg.trim()) return;
      const serialized = serializeBlocksToContent(blocks).trim();
      const currentTitle = (
        titleDraft.trim() ||
        (activeNote.title !== 'Nova Nota' ? activeNote.title : '')
      ).trim();

      const existingHistory = ondaConversations[activeNote.id] || [];
      const userEntry: OndaConversationMessage = {
        id: `msg_${Date.now()}_u`,
        sender: 'user',
        text: userMsg.trim(),
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = [...existingHistory, userEntry];
      setOndaConversations((prev) => ({
        ...prev,
        [activeNote.id]: updatedHistory,
      }));

      const otherNotesSummary = notes
        .filter((n) => n.id !== activeNote.id && (n.title !== 'Nova Nota' || n.content))
        .slice(0, 4)
        .map((n) => `- ${n.title}: ${getNotePreviewLine(n.content)}`)
        .join('\n');

      setIsOndaThinking(true);
      try {
        const reply = await talkToOndaFriend({
          userName: user?.name,
          noteTitle: currentTitle,
          noteContent: serialized,
          userMessage: userMsg.trim(),
          conversationHistory: updatedHistory.map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
          otherNotesSummary,
        });

        const ondaEntry: OndaConversationMessage = {
          id: `msg_${Date.now()}_o`,
          sender: 'onda',
          text: reply.message,
          mood: reply.mood,
          updatedNoteTitle: reply.updatedNoteTitle,
          replaceEntireNoteContent: reply.replaceEntireNoteContent,
          autoApplyToNote: reply.autoApplyToNote,
          writeToNoteLabel: reply.writeToNoteLabel,
          writeToNoteLines: reply.writeToNoteLines,
          smartTableLabel: reply.smartTableLabel,
          smartTableData: reply.smartTableData,
          createdAt: new Date().toISOString(),
        };

        setOndaConversations((prev) => ({
          ...prev,
          [activeNote.id]: [...(prev[activeNote.id] || []), ondaEntry],
        }));

        if (reply.autoApplyToNote) {
          if (reply.replaceEntireNoteContent || reply.updatedNoteTitle) {
            handleApplyNoteAdjustment(
              reply.updatedNoteTitle,
              reply.replaceEntireNoteContent,
              ondaEntry.id
            );
          } else if (reply.writeToNoteLines && reply.writeToNoteLines.length > 0) {
            handleInsertOndaLines(reply.writeToNoteLines, ondaEntry.id);
          } else if (reply.smartTableData && reply.smartTableData.length > 0) {
            handleInsertOndaTable(reply.smartTableData, ondaEntry.id);
          }
        }
      } finally {
        setIsOndaThinking(false);
      }
    },
    [
      activeNote,
      blocks,
      titleDraft,
      ondaConversations,
      notes,
      user?.name,
      handleApplyNoteAdjustment,
      handleInsertOndaLines,
      handleInsertOndaTable,
    ]
  );

  // Rola suavemente para a última mensagem do Chat quando chega resposta
  const activeConversation = useMemo(
    () => (activeNote ? ondaConversations[activeNote.id] || [] : []),
    [activeNote, ondaConversations]
  );

  useEffect(() => {
    if (ondaScrollRef.current) {
      ondaScrollRef.current.scrollTop = ondaScrollRef.current.scrollHeight;
    }
  }, [activeConversation.length, isOndaThinking, viewMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Bloqueia zoom por atalhos e scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' ||
          e.key === '-' ||
          e.key === '=' ||
          e.key === '_' ||
          e.key === '0' ||
          e.code === 'Equal' ||
          e.code === 'Minus' ||
          e.code === 'NumpadAdd' ||
          e.code === 'NumpadSubtract' ||
          e.code === 'Digit0' ||
          e.code === 'Numpad0')
      ) {
        e.preventDefault();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const handleGesture = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('gesturestart', handleGesture, { passive: false });
    window.addEventListener('gesturechange', handleGesture, { passive: false });
    window.addEventListener('gestureend', handleGesture, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('gesturestart', handleGesture);
      window.removeEventListener('gesturechange', handleGesture);
      window.removeEventListener('gestureend', handleGesture);
    };
  }, []);

  // Cria uma nova nota em branco e já coloca o foco no título
  const handleCreateNewNote = useCallback(async () => {
    if (!user?.uid) return;

    const currentContent = serializeBlocksToContent(blocks).trim();
    if (
      activeNote &&
      (activeNote.title === 'Nova Nota' || !activeNote.title.trim()) &&
      !activeNote.content.trim() &&
      !titleDraft.trim() &&
      !currentContent
    ) {
      titleInputRef.current?.focus();
      return;
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const firstBlock: NoteBlock = { id: createBlockId(), type: 'body', text: '' };
    const newNote: NoteItem = {
      id: noteId,
      userId: user.uid,
      categoryId: 'icloud_notes',
      title: 'Nova Nota',
      content: '',
      itemType: 'note',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(noteId);
    setTitleDraft('');
    setBlocks([firstBlock]);
    setFocusedBlockId(firstBlock.id);
    setIsMobileSidebarOpen(false);

    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 30);

    try {
      await setDoc(doc(db, 'users', user.uid, 'items', noteId), newNote);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/items/${noteId}`);
    }
  }, [user?.uid, activeNote, titleDraft, blocks]);

  const handleDeleteNote = async (noteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.uid || !noteId) return;

    const remaining = notes.filter((n) => n.id !== noteId);
    setNotes(remaining);
    if (activeNoteId === noteId) {
      setActiveNoteId(remaining.length > 0 ? remaining[0].id : null);
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'items', noteId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/items/${noteId}`);
    }
  };

  const handleTogglePinNote = async (note: NoteItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.uid) return;
    const nextPinned = !note.completed;
    const now = new Date().toISOString();

    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, completed: nextPinned, updatedAt: now } : n))
    );

    try {
      await setDoc(
        doc(db, 'users', user.uid, 'items', note.id),
        {
          userId: user.uid,
          categoryId: note.categoryId || 'icloud_notes',
          title: note.title || 'Nova Nota',
          content: note.content || '',
          itemType: 'note',
          completed: nextPinned,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/items/${note.id}`);
    }
  };

  const handleTitleChange = (val: string) => {
    setTitleDraft(val);
    if (activeNote) {
      persistNoteChanges(activeNote.id, val, blocks, activeNote);
    }
  };

  const handleSendToOnda = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = ondaInput.trim();
    if (!clean || !activeNote || isOndaThinking) return;
    setOndaInput('');
    await sendChatMessageToOnda(clean);
  };

  const handleBlockTextChange = (blockId: string, val: string) => {
    if (preferences.slashShortcutsEnabled) {
      if (val === '/t ' || val === '/tabela ') {
        handleInsertTable();
        return;
      }
      if (val.startsWith('/c ') || val.startsWith('[] ') || val.startsWith('[ ] ')) {
        const sliceLen = val.startsWith('[ ] ') ? 4 : 3;
        const nextBlocks = blocks.map((b) =>
          b.id === blockId
            ? { ...b, type: 'todo' as NoteBlockType, checked: false, text: val.slice(sliceLen) }
            : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }
      if (val.startsWith('/h ') || val.startsWith('## ')) {
        const nextBlocks = blocks.map((b) =>
          b.id === blockId ? { ...b, type: 'heading' as NoteBlockType, text: val.slice(3) } : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }
      if (val.startsWith('/s ') || val.startsWith('### ')) {
        const sliceLen = val.startsWith('### ') ? 4 : 3;
        const nextBlocks = blocks.map((b) =>
          b.id === blockId
            ? { ...b, type: 'subheading' as NoteBlockType, text: val.slice(sliceLen) }
            : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }
      if (val.startsWith('/q ') || val.startsWith('> ')) {
        const sliceLen = val.startsWith('/q ') ? 3 : 2;
        const nextBlocks = blocks.map((b) =>
          b.id === blockId ? { ...b, type: 'quote' as NoteBlockType, text: val.slice(sliceLen) } : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }
      if (val.startsWith('- ') || val.startsWith('* ')) {
        const nextBlocks = blocks.map((b) =>
          b.id === blockId ? { ...b, type: 'bullet' as NoteBlockType, text: val.slice(2) } : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }
    }

    if (val.includes('\n')) {
      const pastedLines = val.split('\n');
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      const current = blocks[idx];
      const firstLine = pastedLines[0];
      const extraBlocks: NoteBlock[] = pastedLines.slice(1).map((lineText) => ({
        id: createBlockId(),
        type:
          current.type === 'heading' || current.type === 'subheading'
            ? 'body'
            : current.type,
        text: lineText,
        checked: false,
      }));
      const nextBlocks = [
        ...blocks.slice(0, idx),
        { ...current, text: firstLine },
        ...extraBlocks,
        ...blocks.slice(idx + 1),
      ];
      updateBlocksAndPersist(nextBlocks);
      const lastAdded = extraBlocks[extraBlocks.length - 1];
      if (lastAdded) {
        setTimeout(() => {
          const el = blockRefs.current[lastAdded.id];
          el?.focus();
        }, 20);
      }
      return;
    }

    const nextBlocks = blocks.map((b) => (b.id === blockId ? { ...b, text: val } : b));
    updateBlocksAndPersist(nextBlocks);
  };

  const handleToggleTodoCheck = (blockId: string) => {
    const nextBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, checked: !b.checked } : b
    );
    updateBlocksAndPersist(nextBlocks);
  };

  const handleBlockKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    block: NoteBlock,
    idx: number
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (
        !block.text.trim() &&
        (block.type === 'todo' ||
          block.type === 'bullet' ||
          block.type === 'numbered' ||
          block.type === 'quote')
      ) {
        const nextBlocks = blocks.map((b) =>
          b.id === block.id ? { ...b, type: 'body' as NoteBlockType, checked: false } : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }

      const nextType: NoteBlockType =
        block.type === 'todo' || block.type === 'bullet' || block.type === 'numbered'
          ? block.type
          : 'body';

      const newBlock: NoteBlock = {
        id: createBlockId(),
        type: nextType,
        text: '',
        checked: false,
      };

      const nextBlocks = [
        ...blocks.slice(0, idx),
        block,
        newBlock,
        ...blocks.slice(idx + 1),
      ];
      updateBlocksAndPersist(nextBlocks);
      setFocusedBlockId(newBlock.id);

      setTimeout(() => {
        const el = blockRefs.current[newBlock.id];
        el?.focus();
      }, 15);
    } else if (
      e.key === 'Backspace' &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      if (block.type !== 'body') {
        e.preventDefault();
        const nextBlocks = blocks.map((b) =>
          b.id === block.id ? { ...b, type: 'body' as NoteBlockType, checked: false } : b
        );
        updateBlocksAndPersist(nextBlocks);
        return;
      }

      if (idx === 0) {
        e.preventDefault();
        const len = titleDraft.length;
        titleInputRef.current?.focus();
        titleInputRef.current?.setSelectionRange(len, len);
        return;
      }

      const prevBlock = blocks[idx - 1];
      if (prevBlock && prevBlock.type !== 'table') {
        e.preventDefault();
        const cursorTarget = prevBlock.text.length;
        const mergedText = prevBlock.text + block.text;
        const nextBlocks = blocks
          .map((b, i) => (i === idx - 1 ? { ...b, text: mergedText } : b))
          .filter((_, i) => i !== idx);
        updateBlocksAndPersist(nextBlocks);
        setFocusedBlockId(prevBlock.id);
        setTimeout(() => {
          const el = blockRefs.current[prevBlock.id];
          if (el) {
            el.focus();
            el.setSelectionRange(cursorTarget, cursorTarget);
          }
        }, 15);
      }
    } else if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      if (idx === 0) {
        const len = titleDraft.length;
        titleInputRef.current?.focus();
        titleInputRef.current?.setSelectionRange(len, len);
      } else {
        const prevBlock = blocks[idx - 1];
        if (prevBlock && prevBlock.type !== 'table') {
          const el = blockRefs.current[prevBlock.id];
          if (el) {
            el.focus();
            el.setSelectionRange(prevBlock.text.length, prevBlock.text.length);
          }
        }
      }
    } else if (
      e.key === 'ArrowDown' &&
      e.currentTarget.selectionStart === block.text.length
    ) {
      const nextBlock = blocks[idx + 1];
      if (nextBlock && nextBlock.type !== 'table') {
        e.preventDefault();
        const el = blockRefs.current[nextBlock.id];
        if (el) {
          el.focus();
          el.setSelectionRange(0, 0);
        }
      }
    }
  };

  const applyBlockStyle = (targetType: NoteBlockType) => {
    if (!activeNote) return;
    const targetId = focusedBlockId || blocks[blocks.length - 1]?.id;
    if (!targetId) return;

    const nextBlocks = blocks.map((b) =>
      b.id === targetId
        ? {
            ...b,
            type: b.type === targetType ? ('body' as NoteBlockType) : targetType,
          }
        : b
    );
    updateBlocksAndPersist(nextBlocks);
    setIsFormatMenuOpen(false);
    setContextMenuPos(null);
    setTimeout(() => {
      blockRefs.current[targetId]?.focus();
    }, 20);
  };

  const handleInsertOrToggleChecklist = () => {
    if (!activeNote) return;
    const targetId = focusedBlockId || blocks[blocks.length - 1]?.id;
    if (!targetId) return;

    const nextBlocks = blocks.map((b) =>
      b.id === targetId
        ? {
            ...b,
            type: b.type === 'todo' ? ('body' as NoteBlockType) : ('todo' as NoteBlockType),
            checked: false,
          }
        : b
    );
    updateBlocksAndPersist(nextBlocks);
    setContextMenuPos(null);
    setTimeout(() => {
      blockRefs.current[targetId]?.focus();
    }, 20);
  };

  const handleInsertTable = () => {
    if (!activeNote) return;
    const newTableBlock: NoteBlock = {
      id: createBlockId(),
      type: 'table',
      text: '',
      tableData: [
        ['Item', 'Detalhe', 'Status'],
        ['', '', ''],
        ['', '', ''],
      ],
    };
    const trailingBody: NoteBlock = {
      id: createBlockId(),
      type: 'body',
      text: '',
    };

    const idx = focusedBlockId
      ? blocks.findIndex((b) => b.id === focusedBlockId)
      : blocks.length - 1;
    const insertIdx = idx >= 0 ? idx + 1 : blocks.length;

    const nextBlocks = [
      ...blocks.slice(0, insertIdx),
      newTableBlock,
      trailingBody,
      ...blocks.slice(insertIdx),
    ];
    updateBlocksAndPersist(nextBlocks);
    setContextMenuPos(null);
  };

  const handleUpdateTableCell = (
    blockId: string,
    rowIndex: number,
    colIndex: number,
    val: string
  ) => {
    const nextBlocks = blocks.map((b) => {
      if (b.id !== blockId || !b.tableData) return b;
      const nextTable = b.tableData.map((row, rIdx) =>
        rIdx === rowIndex
          ? row.map((cell, cIdx) => (cIdx === colIndex ? val : cell))
          : row
      );
      return { ...b, tableData: nextTable };
    });
    updateBlocksAndPersist(nextBlocks);
  };

  const handleAddTableRow = (blockId: string) => {
    const nextBlocks = blocks.map((b) => {
      if (b.id !== blockId || !b.tableData) return b;
      const cols = b.tableData[0]?.length || 2;
      return {
        ...b,
        tableData: [...b.tableData, Array(cols).fill('')],
      };
    });
    updateBlocksAndPersist(nextBlocks);
  };

  const handleAddTableCol = (blockId: string) => {
    const nextBlocks = blocks.map((b) => {
      if (b.id !== blockId || !b.tableData) return b;
      return {
        ...b,
        tableData: b.tableData.map((row, rIdx) => [
          ...row,
          rIdx === 0 ? `Coluna ${row.length + 1}` : '',
        ]),
      };
    });
    updateBlocksAndPersist(nextBlocks);
  };

  const handleDeleteBlock = (blockId: string) => {
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    updateBlocksAndPersist(nextBlocks);
  };

  const handleExportAllNotes = () => {
    if (!notes.length) return;
    const textDump = notes
      .map((n) => {
        const dateStr = formatSidebarNoteDate(n.updatedAt);
        return `# ${n.title || 'Nova Nota'} (${dateStr})\n\n${n.content || ''}\n\n---\n`;
      })
      .join('\n');
    const blob = new Blob([textDump], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onda-notas-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.completed),
    [filteredNotes]
  );

  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((n) => !n.completed),
    [filteredNotes]
  );

  const handleLogout = async () => {
    try {
      setIsAccountOpen(false);
      setIsSettingsOpen(false);
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error('Erro ao sair da conta:', error);
    }
  };

  const handleSaveAccount = async (updated: {
    name: string;
    email: string;
    role: string;
    photoURL?: string;
  }) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            photoURL: updated.photoURL,
          }
        : null
    );
    const targetUid = auth.currentUser?.uid || user?.uid;
    if (targetUid) {
      try {
        await setDoc(
          doc(db, 'users', targetUid),
          {
            name: updated.name,
            email: updated.email,
            role: updated.role,
            photoURL: updated.photoURL || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
      }
    }
  };

  const gradientConfig: GradientConfig = useMemo(() => {
    return isDark
      ? {
          preset: 'custom',
          color1: '#0c1938',
          color2: '#3b82f6',
          color3: '#2563eb',
          rotation: -45,
          proportion: 46,
          scale: 0.02,
          speed: 10,
          distortion: 5,
          swirl: 50,
          swirlIterations: 12,
          softness: 75,
          offset: 0,
          shape: 'Checks',
          shapeSize: 35,
        }
      : {
          preset: 'custom',
          color1: '#dbeafe',
          color2: '#3b82f6',
          color3: '#ffffff',
          rotation: -45,
          proportion: 40,
          scale: 0.03,
          speed: 10,
          distortion: 5,
          swirl: 45,
          swirlIterations: 12,
          softness: 70,
          offset: 0,
          shape: 'Checks',
          shapeSize: 35,
        };
  }, [isDark]);

  const zoomedGradientConfig: GradientConfig = useMemo(() => {
    return isDark
      ? {
          preset: 'custom',
          color1: '#0a1530',
          color2: '#3b82f6',
          color3: '#1d4ed8',
          rotation: -45,
          proportion: 55,
          scale: 0.06,
          speed: 8,
          distortion: 6,
          swirl: 50,
          swirlIterations: 12,
          softness: 80,
          offset: 0,
          shape: 'Checks',
          shapeSize: 68,
        }
      : {
          preset: 'custom',
          color1: '#dbeafe',
          color2: '#3b82f6',
          color3: '#ffffff',
          rotation: -45,
          proportion: 50,
          scale: 0.07,
          speed: 8,
          distortion: 6,
          swirl: 45,
          swirlIterations: 12,
          softness: 75,
          offset: 0,
          shape: 'Checks',
          shapeSize: 68,
        };
  }, [isDark]);

  const getNumberedIndex = (idx: number): number => {
    let count = 1;
    for (let i = idx - 1; i >= 0; i--) {
      if (blocks[i]?.type === 'numbered') count++;
      else break;
    }
    return count;
  };

  const renderSidebarNoteCard = (note: NoteItem) => {
    const isSelected = activeNote?.id === note.id;
    const liveContent = isSelected ? serializeBlocksToContent(blocks) : note.content;
    const displayTitle =
      isSelected && titleDraft.trim()
        ? titleDraft.trim()
        : note.title && note.title !== 'Nova Nota'
        ? note.title
        : 'Nova Nota';
    const previewText = getNotePreviewLine(liveContent);
    const dateLabel = formatSidebarNoteDate(note.updatedAt);
    const progress = getNoteChecklistProgress(liveContent);

    return (
      <CursorGlowSurface
        key={note.id}
        enabled={preferences.cursorGlowEnabled}
        radius={160}
        onClick={() => {
          setActiveNoteId(note.id);
          setIsMobileSidebarOpen(false);
        }}
        className={cn(
          'group relative w-full rounded-2xl px-4 py-3 text-left transition-all duration-200 cursor-pointer overflow-hidden',
          isSelected
            ? 'bg-white/50 dark:bg-white/[0.14] border border-white/85 dark:border-white/35 shadow-[0_8px_24px_rgba(0,0,0,0.07),0_0_16px_rgba(255,255,255,0.22)]'
            : 'bg-transparent hover:bg-white/25 dark:hover:bg-white/[0.06] border border-transparent hover:border-white/35 dark:hover:border-white/15'
        )}
      >
        {isSelected && (
          <motion.div
            layoutId="sidebar-active-pill"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="absolute left-1.5 top-3 bottom-3 w-[3px] rounded-full bg-slate-900 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
          />
        )}

        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-slate-950 dark:text-white truncate leading-snug">
            {displayTitle}
          </h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={(e) => handleTogglePinNote(note, e)}
              title={note.completed ? 'Desafixar nota' : 'Fixar nota'}
              className={cn(
                'p-1 rounded-lg transition-all cursor-pointer',
                note.completed
                  ? 'opacity-100 text-slate-900 dark:text-white'
                  : 'opacity-0 group-hover:opacity-80 text-slate-700 dark:text-white/70 hover:opacity-100 hover:bg-white/40 dark:hover:bg-white/15'
              )}
            >
              <Pin className={cn('w-3.5 h-3.5', note.completed && 'fill-current')} />
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteNote(note.id, e)}
              title="Excluir nota"
              className="p-1 rounded-lg opacity-0 group-hover:opacity-80 hover:opacity-100 text-slate-700 dark:text-white/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-white/40 dark:hover:bg-white/15 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 text-[12.5px] min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-semibold text-slate-900/85 dark:text-white/85 shrink-0 tabular-nums">
              {dateLabel}
            </span>
            {previewText && (
              <span className="text-slate-700/80 dark:text-white/60 truncate">
                {previewText}
              </span>
            )}
          </div>

          {progress && (
            <span className="text-[11px] font-semibold text-slate-800/80 dark:text-white/75 shrink-0 tabular-nums">
              {progress.done}/{progress.total}
            </span>
          )}
        </div>
      </CursorGlowSurface>
    );
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen w-full bg-[#05070e] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeBlock = blocks.find((b) => b.id === focusedBlockId) || blocks[0];
  const userFirstName = user?.name ? user.name.split(' ')[0] : '';
  const bodyFontSizeClass =
    preferences.editorFontSize === 'sm'
      ? 'text-[14.5px]'
      : preferences.editorFontSize === 'lg'
      ? 'text-[17.5px]'
      : 'text-[16px]';

  const renderFormatMenuItems = () => (
    <>
      <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-white/50">
        Estilo da linha
      </div>
      <button
        type="button"
        onClick={() => applyBlockStyle('heading')}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[15.5px] font-bold text-slate-950 dark:text-white hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'heading' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span>Título de Seção</span>
        {activeBlock?.type === 'heading' && <Check className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => applyBlockStyle('subheading')}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[14px] font-semibold text-slate-800 dark:text-white/90 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'subheading' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span>Subtítulo</span>
        {activeBlock?.type === 'subheading' && <Check className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => applyBlockStyle('body')}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] text-slate-800 dark:text-white/85 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'body' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span>Corpo de texto</span>
        {activeBlock?.type === 'body' && <Check className="w-4 h-4" />}
      </button>

      <div className="my-1 border-t border-slate-200/70 dark:border-white/10" />

      <button
        type="button"
        onClick={handleInsertOrToggleChecklist}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] text-slate-800 dark:text-white/85 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'todo' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <ListTodo className="w-4 h-4" />
          <span>Checklist</span>
        </span>
        {activeBlock?.type === 'todo' && <Check className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => applyBlockStyle('bullet')}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] text-slate-800 dark:text-white/85 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'bullet' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <List className="w-4 h-4" />
          <span>Lista com marcadores</span>
        </span>
        {activeBlock?.type === 'bullet' && <Check className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => applyBlockStyle('numbered')}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] text-slate-800 dark:text-white/85 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'numbered' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <ListOrdered className="w-4 h-4" />
          <span>Lista numerada</span>
        </span>
        {activeBlock?.type === 'numbered' && <Check className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={() => applyBlockStyle('quote')}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] text-slate-800 dark:text-white/85 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer',
          activeBlock?.type === 'quote' && 'bg-blue-500/15 dark:bg-blue-400/20'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Quote className="w-4 h-4" />
          <span>Citação</span>
        </span>
        {activeBlock?.type === 'quote' && <Check className="w-4 h-4" />}
      </button>

      <button
        type="button"
        onClick={handleInsertTable}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] text-slate-800 dark:text-white/85 hover:bg-slate-900/5 dark:hover:bg-white/10 cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <Table2 className="w-4 h-4" />
          <span>Inserir tabela</span>
        </span>
      </button>
    </>
  );

  return (
    <div className="relative h-dvh md:h-screen w-full px-2.5 sm:px-8 md:px-12 py-2.5 sm:py-8 flex items-center justify-center font-sans antialiased select-none overflow-hidden transition-colors duration-500 [perspective:1000px]">
      {/* 1. Fundo externo líquido interativo com o mouse */}
      <div className="fixed -inset-16 scale-125 blur-[12px] origin-center pointer-events-none z-0 transform-gpu">
        <AnimatedGradient
          config={zoomedGradientConfig}
          lowRes
          noise={{ opacity: 0.04, scale: 1 }}
          className="w-full h-full"
        />
      </div>
      <div className="fixed inset-0 bg-slate-950/28 dark:bg-slate-950/42 pointer-events-none z-[1]" />

      {/* 2. Janela Principal Fixa — Notas & Chat na mesma janela */}
      <div className="relative z-10 w-[96vw] sm:w-[92vw] max-w-[1720px] h-[93dvh] sm:h-[88vh] min-h-0 md:min-h-[560px] max-h-[920px]">
        <GlassWindowFrame
          gradientConfig={gradientConfig}
          spotlightId="border-spotlight-main"
          isLocked={!user}
        >
          {/* Barra Superior Mobile (< 768px) */}
          <div className="flex md:hidden items-center justify-between px-4 py-2.5 border-b border-white/35 dark:border-white/15 bg-white/20 dark:bg-slate-950/30 backdrop-blur-md shrink-0 z-30">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              className="p-2 rounded-xl bg-white/40 dark:bg-white/15 border border-white/60 dark:border-white/25 text-slate-900 dark:text-white cursor-pointer"
              aria-label="Menu lateral"
            >
              {isMobileSidebarOpen ? (
                <X className="w-4.5 h-4.5" />
              ) : (
                <Menu className="w-4.5 h-4.5" />
              )}
            </button>

            <OndaLogo3D className="h-8 w-auto" />

            <div className="flex items-center gap-2">
              {user && (
                <SidebarAccount
                  user={user}
                  isDark={isDark}
                  onToggleTheme={() => setIsDark(!isDark)}
                  onOpenAuth={() => setUser(null)}
                  onOpenAccountModal={() => setIsAccountOpen(true)}
                  onOpenSettingsModal={() => setIsSettingsOpen(true)}
                />
              )}
            </div>
          </div>

          {/* Backdrop do Menu Mobile (< 768px) */}
          {isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden absolute inset-0 bg-slate-950/30 backdrop-blur-[3px] z-30"
            />
          )}

          {/* =========================================================
              SIDEBAR ÚNICA DE NOTAS (Logo Onda no topo + Logo O centralizada na parte inferior)
             ========================================================= */}
          <aside
            className={cn(
              'relative w-72 sm:w-80 md:w-[336px] lg:w-[356px] shrink-0 flex flex-col justify-between min-h-0 h-full p-4 sm:p-5 bg-white/80 dark:bg-slate-950/85 md:bg-white/[0.06] md:dark:bg-slate-950/[0.15] backdrop-blur-xl md:backdrop-blur-none transition-transform duration-200 z-40 md:z-auto',
              'max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:border-r max-md:border-white/50',
              isMobileSidebarOpen
                ? 'max-md:translate-x-0'
                : 'max-md:-translate-x-full md:translate-x-0'
            )}
          >
            <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Topo com a Logo Completa "Onda" */}
              <div className="flex items-center justify-between md:justify-center mb-3.5 px-1 shrink-0">
                <div className="w-7 md:hidden" />
                <OndaLogo3D className="h-9 sm:h-10 w-auto" />
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="md:hidden p-1.5 rounded-xl bg-white/40 dark:bg-white/15 text-slate-900 dark:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Barra de Busca Integrada com Botão de Nova Nota (ambos com brilho no cursor) */}
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <CursorGlowSurface
                  enabled={preferences.cursorGlowEnabled}
                  radius={150}
                  className="relative flex-1 min-w-0 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/70 dark:border-white/22 shadow-2xs"
                >
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-700/75 dark:text-white/60 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar notas..."
                    className="w-full pl-9.5 pr-7 py-2 rounded-2xl bg-transparent text-[13px] font-medium text-slate-950 dark:text-white placeholder:text-slate-700/65 dark:placeholder:text-white/50 focus:outline-none focus:bg-white/40 dark:focus:bg-white/[0.08] transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-700/75 dark:text-white/60 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </CursorGlowSurface>

                <CursorGlowSurface
                  as="button"
                  type="button"
                  enabled={preferences.cursorGlowEnabled}
                  radius={110}
                  onClick={handleCreateNewNote}
                  title="Nova nota"
                  className="h-[38px] px-3 rounded-2xl bg-white/55 dark:bg-white/[0.14] hover:bg-white/80 dark:hover:bg-white/[0.24] border border-white/80 dark:border-white/30 text-slate-950 dark:text-white flex items-center justify-center gap-1.5 text-[12.5px] font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <SquarePen className="w-3.5 h-3.5" />
                  <span>Nova</span>
                </CursorGlowSurface>
              </div>

              {/* Lista de Notas */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-0.5 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {filteredNotes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/40 dark:bg-white/10 border border-white/65 dark:border-white/20 flex items-center justify-center mb-2.5 text-slate-800 dark:text-white/80">
                      <FileText className="w-5 h-5" />
                    </div>
                    <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white/90">
                      {searchQuery.trim() ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda'}
                    </p>
                    <p className="text-[12px] text-slate-700/75 dark:text-white/55 mt-0.5">
                      {searchQuery.trim()
                        ? 'Tente outro termo na busca.'
                        : 'Clique em "Nova" para começar a escrever.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {pinnedNotes.length > 0 && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setIsPinnedCollapsed((prev) => !prev)}
                          className="w-full flex items-center justify-between px-2 py-1 text-[11.5px] font-bold tracking-wide text-slate-800/85 dark:text-white/75 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Pin className="w-3 h-3 fill-current" />
                            <span>Fixadas · {pinnedNotes.length}</span>
                          </span>
                          <ChevronDown
                            className={cn(
                              'w-3.5 h-3.5 transition-transform duration-200',
                              isPinnedCollapsed && '-rotate-90'
                            )}
                          />
                        </button>

                        {!isPinnedCollapsed && (
                          <div className="space-y-1">
                            {pinnedNotes.map((note) => renderSidebarNoteCard(note))}
                          </div>
                        )}
                      </div>
                    )}

                    {unpinnedNotes.length > 0 && (
                      <div className="space-y-1">
                        {pinnedNotes.length > 0 && (
                          <div className="px-2 py-1 text-[11.5px] font-bold tracking-wide text-slate-800/85 dark:text-white/75">
                            Notas · {unpinnedNotes.length}
                          </div>
                        )}
                        <div className="space-y-1">
                          {unpinnedNotes.map((note) => renderSidebarNoteCard(note))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* =========================================================
              ÁREA PRINCIPAL À DIREITA (DENTRO DA NOTA: O + SEÇÕES "NOTA" E "CHAT")
             ========================================================= */}
          <main className="relative flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden px-4 sm:px-8 md:px-12 pt-4 pb-5">
            {/* Topo da Área da Nota: Ilha Flutuante no centro + Tema e Perfil à direita */}
            <div className="relative z-30 flex items-center justify-between gap-2 sm:gap-3 pb-4 border-b border-white/35 dark:border-white/15 shrink-0">
              <div className="hidden lg:block min-w-[140px]" />

              {/* ILHA UNIFICADA DE FORMATAÇÃO DA NOTA (Com Brilho no Cursor e Sem Seta de Compartilhar) */}
              <div ref={formatMenuRef} className="relative">
                <CursorGlowSurface
                  enabled={preferences.cursorGlowEnabled}
                  radius={150}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/45 dark:bg-white/[0.10] border border-white/80 dark:border-white/25 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.65)]"
                >
                  <button
                    type="button"
                    disabled={!activeNote}
                    onClick={() => activeNote && handleTogglePinNote(activeNote)}
                    title={activeNote?.completed ? 'Desafixar nota' : 'Fixar nota'}
                    className={cn(
                      'p-2 rounded-full transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed',
                      activeNote?.completed
                        ? 'bg-white/85 dark:bg-white/25 text-slate-950 dark:text-white shadow-2xs'
                        : 'text-slate-900 dark:text-white hover:bg-white/50 dark:hover:bg-white/15'
                    )}
                  >
                    <Pin
                      className={cn('w-4 h-4', activeNote?.completed && 'fill-current')}
                    />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-900/15 dark:bg-white/20 mx-0.5" />

                  <button
                    type="button"
                    disabled={!activeNote}
                    onClick={() => {
                      setContextMenuPos(null);
                      setIsFormatMenuOpen((prev) => !prev);
                    }}
                    title="Formatação (ou clique com botão direito na nota)"
                    className={cn(
                      'inline-flex items-center justify-center px-3 py-1 rounded-full text-[14px] font-bold tracking-tight transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed',
                      isFormatMenuOpen ||
                        (activeBlock &&
                          activeBlock.type !== 'body' &&
                          activeBlock.type !== 'todo' &&
                          activeBlock.type !== 'table')
                        ? 'bg-white/85 dark:bg-white/25 text-slate-950 dark:text-white shadow-2xs'
                        : 'text-slate-900 dark:text-white hover:bg-white/50 dark:hover:bg-white/15'
                    )}
                  >
                    <span>Aa</span>
                  </button>

                  <button
                    type="button"
                    disabled={!activeNote}
                    onClick={handleInsertOrToggleChecklist}
                    title="Checklist"
                    className={cn(
                      'p-2 rounded-full transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed',
                      activeNote && activeBlock?.type === 'todo'
                        ? 'bg-white/85 dark:bg-white/25 text-slate-950 dark:text-white shadow-2xs'
                        : 'text-slate-900 dark:text-white hover:bg-white/50 dark:hover:bg-white/15'
                    )}
                  >
                    <ListTodo className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={!activeNote}
                    onClick={handleInsertTable}
                    title="Inserir tabela"
                    className="p-2 rounded-full text-slate-900 dark:text-white hover:bg-white/50 dark:hover:bg-white/15 disabled:opacity-35 transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Table2 className="w-4 h-4" />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-900/15 dark:bg-white/20 mx-0.5" />

                  <button
                    type="button"
                    disabled={!activeNote}
                    onClick={() => activeNote && handleDeleteNote(activeNote.id)}
                    title="Excluir nota"
                    className="p-2 rounded-full text-slate-900 dark:text-white hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-35 transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CursorGlowSurface>

                {/* Popover de Formatação Visual Aa (pelo botão do topo) */}
                <AnimatePresence>
                  {isFormatMenuOpen && activeNote && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-60 rounded-2xl bg-white/92 dark:bg-slate-900/94 backdrop-blur-2xl border border-white/85 dark:border-white/25 shadow-2xl p-2 space-y-1"
                    >
                      {renderFormatMenuItems()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Botão de Tema + Config + Avatar do Usuário à Direita */}
              <div className="flex items-center justify-end min-w-[48px] lg:min-w-[140px]">
                {user && (
                  <div className="hidden md:flex items-center">
                    <SidebarAccount
                      user={user}
                      isDark={isDark}
                      onToggleTheme={() => setIsDark(!isDark)}
                      onOpenAuth={() => setUser(null)}
                      onOpenAccountModal={() => setIsAccountOpen(true)}
                      onOpenSettingsModal={() => setIsSettingsOpen(true)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Menu de Formatação Aa ao clicar com o Botão Direito sobre a nota */}
            <AnimatePresence>
              {contextMenuPos && activeNote && viewMode === 'note' && (
                <motion.div
                  ref={contextMenuRef}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    top: Math.min(contextMenuPos.y, window.innerHeight - 330),
                    left: Math.min(contextMenuPos.x, window.innerWidth - 260),
                  }}
                  className="fixed z-[80] w-60 rounded-2xl bg-white/94 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/85 dark:border-white/25 shadow-2xl p-2 space-y-1"
                >
                  {renderFormatMenuItems()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ÁREA INTERNA: LOGO "O" NO CENTRO QUE ROLA SUAVEMENTE PARA O LUGAR DO CHAT AO CLICAR */}
            <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* O no centro acima de Rotina -> ao clicar, rola suavemente para a direita assumindo o lugar do Chat ao lado de "Nota" */}
              <div className="pt-3.5 pb-1.5 flex items-center justify-center shrink-0">
                <CursorGlowSurface
                  enabled={preferences.cursorGlowEnabled && isModeSelectorOpen}
                  radius={150}
                  className={cn(
                    'inline-flex items-center justify-center rounded-full transition-all duration-300',
                    isModeSelectorOpen
                      ? 'p-1 bg-white/45 dark:bg-white/[0.10] border border-white/80 dark:border-white/25 backdrop-blur-xl shadow-[0_6px_20px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.65)]'
                      : 'p-0 bg-transparent border border-transparent shadow-none'
                  )}
                >
                  <motion.div
                    layout
                    transition={{
                      layout: {
                        type: 'spring',
                        stiffness: 170,
                        damping: 22,
                        mass: 0.9,
                      },
                    }}
                    className="inline-flex items-center justify-center"
                  >
                    {/* Seção "Nota" à esquerda (abre suavemente empurrando o O para rolar até a direita) */}
                    <AnimatePresence initial={false}>
                      {isModeSelectorOpen && (
                        <motion.div
                          key="onda-nota-section-left"
                          initial={{
                            opacity: 0,
                            width: 0,
                            scale: 0.88,
                            filter: 'blur(6px)',
                          }}
                          animate={{
                            opacity: 1,
                            width: 'auto',
                            scale: 1,
                            filter: 'blur(0px)',
                          }}
                          exit={{
                            opacity: 0,
                            width: 0,
                            scale: 0.88,
                            filter: 'blur(6px)',
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 170,
                            damping: 22,
                            mass: 0.9,
                            opacity: { duration: 0.2 },
                          }}
                          className="overflow-hidden flex items-center"
                        >
                          <div className="pr-1">
                            <button
                              type="button"
                              disabled={!activeNote}
                              onClick={() => setViewMode('note')}
                              title="Ir para a Nota"
                              className={cn(
                                'relative inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed whitespace-nowrap',
                                viewMode === 'note'
                                  ? 'text-slate-950 dark:text-white'
                                  : 'text-slate-800/75 dark:text-white/65 hover:text-slate-950 dark:hover:text-white'
                              )}
                            >
                              {viewMode === 'note' && (
                                <motion.span
                                  layoutId="onda-section-active-pill"
                                  transition={{
                                    type: 'spring',
                                    stiffness: 260,
                                    damping: 26,
                                  }}
                                  className="absolute inset-0 rounded-full bg-white/90 dark:bg-white/25 shadow-2xs"
                                />
                              )}
                              <FileText className="relative z-10 w-3.5 h-3.5" />
                              <span className="relative z-10">Nota</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* O próprio "O" (fica no centro quando fechado; ao clicar vai direto para o Chat rolando suavemente) */}
                    <motion.button
                      layout="position"
                      type="button"
                      disabled={!activeNote}
                      onClick={() => {
                        if (!activeNote) return;
                        if (!isModeSelectorOpen) {
                          setIsModeSelectorOpen(true);
                          setViewMode('chat');
                          setORollAngle((prev) => prev + 360);
                        } else if (viewMode !== 'chat') {
                          setViewMode('chat');
                          setORollAngle((prev) => prev + 360);
                        } else {
                          setViewMode('note');
                          setIsModeSelectorOpen(false);
                          setORollAngle((prev) => prev - 360);
                        }
                      }}
                      whileHover={{ scale: 1.07 }}
                      whileTap={{ scale: 0.94 }}
                      transition={{
                        layout: {
                          type: 'spring',
                          stiffness: 170,
                          damping: 22,
                          mass: 0.9,
                        },
                      }}
                      title={
                        !isModeSelectorOpen
                          ? 'Abrir opções (Nota e Chat Onda)'
                          : !activeNote
                          ? 'Abra ou crie uma nota primeiro'
                          : viewMode !== 'chat'
                          ? 'Ir para o Chat com o Onda'
                          : 'Recolher opções'
                      }
                      className={cn(
                        'relative inline-flex items-center justify-center rounded-full bg-transparent border-0 focus:outline-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed shrink-0 transition-padding duration-300',
                        isModeSelectorOpen ? 'px-3.5 py-1' : 'p-0'
                      )}
                    >
                      {isModeSelectorOpen && viewMode === 'chat' && (
                        <motion.span
                          layoutId="onda-section-active-pill"
                          transition={{
                            type: 'spring',
                            stiffness: 260,
                            damping: 26,
                          }}
                          className="absolute inset-0 rounded-full bg-white/90 dark:bg-white/25 shadow-2xs"
                        />
                      )}
                      <motion.div
                        animate={{
                          rotate: oRollAngle,
                        }}
                        transition={{
                          type: 'spring',
                          stiffness: 145,
                          damping: 20,
                          mass: 0.95,
                        }}
                        className="relative z-10 flex items-center justify-center"
                      >
                        <OndaWaveOIcon
                          className={cn(
                            'w-auto select-none transition-all duration-300',
                            isModeSelectorOpen ? 'h-7' : 'h-9'
                          )}
                        />
                      </motion.div>
                    </motion.button>
                  </motion.div>
                </CursorGlowSurface>
              </div>

              {!activeNote ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 select-none">
                  <div className="w-12 h-12 rounded-2xl bg-white/45 dark:bg-white/10 border border-white/80 dark:border-white/25 flex items-center justify-center mb-3 text-slate-900 dark:text-white shadow-xs">
                    <SquarePen className="w-5 h-5" />
                  </div>
                  <h3 className="text-[17px] font-bold text-slate-950 dark:text-white">
                    Nenhuma nota aberta
                  </h3>
                  <p className="text-[13.5px] text-slate-800/75 dark:text-white/60 max-w-sm mt-1 mb-5">
                    Crie uma nota para começar a escrever.
                  </p>
                  <CursorGlowSurface
                    as="button"
                    type="button"
                    enabled={preferences.cursorGlowEnabled}
                    onClick={handleCreateNewNote}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/75 dark:bg-white/20 hover:bg-white/95 dark:hover:bg-white/30 border border-white/90 dark:border-white/35 text-[13.5px] font-semibold text-slate-950 dark:text-white shadow-sm transition-all cursor-pointer"
                  >
                    <SquarePen className="w-4 h-4" />
                    <span>Nova Nota</span>
                  </CursorGlowSurface>
                </div>
              ) : viewMode === 'note' ? (
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setIsFormatMenuOpen(false);
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      const lastBlock = blocks[blocks.length - 1];
                      if (lastBlock) {
                        blockRefs.current[lastBlock.id]?.focus();
                      }
                    }
                  }}
                  className="flex-1 min-h-0 flex flex-col overflow-y-auto pt-3 pb-32 max-w-3xl w-full mx-auto cursor-text [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {/* 1ª Linha: Título da Nota */}
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={titleDraft}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const firstBlk = blocks[0];
                        if (firstBlk) {
                          const el = blockRefs.current[firstBlk.id];
                          el?.focus();
                          el?.setSelectionRange(0, 0);
                        }
                      }
                    }}
                    placeholder="Título da nota"
                    className="w-full bg-transparent text-[26px] sm:text-[32px] font-bold tracking-tight text-slate-950 dark:text-white placeholder:text-slate-700/45 dark:placeholder:text-white/30 focus:outline-none shrink-0 leading-tight mb-4 select-text"
                  />

                  {/* Linhas da Nota (Sem linha preta vertical e sem texto de fundo) */}
                  <div className="space-y-1.5">
                    {blocks.map((block, idx) => (
                      <div
                        key={block.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFocusedBlockId(block.id);
                          setIsFormatMenuOpen(false);
                          setContextMenuPos({ x: e.clientX, y: e.clientY });
                        }}
                        className="group relative flex items-start py-0.5 rounded-xl transition-colors duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          {block.type === 'table' ? (
                            <div className="my-2 rounded-2xl overflow-hidden border border-white/75 dark:border-white/25 bg-white/45 dark:bg-slate-950/35 backdrop-blur-md shadow-sm">
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-[14px]">
                                  <tbody>
                                    {(
                                      block.tableData || [
                                        ['Coluna 1', 'Coluna 2'],
                                        ['', ''],
                                      ]
                                    ).map((row, rIdx) => (
                                      <tr
                                        key={rIdx}
                                        className={cn(
                                          'border-b last:border-b-0 border-white/50 dark:border-white/15',
                                          rIdx === 0 &&
                                            'bg-white/40 dark:bg-white/[0.08] font-semibold'
                                        )}
                                      >
                                        {row.map((cell, cIdx) => (
                                          <td
                                            key={cIdx}
                                            className="border-r last:border-r-0 border-white/50 dark:border-white/15 p-0"
                                          >
                                            <input
                                              type="text"
                                              value={cell}
                                              onFocus={() => setFocusedBlockId(block.id)}
                                              onChange={(e) =>
                                                handleUpdateTableCell(
                                                  block.id,
                                                  rIdx,
                                                  cIdx,
                                                  e.target.value
                                                )
                                              }
                                              placeholder={
                                                rIdx === 0 ? `Coluna ${cIdx + 1}` : ''
                                              }
                                              className="w-full px-3 py-2 bg-transparent text-slate-950 dark:text-white placeholder:text-slate-600/40 dark:placeholder:text-white/25 focus:outline-none focus:bg-white/50 dark:focus:bg-white/10"
                                            />
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex items-center justify-between px-3 py-1.5 bg-white/25 dark:bg-white/[0.04] border-t border-white/50 dark:border-white/15 text-[11.5px]">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddTableRow(block.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/15 text-slate-900 dark:text-white/85 font-medium cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Linha</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddTableCol(block.id)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/15 text-slate-900 dark:text-white/85 font-medium cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Coluna</span>
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBlock(block.id)}
                                  className="text-red-700 dark:text-red-300 hover:underline font-medium cursor-pointer"
                                >
                                  Remover tabela
                                </button>
                              </div>
                            </div>
                          ) : block.type === 'todo' ? (
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => handleToggleTodoCheck(block.id)}
                                className={cn(
                                  'mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer border',
                                  block.checked
                                    ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-950 shadow-xs'
                                    : 'border-slate-700/70 dark:border-white/65 bg-white/40 dark:bg-white/10 hover:border-slate-950 dark:hover:border-white'
                                )}
                              >
                                {block.checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                              <AutoResizeBlockInput
                                value={block.text}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={(val) => handleBlockTextChange(block.id, val)}
                                onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                                placeholder=""
                                inputRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className={cn(
                                  bodyFontSizeClass,
                                  'leading-relaxed',
                                  block.checked
                                    ? 'line-through text-slate-600/70 dark:text-white/45'
                                    : 'text-slate-950 dark:text-white font-medium'
                                )}
                              />
                            </div>
                          ) : block.type === 'bullet' ? (
                            <div className="flex items-start gap-2.5">
                              <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white shrink-0" />
                              <AutoResizeBlockInput
                                value={block.text}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={(val) => handleBlockTextChange(block.id, val)}
                                onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                                placeholder=""
                                inputRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className={cn(
                                  bodyFontSizeClass,
                                  'leading-relaxed text-slate-950 dark:text-white'
                                )}
                              />
                            </div>
                          ) : block.type === 'numbered' ? (
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-[15.5px] font-bold text-slate-800 dark:text-white/80 tabular-nums shrink-0 min-w-[22px]">
                                {getNumberedIndex(idx)}.
                              </span>
                              <AutoResizeBlockInput
                                value={block.text}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={(val) => handleBlockTextChange(block.id, val)}
                                onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                                placeholder=""
                                inputRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className={cn(
                                  bodyFontSizeClass,
                                  'leading-relaxed text-slate-950 dark:text-white'
                                )}
                              />
                            </div>
                          ) : block.type === 'quote' ? (
                            <div className="pl-3.5 border-l-2 border-slate-900/50 dark:border-white/55">
                              <AutoResizeBlockInput
                                value={block.text}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={(val) => handleBlockTextChange(block.id, val)}
                                onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                                placeholder=""
                                inputRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className={cn(
                                  bodyFontSizeClass,
                                  'italic leading-relaxed text-slate-900 dark:text-white/90'
                                )}
                              />
                            </div>
                          ) : block.type === 'heading' ? (
                            <div className="pt-2">
                              <AutoResizeBlockInput
                                value={block.text}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={(val) => handleBlockTextChange(block.id, val)}
                                onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                                placeholder=""
                                inputRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className="text-[21px] sm:text-[22px] font-bold tracking-tight leading-snug text-slate-950 dark:text-white"
                              />
                            </div>
                          ) : block.type === 'subheading' ? (
                            <div className="pt-1">
                              <AutoResizeBlockInput
                                value={block.text}
                                onFocus={() => setFocusedBlockId(block.id)}
                                onChange={(val) => handleBlockTextChange(block.id, val)}
                                onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                                placeholder=""
                                inputRef={(el) => {
                                  blockRefs.current[block.id] = el;
                                }}
                                className="text-[17.5px] font-semibold leading-snug text-slate-900 dark:text-white/95"
                              />
                            </div>
                          ) : (
                            <AutoResizeBlockInput
                              value={block.text}
                              onFocus={() => setFocusedBlockId(block.id)}
                              onChange={(val) => handleBlockTextChange(block.id, val)}
                              onKeyDown={(e) => handleBlockKeyDown(e, block, idx)}
                              placeholder=""
                              inputRef={(el) => {
                                blockRefs.current[block.id] = el;
                              }}
                              className={cn(
                                bodyFontSizeClass,
                                'leading-relaxed text-slate-950 dark:text-white'
                              )}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* =========================================================
                   MODO CHAT (NA MESMA JANELA PRINCIPAL)
                   A IA conversa com o usuário e ajusta a nota ativa conforme pedido
                   ========================================================= */
                <div className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto pt-3 pb-2 overflow-hidden">
                  {/* Histórico de mensagens do Chat */}
                  <div
                    ref={ondaScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {activeConversation.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                        <h3 className="text-[18px] font-bold text-slate-950 dark:text-white tracking-tight">
                          {userFirstName ? `Oi, ${userFirstName}!` : 'Chat com o Onda'}
                        </h3>
                        <p className="text-[13.5px] text-slate-800/75 dark:text-white/60 max-w-sm mt-1 leading-relaxed">
                          Converse livremente ou peça qualquer ajuste para a nota{' '}
                          <strong className="text-slate-950 dark:text-white">
                            “
                            {titleDraft.trim() ||
                              (activeNote.title !== 'Nova Nota'
                                ? activeNote.title
                                : 'Sem título')}
                            ”
                          </strong>
                          .
                        </p>
                      </div>
                    ) : (
                      activeConversation.map((msg) => {
                        const isOnda = msg.sender === 'onda';
                        const wasInserted = addedLinesFeedback === msg.id;
                        const wasTableInserted = addedTableFeedback === msg.id;
                        const wasNoteApplied = appliedNoteFeedback === msg.id;

                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              'flex items-end gap-2.5',
                              isOnda ? 'justify-start' : 'justify-end'
                            )}
                          >
                            {isOnda && (
                              <div className="shrink-0 mb-1">
                                <OndaWaveOIcon className="h-7 w-auto" />
                              </div>
                            )}

                            <CursorGlowSurface
                              enabled={preferences.cursorGlowEnabled}
                              radius={180}
                              className={cn(
                                'max-w-[82%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed select-text shadow-sm',
                                isOnda
                                  ? 'rounded-bl-xs bg-white/60 dark:bg-slate-950/60 border border-white/85 dark:border-white/30 text-slate-950 dark:text-white backdrop-blur-xl'
                                  : 'rounded-br-xs bg-slate-900/90 dark:bg-white/90 border border-slate-900 dark:border-white text-white dark:text-slate-950 font-medium'
                              )}
                            >
                              <p className="whitespace-pre-wrap">{msg.text}</p>

                              {isOnda &&
                                ((msg.replaceEntireNoteContent &&
                                  msg.replaceEntireNoteContent.trim().length > 0) ||
                                  (msg.writeToNoteLines &&
                                    msg.writeToNoteLines.length > 0) ||
                                  (msg.smartTableData &&
                                    msg.smartTableData.length > 0)) && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-900/10 dark:border-white/15 flex flex-wrap items-center gap-1.5">
                                    {(msg.replaceEntireNoteContent ||
                                      msg.updatedNoteTitle) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleApplyNoteAdjustment(
                                            msg.updatedNoteTitle,
                                            msg.replaceEntireNoteContent,
                                            msg.id
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 dark:bg-white/20 hover:bg-white dark:hover:bg-white/30 border border-white dark:border-white/35 text-[11.5px] font-bold text-slate-950 dark:text-white shadow-2xs transition-all cursor-pointer"
                                      >
                                        {wasNoteApplied ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                            <span>Nota atualizada!</span>
                                          </>
                                        ) : (
                                          <>
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>Aplicar ajuste na nota</span>
                                          </>
                                        )}
                                      </button>
                                    )}

                                    {msg.writeToNoteLines &&
                                      msg.writeToNoteLines.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleInsertOndaLines(
                                              msg.writeToNoteLines!,
                                              msg.id
                                            )
                                          }
                                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 dark:bg-white/20 hover:bg-white dark:hover:bg-white/30 border border-white dark:border-white/35 text-[11.5px] font-bold text-slate-950 dark:text-white shadow-2xs transition-all cursor-pointer"
                                        >
                                          {wasInserted ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                              <span>Adicionado à nota!</span>
                                            </>
                                          ) : (
                                            <>
                                              <Plus className="w-3.5 h-3.5" />
                                              <span>
                                                {msg.writeToNoteLabel ||
                                                  'Inserir passos na nota'}
                                              </span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                    {msg.smartTableData &&
                                      msg.smartTableData.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleInsertOndaTable(
                                              msg.smartTableData!,
                                              msg.id
                                            )
                                          }
                                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 dark:bg-white/20 hover:bg-white dark:hover:bg-white/30 border border-white dark:border-white/35 text-[11.5px] font-bold text-slate-950 dark:text-white shadow-2xs transition-all cursor-pointer"
                                        >
                                          {wasTableInserted ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                              <span>Tabela inserida!</span>
                                            </>
                                          ) : (
                                            <>
                                              <Table2 className="w-3.5 h-3.5" />
                                              <span>
                                                {msg.smartTableLabel ||
                                                  'Inserir tabela na nota'}
                                              </span>
                                            </>
                                          )}
                                        </button>
                                      )}
                                  </div>
                                )}
                            </CursorGlowSurface>
                          </motion.div>
                        );
                      })
                    )}

                    {isOndaThinking && (
                      <div className="flex items-end gap-2.5 justify-start">
                        <div className="shrink-0 mb-1">
                          <OndaWaveOIcon className="h-7 w-auto" />
                        </div>
                        <div className="rounded-2xl rounded-bl-xs bg-white/60 dark:bg-slate-950/60 border border-white/85 dark:border-white/30 px-4 py-3 backdrop-blur-xl">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-white animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-white animate-bounce [animation-delay:120ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-white animate-bounce [animation-delay:240ms]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Barra de envio de mensagem no Chat (com brilho no cursor) */}
                  <form onSubmit={handleSendToOnda} className="shrink-0 pt-2">
                    <CursorGlowSurface
                      enabled={preferences.cursorGlowEnabled}
                      radius={180}
                      className="flex items-center gap-2 pl-4 pr-2 py-2 rounded-2xl bg-white/50 dark:bg-white/[0.11] border border-white/85 dark:border-white/30 backdrop-blur-2xl shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                    >
                      <input
                        type="text"
                        value={ondaInput}
                        onChange={(e) => setOndaInput(e.target.value)}
                        placeholder="Converse com o Onda ou peça um ajuste na nota..."
                        className="flex-1 bg-transparent text-[14px] font-medium text-slate-950 dark:text-white placeholder:text-slate-700/65 dark:placeholder:text-white/50 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!ondaInput.trim() || isOndaThinking}
                        className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-[12.5px] font-bold inline-flex items-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar</span>
                      </button>
                    </CursorGlowSurface>
                  </form>
                </div>
              )}
            </div>
          </main>
        </GlassWindowFrame>
      </div>

      {/* Quando não autenticado, exibe apenas o botão de tema no topo */}
      {!user && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto">
          <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} variant="icon" />
        </div>
      )}

      {/* 3. OVERLAY DE LOGIN */}
      <AnimatePresence>
        {!user && (
          <motion.div
            key="login-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-black/25 dark:bg-black/45"
          >
            <LoginPage
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
              isOverlay
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Perfil / Minha Conta */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        user={user}
        onSave={handleSaveAccount}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        notesCount={notes.length}
        pinnedCount={pinnedNotes.length}
        gradientConfig={gradientConfig}
      />

      {/* Modal de Configurações */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        gradientConfig={gradientConfig}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        preferences={preferences}
        onUpdatePreferences={setPreferences}
        notesCount={notes.length}
        onExportAllNotes={handleExportAllNotes}
      />
    </div>
  );
}
