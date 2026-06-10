import { useState, useEffect, useRef } from "react";
import { parseFurigana } from "../utils/helpers";

/**
 * Component representing a single word (token) in the validation grid.
 * Allows users to confirm, skip, or edit the reading of a token.
 */
export default function TokenChip({ token, onConfirm, onSkip, onEdit }) {
  const [draft, setDraft] = useState(token.reading);
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(token.reading);
  }, [token.reading]);

  useEffect(() => {
    if (token.editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [token.editing]);

  if (!token.needsFurigana) {
    return (
      <div className="chip chip-plain">
        <span className="chip-rt-ph">&nbsp;</span>
        <span className="chip-surface">{token.surface}</span>
      </div>
    );
  }

  const chipClass =
    "chip " +
    (token.editing
      ? "chip-editing"
      : token.confirmed
        ? "chip-confirmed"
        : "chip-needs");

  return (
    <div className={chipClass}>
      {!token.confirmed && <span className="chip-badge badge-warn">!</span>}
      {token.confirmed && !token.editing && (
        <span className="chip-badge badge-ok">✓</span>
      )}
      <div className="chip-content">
        {parseFurigana(token.surface, token.reading).map((p, idx) => (
          <div key={idx} className="chip-part">
            <span className="chip-rt">{p.isRuby ? (p.ruby || "—") : "\u00A0"}</span>
            <span className="chip-surface">{p.text}</span>
          </div>
        ))}
      </div>
      <div className="chip-actions">
        {!token.confirmed && (
          <button
            className="chip-btn btn-confirm"
            onClick={() => onConfirm(token.id)}
          >
            ✓
          </button>
        )}
        <button
          className="chip-btn btn-edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(token.id, null);
          }}
        >
          Edit
        </button>
        {!token.confirmed && (
          <button
            className="chip-btn btn-skip"
            onClick={() => onSkip(token.id)}
          >
            ✕
          </button>
        )}
      </div>

      {token.editing && (
        <div className="chip-popup" onClick={(e) => e.stopPropagation()}>
          <div className="popup-preview">
            {parseFurigana(token.surface, draft).map((p, idx) =>
              p.isRuby ? (
                <ruby key={idx}>
                  {p.text}
                  <rt>{p.ruby}</rt>
                </ruby>
              ) : (
                <span key={idx}>{p.text}</span>
              )
            )}
          </div>
          <label className="popup-label">Furigana (e.g. 作[つく]っ)</label>
          <input
            ref={inputRef}
            className="popup-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEdit(token.id, draft);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onEdit(token.id, null);
              }
            }}
            placeholder="Hiragana"
          />
          <div className="popup-actions">
            <button className="popup-btn" onClick={() => onEdit(token.id, null)}>
              Cancel
            </button>
            <button
              className="popup-btn popup-btn-save"
              onClick={() => onEdit(token.id, draft)}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
