const ENERGY_LEVELS = [
  { value: 'high', label: 'High' },
  { value: 'good', label: 'Good' },
  { value: 'low', label: 'Low' },
  { value: 'crashed', label: 'Crash' },
];

const MOOD_LEVELS = [
  { value: 'focused', label: 'Focus' },
  { value: 'scattered', label: 'Scatter' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'calm', label: 'Calm' },
];

function PillRow({ label, id, items, setter }) {
  return (
    <div className="em-row" style={{ marginBottom: label === 'Energy' ? 14 : 16 }}>
      <span className="em-label" style={{ minWidth: 60, fontSize: 13 }}>{label}</span>
      <div className="em-pills" id={id}>
        {items.map(({ value, label: text }) => (
          <span
            key={value}
            className="em-pill"
            data-value={value}
            onClick={e => window[setter](e.currentTarget, value)}
          >
            <span className="em-dot"></span>{text}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EnergyMoodModal() {
  return (
    <>
      {/* ENERGY & MOOD MODAL */}
      <div className="modal-blur-overlay" id="energyModal">
        <div className="modal-blur-backdrop" onClick={() => window.closeEnergyModal()}></div>
        <div className="modal-blur-panel" style={{ width: 'min(520px,92vw)' }}>
          <div className="modal-blur-header">
            <div className="modal-blur-title">{'⚡'} Energy &amp; Mood</div>
            <button className="modal-blur-close" onClick={() => window.closeEnergyModal()}>&#10005;</button>
          </div>
          <div className="modal-blur-body">
            <PillRow label="Energy" id="energyPills" items={ENERGY_LEVELS} setter="setEnergy" />
            <PillRow label="Mood" id="moodPills" items={MOOD_LEVELS} setter="setMood" />
            <div id="stateAdvice"></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-sm"
                onClick={() => { window.closeEnergyModal(); window.openMoodHistory(7); }}
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {'📊'} <span>Mood History</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MOOD HISTORY MODAL */}
      <div className="modal-blur-overlay" id="moodHistoryModal">
        <div className="modal-blur-backdrop" onClick={() => window.closeMoodHistory()}></div>
        <div className="modal-blur-panel" style={{ width: 'min(640px,96vw)' }}>
          <div className="modal-blur-header">
            <div className="modal-blur-title">{'📊'} Mood &amp; Energy History</div>
            <button className="modal-blur-close" onClick={() => window.closeMoodHistory()}>&#10005;</button>
          </div>
          <div className="modal-blur-body">
            <div className="mh-period-row">
              <button className="mh-period-btn active" id="mhBtn7" onClick={() => window.renderMoodHistory(7)}>7 Days</button>
              <button className="mh-period-btn" id="mhBtn30" onClick={() => window.renderMoodHistory(30)}>30 Days</button>
            </div>
            <div className="mh-chart-wrap" id="mhChartWrap"></div>
            <div className="mh-legend">
              <span className="mh-leg-dot" style={{ background: '#d4a853' }}></span><span>Energy</span>
              <span className="mh-leg-dot" style={{ background: '#5f8fc7', marginLeft: 16 }}></span><span>Mood</span>
            </div>
            <div className="mh-no-data" id="mhNoData" style={{ display: 'none' }}>
              No mood data recorded yet. Use {'⚡'} Energy &amp; Mood to start tracking.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
