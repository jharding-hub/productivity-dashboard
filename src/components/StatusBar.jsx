export default function StatusBar() {
  return (
    <>
      <span className="user-email-display" id="userEmail"></span>
      {/* Panel survey 2026-08-18 (I-5): was a static label with no detail,
          no last-synced time, and no retry -- now tap-through to a small
          popover (toggleSyncPopover/_renderSyncPopover in legacy.js). */}
      <span className="sync-status-wrap">
        <span className="sync-status offline" id="syncStatus" onClick={() => window.toggleSyncPopover()} style={{ cursor: 'pointer' }} title="Sync status -- tap for detail"><span className="sync-dot"></span> Local</span>
        <div className="sync-status-popover" id="syncStatusPopover" style={{ display: 'none' }}></div>
      </span>
      <div className="status-bar-spacer"></div>
      {/* R2b: the ☀ Focus / ⊞ All Panels button was retired -- the Today/
          Everything switch in the header now serves the "give me less" need
          it approximated. toggleFocusMode()/state.focusMode remain in
          legacy.js, dead but harmless. */}
      <button className="customize-btn" onClick={() => window.openCommandPalette()} title="Menu — jump to anything (Ctrl/Cmd+K)">&#9776; Menu</button>
      <button className="customize-btn" onClick={() => window.openCustomize()} title="Show/hide panels and theme settings">&#9881; Settings</button>
      {/* Moved here from the Tool Kit grid at Joe's request, 2026-08-19 --
          always-reachable regardless of which panels are shown/hidden, same
          idea as Settings/Tour living in this ribbon rather than a panel. */}
      <button className="customize-btn" onClick={() => window.openCrisisResources()} title="Crisis resources -- 988 and other help, always here">&#128222; Crisis</button>
      <button
        className="customize-btn"
        onClick={() => window.openOnboardingTour()}
        title="Replay the getting-started tour"
      >&#10024; Tour</button>
      <button className="lock-btn" id="lockBtn" onClick={() => window.toggleLock()} title="Lock/unlock layout and editing">&#128274; Locked</button>
      <button className="logout-btn" onClick={() => window.doLogout()} title="Sign out">Sign out</button>
      <div className="status-bar-spacer"></div>
    </>
  );
}
