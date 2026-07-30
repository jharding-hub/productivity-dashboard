export default function StatusBar() {
  return (
    <>
      <span className="user-email-display" id="userEmail"></span>
      <span className="sync-status offline" id="syncStatus"><span className="sync-dot"></span> Local</span>
      <div className="status-bar-spacer"></div>
      {/* R2b: the ☀ Focus / ⊞ All Panels button was retired -- the Today/
          Everything switch in the header now serves the "give me less" need
          it approximated. toggleFocusMode()/state.focusMode remain in
          legacy.js, dead but harmless. */}
      <button className="customize-btn" onClick={() => window.openCommandPalette()} title="Menu — jump to anything (Ctrl/Cmd+K)">&#9776; Menu</button>
      <button className="customize-btn" onClick={() => window.openCustomize()} title="Show/hide panels and theme settings">&#9881; Settings</button>
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
