export default function GroundingToolkit() {
  return (
    <div className="panel hidden-panel" data-panel="wellness" data-nav="wellness">
      <div className="panel-header">
        <div className="panel-title">
          <span className="drag-handle">&#10495;</span>
          <i className="ti ti-heart-rate icon" aria-hidden="true"></i> Grounding Toolkit
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
