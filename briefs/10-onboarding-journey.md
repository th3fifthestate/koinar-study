# Brief 10: Onboarding Journey

**Recommended mode: Direct Execution**

> **Branch:** All work on `develop`. Commit when complete with message: `Brief 10: Onboarding — 4-step Framer Motion flow, invited vs waitlist paths`
> **Path note:** This project uses `app/` not `app/src/`.

---

## ⚠️ Pre-Implementation Note (2026-04-15) — Annotations are private in V1

Public/community annotations have been deferred to V2 (Study Rooms). For V1, treat all highlights and notes as personal-only. Do not frame annotations as "community" or "shared" in onboarding copy, role cards, or any illustrations. The "Highlight and annotate" role card in this brief has been updated accordingly. See `founders-files/implementation-plan.md → Post-V1 Roadmap` for the full rationale.

---

## Overview

Build a first-time user onboarding experience that introduces new members to the app's mission, shows them what a study looks like, and sends them to the library. This is the first meaningful interaction a user has after signing up — it must feel warm, personal, and purposeful.

There are **two onboarding paths** based on how the user joined:

- **Path 1 — Invited users (via `/join/[token]`):** Step 1: Personal welcome — "{inviterName} wants to study {linkedStudyTitle} with you" (uses inviter's display name and linked study title from the `invite_codes` table). Step 2: Vision reveal — distilled mission, cinematic Bodoni Moda typography. Step 3: Dropped into the LINKED study (from the invite) — not a generic sample study. Step 4: "You're in" — enter the library.
- **Path 2 — Waitlist-approved users (via `/welcome/[token]`):** Step 1: General warm welcome — "Welcome to Koinar" (no inviter name, no specific study mention). Step 2: Vision reveal — same as Path 1. Step 3: Dropped into a RANDOM seeded study (since there's no linked study). Step 4: "You're in" — enter the library.

---

## Critical Context

- **Project root**: `/Users/davidgeorge/Desktop/study-app/app/`
- **Stack**: Next.js 16 (App Router, TypeScript, React 19), Tailwind CSS 4, Shadcn/ui, better-sqlite3, iron-session, Framer Motion
- **Database**: SQLite `app.db`
- **Design reference**: `/Users/davidgeorge/Desktop/study-app/founders-files/DESIGN-DECISIONS.md`
- **Reference studies** (use excerpts for the sample study step):
  - `/Users/davidgeorge/Desktop/Studies/Peter - Life Study/peter-life-study.md`
  - `/Users/davidgeorge/Desktop/Studies/Acts-10-Study/acts-10-comprehensive-study.md`

### Key Design Decisions

- Onboarding is shown once per user (gated by `onboarding_completed` flag on users table)
- Approach: mission-focused AND experience-focused (show, don't just tell)
- Two onboarding paths: invited users get personal welcome with inviter name + linked study; waitlist-approved users get general warm welcome + random seeded study
- The onboarding flow uses study-linked invites — invited users see the specific study their inviter chose
- The mountain icon must be explained during onboarding (marks non-biblical-database content)
- BYOK (bring your own key) mentioned briefly, not pressured
- No pressure to contribute — reading is first-class

---

## Database

Ensure the `users` table has:

```sql
-- Should already exist. If not, add this column:
ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;
```

---

## File Structure

```
src/
  app/
    (main)/
      onboarding/
        page.tsx                -- Server Component: gate + render
  components/
    onboarding/
      onboarding-flow.tsx       -- Client Component: multi-step controller
      step-welcome.tsx          -- Step 1: Welcome (personal for invited, general for waitlist)
      step-vision.tsx           -- Step 2: Vision reveal (Bodoni Moda typography, same for both paths)
      step-study.tsx            -- Step 3: Study immersion (linked study for invited, random seeded for waitlist)
      step-ready.tsx            -- Step 4: "You're in" — enter the library
      onboarding-backdrop.tsx   -- Animated background
      progress-dots.tsx         -- Step indicator dots
      protocol-visual.tsx       -- Visual of the 7-step protocol
      sample-study-embed.tsx    -- Embedded mini study viewer
  lib/
    data/
      sample-study.ts           -- Fallback sample study excerpt (markdown) for onboarding (used if API fetch fails)
  app/
    api/
      user/
        onboarding-complete/
          route.ts              -- POST: mark onboarding as complete
```

---

## 1. Onboarding Page (Server Component)

**File**: `/src/app/(main)/onboarding/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.userId) redirect('/');

  const user = db.prepare(
    'SELECT id, username, invited_by, onboarding_completed FROM users WHERE id = ?'
  ).get(session.userId) as { id: number; username: string; invited_by: number | null; onboarding_completed: number } | undefined;

  if (!user) redirect('/');

  // If already completed, go to library
  if (user.onboarding_completed) redirect('/library');

  // Fetch inviter's display name (if user was invited)
  let inviterName: string | undefined;
  if (user.invited_by) {
    const inviter = db.prepare(
      'SELECT display_name FROM users WHERE id = ?'
    ).get(user.invited_by) as { display_name: string } | undefined;
    inviterName = inviter?.display_name;
  }

  // Fetch the linked study from invite_codes (if user was invited via a study-linked invite)
  let linkedStudySlug: string | undefined;
  let linkedStudyTitle: string | undefined;
  if (user.invited_by) {
    const invite = db.prepare(`
      SELECT s.slug, s.title
      FROM invite_codes ic
      JOIN studies s ON s.id = ic.study_id
      WHERE ic.used_by = ?
    `).get(user.id) as { slug: string; title: string } | undefined;
    linkedStudySlug = invite?.slug;
    linkedStudyTitle = invite?.title;
  }

  // For waitlist-approved users (no inviter), pick a random seeded study
  let randomStudySlug: string | undefined;
  let randomStudyTitle: string | undefined;
  if (!user.invited_by) {
    const randomStudy = db.prepare(
      'SELECT slug, title FROM studies ORDER BY RANDOM() LIMIT 1'
    ).get() as { slug: string; title: string } | undefined;
    randomStudySlug = randomStudy?.slug;
    randomStudyTitle = randomStudy?.title;
  }

  return (
    <OnboardingFlow
      username={user.username}
      inviterName={inviterName}
      linkedStudySlug={linkedStudySlug ?? randomStudySlug}
      linkedStudyTitle={linkedStudyTitle ?? randomStudyTitle}
    />
  );
}
```

### Middleware/Route Guard

In the main layout (from a prior brief), check if the user has completed onboarding:

```tsx
// In /src/app/(main)/layout.tsx or a middleware
// If user is logged in AND onboarding_completed = 0
// AND current path is NOT /onboarding
// redirect to /onboarding
```

This ensures users always see onboarding before accessing the library.

---

## 2. Onboarding Flow Controller

**File**: `/src/components/onboarding/onboarding-flow.tsx`

```tsx
"use client";
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { StepWelcome } from './step-welcome';
import { StepExperience } from './step-experience';
import { StepRole } from './step-role';
import { StepReady } from './step-ready';
import { OnboardingBackdrop } from './onboarding-backdrop';
import { ProgressDots } from './progress-dots';

const TOTAL_STEPS = 4;

interface OnboardingFlowProps {
  username: string;
}

export function OnboardingFlow({ username }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const router = useRouter();

  const nextStep = useCallback(() => {
    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const prevStep = useCallback(() => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const completeOnboarding = useCallback(async () => {
    await fetch('/api/user/onboarding-complete', { method: 'POST' });
    router.push('/library');
  }, [router]);

  const skipOnboarding = useCallback(async () => {
    await fetch('/api/user/onboarding-complete', { method: 'POST' });
    router.push('/library');
  }, [router]);

  const steps = [
    <StepWelcome key="welcome" username={username} onNext={nextStep} />,
    <StepExperience key="experience" onNext={nextStep} onBack={prevStep} />,
    <StepRole key="role" onNext={nextStep} onBack={prevStep} />,
    <StepReady key="ready" onComplete={completeOnboarding} onBack={prevStep} />,
  ];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      <OnboardingBackdrop />

      {/* Skip button */}
      <button
        onClick={skipOnboarding}
        className="absolute top-6 right-6 z-20 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        Skip
      </button>

      {/* Step content */}
      <div className="relative z-10 w-full max-w-2xl px-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {steps[currentStep]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="relative z-10 mt-12">
        <ProgressDots total={TOTAL_STEPS} current={currentStep} />
      </div>
    </div>
  );
}
```

---

## 3. Step 1 — Welcome (Mission)

**File**: `/src/components/onboarding/step-welcome.tsx`

```tsx
"use client";
import { motion } from 'framer-motion';
import { ProtocolVisual } from './protocol-visual';

interface StepWelcomeProps {
  username: string;
  onNext: () => void;
}

export function StepWelcome({ username, onNext }: StepWelcomeProps) {
  return (
    <div className="text-center">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-4xl font-bold tracking-tight sm:text-5xl"
      >
        Welcome, {username}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto"
      >
        This is a community where Scripture is studied deeply, contextually, and together.
        Every verse is analyzed in its full context — never quoted in isolation.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4 text-sm text-muted-foreground/70 italic"
      >
        You were personally invited because someone trusts you with this space.
      </motion.p>

      {/* 7-Step Protocol Visual */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-10"
      >
        <p className="mb-4 text-sm font-medium text-muted-foreground">
          Every study follows a 7-step contextual analysis:
        </p>
        <ProtocolVisual />
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        onClick={onNext}
        className="mt-10 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        See how it works
      </motion.button>
    </div>
  );
}
```

---

## 4. Protocol Visual

**File**: `/src/components/onboarding/protocol-visual.tsx`

A visual representation of the 7-step analysis protocol. NOT text-heavy — use icons and short labels.

```tsx
"use client";
import { motion } from 'framer-motion';
import {
  BookOpen, Layers, Library, Link2,
  Languages, MapPin, Globe
} from 'lucide-react';

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
```

The 7th step ("Canonical Context") gets `sm:col-span-4 sm:max-w-[160px] sm:mx-auto` to center it on its own row in the 4-column layout.

---

## 5. Step 2 — The Experience (Show, Don't Tell)

**File**: `/src/components/onboarding/step-experience.tsx`

This is the most important onboarding step. Show a real sample study excerpt so the user can see what the reading experience looks like.

```tsx
"use client";
import { useState } from 'react';
import { motion } from 'framer-motion';
import { SampleStudyEmbed } from './sample-study-embed';

interface StepExperienceProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepExperience({ onNext, onBack }: StepExperienceProps) {
  const [hasScrolled, setHasScrolled] = useState(false);

  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold sm:text-3xl"
      >
        This is what a study looks like
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-3 text-sm text-muted-foreground"
      >
        Scroll through this excerpt to see the depth of analysis.
      </motion.p>

      {/* Embedded sample study */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6"
      >
        <SampleStudyEmbed onScroll={() => setHasScrolled(true)} />
      </motion.div>

      {/* Callouts that appear as user scrolls */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: hasScrolled ? 1 : 0 }}
        className="mt-4 space-y-2"
      >
        <p className="text-xs text-muted-foreground">
          Notice the original Greek and Hebrew insights, cross-references connecting the whole Bible, and contextual analysis for every passage.
        </p>
        <div className="inline-flex items-center gap-2 rounded-md bg-[#e8ede6] dark:bg-[#2a3527]/30 px-3 py-1.5 text-xs text-[#3d4f35] dark:text-[#a8b8a0]">
          <span>Mountain icon (shown as a small mountain emoji in studies)</span>
          <span>This symbol means the information comes from historical records, not the biblical text itself.</span>
        </div>
      </motion.div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Sample Study Embed

**File**: `/src/components/onboarding/sample-study-embed.tsx`

A scrollable container showing a curated excerpt from a real study. Use `react-markdown` (same as Brief 07's markdown renderer) to render the sample content safely. Do NOT use `dangerouslySetInnerHTML`.

```tsx
"use client";
import { useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { SAMPLE_STUDY_MARKDOWN } from '@/lib/data/sample-study';

interface SampleStudyEmbedProps {
  onScroll: () => void;
}

export function SampleStudyEmbed({ onScroll }: SampleStudyEmbedProps) {
  const hasTriggered = useRef(false);

  const handleScroll = useCallback(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true;
      onScroll();
    }
  }, [onScroll]);

  return (
    <div
      onScroll={handleScroll}
      className="mx-auto max-h-[400px] max-w-lg overflow-y-auto rounded-xl border bg-card p-6 text-left shadow-lg"
    >
      <div className="prose prose-sm dark:prose-invert">
        <ReactMarkdown
          components={{
            // Custom blockquote for scripture styling
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-[#a8b8a0] bg-[#e8ede6]/50 dark:bg-[#2a3527]/30 py-3 px-4 rounded-r-lg not-italic font-serif">
                {children}
              </blockquote>
            ),
            // Custom paragraph to detect the mountain icon prefix
            p: ({ children }) => {
              const text = typeof children === 'string' ? children : '';
              if (typeof children === 'string' && children.startsWith('\u26F0\uFE0F')) {
                return (
                  <div className="rounded-lg border border-[#c49a6c]/50 bg-gradient-to-r from-[#e8ede6]/80 to-[#ddd9d0]/40 dark:from-[#2a3527]/30 dark:to-[#3a362f]/20 p-3 my-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">{'\u26F0\uFE0F'}</span>
                      <div className="flex-1 text-[#3d4f35] dark:text-[#a8b8a0]">
                        {children}
                      </div>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#5c564a]/70 dark:text-[#c4bfb3]/50 italic">
                      Historical context — not sourced from biblical databases
                    </p>
                  </div>
                );
              }
              return <p>{children}</p>;
            },
            // Highlight Strong's numbers
            strong: ({ children }) => {
              const text = typeof children === 'string' ? children : '';
              if (/[GH]\d{3,5}/.test(text)) {
                return (
                  <span className="inline rounded bg-sky-50 dark:bg-sky-950/30 px-1 py-0.5 font-semibold text-sky-900 dark:text-sky-200 border border-sky-200/50 dark:border-sky-800/50 text-xs">
                    {children}
                  </span>
                );
              }
              return <strong>{children}</strong>;
            },
          }}
        >
          {SAMPLE_STUDY_MARKDOWN}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

### Sample Study Content (Markdown)

**File**: `/src/lib/data/sample-study.ts`

Create a curated markdown excerpt from the Acts 10 study or Peter study. This is HARDCODED, not fetched from the database. It should showcase:

1. A section heading
2. A scripture blockquote
3. A Greek/Hebrew word analysis
4. A cross-reference section
5. A paragraph prefixed with the mountain icon for historical context

```typescript
export const SAMPLE_STUDY_MARKDOWN = `
### Peter's Confession at Caesarea Philippi

> *"Simon Peter answered, 'You are the Christ, the Son of the living God.' And Jesus answered and said to him, 'Blessed are you, Simon Bar-Jonah, because flesh and blood did not reveal this to you, but My Father who is in heaven.'"*
>
> *— Matthew 16:16-17*

Jesus asked His disciples who people said He was. They reported various opinions. Then Jesus asked the direct question: "But who do you say that I am?" Peter answered decisively.

**Greek Insight:** In this verse, two distinct Greek words are used. Jesus says "you are **Petros (G4074)**" — a piece of rock — "and upon this **petra (G4073)**" — a mass of rock, bedrock — "I will build My church."

**Cross-References:**
- Mark 8:29 — Peter's confession: "You are the Christ."
- Luke 9:20 — "The Christ of God."
- Genesis 17:5 — God renaming Abram to Abraham (pattern of divine renaming)

\u26F0\uFE0F Caesarea Philippi was a city in the far north of Israel, near Mount Hermon. It was known for its pagan temples, including a shrine to the Greek god Pan. Jesus chose this location — steeped in idolatry — to ask His disciples who they believed Him to be.

### The Immediate Rebuke (Matthew 16:22-23)

> *"Peter took Him aside and began to rebuke Him, saying, 'God forbid it, Lord! This shall never happen to You.' But He turned and said to Peter, 'Get behind Me, Satan! You are a stumbling block to Me; for you are not setting your mind on God's interests, but man's.'"*
>
> *— Matthew 16:22-23*

The same man who, moments earlier, had received divine revelation about Jesus' identity now tried to override God's plan. Peter's love was genuine, but it was operating from a human perspective.

**Greek Insight:** The word for "stumbling block" is **skandalon (G4625)**, meaning an obstacle that causes someone to fall.
`;
```

---

## 7. Step 3 — Your Role

**File**: `/src/components/onboarding/step-role.tsx`

```tsx
"use client";
import { motion } from 'framer-motion';
import { BookOpen, Highlighter, PenLine, Key } from 'lucide-react';

interface StepRoleProps {
  onNext: () => void;
  onBack: () => void;
}

const roles = [
  {
    icon: BookOpen,
    title: 'Read and study',
    description: 'Browse the library and dive deep into contextual Bible studies.',
  },
  {
    icon: Highlighter,
    title: 'Highlight and annotate',
    description: 'Mark passages that speak to you — keep personal notes as you study.',
  },
  {
    icon: PenLine,
    title: 'Generate studies',
    description: 'When you are ready, create your own studies using AI-powered contextual analysis.',
  },
  {
    icon: Key,
    title: 'Bring your own key (optional)',
    description: 'Add your own API key for unlimited study generation. Never required — never pressured.',
  },
];

export function StepRole({ onNext, onBack }: StepRoleProps) {
  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold sm:text-3xl"
      >
        What you can do here
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-3 text-sm text-muted-foreground"
      >
        No pressure to contribute. Reading is a first-class experience.
      </motion.p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl mx-auto text-left">
        {roles.map((role, i) => (
          <motion.div
            key={role.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.15 }}
            className="flex gap-3 rounded-lg bg-card/50 p-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <role.icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{role.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {role.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Almost there
        </button>
      </div>
    </div>
  );
}
```

---

## 8. Step 4 — Ready

**File**: `/src/components/onboarding/step-ready.tsx`

```tsx
"use client";
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface StepReadyProps {
  onComplete: () => void;
  onBack: () => void;
}

export function StepReady({ onComplete, onBack }: StepReadyProps) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
      >
        <span className="text-4xl" role="img" aria-label="Open book">📖</span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-3xl font-bold sm:text-4xl"
      >
        Your library awaits
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-4 text-muted-foreground leading-relaxed max-w-md mx-auto"
      >
        Explore studies crafted with contextual rigor. Every verse in its full context.
        Every word traced back to the original Hebrew and Greek.
        Welcome to a deeper way of studying Scripture together.
      </motion.p>

      <div className="mt-10 flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onComplete}
          className="group flex items-center gap-2 rounded-full bg-primary px-10 py-4 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Enter the Library
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </motion.button>
      </div>
    </div>
  );
}
```

---

## 9. Progress Dots

**File**: `/src/components/onboarding/progress-dots.tsx`

```tsx
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
            backgroundColor: i === current
              ? 'hsl(var(--primary))'
              : 'hsl(var(--muted-foreground) / 0.3)',
          }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}
```

---

## 10. Onboarding Backdrop

**File**: `/src/components/onboarding/onboarding-backdrop.tsx`

Similar to the library backdrop but tailored for onboarding — warmer, more inviting.

```tsx
"use client";
import { motion } from 'framer-motion';

export function OnboardingBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Warm radial gradient that shifts subtly */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 30% 30%, rgba(251,191,36,0.08), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(217,119,6,0.06), transparent 60%)',
            'radial-gradient(ellipse at 70% 30%, rgba(217,119,6,0.08), transparent 60%), radial-gradient(ellipse at 30% 70%, rgba(251,191,36,0.06), transparent 60%)',
          ],
        }}
        transition={{ duration: 15, repeat: Infinity, repeatType: 'reverse' }}
      />
    </div>
  );
}
```

Respect `prefers-reduced-motion` — if set, display the first gradient statically without animation. Add this check:

```tsx
import { useReducedMotion } from 'framer-motion';

export function OnboardingBackdrop() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {prefersReducedMotion ? (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 30%, rgba(251,191,36,0.08), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(217,119,6,0.06), transparent 60%)',
          }}
        />
      ) : (
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(ellipse at 30% 30%, rgba(251,191,36,0.08), transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(217,119,6,0.06), transparent 60%)',
              'radial-gradient(ellipse at 70% 30%, rgba(217,119,6,0.08), transparent 60%), radial-gradient(ellipse at 30% 70%, rgba(251,191,36,0.06), transparent 60%)',
            ],
          }}
          transition={{ duration: 15, repeat: Infinity, repeatType: 'reverse' }}
        />
      )}
    </div>
  );
}
```

---

## 11. API Route

**File**: `/src/app/api/user/onboarding-complete/route.ts`

```typescript
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function POST() {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(session.userId);

  return Response.json({ success: true });
}
```

---

## 12. Route Guard (Main Layout Update)

Update the `(main)` layout to redirect users who haven't completed onboarding.

**Recommended approach**: Check in the `(main)` layout Server Component, since it has access to the database:

```tsx
// /src/app/(main)/layout.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (session?.userId) {
    const user = db.prepare('SELECT onboarding_completed FROM users WHERE id = ?').get(session.userId) as { onboarding_completed: number } | undefined;

    if (user && !user.onboarding_completed) {
      // Check if we're already on the onboarding page to avoid redirect loop
      // Use the headers approach or check the URL in a middleware
      // For simplicity, the onboarding page itself handles the completed check and redirects away
      // So we only need to redirect TO onboarding from non-onboarding pages
      // This requires knowing the current path — use headers or middleware

      // Option: Use Next.js middleware (see below) for cleaner path checking
    }
  }

  return <>{children}</>;
}
```

**Better approach using middleware**:

```typescript
// /src/middleware.ts (add to existing middleware if one exists)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // The session cookie name depends on your iron-session config
  const hasSession = request.cookies.has('session');
  const onboardingDone = request.cookies.get('onboarding_complete')?.value === '1';
  const isOnboardingPage = request.nextUrl.pathname.startsWith('/onboarding');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isAuthPage = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/join') || request.nextUrl.pathname.startsWith('/welcome');

  // Only redirect authenticated users who haven't completed onboarding
  // and are trying to access main app pages
  if (hasSession && !onboardingDone && !isOnboardingPage && !isApiRoute && !isAuthPage) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Important**: For this middleware approach to work, you need to set a cookie when onboarding completes. Update the onboarding-complete API route to also set a cookie:

```typescript
// In /api/user/onboarding-complete/route.ts
import { cookies } from 'next/headers';

export async function POST() {
  // ... existing logic ...

  const cookieStore = await cookies();
  cookieStore.set('onboarding_complete', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return Response.json({ success: true });
}
```

And set this cookie on login as well (if user already completed onboarding).

---

## Verification Steps

After implementation, verify:

1. **New user redirect**: Create a new user (onboarding_completed = 0), navigate to `/library` — redirected to `/onboarding`
2. **Step 1 renders**: Welcome message with username, 7-step protocol visual with icons
3. **Step 2 renders**: Sample study embed is scrollable, callouts appear after scrolling, mountain icon explanation visible
4. **Step 3 renders**: Four role cards display correctly, BYOK mentioned as optional
5. **Step 4 renders**: "Enter the Library" button visible with arrow icon
6. **Navigation**: Forward/back buttons work, AnimatePresence transitions are smooth
7. **Skip button**: Small "Skip" button in corner works, marks onboarding complete, redirects to library
8. **Completion**: Clicking "Enter the Library" calls API, sets cookie, redirects to `/library`
9. **One-time**: After completion, navigating to `/onboarding` redirects to `/library`
10. **Progress dots**: Current step highlighted with wider dot, animation between steps
11. **Mobile**: All steps render correctly at 375px width, text sizes appropriate
12. **Dark mode**: Onboarding looks good in both light and dark mode
13. **Reduced motion**: Disable animations in OS settings — content still displays, no motion

---

## Dependencies to Install

```bash
npm install framer-motion react-markdown
# Shadcn components (should already be installed from prior briefs):
# button
```

---

## Notes

- The sample study content in `sample-study.ts` is hardcoded markdown, not fetched from the database. This ensures onboarding works even with an empty library. It is rendered using `react-markdown` (not raw HTML injection) for safety.
- The mountain icon explanation is critical — make sure it's prominent and clear. Users need to understand this icon before they start reading studies.
- The "Skip" button should be small and unobtrusive (muted, small text, top-right corner). It's for returning users who somehow trigger onboarding again.
- BYOK is mentioned once in Step 3 with the explicit note "Never required — never pressured." Do not make it prominent or create FOMO.
- The onboarding background should NOT include the same particles as the library backdrop. Keep it simpler — just warm gradients.
