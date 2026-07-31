export default function HaltModal() {
  return (
    <div className="modal-blur-overlay" id="haltModal" role="dialog" aria-modal="true" aria-labelledby="haltModalTitle">
      <div className="modal-blur-backdrop" onClick={() => window.closeHaltModal()}></div>
      <div className="modal-blur-panel" style={{ width: 'min(560px,95vw)' }}>
        <div className="modal-blur-header">
          <div className="modal-blur-title" id="haltModalTitle">{'🛑'} HALT+ Sensory Check</div>
          <button className="modal-blur-close" onClick={() => window.closeHaltModal()} aria-label="Close">&#10005;</button>
        </div>
        <div className="modal-blur-body" style={{ padding: '16px 20px' }} id="haltBody"></div>
      </div>
    </div>
  );
}
