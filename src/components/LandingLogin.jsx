export default function LandingLogin() {
  // R6: native first-run. The marketing page (hero/mockup/features/story) is
  // built for centerpost.app web traffic -- on the native app there's no one
  // to sell, only an already-invited beta user who needs the sign-in card,
  // not a scroll past a dashboard mockup. Web behavior is untouched.
  const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

  const marketingBody = (
    <>
      {/* HERO */}
          <section className="landing-hero">
            <div className="landing-hero-text">
              <div className="landing-badge"><span className="badge-dot"></span> Built by a first responder, for getting things done</div>
              <h1 className="landing-h1">A workspace for brains that <span className="accent">don't quit.</span></h1>
              <p className="landing-sub">One dashboard designed to sharpen focus and strengthen executive function — built for anyone who wants a system that bends with the day. Made by a 30-year firefighter / paramedic who lives in it every day.</p>
              <div className="landing-cta-row">
                {/* Panel survey 2026-08-18 (A-1 copy half): "Get Started —
                    Free" promised open, easy entry and the very next screen
                    is an invite-code wall -- both new personas in that
                    survey bounced here inside two minutes. "Free" is still
                    true and worth keeping (see the no-price-claim comment
                    below, which is about a FUTURE paywall, not this); the
                    dishonest part was "Get Started" implying frictionless
                    access. Says so up front instead of only after a click.
                    Any real opening of signup (waitlist or open) is
                    deliberately separate, larger work -- this is the
                    honesty fix only. */}
                <button className="landing-cta-primary" onClick={() => window.showSignupPanel()}>Create Account — Free <span aria-hidden="true">&rarr;</span></button>
                <button className="landing-cta-tertiary" onClick={() => window.showSigninPanel()}>I have an account</button>
              </div>
              <div className="landing-invite-note" style={{ fontSize: 12, color: 'var(--text-faint,#888)', marginTop: 6 }}>Invite code required right now — ask a current member.</div>
              {/* Pre-App-Store pass: no "free during beta" promise here — tier
                  design is still open, and a free claim that later grows a
                  paywall is the exact trust break the persona panel flagged.
                  Say nothing about price until there's a real answer. */}
              <div className="landing-meta">
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
                  <div className="feature-name">Grounding Session</div>
                  <div className="feature-desc">5-4-3-2-1 sensory grounding, box breathing, 4-7-8, physiological sigh, alternate nostril. Evidence-based regulation when you need it.</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">&#10022;</div>
                  <div className="feature-name">Axis — AI Assistant</div>
                  <div className="feature-desc">Built-in AI that knows your dashboard. Ask &quot;what should I work on next?&quot; Tap Breakdown on any task or project to get a micro-step plan.</div>
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
            <p>One account works on any device. Your data stays yours.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="landing-cta-primary" onClick={() => window.showSignupPanel()}>Create Account <span aria-hidden="true">&rarr;</span></button>
              <button className="landing-cta-tertiary" onClick={() => window.showSigninPanel()}>I have an account</button>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="landing-footer">
            {/* MHMDA requires the Consumer Health Data Privacy Policy to be its own
                conspicuous homepage link, separate from the general privacy policy --
                not merely one item in a list of footer links. Kept web-only for the
                same reason as kids.html below: this footer also renders inside
                native's "What is Centerpost?" toggle, and a bare <a href> there
                strands the user in the chrome-less WKWebView with no way back
                (the exact bug that trapped Joe once already). Native reaches these
                docs from Settings instead, via an in-app browser view, once that
                ships (see COMPLIANCE-GAPS.md / onboarding-consent-flow.md Stage C). */}
            {!isNative && (
              <div className="landing-footer-health-link">
                Centerpost collects consumer health data through its optional wellness
                tools. Read our <a href="/health-privacy">Consumer Health Data Privacy Policy</a>.
              </div>
            )}
            <div>&copy; 2026 Centerpost. Built for first responders, by a first responder.</div>
            <div className="landing-footer-links">
              {!isNative && <a href="/privacy" className="landing-footer-link">Privacy Policy</a>}
              {!isNative && <a href="/terms" className="landing-footer-link">Terms of Service</a>}
              {!isNative && <a href="/ai" className="landing-footer-link">AI Transparency</a>}
              {!isNative && <a href="/disclaimer" className="landing-footer-link">Medical &amp; Crisis Disclaimer</a>}
              <a className="landing-footer-link" onClick={() => window.showSigninPanel()}>Sign In</a>
              <a className="landing-footer-link" onClick={() => window.showSignupPanel()}>Sign Up</a>
            </div>
          </footer>
    </>
  );

  return (
    <>
      {/* AUTH GATE */}
      <div className="login-gate landing-mode" id="loginGate">
        <div className="landing">

          {isNative ? (
            /* Panel survey Stage 4 (I-2): value before auth. This screen
               used to be a logo, a tagline, two buttons and a "What is
               Centerpost?" link you had to tap -- and legacy.js additionally
               threw the sign-in sheet over it automatically with the keyboard
               up, so a first launch showed a password field before showing a
               single thing the app does. The auto-open is gone (see
               onAuthStateChanged in legacy.js) and the real content now
               renders expanded by default, so there's something to read on
               arrival. The standalone tagline was dropped because
               marketingBody's hero leads with the same headline -- it was
               printing twice, back to back. */
            <div className="landing-native-brand">
              <div className="landing-logo"><span className="logo-dot"></span> Centerpost</div>
              <div className="landing-native-cta-row">
                <button className="landing-signin-btn" onClick={() => window.showSigninPanel()}>Sign In</button>
                <button className="landing-signup-btn" onClick={() => window.showSignupPanel()}>Sign Up</button>
              </div>
              <div id="nativeMoreContent" className="landing-native-more open">
                {marketingBody}
              </div>
            </div>
          ) : (
            <>
              {/* Beta banner removed (pre-App-Store pass): an App Store build
                  that calls itself a beta is a 2.1 metadata rejection, and the
                  "all features are free" promise is exactly the claim the
                  persona panel flagged as a future trust break. The
                  .landing-beta-banner CSS stays for now; only the markup is
                  gone. */}

              {/* NAV */}
              <nav className="landing-nav">
                <div className="landing-logo"><span className="logo-dot"></span> Centerpost</div>
                <div className="landing-nav-right">
                  <button className="landing-signin-btn" onClick={() => window.showSigninPanel()}>Sign In</button>
                  <button className="landing-signup-btn" onClick={() => window.showSignupPanel()}>Sign Up</button>
                </div>
              </nav>

              {marketingBody}
            </>
          )}

        </div>
      </div>

      {/* SIGN-IN OVERLAY */}
      <div className="signin-overlay" id="signinOverlay" onClick={e => { if (e.target === e.currentTarget) window.hideSigninPanel(); }}>
        <div className="signin-card">
          <button className="signin-close" onClick={() => window.hideSigninPanel()} aria-label="Close">&#10005;</button>
          <h2>&#128274; Sign In</h2>
          <p className="login-sub" id="loginSub">Welcome back to your workspace</p>
          <div id="loginForm">
            {/* Hidden by default -- _waMaybeShowSigninButton (legacy.js,
                called from showSigninPanel) reveals it only when THIS
                browser previously enrolled Touch ID (a local hint, not a
                security check) and the platform still supports it now.
                Password stays the primary path either way. */}
            <button id="waSigninBtn" className="login-btn" style={{ display: 'none', background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', marginBottom: 10 }} onClick={() => window.signInWithTouchID()}>&#128272; Sign in with Touch ID</button>
            <input type="email" id="loginEmail" placeholder="Email address..." onKeyDown={e => { if (e.key === 'Enter') document.getElementById('loginPass').focus(); }} />
            <input type="password" id="loginPass" placeholder="Password..." onKeyDown={e => { if (e.key === 'Enter') window.doLogin(); }} />
            <button className="login-btn" onClick={() => window.doLogin()}>Sign In</button>
            <div className="login-error" id="loginError"></div>
            <div className="login-success" id="loginSuccess"></div>
            <span className="login-link" onClick={() => window.doForgotPassword()}>Forgot password?</span>
            {/* Panel survey 2026-08-19, Stage 4 (J-2): the "First-time setup"
                link and its Create Admin Account form used to sit here. The
                stage's security audit found it was a working invite-gate
                bypass -- see the retired doSetup() in legacy.js for the full
                trace and why it was removed rather than gated. */}
            <div className="signin-switch">Don't have an account? <a onClick={() => { window.hideSigninPanel(); window.showSignupPanel(); }}>Sign up free</a></div>
          </div>
        </div>
      </div>

      {/* SIGN-UP OVERLAY */}
      <div className="signin-overlay" id="signupOverlay" onClick={e => { if (e.target === e.currentTarget) window.hideSignupPanel(); }}>
        <div className="signin-card">
          <button className="signin-close" onClick={() => window.hideSignupPanel()} aria-label="Close">&#10005;</button>
          <h2>&#128640; Create Account</h2>
          <p className="login-sub">Invite code required</p>
          <div id="signupForm">
            <input type="text" id="signupInvite" placeholder="Invite code..." autoComplete="off" autoCapitalize="characters" style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }} onKeyDown={e => { if (e.key === 'Enter') document.getElementById('signupEmail').focus(); }} />
            <input type="email" id="signupEmail" placeholder="Email address..." autoComplete="email" onKeyDown={e => { if (e.key === 'Enter') document.getElementById('signupPass').focus(); }} />
            <input type="password" id="signupPass" placeholder="Password (min 6 characters)..." autoComplete="new-password" onKeyDown={e => { if (e.key === 'Enter') document.getElementById('signupPassConfirm').focus(); }} />
            <input type="password" id="signupPassConfirm" placeholder="Confirm password..." autoComplete="new-password" onKeyDown={e => { if (e.key === 'Enter') window.doSignup(); }} />
            <button className="login-btn" onClick={() => window.doSignup()} id="signupBtn">Create Account</button>
            <div className="login-error" id="signupError"></div>
            <div className="login-success" id="signupSuccess"></div>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 12, lineHeight: 1.5 }}>Access is invite-only right now. By creating an account you agree to use Centerpost for personal productivity — features may change, and you can export your data anytime.</p>
            {/* Panel survey Stage 4 (A-1): the waitlist lives HERE, at the
                exact point where someone without a code hits the wall --
                that's where both newcomer personas bounced. Previously this
                paragraph just told them to go find the developer. */}
            <div className="waitlist-block" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 8px', lineHeight: 1.5 }}>No code? Leave your email and we&rsquo;ll send you one when a spot opens.</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="email" id="waitlistEmail" placeholder="you@example.com" autoComplete="email" style={{ flex: 1, marginBottom: 0 }} onKeyDown={e => { if (e.key === 'Enter') window.joinWaitlist(); }} />
                <button className="btn" id="waitlistBtn" onClick={() => window.joinWaitlist()} style={{ whiteSpace: 'nowrap' }}>Join the waitlist</button>
              </div>
              <div id="waitlistMsg" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, minHeight: 14, lineHeight: 1.5 }}></div>
            </div>
            <div className="signin-switch">Already have an account? <a onClick={() => { window.hideSignupPanel(); window.showSigninPanel(); }}>Sign in</a></div>
          </div>
        </div>
      </div>
    </>
  );
}
