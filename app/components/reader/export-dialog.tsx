'use client';

// app/components/reader/export-dialog.tsx
//
// PDF export dialog for the reader. Compliance posture (Option B):
//
//   - The export uses the markdown the reader is *currently displaying*
//     (passed in via getDisplayContent), so it inherits every safeguard
//     the swap engine applied: NIV per-view cap, FUMS-fetch tokens,
//     api.bible per-work cap, purge kill-switch.
//   - NIV is hard-disabled regardless of reader state. Biblica §V
//     prohibits "uncontrolled downloads"; the button is rendered
//     disabled with the publisher's tooltip.
//   - The server-side route (/api/studies/[id]/export) re-checks
//     isExportAllowed() so client-side disabling is UI-only — no
//     security boundary lives here.

import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  TRANSLATIONS,
  type TranslationId,
} from '@/lib/translations/registry';

interface ExportDialogProps {
  studyId: number;
  currentTranslation: string;
  /** Pulled lazily so the latest swap state is captured on submit. */
  getDisplayContent: () => string;
}

export function ExportDialog({
  studyId,
  currentTranslation,
  getDisplayContent,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { url: string; filename: string; expiresAt: string }
    | null
  >(null);

  const tInfo = TRANSLATIONS[currentTranslation as TranslationId];
  const isNiv = currentTranslation === 'NIV';
  const disabledReason = tInfo?.exportDisabledReason ?? null;

  const handleExport = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/studies/${studyId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'pdf',
          translation: currentTranslation,
          displayContent: getDisplayContent(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? 'Could not generate export');
        return;
      }
      const data = (await res.json()) as {
        url: string;
        filename: string;
        expiresAt: string;
      };
      setResult(data);
    } catch {
      toast.error('Could not reach the server. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-1.5 text-[11px] text-[var(--stone-300)] transition-colors hover:text-[var(--sage-500)]"
        aria-label="Export study"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Export</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export study</DialogTitle>
          <DialogDescription>
            Save this study as a PDF you can read offline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="font-medium text-stone-900">Format</div>
            <div className="mt-1 text-stone-600">
              PDF{' '}
              <span className="ml-2 inline-block rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                Word doc — coming soon
              </span>
            </div>
          </div>

          <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="font-medium text-stone-900">Translation</div>
            <div className="mt-1 text-stone-600">
              Your study will export in{' '}
              <span className="font-semibold">{currentTranslation}</span>
              {tInfo ? <> — {tInfo.fullName}</> : null}.
            </div>
            <div className="mt-2 text-xs text-stone-500">
              To change the translation, switch translations in the reader
              first; the export uses the version you&apos;re currently
              reading.
            </div>
            {isNiv && disabledReason ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                {disabledReason}
              </div>
            ) : null}
          </div>

          {result ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="font-medium">Your PDF is ready.</div>
              <div className="mt-1 text-xs text-emerald-800">
                The download link expires in 24 hours.
              </div>
              <a
                href={result.url}
                download={result.filename}
                className="mt-3 inline-flex items-center gap-1.5 font-medium text-emerald-900 underline underline-offset-2"
              >
                Download {result.filename}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Close
          </Button>
          <Button
            onClick={handleExport}
            disabled={isNiv || submitting}
            aria-disabled={isNiv || submitting}
          >
            {submitting ? 'Generating…' : 'Generate PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
