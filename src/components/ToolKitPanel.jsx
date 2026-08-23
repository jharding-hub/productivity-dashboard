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
      {/* Filled by legacy.js's _renderToolkitExplainer() on first open, then
          never again. Lives ABOVE the grid, inside the panel, deliberately:
          the subtitles that used to explain these tiles were removed because
          they clipped the grid, and their replacement tooltips are invisible
          on touch -- which is where the dysregulated user actually is. A card
          here teaches the vocabulary once without pushing on tile layout and
          without blocking anything. */}
      <div id="toolkitExplainer"></div>
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
        {/* Crisis resources moved to the status-bar ribbon (Joe, 2026-08-19)
            -- see StatusBar.jsx, next to Settings. Always-reachable there
            regardless of which Tool Kit tiles are shown/hidden. */}
        {/* Subtitles REMOVED 2026-08-19 (Joe's call) -- they were the direct
            cause of the Tool Kit grid overflowing its 629px panel and getting
            clipped, and the grid only ever fit by ~13px with them present, so
            any larger text setting or narrower window clipped the bottom row.
            This reverses R13/F23b + panel survey I-4, which added them so the
            Basic persona could tell what HALT+/Urge Log meant without DBT
            literacy. The explanatory text is preserved as a title tooltip on
            each tile -- weaker than a visible subtitle (touch devices can't
            hover, which is exactly why I-4 chose subtitles over tooltips in
            the first place), so if the naming problem resurfaces the fix is a
            first-run explainer or clearer NAMES, not putting these back. */}
        <button className="toolkit-btn toolkit-breath" onClick={() => window.openBreathworkModal()} title="Breathwork — slow your breathing, fast">
          <i className="ti ti-wind" aria-hidden="true"></i>
          <span>Breathwork</span>
        </button>
        <button className="toolkit-btn toolkit-mood" onClick={() => window.openEnergyModal()} title="Energy &amp; Mood — check in on how you're doing">
          <i className="ti ti-bolt" aria-hidden="true"></i>
          <span>Energy &amp; Mood</span>
        </button>
        <button className="toolkit-btn toolkit-journal" onClick={() => window.openJournal()} title="Journal — private, encrypted space to write">
          <i className="ti ti-notes" aria-hidden="true"></i>
          <span>Journal</span>
        </button>
        <button className="toolkit-btn toolkit-workout" onClick={() => window.openWorkoutModal()} title="Workout — today's strength or cardio plan">
          <i className="ti ti-barbell" aria-hidden="true"></i>
          <span>Workout</span>
        </button>
        {/* ti-alert-triangle until 2026-08-23: a warning triangle sitting in
            the regulation toolkit read as "something is wrong with the app"
            rather than "check your body" -- flagged independently by the
            Basic, Clinician and Skeptic seats. A heartbeat says body check. */}
        <button className="toolkit-btn toolkit-halt" onClick={() => window.openHaltModal()} title="HALT+ — body check when focus tanks">
          <i className="ti ti-heartbeat" aria-hidden="true"></i>
          <span>HALT+</span>
        </button>
        <button className="toolkit-btn toolkit-urge" onClick={() => window.openUrgeModal()} title="Urge Log — pause before you act on impulse">
          <i className="ti ti-hand-stop" aria-hidden="true"></i>
          <span>Urge Log</span>
        </button>
        <button className="toolkit-btn toolkit-wellness" onClick={() => window.openWellnessModal()} title="Wellness — rate how balanced you feel">
          <i className="ti ti-heart" aria-hidden="true"></i>
          <span>Wellness</span>
        </button>
      </div>
      {/* YouTube player host (rendered by PointsFocusMusic component) */}
    </>
  );
}
