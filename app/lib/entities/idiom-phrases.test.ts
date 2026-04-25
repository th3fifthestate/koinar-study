import { describe, it, expect } from 'vitest';
import { getIdiomRanges } from './idiom-phrases';

describe('getIdiomRanges', () => {
  it('finds "Adam\'s apple" with proper bounds', () => {
    const text = "He has a prominent Adam's apple.";
    const ranges = getIdiomRanges(text);
    expect(ranges).toHaveLength(1);
    const [start, end] = ranges[0]!;
    expect(text.slice(start, end)).toBe("Adam's apple");
  });

  it("matches without the apostrophe (Adams apple)", () => {
    const text = 'Big Adams apple.';
    const ranges = getIdiomRanges(text);
    expect(ranges).toHaveLength(1);
  });

  it('finds "Solomon\'s seal" the plant', () => {
    const text = "We grow Solomon's seal in the shade garden.";
    const ranges = getIdiomRanges(text);
    expect(ranges).toHaveLength(1);
    const [start, end] = ranges[0]!;
    expect(text.slice(start, end)).toBe("Solomon's seal");
  });

  it('catches "raising Cain", "raise Cain", "raised Cain"', () => {
    const text = 'They were raising Cain. Then they would raise Cain again. Last week she raised Cain.';
    const ranges = getIdiomRanges(text);
    expect(ranges).toHaveLength(3);
  });

  it('catches "old as Methuselah" hyperbole', () => {
    const text = 'That tree is old as Methuselah.';
    const ranges = getIdiomRanges(text);
    expect(ranges).toHaveLength(1);
  });

  it('case-insensitive', () => {
    const text = "ADAM'S APPLE was visible.";
    const ranges = getIdiomRanges(text);
    expect(ranges).toHaveLength(1);
  });

  it('does NOT match "Adam went to Eden" (no apple)', () => {
    const text = 'Adam went to Eden.';
    expect(getIdiomRanges(text)).toHaveLength(0);
  });

  it('does NOT match "patience of Job" (study context — Job-as-exemplar still annotates)', () => {
    const text = 'Have the patience of Job in trials.';
    expect(getIdiomRanges(text)).toHaveLength(0);
  });

  it('does NOT match "doubting Thomas" (often refers to actual apostle)', () => {
    const text = "Don't be a doubting Thomas about the resurrection.";
    expect(getIdiomRanges(text)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(getIdiomRanges('')).toEqual([]);
  });
});
