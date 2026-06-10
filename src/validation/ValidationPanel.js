import TokenChip from "./TokenChip";

/**
 * ValidationPanel component handles the overlay UI for furigana validation.
 * It manages the display of tokens, progress bar, and action buttons.
 */
export default function ValidationPanel({
  validationTokens,
  validationSource,
  onClose,
  onConfirmToken,
  onSkipToken,
  onEditToken,
  onConfirmAll,
  onApply,
  onCloseAllEditing,
}) {
  if (!validationTokens) return null;

  // Calculate progress within the component
  const needsTokens = validationTokens.filter((t) => t.needsFurigana);
  const confirmedCount = needsTokens.filter((t) => t.confirmed).length;
  const totalNeeds = needsTokens.length;
  const progress = totalNeeds > 0 ? Math.round((confirmedCount / totalNeeds) * 100) : 100;

  return (
    <div className="vp-overlay" onClick={onClose}>
      <div className="vp-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vp-header">
          <div className="vp-title">
            ✦ Furigana Validation
            <span className="vp-source-tag">
              {validationSource === "input" ? "Simple Input" : "Editor Output"}
            </span>
          </div>
          <button className="vp-close" onClick={onClose}>✕</button>
        </div>

        {/* Progress bar */}
        <div className="vp-progress-wrap">
          <div className="vp-progress-bar">
            <div className="vp-progress-fill" style={{ width: progress + "%" }} />
          </div>
          <span className="vp-progress-label">
            {confirmedCount}/{totalNeeds} confirmed
          </span>
        </div>

        {/* Legend */}
        <div className="vp-legend">
          <span><span className="vp-dot vp-dot-warn" />Needs review</span>
          <span><span className="vp-dot vp-dot-ok" />Confirmed</span>
          <span><span className="vp-dot vp-dot-gray" />No furigana</span>
          <span className="vp-legend-hint">Edit = edit reading · ✕ = remove furigana</span>
        </div>

        {/* Tokens */}
        <div className="vp-token-grid">
          {validationTokens.map((t) => (
            <TokenChip
              key={t.id}
              token={t}
              onConfirm={onConfirmToken}
              onSkip={onSkipToken}
              onEdit={onEditToken}
            />
          ))}
        </div>

        {/* Status */}
        <div className="vp-status">
          <span>
            <span className="vp-dot vp-dot-warn" />
            {totalNeeds - confirmedCount} unconfirmed
          </span>
          <span>
            <span className="vp-dot vp-dot-ok" />
            {confirmedCount} confirmed
          </span>
          <span>
            <span className="vp-dot vp-dot-gray" />
            {validationTokens.filter((t) => !t.needsFurigana).length} plain
          </span>
        </div>

        {/* Actions */}
        <div className="vp-actions">
          <button className="vp-btn vp-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="vp-btn vp-btn-secondary" onClick={onConfirmAll}>
            Confirm All
          </button>
          <button className="vp-btn vp-btn-primary" onClick={onApply}>
            ▶ Apply to Output
          </button>
        </div>
      </div>
    </div>
  );
}
