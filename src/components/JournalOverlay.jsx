function NumpadGrid({ handler }) {
  return (
    <div className="journal-numpad">
      {['1','2','3','4','5','6','7','8','9'].map(k => (
        <button key={k} className="np-btn" onClick={() => window[handler](k)} aria-label={k}>{k}</button>
      ))}
      <button className="np-btn np-clear" onClick={() => window[handler]('C')} aria-label="Clear">C</button>
      <button className="np-btn" onClick={() => window[handler]('0')} aria-label="0">0</button>
      <button className="np-btn np-del" onClick={() => window[handler]('DEL')} aria-label="Delete">&#9003;</button>
    </div>
  );
}

export default function JournalOverlay() {
  return (
    <div className="journal-overlay" id="journalOverlay" role="dialog" aria-modal="true" aria-label="Journal">
      <div className="journal-backdrop" id="journalBackdrop" onClick={() => window.closeJournal()}></div>
      <div className="journal-panel" id="journalPanel">

        {/* PIN gate (shown when viewing entries) */}
        <div className="journal-pin-gate" id="journalPinGate" style={{ display: 'none' }}>
          <div className="journal-pin-icon">{'🔒'}</div>
          <div className="journal-pin-title">Journal is locked</div>
          <p className="journal-pin-sub">Enter your PIN to open your journal</p>
          <div className="journal-pin-dots" id="journalPinDots"></div>
          {/* F16/R9: the dots _renderPinDots() fills journalPinDots with are
              purely visual fill-state -- nothing there for a screen reader to
              read. This sibling live region announces the same "N of 4"
              progress in text; kept outside journalPinDots since that div's
              innerHTML is fully replaced on every keypress. */}
          <span className="sr-only" id="journalPinDotsStatus" aria-live="polite"></span>
          <div className="journal-pin-error" id="journalPinError"></div>
          <NumpadGrid handler="journalPinKey" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            <button className="btn" onClick={() => window.closeJournal()} style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</button>
            <button className="btn btn-accent" onClick={() => window.journalPinSubmit()} style={{ fontSize: 12, padding: '6px 18px' }}>Unlock</button>
          </div>
          {/* R8 phase 2: shown only on native when biometric unlock is enrolled
              (_journalBioGateSync). Face ID auto-prompts on open; this is the
              manual retry after a cancel. */}
          <button
            className="btn"
            id="journalBioBtn"
            onClick={() => window.journalBioUnlock()}
            style={{ display: 'none', fontSize: 12, padding: '6px 14px', margin: '8px auto 0' }}
          >
            <i className="ti ti-face-id" aria-hidden="true"></i> Use Face ID
          </button>
        </div>

        {/* Set PIN form (first time or change) */}
        <div className="journal-set-pin" id="journalSetPin" style={{ display: 'none' }}>
          <div className="journal-pin-icon">{'🔑'}</div>
          <div className="journal-pin-title" id="setPinTitle">Create a PIN</div>
          <p className="journal-pin-sub" id="setPinSub">Choose a 4+ digit PIN to protect your journal.</p>
          {/* R8 phase 1: reframed from a red "no reset" alarm block to one
              calm line, per the design review's ask -- the fact still needs
              to be said, it doesn't need to look like a warning label.
              Panel survey 2026-08-18 (I-8): three personas independently
              named a forgotten PIN as the likeliest data-loss event in the
              app; kept the calm tone (that was a deliberate, reasoned past
              call) but gave "can't be reset" enough visual weight that it
              isn't easy to read past. Biometric enrollment is already
              offered automatically right after this, on native --
              _journalBioAfterPinUnlock() below. */}
          <p className="journal-pin-warn" style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 320, margin: '0 auto 6px', lineHeight: 1.5 }}>
            This PIN <strong style={{ color: 'var(--text)' }}>can’t be reset</strong> if you forget it. Export keeps a backup.
          </p>
          <div className="journal-pin-dots" id="setPinDots"></div>
          <span className="sr-only" id="setPinDotsStatus" aria-live="polite"></span>
          <div className="journal-pin-error" id="setPinError"></div>
          <NumpadGrid handler="setPinKey" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            <button className="btn" onClick={() => window.closeJournal()} style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</button>
            <button className="btn btn-accent" onClick={() => window.setPinSubmit()} style={{ fontSize: 12, padding: '6px 18px' }}>Continue</button>
          </div>
        </div>

        {/* Main journal UI */}
        <div className="journal-main" id="journalMain" style={{ display: 'none' }}>
          <div className="journal-header">
            <div className="journal-header-left">
              <span className="journal-title-icon">{'📝'}</span>
              <span className="journal-title-text">Journal</span>
              <span className="journal-entry-count" id="journalEntryCount">0 entries</span>
            </div>
            <div className="journal-header-right">
              <button className="journal-view-btn" id="journalViewToggle" onClick={() => window.toggleJournalView()} title="View past entries">{'📄'} Entries</button>
              <button className="journal-close-btn" onClick={() => window.closeJournal()} title="Close" aria-label="Close">&#10005;</button>
            </div>
          </div>

          <div className="journal-meta-bar">
            <span className="journal-date-stamp" id="journalDateStamp"></span>
            <select className="journal-proj-tag" id="journalProjTag"><option value="">No project tag</option></select>
            <select className="journal-mood-tag" id="journalMoodTag">
              <option value="">Mood…</option>
              <optgroup label="Positive">
                <option value="grateful">{'💕'} Grateful</option>
                <option value="motivated">{'🔥'} Motivated</option>
                <option value="content">{'🌞'} Content</option>
                <option value="happy">{'😀'} Happy</option>
                <option value="excited">{'🤩'} Excited</option>
                <option value="calm">{'🧘'} Calm</option>
                <option value="hopeful">{'🌟'} Hopeful</option>
                <option value="proud">{'🥇'} Proud</option>
                <option value="energized">{'⚡'} Energized</option>
              </optgroup>
              <optgroup label="Neutral / Mixed">
                <option value="reflective">{'🤔'} Reflective</option>
                <option value="uncertain">{'🤦'} Uncertain</option>
                <option value="distracted">{'🐱'} Distracted</option>
                <option value="tired">{'😴'} Tired</option>
                <option value="bored">{'😶'} Bored</option>
                <option value="numb">{'🫎'} Numb</option>
                <option value="nostalgic">{'💕'} Nostalgic</option>
              </optgroup>
              <optgroup label="Challenging">
                <option value="anxious">{'😰'} Anxious</option>
                <option value="frustrated">{'😤'} Frustrated</option>
                <option value="overwhelmed">{'🤯'} Overwhelmed</option>
                <option value="stressed">{'💥'} Stressed</option>
                <option value="sad">{'😢'} Sad</option>
                <option value="angry">{'🕘'} Angry</option>
                <option value="lonely">{'👀'} Lonely</option>
                <option value="discouraged">{'😓'} Discouraged</option>
              </optgroup>
            </select>
          </div>

          <div className="journal-compose" id="journalCompose">
            <textarea
              className="journal-textarea"
              id="journalText"
              placeholder={"What's on your mind today?\n\nThis is your private space. No pressure, no structure — just write."}
            ></textarea>
            <div className="journal-compose-actions">
              <span className="journal-char-count" id="journalCharCount">0 characters</span>
              <button className="btn btn-accent" onClick={() => window.saveJournalEntry()}>{'💾'} Save Entry</button>
            </div>
          </div>

          <div className="journal-entries-view" id="journalEntriesView" style={{ display: 'none' }}>
            <div className="journal-entries-toolbar">
              <input
                type="text"
                className="journal-search"
                id="journalSearch"
                placeholder="Search entries..."
                aria-label="Search journal entries"
                onInput={() => window.renderJournalEntries()}
              />
              <select
                id="journalFilterProj"
                onChange={() => window.renderJournalEntries()}
                style={{ fontSize: 12, padding: '4px 8px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                <option value="all">All projects</option>
              </select>
              <button className="btn btn-sm" onClick={() => window.exportJournalDecrypted()} style={{ fontSize: 11 }} title="Download a decrypted backup of your entries">{'⬇️'} Export</button>
              <button className="btn btn-sm" onClick={() => window.changeJournalPin()} style={{ fontSize: 11 }} title="Change your journal PIN">{'🔑'} Change PIN</button>
              <button className="btn btn-sm" onClick={() => window.lockJournalEntries()} style={{ fontSize: 11 }}>{'🔒'} Lock</button>
            </div>
            <div className="journal-entries-list" id="journalEntriesList"></div>
          </div>
        </div>

      </div>
    </div>
  );
}
