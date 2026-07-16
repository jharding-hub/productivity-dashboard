export default function PointsInsightsOverlay() {
  return (
    <div className="modal-blur-overlay" id="pointsInsightsModal">
      <div className="modal-blur-backdrop" onClick={() => window.closePointsInsights()}></div>
      <div className="modal-blur-panel" style={{ width: 'min(720px,96vw)' }}>
        <div className="modal-blur-header">
          <div className="modal-blur-title">{'📈'} Focus &amp; Presence Insights</div>
          <button className="modal-blur-close" onClick={() => window.closePointsInsights()}>&#10005;</button>
        </div>
        <div className="modal-blur-body">
          <div className="pi-period-row">
            <div className="pi-period-group">
              <button className="pi-period-btn active" id="piBtnWeek" onClick={() => window.renderPointsInsights('week')}>Week</button>
              <button className="pi-period-btn" id="piBtnMonth" onClick={() => window.renderPointsInsights('month')}>Month</button>
              <button className="pi-period-btn" id="piBtnLifetime" onClick={() => window.renderPointsInsights('lifetime')}>Lifetime</button>
            </div>
            <button className="pi-export-btn" onClick={() => { window.closePointsInsights(); window.openWeeklyReview(); }} title="A pulled-together summary of your week">
              &#128197; Weekly Review
            </button>
            <button className="pi-export-btn" onClick={() => window.exportInsightsData()} title="Download check-ins, mood/energy, and daily Presence as CSV files">
              &#8595; Export CSV
            </button>
          </div>

          <div className="pi-insight-text" id="piInsightText"></div>

          <div className="pi-chart-wrap" id="piChartWrap"></div>
          <div className="pi-no-data" id="piNoData" style={{ display: 'none' }}>
            Not enough data yet. Keep using Centerpost and logging Energy &amp; Mood — insights unlock after a few days.
          </div>

          <div className="pi-legend">
            <span className="pi-leg-dot" style={{ background: '#c77dba' }}></span><span>Presence</span>
            <span className="pi-leg-dot" style={{ background: '#d4a853', marginLeft: 16 }}></span><span>Energy</span>
            <span className="pi-leg-dot" style={{ background: '#5f8fc7', marginLeft: 16 }}></span><span>Mood</span>
            <span className="pi-leg-dot" style={{ background: '#5fbf80', marginLeft: 16 }}></span><span>Panel/Tool Uses</span>
          </div>

          <div className="pi-tips" id="piTips"></div>

          <div className="pi-state-card" id="piStateCard"></div>
        </div>
      </div>
    </div>
  );
}
