export type DisplaySurface =
  | { kind: 'reader'; studyId: string }
  | { kind: 'bench'; boardId: string }
