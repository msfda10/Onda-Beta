import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AnimatedTooltipProps {
  children: React.ReactNode;
  label: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function AnimatedTooltip({
  children,
  label,
  align = 'center',
  className = '',
}: AnimatedTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Alinhamento horizontal preciso para evitar transbordar no sidebar
  const alignClasses = {
    left: 'left-0 mb-2',
    center: 'left-1/2 -translate-x-1/2 mb-2',
    right: 'right-0 mb-2',
  };

  const arrowClasses = {
    left: 'left-3 -mt-[1px] border-t-zinc-900 dark:border-t-zinc-100 border-x-transparent border-b-transparent border-t-[4px] border-x-[4px]',
    center: 'left-1/2 -translate-x-1/2 -mt-[1px] border-t-zinc-900 dark:border-t-zinc-100 border-x-transparent border-b-transparent border-t-[4px] border-x-[4px]',
    right: 'right-3 -mt-[1px] border-t-zinc-900 dark:border-t-zinc-100 border-x-transparent border-b-transparent border-t-[4px] border-x-[4px]',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.95 }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 26,
              mass: 0.5,
            }}
            className={`absolute bottom-full z-50 pointer-events-none px-2.5 py-1 rounded-md shadow-md bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-[11px] font-medium tracking-normal whitespace-nowrap select-none border border-zinc-800 dark:border-zinc-200/90 ${alignClasses[align]}`}
          >
            <span>{label}</span>
            {/* Setinha apontando diretamente para o botão */}
            <div className={`absolute top-full w-0 h-0 ${arrowClasses[align]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
