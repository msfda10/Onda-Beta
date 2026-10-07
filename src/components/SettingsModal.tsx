import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sliders,
  Sparkles,
  Type as TypeIcon,
  Sun,
  Moon,
  Download,
  Check,
  SpellCheck,
} from 'lucide-react';
import AnimatedGradient, { GradientConfig } from './ui/animated-gradient.tsx';

export type EditorFontSize = 'sm' | 'md' | 'lg';

export interface OndaPreferences {
  editorFontSize: EditorFontSize;
  cursorGlowEnabled: boolean;
  spellCheck: boolean;
  slashShortcutsEnabled: boolean;
}

const PREFS_STORAGE_KEY = 'onda_user_preferences_v2';

export function loadOndaPreferences(): OndaPreferences {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          editorFontSize:
            parsed.editorFontSize === 'sm' ||
            parsed.editorFontSize === 'md' ||
            parsed.editorFontSize === 'lg'
              ? parsed.editorFontSize
              : 'md',
          cursorGlowEnabled:
            typeof parsed.cursorGlowEnabled === 'boolean'
              ? parsed.cursorGlowEnabled
              : true,
          spellCheck:
            typeof parsed.spellCheck === 'boolean' ? parsed.spellCheck : true,
          slashShortcutsEnabled:
            typeof parsed.slashShortcutsEnabled === 'boolean'
              ? parsed.slashShortcutsEnabled
              : true,
        };
      }
    } catch {
      // ignore storage errors
    }
  }
  return {
    editorFontSize: 'md',
    cursorGlowEnabled: true,
    spellCheck: true,
    slashShortcutsEnabled: true,
  };
}

export function saveOndaPreferences(prefs: OndaPreferences): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore storage errors
    }
  }
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  preferences: OndaPreferences;
  onUpdatePreferences: React.Dispatch<React.SetStateAction<OndaPreferences>>;
  notesCount?: number;
  onExportAllNotes?: () => void;
  gradientConfig?: GradientConfig;
}

