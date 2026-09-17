import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRotation: number;
  alpha: number;
  shape: 'rect' | 'circle' | 'star';
}

const CONFETTI_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#6366f1', // indigo
  '#ec4899', // pink
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#eab308', // yellow
  '#06b6d4', // cyan
];

export interface WorkoutConfettiProps {
  particleCount?: number;
  durationMs?: number;
  className?: string;
}

export const WorkoutConfetti = ({
  particleCount = 70,
  durationMs = 3500,
  className = '',
}: WorkoutConfettiProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect reduced motion preference
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
    let height = (canvas.height = canvas.offsetHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || window.innerWidth;
      height = canvas.height = canvas.offsetHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const particles: Particle[] = [];
    const shapes: Particle['shape'][] = ['rect', 'circle', 'star'];

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.PI / 4 + (Math.random() * Math.PI) / 2; // upward fan
      const speed = 7 + Math.random() * 9;
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * (width * 0.4),
        y: height * 0.4 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 12,
        vy: -speed * Math.sin(angle),
        size: 5 + Math.random() * 6,
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] ??
          '#f59e0b',
        rotation: Math.random() * 360,
        vRotation: (Math.random() - 0.5) * 12,
        alpha: 1,
        shape: shapes[Math.floor(Math.random() * shapes.length)] ?? 'rect',
      });
    }

    const startTime = performance.now();
    let animationFrameId: number;

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // gravity
        p.vx *= 0.985; // friction
        p.rotation += p.vRotation;

        // Fade out in the second half of animation
        if (progress > 0.5) {
          p.alpha = Math.max(0, 1 - (progress - 0.5) * 2);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          ctx.beginPath();
          for (let s = 0; s < 5; s++) {
            ctx.lineTo(
              Math.cos(((18 + s * 72) * Math.PI) / 180) * p.size,
              -Math.sin(((18 + s * 72) * Math.PI) / 180) * p.size
            );
            ctx.lineTo(
              Math.cos(((54 + s * 72) * Math.PI) / 180) * (p.size / 2),
              -Math.sin(((54 + s * 72) * Math.PI) / 180) * (p.size / 2)
            );
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }

        ctx.restore();
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [particleCount, durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-50 h-full w-full ${className}`}
    />
  );
};

export default WorkoutConfetti;
