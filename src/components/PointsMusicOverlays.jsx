// Floating overlays that USED to live inside PointsFocusMusic, i.e. inside
// the header. That was a stacking-context trap: .header is
// position:sticky + z-index:50, which creates a stacking context, so these
// children's own z-index values (9999 / 9001) only competed INSIDE the
// header and the whole group composited at z-50 -- below .panel-overlay
// (1000) and every modal. Symptom Joe hit: on Today view with the Tool Kit
// panel open, the music chooser opened *under* the panel, its full-screen
// backdrop not even dimming the header.
//
// They live at .app-wrap level now, as siblings of every other overlay root
// (journal, breathwork, quick capture, ...), so their z-index means what it
// says. Nothing here is layout-bearing -- all three are position:fixed or
// hidden -- so moving them changes stacking only, not geometry.
export default function PointsMusicOverlays() {
  return (
    <>
      {/* Floating +Presence animations (z-9999) */}
      <div className="point-popup-container" id="pointPopupContainer"></div>

      {/* Hidden YouTube player host for focus music */}
      <div
        id="ytPlayerHost"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 1,
          height: 1,
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -1,
          overflow: 'hidden',
        }}
      ></div>

      {/* Music Streaming Modal (z-9001) */}
      <div
        className="music-stream-overlay hidden"
        id="musicStreamOverlay"
        onClick={e => { if (e.target === e.currentTarget) window.closeMusicStreamingModal(); }}
      >
        <div className="music-stream-modal">
          <div className="music-stream-title">{'🎵'} Music Streaming</div>
          <div className="music-stream-sub">
            Open your preferred platform in a new tab. Your music plays there — Centerpost stays
            open alongside it for distraction-free focus sessions.
          </div>
          <div className="music-platform-grid">
            <button className="music-platform-btn spotify" onClick={() => window.launchMusicPlatform('spotify')}>
              <span className="music-platform-icon">{'🎧'}</span>
              <span>Spotify</span>
            </button>
            <button className="music-platform-btn apple" onClick={() => window.launchMusicPlatform('apple')}>
              <span className="music-platform-icon">{'🎵'}</span>
              <span>Apple Music</span>
            </button>
            <button className="music-platform-btn amazon" onClick={() => window.launchMusicPlatform('amazon')}>
              <span className="music-platform-icon">{'🎼'}</span>
              <span>Amazon Music</span>
            </button>
          </div>
          <p className="music-platform-note">
            Your subscription, your library. We redirect you to the platform — nothing is streamed
            through Centerpost.
          </p>
          <button className="music-stream-close" onClick={() => window.closeMusicStreamingModal()}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