export function SettingsModal({
  isOpen,
  onClose,
  isDark = false,
  onToggleTheme,
  preferences,
  onUpdatePreferences,
  notesCount = 0,
  onExportAllNotes,
  gradientConfig,
}: SettingsModalProps) {
  const [saved, setSaved] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const updatePref = <K extends keyof OndaPreferences>(
    key: K,
    val: OndaPreferences[K]
  ) => {
    onUpdatePreferences((prev) => {
      const next = { ...prev, [key]: val };
      saveOndaPreferences(next);
      return next;
    });
  };

  const handleSave = () => {
    saveOndaPreferences(preferences);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/25 dark:bg-black/45 backdrop-blur-[6px] transition-all cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 12 }}
            transition={{ type: 'spring', stiffness: 330, damping: 28 }}
            style={{
              boxShadow:
                '0 0 24px 2px rgba(255, 255, 255, 0.38), 0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            }}
            className="relative w-full max-w-[460px] rounded-3xl overflow-hidden bg-white/45 dark:bg-slate-950/60 backdrop-blur-2xl z-10 p-6 sm:p-7 text-slate-950 dark:text-white text-left"
          >
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none z-20"
              style={{
                border: '1px solid rgba(255, 255, 255, 0.72)',
                boxShadow:
                  '0 0 16px 2px rgba(255, 255, 255, 0.32), inset 0 0 16px 2px rgba(255, 255, 255, 0.32)',
              }}
            />

            {gradientConfig && (
              <AnimatedGradient
                config={gradientConfig}
                lowRes
                noise={{ opacity: 0.03, scale: 1 }}
                className="absolute inset-0 pointer-events-none opacity-40"
              />
            )}
            <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/35 pointer-events-none z-[1]" />

            <div className="relative z-10">
              <div className="flex items-center justify-between pb-4 border-b border-white/45 dark:border-white/15">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/50 dark:bg-white/15 border border-white/65 dark:border-white/25 text-slate-950 dark:text-white">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                      Configurações do Onda
                    </h2>
                    <p className="text-xs text-slate-800/75 dark:text-white/65 mt-0.5">
                      Personalize a escrita, o visual e seus dados
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-900 dark:text-white bg-white/45 dark:bg-white/15 hover:bg-white/70 dark:hover:bg-white/25 border border-white/65 dark:border-white/25 transition-all cursor-pointer shadow-2xs"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="my-5 flex flex-col gap-3">
                {/* 1. Tema Claro / Escuro */}
                {onToggleTheme && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/65 dark:border-white/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/60 dark:bg-white/15 text-slate-950 dark:text-white">
                        {isDark ? (
                          <Moon className="w-4 h-4" />
                        ) : (
                          <Sun className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-950 dark:text-white block">
                          Tema da Janela
                        </span>
                        <span className="text-[11px] text-slate-800/75 dark:text-white/65">
                          {isDark ? 'Modo escuro profundo ativo' : 'Modo cristal claro ativo'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleTheme}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/70 dark:bg-white/20 hover:bg-white/90 dark:hover:bg-white/30 border border-white/85 dark:border-white/30 text-slate-950 dark:text-white transition-all cursor-pointer"
                    >
                      {isDark ? 'Usar Claro' : 'Usar Escuro'}
                    </button>
                  </div>
                )}

                {/* 2. Tamanho do texto na folha de notas */}
                <div className="p-3.5 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/65 dark:border-white/20">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-white/15 text-slate-950 dark:text-white">
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-950 dark:text-white block">
                        Tamanho da Escrita na Nota
                      </span>
                      <span className="text-[11px] text-slate-800/75 dark:text-white/65">
                        Ajuste a escala da tipografia na folha
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white/35 dark:bg-black/25 border border-white/55 dark:border-white/15">
                    {(
                      [
                        { id: 'sm', label: 'Compacto' },
                        { id: 'md', label: 'Padrão' },
                        { id: 'lg', label: 'Grande' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePref('editorFontSize', opt.id)}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          preferences.editorFontSize === opt.id
                            ? 'bg-white/85 dark:bg-white/25 text-slate-950 dark:text-white shadow-2xs'
                            : 'text-slate-700 dark:text-white/65 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Brilho Líquido do Cursor nas Bordas */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/65 dark:border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-white/15 text-slate-950 dark:text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-950 dark:text-white block">
                        Brilho nas Bordas ao Passar o Mouse
                      </span>
                      <span className="text-[11px] text-slate-800/75 dark:text-white/65">
                        Iluminação líquida acompanhando o cursor
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePref('cursorGlowEnabled', !preferences.cursorGlowEnabled)
                    }
                    className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      preferences.cursorGlowEnabled
                        ? 'bg-slate-900 dark:bg-white justify-end'
                        : 'bg-white/45 dark:bg-white/20 justify-start'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full shadow-md transition-colors ${
                        preferences.cursorGlowEnabled
                          ? 'bg-white dark:bg-slate-950'
                          : 'bg-slate-700 dark:bg-white/70'
                      }`}
                    />
                  </button>
                </div>

                {/* 4. Corretor Ortográfico */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/65 dark:border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/60 dark:bg-white/15 text-slate-950 dark:text-white">
                      <SpellCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-950 dark:text-white block">
                        Corretor Ortográfico do Navegador
                      </span>
                      <span className="text-[11px] text-slate-800/75 dark:text-white/65">
                        Revisão nativa enquanto você escreve
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePref('spellCheck', !preferences.spellCheck)}
                    className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      preferences.spellCheck
                        ? 'bg-slate-900 dark:bg-white justify-end'
                        : 'bg-white/45 dark:bg-white/20 justify-start'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full shadow-md transition-colors ${
                        preferences.spellCheck
                          ? 'bg-white dark:bg-slate-950'
                          : 'bg-slate-700 dark:bg-white/70'
                      }`}
                    />
                  </button>
                </div>

                {/* 5. Exportar Notas */}
                {onExportAllNotes && (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/65 dark:border-white/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white/60 dark:bg-white/15 text-slate-950 dark:text-white">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-950 dark:text-white block">
                          Backup das Notas ({notesCount})
                        </span>
                        <span className="text-[11px] text-slate-800/75 dark:text-white/65">
                          Baixar todas as notas em arquivo de texto
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onExportAllNotes();
                        setExported(true);
                        setTimeout(() => setExported(false), 1800);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/70 dark:bg-white/20 hover:bg-white/90 dark:hover:bg-white/30 border border-white/85 dark:border-white/30 text-slate-950 dark:text-white transition-all cursor-pointer"
                    >
                      {exported ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Baixado!</span>
                        </>
                      ) : (
                        <span>Exportar</span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/45 dark:border-white/15 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-white/75 dark:bg-white/25 text-slate-950 dark:text-white hover:bg-white/95 dark:hover:bg-white/35 border border-white/90 dark:border-white/40 transition-all cursor-pointer shadow-xs"
                >
                  {saved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                      <span>Pronto!</span>
                    </>
                  ) : (
                    <span>Concluído</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
