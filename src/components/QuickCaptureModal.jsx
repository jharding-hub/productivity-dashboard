export default function QuickCaptureModal() {
  return (
    <>
      <button className="qc-fab" id="quickCaptureFab" onClick={() => window.openQuickCapture()} title="Quick Capture (B)" aria-label="Quick Capture">
        <span className="qc-fab-icon">&#9998;</span>
      </button>
      {/* R13/F23: "Home is a list of doors with no 'start here'" -- shown only
          to a returning user (post-onboarding, see _maybeShowFabHint) who
          still has zero tasks/notes/projects/reminders. Dismissible, and
          tapping the FAB itself counts as dismissal too (openQuickCapture). */}
      <div className="fab-hint" id="fabHint" style={{ display: 'none' }}>
        <span>Tap to capture your first task or thought</span>
        <button className="fab-hint-close" onClick={() => window.dismissFabHint()} aria-label="Dismiss hint">&#10005;</button>
      </div>
      <div className="modal-blur-overlay" id="quickCaptureModal" role="dialog" aria-modal="true" aria-label="Quick Capture">
        <div className="modal-blur-backdrop" onClick={() => window.closeQuickCapture()}></div>
        <div className="qc-panel">
          <input
            type="text"
            id="quickCaptureInput"
            className="qc-input"
            placeholder="Capture a thought or task..."
            aria-label="Capture a thought or task"
            autoComplete="off"
            onKeyDown={e => window.quickCaptureKeydown(e.nativeEvent)}
            onInput={() => window._renderQuickAddPreview('quickCaptureInput', 'quickCapturePreview', { date: true, time: true, recurrence: true })}
            onBlur={() => window.submitQuickCapture()}
          />
          <div className="quick-add-preview" id="quickCapturePreview" style={{ display: 'none' }}></div>
          <div className="qc-actions">
            <button className="qc-save-btn" onClick={() => window.submitQuickCapture()}>Save</button>
          </div>
          <div className="qc-hint">
            {/* "Esc discards" is desktop-only copy -- touch devices have no Esc key,
                and this modal is reached from a tap, not a keyboard shortcut, on phone. */}
            {window._isMobile && window._isMobile()
              ? <>Tap outside to save &middot; try &quot;tomorrow&quot; or &quot;every week&quot; &mdash; task-like text becomes a Task, otherwise it's a Brain Dump thought</>
              : <>Leaving the box saves it &middot; Esc discards &middot; try &quot;tomorrow&quot; or &quot;every week&quot; &mdash; task-like text becomes a Task, otherwise it's a Brain Dump thought</>}
          </div>
        </div>
      </div>
    </>
  );
}
