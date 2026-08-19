export default function ToolKitPanel() {
  return (
    <>
      <div className="panel-header">
        <div className="panel-title">
          <span className="drag-handle">&#10495;</span>
          <i className="ti ti-tool icon" aria-hidden="true"></i> Tool Kit
        </div>
        <div className="panel-badge">Quick Launch</div>
      </div>
      {/* F24: the Presence Points medal used to sit HERE, pinned above the
          grounding tools. All five review personas independently said it had
          to go -- a rank badge is the first thing you meet on the surface you
          open when you're struggling ("a scoreboard on the door of the room
          people enter when they're losing"). Moved to the header's
          points-focus-music slot, which already hosts the +Presence floaters
          and is labelled for it. Points still accrue for regulation actions
          -- awarding and DISPLAYING are separate decisions, and only the
          display was the problem. */}
      <div className="toolkit-grid">
        <div className="toolkit-music-wrap">
          <button
            className="toolkit-btn toolkit-music"
            id="focusMusicBtn"
            onClick={e => window.musicHandleClick(e.nativeEvent)}
            title="Click to play/pause • Use ☰ to switch playlists"
          >
            <span className="music-emoji" id="musicEmoji">&#127925;</span>
            <span id="musicLabel">Music</span>
            <span className="music-controls" id="musicControls" style={{ display: 'none' }}>
              <span className="music-ctrl-btn" id="musicStateIcon">&#9654;</span>
              <span
                className="music-ctrl-btn music-skip"
                onClick={e => { e.stopPropagation(); window.focusMusicSkip(); }}
                title="Next track"
                role="button"
                tabIndex={0}
              >&#9197;</span>
              <span
                className="music-ctrl-btn music-menu"
                onClick={e => { e.stopPropagation(); window.musicToggleDropdown(e.nativeEvent); }}
                title="Switch playlist"
                role="button"
                tabIndex={0}
              >&#9776;</span>
            </span>
          </button>
          <div className="music-dropdown" id="musicDropdown" style={{ display: 'none' }}></div>
        </div>
        <button
          className="toolkit-btn toolkit-streaming"
          id="toolkitMusicStreamBtn"
          onClick={() => window.openMusicStreamingModal()}
          title="Open Spotify, Apple Music, or Amazon Music"
          style={{ display: 'none' }}
        >
          <i className="ti ti-headphones" aria-hidden="true"></i>
          <span>Streaming</span>
        </button>
        <button className="toolkit-btn toolkit-breath" onClick={() => window.openBreathworkModal()}>
          <i className="ti ti-wind" aria-hidden="true"></i>
          <span>Breathwork</span>
          <span className="toolkit-btn-sub">Slow your breathing, fast</span>
        </button>
        <button className="toolkit-btn toolkit-mood" onClick={() => window.openEnergyModal()}>
          <i className="ti ti-bolt" aria-hidden="true"></i>
          <span>Energy &amp; Mood</span>
          <span className="toolkit-btn-sub">Check in on how you're doing</span>
        </button>
        <button className="toolkit-btn toolkit-journal" onClick={() => window.openJournal()}>
          <i className="ti ti-notes" aria-hidden="true"></i>
          <span>Journal</span>
          <span className="toolkit-btn-sub">Private, encrypted space to write</span>
        </button>
        <button className="toolkit-btn toolkit-workout" onClick={() => window.openWorkoutModal()}>
          <i className="ti ti-barbell" aria-hidden="true"></i>
          <span>Workout</span>
          <span className="toolkit-btn-sub">Today's strength or cardio plan</span>
        </button>
        {/* R13/F23b: the review's Basic persona never taps these because the
            names assume DBT literacy -- "if a feature requires knowing what
            it's for before you can find out what it's for, it doesn't exist
            for me." Subtitles here, not tooltips: touch devices can't hover.
            Panel survey 2026-08-18 (I-4) extended the same treatment to the
            remaining unsubtitled tiles below (Breathwork, Energy & Mood,
            Journal, Workout, Wellness) -- HALT+ and Urge Log were the only
            ones that had gotten it. */}
        <button className="toolkit-btn toolkit-halt" onClick={() => window.openHaltModal()}>
          <i className="ti ti-alert-triangle" aria-hidden="true"></i>
          <span>HALT+</span>
          <span className="toolkit-btn-sub">Body check when focus tanks</span>
        </button>
        <button className="toolkit-btn toolkit-urge" onClick={() => window.openUrgeModal()}>
          <i className="ti ti-hand-stop" aria-hidden="true"></i>
          <span>Urge Log</span>
          <span className="toolkit-btn-sub">Pause before you act on impulse</span>
        </button>
        <button className="toolkit-btn toolkit-wellness" onClick={() => window.openWellnessModal()}>
          <i className="ti ti-heart" aria-hidden="true"></i>
          <span>Wellness</span>
          <span className="toolkit-btn-sub">Rate how balanced you feel</span>
        </button>
      </div>
      {/* YouTube player host (rendered by PointsFocusMusic component) */}
    </>
  );
}
