'use client';

type FontSize = 'small' | 'medium' | 'large';

interface FontControlsProps {
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
}

const sizes: { key: FontSize; label: string; className: string }[] = [
  { key: 'small', label: 'Small text', className: 'text-xs' },
  { key: 'medium', label: 'Medium text', className: 'text-sm' },
  { key: 'large', label: 'Large text', className: 'text-base' },
];

export function FontControls({ fontSize, onFontSizeChange }: FontControlsProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-[var(--stone-200)] p-0.5 dark:border-[var(--stone-700)]">
      {sizes.map(({ key, label, className }) => (
        <button
          key={key}
          onClick={() => onFontSizeChange(key)}
          aria-label={label}
          className={`rounded-full px-2 py-1 font-display transition-colors ${className} ${
            fontSize === key
              ? 'bg-[var(--sage-500)] text-[var(--stone-50)]'
              : 'text-[var(--stone-300)] hover:text-[var(--stone-700)] dark:hover:text-[var(--stone-200)]'
          }`}
        >
          A
        </button>
      ))}
    </div>
  );
}
