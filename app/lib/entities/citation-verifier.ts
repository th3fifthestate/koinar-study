// lib/entities/citation-verifier.ts
// Post-generation citation verification — checks that cited sources
// actually exist in the databases.
//
// APPROVED_SOURCES reflects the source allow-list from
// founders-files/Section3_Revised_v2.md (v2.0, 2026-04-13).
// Viz.Bible is intentionally excluded per v2 reclassification as a
// community project — use upstream sources (STEPBible, OpenBible) instead.
// Hitchcock's Bible Names is approved but should be treated as a weak
// signal only (many etymologies are folk/debated — prefer STEPBible lexicon).

import { getDb } from '../db/connection';
import { getVerse, lookupStrongs, normalizeBookName } from '../db/bible/queries';
import type { EntityCitation } from '../db/types';

export interface VerificationResult {
  entityId: string;
  entityName: string;
  totalCitations: number;
  verifiedCitations: number;
  issues: string[];
}

const APPROVED_SOURCES = new Set([
  // ───────── 3.1 Primary Ancient Sources (public domain) ─────────
  'Josephus',
  'Josephus, Antiquities of the Jews',
  'Josephus, The Jewish War',
  'Philo',
  'Philo of Alexandria',
  'Tacitus',
  'Tacitus, Annals',
  'Tacitus, Histories',
  'Pliny the Elder',
  'Pliny the Elder, Natural History',
  'Herodotus',
  'Herodotus, Histories',
  'Strabo',
  'Strabo, Geography',
  'Dio Cassius',
  'Dio Cassius, Roman History',
  'Cassius Dio',
  'Eusebius',
  'Eusebius, Ecclesiastical History',
  'The Mishnah',
  'Mishnah',
  'The Babylonian Talmud',
  'Babylonian Talmud',
  'Talmud',
  'Gemara',
  '1 Maccabees',
  '2 Maccabees',
  'The Didache',
  'Didache',
  'Ante-Nicene Fathers',
  'Nicene and Post-Nicene Fathers',
  'Early Church Fathers',
  'Clement of Rome',
  'Ignatius',
  'Polycarp',
  'Justin Martyr',
  'Irenaeus',
  'Tertullian',
  'Origen',
  'Augustine',
  'Jerome',

  // ───────── 3.2 Structured Biblical Data (CC / open) ─────────
  'TIPNR',
  'TIPNR Dataset',
  'STEPBible TIPNR',
  'STEPBible Lexicon',
  'TBESH',
  'TBESG',
  'Tyndale Open Study Notes',
  'Tyndale Open Bible Dictionary',
  'OpenBible.info',
  'OpenBible.info Geocoding',
  'Treasury of Scripture Knowledge',
  'TSK',
  'Cross-References',
  'Dead Sea Scrolls',
  'Dead Sea Scrolls Digital Library',
  'BSB',
  'Berean Standard Bible',
  'KJV',
  'ASV',
  'WEB',

  // ───────── 3.3 Public Domain Dictionaries ─────────
  'International Standard Bible Encyclopedia',
  'ISBE',
  "Easton's Bible Dictionary",
  "Smith's Bible Dictionary",
  "Fausset's Bible Dictionary",
  "Hitchcock's Bible Names", // use with caution per v2 caveat
  "Nave's Topical Bible",

  // ───────── 3.4 Scholarly / Digital Libraries ─────────
  'Sefaria',
  'Perseus',
  'Perseus Digital Library',
  'LacusCurtius',
  'Biblical Archaeology Society',
  'Biblical Archaeology Review',
  'CCEL',
  'Christian Classics Ethereal Library',

  // ───────── Archaeological Artifacts & Inscriptions ─────────
  'Archaeological',
  'Pilate Stone',
  'Siloam Inscription',
  'Lachish Letters',
  'Mesha Stele',
  'Moabite Stone',
  'Sennacherib Prism',
  'Tel Dan Stele',
  'Cyrus Cylinder',

  // ───────── Museums (artifact citations) ─────────
  'British Museum',
  'Louvre',
  'Israel Museum',

  // ───────── Additional Classical / Greco-Roman authors ─────────
  'Suetonius',
  'Suetonius, Life of Claudius',
  'Suetonius, Lives of the Caesars',
  'Polybius',
  'Polybius, Histories',
  'Plutarch',
  'Plutarch, Life of Antony',
  'Pausanias',
  'Pausanias, Description of Greece',
  'Thucydides',
  'Thucydides, History of the Peloponnesian War',
  'Livy',
  'Livy, Ab Urbe Condita',
  'Petronius',
  'Petronius, Satyricon',
  'Cicero',
  'Cicero, In Pisonem',
  'Diogenes Laertius',

  // ───────── Additional Late-Antique / Christian sources ─────────
  'Epiphanius',
  'Epiphanius, Panarion',
  'Egeria',
  'Martyrdom of Polycarp',
  'Letter of Aristeas',

  // ───────── Septuagint variants ─────────
  'Septuagint',
  'LXX',
  'Septuagint (LXX)',

  // ───────── Additional Named Artifacts / Tablets / Monuments ─────────
  'Lachish Reliefs',
  'Nabonidus Chronicle',
  'Babylonian Chronicle',
  'Jehoiachin Ration Tablets',
  'Arch of Titus',
  'Black Obelisk',
  'Black Obelisk of Shalmaneser III',
  'Karnak Temple Relief',
  'Bubastite Portal',
  'Elephantine Papyri',

  // ───────── Institutional / Academic Archaeological Sources ─────────
  'Israel Antiquities Authority',
  'UNESCO World Heritage Centre',
  'Biblical Archaeologist',
  'American School of Classical Studies at Athens',
  'Harvard-Cornell Archaeological Expedition to Sardis',
  'Tell es-Safi/Gath Archaeological Project',
  'Tel Ashdod Excavations',
  'Edward Robinson, Biblical Researches in Palestine',

  // ───────── Koinar internal data sources ─────────
  'Original Language Breakdown',
  'Original Language Data',

  // ───────── Other ─────────
  "Strong's Concordance",
  'Book of Enoch',
  '1 Enoch',
  'Jubilees',
]);

