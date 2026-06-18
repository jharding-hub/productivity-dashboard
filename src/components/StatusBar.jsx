export default function StatusBar() {
  return (
    <>
      <span className="user-email-display" id="userEmail"></span>
      <span className="sync-status offline" id="syncStatus"><span className="sync-dot"></span> Local</span>
      <div className="status-bar-spacer"></div>
      <button className="customize-btn" onClick={() => window.openCustomize()} title="Show/hide panels and theme settings">&#9881; Settings</button>
      <button
        className="customize-btn howto-launcher"
        onClick={() => window.open('https://centerpost.app/howto.html', '_blank')}
        title="Open the Centerpost How-To guide"
        style={{ background: 'linear-gradient(135deg,#5be8ff,#0ea5e9)', border: '1px solid #0ea5e9', color: '#0a1218', fontWeight: 700, letterSpacing: '0.3px', boxShadow: '0 0 8px rgba(91,232,255,0.35)' }}
      >&#128218; How To</button>
      <button
        className="customize-btn kids-launcher"
        onClick={() => {
          if (window.currentUser) {
            try {
              localStorage.setItem('_kidsParentUid', window.currentUser.uid);
              localStorage.setItem('_kidsParentEmail', window.currentUser.email || '');
            } catch (e) { /* ignore */ }
          }
          window.open('https://centerpost.app/kids.html', '_blank');
        }}
        title="Open Centerpost Kids (4th tier — kid-friendly arcade mode)"
        style={{ background: 'linear-gradient(135deg,#ffcc00,#ff3399)', border: '1px solid #cc9900', color: '#1a0033', fontWeight: 700, letterSpacing: '0.5px', boxShadow: '0 0 8px rgba(255,204,0,0.3)' }}
      >&#127918; Kids Mode</button>
      <button
        className="customize-btn teacher-launcher"
        id="teacherLauncherBtn"
        onClick={() => window.open('https://centerpost.app/teacher.html', '_blank')}
        title="Open Centerpost Teacher Planner (Legacy)"
        style={{ display: 'none', background: 'linear-gradient(135deg,#2d5240,#1e3a2f)', border: '1px solid #3d6b52', color: '#fff', fontWeight: 700, letterSpacing: '0.3px', boxShadow: '0 0 8px rgba(45,82,64,0.4)' }}
      >&#128196; Teacher</button>
      <button className="lock-btn" id="lockBtn" onClick={() => window.toggleLock()} title="Lock/unlock layout and editing">&#128274; Locked</button>
      <button className="logout-btn" onClick={() => window.doLogout()} title="Sign out">Sign out</button>
      <div className="status-bar-spacer"></div>
    </>
  );
}
