export type DisplaySurface =
  | { kind: 'reader'; studyId: string }
  | { kind: 'bench'; boardId: string }
  // Generated PDF/DOCX downloads. Counts as a licensed-translation
  // "display" under ABS ToS §14, so the FUMS audit trail records it
  // distinctly from in-app reads.
  | { kind: 'export'; studyId: string }
