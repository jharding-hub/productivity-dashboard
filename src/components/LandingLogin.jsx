export default function LandingLogin() {
  return (
    <>
      {/* AUTH GATE */}
      <div className="login-gate landing-mode" id="loginGate">
        <div className="landing">

          {/* BETA BANNER */}
          <div className="landing-beta-banner">
            <span className="beta-tag">BETA</span>
            <span className="beta-text">Centerpost is in active beta testing — <strong>all features are free</strong> while the developer is testing and iterating. Sign up and help shape it.</span>
          </div>

          {/* NAV */}
          <nav className="landing-nav">
            <div className="landing-logo"><span className="logo-dot"></span> Centerpost</div>
            <div className="landing-nav-right">
              <a href="kids.html" className="landing-nav-link">Kids Mode</a>
              <button className="landing-signin-btn" onClick={() => window.showSigninPanel()}>Sign In</button>
              <button className="landing-signup-btn" onClick={() => window.showSignupPanel()}>Sign Up</button>
            </div>
          </nav>

          {/* HERO */}
          <section className="landing-hero">
            <div className="landing-hero-text">
              <div className="landing-badge"><span className="badge-dot"></span> Built by a first responder, for getting things done</div>
              <h1 className="landing-h1">A workspace for brains that <span className="accent">don't quit.</span></h1>
              <p className="landing-sub">One dashboard designed to sharpen focus and strengthen executive function — built for anyone who wants a system that bends with the day. Made by a 30-year firefighter / paramedic who lives in it every day.</p>
              <div className="landing-cta-row">
                <button className="landing-cta-primary" onClick={() => window.showSignupPanel()}>Get Started — Free <span aria-hidden="true">&rarr;</span></button>
                <button className="landing-cta-tertiary" onClick={() => window.showSigninPanel()}>I have an account</button>
                <a href="kids.html" className="landing-cta-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>&#127918; Try Kids Mode</a>
              </div>
              <div className="landing-meta">
                <div className="landing-meta-item">Free during beta</div>
                <div className="landing-meta-item">No ads. No tracking.</div>
                <div className="landing-meta-item">Your data, your account.</div>
                <div className="landing-meta-item">Works offline.</div>
              </div>
            </div>

            {/* DASHBOARD MOCKUP */}
            <div className="landing-mockup">
              <div className="mockup-frame">
                <div className="mockup-titlebar">
                  <div className="mockup-dots">
                    <div className="mockup-dot r"></div>
                    <div className="mockup-dot y"></div>
                    <div className="mockup-dot g"></div>
                  </div>
                  <div className="mockup-url">centerpost.app</div>
                </div>
                <div className="mockup-content">
                  <div className="mockup-header">
                    <div className="mockup-header-left">
                      <span style={{ color: '#5be8ff' }}>&#9826;</span>
                      <span className="mockup-points">1,247 Presence</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Tue, May 26</span>
                  </div>
                  <div className="mockup-grid">
                    {/* Projects */}
                    <div className="mockup-panel">
                      <div className="mockup-panel-title">&#128194; Projects</div>
                      <div className="mockup-item priority-high">
                        <span className="mi-dot" style={{ background: '#ef4444' }}></span>
                        <span className="mi-text">Q2 EMS QA Report</span>
                        <span className="mi-time">today</span>
                      </div>
                      <div className="mockup-item">
                        <span className="mi-dot" style={{ background: '#fbbf24' }}></span>
                        <span className="mi-text">CIT Training Deck</span>
                        <span className="mi-time">tomorrow</span>
                      </div>
                      <div className="mockup-item">
                        <span className="mi-dot" style={{ background: '#5be8ff' }}></span>
                        <span className="mi-text">Cog Psych Midterm Prep</span>
                        <span className="mi-time">3 days</span>
                      </div>
                      <div className="mockup-item done">
                        <span className="mi-check">&#10003;</span>
                        <span className="mi-text">Submit overtime report</span>
                      </div>
                    </div>
                    {/* Tasks */}
                    <div className="mockup-panel">
                      <div className="mockup-panel-title">&#128203; Today</div>
                      <div className="mockup-item">
                        <span className="mi-check"></span>
                        <span className="mi-text">Pull run report stats</span>
                        <span className="mi-time">30m</span>
                      </div>
                      <div className="mockup-item">
                        <span className="mi-check"></span>
                        <span className="mi-text">Call back Dr. Patel</span>
                        <span className="mi-time">1hr</span>
                      </div>
                      <div className="mockup-item done">
                        <span className="mi-check">&#10003;</span>
                        <span className="mi-text">Workout — upper body</span>
                      </div>
                      <div className="mockup-item">
                        <span className="mi-check"></span>
                        <span className="mi-text">Order creatine refill</span>
                        <span className="mi-time">15m</span>
                      </div>
                    </div>
                    {/* Energy/Mood */}
                    <div className="mockup-panel">
                      <div className="mockup-panel-title">&#9889; Energy</div>
                      <div className="mockup-mood-grid">
                        <div className="mockup-mood-chip">High</div>
                        <div className="mockup-mood-chip active">Good</div>
                        <div className="mockup-mood-chip">Low</div>
                        <div className="mockup-mood-chip">Crash</div>
                      </div>
                      <div className="mockup-panel-title" style={{ marginTop: 6 }}>&#127769; Mood</div>
                      <div className="mockup-mood-grid">
                        <div className="mockup-mood-chip active">Focus</div>
                        <div className="mockup-mood-chip">Scatter</div>
                      </div>
                    </div>
                  </div>
                  {/* Timeline */}
                  <div className="mockup-timeline">
                    <div className="mockup-tl-block" style={{ background: '#3b82f6', width: '14%' }}>Run shift</div>
                    <div className="mockup-tl-block" style={{ background: '#10b981', width: '22%' }}>QA Report</div>
                    <div className="mockup-tl-block" style={{ background: '#f59e0b', width: '12%' }}>Lunch</div>
                    <div className="mockup-tl-block" style={{ background: '#8b5cf6', width: '18%' }}>Cog Psych</div>
                    <div className="mockup-tl-block" style={{ background: '#ec4899', width: '14%' }}>Workout</div>
                    <div className="mockup-tl-block" style={{ background: '#5be8ff', color: '#0a1218', width: '18%' }}>Family</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section className="landing-features">
            <div className="landing-features-inner">
              <h2 className="landing-section-h">Everything in one place.</h2>
              <p className="landing-section-sub">Replace your stack — planner, journal, mood tracker, grounding kit, focus timer, AI assistant. All here, designed to talk to each other.</p>
              <div className="feature-grid">
                <div className="feature-card">
                  <div className="feature-icon">&#128194;</div>
                  <div className="feature-name">Projects + Tasks</div>
                  <div className="feature-desc">Sort by time-needed, not just priority. Match work to your current energy state. AI breakdown turns &quot;plan the trip&quot; into 8 micro-steps.</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">&#128197;</div>
                  <div className="feature-name">Two-way Calendar Sync</div>
                  <div className="feature-desc">Centerpost pushes to Google Calendar and pulls events back. See your full day in the Timeline panel. Outlook coming next.</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">&#9889;</div>
                  <div className="feature-name">Energy &amp; HALT+ Check</div>
                  <div className="feature-desc">Track High / Good / Low / Crash and Focus / Scatter / Anxious / Calm. The Hungry / Angry / Lonely / Tired check helps you catch dysregulation early.</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">&#127757;</div>
                  <div className="feature-name">Grounding Toolkit</div>
                  <div className="feature-desc">5-4-3-2-1 sensory grounding, box breathing, 4-7-8, physiological sigh, alternate nostril. Evidence-based regulation when you need it.</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">&#10022;</div>
                  <div className="feature-name">Axis — AI Assistant</div>
                  <div className="feature-desc">Built-in AI that knows your dashboard. Ask &quot;what should I work on next?&quot; Tap Breakdown on any task or project to get a micro-step plan.</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">&#127918;</div>
                  <div className="feature-name">Kids Mode</div>
                  <div className="feature-desc">Help your child build routines, create tasks, track reading and feelings, and learn productivity through small micro-habits each day. Pixel-art themed and easy to use. Optional cross-device sync with your account.</div>
                </div>
              </div>
            </div>
          </section>

          {/* STORY */}
          <section className="landing-story">
            <div className="landing-story-inner">
              <p className="landing-story-quote">&ldquo;I needed a productivity app built to support my executive function by organizing my many projects and tasks. Along the way, I realized I also needed to pay attention to the systems behind better focus. I wanted something that could track energy and attention, redirect me when I&rsquo;m stuck, and offer suggestions to help me get going. <span className="accent">I&rsquo;ve designed Centerpost to create flexible, micro improvements that build consistency, self-awareness, and adaptive support to keep me on task.</span> Bringing these resources together in one place helps create a flow state where barriers to productive work sessions are reduced, allowing me to achieve the focus I so badly needed.&rdquo;</p>
              <p className="landing-story-attr"><strong>Joe Harding</strong> &mdash; firefighter / paramedic, 30+ years; builder of Centerpost</p>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="landing-final-cta">
            <h2>Ready to get organized?</h2>
            <p>Free during beta. One account works on any device. Your data stays yours.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="landing-cta-primary" onClick={() => window.showSignupPanel()}>Create Free Account <span aria-hidden="true">&rarr;</span></button>
              <button className="landing-cta-tertiary" onClick={() => window.showSigninPanel()}>I have an account</button>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="landing-footer">
            <div>&copy; 2026 Centerpost. Built for first responders, by a first responder.</div>
            <div className="landing-footer-links">
              <a href="kids.html" className="landing-footer-link">Kids Mode</a>
              <a className="landing-footer-link" onClick={() => window.showSigninPanel()}>Sign In</a>
              <a className="landing-footer-link" onClick={() => window.showSignupPanel()}>Sign Up</a>
            </div>
          </footer>

        </div>
      </div>

      {/* SIGN-IN OVERLAY */}
      <div className="signin-overlay" id="signinOverlay" onClick={e => { if (e.target === e.currentTarget) window.hideSigninPanel(); }}>
        <div className="signin-card">
          <button className="signin-close" onClick={() => window.hideSigninPanel()} aria-label="Close">&#10005;</button>
          <h2>&#128274; Sign In</h2>
          <p className="login-sub" id="loginSub">Welcome back to your workspace</p>
          <div id="loginForm">
            <input type="email" id="loginEmail" placeholder="Email address..." onKeyDown={e => { if (e.key === 'Enter') document.getElementById('loginPass').focus(); }} />
            <input type="password" id="loginPass" placeholder="Password..." onKeyDown={e => { if (e.key === 'Enter') window.doLogin(); }} />
            <button className="login-btn" onClick={() => window.doLogin()}>Sign In</button>
            <div className="login-error" id="loginError"></div>
            <div className="login-success" id="loginSuccess"></div>
            <span className="login-link" onClick={() => window.doForgotPassword()}>Forgot password?</span>
            <span style={{ margin: '0 6px', color: 'var(--text-faint)' }}>|</span>
            <span className="login-link" onClick={() => window.showSetupForm()}>First-time setup</span>
            <div className="signin-switch">Don't have an account? <a onClick={() => { window.hideSigninPanel(); window.showSignupPanel(); }}>Sign up free</a></div>
          </div>
          <div id="setupForm" style={{ display: 'none' }}>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Create the admin account. This only needs to be done once.</p>
            <input type="email" id="setupEmail" placeholder="Your email..." onKeyDown={e => { if (e.key === 'Enter') document.getElementById('setupPass').focus(); }} />
            <input type="password" id="setupPass" placeholder="Password (min 6 chars)..." onKeyDown={e => { if (e.key === 'Enter') window.doSetup(); }} />
            <button className="login-btn" onClick={() => window.doSetup()}>Create Admin Account</button>
            <div className="login-error" id="setupError"></div>
            <span className="login-link" onClick={() => window.showLoginForm()}>&larr; Back to sign in</span>
          </div>
        </div>
      </div>

      {/* SIGN-UP OVERLAY */}
      <div className="signin-overlay" id="signupOverlay" onClick={e => { if (e.target === e.currentTarget) window.hideSignupPanel(); }}>
        <div className="signin-card">
          <button className="signin-close" onClick={() => window.hideSignupPanel()} aria-label="Close">&#10005;</button>
          <h2>&#128640; Create Account</h2>
          <p className="login-sub">Free during beta — invite code required</p>
          <div id="signupForm">
            <input type="text" id="signupInvite" placeholder="Beta invite code..." autoComplete="off" autoCapitalize="characters" style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }} onKeyDown={e => { if (e.key === 'Enter') document.getElementById('signupEmail').focus(); }} />
            <input type="email" id="signupEmail" placeholder="Email address..." autoComplete="email" onKeyDown={e => { if (e.key === 'Enter') document.getElementById('signupPass').focus(); }} />
            <input type="password" id="signupPass" placeholder="Password (min 6 characters)..." autoComplete="new-password" onKeyDown={e => { if (e.key === 'Enter') document.getElementById('signupPassConfirm').focus(); }} />
            <input type="password" id="signupPassConfirm" placeholder="Confirm password..." autoComplete="new-password" onKeyDown={e => { if (e.key === 'Enter') window.doSignup(); }} />
            <button className="login-btn" onClick={() => window.doSignup()} id="signupBtn">Create Account</button>
            <div className="login-error" id="signupError"></div>
            <div className="login-success" id="signupSuccess"></div>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.5 }}>Beta access is invite-only right now. Ask the developer (or a current beta user) for a code. By creating an account you agree to use Centerpost for personal productivity — the app is in beta, features may change, and you can export your data anytime.</p>
            <div className="signin-switch">Already have an account? <a onClick={() => { window.hideSignupPanel(); window.showSigninPanel(); }}>Sign in</a></div>
          </div>
        </div>
      </div>
    </>
  );
}
