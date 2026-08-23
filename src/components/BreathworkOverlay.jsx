// Durations are DERIVED from breathTechniques in legacy.js, never written out
// by hand. They used to be hardcoded here ("Box Breathing — 2 min") while the
// real phase/cycle timings lived in legacy.js, and the two silently drifted:
// every label overstated its session, box breathing claiming 2 min while
// actually running 1:04. One source of truth means that can't recur -- change
// a cycle count and the menu follows.
const TECHNIQUES = [
  { value: 'box', label: '🧘 Box Breathing (4-4-4-4)' },
  { value: '478', label: '🌊 4-7-8 Breathing' },
  { value: 'sigh', label: '💨 Physiological Sigh' },
  { value: 'scan', label: '🧘 Body Scan' },
  { value: 'resonance', label: '🎤 Resonance Breathing (5.5-5.5)' },
  { value: 'alternate', label: '👃 Alternate Nostril (Nadi Shodhana)' },
  { value: '22exhale', label: '🌊 2:1 Extended Exhale (4-8)' },
];

// The duration is appended at runtime by _breathStampDurations() in
// legacy.js, which owns breathTechniques. It can't be computed here: App.jsx
// injects legacy.js AFTER React mounts, so window.breathTechniques does not
// exist yet at render time and every label would be left bare. data-base
// holds the name so the stamp is idempotent across repeated opens.

export default function BreathworkOverlay() {
  return (
    <>
      {/* Full-screen guided breath overlay */}
      <div className="breath-overlay" id="breathOverlay" role="dialog" aria-modal="true" aria-labelledby="breathName">
        <div className="breath-backdrop"></div>
        <div className="breath-content">
          {/* Safety net (persona panel 2, Joe's design): 3+ session starts
              inside a rolling hour surfaces this once — calm, dismissible,
              never blocks; the session runs regardless. Shown/hidden by
              _breathTrackStart()/dismissBreathResource() in legacy.js. The
              counter lives in localStorage only, never synced — a distress
              pattern is not sync data. */}
          <div className="breath-resource-note" id="breathResourceNote" style={{ display: 'none' }} role="note">
            <span className="brn-text">
              You&rsquo;ve come back to this a few times this hour. If what&rsquo;s underneath feels
              bigger than a breathing exercise, <a href="tel:988">988</a> (call or text) reaches a
              real person, anytime. No pressure &mdash; your session continues below.
            </span>
            <button className="brn-close" onClick={() => window.dismissBreathResource()} aria-label="Dismiss">&#10005;</button>
          </div>
          <div className="breath-technique-name" id="breathName"></div>
          {/* F16/R9: the safety-critical fix in this whole pass -- phase/count/
              instruction update every second during a live session and were
              plain divs, so a blind user got zero automatic announcement of
              "Inhale... 4... 3..." and had no way to follow the session at
              all. aria-live="assertive" on phase/count so timing-critical cues
              interrupt and announce immediately; "polite" on the instruction
              text (fuller sentences, fine to queue rather than cut in). */}
          <div className="breath-phase" id="breathPhase" aria-live="assertive">&mdash;</div>
          <div className="breath-count" id="breathCount" aria-live="assertive">&mdash;</div>
          <div className="breath-instruction" id="breathInstruction" aria-live="polite"></div>
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

          {/* Reset chain capture step (panel survey 2026-08-22, A2-7). Shown
              only when a chain-started session completes: breathing first,
              words after, both optional. Skip carries no penalty and the
              buttons carry equal weight -- same no-shame rule as everywhere. */}
          <div className="reset-capture-step" id="resetCaptureStep">
            <div className="rcs-title">Any thoughts to put down before you go back?</div>
            <div className="rcs-row">
              <input type="text" id="resetCaptureInput" placeholder="A thought, a name, a next step&hellip; (optional)"
                onKeyDown={e => { if (e.key === 'Enter') window.resetCaptureDone(); }} />
              <button className="mic-btn" id="resetCaptureMic" onClick={() => window.toggleMic('resetCaptureInput','resetCaptureMic')} title="Speak it instead">&#127908;</button>
            </div>
            <div className="rcs-actions">
              <button className="btn" onClick={() => window.resetCaptureSkip()}>Skip</button>
              <button className="btn btn-accent" onClick={() => window.resetCaptureDone()}>Done</button>
            </div>
          </div>
        </div>
      </div>

      {/* Breathwork picker modal */}
      <div className="modal-blur-overlay" id="breathworkModal" role="dialog" aria-modal="true" aria-labelledby="breathworkModalTitle">
        <div className="modal-blur-backdrop" onClick={() => window.closeBreathworkModal()}></div>
        <div className="modal-blur-panel">
          <div className="modal-blur-header">
            <div className="modal-blur-title" id="breathworkModalTitle">{'🟧'} Breathwork</div>
            <button className="modal-blur-close" onClick={() => window.closeBreathworkModal()} aria-label="Close">&#10005;</button>
          </div>
          <div className="modal-blur-body">
            {/* R3 stage 1: copy matches the new preselect-and-go behavior --
                "Choose a technique" framed the modal as a required decision.
                Panel survey 2026-08-18 (I-11): "Each is evidence-based" was a
                blanket claim across seven techniques of uneven evidence
                weight -- softened here, with the real per-technique framing
                (and a caution line on breath-hold techniques) now rendered
                by showBreathDesc() below each selection. */}
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              Ready when you are &mdash; begin, or pick a different technique. Takes 1&ndash;3 minutes; see what each is backed by below.
            </p>
            <select
              className="breathwork-select"
              id="breathSelect"
              aria-label="Breathing technique"
              onChange={() => window.showBreathDesc()}
              style={{ marginBottom: 12 }}
            >
              <option value="">Choose a technique...</option>
              {TECHNIQUES.map(({ value, label }) => (
                <option key={value} value={value} data-base={label}>{label}</option>
              ))}
            </select>
            <div className="breathwork-desc" id="breathDesc" style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}></div>
            <button className="breathwork-start" id="breathStartBtn" onClick={() => window.startBreathworkFromModal()} style={{ display: 'none' }}>&#9654; Begin Session</button>
            {/* Panel survey 2026-08-18 (A-4): passive footer link, not a
                popup -- does not touch BREATH_RESOURCE_THRESHOLD. */}
            <button className="modal-footer-link" onClick={() => window.openCrisisResources()} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 11, marginTop: 14, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Crisis resources</button>
          </div>
        </div>
      </div>
    </>
  );
}
