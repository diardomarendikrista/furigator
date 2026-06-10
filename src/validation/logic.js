import { kataToHira, hasKanji, escHtml, parseFurigana } from "../utils/helpers";
import parse from "html-react-parser";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Transforms morphological analysis result (morphemes) into internal validation tokens.
 * @param {Array} morphemes - Array of morpheme objects from the tokenizer.
 * @returns {Array} - Array of token objects used for the validation UI.
 */
export function buildValidationTokens(morphemes) {
  return morphemes.map((m, i) => {
    const surface = m.surface_form || "";
    const reading = kataToHira(m.reading || surface);
    const needsFurigana = hasKanji(surface) && reading !== surface;
    return {
      id: i,
      surface,
      reading,
      needsFurigana,
      confirmed: !needsFurigana,
      editing: false,
    };
  });
}

/**
 * Converts a list of validation tokens into a final HTML string using <ruby> tags.
 * @deprecated This function flattens all HTML and is only suitable for plain text inputs.
 * @param {Array} tokens - The list of validated/edited tokens.
 * @returns {string} - The generated HTML string.
 */
export function validationTokensToHtml(tokens) {
  return tokens
    .map((t) => {
      if (t.needsFurigana && t.reading) {
        const parts = parseFurigana(t.surface, t.reading);
        return parts
          .map((p) =>
            p.isRuby
              ? `<ruby style="margin-right:4px;cursor:pointer">${escHtml(p.text)}<rt style="font-size:0.6em">${escHtml(p.ruby)}</rt></ruby>`
              : escHtml(p.text)
          )
          .join("");
      }
      return `<ruby>${escHtml(t.surface)}</ruby>`;
    })
    .join("");
}

/**
 * Applies validated tokens onto an existing HTML tree, preserving the markup (e.g. <p>, <strong>).
 * It uses a cursor to track which token we are currently matching against the text nodes.
 * @param {string} htmlSource - The original HTML string before validation.
 * @param {Array} validatedTokens - The array of tokens that have been confirmed by the user.
 * @param {Object} tokenizer - Kuromoji tokenizer instance.
 * @returns {string} - The new HTML string with <ruby> tags injected.
 */
export function applyTokensToHtmlTree(htmlSource, validatedTokens, tokenizer) {
  if (!htmlSource || !validatedTokens || !tokenizer) return htmlSource;

  let tokenCursor = 0; // Tracks our position in the validatedTokens array

  // Parse the raw HTML and replace text nodes with <ruby> representations based on our validated tokens.
  const reactElements = parse(htmlSource, {
    replace: (domNode) => {
      if (domNode.type === "text" && domNode.data.trim() !== "") {
        // We found a text node (e.g. inside a <p> or <strong>).
        // Let's tokenize this specific text fragment to know how many tokens it contains.
        const fragmentTokens = tokenizer.tokenize(domNode.data);
        const fragmentEndIndex = tokenCursor + fragmentTokens.length;

        // Slice the corresponding validated tokens for this text fragment
        const matchingTokens = validatedTokens.slice(tokenCursor, fragmentEndIndex);

        // Advance the cursor for the next text node
        tokenCursor = fragmentEndIndex;

        // Render this specific fragment using the confirmed readings from our validation panel
        const rubyElements = matchingTokens.flatMap((t, idx) => {
          if (t.needsFurigana && t.reading) {
            const parts = parseFurigana(t.surface, t.reading);
            return parts.map((p, pIdx) =>
              p.isRuby ? (
                <ruby key={`${idx}-${pIdx}`} style={{ marginRight: 4, cursor: "pointer" }}>
                  {p.text}
                  <rt style={{ fontSize: "0.6em" }}>{p.ruby}</rt>
                </ruby>
              ) : (
                <span key={`${idx}-${pIdx}`}>{p.text}</span>
              )
            );
          }
          return <ruby key={idx}>{t.surface}</ruby>;
        });

        // Return the React fragment. `html-react-parser` will swap the raw text node with this.
        return <>{rubyElements}</>;
      }
    },
  });

  // Convert the React elements back to a static HTML string
  return renderToStaticMarkup(reactElements);
}
