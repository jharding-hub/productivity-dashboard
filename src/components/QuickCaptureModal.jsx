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
            onInput={() => window._renderQuickAddPreview('quickCaptureInput', 'quickCapturePreview', { date: true, time: true, priority: true, recurrence: true })}
          />
          <div className="quick-add-preview" id="quickCapturePreview" style={{ display: 'none' }}></div>
          <div className="qc-hint">Enter to save &middot; Esc to close &middot; try &quot;!high&quot; or &quot;tomorrow&quot; &mdash; task-like text becomes a Task, otherwise it's a Brain Dump thought</div>
        </div>
      </div>
    </>
  );
}
