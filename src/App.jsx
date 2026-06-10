import { useEffect, useState, useCallback } from "react";
import { Editor } from "react-draft-wysiwyg";
import { EditorState, convertToRaw } from "draft-js";
import draftToHtml from "draftjs-to-html";
import parse from "html-react-parser";
import { renderToStaticMarkup } from "react-dom/server";

// ── imports from newly created modules
import {
  kataToHira,
  hasKanji,
  parseFurigana
} from "./utils/helpers";
import { buildValidationTokens, validationTokensToHtml, applyTokensToHtmlTree } from "./validation/logic";
import ValidationPanel from "./validation/ValidationPanel";
import Toast from "./components/Toast";

import "./App.css";

// ── Main App
/**
 * Main application component for the Furigana generator.
 */
function App() {
  const [text, setText] = useState("");
  const [previewState, setPreviewState] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [tokenizer, setTokenizer] = useState(null);
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [loading, setLoading] = useState(false);
  const [plainHTML, setPlainHTML] = useState(null);
  const [pendingEditorHtml, setPendingEditorHtml] = useState(null);

  // Validation state
  const [validationTokens, setValidationTokens] = useState(null);
  const [validationSource, setValidationSource] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Load kuromoji from local /dict/
  useEffect(() => {
    setLoading(true);
    window.kuromoji.builder({ dicPath: "/dict/" }).build((err, t) => {
      if (err) { console.error(err); return; }
      setTokenizer(t);
      setLoading(false);
    });
  }, []);

  // Original render helper (hover-to-show rt)
  /**
   * Helper to render token array as React elements with <ruby> tags.
   * @param {Array} toks - Array of morphemes.
   * @param {string} type - Key prefix type.
   */
  const renderTokens = (toks, type) =>
    toks.flatMap((t, i) => {
      if (hasKanji(t.surface_form) && t.reading && kataToHira(t.reading) !== t.surface_form) {
        const parts = parseFurigana(t.surface_form, kataToHira(t.reading));
        return parts.map((p, pIdx) =>
          p.isRuby ? (
            <ruby key={`${i}-${type}-${pIdx}`} style={{ marginRight: 4, cursor: "pointer" }}>
              {p.text}
              <rt style={{ fontSize: "0.6em" }}>{p.ruby}</rt>
            </ruby>
          ) : (
            <span key={`${i}-${type}-${pIdx}`}>{p.text}</span>
          )
        );
      }
      return <ruby key={`${i}-${type}`}>{t.surface_form}</ruby>;
    });

  // Simple input
  /**
   * Action for plain text input changes.
   */

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (tokenizer && value) setTokens(tokenizer.tokenize(value));
  };

  /**
   * Trigger validation mode for the simple text input.
   */
  const openInputValidation = () => {
    if (!tokenizer || !text) return;
    setValidationTokens(buildValidationTokens(tokenizer.tokenize(text)));
    setValidationSource("input");
  };

  // RTE editor
  /**
   * Action for Rich Text Editor changes. Normalizes and analyzes HTML output.
   */
  const onEditorStateChange = async (state) => {
    setEditorState(state);
    if (!tokenizer) return;

    const rawContent = convertToRaw(state.getCurrentContent());
    const baseHtml = draftToHtml(rawContent);

    const parsed = parse(baseHtml, {
      replace: (domNode) => {
        if (domNode.type === "text" && domNode.data.trim() !== "") {
          const toks = tokenizer.tokenize(domNode.data);
          return <>{renderTokens(toks, "rte")}</>;
        }
      },
    });

    const htmlString = renderToStaticMarkup(parsed);
    setPlainHTML(htmlString);
    setPreviewState(parsed);
    setPendingEditorHtml(baseHtml); // Store the raw structure!
  };

  /**
   * Trigger validation mode for the rich text editor's current output.
   */
  const openEditorValidation = () => {
    if (!tokenizer || !pendingEditorHtml) return;
    let allMorphemes = [];
    parse(pendingEditorHtml, {
      replace: (domNode) => {
        if (domNode.type === "text" && domNode.data.trim() !== "") {
          allMorphemes = allMorphemes.concat(tokenizer.tokenize(domNode.data));
        }
      }
    });
    setValidationTokens(buildValidationTokens(allMorphemes));
    setValidationSource("editor");
  };

  // Token actions
  /**
   * Marks a specific token as confirmed.
   */
  const confirmToken = useCallback((id) => {
    setValidationTokens((prev) =>
      prev.map((t) => (t.id === id ? { ...t, confirmed: true, editing: false } : t))
    );
  }, []);

  /**
   * Removes Furigana requirement for a specific token (skips it).
   */
  const skipToken = useCallback((id) => {
    setValidationTokens((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, needsFurigana: false, confirmed: true, editing: false } : t
      )
    );
  }, []);

  /**
   * Handles manual editing of a token's reading.
   */
  const handleEdit = useCallback((id, newReading) => {
    setValidationTokens((prev) =>
      prev.map((t) => {
        if (t.id !== id) return { ...t, editing: false };
        if (newReading === null) return { ...t, editing: !t.editing };
        const trimmed = newReading.trim();
        return { ...t, reading: trimmed, needsFurigana: trimmed !== "", confirmed: true, editing: false };
      })
    );
  }, []);

  /**
   * Confirms all tokens in the current validation set.
   */
  const confirmAll = useCallback(() => {
    setValidationTokens((prev) =>
      prev.map((t) => ({ ...t, confirmed: true, editing: false }))
    );
  }, []);

  /**
   * Closes the validation modal without applying changes.
   */
  const closeValidation = useCallback(() => {
    setValidationTokens(null);
    setValidationSource(null);
  }, []);

  /**
   * Resets editing state for all tokens (closes any open edit popups).
   */
  const closeAllEditing = useCallback(() => {
    setValidationTokens((prev) =>
      prev ? prev.map((t) => ({ ...t, editing: false })) : prev
    );
  }, []);

  /**
   * Finalizes the validation process, applies readings to the output.
   */
  const applyValidation = useCallback(() => {
    if (!validationTokens) return;

    let html = "";
    if (validationSource === "editor") {
      // Deeply replace text nodes in the original HTML structure keeping tags intact
      html = applyTokensToHtmlTree(pendingEditorHtml, validationTokens, tokenizer);
    } else {
      // Simple inputs don't have HTML tags, so we can just use the flat string method
      html = validationTokensToHtml(validationTokens);
    }

    setPlainHTML(html);
    setPreviewState(parse(html));
    setValidationTokens(null);
    setValidationSource(null);
  }, [validationTokens, validationSource, pendingEditorHtml, tokenizer]);


  /**
   * Utility to copy text to system clipboard.
   */
  const copyToClipboard = async (textToCopy) => {
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setToastMessage("Copied to clipboard!");
    } catch (err) {
      console.warn("Failed to copy:", err);
    }
  };

  /**
   * Helper to check if an HTML string effectively contains no readable text.
   */
  const isEmptyHTML = (html) => !html || html.replace(/<[^>]*>/g, "").trim().length === 0;

  return (
    <div className="app-root" onClick={closeAllEditing}>
      <h2 style={{ textAlign: "center" }}>Kanji To Furigana</h2>

      {/* Simple input */}
      <input
        value={text}
        onChange={handleTextChange}
        placeholder="例: 日本語を勉強します"
        style={{ padding: 8, fontSize: 16, width: "100%", boxSizing: "border-box" }}
        disabled={loading}
      />

      {text && (
        <div className="input-result">
          <div style={{ fontSize: "1.2rem", lineHeight: 1.8 }}>
            <span>Result: </span>
            {renderTokens(tokens, "input")}
          </div>
          <button
            className="btn-validate"
            onClick={openInputValidation}
            disabled={!tokenizer || !text}
          >
            ✦ Validate Furigana
          </button>
        </div>
      )}

      {/* Rich Text Editor */}
      <div style={{ marginTop: 32, width: "100%" }}>
        <Editor
          editorState={editorState}
          onEditorStateChange={onEditorStateChange}
          editorStyle={{ minHeight: 120, border: "1px solid #ddd", padding: 8, overflow: "auto" }}
          toolbar={{
            options: ["inline", "list", "history", "textAlign"],
            inline: { options: ["bold", "italic", "underline"] },
            list: { options: ["unordered", "ordered"] },
            history: { options: ["undo", "redo"] },
            textAlign: { options: ["left", "center", "right"] },
          }}
        />
      </div>

      {/* Results */}
      <div style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 12, textAlign: "center" }}>Results</h3>
        <div className="results-row">
          <div className="result-box">
            <strong>Preview (React):</strong>
            <div style={{ marginTop: 8 }}>{previewState}</div>
          </div>
          <div className="result-box result-box-code">
            <div className="result-box-header">
              <strong>Plain HTML:</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn-sm btn-sm-validate"
                  onClick={openEditorValidation}
                  disabled={isEmptyHTML(pendingEditorHtml) || !tokenizer}
                >
                  ✦ Validate
                </button>
                <button
                  className="btn-sm"
                  onClick={() => copyToClipboard(plainHTML)}
                  disabled={isEmptyHTML(plainHTML)}
                >
                  Copy
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.9rem" }}>
              {plainHTML}
            </div>
          </div>
        </div>
      </div>

      {/* ══ VALIDATION PANEL (overlay) ══ */}
      <ValidationPanel
        validationTokens={validationTokens}
        validationSource={validationSource}
        onClose={closeValidation}
        onConfirmToken={confirmToken}
        onSkipToken={skipToken}
        onEditToken={handleEdit}
        onConfirmAll={confirmAll}
        onApply={applyValidation}
        onCloseAllEditing={closeAllEditing}
      />

      {loading && (
        <div className="spinner-container">
          <div className="spinner" />
        </div>
      )}

      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />
    </div>
  );
}

export default App;
