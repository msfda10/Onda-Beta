import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import AnimatedGradient, { GradientConfig } from './ui/animated-gradient.tsx';
import { RealisticGoogleButton } from './RealisticGoogleButton.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { signInWithGoogle } from '../lib/firebase.ts';

interface LoginPageProps {
  onSuccessLogin?: (email?: string, name?: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isOverlay?: boolean;
}

export function LoginPage({
  isDark,
  onToggleTheme,
  isOverlay = false,
}: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Login exclusivo com o Google
  const handleGoogleClick = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Não foi possível autenticar com o Google. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Configuração estável do AnimatedGradient (para quando usado stand-alone)
  const gradientConfig: GradientConfig = useMemo(() => {
    return isDark
      ? {
          preset: 'custom',
          color1: '#040711',
          color2: '#3b82f6',
          color3: '#1e40af',
          rotation: -45,
          proportion: 42,
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

  // Estrutura do Login: Logo do Google no centro
  const loginCardContent = (
    <>
      {/* BOTÃO DE TEMA 3D: Posicionado no centro superior da tela no modo standalone */}
      {!isOverlay && (
        <div className="fixed top-3.5 sm:top-4 md:top-5 left-1/2 -translate-x-1/2 z-[60]">
          <ThemeToggle
            isDark={isDark}
            onToggle={onToggleTheme}
            variant="icon"
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Mensagem de Erro (se houver falha de autenticação) */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              className="mb-4 px-3 py-2 rounded-2xl bg-red-500/15 border border-red-400/30 flex items-center gap-2 text-xs font-normal text-red-900 dark:text-red-200 text-left max-w-xs shadow-lg backdrop-blur-md"
            >
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SOMENTE O BOTÃO DO GOOGLE COM LOGO AMPLIADA E EFEITOS NEON */}
        <RealisticGoogleButton
          onClick={handleGoogleClick}
          isLoading={isLoading}
        />
      </div>
    </>
  );

  // SE FOR OVERLAY (sobreposto à próxima página):
  if (isOverlay) {
    return loginCardContent;
  }

  // MODO STANDALONE:
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#eef3f9] dark:bg-[#05070e] text-zinc-900 dark:text-white font-sans antialiased select-none transition-colors duration-500 [perspective:1000px]">
      <AnimatedGradient
        config={gradientConfig}
        noise={{ opacity: 0.05, scale: 1 }}
        className="fixed inset-0 pointer-events-none"
      />
      {loginCardContent}
    </div>
  );
}