// Match common source name prefixes for flexibility
function isApprovedSource(sourceName: string): boolean {
  if (APPROVED_SOURCES.has(sourceName)) return true;

  const lower = sourceName.toLowerCase();

  // ── Existing rules ──
  if (lower.startsWith('josephus')) return true;
  if (lower.includes("easton's") || lower.includes("smith's")) return true;
  if (lower.startsWith('archaeological') || lower.includes('stele') || lower.includes('inscription')) return true;
  if (lower === 'bsb' || lower.includes('berean')) return true;
  if (lower.includes("strong's")) return true;
  if (lower.includes('maccabees') || lower.includes('enoch')) return true;
  if (lower.includes('tipnr')) return true;

  // ── Primary ancient authors (cover "Author, Work N.N" patterns) ──
  if (lower.startsWith('tacitus')) return true;
  if (lower.startsWith('pliny')) return true;
  if (lower.startsWith('herodotus')) return true;
  if (lower.startsWith('strabo')) return true;
  if (lower.startsWith('dio cassius') || lower.startsWith('cassius dio')) return true;
  if (lower.startsWith('eusebius')) return true;
  if (lower.startsWith('philo')) return true;

  // ── Rabbinic literature ──
  if (lower.includes('mishnah') || lower.includes('talmud') || lower.includes('gemara')) return true;
  if (lower.includes('tosefta') || lower.includes('midrash')) return true;

  // ── Early Church Fathers ──
  if (lower.includes('didache')) return true;
  if (lower.includes('ante-nicene') || lower.includes('nicene fathers') || lower.includes('church fathers')) return true;
  if (lower.startsWith('clement') || lower.startsWith('ignatius') || lower.startsWith('polycarp')) return true;
  if (lower.startsWith('justin martyr') || lower.startsWith('irenaeus') || lower.startsWith('tertullian')) return true;
  if (lower.startsWith('origen') || lower.startsWith('augustine') || lower.startsWith('jerome')) return true;

  // ── Modern reference works added in v2 ──
  if (lower.includes('isbe') || lower.includes('international standard bible')) return true;
  if (lower.includes('fausset')) return true;
  if (lower.includes('hitchcock')) return true;
  if (lower.includes("nave")) return true;
  if (lower.includes('tyndale')) return true;
  if (lower.includes('stepbible') || lower.includes('tbesh') || lower.includes('tbesg')) return true;

  // ── Data / cross-references ──
  if (lower.includes('openbible')) return true;
  if (lower.includes('treasury of scripture') || lower === 'tsk') return true;

  // ── Digital libraries & scholarly sites ──
  if (lower.includes('sefaria')) return true;
  if (lower.includes('perseus')) return true;
  if (lower.includes('lacuscurtius')) return true;
  if (lower.includes('ccel') || lower.includes('christian classics ethereal')) return true;
  if (lower.includes('biblical archaeology')) return true;

  // ── Museums ──
  if (lower.includes('british museum') || lower.includes('louvre') || lower.includes('israel museum')) return true;

  // ── Artifacts (stele/inscription already covered above) ──
  if (lower.includes('prism') || lower.includes('cylinder')) return true;
  if (lower.endsWith(' letters') || lower.endsWith(' stone')) return true;

  // ── Additional public domain Bible translations ──
  if (lower === 'kjv' || lower === 'asv' || lower === 'web') return true;

  // ── Additional classical / Greco-Roman authors ──
  if (lower.startsWith('suetonius')) return true;
  if (lower.startsWith('polybius')) return true;
  if (lower.startsWith('plutarch')) return true;
  if (lower.startsWith('pausanias')) return true;
  if (lower.startsWith('thucydides')) return true;
  if (lower.startsWith('livy')) return true;
  if (lower.startsWith('petronius')) return true;
  if (lower.startsWith('cicero')) return true;
  if (lower.startsWith('diogenes laertius')) return true;

  // ── Additional late-antique / Christian sources ──
  if (lower.startsWith('epiphanius')) return true;
  if (lower.startsWith('egeria')) return true;
  if (lower.includes('martyrdom of polycarp')) return true;
  if (lower.includes('letter of aristeas')) return true;

  // ── Septuagint variants ──
  if (lower.startsWith('septuagint') || lower.startsWith('lxx')) return true;
  if (lower.includes('(lxx)')) return true;

  // ── Dead Sea Scrolls variants (e.g. "Dead Sea Scrolls — Great Isaiah Scroll", "Qumran") ──
  if (lower.includes('dead sea scrolls') || lower.includes('qumran')) return true;

  // ── Named artifacts / tablets / monuments ──
  if (lower.includes('lachish reliefs')) return true;
  if (lower.includes('nabonidus chronicle') || lower.includes('babylonian chronicle')) return true;
  if (lower.endsWith(' tablets') || lower.endsWith(' tablet')) return true;
  if (lower.startsWith('arch of ')) return true;
  if (lower.includes('obelisk')) return true;
  if (lower.includes('elephantine')) return true;
  if (lower.includes('karnak') || lower.includes('bubastite')) return true;
  if (lower.endsWith(' relief') || lower.endsWith(' reliefs')) return true;
  if (lower.endsWith(' portal')) return true;
  if (lower.endsWith(' papyri') || lower.endsWith(' papyrus')) return true;

  // ── Institutional / academic archaeological sources ──
  if (lower.includes('israel antiquities authority')) return true;
  if (lower.includes('unesco')) return true;
  if (lower.includes('biblical archaeologist')) return true;
  if (lower.includes('american school of classical studies')) return true;
  if (lower.includes('archaeological expedition') || lower.includes('archaeological project')) return true;
  if (lower.includes('excavation') || lower.includes('excavations')) return true;
  if (lower.includes('biblical researches')) return true;

  // ── Koinar internal data sources (from our Bible DBs / tools) ──
  if (lower.includes('original language breakdown') || lower.includes('original language data')) return true;

  // ── Specific artifact/publication name variants not caught above ──
  if (lower.includes('lachish letters')) return true; // covers "Lachish Letters (Ostraca)"
  if (lower.includes('(journal)')) return true; // peer-reviewed journals flagged as such
  if (lower.includes('ration tablets')) return true; // covers "Jehoiachin Ration Tablets (Babylon)"
  if (lower.includes('bsb') && lower.includes('lxx')) return true; // covers "BSB (LXX data)"
  if (lower.includes('martyrdom') && lower.includes('isaiah')) return true; // pseudepigraphal text

  // ── Scholarly monographs on specific archaeological sites ──
  // These are legitimate peer-reviewed works that appear in entity profiles
  // for archaeologically significant locations.
  if (lower.includes('corbo') && lower.includes('cafarnao')) return true;
  if (lower.includes('loffreda') && lower.includes('capharnaum')) return true;

  // Note: the model occasionally puts a verse ref (e.g. "Acts 21:38") into
  // source_name instead of "BSB" — those should stay flagged since they
  // represent a genuine citation format error.

  return false;
}

