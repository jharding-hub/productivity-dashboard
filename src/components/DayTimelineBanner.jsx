// The hour markers and edge labels are painted by renderBannerMarkers() in
// public/day-progress.js from the user's productive window (a setting since
// 2026-09-11). React renders #dayProgressMarkers EMPTY and never puts children
// in it, so the two never fight over the same nodes. The 5a/8p edge text is
// only the default shown until that first paint.
export default function DayTimelineBanner() {
  return (
    <div className="day-progress-bar" id="dayProgressBar">
      <div className="day-progress-elapsed" id="dayProgressElapsed"></div>
      <span className="day-progress-edge-label start">5a</span>
      <span className="day-progress-edge-label end">8p</span>
      <div className="day-progress-markers" id="dayProgressMarkers"></div>
      <div className="day-progress-now" id="dayProgressNow"></div>
      <div className="header-title-on-bar">Centerpost</div>
      <div className="header-subtitle">
        <span className="hs-prod">Productivity</span>
      </div>
    </div>
  );
}
