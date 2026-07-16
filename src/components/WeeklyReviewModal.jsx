export default function WeeklyReviewModal() {
  return (
    <div className="modal-blur-overlay" id="weeklyReviewModal">
      <div className="modal-blur-backdrop" onClick={() => window.closeWeeklyReview()}></div>
      <div className="modal-blur-panel" style={{ width: 'min(560px,95vw)' }}>
        <div className="modal-blur-header">
          <div className="modal-blur-title">{'📆'} Weekly Review</div>
          <button className="modal-blur-close" onClick={() => window.closeWeeklyReview()}>&#10005;</button>
        </div>
        <div className="modal-blur-body" style={{ padding: '16px 20px' }} id="weeklyReviewBody"></div>
      </div>
    </div>
  );
}
