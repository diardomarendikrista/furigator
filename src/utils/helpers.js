/**
 * Converts Katakana characters in a string to Hiragana.
 * @param {string} str - The input string containing Katakana.
 * @returns {string} - The string with Katakana converted to Hiragana.
 */
export const kataToHira = (str) =>
  (str || "").replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );

/**
 * Checks if a string contains any Kanji characters.
 * @param {string} str - The string to check.
 * @returns {boolean} - True if Kanji is found, false otherwise.
 */
export const hasKanji = (str) =>
  [...(str || "")].some(
    (ch) =>
      (ch >= "\u4e00" && ch <= "\u9faf") ||
      (ch >= "\u3400" && ch <= "\u4dbf")
  );

/**
 * Escapes HTML special characters in a string.
 * @param {string} s - The string to escape.
 * @returns {string} - The escaped string.
 */
export function escHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Segments a surface string into alternating blocks of kanji and non-kanji characters.
 * e.g. "飛び込む" → [{ text:"飛", isKanji:true }, { text:"び", isKanji:false },
 *                    { text:"込", isKanji:true }, { text:"む", isKanji:false }]
 * @param {string} surface
 * @returns {Array<{ text: string, isKanji: boolean }>}
 */
function segmentSurface(surface) {
  const segs = [];
  let i = 0;
  while (i < surface.length) {
    const isK = hasKanji(surface[i]);
    let j = i + 1;
    while (j < surface.length && hasKanji(surface[j]) === isK) j++;
    segs.push({ text: surface.slice(i, j), isKanji: isK });
    i = j;
  }
  return segs;
}

/**
 * Greedily aligns a flat hiragana reading to surface segments.
 * Non-kanji segments are used as anchors — the reading between anchors is
 * attributed to the kanji segment that precedes it.
 *
 * @param {Array<{ text: string, isKanji: boolean }>} segments
 * @param {string} reading - Hiragana reading string.
 * @returns {Array<{ text: string, ruby?: string, isRuby: boolean }>}
 */
function alignSegments(segments, reading) {
  const result = [];
  let rPos = 0;

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];

    if (!seg.isKanji) {
      // Non-kanji: match literally in the remaining reading to advance the cursor
      const norm = kataToHira(seg.text);
      const idx = reading.indexOf(norm, rPos);
      if (idx !== -1) {
        rPos = idx + norm.length;
      }
      result.push({ text: seg.text, isRuby: false });
    } else {
      // Kanji: consume reading up to the position of the NEXT non-kanji anchor
      let rEnd = reading.length; // default: consume to end

      // Look ahead for the next non-kanji segment to use as an anchor
      for (let ni = si + 1; ni < segments.length; ni++) {
        if (!segments[ni].isKanji) {
          const norm = kataToHira(segments[ni].text);
          const anchorIdx = reading.indexOf(norm, rPos);
          if (anchorIdx !== -1) {
            rEnd = anchorIdx;
          }
          break;
        }
        // If the next segment is also kanji, we can't anchor — consume remaining
      }

      const kanjiReading = reading.slice(rPos, rEnd);
      rPos = rEnd;

      if (kanjiReading) {
        result.push({ text: seg.text, ruby: kanjiReading, isRuby: true });
      } else {
        result.push({ text: seg.text, isRuby: false });
      }
    }
  }

  return result;
}

/**
 * Parses a single token's surface and reading into a mixed array of text and ruby parts.
 *
 * Supports:
 *  - Interleaved kanji/kana (e.g. 飛び込む → 飛[と] び 込[こ] む)
 *  - Manual bracket annotation on surface (e.g. surface = "飛[と]び込[こ]む")
 *  - Simple prefix/suffix okurigana (e.g. 書く, 読み)
 *  - Pure kanji blocks (e.g. 日本語)
 *
 * @param {string} surface - The original text (kanji + kana mixed).
 * @param {string} reading - The furigana reading (hiragana).
 * @returns {Array<{ text: string, ruby?: string, isRuby: boolean }>}
 */
export function parseFurigana(surface, reading) {
  if (!reading || surface === reading || !hasKanji(surface)) {
    return [{ text: surface, isRuby: false }];
  }

  // 1. Manual Bracket Override — annotated on surface: 飛[と]び込[こ]む
  //    The bracket contains the reading for the text immediately before it.
  if (surface.includes("[") && surface.includes("]")) {
    // eslint-disable-next-line no-useless-escape
    const regex = /([^\[\]]+)\[([^\[\]]+)\]/g;
    let lastIndex = 0;
    let match;
    const result = [];
    while ((match = regex.exec(surface)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: surface.substring(lastIndex, match.index), isRuby: false });
      }
      result.push({ text: match[1], ruby: match[2], isRuby: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < surface.length) {
      result.push({ text: surface.substring(lastIndex), isRuby: false });
    }
    return result;
  }

  // 2. Auto-split: segment surface into kanji/non-kanji blocks, align reading
  const segments = segmentSurface(surface);

  // Single segment — pure kanji or pure kana block
  if (segments.length === 1) {
    return segments[0].isKanji
      ? [{ text: surface, ruby: reading, isRuby: true }]
      : [{ text: surface, isRuby: false }];
  }

  return alignSegments(segments, reading);
}
