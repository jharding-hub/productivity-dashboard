const HOUR_MARKERS = [
  { pct: '6.67%',  label: '6a' },
  { pct: '13.33%', label: '7a' },
  { pct: '20%',    label: '8a' },
  { pct: '26.67%', label: '9a' },
  { pct: '33.33%', label: '10a' },
  { pct: '40%',    label: '11a' },
  { pct: '46.67%', label: '12p' },
  { pct: '53.33%', label: '1p' },
  { pct: '60%',    label: '2p' },
  { pct: '66.67%', label: '3p' },
  { pct: '73.33%', label: '4p' },
  { pct: '80%',    label: '5p' },
  { pct: '86.67%', label: '6p' },
  { pct: '93.33%', label: '7p' },
];

export default function DayTimelineBanner() {
  return (
    <div className="day-progress-bar" id="dayProgressBar">
      <div className="day-progress-elapsed" id="dayProgressElapsed"></div>
      <span className="day-progress-edge-label start">5a</span>
      <span className="day-progress-edge-label end">8p</span>
      {HOUR_MARKERS.map(({ pct, label }) => (
        <div key={label} className="day-progress-marker" style={{ left: pct }}>
          <span className="day-progress-marker-label">{label}</span>
        </div>
      ))}
      <div className="day-progress-now" id="dayProgressNow"></div>
      <div className="header-title-on-bar">Centerpost</div>
      <div className="header-subtitle">
        <span className="hs-prod">Productivity</span>
      </div>
    </div>
  );
}
