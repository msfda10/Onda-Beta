import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '../lib/utils.ts';

interface RealisticGoogleButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  label?: string;
  className?: string;
}

/**
 * Botão Google com efeito de vir PARA FRENTE, linha branca subpixel e neon vibrante
 * com as cores exatas do Google (#4285F4, #EA4335, #FBBC05, #34A853) ao passar o mouse.
 * Suporta modo apenas ícone (quando label não é fornecido) mantendo todas as animações e efeitos 3D.
 */
export function RealisticGoogleButton({ onClick, isLoading = false, label, className }: RealisticGoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const proximityVal = useMotionValue(0);

  // Efeito 3D mais suave e refinado (mais fraco)
  const scaleElevate = useSpring(useTransform(proximityVal, [0, 1], [1, 1.05]), {
    stiffness: 280,
    damping: 28,
    mass: 0.6,
  });

  const zElevate = useSpring(useTransform(proximityVal, [0, 1], [0, 8]), {
    stiffness: 280,
    damping: 28,
    mass: 0.6,
  });

  const rotateX = useSpring(useTransform(mouseY, [-20, 20], [2.5, -2.5]), {
    stiffness: 280,
    damping: 28,
    mass: 0.6,
  });
  const rotateY = useSpring(useTransform(mouseX, [-20, 20], [-2.5, 2.5]), {
    stiffness: 280,
    damping: 28,
    mass: 0.6,
  });

  // Detecção de aproximação até 70px
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || isLoading) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dx = Math.max(0, -x, x - rect.width);
      const dy = Math.max(0, -y, y - rect.height);
      const dist = Math.sqrt(dx * dx + dy * dy);

      const THRESHOLD = label ? 85 : 95;

      if (dist < THRESHOLD) {
        const proximity = Math.max(0, 1 - dist / THRESHOLD);
        proximityVal.set(proximity);

        // Aura de cores neon suaves diretamente ao redor da logo
        if (spotlightRef.current) {
          spotlightRef.current.style.opacity = String(proximity * 0.95);
          spotlightRef.current.style.background = `radial-gradient(75px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.95) 0%, rgba(66, 133, 244, 0.85) 30%, rgba(234, 67, 53, 0.8) 55%, rgba(251, 188, 5, 0.75) 75%, rgba(52, 168, 83, 0.7) 100%)`;
        }

        // Anel de luz neon diretamente contornando a logo
        if (ringRef.current) {
          ringRef.current.style.opacity = String(proximity);
          ringRef.current.style.background = `radial-gradient(85px circle at ${x}px ${y}px, #ffffff 0%, #4285f4 25%, #ea4335 50%, #fbbc05 75%, #34a853 100%)`;
        }

        if (dist === 0) {
          mouseX.set(x - rect.width / 2);
          mouseY.set(y - rect.height / 2);
        } else {
          mouseX.set((x - rect.width / 2) * proximity * 0.25);
          mouseY.set((y - rect.height / 2) * proximity * 0.25);
        }
      } else {
        proximityVal.set(0);
        mouseX.set(0);
        mouseY.set(0);
        if (spotlightRef.current) spotlightRef.current.style.opacity = '0';
        if (ringRef.current) ringRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [isLoading, label, mouseX, mouseY, proximityVal]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || isLoading) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseX.set(x - rect.width / 2);
    mouseY.set(y - rect.height / 2);
    proximityVal.set(1);

    if (spotlightRef.current) {
      spotlightRef.current.style.opacity = '0.95';
      spotlightRef.current.style.background = `radial-gradient(75px circle at ${x}px ${y}px, rgba(255, 255, 255, 0.95) 0%, rgba(66, 133, 244, 0.85) 30%, rgba(234, 67, 53, 0.8) 55%, rgba(251, 188, 5, 0.75) 75%, rgba(52, 168, 83, 0.7) 100%)`;
    }
    if (ringRef.current) {
      ringRef.current.style.opacity = '1';
      ringRef.current.style.background = `radial-gradient(85px circle at ${x}px ${y}px, #ffffff 0%, #4285f4 25%, #ea4335 50%, #fbbc05 75%, #34a853 100%)`;
    }
  };

  return (
    <div className={cn("relative flex items-center justify-center [perspective:800px] py-1", label ? "w-full" : "w-auto", className)}>
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          mouseX.set(0);
          mouseY.set(0);
        }}
        whileTap={{ scale: 0.92 }}
        style={{
          scale: scaleElevate,
          z: zElevate,
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        className={cn(
          "relative flex items-center justify-center cursor-pointer select-none",
          label ? "w-full h-11 rounded-2xl" : "w-20 h-20 rounded-full"
        )}
      >
        {/* AURA DE CORES NEON VIBRANTES DO GOOGLE DIRETAMENTE ATRÁS DA LOGO AMPLIADA */}
        <div
          ref={spotlightRef}
          className="absolute -inset-4 rounded-full pointer-events-none transition-opacity duration-200"
          style={{
            opacity: 0,
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(66,133,244,0.85) 30%, rgba(234,67,53,0.8) 55%, rgba(251,188,5,0.75) 75%, rgba(52,168,83,0.7) 90%, transparent 100%)',
            filter: 'blur(10px)',
          }}
        />

        {/* ANEL NEON CONTORNANDO A LOGO (CIRCULAR E LIMPO, SEM QUADRADO) */}
        <div
          ref={ringRef}
          className="absolute -inset-1 rounded-full pointer-events-none transition-opacity duration-150 z-20"
          style={{
            opacity: 0,
            padding: '2px',
            borderRadius: '9999px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            filter: 'drop-shadow(0 0 8px rgba(66, 133, 244, 0.9)) drop-shadow(0 0 14px rgba(234, 67, 53, 0.85)) drop-shadow(0 0 18px rgba(52, 168, 83, 0.8))',
          }}
        />

        {/* BOTÃO INTERATIVO: 100% TRANSPARENTE, SEM QUADRADO OU BORDA DE FUNDO */}
        <button
          type="button"
          onClick={onClick}
          disabled={isLoading}
          title={label || "Entrar com o Google"}
          aria-label={label || "Entrar com o Google"}
          className={cn(
            "relative z-10 w-full h-full flex items-center justify-center bg-transparent border-0 outline-none cursor-pointer overflow-visible p-0",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {isLoading ? (
            <div className="w-8 h-8 border-[3px] border-zinc-400 border-t-blue-600 dark:border-t-white rounded-full animate-spin [transform:translateZ(10px)]" />
          ) : (
            <motion.div
              className={cn(
                "flex items-center justify-center pointer-events-none [transform:translateZ(10px)]",
                label ? "gap-2.5" : ""
              )}
              transition={{ duration: 0.2 }}
            >
              <svg
                className={label ? "w-5 h-5 shrink-0" : "w-16 h-16 shrink-0"}
                viewBox="0 0 24 24"
                style={{
                  filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.22))',
                }}
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {label ? (
                <span className="text-xs sm:text-[13px] font-medium tracking-wide text-zinc-800 dark:text-white select-none whitespace-nowrap">
                  {label}
                </span>
              ) : null}
            </motion.div>
          )}
        </button>
      </motion.div>
    </div>
  );
}
