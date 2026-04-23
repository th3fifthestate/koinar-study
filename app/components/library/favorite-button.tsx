'use client';

import { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface FavoriteButtonProps {
  studyId: number;
  initialFavorited: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export function FavoriteButton({
  studyId,
  initialFavorited,
  initialCount,
  isLoggedIn,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isLoggedIn) {
        toast.error('Sign in to favorite studies');
        return;
      }
      if (pending) return;

      const prevFavorited = favorited;
      const prevCount = count;
      setFavorited(!favorited);
      setCount(favorited ? count - 1 : count + 1);
      setPending(true);

      try {
        const res = await fetch(`/api/studies/${studyId}/favorite`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to update favorite');
        const data = await res.json();
        setFavorited(data.favorited);
        setCount(data.favorite_count);
      } catch {
        setFavorited(prevFavorited);
        setCount(prevCount);
        toast.error('Could not update favorite');
      } finally {
        setPending(false);
      }
    },
    [studyId, favorited, count, pending, isLoggedIn]
  );

  return (
    <motion.button
      onClick={handleToggle}
      whileTap={{ scale: 1.3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className="flex items-center gap-1.5 text-[11px] text-[var(--stone-300)] hover:text-[var(--destructive)] transition-colors"
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      disabled={pending}
    >
      <Heart
        className="h-3.5 w-3.5"
        fill={favorited ? 'var(--destructive)' : 'none'}
        stroke={favorited ? 'var(--destructive)' : 'currentColor'}
      />
      <span>{count}</span>
    </motion.button>
  );
}
