"use client";
import { motion } from 'framer-motion';
import { BookOpen, Layers, Library, Link2, Languages, MapPin, Globe } from 'lucide-react';

const steps = [
  { icon: BookOpen, label: 'Immediate Context', description: 'Surrounding verses' },
  { icon: Layers, label: 'Chapter Context', description: 'Full chapter' },
  { icon: Library, label: 'Book Context', description: 'Structure & message' },
  { icon: Link2, label: 'Cross-References', description: 'Related passages' },
  { icon: Languages, label: 'Original Language', description: 'Hebrew & Greek' },
  { icon: MapPin, label: 'Historical Context', description: 'Who, what, when, where' },
  { icon: Globe, label: 'Canonical Context', description: 'Whole Bible alignment' },
];

export function ProtocolVisual() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-xl mx-auto">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + i * 0.1, duration: 0.3 }}
          className={`flex flex-col items-center gap-1.5 rounded-lg bg-card/50 p-3 text-center ${
            i === 6 ? 'sm:col-span-4 sm:max-w-[160px] sm:mx-auto' : ''
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <step.icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium leading-tight">{step.label}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">{step.description}</span>
        </motion.div>
      ))}
    </div>
  );
}
