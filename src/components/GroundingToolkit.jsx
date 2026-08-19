export default function GroundingToolkit() {
  return (
    <div className="panel hidden-panel" data-panel="wellness" data-nav="wellness">
      <div className="panel-header">
        <div className="panel-title">
          <span className="drag-handle">&#10495;</span>
          <i className="ti ti-heart-rate icon" aria-hidden="true"></i> Grounding Session
        </div>
        <div className="panel-badge" id="wellnessTrigger">--</div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        Evidence-based techniques for your current state. Pick one:
      </p>
      <select
        className="wellness-select"
        id="wellnessSelect"
        onChange={() => window.showSelectedTechnique()}
      >
        <option value="">Choose a technique...</option>
      </select>
      <div id="techniqueDetail"></div>
      {/* Panel survey 2026-08-18 (A-4): passive footer link. */}
      <button className="modal-footer-link" onClick={() => window.openCrisisResources()} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, margin: '10px 0 0', cursor: 'pointer', textDecoration: 'underline', padding: 0, display: 'block' }}>Crisis resources</button>
      <div className="guided-display" id="guidedDisplay">
        <div className="guided-phase" id="guidedPhase">&mdash;</div>
        <div className="guided-count" id="guidedCount">&mdash;</div>
        <div className="guided-instruction" id="guidedInstruction"></div>
        <button className="tc-timer-btn" onClick={() => window.stopGuided()} style={{ marginTop: 10 }}>
          &#9209; Stop
        </button>
      </div>
    </div>
  );
}
