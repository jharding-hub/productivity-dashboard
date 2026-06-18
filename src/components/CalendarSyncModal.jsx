export default function CalendarSyncModal() {
  return (
    <div
      className="gcal-modal-overlay"
      id="gcalModal"
      onClick={e => { if (e.target === e.currentTarget) window.closeGcalModal(); }}
    >
      <div className="gcal-modal">
        <div className="gcal-modal-header">
          <div className="gcal-modal-title">&#128197; Calendar Sync</div>
          <button className="gcal-modal-close" onClick={() => window.closeGcalModal()}>&#10005;</button>
        </div>
        <div className="gcal-modal-body" id="gcalModalBody">
          {/* Filled by _gcalRenderModal() */}
        </div>
      </div>
    </div>
  );
}
