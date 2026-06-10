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
 * Parses a single token's surface and reading into a mixed array of text and ruby parts.
 * Supports auto-okurigana splitting AND manual bracket syntax (e.g. 飛[と]び込[こ]む).
 * @param {string} surface - The original text.
 * @param {string} reading - The furigana reading.
 * @returns {Array} - Array of objects: { text, ruby?, isRuby }
 */
export function parseFurigana(surface, reading) {
  if (!reading || surface === reading || !hasKanji(surface)) {
    return [{ text: surface, isRuby: false }];
  }

  // 1. Manual Bracket Override (e.g. 飛[と]び込[こ]む)
  if (reading.includes('[') && reading.includes(']')) {
    // eslint-disable-next-line
    const regex = /([^\[\]]+)\[([^\[\]]+)\]/g;
    let lastIndex = 0;
    let match;
    const result = [];
    while ((match = regex.exec(reading)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: reading.substring(lastIndex, match.index), isRuby: false });
      }
      result.push({ text: match[1], ruby: match[2], isRuby: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < reading.length) {
      result.push({ text: reading.substring(lastIndex), isRuby: false });
    }
    return result;
  }

  // 2. Auto-Split Okurigana (Prefix & Suffix matching)
  let sStart = 0;
  let sEnd = surface.length;
  let rStart = 0;
  let rEnd = reading.length;

  // Match prefix
  while (sStart < sEnd && rStart < rEnd) {
    if (kataToHira(surface[sStart]) === reading[rStart] && !hasKanji(surface[sStart])) {
      sStart++;
      rStart++;
    } else {
      break;
    }
  }

  // Match suffix
  while (sEnd > sStart && rEnd > rStart) {
    if (kataToHira(surface[sEnd - 1]) === reading[rEnd - 1] && !hasKanji(surface[sEnd - 1])) {
      sEnd--;
      rEnd--;
    } else {
      break;
    }
  }

  const result = [];
  if (sStart > 0) {
    result.push({ text: surface.substring(0, sStart), isRuby: false });
  }

  if (sEnd > sStart) {
    result.push({
      text: surface.substring(sStart, sEnd),
      ruby: reading.substring(rStart, rEnd),
      isRuby: true
    });
  }

  if (sEnd < surface.length) {
    result.push({ text: surface.substring(sEnd), isRuby: false });
  }

  return result;
}
