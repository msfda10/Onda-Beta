import { useState, useEffect } from 'react';
import { User, Sun, Moon, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils.ts';

interface SidebarAccountProps {
  user: {
    name: string;
    email: string;
    role?: string;
    photoURL?: string;
  } | null;
  onOpenAuth: () => void;
  onOpenAccountModal: () => void;
  onOpenSettingsModal: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  className?: string;
}

export function SidebarAccount({
  user,
  onOpenAuth,
  onOpenAccountModal,
  onOpenSettingsModal,
  isDark = false,
  onToggleTheme,
  className,
}: SidebarAccountProps) {
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    setAvatarImgError(false);
  }, [user?.photoURL]);

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const title = user ? user.name : 'Minha Conta';

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      {onToggleTheme && (
        <motion.button
          type="button"
          onClick={onToggleTheme}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/24 dark:bg-white/[0.10] hover:bg-white/45 dark:hover:bg-white/[0.20] backdrop-blur-xl border border-white/65 dark:border-white/28 text-slate-900 dark:text-white flex items-center justify-center cursor-pointer transition-all shadow-[0_6px_18px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.65)] hover:shadow-[0_0_16px_rgba(255,255,255,0.55)]"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-200" />
          ) : (
            <Moon className="w-4 h-4 text-slate-900" />
          )}
        </motion.button>
      )}

      {user && (
        <motion.button
          type="button"
          onClick={onOpenSettingsModal}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          title="Configurações"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/24 dark:bg-white/[0.10] hover:bg-white/45 dark:hover:bg-white/[0.20] backdrop-blur-xl border border-white/65 dark:border-white/28 text-slate-900 dark:text-white flex items-center justify-center cursor-pointer transition-all shadow-[0_6px_18px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.65)] hover:shadow-[0_0_16px_rgba(255,255,255,0.55)]"
        >
          <Sliders className="w-4 h-4" />
        </motion.button>
      )}

      <motion.button
        type="button"
        onClick={() => {
          if (!user) {
            onOpenAuth();
          } else {
            onOpenAccountModal();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="group relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer select-none focus:outline-none transition-all duration-300 shadow-[0_6px_18px_rgba(0,0,0,0.14)] hover:shadow-[0_0_20px_rgba(255,255,255,0.75)]"
      >
        {user ? (
          user.photoURL && !avatarImgError ? (
            <img
              src={user.photoURL}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarImgError(true)}
              className="w-full h-full rounded-full object-cover ring-1.5 ring-white/85 dark:ring-white/45 shadow-sm"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-white/55 dark:bg-white/[0.16] border border-white/85 dark:border-white/35 backdrop-blur-xl flex items-center justify-center font-bold text-sm sm:text-base text-slate-950 dark:text-white shadow-sm">
              {initial}
            </div>
          )
        ) : (
          <div className="w-full h-full rounded-full bg-white/45 dark:bg-white/15 border border-white/80 dark:border-white/35 flex items-center justify-center">
            <User className="w-4.5 h-4.5 text-slate-900 dark:text-white" />
          </div>
        )}

        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -2, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="hidden sm:block absolute top-full mt-2 right-0 z-[100] pointer-events-none px-2.5 py-1 rounded-lg border border-white/55 dark:border-white/25 bg-white/85 dark:bg-slate-950/85 text-slate-950 dark:text-white text-[11.5px] font-semibold whitespace-nowrap shadow-xl backdrop-blur-xl"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
