export default function OnboardingTour() {
  return (
    <div className="modal-blur-overlay" id="onboardingTourModal">
      <div className="modal-blur-backdrop" onClick={() => window.onboardingSkip()}></div>
      <div className="modal-blur-panel" style={{ width: 'min(440px,95vw)' }}>
        <div className="modal-blur-header">
          <div className="modal-blur-title">Getting Started</div>
          <button className="modal-blur-close" onClick={() => window.onboardingSkip()}>&#10005;</button>
        </div>
        <div className="modal-blur-body" style={{ padding: '16px 20px' }}>
          <div className="onboarding-progress" id="onboardingProgress" style={{ fontSize: '12px', opacity: 0.6, marginBottom: '4px' }}></div>
          <h3 id="onboardingTitle" style={{ margin: '0 0 8px' }}></h3>
          <p id="onboardingBody" style={{ margin: 0, lineHeight: 1.5 }}></p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <button className="btn" id="onboardingBackBtn" onClick={() => window.onboardingBack()}>Back</button>
            <button className="btn btn-accent" id="onboardingNextBtn" onClick={() => window.onboardingNext()}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
