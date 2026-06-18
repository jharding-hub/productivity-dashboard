const SKELETON_ROWS = [55, 70, 48, 62];

export default function RoutinesPanel() {
  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="drag-handle">&#10495;</span>
          <i className="ti ti-repeat icon" aria-hidden="true"></i> Routines
        </div>
        <div style={{ display: 'flex', gap: '5px' }}>
          <span className="panel-badge" id="routineProgress">0/0</span>
          <button className="expand-btn" onClick={e => window.toggleExpand(e.currentTarget)} title="Expand/collapse">
            <span className="expand-arrow">{'▼'}</span>
          </button>
          <button className="btn btn-sm" onClick={() => window.resetRoutines()}>Reset</button>
        </div>
      </div>

      <div className="tab-row">
        <button className="tab-btn active" onClick={e => window.switchRoutineTab('morning', e.currentTarget)}>Morning</button>
        <button className="tab-btn" onClick={e => window.switchRoutineTab('evening', e.currentTarget)}>Evening</button>
        <button className="tab-btn" onClick={e => window.switchRoutineTab('custom', e.currentTarget)}>Custom</button>
      </div>

      <div className="panel-content" id="pc_routines">
        <div className="routine-list" id="routineList">
          <div className="skel-wrap">
            {SKELETON_ROWS.map((w, i) => (
              <div key={i} className="skel-row-item">
                <div className="skel" style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }} />
                <div className="skel skel-line" style={{ width: `${w}%`, flex: 1 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="add-row" style={{ marginTop: 6 }}>
        <input
          type="text"
          id="newRoutineName"
          placeholder="e.g. Take meds, drink water..."
        />
        <button className="btn btn-accent btn-sm" onClick={() => window.addRoutine()}>+</button>
      </div>
    </>
  );
}
