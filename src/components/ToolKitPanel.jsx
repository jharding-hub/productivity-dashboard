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
          className="toolkit-btn"
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
        </button>
        <button className="toolkit-btn toolkit-mood" onClick={() => window.openEnergyModal()}>
          <i className="ti ti-bolt" aria-hidden="true"></i>
          <span>Energy &amp; Mood</span>
        </button>
        <button className="toolkit-btn toolkit-journal" onClick={() => window.openJournal()}>
          <i className="ti ti-notes" aria-hidden="true"></i>
          <span>Journal</span>
        </button>
        <button className="toolkit-btn toolkit-workout" onClick={() => window.openWorkoutModal()}>
          <i className="ti ti-barbell" aria-hidden="true"></i>
          <span>Workout</span>
        </button>
        <button className="toolkit-btn toolkit-halt" onClick={() => window.openHaltModal()}>
          <i className="ti ti-alert-triangle" aria-hidden="true"></i>
          <span>HALT+</span>
        </button>
        <button className="toolkit-btn toolkit-urge" onClick={() => window.openUrgeModal()}>
          <i className="ti ti-hand-stop" aria-hidden="true"></i>
          <span>Urge Log</span>
        </button>
        <button className="toolkit-btn toolkit-wellness" onClick={() => window.openWellnessModal()}>
          <i className="ti ti-heart" aria-hidden="true"></i>
          <span>Wellness</span>
        </button>
      </div>
      {/* YouTube player host (rendered by PointsFocusMusic component) */}
    </>
  );
}
