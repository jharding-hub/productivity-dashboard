function NumpadGrid({ handler }) {
  return (
    <div className="journal-numpad">
      {['1','2','3','4','5','6','7','8','9'].map(k => (
        <button key={k} className="np-btn" onClick={() => window[handler](k)}>{k}</button>
      ))}
      <button className="np-btn np-clear" onClick={() => window[handler]('C')}>C</button>
      <button className="np-btn" onClick={() => window[handler]('0')}>0</button>
      <button className="np-btn np-del" onClick={() => window[handler]('DEL')}>&#9003;</button>
    </div>
  );
}

function PinDots({ prefix }) {
  return (
    <>
      <span className="pin-dot" id={`${prefix}0`}></span>
      <span className="pin-dot" id={`${prefix}1`}></span>
      <span className="pin-dot" id={`${prefix}2`}></span>
      <span className="pin-dot" id={`${prefix}3`}></span>
    </>
  );
}

export default function JournalOverlay() {
  return (
    <div className="journal-overlay" id="journalOverlay">
      <div className="journal-backdrop" id="journalBackdrop" onClick={() => window.closeJournal()}></div>
      <div className="journal-panel" id="journalPanel">

        {/* PIN gate (shown when viewing entries) */}
        <div className="journal-pin-gate" id="journalPinGate" style={{ display: 'none' }}>
          <div className="journal-pin-icon">{'🔒'}</div>
          <div className="journal-pin-title">Journal is locked</div>
          <p className="journal-pin-sub">Enter your PIN to open your journal</p>
          <div className="journal-pin-dots" id="journalPinDots">
            <PinDots prefix="pd" />
          </div>
          <div className="journal-pin-error" id="journalPinError"></div>
          <NumpadGrid handler="journalPinKey" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            <button className="btn" onClick={() => window.closeJournal()} style={{ fontSize: 12, padding: '6px 14px' }}>Cancel</button>
            <button className="btn btn-accent" onClick={() => window.journalPinSubmit()} style={{ fontSize: 12, padding: '6px 18px' }}>Unlock</button>
          </div>
        </div>

        {/* Set PIN form (first time or change) */}
        <div className="journal-set-pin" id="journalSetPin" style={{ display: 'none' }}>
          <div className="journal-pin-icon">{'🔑'}</div>
          <div className="journal-pin-title" id="setPinTitle">Create a PIN</div>
          <p className="journal-pin-sub" id="setPinSub">Choose a 4+ digit PIN to protect your journal.</p>
          <div className="journal-pin-dots" id="setPinDots">
            <PinDots prefix="spd" />
          </div>
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
              <button className="journal-close-btn" onClick={() => window.closeJournal()} title="Close">&#10005;</button>
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
                onInput={() => window.renderJournalEntries()}
              />
              <select
                id="journalFilterProj"
                onChange={() => window.renderJournalEntries()}
                style={{ fontSize: 12, padding: '4px 8px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                <option value="all">All projects</option>
              </select>
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
