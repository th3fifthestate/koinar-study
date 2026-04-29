// app/scripts/probe-export.ts
//
// One-shot probe: take a real study from app.db, run it through the
// export parser + renderer, write the PDF to /tmp, and report timings +
// byte size. Lets us verify the rendering pipeline end-to-end without
// depending on the dev server's compile state.
//
//   npx tsx scripts/probe-export.ts <studyId> [translation]

import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db/connection";
import { parseStudyMarkdown } from "@/lib/export/markdown-parser";
import { renderStudyToPdf } from "@/lib/export/pdf-renderer";
import type { TranslationId } from "@/lib/translations/registry";

async function main(): Promise<void> {
  const studyId = parseInt(process.argv[2] ?? "1", 10);
  const translation = (process.argv[3] ?? "BSB") as TranslationId;

  const row = getDb()
    .prepare(
      `SELECT id, title, content_markdown FROM studies WHERE id = ?`,
    )
    .get(studyId) as
    | { id: number; title: string; content_markdown: string }
    | undefined;
  if (!row) {
    console.error(`[probe-export] study id ${studyId} not found`);
    process.exit(2);
  }

  console.log("[probe-export] study", {
    id: row.id,
    title: row.title,
    markdownBytes: row.content_markdown.length,
  });

  const tParse = Date.now();
  const ast = parseStudyMarkdown(row.content_markdown);
  console.log("[probe-export] parsed", {
    parseMs: Date.now() - tParse,
    blocks: ast.blocks.length,
    headings: ast.headings.length,
    title: ast.title,
  });

  const tRender = Date.now();
  const pdf = await renderStudyToPdf(ast, {
    translation,
    study: { id: row.id, title: row.title, generatedAt: new Date().toISOString() },
  });
  console.log("[probe-export] rendered", {
    renderMs: Date.now() - tRender,
    bytes: pdf.length,
    magic: pdf.subarray(0, 5).toString(),
  });

  const out = path.join("/tmp", `koinar-probe-${studyId}-${translation}.pdf`);
  fs.writeFileSync(out, pdf);
  console.log("[probe-export] wrote", out);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[probe-export] fatal", err);
    process.exit(1);
  });
