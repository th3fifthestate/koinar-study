"use client";
import { motion } from 'framer-motion';

interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="h-2 rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            backgroundColor: i === current ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
          }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}
