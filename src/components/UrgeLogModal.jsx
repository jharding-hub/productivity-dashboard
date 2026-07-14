export default function UrgeLogModal() {
  return (
    <div className="modal-blur-overlay" id="urgeModal">
      <div className="modal-blur-backdrop" onClick={() => window.closeUrgeModal()}></div>
      <div className="modal-blur-panel" style={{ width: 'min(560px,95vw)' }}>
        <div className="modal-blur-header">
          <div className="modal-blur-title">{'✋'} Urge Log</div>
          <button className="modal-blur-close" onClick={() => window.closeUrgeModal()}>&#10005;</button>
        </div>
        <div className="modal-blur-body" style={{ padding: '16px 20px' }} id="urgeBody"></div>
      </div>
    </div>
  );
}
