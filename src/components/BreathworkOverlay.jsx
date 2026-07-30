const TECHNIQUES = [
  { value: 'box', label: '🧘 Box Breathing (4-4-4-4) — 2 min' },
  { value: '478', label: '🌊 4-7-8 Breathing — 2.5 min' },
  { value: 'sigh', label: '💨 Physiological Sigh — 1 min' },
  { value: 'scan', label: '🧘 2-Minute Body Scan' },
  { value: 'resonance', label: '🎤 Resonance Breathing (5.5-5.5) — 2 min' },
  { value: 'alternate', label: '👃 Alternate Nostril (Nadi Shodhana) — 2 min' },
  { value: '22exhale', label: '🌊 2:1 Extended Exhale (4-8) — 2 min' },
];

export default function BreathworkOverlay() {
  return (
    <>
      {/* Full-screen guided breath overlay */}
      <div className="breath-overlay" id="breathOverlay">
        <div className="breath-backdrop"></div>
        <div className="breath-content">
          <div className="breath-technique-name" id="breathName"></div>
          <div className="breath-phase" id="breathPhase">&mdash;</div>
          <div className="breath-count" id="breathCount">&mdash;</div>
          <div className="breath-instruction" id="breathInstruction"></div>
          <div className="breath-cycle-info" id="breathCycleInfo"></div>
          <div className="breath-orb-wrap" id="breathOrbWrap">
            <div className="breath-orb-glow" id="breathOrbGlow"></div>
            <div className="breath-orb" id="breathOrb"></div>
          </div>
          <div className="body-scan-wrap" id="bodyScanWrap">
            <svg className="scan-svg" viewBox="0 0 160 268" xmlns="http://www.w3.org/2000/svg">
              <ellipse className="scan-part" id="sp-head" cx="80" cy="30" rx="26" ry="28" />
              <rect className="scan-part" id="sp-neck" x="72" y="57" width="16" height="15" rx="4" />
              <rect className="scan-part" id="sp-torso" x="48" y="71" width="64" height="80" rx="12" />
              <rect className="scan-part" id="sp-larm" x="22" y="76" width="22" height="62" rx="11" />
              <rect className="scan-part" id="sp-rarm" x="116" y="76" width="22" height="62" rx="11" />
              <ellipse className="scan-part" id="sp-lhand" cx="33" cy="147" rx="12" ry="9" />
              <ellipse className="scan-part" id="sp-rhand" cx="127" cy="147" rx="12" ry="9" />
              <rect className="scan-part" id="sp-lleg" x="53" y="150" width="24" height="90" rx="12" />
              <rect className="scan-part" id="sp-rleg" x="83" y="150" width="24" height="90" rx="12" />
              <ellipse className="scan-part" id="sp-lfoot" cx="63" cy="246" rx="20" ry="9" />
              <ellipse className="scan-part" id="sp-rfoot" cx="94" cy="246" rx="20" ry="9" />
            </svg>
          </div>
          <div className="breath-controls">
            <button className="breath-mute muted" id="breathMuteBtn" onClick={() => window.toggleBreathMute()} title="Toggle voice guidance">&#128263; Voice Off</button>
            <button className="breath-stop" onClick={() => window.stopBreathwork()}>&#9209; End Session</button>
          </div>
        </div>
      </div>

      {/* Breathwork picker modal */}
      <div className="modal-blur-overlay" id="breathworkModal">
        <div className="modal-blur-backdrop" onClick={() => window.closeBreathworkModal()}></div>
        <div className="modal-blur-panel">
          <div className="modal-blur-header">
            <div className="modal-blur-title">{'🟧'} Breathwork</div>
            <button className="modal-blur-close" onClick={() => window.closeBreathworkModal()}>&#10005;</button>
          </div>
          <div className="modal-blur-body">
            {/* R3 stage 1: copy matches the new preselect-and-go behavior --
                "Choose a technique" framed the modal as a required decision. */}
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              Ready when you are &mdash; begin, or pick a different technique. Each is evidence-based and takes 1&ndash;3 minutes.
            </p>
            <select
              className="breathwork-select"
              id="breathSelect"
              onChange={() => window.showBreathDesc()}
              style={{ marginBottom: 12 }}
            >
              <option value="">Choose a technique...</option>
              {TECHNIQUES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="breathwork-desc" id="breathDesc" style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}></div>
            <button className="breathwork-start" id="breathStartBtn" onClick={() => window.startBreathworkFromModal()} style={{ display: 'none' }}>&#9654; Begin Session</button>
          </div>
        </div>
      </div>
    </>
  );
}
