export default function QuickCaptureModal() {
  return (
    <>
      <button className="qc-fab" id="quickCaptureFab" onClick={() => window.openQuickCapture()} title="Quick Capture (B)">
        &#9998;
      </button>
      <div className="modal-blur-overlay" id="quickCaptureModal">
        <div className="modal-blur-backdrop" onClick={() => window.closeQuickCapture()}></div>
        <div className="qc-panel">
          <input
            type="text"
            id="quickCaptureInput"
            className="qc-input"
            placeholder="Capture a thought or task..."
            autoComplete="off"
            onKeyDown={e => window.quickCaptureKeydown(e.nativeEvent)}
            onInput={() => window._renderQuickAddPreview('quickCaptureInput', 'quickCapturePreview', { date: true, time: true, recurrence: true })}
            onBlur={() => window.submitQuickCapture()}
          />
          <div className="quick-add-preview" id="quickCapturePreview" style={{ display: 'none' }}></div>
          <div className="qc-actions">
            <button className="qc-save-btn" onClick={() => window.submitQuickCapture()}>Save</button>
          </div>
          <div className="qc-hint">Leaving the box saves it &middot; Esc discards &middot; try &quot;tomorrow&quot; or &quot;every week&quot; &mdash; task-like text becomes a Task, otherwise it's a Brain Dump thought</div>
        </div>
      </div>
    </>
  );
}