/**
 * Parse a verse reference string like "Matthew 2:1-18" or "Genesis 1:1"
 * into components.
 */
function parseVerseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  // Match patterns like "Genesis 1:1", "1 Kings 6:1", "Matthew 2:1-18"
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)/);
  if (!match) return null;
  return {
    book: match[1],
    chapter: parseInt(match[2], 10),
    verse: parseInt(match[3], 10),
  };
}

/**
 * Extract Strong's numbers from citation text (e.g., "H7225", "G3056")
 */
function extractStrongsNumbers(text: string): string[] {
  const matches = text.match(/[HG]\d{1,5}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Verify citations for a single entity.
 */
export function verifyCitations(entityId: string): VerificationResult {
  const db = getDb();
  const entity = db.prepare('SELECT canonical_name FROM entities WHERE id = ?').get(entityId) as
    | { canonical_name: string }
    | undefined;

  const citations = db
    .prepare('SELECT * FROM entity_citations WHERE entity_id = ?')
    .all(entityId) as EntityCitation[];

  const result: VerificationResult = {
    entityId,
    entityName: entity?.canonical_name ?? entityId,
    totalCitations: citations.length,
    verifiedCitations: 0,
    issues: [],
  };

  for (const citation of citations) {
    let verified = true;

    // Check 1: Source name is approved
    if (!isApprovedSource(citation.source_name)) {
      result.issues.push(
        `Unknown source: "${citation.source_name}" (ref: ${citation.source_ref ?? 'none'})`
      );
      verified = false;
    }

    // Check 2: BSB verse references exist in the database
    if (
      citation.source_name === 'BSB' ||
      citation.source_name === 'Berean Standard Bible'
    ) {
      if (citation.source_ref) {
        const parsed = parseVerseRef(citation.source_ref);
        if (parsed) {
          const verse = getVerse(parsed.book, parsed.chapter, parsed.verse);
          if (!verse) {
            result.issues.push(
              `BSB verse not found: ${citation.source_ref}`
            );
            verified = false;
          }
        }
      }
    }

    // Check 3: Strong's numbers in excerpt exist
    if (citation.excerpt) {
      const strongsNums = extractStrongsNumbers(citation.excerpt);
      for (const num of strongsNums) {
        const entry = lookupStrongs(num);
        if (!entry) {
          result.issues.push(
            `Strong's number not found: ${num} (in citation for ${citation.source_ref ?? citation.source_name})`
          );
          verified = false;
        }
      }
    }

    if (verified) {
      result.verifiedCitations++;
    }
  }

  return result;
}

/**
 * Verify citations for all entities that have generated content.
 */
export function verifyAllCitations(): VerificationResult[] {
  const db = getDb();
  const entities = db
    .prepare("SELECT id FROM entities WHERE full_profile IS NOT NULL AND full_profile != ''")
    .all() as { id: string }[];

  return entities.map((e) => verifyCitations(e.id));
}
