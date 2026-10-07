import React, { useRef, useState, useEffect } from 'react';
import {
  AnimatePresence,
  MotionValue,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import { cn } from '../lib/utils.ts';

export interface FloatingDockItem {
  title: string;
  icon: React.ReactNode;
  onClick?: () => void;
  badgeCount?: number;
}

export const FloatingDock = ({
  items,
  className,
  tooltipPosition = 'top',
  size = 'md',
}: {
  items: FloatingDockItem[];
  className?: string;
  tooltipPosition?: 'top' | 'bottom';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      style={{ perspective: 1000 }}
      className={cn(
        'w-full flex items-center justify-around px-1 bg-transparent border-0 shadow-none transition-colors duration-200',
        size === 'lg' ? 'h-[64px]' : size === 'sm' ? 'h-10' : 'h-12',
        className
      )}
    >
      {items.map((item, index) => {
        const align: 'left' | 'center' | 'right' =
          index === 0 ? 'left' : index === items.length - 1 ? 'right' : 'center';

        return (
          <DockIconContainer
            mouseX={mouseX}
            key={item.title}
            align={align}
            tooltipPosition={tooltipPosition}
            dockSize={size}
            {...item}
          />
        );
      })}
    </motion.div>
  );
};

function DockIconContainer({
  mouseX,
  title,
  icon,
  onClick,
  badgeCount,
  align = 'center',
  tooltipPosition = 'top',
  dockSize = 'md',
}: FloatingDockItem & {
  mouseX: MotionValue;
  align?: 'left' | 'center' | 'right';
  tooltipPosition?: 'top' | 'bottom';
  dockSize?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
  });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const updateBounds = () => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        boundsRef.current = { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds, { passive: true });
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  const mouseRelX = useMotionValue(0);
  const mouseRelY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseRelY, [-25, 25], [18, -18]), {
    stiffness: 320,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseRelX, [-25, 25], [-18, 18]), {
    stiffness: 320,
    damping: 20,
  });

  const handleMouseEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      boundsRef.current = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    setHovered(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const b = boundsRef.current;
    const x = e.clientX - b.x - b.width / 2;
    const y = e.clientY - b.y - b.height / 2;
    mouseRelX.set(x);
    mouseRelY.set(y);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    mouseRelX.set(0);
    mouseRelY.set(0);
  };

  const distance = useTransform(mouseX, (val) => {
    if (!Number.isFinite(val)) return Infinity;
    const b = boundsRef.current;
    return val - b.x - b.width / 2;
  });

  const baseContainerSize = dockSize === 'lg' ? 60 : dockSize === 'sm' ? 38 : 48;
  const hoverContainerSize = dockSize === 'lg' ? 64 : dockSize === 'sm' ? 42 : 54;
  const baseIconSize = dockSize === 'lg' ? 56 : dockSize === 'sm' ? 34 : 44;
  const hoverIconSize = dockSize === 'lg' ? 60 : dockSize === 'sm' ? 38 : 50;

  const sizeTransform = useTransform(
    distance,
    [-90, 0, 90],
    [baseContainerSize, hoverContainerSize, baseContainerSize]
  );
  const iconSizeTransform = useTransform(
    distance,
    [-90, 0, 90],
    [baseIconSize, hoverIconSize, baseIconSize]
  );
  const zTransform = useTransform(distance, [-90, 0, 90], [0, 20, 0]);

  const size = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 220,
    damping: 16,
  });

  const iconSize = useSpring(iconSizeTransform, {
    mass: 0.1,
    stiffness: 220,
    damping: 16,
  });

  const z = useSpring(zTransform, {
    mass: 0.1,
    stiffness: 220,
    damping: 16,
  });

  const alignTooltipClasses = {
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-0',
  };

  const arrowClasses = {
    left: 'left-3.5',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-3.5',
  };

  return (
    <div
      className={cn(
        'relative flex items-center justify-center [perspective:900px]',
        hovered ? 'z-50' : 'z-10'
      )}
    >
      <motion.div
        ref={ref}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: size,
          height: size,
          rotateX,
          rotateY,
          z,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{
          scale: 1.2,
          z: 28,
          transition: { type: 'spring', stiffness: 380, damping: 18 },
        }}
        whileTap={{ scale: 0.9, rotate: -10 }}
        className={cn(
          'group relative flex aspect-square items-center justify-center rounded-2xl cursor-pointer select-none',
          'bg-transparent border-0 outline-none transition-all'
        )}
      >
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.12) 45%, transparent 75%)',
            filter: 'blur(8px)',
            transform: 'translateZ(-4px)',
          }}
        />

        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{
                opacity: 0,
                y: tooltipPosition === 'bottom' ? -4 : 4,
                scale: 0.95,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: tooltipPosition === 'bottom' ? -2 : 2,
                scale: 0.95,
              }}
              transition={{ type: 'spring', stiffness: 450, damping: 24, mass: 0.5 }}
              style={{ transform: 'translateZ(50px)' }}
              className={cn(
                'absolute z-[100] pointer-events-none px-2.5 py-1 rounded-lg',
                tooltipPosition === 'bottom' ? 'top-12' : '-top-9',
                'border border-zinc-800 dark:border-zinc-200',
                'bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900',
                'text-[11px] font-medium whitespace-nowrap shadow-xl',
                alignTooltipClasses[align]
              )}
            >
              {title}
              <div
                className={cn(
                  'absolute w-0 h-0',
                  tooltipPosition === 'bottom'
                    ? 'bottom-full -mb-[1px] border-b-zinc-900 dark:border-b-zinc-100 border-x-transparent border-t-transparent border-b-[4px] border-x-[4px]'
                    : 'top-full -mt-[1px] border-t-zinc-900 dark:border-t-zinc-100 border-x-transparent border-b-transparent border-t-[4px] border-x-[4px]',
                  arrowClasses[align]
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          style={{ width: iconSize, height: iconSize }}
          className="relative flex items-center justify-center pointer-events-none [transform:translateZ(18px)] transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.95)] group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
        >
          {icon}
        </motion.div>

        {typeof badgeCount === 'number' && badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center pointer-events-none shadow-md ring-2 ring-zinc-900/80 [transform:translateZ(24px)] transition-transform">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </motion.div>
    </div>
  );
}

export default FloatingDock;
