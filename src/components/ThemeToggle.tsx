import React, { useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  variant?: 'default' | 'icon';
  className?: string;
}

export function ThemeToggle({
  isDark,
  onToggle,
  variant = 'default',
  className = '',
}: ThemeToggleProps) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Animação 3D interativa com inclinação nos eixos X e Y
  const rotateX = useSpring(useTransform(mouseY, [-25, 25], [18, -18]), {
    stiffness: 320,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-25, 25], [-18, 18]), {
    stiffness: 320,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // VARIANTE: SOMENTE O ÍCONE (sem quadrado de fundo escuro, com física 3D e halo suave)
  if (variant === 'icon') {
    return (
      <div className="relative flex items-center justify-center [perspective:900px]">
        <motion.button
          ref={containerRef}
          onClick={onToggle}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          type="button"
          aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
          }}
          whileHover={{
            scale: 1.22,
            z: 28,
            transition: { type: 'spring', stiffness: 400, damping: 18 },
          }}
          whileTap={{ scale: 0.9, rotate: -25 }}
          className={`relative p-2.5 rounded-full bg-transparent border-0 outline-none cursor-pointer select-none flex items-center justify-center group ${className}`}
        >
          {/* Halo luminoso suave e difuso atrás do ícone em branco puro */}
          <div
            className="absolute inset-0 rounded-full opacity-40 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.12) 45%, transparent 75%)',
              filter: 'blur(6px)',
              transform: 'translateZ(-4px)',
            }}
          />

          {/* Ícones de Sol e Lua com brilho branco puro */}
          <div className="relative flex items-center justify-center w-7 h-7 pointer-events-none [transform:translateZ(18px)]">
            <Sun
              className={`w-7 h-7 text-white transition-all duration-300 ease-out ${
                isDark ? '-rotate-90 scale-0 opacity-0 absolute' : 'rotate-0 scale-100 opacity-100'
              }`}
              style={{
                filter:
                  'drop-shadow(0 0 8px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 18px rgba(255, 255, 255, 0.6))',
              }}
            />
            <Moon
              className={`w-7 h-7 text-white transition-all duration-300 ease-out ${
                isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0 absolute'
              }`}
              style={{
                filter:
                  'drop-shadow(0 0 8px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 18px rgba(255, 255, 255, 0.6))',
              }}
            />
          </div>
        </motion.button>
      </div>
    );
  }

  // VARIANTE PADRÃO: Usada na barra interna do app
  return (
    <div className="relative flex items-center justify-center [perspective:1000px]">
      <motion.button
        onClick={onToggle}
        type="button"
        aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
        style={{ transformStyle: 'preserve-3d' }}
        whileHover={{
          scale: 1.15,
          z: 16,
          transition: { type: 'spring', stiffness: 350, damping: 18 },
        }}
        whileTap={{ scale: 0.95 }}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md hover:shadow-zinc-900/10 dark:hover:shadow-black/40 active:scale-95 transition-colors duration-200 cursor-pointer select-none ${className}`}
      >
        <div className="relative flex items-center justify-center w-4 h-4 pointer-events-none">
          <Sun
            className={`w-4 h-4 text-zinc-700 dark:text-zinc-200 transition-all duration-200 ease-out ${
              isDark ? '-rotate-90 scale-0 opacity-0 absolute' : 'rotate-0 scale-100 opacity-100'
            }`}
          />
          <Moon
            className={`w-4 h-4 text-zinc-700 dark:text-zinc-200 transition-all duration-200 ease-out ${
              isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0 absolute'
            }`}
          />
        </div>
      </motion.button>
    </div>
  );
}
