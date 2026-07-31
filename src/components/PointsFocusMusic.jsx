export default function PointsFocusMusic() {
  return (
    <>
      {/* F24: the Presence Points medal lives here now, in the header's
          left slot (which the markup was already labelled for), NOT on the
          Tool Kit panel where it sat above the grounding tools. Exactly ONE
          copy of these ids may exist -- renderPointsBadge/togglePointsPopup/
          applyPointsVisibility all target #pointsWrap/#pointsBadge/#ptValue
          by id, and a duplicate would silently update only the first (this
          codebase's recurring duplicate-DOM-id bug class). */}
      <div className="points-wrap" id="pointsWrap">
        <div
          className="points-badge points-badge-lg"
          id="pointsBadge"
          onClick={() => window.togglePointsPopup()}
          title="Presence points are awarded for showing up. Making an effort, staying focused and completing tasks improve productivity."
          style={{ cursor: 'pointer' }}
        >
          <span className="points-tier-icon" id="ptTierIcon">{'🥉'}</span>
          <span className="points-value" id="ptValue">0</span>
          <span className="points-label" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, fontSize: 9, opacity: 0.7, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600 }}>
            <span>Presence</span>
            <span>points</span>
          </span>
        </div>
        <div className="points-popup" id="pointsPopup" style={{ display: 'none' }}></div>
      </div>

      {/* Point popup container (floating +Presence animations) */}
      <div className="point-popup-container" id="pointPopupContainer"></div>

      {/* Hidden YouTube player container for focus music */}
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

      {/* Music Streaming Modal */}
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
