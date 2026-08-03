export default function WorkoutModal() {
  return (
    <div className="modal-blur-overlay" id="workoutModal">
      <div className="modal-blur-backdrop" onClick={() => window.closeWorkoutModal()}></div>
      <div className="modal-blur-panel" style={{ width: 'min(860px,96vw)', maxHeight: '92vh' }}>
        <div className="modal-blur-header">
          <div className="modal-blur-title">
            {'🏋'} Workout
            <span
              className="panel-badge"
              id="completedWorkoutsCounter"
              style={{ marginLeft: 8, background: 'var(--green-dim)', color: 'var(--green)' }}
            >
              0
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              id="woDaySelect"
              onChange={e => window.woSetDay(parseInt(e.currentTarget.value))}
              style={{
                fontSize: 13,
                padding: '5px 10px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                outline: 'none',
              }}
            />
            <button className="modal-blur-close" onClick={() => window.closeWorkoutModal()}>
              &#10005;
            </button>
          </div>
        </div>
        {/* Padding moved to #workoutModal .modal-blur-body in app.css: an
            inline style beats every stylesheet rule, so the mobile
            bottom-padding that clears the fixed tab bar could never apply
            while it lived here. */}
        <div className="modal-blur-body" id="woContent"></div>
      </div>
    </div>
  );
}
