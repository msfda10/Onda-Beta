import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Mail,
  Briefcase,
  LogOut,
  Check,
  Camera,
  Trash2,
  Sliders,
} from 'lucide-react';
import AnimatedGradient, { GradientConfig } from './ui/animated-gradient.tsx';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    name: string;
    email: string;
    role?: string;
    photoURL?: string;
  } | null;
  onSave: (updated: {
    name: string;
    email: string;
    role: string;
    photoURL?: string;
  }) => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  notesCount?: number;
  pinnedCount?: number;
  gradientConfig?: GradientConfig;
}

function resizeImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function AccountModal({
  isOpen,
  onClose,
  user,
  onSave,
  onLogout,
  onOpenSettings,
  notesCount = 0,
  pinnedCount = 0,
  gradientConfig,
}: AccountModalProps) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || '');
  const [photoURL, setPhotoURL] = useState<string | undefined>(user?.photoURL);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role || '');
      setPhotoURL(user.photoURL);
      setImgError(false);
    }
  }, [user, isOpen]);

  React.useEffect(() => {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setPhotoURL(dataUrl);
      setImgError(false);
    } catch (err) {
      console.error('Erro ao processar foto de perfil:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim() || 'Usuário',
      email: email.trim() || user?.email || '',
      role: role.trim(),
      photoURL: photoURL || '',
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 1500);
  };

  const initial = name ? name.charAt(0).toUpperCase() : 'U';

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
            className="relative w-full max-w-[460px] rounded-3xl overflow-hidden bg-white/45 dark:bg-slate-950/60 backdrop-blur-2xl z-10 p-6 sm:p-7 text-slate-950 dark:text-white"
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
              {/* Cabeçalho */}
              <div className="flex items-center justify-between pb-4 border-b border-white/45 dark:border-white/15">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                    Meu Perfil
                  </h2>
                  <p className="text-xs text-slate-800/75 dark:text-white/65 mt-0.5">
                    Gerencie sua foto e informações no Onda
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSettings();
                      }}
                      title="Abrir Configurações"
                      className="p-2 rounded-xl text-slate-900 dark:text-white bg-white/45 dark:bg-white/15 hover:bg-white/70 dark:hover:bg-white/25 border border-white/65 dark:border-white/25 transition-all cursor-pointer shadow-2xs"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    title="Fechar"
                    className="p-2 rounded-xl text-slate-900 dark:text-white bg-white/45 dark:bg-white/15 hover:bg-white/70 dark:hover:bg-white/25 border border-white/65 dark:border-white/25 transition-all cursor-pointer shadow-2xs"
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Seção de Foto de Perfil (sem cores de avatar e sem sino) */}
              <div className="my-4 flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/40 dark:bg-white/[0.09] border border-white/65 dark:border-white/20">
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Clique para alterar sua foto"
                    className="group relative w-15 h-15 rounded-full overflow-hidden shrink-0 ring-2 ring-white/85 dark:ring-white/40 shadow-md cursor-pointer focus:outline-none"
                  >
                    {photoURL && !imgError ? (
                      <img
                        src={photoURL}
                        alt={name}
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/65 dark:bg-white/15 flex items-center justify-center text-xl font-bold text-slate-950 dark:text-white">
                        {initial}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Camera className="w-5 h-5" />
                    </div>
                  </button>

                  <div className="min-w-0 text-left">
                    <p className="text-[13.5px] font-bold text-slate-950 dark:text-white truncate">
                      {name || 'Usuário'}
                    </p>
                    <p className="text-[11.5px] text-slate-700/80 dark:text-white/60 truncate">
                      {notesCount} {notesCount === 1 ? 'nota criada' : 'notas criadas'} ·{' '}
                      {pinnedCount} {pinnedCount === 1 ? 'fixada' : 'fixadas'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11.5px] font-semibold bg-white/70 dark:bg-white/20 hover:bg-white/90 dark:hover:bg-white/30 border border-white/85 dark:border-white/35 text-slate-950 dark:text-white transition-all cursor-pointer shadow-2xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Alterar foto</span>
                      </button>
                      {photoURL && (
                        <button
                          type="button"
                          onClick={() => setPhotoURL('')}
                          title="Remover foto"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[11.5px] font-medium text-slate-700 dark:text-white/70 hover:text-red-600 dark:hover:text-red-300 hover:bg-white/40 dark:hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Formulário de Dados do Perfil */}
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[11.5px] font-semibold text-slate-900/90 dark:text-white/85">
                    Nome de exibição
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 w-4 h-4 text-slate-800/65 dark:text-white/65 pointer-events-none" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl text-xs font-medium border border-white/65 dark:border-white/25 bg-white/45 dark:bg-white/12 text-slate-950 dark:text-white placeholder:text-slate-700/60 dark:placeholder:text-white/50 focus:outline-none focus:bg-white/65 dark:focus:bg-white/20 focus:border-white transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[11.5px] font-semibold text-slate-900/90 dark:text-white/85">
                    Ocupação ou foco atual
                  </label>
                  <div className="relative flex items-center">
                    <Briefcase className="absolute left-3.5 w-4 h-4 text-slate-800/65 dark:text-white/65 pointer-events-none" />
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Ex: Criador, Estudante, Empreendedor..."
                      className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl text-xs font-medium border border-white/65 dark:border-white/25 bg-white/45 dark:bg-white/12 text-slate-950 dark:text-white placeholder:text-slate-700/60 dark:placeholder:text-white/50 focus:outline-none focus:bg-white/65 dark:focus:bg-white/20 focus:border-white transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[11.5px] font-semibold text-slate-900/90 dark:text-white/85">
                    E-mail da conta
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 w-4 h-4 text-slate-800/65 dark:text-white/65 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemplo@gmail.com"
                      className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl text-xs font-medium border border-white/65 dark:border-white/25 bg-white/45 dark:bg-white/12 text-slate-950 dark:text-white placeholder:text-slate-700/60 dark:placeholder:text-white/50 focus:outline-none focus:bg-white/65 dark:focus:bg-white/20 focus:border-white transition-all"
                    />
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="pt-3.5 mt-1 border-t border-white/45 dark:border-white/15 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 bg-white/35 dark:bg-white/10 hover:bg-red-500/20 border border-white/55 dark:border-white/20 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da conta</span>
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-semibold bg-white/75 dark:bg-white/25 text-slate-950 dark:text-white hover:bg-white/95 dark:hover:bg-white/35 border border-white/90 dark:border-white/40 transition-all cursor-pointer shadow-xs"
                  >
                    {savedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                        <span>Salvo!</span>
                      </>
                    ) : (
                      <span>Salvar Alterações</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
