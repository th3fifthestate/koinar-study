'use client'
import { motion, useReducedMotion } from 'framer-motion'

interface FirstConnectionAuraProps {
  pathD: string
}

export function FirstConnectionAura({ pathD }: FirstConnectionAuraProps) {
  const reduced = useReducedMotion()
  return (
    <motion.path
      aria-hidden="true"
      d={pathD}
      stroke="var(--sage-500)"
      strokeWidth={8}
      fill="none"
      style={{ filter: 'blur(6px)' }}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: 'easeOut' }}
    />
  )
}
