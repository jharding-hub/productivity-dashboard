// ═══════════════════════════════════════════════════════════════
// Centerpost Legacy App — all script blocks from original index.html
// ═══════════════════════════════════════════════════════════════

// ── SCRIPT 1: AUTH ──────────────────────────────────────────────
// DEBUG gates verbose payload logging. Keep false in production; even when
// true, never log the Firebase ID token or Authorization headers.
var DEBUG=false;
var currentUser=null;
var isAdmin=false;
var userProfile=null;

// --- TIER SYSTEM -------------------------------------------------------------
// DEV_UID: your Firebase UID -- the switcher badge only renders for this account
var DEV_UID='s3c2jCHRkRWfxRAjJKoVVuL14aJ3';

// --- TIER CONFIG ------------------------------------------------------------
// Free → Pro → Premium → Legacy (admin-granted) → Owner (dev)
// This is the single source of truth for all feature gating.
var TIER_CONFIG={
  free:{
    label:'Free',
    color:'#6b7280',
    allowedThemeTiers:['free'],
    // Free: basic panels + Toolkit (regulation only), no AI assistant, no
    // Timeline, no Brain Dump. R3: regulation is free, power is paid --
    // breath/HALT+/mood are the app's differentiator and shouldn't be
    // paywalled from the users they'd hook. Urge Log and the Grounding
    // Toolkit panel (data-panel="wellness") were already tier-agnostic before
    // this change -- see TOOLKIT_CLASS_MAP and shouldShowWellness().
    panels:['projects','tasklist','notes','routines','time'],
    maxProjects:3,
    maxTasks:20,
    maxNotes:10,
    maxReminders:5,
    toolkitAllowed:['breath','halt','mood'],
    voiceInput:false,
    radar:false,
    dataExport:false,
    completedHistory:false,
    brainDump:false,
    routines:true,
    decision:false,
    aiAssistant:false,
    musicStreaming:false,
  },
  pro:{
    label:'Pro',
    color:'#d4a853',
    allowedThemeTiers:['free','pro'],
    // Pro: adds Toolkit, Timeline, Reminders, Brain Dump, Decision
    panels:['projects','reminders','notes','tasklist','timeline','brain','time','routines','decision'],
    maxProjects:null,
    maxTasks:null,
    maxNotes:null,
    maxReminders:null,
    toolkitAllowed:['timer','breath','mood','journal','halt'],
    voiceInput:true,
    radar:true,
    dataExport:true,
    completedHistory:true,
    brainDump:true,
    routines:true,
    decision:true,
    aiAssistant:false,
    musicStreaming:false,
  },
  premium:{
    label:'Premium',
    color:'#7c3aed',
    allowedThemeTiers:['free','pro','premium'],
    // Premium: all features + all themes
    panels:['projects','reminders','notes','tasklist','timeline','brain','time','routines','decision','wellness'],
    maxProjects:null,maxTasks:null,maxNotes:null,maxReminders:null,
    toolkitAllowed:['music','breath','timer','mood','journal','workout','halt','wellness'],
    voiceInput:true,radar:true,dataExport:true,completedHistory:true,
    brainDump:true,routines:true,decision:true,
    aiAssistant:true,
    musicStreaming:true,
  },
  legacy:{
    label:'Legacy',
    color:'#059669',
    // Legacy: all features, free, admin-granted only
    allowedThemeTiers:['free','pro','premium'],
    panels:['projects','reminders','notes','tasklist','timeline','brain','time','routines','decision','wellness'],
    maxProjects:null,maxTasks:null,maxNotes:null,maxReminders:null,
    toolkitAllowed:['music','breath','timer','mood','journal','workout','halt','wellness'],
    voiceInput:true,radar:true,dataExport:true,completedHistory:true,
    brainDump:true,routines:true,decision:true,
    aiAssistant:true,
    musicStreaming:true,
  },
  owner:{
    label:'Owner',
    color:'#e07828',
    allowedThemeTiers:['free','pro','premium'],
    panels:['projects','reminders','notes','tasklist','timeline','brain','time','routines','decision','wellness','admin'],
    maxProjects:null,maxTasks:null,maxNotes:null,maxReminders:null,
    toolkitAllowed:['music','breath','timer','mood','journal','workout','halt','wellness'],
    voiceInput:true,radar:true,dataExport:true,completedHistory:true,
    brainDump:true,routines:true,decision:true,
    aiAssistant:true,
    musicStreaming:true,
  }
};

// Toolkit button → CSS class mapping
var TOOLKIT_CLASS_MAP={
  music:'toolkit-music',breath:'toolkit-breath',timer:'toolkit-timer',
  mood:'toolkit-mood',journal:'toolkit-journal',workout:'toolkit-workout',
  halt:'toolkit-halt',wellness:'toolkit-wellness'
};

function getActiveTier(){
  // Dev override is honored ONLY for the owner account, so a non-owner
  // can't self-promote from the console via localStorage.
  if(currentUser&&currentUser.uid===DEV_UID){
    var devOverride=localStorage.getItem('devTierOverride');
    if(devOverride&&TIER_CONFIG[devOverride])return devOverride;
    return'owner';
  }
  // Legacy tier: stored in Firestore profile as accountTier:'legacy'
  if(currentUser&&window._profileAccountTier&&TIER_CONFIG[window._profileAccountTier])
    return window._profileAccountTier;
  // Fail closed: unknown accounts get the lowest tier.
  // Server-side enforcement (S-2) lives in the centerpost-jarvis Worker:
  // a KV tier registry (synced by the admin panel via /admin-set-tier)
  // caps free accounts at a daily AI quota. This client gating is UX only.
  return'free';
}

function getTierConfig(){
  return TIER_CONFIG[getActiveTier()]||TIER_CONFIG.free;
}

function applyTierGating(){
  var cfg=getTierConfig();

  // -- Panels ------------------------------------------------------------------
  document.querySelectorAll('.panel[data-panel]').forEach(function(panel){
    var key=panel.getAttribute('data-panel');
    if(key==='wellness'||key==='admin')return; // managed elsewhere
    var allowed=BETA_ALL_FEATURES||cfg.panels.indexOf(key)>=0;
    if(!allowed){
      panel.classList.add('tier-locked-panel');
      panel.classList.remove('hidden-panel');
      _injectPanelLockBadge(panel,key);
    }else{
      panel.classList.remove('tier-locked-panel');
      _removePanelLockBadge(panel);
    }
  });

  // -- Toolkit buttons ---------------------------------------------------------
  Object.keys(TOOLKIT_CLASS_MAP).forEach(function(key){
    var cls=TOOLKIT_CLASS_MAP[key];
    // music and timer are wrappers, find the button inside
    var el=document.querySelector('.toolkit-'+key+'-wrap .toolkit-btn')||document.querySelector('.'+cls);
    if(!el)return;
    var allowed=BETA_ALL_FEATURES||cfg.toolkitAllowed.indexOf(key)>=0;
    el.classList.toggle('tier-locked-btn',!allowed);
    // swap onclick so locked buttons show upgrade toast instead
    if(!allowed){
      el.setAttribute('data-original-onclick',el.getAttribute('onclick')||'');
      el.setAttribute('onclick','_tierUpgradeToast()');
    }else{
      var orig=el.getAttribute('data-original-onclick');
      if(orig){el.setAttribute('onclick',orig);el.removeAttribute('data-original-onclick');}
    }
  });

  // -- Voice input buttons ------------------------------------------------------
  document.querySelectorAll('.mic-btn').forEach(function(btn){
    var voiceOk=BETA_ALL_FEATURES||cfg.voiceInput;
    btn.classList.toggle('tier-locked-btn',!voiceOk);
    btn.disabled=!voiceOk;
    btn.title=voiceOk?'Voice input':'Voice input (Pro)';
  });

  // -- Completed history --------------------------------------------------------
  document.querySelectorAll('.completed-projects-section,.completed-tasks-section,#taskListCompleted').forEach(function(el){
    el.style.display=(BETA_ALL_FEATURES||cfg.completedHistory)?'':'none';
  });

  // -- Dev switcher badge -------------------------------------------------------
  _renderDevSwitcher();

  // -- AI assistant (Axis FAB + Breakdown buttons) -----------------------------
  var fab=document.getElementById('jarvisFab');
  if(fab){
    fab.style.display=(!BETA_ALL_FEATURES&&cfg.aiAssistant===false)?'none':'';
  }
  document.querySelectorAll('.breakdown-btn').forEach(function(b){
    b.style.display=(!BETA_ALL_FEATURES&&cfg.aiAssistant===false)?'none':'';
  });

  // -- Music streaming button (only Owner/Legacy/Premium) -----------------------
  var musicBtn=document.getElementById('toolkitMusicStreamBtn');
  if(musicBtn)musicBtn.style.display=(BETA_ALL_FEATURES||cfg.musicStreaming)?'':'none';
}

function _injectPanelLockBadge(panel,key){
  if(panel.querySelector('.tier-lock-badge'))return;
  var names={brain:'Brain Dump',time:'Tool Kit',routines:'Routines',decision:'Decision Support',timeline:'Timeline',reminders:'Reminders',wellness:'Wellness'};
  var name=names[key]||key;
  // Map panel to minimum tier required
  var tierNeeded={brain:'Pro',time:'Pro',timeline:'Pro',reminders:'Pro',decision:'Pro',wellness:'Premium',admin:'Owner'};
  var tier=tierNeeded[key]||'Pro';
  var badge=document.createElement('div');
  badge.className='tier-lock-badge';
  badge.innerHTML='🔒 <strong>'+name+'</strong> requires '+tier+'. <button onclick="_tierUpgradeToast(\''+tier+'\')" class="tier-upgrade-btn">Upgrade to '+tier+'</button>';
  panel.appendChild(badge);
}

function _removePanelLockBadge(panel){
  var b=panel.querySelector('.tier-lock-badge');
  if(b)b.parentNode.removeChild(b);
}

function _tierUpgradeToast(tier){
  var t=tier||'Pro';
  if(typeof toast==='function')toast('⚡ Upgrade to '+t+' to unlock this feature');
}

function _renderDevSwitcher(){
  if(!currentUser||currentUser.uid!==DEV_UID)return;
  var existing=document.getElementById('devTierSwitcher');
  if(existing)existing.parentNode.removeChild(existing);
}
function _renderDevSwitcherInSettings(){
  var target=document.getElementById('devTierSettingsWrap');
  if(!target)return;
  if(!currentUser||currentUser.uid!==DEV_UID){target.style.display='none';return;}
  target.style.display='block';
  var active=getActiveTier();
  target.innerHTML='<div class="section-label" style="margin-top:12px;margin-bottom:8px;">Developer</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;">'+
    Object.keys(TIER_CONFIG).map(function(k){
      var t=TIER_CONFIG[k];
      return '<button class="dev-tier-opt'+(k===active?' active':'')+'" onclick="_setDevTier(\''+k+'\')" style="font-size:11px;">'+
        '<span style="color:'+t.color+'">⬡</span> '+t.label+'</button>';
    }).join('')+
    '</div>';
}

function _setDevTier(tier){
  localStorage.setItem('devTierOverride',tier);
  applyTierGating();
  _renderDevSwitcherInSettings();
  if(typeof toast==='function')toast('Tier → '+TIER_CONFIG[tier].label);
}
// -----------------------------------------------------------------------------

function showSetupForm(){
  document.getElementById('loginForm').style.display='none';
  document.getElementById('setupForm').style.display='block';
  document.getElementById('loginSub').textContent='Create the first admin account';
}
function showLoginForm(){
  document.getElementById('loginForm').style.display='block';
  document.getElementById('setupForm').style.display='none';
  document.getElementById('loginSub').textContent='Sign in to your workspace';
}

async function doSetup(){
  const email=document.getElementById('setupEmail').value.trim();
  const pass=document.getElementById('setupPass').value;
  const err=document.getElementById('setupError');
  err.textContent='';
  if(!email||!pass){err.textContent='Enter email and password.';return;}
  if(pass.length<6){err.textContent='Password must be at least 6 characters.';return;}
  try{
    const cred=await firebase.auth().createUserWithEmailAndPassword(email,pass);
    // Write user profile -- this user becomes admin
    await db.collection('users').doc(cred.user.uid).set({
      email:email,admin:true,disabled:false,
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      lastActive:firebase.firestore.FieldValue.serverTimestamp()
    });
    // onAuthStateChanged will fire and handle the rest
  }catch(e){err.textContent=e.message;}
}

async function doLogin(){
  const email=document.getElementById('loginEmail').value.trim();
  const pass=document.getElementById('loginPass').value;
  const err=document.getElementById('loginError');
  err.textContent='';
  if(!email||!pass){err.textContent='Enter email and password.';return;}
  try{
    await firebase.auth().signInWithEmailAndPassword(email,pass);
  }catch(e){
    const msg=e.code==='auth/user-not-found'?'No account with that email. Ask your admin to create one.':
              e.code==='auth/wrong-password'||e.code==='auth/invalid-credential'?'Incorrect password.':
              e.code==='auth/invalid-email'?'Invalid email format.':
              e.code==='auth/too-many-requests'?'Too many attempts. Try again later.':e.message;
    err.textContent=msg;
  }
}

async function doForgotPassword(){
  const email=document.getElementById('loginEmail').value.trim();
  const succ=document.getElementById('loginSuccess');
  const err=document.getElementById('loginError');
  err.textContent='';succ.textContent='';
  if(!email){err.textContent='Enter your email first, then click Forgot password.';return;}
  try{
    await firebase.auth().sendPasswordResetEmail(email);
    succ.textContent='Password reset email sent. Check your inbox.';
  }catch(e){err.textContent=e.code==='auth/user-not-found'?'No account with that email.':e.message;}
}

function doLogout(){
  firebase.auth().signOut();
}

// Moved off the primary status bar into Settings (R2): it used to sit on the
// bottom bar one thumb-width from Settings itself and eject straight to
// Safari with zero confirmation -- easy to hit by mistake, high context loss.
function openKidsMode(){
  // R13.5: defense in depth -- every native entry point to this is hidden
  // (LandingLogin.jsx, the Settings section above), but refuse here too in
  // case anything else ever calls it directly. kids.html isn't built to run
  // inside a chrome-less native WKWebView; window.open('_blank') itself
  // behaves inconsistently there too, unlike a real browser tab.
  if(document.body.classList.contains('capacitor-native')){
    if(typeof toast==='function')toast('Kids Mode isn\'t available in the app -- open centerpost.app/kids.html in a browser instead.');
    return;
  }
  if(currentUser){
    try{
      localStorage.setItem('_kidsParentUid',currentUser.uid);
      localStorage.setItem('_kidsParentEmail',currentUser.email||'');
    }catch(e){}
  }
  window.open('https://centerpost.app/kids.html','_blank');
}

// -- Self-serve data export + account deletion (Settings > Account & data) --
// Export runs fully client-side: the signed-in user already has read access
// to everything under users/{uid}. If data ever nests deeper than
// users/{uid}/data/*, extend the gather step below.
async function exportMyData(){
  if(!currentUser){toast('Sign in first');return;}
  toast('Preparing your export…');
  try{
    var profileSnap=await db.collection('users').doc(currentUser.uid).get();
    var dataSnap=await db.collection('users').doc(currentUser.uid).collection('data').get();
    var docs={};
    dataSnap.forEach(function(d){docs[d.id]=d.data();});
    // dashboard state is stored as a JSON string — inline it so the export is readable
    if(docs.dashboard&&typeof docs.dashboard.state==='string'){
      try{docs.dashboard.state=JSON.parse(docs.dashboard.state);}catch(e){}
      // journal/journalPin are LEGACY pre-encryption fields (see
      // _journalSetupAndMigrate / the Phase-3 scrub, ~line 7213-7316) — on any
      // account that hasn't been scrubbed yet, journalPin can still hold a raw
      // PIN and journal can still hold plaintext entries. Never let a
      // user-downloadable export carry either; the encrypted journal doc
      // (ciphertext, safe) is already included separately in `docs`.
      if(docs.dashboard.state&&typeof docs.dashboard.state==='object'){
        delete docs.dashboard.state.journalPin;
        delete docs.dashboard.state.journal;
      }
    }
    var bundle={
      exportedAt:new Date().toISOString(),
      account:{uid:currentUser.uid,email:currentUser.email,created:currentUser.metadata&&currentUser.metadata.creationTime},
      profile:profileSnap.exists?profileSnap.data():null,
      data:docs
    };
    var blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
    var u=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=u;a.download='centerpost-export-'+todayStr()+'.json';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(u);
    toast('✓ Export downloaded');
  }catch(e){toast('Export failed: '+(e.message||e.code||'unknown error'));}
}

// Deletion is done server-side (the Worker verifies the ID token, then
// removes Firestore docs, Jarvis KV entries, and the Auth user) because the
// client cannot clean up Worker KV and shouldn't rely on rules allowing
// self-delete. Until the Worker endpoint exists, a 404 is handled kindly.
function deleteMyAccount(){
  if(!currentUser){toast('Sign in first');return;}
  _confirm('Permanently delete your Centerpost account? All of your data — dashboard, journals, kids mode, everything — will be erased.',function(){
    _confirm('Last check: this really is forever and cannot be undone. Export your data first if you want a copy. Delete everything?',_performAccountDeletion,{destructive:true,confirmText:'Yes, delete everything',icon:'ti-trash-x'});
  },{destructive:true,confirmText:'Delete my account'});
}
// Clear every device-local trace of this account. Deleting the cloud copy is
// not enough on its own: the local mirrors below are what the app reads FIRST
// on load, and reconcileLifetimeCounter takes a max, so a surviving local
// cache would resurrect the "deleted" data and push it straight back up.
function _wipeLocalAccountData(uid){
  try{
    localStorage.removeItem('prodDash_'+uid);
    localStorage.removeItem('cpCompletedTasks_'+uid);
    localStorage.removeItem('cpRemindersArchive_'+uid);
    localStorage.removeItem('cpNotifFired');
    localStorage.removeItem('devTierOverride');
    // Legacy pre-multi-account key. The migration that read it is gone, but a
    // long-lived browser can still be holding a full copy of the data.
    localStorage.removeItem('prodDash_v1');
  }catch(e){}
}

async function _performAccountDeletion(){
  var uid=currentUser?currentUser.uid:null;
  if(!uid){toast('Sign in first');return;}
  try{
    var idToken=await currentUser.getIdToken(true);
    var resp=await fetch(JARVIS_PROXY_URL+'/account/delete',{
      method:'POST',
      headers:{'Authorization':'Bearer '+idToken,'Content-Type':'application/json'},
      // The route needs no input, but the worker parses a JSON body before it
      // routes -- an empty body would 400 before deletion was ever reached.
      body:'{}'
    });
    var payload=null;
    try{payload=await resp.json();}catch(e){}
    if(!resp.ok){
      var msg=(payload&&payload.error)?payload.error
        :'Deletion failed (HTTP '+resp.status+'). Your account was not changed.';
      toast(msg);
      return;
    }
    // Stop every writer BEFORE clearing, so nothing recreates what we erase.
    _accountDeleted=true;
    _wipeLocalAccountData(uid);
    toast('Account deleted. Take care of yourself out there.');
    setTimeout(function(){firebase.auth().signOut();},1500);
  }catch(e){toast('Deletion failed: '+(e.message||'unknown error')+'. Your account was not changed.');}
}

function showApp(){
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('appWrap').classList.add('visible');
  document.getElementById('userEmail').textContent=currentUser.email;
  // Close any open auth overlays
  var ov=document.getElementById('signinOverlay');
  if(ov)ov.classList.remove('open');
  var ov2=document.getElementById('signupOverlay');
  if(ov2)ov2.classList.remove('open');
}
function hideApp(){
  document.getElementById('loginGate').classList.remove('hidden');
  document.getElementById('appWrap').classList.remove('visible');
  document.getElementById('loginError').textContent='';
  document.getElementById('loginSuccess').textContent='';
  document.getElementById('loginEmail').value='';
  document.getElementById('loginPass').value='';
  // Close auth overlays so the landing page is visible after logout
  var ov=document.getElementById('signinOverlay');
  if(ov)ov.classList.remove('open');
  var ov2=document.getElementById('signupOverlay');
  if(ov2)ov2.classList.remove('open');
  showLoginForm();
  // Scroll landing back to top
  var gate=document.getElementById('loginGate');
  if(gate)gate.scrollTop=0;
}

// === Sign-in panel reveal (landing page → login modal) ===
function showSigninPanel(){
  var ov=document.getElementById('signinOverlay');
  if(!ov)return;
  ov.classList.add('open');
  // Clear any prior errors and focus email
  document.getElementById('loginError').textContent='';
  document.getElementById('loginSuccess').textContent='';
  showLoginForm();
  setTimeout(function(){
    var em=document.getElementById('loginEmail');
    if(em)em.focus();
  },120);
}
function hideSigninPanel(){
  var ov=document.getElementById('signinOverlay');
  if(ov)ov.classList.remove('open');
}

// === Sign-up panel ===
function showSignupPanel(){
  var ov=document.getElementById('signupOverlay');
  if(!ov)return;
  ov.classList.add('open');
  document.getElementById('signupError').textContent='';
  document.getElementById('signupSuccess').textContent='';
  setTimeout(function(){
    var em=document.getElementById('signupEmail');
    if(em)em.focus();
  },120);
}
function hideSignupPanel(){
  var ov=document.getElementById('signupOverlay');
  if(ov)ov.classList.remove('open');
}

async function doSignup(){
  var inviteEl=document.getElementById('signupInvite');
  var emailEl=document.getElementById('signupEmail');
  var passEl=document.getElementById('signupPass');
  var passConfirmEl=document.getElementById('signupPassConfirm');
  var errEl=document.getElementById('signupError');
  var successEl=document.getElementById('signupSuccess');
  var btn=document.getElementById('signupBtn');
  errEl.textContent='';
  successEl.textContent='';
  var inviteCode=(inviteEl.value||'').trim().toUpperCase();
  var email=(emailEl.value||'').trim();
  var pass=passEl.value||'';
  var passConfirm=passConfirmEl.value||'';

  // -- Client-side validation --
  if(!inviteCode){errEl.textContent='Beta invite code is required.';return;}
  if(!email||email.indexOf('@')===-1){errEl.textContent='Please enter a valid email address.';return;}
  if(pass.length<6){errEl.textContent='Password must be at least 6 characters.';return;}
  if(pass!==passConfirm){errEl.textContent='Passwords do not match.';return;}
  if(!firebaseReady){errEl.textContent='Service unavailable. Please try again.';return;}

  btn.disabled=true;
  btn.textContent='Checking invite code...';

  try {
    // -- Step 1: Validate invite code BEFORE creating account --
    var codeRef=db.collection('inviteCodes').doc(inviteCode);
    var codeSnap=await codeRef.get();
    if(!codeSnap.exists){
      errEl.textContent='That invite code isn\'t valid. Double-check the spelling.';
      btn.disabled=false;btn.textContent='Create Account';return;
    }
    var codeData=codeSnap.data();
    if(codeData.disabled){
      errEl.textContent='That invite code has been disabled. Ask the developer for a new one.';
      btn.disabled=false;btn.textContent='Create Account';return;
    }
    if(codeData.expiresAt){
      var exp=codeData.expiresAt.toDate?codeData.expiresAt.toDate():new Date(codeData.expiresAt);
      if(exp.getTime()<Date.now()){
        errEl.textContent='That invite code has expired. Ask the developer for a new one.';
        btn.disabled=false;btn.textContent='Create Account';return;
      }
    }
    var usedSoFar=codeData.used||0;
    if(codeData.maxUses && usedSoFar>=codeData.maxUses){
      errEl.textContent='That invite code has reached its usage limit. Ask the developer for a new one.';
      btn.disabled=false;btn.textContent='Create Account';return;
    }

    // -- Step 2: Create user account --
    btn.textContent='Creating account...';
    var cred=await firebase.auth().createUserWithEmailAndPassword(email,pass);

    // -- Step 3: Record code usage (best-effort; doesn't block account if it fails) --
    try {
      await codeRef.update({
        used:firebase.firestore.FieldValue.increment(1),
        lastUsedAt:firebase.firestore.FieldValue.serverTimestamp(),
        lastUsedBy:cred.user.uid,
        lastUsedEmail:email
      });
    } catch(e){console.warn('[signup] code increment failed (non-fatal)',e);}

    // -- Step 4: Create the user's profile. admin:false / disabled:false
    //    are REQUIRED by the Firestore `create` rule (see firestore.rules);
    //    a merge-tag write that omitted them was silently denied, leaving
    //    invite-code users with no profile doc. invitedWith aids admin audit.
    try {
      await db.collection('users').doc(cred.user.uid).set({
        email:email,admin:false,disabled:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        lastActive:firebase.firestore.FieldValue.serverTimestamp(),
        invitedWith:inviteCode
      });
    } catch(e){console.error('[signup] profile create failed',e);}

    // onAuthStateChanged fires next, takes user to dashboard
    successEl.textContent='Account created! Loading your workspace...';
    passEl.value='';
    passConfirmEl.value='';
    inviteEl.value='';
  } catch(e) {
    var msg=e.message||'Sign-up failed. Please try again.';
    var code=e.code||'';
    if(code==='auth/email-already-in-use')msg='That email is already registered. Try signing in instead.';
    else if(code==='auth/invalid-email')msg='Please enter a valid email address.';
    else if(code==='auth/weak-password')msg='Password is too weak. Use at least 6 characters.';
    else if(code==='auth/operation-not-allowed')msg='Account creation is currently disabled. Contact the developer.';
    else if(code==='auth/network-request-failed')msg='Network error. Check your connection and try again.';
    else if(code==='permission-denied')msg='Couldn\'t verify the invite code. Make sure Firestore rules allow reading inviteCodes (see admin panel).';
    errEl.textContent=msg;
  } finally {
    btn.disabled=false;
    btn.textContent='Create Account';
  }
}
// Close sign-in/sign-up modal on Escape
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    var ov=document.getElementById('signinOverlay');
    if(ov && ov.classList.contains('open'))hideSigninPanel();
    var ov2=document.getElementById('signupOverlay');
    if(ov2 && ov2.classList.contains('open'))hideSignupPanel();
    // R11: Escape skips the onboarding tour, same as its Skip button.
    var ov3=document.getElementById('onboardingTourModal');
    if(ov3 && ov3.classList.contains('open'))onboardingSkip();
  }
});

function initAuthListener(){
  // Make persistence explicit: user stays signed in across browser sessions
  // until they click Sign Out. This is the Firebase default, but locking
  // it in defensively prevents future SDK changes from regressing it.
  try {
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch(e){console.warn('[auth] setPersistence skipped',e);}
  firebase.auth().onAuthStateChanged(async function(user){
    if(user){
      currentUser=user;
      try{
        const prof=await db.collection('users').doc(user.uid).get();
        if(prof.exists){
          userProfile=prof.data();
          if(userProfile.disabled){
            firebase.auth().signOut();
            document.getElementById('loginError').textContent='Account disabled. Contact your admin.';
            return;
          }
          isAdmin=userProfile.admin===true;
          // Read account tier for Legacy assignment
          window._profileAccountTier=userProfile.accountTier||null;
          db.collection('users').doc(user.uid).update({lastActive:firebase.firestore.FieldValue.serverTimestamp()}).catch(function(){});
        }else{
          // Profile missing -- create one (non-admin by default)
          await db.collection('users').doc(user.uid).set({
            email:user.email,admin:false,disabled:false,
            createdAt:firebase.firestore.FieldValue.serverTimestamp(),
            lastActive:firebase.firestore.FieldValue.serverTimestamp()
          });
          userProfile={email:user.email,admin:false,disabled:false};
          isAdmin=false;
        }
      }catch(e){console.log('Profile load error:',e);}
      showApp();
      if(typeof initApp==='function') await initApp();
    }else{
      currentUser=null;isAdmin=false;userProfile=null;
      hideApp();
      // R6: native has no marketing page to tap "Sign In" from anymore, so
      // open the card automatically instead of leaving a bare brand screen.
      if(document.body.classList.contains('capacitor-native')&&typeof showSigninPanel==='function'){
        showSigninPanel();
      }
    }
  });
}

// ── SCRIPT 2: FIREBASE INIT ─────────────────────────────────────
// ===========================================
// FIREBASE CONFIG
// ===========================================
var firebaseConfig = CENTERPOST_FIREBASE_CONFIG;
var db = null;
var firebaseReady = false;
try {
  if(typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY"){
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
    console.log('Firebase connected');
    if(typeof initAuthListener==='function')initAuthListener();
  }else{
    console.log('Firebase not configured -- using local storage only');
  }
} catch(e) { console.log('Firebase init error (app will work offline):', e); }

// ── SCRIPT 3: APP LOGIC ─────────────────────────────────────────
// STATE
var state={projects:[],reminders:[],thoughts:[],notes:[],moodLog:[],tasks:[],completedTasks:[],completedTasksLifetime:undefined,completedProjectSubtasksLifetime:undefined,remindersArchive:[],remindersArchiveLifetime:undefined,journal:[],journalPin:'',workoutLog:{},completedWorkouts:[],focusPlaylistId:null,points:{current:0,monthKey:'',lastTier:'bronze',totalsByDay:{},lastLoginDate:'',lifetimeTotal:0,monthlyTotals:{}},panelUseLog:{},usageMonthlyTotals:{},routines:{morning:[{id:'m1',name:'Hydrate \u2014 glass of water',done:false},{id:'m2',name:"Review today's calendar",done:false},{id:'m3',name:'Pick top 3 priorities',done:false},{id:'m4',name:'Quick workspace tidy',done:false}],evening:[{id:'e1',name:'Review what got done today',done:false},{id:'e2',name:"Brain dump tomorrow's thoughts",done:false},{id:'e3',name:"Set out tomorrow's essentials",done:false},{id:'e4',name:'Wind-down activity',done:false}],custom:[]},currentRoutineTab:'morning',energy:null,mood:null,panelOrder:['projects','reminders','time','tasklist','notes','brain','routines','wellness','decision','admin'],panelsLocked:true,lastRoutineReset:null,visiblePanels:{},knownPanels:[]};

// SYNC STATUS
function setSyncStatus(status,label){const el=document.getElementById('syncStatus');if(!el)return;el.className='sync-status '+status;var icon={synced:'✓',syncing:'↻',error:'⚠',offline:'•'}[status]||'•';el.innerHTML='<span class="sync-icon">'+icon+'</span> '+label;}

// TOMBSTONES -- deletion and completion are durable, synced FACTS, never the
// mere absence of an item from an array (absence can't survive a merge). Every
// genuine delete/complete records the id here; reconcileSync (public/sync-merge.js)
// unions these across devices and drops any resurrected id. Do NOT call this for
// a MOVE that reuses an id (e.g. task -> subtask) -- that id is still live.
function _tombstone(id){
  if(id==null)return;
  if(!state._tombstones)state._tombstones={};
  if(!state._tombstones[id])state._tombstones[id]=new Date().toISOString();
}
// Removing a COMPLETED-history entry (removeCompleted) is also a durable fact,
// but it needs its OWN map: an archive record reuses the id of the live item
// it archived, and that id is already in _tombstones from the completion --
// so reusing _tombstones couldn't represent "clear this history entry", and
// worse, the completed-* arrays are filtered by _archiveTombstones precisely
// so a completion doesn't wipe its own archive record. See public/sync-merge.js.
function _archiveTombstone(id){
  if(id==null)return;
  if(!state._archiveTombstones)state._archiveTombstones={};
  if(!state._archiveTombstones[id])state._archiveTombstones[id]=new Date().toISOString();
}

// SAVE -- writes to localStorage + Firestore (per-user)
var saveTimer=null;
var _saveSkipCount=0; // consecutive writes skipped because cloud was newer (E-1)

// E-2: size telemetry -- warn well before Firestore's 1 MiB doc limit.
// Saves are never blocked; this only makes growth visible in time to act.
var _sizeWarnedDate=null;
var _lastStateKB=0;
function _checkStateSize(bytes){
  _lastStateKB=Math.round(bytes/1024);
  if(_lastStateKB>950){
    if(typeof toast==='function')toast('⚠ Storage almost full ('+_lastStateKB+' KB of 1024) — export your data and archive old items');
  }else if(_lastStateKB>700){
    var t=todayStr();
    if(_sizeWarnedDate!==t){
      _sizeWarnedDate=t;
      if(typeof toast==='function')toast('⚠ Dashboard data is getting large ('+_lastStateKB+' KB of a 1024 KB limit)');
    }
  }
}

// Set once an account deletion succeeds. Everything that could write state
// back out -- save(), the completed-tasks doc, the watch/widget mirrors --
// checks this first, so an in-flight timer or a 60s tick can't recreate the
// data we just erased in the window before signOut() completes.
var _accountDeleted=false;

function save(){
  if(_accountDeleted)return;
  const uid=currentUser?currentUser.uid:'local';
  // E-1: stamp the state itself so every copy carries the time of the last
  // edit it reflects -- this is what the write guard below compares.
  state._updatedAt=Date.now();
  // R5: checkins/moodLog persist through their own doc + save functions now
  // (_saveCheckinsDoc/_saveMoodLogDoc) -- excluded here so they stop riding
  // along in every dashboard-doc write. JSON.stringify drops keys whose
  // value is undefined, so this omits them without deep-cloning the rest.
  const blob=JSON.stringify(Object.assign({},state,{checkins:undefined,moodLog:undefined,completedTasks:undefined,completedTasksLifetime:undefined,completedProjectSubtasksLifetime:undefined,remindersArchive:undefined,remindersArchiveLifetime:undefined}));
  try{localStorage.setItem('prodDash_'+uid,blob);}catch(e){}
  _checkStateSize(blob.length);
  if(typeof pushWatchSnapshot==='function')pushWatchSnapshot(); // mirror to Apple Watch
  if(typeof _notifScheduleNativeSync==='function')_notifScheduleNativeSync(); // reschedule iOS local notifications (debounced)
  if(typeof _updateWidgetSnapshot==='function')_updateWidgetSnapshot(); // R10: refresh the home-screen widget's data
  if(!firebaseReady||!db||!currentUser)return;
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{
      setSyncStatus('syncing','Syncing...');
      const ref=db.collection('users').doc(currentUser.uid).collection('data').doc('dashboard');
      // E-1: sync-by-timestamp. A stale tab (e.g. waking from sleep with an
      // old queued save) must not overwrite newer cloud data. Inside a
      // transaction: if the cloud blob is newer than the state this tab holds,
      // skip the write -- the realtime listener merges the newer doc, then the
      // retry below pushes the merged result.
      const wrote=await db.runTransaction(async tx=>{
        const doc=await tx.get(ref);
        if(doc.exists&&doc.data().state){
          try{
            const cloudTs=JSON.parse(doc.data().state)._updatedAt||0;
            if(cloudTs>state._updatedAt)return false;
          }catch(e){}
        }
        tx.set(ref,{state:blob,updated:firebase.firestore.FieldValue.serverTimestamp()});
        return true;
      });
      if(wrote){
        _saveSkipCount=0;
        // Keep the storage warning visible in the pill once it's serious
        if(_lastStateKB>950)setSyncStatus('error','Synced -- storage almost full');
        else setSyncStatus('synced','Synced');
      }else if(++_saveSkipCount<=3){
        setSyncStatus('syncing','Merging newer cloud data...');
        setTimeout(save,2500); // listener merge lands first, then re-push
      }else{
        _saveSkipCount=0;
        setSyncStatus('error','Sync conflict -- refresh this tab');
      }
    }catch(e){
      // E-2: Firestore hard-rejects docs over 1 MiB -- surface that clearly
      // instead of a generic sync error (local copy is still saved above).
      var _m=(e&&e.message)||'';
      if(_m.indexOf('exceeds the maximum')>=0||_m.indexOf('maximum allowed size')>=0||_m.indexOf('too large')>=0){
        setSyncStatus('error','Storage full -- not syncing');
        if(typeof toast==='function')toast('⚠ Sync failed: data exceeds the cloud size limit. Export your data and archive old items.');
      }else{
        console.log('Firestore save error:',e);setSyncStatus('error','Sync error');
      }
    }
  },1000);
}

// LOAD -- tries Firestore first, then localStorage (per-user)
async function load(){
  const uid=currentUser?currentUser.uid:'local';
  _loadAxisProfile(); // independent of dashboard state; fire-and-forget, ready well before chat is opened
  // Always load localStorage as baseline
  try{const s=localStorage.getItem('prodDash_'+uid);if(s){const p=JSON.parse(s);state={...state,...p};}}catch(e){}
  // Try Firestore
  if(firebaseReady&&db&&currentUser){
    try{
      setSyncStatus('syncing','Loading...');
      const doc=await db.collection('users').doc(currentUser.uid).collection('data').doc('dashboard').get();
      if(doc.exists&&doc.data().state){
        const cloud=JSON.parse(doc.data().state);
        if(cloud.projects||cloud.reminders||cloud.notes){
          // -- SAFE MERGE ----------------------------------------------------
          // Spread cloud over local, then reconcile.
          var today=todayStr();
          var merged=Object.assign({},state,cloud);
          // Protect lastRoutineReset -- never let cloud roll it back to a past date
          if(state.lastRoutineReset===today){merged.lastRoutineReset=today;}
          if(state.lastRoutineReset===today&&cloud.lastRoutineReset!==today){
            merged.routines=state.routines;merged.lastRoutineReset=today;
          }
          // Tombstone-aware reconciliation of the item arrays. Replaces the old
          // "keep whichever side has more items" heuristic, which could never
          // represent a deletion -- a shorter post-delete array always lost to a
          // stale client still holding the longer pre-delete copy, resurrecting
          // dismissed reminders and un-completing tasks. reconcileSync unions by
          // id (so concurrent adds both survive) and drops any id in the merged
          // tombstone map. See public/sync-merge.js.
          if(typeof reconcileSync==='function'){
            Object.assign(merged,reconcileSync(state,cloud));
          }
          // journal/moodLog aren't id-tombstoned here (encrypted / own-doc);
          // keep the longer copy so a partial cloud doc can't wipe them.
          ['journal','moodLog'].forEach(function(key){
            var localArr=state[key], cloudArr=cloud[key];
            if(Array.isArray(localArr) && (!Array.isArray(cloudArr) || localArr.length>cloudArr.length)){
              merged[key]=localArr;
            }
          });
          state=merged;
        }
        setSyncStatus('synced','Synced');
      }else{
        // First time or migration -- also check old shared location
        var _migratedFromShared=false;
        try{
          const oldDoc=await db.collection('dashboards').doc('957d52c2f223567f9e37f9121bb24f81ba916e3d1549fdfbc18c08cf7fe43c9f').get();
          if(oldDoc.exists&&oldDoc.data().state){
            const oldData=JSON.parse(oldDoc.data().state);
            if(oldData.projects||oldData.reminders){state={...state,...oldData};console.log('Migrated from old shared Firestore');_migratedFromShared=true;}
          }
        }catch(me){console.log('Migration check:',me);}
        // R11: only a genuinely first-ever account (nothing adopted from the
        // old shared doc either) gets the onboarding tour -- a legacy account
        // migrating formats is not a new user.
        if(!_migratedFromShared)state.onboardingSeen=false;
        // R2b: a genuinely new account lands on the Today view. A migrated
        // (existing) account is left undefined here and defaults to
        // 'everything' below, so nothing changes for it.
        if(!_migratedFromShared)state.viewMode='today';
        // Push to new location. R5: exclude checkins/moodLog, same as save() --
        // they're adopted into their own docs by _loadCheckinsDoc/_loadMoodLogDoc
        // right after load() returns.
        await db.collection('users').doc(currentUser.uid).collection('data').doc('dashboard').set({state:JSON.stringify(Object.assign({},state,{checkins:undefined,moodLog:undefined,completedTasks:undefined,completedTasksLifetime:undefined,completedProjectSubtasksLifetime:undefined,remindersArchive:undefined,remindersArchiveLifetime:undefined})),updated:firebase.firestore.FieldValue.serverTimestamp()});
        setSyncStatus('synced','Synced');
      }
    }catch(e){console.log('Firestore load error:',e);setSyncStatus('error','Offline');}
  }else{
    setSyncStatus('offline','Local only');
  }
  // Ensure data integrity
  if(!state._updatedAt)state._updatedAt=0; // pre-E-1 states have no stamp
  // E-2: prune timeline blocks older than 14 days. The Timeline UI only
  // renders today/tomorrow, so past-dated blocks are unreachable dead weight
  // (their Google Calendar events, if any, live on in Google untouched).
  if(Array.isArray(state.tlBlocks)){
    var _tlCut=new Date();_tlCut.setDate(_tlCut.getDate()-14);
    var _tlCutKey=_dayKey(_tlCut);
    state.tlBlocks=state.tlBlocks.filter(function(b){return b&&(!b.date||b.date>=_tlCutKey);});
  }
  if(!state.routines)state.routines={morning:[],evening:[],custom:[]};
  if(!state._tombstones)state._tombstones={};
  if(!state._archiveTombstones)state._archiveTombstones={};
  if(!state.reminders)state.reminders=[];
  if(!state.notes)state.notes=[];if(!state.moodLog)state.moodLog=[];if(!state.tasks)state.tasks=[];if(!state.visiblePanels)state.visiblePanels={};if(!state.knownPanels)state.knownPanels=[];
  if(!state.panelUseLog)state.panelUseLog={};if(!state.usageMonthlyTotals)state.usageMonthlyTotals={};if(!state.points.monthlyTotals)state.points.monthlyTotals={};
  // Backfill any note missing a created timestamp (older notes) so sorts can't crash
  state.notes.forEach(function(n){if(n&&!n.created)n.created=n.updated||n.date||new Date(0).toISOString();});
  if(!state.journal)state.journal=[];if(!state.journalPin)state.journalPin='';
  if(typeof _ensureNotifPrefs==='function')_ensureNotifPrefs();
  if(!state.workoutLog)state.workoutLog={};
  if(!state.checkins)state.checkins=[];
  // R12: default 'full' preserves today's behavior for existing users --
  // the Grounding Toolkit keeps auto-showing on low mood/energy unless they
  // opt into 'lean'.
  if(state.supportLevel!=='full'&&state.supportLevel!=='lean')state.supportLevel='full';
  // R11: undefined means an existing/pre-onboarding-feature account -- treat
  // as already onboarded. Only the first-time branch above ever sets this to
  // false explicitly.
  if(state.onboardingSeen===undefined)state.onboardingSeen=true;
  // R2b: existing accounts (viewMode undefined) default to 'everything' so the
  // dashboard they know is unchanged; new accounts were set to 'today' above.
  if(state.viewMode!=='today'&&state.viewMode!=='everything')state.viewMode='everything';
  // One-time nudge toward Today for existing accounts only (new accounts land
  // there directly and never see this). Mirrors initPanelVisibility's one-time
  // "New panels available!" toast; deferred so it fires after the app paints.
  if(!state.viewModeIntroShown&&state.viewMode==='everything'){
    state.viewModeIntroShown=true;
    setTimeout(function(){if(typeof toast==='function')toast('New: try the Today view →');},1800);
  }
  // R15: haptic breathing defaults ON (a gentle enhancement, no permission
  // needed); Apple Health logging defaults OFF (writing health data requires an
  // explicit permission prompt, so it's strictly opt-in).
  if(state.breathHaptics===undefined)state.breathHaptics=true;
  if(state.healthKitMindful===undefined)state.healthKitMindful=false;
  // R16 Phase A: daily routine-completion snapshots (captured in
  // checkDailyRoutineReset, right before each day's checkmarks are wiped) so a
  // week of consistency can be shown in the Weekly Review.
  if(!state.routineHistory)state.routineHistory=[];
  if(!state.completedTasks)state.completedTasks=[];
  if(!state.remindersArchive)state.remindersArchive=[];
  if(!state.completedWorkouts)state.completedWorkouts=[];
  // E-2: one-time migrate -- lifetime count seeded from the uncapped array
  if(state.workoutLifetimeCount===undefined)state.workoutLifetimeCount=state.completedWorkouts.length;
  if(state.focusPlaylistId===undefined)state.focusPlaylistId=null;
  if(!state.points)state.points={current:0,monthKey:'',lastTier:'bronze',totalsByDay:{},lastLoginDate:'',lifetimeTotal:0};
  if(!state.points.totalsByDay)state.points.totalsByDay={};
  if(state.points.lifetimeTotal===undefined)state.points.lifetimeTotal=0;
  if(state.hidePoints===undefined)state.hidePoints=false;
  if(!state.wellnessNotes)state.wellnessNotes={};
  if(!state.completedProjects)state.completedProjects=[];
  if(!state.gcal)state.gcal={connected:false,email:null,calendarId:null,autoPush:false,showExternal:true,lastPush:null,lastPull:null,pulledEvents:[]};
  if(!state.panelOrder)state.panelOrder=['projects','reminders','time','tasklist','notes','brain','routines','wellness','decision','admin'];
  // Remove legacy 'energy' panel id from any saved order
  state.panelOrder=state.panelOrder.filter(id=>id!=='energy');
  if(!state.panelOrder.includes('wellness'))state.panelOrder.splice(state.panelOrder.indexOf('time')+1,0,'wellness');
  if(!state.panelOrder.includes('notes'))state.panelOrder.splice(state.panelOrder.indexOf('routines'),0,'notes');
  // Migrate to new 3-column layout order if still using old order
  const oldOrder='projects,reminders,brain,time';
  if(state.panelOrder.join(',').startsWith(oldOrder)){state.panelOrder=['projects','reminders','time','tasklist','notes','brain','routines','wellness','decision','admin'];}
  if(!state.panelOrder.includes('admin'))state.panelOrder.push('admin');
  if(!state.panelOrder.includes('tasklist'))state.panelOrder.splice(state.panelOrder.indexOf('time')+1,0,'tasklist');
  state.projects.forEach(p=>{if(!p.subtasks)p.subtasks=[];if(p.expanded===undefined)p.expanded=true;});
  // Ensure every panel already in panelOrder is "known" -- prevents initPanelVisibility
  // from treating previously-seen panels as new and hiding them on refresh
  if(!state.knownPanels) state.knownPanels=[];
  state.panelOrder.forEach(id=>{if(!state.knownPanels.includes(id))state.knownPanels.push(id);});
}

// REAL-TIME LISTENER -- syncs changes from other devices (per-user)
var unsubscribe=null;
function startRealtimeSync(){
  if(!firebaseReady||!db||!currentUser)return;
  if(unsubscribe)unsubscribe();
  unsubscribe=db.collection('users').doc(currentUser.uid).collection('data').doc('dashboard').onSnapshot(doc=>{
    if(!doc.exists||!doc.data().state)return;
    try{
      const cloud=JSON.parse(doc.data().state);

      // -- Preserve gcalEventIds from in-memory state -----------------------
      // onSnapshot can fire with stale Firestore data while a gcalPushAll is
      // in progress (debounced save hasn't committed yet). Without this guard,
      // the cloud spread overwrites newly-set gcalEventIds → next push creates
      // duplicate calendar events instead of updating existing ones.
      var _gcalLocal={};
      (state.tasks||[]).forEach(function(t){if(t.gcalEventId)_gcalLocal['t:'+t.id]=t.gcalEventId;});
      (state.projects||[]).forEach(function(p){
        if(p.gcalEventId)_gcalLocal['p:'+p.id]=p.gcalEventId;
        (p.subtasks||[]).forEach(function(s){if(s.gcalEventId)_gcalLocal['s:'+s.id]=s.gcalEventId;});
      });
      (state.reminders||[]).forEach(function(r){if(r.gcalEventId)_gcalLocal['r:'+r.id]=r.gcalEventId;});
      (state.tlBlocks||[]).forEach(function(b){if(b.gcalEventId)_gcalLocal['b:'+b.id]=b.gcalEventId;});

      // Preserve panel visibility/knownPanels from current session -- these were
      // already initialized by initPanelVisibility() and must not be overwritten
      // by an onSnapshot firing with stale Firestore data (race condition fix)
      const localVP=state.visiblePanels;
      const localKP=state.knownPanels;
      const localFocusMode=state.focusMode;
      // currentRoutineTab is per-device VIEW state (which routine tab you're
      // looking at), not shared data. switchRoutineTab() doesn't even persist
      // it, so the cloud copy lags behind your actual selection -- letting the
      // spread below overwrite it reverts the routines panel to whatever tab was
      // last saved ('morning' by default) on every snapshot echo, including one
      // delivered when the app returns to the foreground (e.g. after a
      // screenshot). Preserve the local selection, same as focusMode.
      const localRoutineTab=state.currentRoutineTab;
      const localSavedVis=state._savedPanelVis;
      const localRoutineReset=state.lastRoutineReset;
      const localRoutines=JSON.parse(JSON.stringify(state.routines||{}));
      const localUpdatedAt=state._updatedAt||0;
      const localPoints=JSON.parse(JSON.stringify(state.points||{}));
      const _reconLocal=state; // pre-spread local snapshot for reconciliation
      // checkins/moodLog/completedTasks all live in their own docs now (R3/R5/F3)
      // and were never in SYNC_ACTIVE_ARRAYS/SYNC_UNION_ARRAYS -- reconcileSync
      // (below) has never touched any of them, so the plain spread is the ONLY
      // thing that can affect them here. A stale-build device can still write the
      // old blob shape (any of these fields included), so a snapshot echoing that
      // stale write would otherwise clobber the current in-memory value until the
      // next own-doc reconcile (_loadCheckinsDoc/_loadMoodLogDoc/
      // _loadCompletedTasksDoc). Strip all three so each own-doc load stays the
      // single source of truth, matching how save()/load() already exclude them
      // from the blob on the write side. The lifetime counters live in the
      // completedTasks own-doc too (loaded by _loadCompletedTasksDoc), so they
      // get the same treatment -- otherwise a stale blob echo resets them and
      // the badge falls back to the 100-capped array length.
      delete cloud.checkins;
      delete cloud.moodLog;
      delete cloud.completedTasks;
      delete cloud.completedTasksLifetime;
      delete cloud.completedProjectSubtasksLifetime;
      // R7 archive: remindersArchive is an own-doc too (_loadRemindersArchiveDoc)
      delete cloud.remindersArchive;
      delete cloud.remindersArchiveLifetime;
      state={...state,...cloud};
      // Tombstone-aware reconciliation (mirrors load()): a stale snapshot must
      // not resurrect a locally-deleted/completed item, and concurrent adds on
      // both sides must both survive. The plain spread above overwrites arrays
      // wholesale with cloud's; this restores the correctly reconciled arrays +
      // merged tombstone map. See public/sync-merge.js.
      if(typeof reconcileSync==='function'){
        Object.assign(state,reconcileSync(_reconLocal,cloud));
      }
      // E-1: keep the newest stamp -- local unsaved edits may be newer than
      // the cloud doc this snapshot delivered.
      state._updatedAt=Math.max(localUpdatedAt,cloud._updatedAt||0);
      // Points: a snapshot older than our last local edit (e.g. it landed
      // before the debounced save() from completing a task committed) would
      // otherwise silently revert state.points to the pre-increment cloud
      // value -- and the next save() would persist that reverted total.
      if(localUpdatedAt>(cloud._updatedAt||0))state.points=localPoints;
      state.focusMode=localFocusMode;
      state.currentRoutineTab=localRoutineTab;
      if(localSavedVis)state._savedPanelVis=localSavedVis;else delete state._savedPanelVis;
      state.visiblePanels=Object.assign({},cloud.visiblePanels||{},localVP);
      state.knownPanels=localKP&&localKP.length>=(cloud.knownPanels||[]).length?localKP:cloud.knownPanels||localKP;
      var _today=todayStr();
      if(localRoutineReset===_today&&cloud.lastRoutineReset!==_today){
        state.routines=localRoutines;state.lastRoutineReset=_today;
      }
      ['morning','evening','custom'].forEach(function(tab){
        var local=localRoutines[tab]||[];
        var merged=state.routines[tab]||[];
        local.forEach(function(lr){
          if(lr.done){
            var mr=merged.find(function(x){return x.id===lr.id;});
            if(mr)mr.done=true;
          }
        });
      });

      // Re-apply any gcalEventIds that were wiped by the cloud spread
      (state.tasks||[]).forEach(function(t){if(!t.gcalEventId&&_gcalLocal['t:'+t.id])t.gcalEventId=_gcalLocal['t:'+t.id];});
      (state.projects||[]).forEach(function(p){
        if(!p.gcalEventId&&_gcalLocal['p:'+p.id])p.gcalEventId=_gcalLocal['p:'+p.id];
        (p.subtasks||[]).forEach(function(s){if(!s.gcalEventId&&_gcalLocal['s:'+s.id])s.gcalEventId=_gcalLocal['s:'+s.id];});
      });
      (state.reminders||[]).forEach(function(r){if(!r.gcalEventId&&_gcalLocal['r:'+r.id])r.gcalEventId=_gcalLocal['r:'+r.id];});
      (state.tlBlocks||[]).forEach(function(b){if(!b.gcalEventId&&_gcalLocal['b:'+b.id])b.gcalEventId=_gcalLocal['b:'+b.id];});

      renderProjects();renderReminders();renderThoughts();renderNotes();renderRoutines();renderTaskList();renderTimeline();
      applyPanelVisibility();
      showStateAdvice();updateWellnessVisibility();
      setSyncStatus('synced','Synced');
    }catch(e){console.log('Realtime sync error:',e);}
  },err=>{console.log('Snapshot error:',err);setSyncStatus('error','Sync lost');});
}

// =======================================
// PANEL VISIBILITY / CUSTOMIZATION
// =======================================
var ALL_PANELS=[
  {id:'projects',icon:'\u{1F4C2}',name:'Projects',desc:'Track projects with subtasks and due dates'},
  {id:'reminders',icon:'\u{1F514}',name:'Reminders',desc:'Date and time-based reminders'},
  {id:'time',icon:'\u{1F9F0}',name:'Tool Kit',desc:'Breathwork, timer, energy/mood, and journal launcher'},
  {id:'tasklist',icon:'\u{1F4CB}',name:'Task List',desc:'Unified view of all tasks sorted by due date or time'},
  {id:'notes',icon:'\u{1F4DD}',name:'Notes',desc:'Labeled notes with project tags'},
  {id:'brain',icon:'\u{1F9E0}',name:'Brain Dump',desc:'Capture fleeting thoughts'},
  {id:'routines',icon:'\u{1F501}',name:'Routines',desc:'Morning, evening, and custom checklists'},
  {id:'wellness',icon:'\u{1F9FA}',name:'Grounding Toolkit',desc:'Breathing and grounding techniques (auto-shows when needed)'},
  {id:'decision',icon:'\u{1F9ED}',name:'Stuck? Start Here',desc:'Decision aid prompts'}
];
function getPanelIds(){return ALL_PANELS.map(p=>p.id);}

var FOCUS_DEFAULT_PANELS=['brain','projects'];
function initPanelVisibility(){
  const ids=getPanelIds();
  if(!state.knownPanels)state.knownPanels=[];
  var isFirstRun=state.knownPanels.length===0;
  if(isFirstRun){
    ids.forEach(id=>{
      state.visiblePanels[id]=FOCUS_DEFAULT_PANELS.includes(id);
    });
  }else{
    ids.forEach(id=>{
      if(state.visiblePanels[id]===undefined) state.visiblePanels[id]=true;
    });
    const newPanels=ids.filter(id=>!state.knownPanels.includes(id));
    if(newPanels.length>0){
      newPanels.forEach(id=>{state.visiblePanels[id]=false;});
      toast('New panels available! Tap \u2699 Settings to activate.');
    }
  }
  state.knownPanels=ids.slice();
  save();
}

function applyPanelVisibility(){
  document.querySelectorAll('.panel[data-panel]').forEach(p=>{
    const id=p.dataset.panel;
    if(id==='wellness')return; // wellness has its own logic
    if(id==='admin'){p.classList.add('hidden-panel');return;}
    if(state.visiblePanels[id]===false){
      p.classList.add('user-hidden');
    }else{
      p.classList.remove('user-hidden');
    }
  });
  // Rebuild mobile home tiles to reflect visibility changes
  if(_isMobile())buildMobileHome();
  updateFocusBanner();
}

// F6: hide-toggle only -- points still accrue in the background either way
// (addPoints itself is untouched); this purely controls whether the Tool Kit
// badge and its two celebratory surfaces (floater, tier-up fireworks) show.
function setHidePoints(on){
  state.hidePoints=!!on;
  save();
  applyPointsVisibility();
  _renderPointsSettings();
}
function applyPointsVisibility(){
  var wrap=document.getElementById('pointsWrap');
  if(wrap)wrap.style.display=state.hidePoints?'none':'';
}
function _renderPointsSettings(){
  var el=document.getElementById('pointsSettings');
  if(!el)return;
  var on=!!state.hidePoints;
  el.innerHTML='<div class="panel-toggle"><span class="pt-icon">🏅</span><div class="pt-info"><div class="pt-name">Hide points</div><div class="pt-desc">Presence points still accrue in the background — this only hides them from view.</div></div><label class="toggle-switch"><input type="checkbox" '+(on?'checked':'')+' onchange="setHidePoints(this.checked)"><span class="toggle-slider"></span></label></div>';
}

function openCustomize(){
  const el=document.getElementById('panelToggles');
  const ids=getPanelIds();
  const newPanels=ids.filter(id=>state.knownPanels&&!state.knownPanels.includes(id));
  el.innerHTML=ALL_PANELS.filter(p=>{
    if(p.id==='wellness')return false;
    return true;
  }).map(p=>{
    const checked=state.visiblePanels[p.id]!==false;
    const isNew=newPanels.includes(p.id);
    return '<div class="panel-toggle"><span class="pt-icon">'+p.icon+'</span><div class="pt-info"><div class="pt-name">'+p.name+(isNew?'<span class="pt-new">NEW</span>':'')+'</div><div class="pt-desc">'+p.desc+'</div></div><label class="toggle-switch"><input type="checkbox" '+(checked?'checked':'')+' onchange="togglePanelVisibility(\''+p.id+'\',this.checked)"><span class="toggle-slider"></span></label></div>';
  }).join('');
  if(isAdmin){
    el.innerHTML+='<div class="panel-toggle" style="border-top:1px solid var(--border);margin-top:8px;padding-top:12px;cursor:pointer;" onclick="closeCustomize();openAdminRoute()"><span class="pt-icon">\u{1F6E1}</span><div class="pt-info"><div class="pt-name">Admin Panel</div><div class="pt-desc">User management, invite codes (opens full page)</div></div><span style="color:var(--text-dim);font-size:18px;">→</span></div>';
  }
  document.getElementById('customizeOverlay').classList.add('show');
  // F11: Settings is a full-screen sheet at z-300, BELOW the z-900 capture FAB
  // and Axis orb -- observed during the original review with the pencil sitting
  // on top of the "Evening routine nudge" row. Same immersive rule as the
  // breathwork/journal/guided-timer surfaces.
  document.body.classList.add('cp-immersive');
  var _cb=document.getElementById('custBuild');
  // R12 (F21): CENTERPOST_WEB_BUILD is the git short hash actually bundled
  // into this build (stamped into config.js at build time, same value as
  // sw.js's CACHE_VERSION) -- lets Joe tell from the app itself whether a
  // native build is running a stale www/ resync, no separate check needed.
  if(_cb)_cb.textContent='Build '+APP_BUILD+' · Web '+(typeof CENTERPOST_WEB_BUILD!=='undefined'?CENTERPOST_WEB_BUILD:'dev');
  // R13.5: Kids Mode uncoupled from the native app entirely -- kids.html is a
  // standalone PWA that was never built to run inside a chrome-less native
  // WKWebView (loads with no way back out). Untouched on web.
  var _kmSection=document.getElementById('kidsModeSettingsSection');
  if(_kmSection)_kmSection.style.display=(document.body.classList.contains('capacitor-native'))?'none':'';
  _renderDevSwitcherInSettings();
  _renderAxisProfileForm();
  _renderSupportLevelSettings();
  if(typeof _renderNotifSettings==='function')_renderNotifSettings();
  if(typeof _renderBreathHealthSettings==='function')_renderBreathHealthSettings();
  if(typeof _renderPointsSettings==='function')_renderPointsSettings();
}

function closeCustomize(){
  document.getElementById('customizeOverlay').classList.remove('show');
  document.body.classList.remove('cp-immersive');
}

function togglePanelVisibility(id,visible){
  state.visiblePanels[id]=visible;
  save();
  applyPanelVisibility();
}

// R12: Support Level -- 'full' (default) keeps the Grounding Toolkit
// auto-showing on low mood/energy as it always has; 'lean' suppresses that
// auto-popup. Nothing else changes -- HALT+/Breathwork/Wellness stay exactly
// as reachable in the Tool Kit either way. Separate from the older, unrelated
// state.focusMode session toggle (the "☀ Focus" button), which just narrows
// which panels are visible and is deliberately never cross-device synced.
function setSupportLevel(v){
  if(v!=='full'&&v!=='lean')return;
  state.supportLevel=v;
  save();
  updateWellnessVisibility();
  _renderSupportLevelSettings();
}
function _renderSupportLevelSettings(){
  var el=document.getElementById('supportLevelSettings');
  if(!el)return;
  var cur=state.supportLevel||'full';
  el.innerHTML=
    '<div class="support-level-row">'
    +'<button class="support-level-btn'+(cur==='full'?' active':'')+'" onclick="setSupportLevel(\'full\')">'
    +'<strong>Full</strong><span>Grounding Toolkit surfaces on its own when mood or energy is low</span></button>'
    +'<button class="support-level-btn'+(cur==='lean'?' active':'')+'" onclick="setSupportLevel(\'lean\')">'
    +'<strong>Lean</strong><span>Nothing pops up uninvited &mdash; open it yourself when you want it</span></button>'
    +'</div>';
}

// R15: Breathwork & Health settings. Haptics default on (no permission needed);
// Apple Health is native-only and strictly opt-in (flipping it on prompts iOS
// for write permission via _healthRequestAuth).
function setBreathHaptics(on){
  state.breathHaptics=!!on;
  save();
  _renderBreathHealthSettings();
}
function setHealthKitMindful(on){
  on=!!on;
  state.healthKitMindful=on;
  save();
  // Turning ON asks the OS for permission now, tied to this explicit user action.
  // The toggle reflects intent immediately; if the user denies at the OS sheet,
  // the completion write simply no-ops natively -- no error surfaced here.
  if(on&&typeof _healthRequestAuth==='function')_healthRequestAuth();
  _renderBreathHealthSettings();
}
function _renderBreathHealthSettings(){
  var el=document.getElementById('breathHealthSettings');
  if(!el)return;
  var native=(typeof _notifNative==='function')&&!!_notifNative();
  var html='';
  var hOn=state.breathHaptics!==false;
  var hDesc=native
    ? 'Feel each inhale and exhale as a gentle haptic swell during breathwork.'
    : 'Gentle haptics during breathwork &mdash; on the iPhone app (and Android with vibration).';
  html+='<div class="panel-toggle"><span class="pt-icon">🫧</span><div class="pt-info"><div class="pt-name">Haptic breathing</div><div class="pt-desc">'+hDesc+'</div></div><label class="toggle-switch"><input type="checkbox" '+(hOn?'checked':'')+' onchange="setBreathHaptics(this.checked)"><span class="toggle-slider"></span></label></div>';
  var mOn=!!state.healthKitMindful;
  var mDesc=native
    ? 'Save completed breathwork sessions to Apple Health as Mindful Minutes.'
    : 'Log breathwork to Apple Health &mdash; available in the iPhone app.';
  html+='<div class="panel-toggle"><span class="pt-icon">❤️</span><div class="pt-info"><div class="pt-name">Log to Apple Health</div><div class="pt-desc">'+mDesc+'</div></div><label class="toggle-switch"><input type="checkbox" '+(mOn?'checked':'')+' '+(native?'':'disabled')+' onchange="setHealthKitMindful(this.checked)"><span class="toggle-slider"></span></label></div>';
  el.innerHTML=html;
}

function updateFocusBanner(){
  var banner=document.getElementById('focusBanner');
  if(!banner)return;
  if(!state.focusMode){banner.style.display='none';return;}
  banner.style.display='block';
  var taskEl=document.getElementById('focusBannerTask');
  var labelEl=document.getElementById('focusBannerLabel');
  if(!taskEl)return;
  var now=new Date();
  var nowMin=now.getHours()*60+now.getMinutes();
  var blocks=(typeof _tlCollectBlocks==='function')?_tlCollectBlocks(todayStr()):[];
  blocks.sort(function(a,b){return a.startMin-b.startMin;});
  var current=null,next=null;
  for(var i=0;i<blocks.length;i++){
    var b=blocks[i];
    if(nowMin>=b.startMin&&nowMin<b.startMin+b.durMin){current=b;next=blocks[i+1]||null;break;}
    if(b.startMin>nowMin){next=b;break;}
  }
  if(current){
    if(labelEl)labelEl.textContent='NOW';
    var endH=Math.floor((current.startMin+current.durMin)/60),endM=(current.startMin+current.durMin)%60;
    var endStr=(endH>12?endH-12:endH)+':'+(endM<10?'0':'')+endM+(endH>=12?'p':'a');
    var proj=_tlBlockProject(current);
    taskEl.innerHTML=esc(current.name)+'<span class="focus-time">until '+endStr+'</span>'+(proj?'<span class="focus-proj">'+esc(proj)+'</span>':'');
  }else if(next){
    if(labelEl)labelEl.textContent='UP NEXT';
    var sh=Math.floor(next.startMin/60),sm=next.startMin%60;
    var startStr=(sh>12?sh-12:sh)+':'+(sm<10?'0':'')+sm+(sh>=12?'p':'a');
    var proj=_tlBlockProject(next);
    taskEl.innerHTML=esc(next.name)+'<span class="focus-time">at '+startStr+'</span>'+(proj?'<span class="focus-proj">'+esc(proj)+'</span>':'');
  }else{
    if(labelEl)labelEl.textContent='ALL DONE';
    taskEl.innerHTML='No more blocks scheduled today.';
  }
}
function _tlBlockProject(block){
  if(!block.projectId)return '';
  var p=(state.projects||[]).find(function(pr){return pr.id===block.projectId;});
  return p?p.name:'';
}
function toggleFocusMode(){
  if(state.focusMode){
    state.focusMode=false;
    if(state._savedPanelVis){
      state.visiblePanels=JSON.parse(JSON.stringify(state._savedPanelVis));
      delete state._savedPanelVis;
    }else{
      getPanelIds().concat(['timeline']).forEach(function(id){state.visiblePanels[id]=true;});
    }
    toast('Full dashboard restored');
  }else{
    state._savedPanelVis=JSON.parse(JSON.stringify(state.visiblePanels));
    state.focusMode=true;
    getPanelIds().concat(['timeline']).forEach(function(id){
      state.visiblePanels[id]=FOCUS_DEFAULT_PANELS.includes(id);
    });
    toast('Focus mode — brain dump & projects');
  }
  save();applyPanelVisibility();updateFocusModeUI();
}
function updateFocusModeUI(){
  var btn=document.getElementById('focusModeBtn');
  if(!btn)return;
  if(state.focusMode){btn.textContent='☀ Focus';btn.classList.add('focus-active');}
  else{btn.textContent='⊞ All Panels';btn.classList.remove('focus-active');}
}
function resetPanelVisibility(){
  state.focusMode=false;
  getPanelIds().forEach(id=>{state.visiblePanels[id]=true;});
  delete state._savedPanelVis;
  save();
  applyPanelVisibility();
  updateFocusModeUI();
  openCustomize();
  toast('All panels visible');
}

// LOCK / UNLOCK
function toggleLock(){state.panelsLocked=!state.panelsLocked;save();updateLockUI();}
function updateLockUI(){const btn=document.getElementById('lockBtn');if(state.panelsLocked){btn.innerHTML='\u{1F512} Locked';btn.classList.remove('unlocked');document.body.classList.remove('unlocked');}else{btn.innerHTML='\u{1F513} Unlocked';btn.classList.add('unlocked');document.body.classList.add('unlocked');}document.querySelectorAll('.panel').forEach(p=>{p.draggable=!state.panelsLocked;});refreshEditables();}

// INLINE EDITING - only works when unlocked
//
// The inline-edit layer (makeEditable/makeDateClickable/makeTimeClickable/
// refreshEditables + the _isEditingInPanel guard and defer mechanism) now lives
// in public/inline-edit.js so it can be regression-tested (test/inline-edit.
// test.mjs). It loads as a plain <script> before legacy.js, so those symbols
// are globals here. We only inject the panel->render-fn map it defers on, since
// those render functions live in this file. The guard rebuilds every panel's
// innerHTML on each Firestore snapshot echo; without deferring while an edit is
// focused, a snapshot landing mid-edit would destroy the focused element.
_registerPanelRenderers({
  projectList:function(){renderProjects();},
  reminderList:function(){renderReminders();},
  taskListItems:function(){renderTaskList();},
  thoughtChips:function(){renderThoughts();},
  todayView:function(){renderTodayView();}
});

// DRAG & DROP
var dragSrcPanel=null;
function applyPanelOrder(){const dash=document.getElementById('dashboard');const panels={};dash.querySelectorAll('.panel').forEach(p=>{panels[p.dataset.panel]=p;});state.panelOrder.forEach(id=>{if(panels[id])dash.appendChild(panels[id]);});}
function initDragDrop(){document.querySelectorAll('.panel').forEach(panel=>{panel.addEventListener('dragstart',e=>{if(state.panelsLocked){e.preventDefault();return;}dragSrcPanel=panel;panel.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',panel.dataset.panel);});panel.addEventListener('dragend',()=>{panel.classList.remove('dragging');document.querySelectorAll('.panel').forEach(p=>p.classList.remove('drag-over'));dragSrcPanel=null;});panel.addEventListener('dragover',e=>{if(state.panelsLocked)return;e.preventDefault();e.dataTransfer.dropEffect='move';if(panel!==dragSrcPanel)panel.classList.add('drag-over');});panel.addEventListener('dragleave',()=>{panel.classList.remove('drag-over');});panel.addEventListener('drop',e=>{e.preventDefault();panel.classList.remove('drag-over');if(!dragSrcPanel||dragSrcPanel===panel)return;const dash=document.getElementById('dashboard');const all=[...dash.querySelectorAll('.panel')];const fi=all.indexOf(dragSrcPanel);const ti=all.indexOf(panel);if(fi<ti)panel.after(dragSrcPanel);else panel.before(dragSrcPanel);state.panelOrder=[...dash.querySelectorAll('.panel')].map(p=>p.dataset.panel);save();toast('Panel moved');});});}

// CLOCK
function updateClock(){const now=new Date();const t=now.toLocaleTimeString('en-US',{hour12:true});const clk=document.getElementById('clock');if(clk)clk.textContent=t;const cd=document.getElementById('clockDate');if(cd)cd.textContent=now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});const mhc=document.getElementById('mobileHomeClock');if(mhc)mhc.textContent=t;var timeStr=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});if(!timerRunning&&timerLeft===timerTotal){['headerTimerLabel','pdHeaderTimerLabel'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=timeStr;});}}

// TIMER (with soft alarm)
// =======================================
// FOCUS TIMER (inline button, no modal)
// =======================================
var TIMER_PRESETS=[
  {label:'25 min',minutes:25,icon:'🎯'},
  {label:'15 min',minutes:15,icon:'⚡'},
  {label:'5 min break',minutes:5,icon:'☕'},
  {label:'45 min',minutes:45,icon:'🔥'},
  {label:'60 min',minutes:60,icon:'⏳'}
];
var timerTotal=25*60,timerLeft=25*60,timerInterval=null,timerRunning=false;
var timerAlarmTimeout=null,audioCtx=null;
var alarmOscillators=[],alarmGain=null,alarmPlaying=false;
var timerEndAt=null;
var timerCurrentPresetIdx=0; // default 25 min

// R7: focus-timer background completion alert. On native (iOS) we schedule a
// one-shot local notification for timerEndAt through the bridge, so it fires
// even when the app is backgrounded/locked -- and iOS forwards it to the watch.
// On web there's no reliable ahead-of-time scheduling without push infra, so
// the completion notification is fired at completion time (updateTimerDisplay)
// while the tab/SW is alive. Deliberately IGNORES quiet hours: a timer the user
// started and is actively waiting on should always alert (unlike routine nudges).
var TIMER_NOTIF_TITLE='⏱ Focus session complete';
var TIMER_NOTIF_BODY='Nice work — take a break or start the next block.';
function _timerNotifStart(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h&&timerEndAt){
    try{h.postMessage({action:'scheduleTimer',at:timerEndAt,title:TIMER_NOTIF_TITLE,body:TIMER_NOTIF_BODY});}catch(e){}
  }
}
function _timerNotifCancel(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h){try{h.postMessage({action:'cancelTimer'});}catch(e){}}
}

// R7 tier 2: Lock Screen / Dynamic Island live countdown (native only, no-op
// on web). Read-only -- ends on pause/reset/complete rather than showing a
// "paused" state, since the Live Activity can't drive the in-app JS timer
// while backgrounded anyway (see LiveActivityManager.swift). A fresh start
// after pause just begins a new Activity.
function _liveActivityStart(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h&&timerEndAt){
    try{h.postMessage({action:'startLiveActivity',at:timerEndAt,label:TIMER_PRESETS[timerCurrentPresetIdx].label});}catch(e){}
  }
}
function _liveActivityEnd(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h){try{h.postMessage({action:'endLiveActivity'});}catch(e){}}
}

function _timerFmtLabel(){
  if(!timerRunning&&timerLeft===timerTotal){
    // Idle -- just show preset name
    return TIMER_PRESETS[timerCurrentPresetIdx].label;
  }
  // Counting down -- show MM:SS
  var m=Math.floor(timerLeft/60),s=timerLeft%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

function updateTimerDisplay(){
  var m=Math.floor(timerLeft/60),s=timerLeft%60;
  var countdownStr=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  ['headerTimerLabel','pdHeaderTimerLabel'].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    if(timerRunning||timerLeft<timerTotal){
      el.textContent=countdownStr;
      el.classList.toggle('ht-running',timerRunning);
    }else{
      el.classList.remove('ht-running');
    }
  });

  if(timerLeft<=0&&timerRunning){
    timerRunning=false;clearInterval(timerInterval);timerInterval=null;timerEndAt=null;
    ['headerTimerLabel','pdHeaderTimerLabel'].forEach(function(id){
      var el=document.getElementById(id);if(el){el.textContent='Done!';el.classList.remove('ht-running');}
    });
    _liveActivityEnd();
    playAlarm();
    toast('⏰ Focus session complete! +3 Presence');
    addPoints('timer',document.getElementById('headerTimerBtn'));
    // Web (non-native): fire the completion notification now so a backgrounded
    // desktop tab still alerts. Native already scheduled one via the bridge and
    // its JS is suspended in the background, so we skip the web path there.
    if((typeof _notifNative!=='function'||!_notifNative())&&typeof _notifShow==='function'){
      _notifShow(TIMER_NOTIF_TITLE,TIMER_NOTIF_BODY,'focus-timer');
    }
    if(typeof pushWatchSnapshot==='function')pushWatchSnapshot();
    timerAlarmTimeout=setTimeout(function(){
      stopAlarm();
      timerLeft=timerTotal;
      updateTimerDisplay();
    },12000);
  }
}

function _tickTimer(){
  if(timerEndAt!==null){
    timerLeft=Math.max(0,Math.round((timerEndAt-Date.now())/1000));
  }
  updateTimerDisplay();
}

function startTimer(){
  if(timerRunning)return;
  // Guard: never start an already-expired timer -- endAt would be in the past,
  // instantly tripping the completion branch (looks like "starts then resets").
  // Reachable when the watch triggers a start while the phone timer sits at 0.
  if(timerLeft<=0)timerLeft=timerTotal;
  _trackEvent('tool_use','focus_timer','Focus Timer');
  stopAlarm();
  timerRunning=true;
  timerEndAt=Date.now()+(timerLeft*1000);
  timerInterval=setInterval(_tickTimer,500);
  _timerNotifStart();
  _liveActivityStart();
  updateTimerDisplay();
  if(typeof pushWatchSnapshot==='function')pushWatchSnapshot();
}

function pauseTimer(){
  if(!timerRunning)return;
  if(timerEndAt!==null)timerLeft=Math.max(0,Math.round((timerEndAt-Date.now())/1000));
  timerRunning=false;timerEndAt=null;
  clearInterval(timerInterval);timerInterval=null;
  _timerNotifCancel();
  _liveActivityEnd();
  updateTimerDisplay();
  if(typeof pushWatchSnapshot==='function')pushWatchSnapshot();
}

function resetTimer(){
  pauseTimer();stopAlarm();
  timerLeft=timerTotal;timerEndAt=null;
  _timerNotifCancel();
  _liveActivityEnd();
  updateTimerDisplay();
  if(typeof pushWatchSnapshot==='function')pushWatchSnapshot();
}

function headerTimerClick(){
  var dd=document.getElementById('headerTimerDropdown');
  if(dd&&dd.style.display==='block'){dd.style.display='none';}
  var dd2=document.getElementById('pdHeaderTimerDropdown');
  if(dd2&&dd2.style.display==='block'){dd2.style.display='none';}
  if(timerRunning){pauseTimer();}
  else if(timerLeft<timerTotal){startTimer();}
}

function headerTimerToggleDropdown(variant){
  var ddId=variant==='pd'?'pdHeaderTimerDropdown':'headerTimerDropdown';
  var dd=document.getElementById(ddId);
  if(!dd)return;
  if(dd.style.display==='block'){dd.style.display='none';return;}
  var html=TIMER_PRESETS.map(function(p,i){
    return '<div class="ht-dropdown-item" onclick="event.stopPropagation();headerTimerSelectPreset('+i+')">'
      +'<span class="ht-dd-icon">'+p.icon+'</span>'
      +'<span class="ht-dd-name">'+p.label+'</span>'
      +'</div>';
  }).join('');
  if(timerRunning||timerLeft<timerTotal){
    html+='<div class="ht-dropdown-item ht-dd-reset" onclick="event.stopPropagation();headerTimerReset()"><span class="ht-dd-icon">↺</span><span class="ht-dd-name">Reset</span></div>';
  }
  dd.innerHTML=html;
  dd.style.display='block';
  setTimeout(function(){
    var handler=function(e){
      if(!dd.contains(e.target)&&!e.target.classList.contains('header-timer-arrow')){
        dd.style.display='none';
        document.removeEventListener('click',handler);
      }
    };
    document.addEventListener('click',handler);
  },10);
}

function headerTimerSelectPreset(idx){
  document.querySelectorAll('.header-timer-dropdown').forEach(function(d){d.style.display='none';});
  timerCurrentPresetIdx=idx;
  pauseTimer();stopAlarm();
  timerTotal=TIMER_PRESETS[idx].minutes*60;
  timerLeft=timerTotal;timerEndAt=null;
  updateTimerDisplay();
  startTimer();
}

function headerTimerReset(){
  document.querySelectorAll('.header-timer-dropdown').forEach(function(d){d.style.display='none';});
  resetTimer();
}

function timerHandleClick(){headerTimerClick();}
function timerToggleDropdown(){headerTimerToggleDropdown();}
function timerSelectPreset(idx){headerTimerSelectPreset(idx);}
function openTimerModal(){headerTimerToggleDropdown();}
function closeTimerModal(){}

// Reconcile after sleep/tab switch
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&timerRunning&&timerEndAt!==null){
    timerLeft=Math.max(0,Math.round((timerEndAt-Date.now())/1000));
    updateTimerDisplay();
  }
});

// SOFT ALARM (Web Audio)
function playAlarm(){
  if(alarmPlaying)return;
  try{
    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    alarmPlaying=true;
    alarmGain=audioCtx.createGain();alarmGain.gain.value=0;alarmGain.connect(audioCtx.destination);
    function chime(freq,st,dur){var osc=audioCtx.createOscillator(),env=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;osc.connect(env);env.connect(alarmGain);env.gain.setValueAtTime(0,st);env.gain.linearRampToValueAtTime(0.12,st+dur*0.3);env.gain.linearRampToValueAtTime(0.08,st+dur*0.7);env.gain.linearRampToValueAtTime(0,st+dur);osc.start(st);osc.stop(st+dur);alarmOscillators.push(osc);}
    alarmGain.gain.setValueAtTime(0,audioCtx.currentTime);alarmGain.gain.linearRampToValueAtTime(0.35,audioCtx.currentTime+0.5);
    var t=audioCtx.currentTime;
    chime(523.25,t,1.2);chime(659.25,t+0.6,1.2);
    chime(523.25,t+3,1.2);chime(659.25,t+3.6,1.2);
    chime(523.25,t+6,1.2);chime(659.25,t+6.6,1.2);chime(783.99,t+7.2,1.8);
    chime(523.25,t+10,2.0);
    setTimeout(function(){stopAlarm();},13000);
  }catch(e){console.log('Alarm error:',e);}
}
function stopAlarm(){
  alarmPlaying=false;clearTimeout(timerAlarmTimeout);
  try{alarmOscillators.forEach(function(o){try{o.stop();}catch(e){}});alarmOscillators=[];
  if(alarmGain)try{alarmGain.gain.setValueAtTime(0,audioCtx.currentTime);}catch(e){}}catch(e){}
}

// PROJECTS
function addProject(){const n=document.getElementById('newProjName').value.trim();if(!n)return;state.projects.push({id:'p'+Date.now(),name:n,due:document.getElementById('newProjDue').value,expanded:true,subtasks:[]});document.getElementById('newProjName').value='';document.getElementById('newProjDue').value='';save();renderProjects();renderTaskList();_trackEvent('tool_use','add_project','Add Project');}
function deleteProject(id){_confirm('Delete project and all subtasks?',function(){state.projects=state.projects.filter(p=>p.id!==id);save();renderProjects();renderTaskList();},{destructive:true,confirmText:'Delete'});}
function toggleProjectExpand(id){
  const p=state.projects.find(p=>p.id===id);
  if(!p)return;
  p.expanded=!p.expanded;
  // SURGICAL: just toggle the class on the existing DOM element instead of full re-render.
  // Full re-render was resetting overlay scroll position and causing the expanded
  // content to appear off-screen. This avoids the issue entirely.
  // We still find the project card via its onclick attribute (matches the project id).
  var allCards=document.querySelectorAll('.project-card');
  var found=false;
  allCards.forEach(function(card){
    var hdr=card.querySelector('.proj-header');
    if(hdr&&hdr.getAttribute('onclick')&&hdr.getAttribute('onclick').indexOf("'"+id+"'")>=0){
      var area=card.querySelector('.subtask-area');
      var arrow=card.querySelector('.proj-expand');
      if(area)area.classList.toggle('open',p.expanded);
      if(arrow)arrow.classList.toggle('open',p.expanded);
      found=true;
    }
  });
  // Persist to storage; if for some reason the card wasn't found in DOM, fall back to full re-render
  save();
  if(!found)renderProjects();
}

// Per-project "completed folder" expand state (memory only, doesn't persist)
var _projCompletedOpen={};
// Global "Completed Projects" section toggle (memory only)
var _completedProjectsOpen=false;

function markProjectComplete(pid,btnEl){
  var p=state.projects.find(function(pr){return pr.id===pid;});
  if(!p)return;
  
  // Always confirm before archiving
  var activeCount=p.subtasks.length;
  var msg;
  if(activeCount>0){
    msg='"'+p.name+'" still has '+activeCount+' active '+(activeCount===1?'task':'tasks')+'.\n\nMark project complete?';
  }else{
    msg='Mark "'+p.name+'" complete?';
  }
  _confirm(msg,function(){
  // Count completed tasks for this project (for the archive stats)
  var completedCount=(state.completedTasks||[]).filter(function(ct){
    return ct.projectId===p.id||(ct.projectIds&&ct.projectIds.indexOf(p.id)>=0)||(!ct.projectId&&ct.projectName===p.name);
  }).length;
  var noteCount=(state.notes||[]).filter(function(n){return (n.projectIds&&n.projectIds.indexOf(p.id)>=0)||n.projectId===p.id;}).length;
  
  // Archive
  if(!state.completedProjects)state.completedProjects=[];
  state.completedProjects.unshift({
    id:p.id,name:p.name,due:p.due||'',
    completedTaskCount:completedCount,
    activeTaskCountAtArchive:activeCount,
    noteCount:noteCount,
    archivedAt:new Date().toISOString(),
    subtasks:p.subtasks.slice() // preserve any unfinished subtasks for restore
  });
  
  // Clear any subtasks that were still pending (they go away with the project)
  // Notes/reminders stay; their projectId reference will become orphaned but still searchable
  
  // Remove from active projects
  state.projects=state.projects.filter(function(pr){return pr.id!==pid;});
  
  // Award points
  addPoints('project',btnEl);
  
  save();
  renderProjects();
  renderTaskList();
  renderNotes();
  renderReminders();
  toast('\u2713 Project archived');
  },{confirmText:'Mark Complete',icon:'ti-circle-check'});
}

function restoreProject(pid){
  var arch=(state.completedProjects||[]).find(function(cp){return cp.id===pid;});
  if(!arch)return;
  _confirm('Restore "'+arch.name+'" to active projects?',function(){
  // Restore as active project
  state.projects.push({
    id:arch.id,name:arch.name,due:arch.due||'',
    expanded:false,
    subtasks:arch.subtasks||[]
  });
  state.completedProjects=state.completedProjects.filter(function(cp){return cp.id!==pid;});
  save();
  renderProjects();
  renderTaskList();
  toast('Project restored');
  },{confirmText:'Restore',icon:'ti-archive'});
}

function purgeCompletedProject(pid){
  var arch=(state.completedProjects||[]).find(function(cp){return cp.id===pid;});
  if(!arch)return;
  _confirm('Permanently delete "'+arch.name+'" from the archive? This cannot be undone.',function(){
  state.completedProjects=state.completedProjects.filter(function(cp){return cp.id!==pid;});
  save();
  renderProjects();
  },{destructive:true,confirmText:'Delete Forever'});
}

function _toggleCompletedProjectsSection(){
  _completedProjectsOpen=!_completedProjectsOpen;
  renderProjects();
}

function _renderCompletedProjectsSection(){
  var arch=state.completedProjects||[];
  if(arch.length===0)return '';
  var html='<div class="completed-projects-section">';
  html+='<div class="completed-projects-toggle'+(_completedProjectsOpen?' open':'')+'" onclick="_toggleCompletedProjectsSection()">'
    +'<span class="cp-arrow">\u25B6</span>'
    +'<span>\u2713 Completed Projects ('+arch.length+')</span>'
    +'</div>';
  html+='<div class="completed-projects-list'+(_completedProjectsOpen?' open':'')+'">';
  arch.forEach(function(cp){
    var when=cp.archivedAt?_wellFormatDate(cp.archivedAt):'';
    var stats=[];
    if(cp.completedTaskCount)stats.push(cp.completedTaskCount+' done');
    if(cp.noteCount)stats.push(cp.noteCount+' note'+(cp.noteCount!==1?'s':''));
    if(when)stats.push('archived '+when);
    html+='<div class="completed-project-card">'
      +'<span class="cp-name">'+esc(cp.name)+'</span>'
      +(stats.length?'<span class="cp-stats">'+stats.join(' \u00b7 ')+'</span>':'')
      +'<span class="cp-action cp-restore" onclick="restoreProject(\''+cp.id+'\')" title="Restore project">\u21BA</span>'
      +'<span class="cp-action cp-purge" onclick="purgeCompletedProject(\''+cp.id+'\')" title="Permanently delete">\u2715</span>'
      +'</div>';
  });
  html+='</div></div>';
  return html;
}

function _renderProjSummary(p,activeTotal,noteCount,remCount,completedItems){
  var compCount=completedItems.length;
  var folderOpen=!!_projCompletedOpen[p.id];
  var html='<div class="proj-summary">';
  html+='<span class="proj-summary-pill">\u{1F4CB} <span class="ps-num">'+activeTotal+'</span> '+(activeTotal===1?'task':'tasks')+'</span>';
  if(compCount>0){
    html+='<span class="proj-summary-pill ps-done'+(folderOpen?' open':'')+'" onclick="event.stopPropagation();_toggleProjCompleted(\''+p.id+'\')">\u2713 <span class="ps-num">'+compCount+'</span> done <span class="ps-arrow">\u25B6</span></span>';
  }else{
    html+='<span class="proj-summary-pill">\u2713 <span class="ps-num">0</span> done</span>';
  }
  html+='<span class="proj-summary-pill">\u{1F4DD} <span class="ps-num">'+noteCount+'</span> '+(noteCount===1?'note':'notes')+'</span>';
  html+='<span class="proj-summary-pill">\u{1F514} <span class="ps-num">'+remCount+'</span> '+(remCount===1?'reminder':'reminders')+'</span>';
  html+='</div>';
  // Completed folder body
  if(compCount>0){
    html+='<div class="proj-completed-folder'+(folderOpen?' open':'')+'" id="proj-comp-'+p.id+'"><div class="proj-completed-list">';
    completedItems.slice(0,30).forEach(function(ct){
      var when=ct.archivedAt?_wellFormatDate(ct.archivedAt):'';
      html+='<div class="proj-completed-item">'
        +'<span style="color:var(--green);">\u2713</span>'
        +'<span class="proj-completed-name">'+esc(ct.name)+'</span>'
        +(when?'<span class="proj-completed-date">'+when+'</span>':'')
        +'</div>';
    });
    if(completedItems.length>30){
      html+='<div class="proj-completed-empty">+ '+(completedItems.length-30)+' older completions</div>';
    }
    html+='</div></div>';
  }
  return html;
}

function _toggleProjCompleted(pid){
  _projCompletedOpen[pid]=!_projCompletedOpen[pid];
  renderProjects();
}
function addSubtask(pid){const ne=document.getElementById('stN_'+pid),de=document.getElementById('stD_'+pid),te=document.getElementById('stT_'+pid);const nm=ne.value.trim();if(!nm)return;const pr=state.projects.find(p=>p.id===pid);if(!pr)return;const q=_applyQuickAdd(nm,{due:de.value},{date:true,time:true,recurrence:true});pr.subtasks.push({id:'st'+Date.now(),name:q.name,due:q.due,priority:'med',timeEst:te?te.value:'',time:q.time||'',done:false,recurrence:q.recurrence});ne.value='';de.value='';save();renderProjects();renderTaskList();}
function toggleSubtask(pid,sid){
  const p=state.projects.find(p=>p.id===pid);
  if(!p)return;
  const s=p.subtasks.find(s=>s.id===sid);
  if(!s)return;
  // Capture source element for popup positioning
  var srcEl=document.querySelector('.st-check[onclick*="'+sid+'"]');
  // Archive completed subtask (single record per group)
  _archiveCompletedTask({
    id:s.id,name:s.name,projectName:p.name,projectId:p.id,
    archivedAt:new Date().toISOString(),source:'project'
  });
  // Remove from this project AND any other project containing a linked sibling.
  // Completion is a durable fact -- tombstone every removed id so a stale device
  // can't re-add the checked item.
  if(s.linkGroupId){
    state.projects.forEach(function(pr){
      pr.subtasks=pr.subtasks.filter(function(x){if(x.linkGroupId===s.linkGroupId){_tombstone(x.id);_tlUnlinkBlocks(x.id);return false;}return true;});
    });
  }else{
    _tombstone(sid);
    _tlUnlinkBlocks(sid);
    p.subtasks=p.subtasks.filter(x=>x.id!==sid);
  }
  // `time` rides along with timeEst -- a recurring 6am workout has to come back
  // at 6am tomorrow, not fall back to the auto-placed slot.
  if(typeof _materializeRecurrence==='function')_materializeRecurrence(s,function(nextDue){
    p.subtasks.push({id:'st'+Date.now()+Math.random().toString(36).slice(2,5),name:s.name,due:nextDue,priority:s.priority,timeEst:s.timeEst||'',time:s.time||'',done:false,recurrence:s.recurrence});
  });
  addPoints('subtask',srcEl);
  save();renderProjects();renderTaskList();
}
function deleteSubtask(pid,sid){_confirm('Delete this subtask?',function(){_tombstone(sid);const p=state.projects.find(p=>p.id===pid);if(p)p.subtasks=p.subtasks.filter(s=>s.id!==sid);save();renderProjects();renderTaskList();},{destructive:true,confirmText:'Delete'});}

function editProjectName(pid,v){if(!v)return;const p=state.projects.find(p=>p.id===pid);if(p)p.name=v;save();}
function editSubtaskName(pid,sid,v){if(!v)return;const p=state.projects.find(p=>p.id===pid);const s=p&&p.subtasks.find(s=>s.id===sid);if(s)s.name=v;save();renderTaskList();}
function editProjectDue(pid,v){const p=state.projects.find(p=>p.id===pid);if(p){p.due=v;save();renderProjects();}}
function editSubtaskDue(pid,sid,v){const p=state.projects.find(p=>p.id===pid);const s=p&&p.subtasks.find(s=>s.id===sid);if(s){s.due=v;save();renderProjects();renderTaskList();var modalOpen=document.getElementById('projDetailModal').classList.contains('open');if(modalOpen)openProjectModal(pid);}}
function editStandaloneTaskName(id,v){if(!v)return;var t=(state.tasks||[]).find(function(x){return x.id===id;});if(t){t.name=v;save();renderTaskList();var modalOpen=document.getElementById('projDetailModal').classList.contains('open');if(modalOpen&&t.projectId)openProjectModal(t.projectId);else if(modalOpen&&t.projectIds&&t.projectIds.length)openProjectModal(t.projectIds[0]);}}
function editStandaloneTaskDue(id,v){var t=(state.tasks||[]).find(function(x){return x.id===id;});if(t){t.due=v;save();renderTaskList();var modalOpen=document.getElementById('projDetailModal').classList.contains('open');if(modalOpen&&t.projectId)openProjectModal(t.projectId);else if(modalOpen&&t.projectIds&&t.projectIds.length)openProjectModal(t.projectIds[0]);}}
function editTaskTimeEst(taskId,source,projectId,val){
  _dateEditActive=null;
  if(source==='standalone'){
    var t=(state.tasks||[]).find(function(x){return x.id===taskId;});
    if(t){t.timeEst=val;save();renderTaskList();}
  }else{
    var p=state.projects.find(function(x){return x.id===projectId;});
    if(p){var s=p.subtasks.find(function(x){return x.id===taskId;});if(s){s.timeEst=val;save();renderProjects();renderTaskList();}}
  }
  _flushPendingPanelRenders();
}
function editTaskProject(taskId,source,oldProjectId,newProjectId){
  _dateEditActive=null;
  if(source==='standalone'){
    var t=(state.tasks||[]).find(function(x){return x.id===taskId;});
    if(!t)return;
    if(newProjectId){
      var p=state.projects.find(function(x){return x.id===newProjectId;});
      if(!p)return;
      p.subtasks.push({id:t.id,name:t.name,due:t.due,priority:t.priority,timeEst:t.timeEst||'',done:t.done});
      state.tasks=state.tasks.filter(function(x){return x.id!==taskId;});
    }else{
      t.projectId='';t.projectIds=[];
    }
  }else{
    var op=state.projects.find(function(x){return x.id===oldProjectId;});
    if(!op)return;
    var si=op.subtasks.findIndex(function(x){return x.id===taskId;});
    if(si<0)return;
    var sub=op.subtasks.splice(si,1)[0];
    if(newProjectId){
      var np=state.projects.find(function(x){return x.id===newProjectId;});
      if(np)np.subtasks.push(sub);
    }else{
      state.tasks.push({id:sub.id,name:sub.name,due:sub.due,priority:sub.priority,timeEst:sub.timeEst||'',projectId:'',projectIds:[],done:sub.done});
    }
  }
  save();renderProjects();renderTaskList();
  _flushPendingPanelRenders();
}
// Shared opener for the tl-inline-picker dropdowns (time/project/repeat).
// Sets _dateEditActive so _isEditingInPanel (public/inline-edit.js) suspends
// a Firestore-echo re-render while the dropdown is open -- without this, the
// snapshot listener rebuilds the row's HTML mid-choice and the dropdown
// vanishes before the user can click an option. Cleared on outside-click
// here, and by each commit function (editTaskTimeEst/editTaskProject/
// editTaskRecurrence) before their own save()+render, since a picked option
// stops propagation and never reaches the outside-click listener below.
function _showInlinePicker(el,itemsHTML){
  var existing=document.querySelector('.tl-inline-picker');
  // Clear the open-marker off whichever badge previously owned the picker,
  // otherwise that badge stays pinned at full opacity after its picker closes.
  if(existing){
    if(existing.parentElement)existing.parentElement.classList.remove('tl-picker-open');
    existing.remove();
  }
  var dd=document.createElement('div');
  dd.className='tl-inline-picker';
  dd.innerHTML=itemsHTML;
  el.style.position='relative';
  el.appendChild(dd);
  // Suppresses .tl-editable-badge:hover{opacity:0.8} while the dropdown is open.
  // The dropdown is a CHILD of the badge, so that hover rule was fading the menu
  // itself -- and on touch the hover state sticks, so it stayed translucent the
  // whole time. See the matching rule in src/app.css.
  el.classList.add('tl-picker-open');
  _dateEditActive=el;
  setTimeout(function(){
    var close=function(e){
      if(!dd.contains(e.target)){
        dd.remove();
        el.classList.remove('tl-picker-open');
        if(_dateEditActive===el)_dateEditActive=null;
        _flushPendingPanelRenders();
        document.removeEventListener('click',close);
      }
    };
    document.addEventListener('click',close);
  },10);
}
function showTaskTimePicker(taskId,source,projectId,el){
  var opts=[{v:'',l:'None'},{v:'30',l:'30m'},{v:'60',l:'1hr'},{v:'90',l:'1.5hr'},{v:'120',l:'2hr'},{v:'180',l:'3hr'},{v:'240',l:'4hr'},{v:'360',l:'6hr'},{v:'480',l:'8hr'},{v:'720',l:'12hr'}];
  var html=opts.map(function(o){return '<div class="tl-pick-item" onclick="event.stopPropagation();editTaskTimeEst(\''+taskId+'\',\''+source+'\',\''+projectId+'\',\''+o.v+'\')">'+o.l+'</div>';}).join('');
  _showInlinePicker(el,html);
}
// Start-time picker -- the counterpart to showTaskTimePicker (which sets the
// DURATION, timeEst). Setting a start time is what makes a task land at a fixed
// spot on the timeline instead of being auto-placed in the first open slot, and
// it survives recurrence, so "workout, 6am, daily" comes back at 6am every day.
// 30-minute granularity: 15 would be ~68 rows in the dropdown, and anything
// finer is what dragging the block is for.
function showTaskStartPicker(taskId,source,projectId,el){
  var opts=[{v:'',l:'Auto (first open slot)'}];
  for(var m=TL_DAY_START_H*60;m<TL_DAY_END_H*60;m+=30){
    var hh=Math.floor(m/60),mm=m%60;
    opts.push({v:(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm,l:_tlFmtTime(m)});
  }
  var html=opts.map(function(o){return '<div class="tl-pick-item" onclick="event.stopPropagation();editTaskStartTime(\''+taskId+'\',\''+source+'\',\''+projectId+'\',\''+o.v+'\')">'+o.l+'</div>';}).join('');
  _showInlinePicker(el,html);
}
function editTaskStartTime(taskId,source,projectId,val){
  _dateEditActive=null;
  var item;
  if(source==='standalone'){
    item=(state.tasks||[]).find(function(x){return x.id===taskId;});
  }else{
    var p=state.projects.find(function(x){return x.id===projectId;});
    item=p&&p.subtasks.find(function(x){return x.id===taskId;});
  }
  if(!item)return;
  item.time=val;
  // A pinned tlBlock (dragged, or scheduled with the clock button) is canonical
  // and would suppress the new time entirely -- clear it so the explicit choice
  // the user just made is the one that shows.
  if(val)_tlUnlinkBlocks(taskId);
  save();
  if(source!=='standalone')renderProjects();
  renderTaskList();
  if(typeof renderTimeline==='function')renderTimeline();
  _flushPendingPanelRenders();
}
var WEEKDAY_NAMES=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function showTaskRepeatPicker(taskId,source,projectId,el){
  var opts=[{v:'',l:'None'},{v:'daily',l:'Daily'}];
  WEEKDAY_NAMES.forEach(function(name,i){opts.push({v:'weekly_'+i,l:'Every '+name});});
  opts.push({v:'monthly',l:'Monthly'});
  var html=opts.map(function(o){return '<div class="tl-pick-item" onclick="event.stopPropagation();editTaskRecurrence(\''+taskId+'\',\''+source+'\',\''+projectId+'\',\''+o.v+'\')">'+o.l+'</div>';}).join('');
  _showInlinePicker(el,html);
}
// Next date on or after dateStr (or today, if omitted/invalid) that falls on weekdayIdx.
function _nextWeekdayOnOrAfter(dateStr,weekdayIdx){
  var base=new Date((dateStr||todayStr())+'T00:00:00');
  if(isNaN(base.getTime()))base=new Date(todayStr()+'T00:00:00');
  base.setDate(base.getDate()+((weekdayIdx-base.getDay()+7)%7));
  return _dayKey(base);
}
function editTaskRecurrence(taskId,source,projectId,val){
  _dateEditActive=null;
  var item;
  if(source==='project'){
    var pr=state.projects.find(function(p){return p.id===projectId;});
    item=pr&&pr.subtasks.find(function(x){return x.id===taskId;});
  }else{
    item=state.tasks.find(function(x){return x.id===taskId;});
  }
  if(!item)return;
  if(!val){
    item.recurrence=null;
  }else if(val.indexOf('weekly_')===0){
    var wd=parseInt(val.slice(7),10);
    item.recurrence={freq:'weekly',interval:1};
    var alreadyOnDay=item.due&&new Date(item.due+'T00:00:00').getDay()===wd;
    if(!alreadyOnDay)item.due=_nextWeekdayOnOrAfter(todayStr(),wd);
  }else{
    item.recurrence={freq:val,interval:1};
    if(!item.due)item.due=todayStr();
  }
  save();renderTaskList();_refreshTodayViewIfVisible();
  _flushPendingPanelRenders();
}
function showTaskProjectPicker(taskId,source,projectId,el){
  var projs=_sortedProjects();
  var html='<div class="tl-pick-item" onclick="event.stopPropagation();editTaskProject(\''+taskId+'\',\''+source+'\',\''+projectId+'\',\'\')">None</div>';
  html+=projs.map(function(p){return '<div class="tl-pick-item'+(p.id===projectId?' tl-pick-current':'')+'" onclick="event.stopPropagation();editTaskProject(\''+taskId+'\',\''+source+'\',\''+projectId+'\',\''+p.id+'\')">'+esc(p.name)+'</div>';}).join('');
  _showInlinePicker(el,html);
}
function editReminderDate(id,v){const r=state.reminders.find(r=>r.id===id);if(r){r.date=v;save();renderReminders();}}
function editReminderTime(id,v){const r=state.reminders.find(r=>r.id===id);if(r){r.time=v;save();renderReminders();}}
// makeDateClickable / makeTimeClickable moved to public/inline-edit.js (globals).

// Helper -- projects sorted A→Z, used everywhere projects are listed
function _sortedProjects(){
  return state.projects.slice().sort(function(a,b){
    return (a.name||'').toLowerCase().localeCompare((b.name||'').toLowerCase());
  });
}

function renderProjects(){
if(_isEditingInPanel('projectList')){_deferPanelRender('projectList');return;}
const el=document.getElementById('projectList');const today=todayStr();

// Detect if we're rendering inside the overlay (panel-tile removed) vs the dashboard tile
var projPanel=document.querySelector('.panel[data-panel="projects"]');
var inOverlay=projPanel&&!projPanel.classList.contains('panel-tile');

// "Show all" toggle -- only applies on the dashboard tile, never in overlay
var upcomingEl=document.getElementById('projUpcomingOnly');
var showAll=!inOverlay&&upcomingEl&&upcomingEl.checked;
// Always sort alphabetically regardless of showAll / overlay mode
var visibleProjects=_sortedProjects();
if(state.projects.length===0){el.innerHTML='<div class="empty-state"><p style="margin:0 0 8px;color:var(--text-dim);">No projects yet. Create one to start tracking goals and subtasks.</p><button class="btn btn-accent btn-sm" onclick="document.getElementById(\'newProjName\').focus()" style="margin:0 auto;display:block;">+ Create your first project</button></div>'+_renderCompletedProjectsSection();document.getElementById('projCount').textContent='0';var emptyProjCompCount=state.completedProjectSubtasksLifetime!==undefined?state.completedProjectSubtasksLifetime:(state.completedTasks||[]).filter(function(t){return t.source==='project';}).length;var emptyProjCompBadge=document.getElementById('projCompletedBadge');if(emptyProjCompBadge){emptyProjCompBadge.textContent='✓ '+emptyProjCompCount;emptyProjCompBadge.title=emptyProjCompCount+' completed subtask'+(emptyProjCompCount!==1?'s':'');emptyProjCompBadge.style.display=emptyProjCompCount>0?'inline-flex':'none';}updateNoteSelectors();if(typeof _updateTileSummaryProjects==='function')_updateTileSummaryProjects();return;}
var pcpEl=document.getElementById('pc_projects');
// Tile mode, unchecked -- blank panel so add-form anchors to bottom
if(!inOverlay&&!showAll){
  el.innerHTML='';
  if(pcpEl){pcpEl.style.flex='none';pcpEl.style.minHeight='0';}
  document.getElementById('projCount').textContent=state.projects.length;
  updateNoteSelectors();
  if(typeof _updateTileSummaryProjects==='function')_updateTileSummaryProjects();
  return;
}
// Checked but no projects exist -- also blank (safety)
if(showAll&&visibleProjects.length===0){el.innerHTML='';if(pcpEl){pcpEl.style.flex='none';pcpEl.style.minHeight='0';}document.getElementById('projCount').textContent=state.projects.length;updateNoteSelectors();if(typeof _updateTileSummaryProjects==='function')_updateTileSummaryProjects();return;}
if(pcpEl){pcpEl.style.flex='';pcpEl.style.minHeight='';}
el.innerHTML=visibleProjects.map(p=>{const total=p.subtasks.length;const sorted=[...p.subtasks].sort((a,b)=>{if(a.due&&b.due)return a.due.localeCompare(b.due);if(a.due)return -1;if(b.due)return 1;return 0;});

// Completed items for this project (by id or fallback to name match for older records)
var projCompletedItems=(state.completedTasks||[]).filter(function(ct){
  if(ct.projectId===p.id)return true;
  if(ct.projectIds&&ct.projectIds.indexOf(p.id)>=0)return true;
  // Backwards-compat: match by projectName for older archived items
  if(!ct.projectId&&ct.projectName===p.name)return true;
  return false;
});

// Linked items for this project
var linkedTasks=(state.tasks||[]).filter(t=>(t.projectIds&&t.projectIds.indexOf(p.id)>=0)||t.projectId===p.id&&!t.done);
var linkedNotes=(state.notes||[]).filter(n=>(n.projectIds&&n.projectIds.indexOf(p.id)>=0)||n.projectId===p.id);
var linkedReminders=(state.reminders||[]).filter(r=>(r.projectIds&&r.projectIds.indexOf(p.id)>=0)||r.projectId===p.id);
var linkedHtml='';
if(linkedTasks.length||linkedNotes.length||linkedReminders.length){
  linkedHtml='<div class="proj-linked">';
  if(linkedTasks.length){
    linkedHtml+='<div class="proj-linked-group"><span class="proj-linked-label">&#128203; Tasks</span>';
    linkedHtml+=linkedTasks.map(t=>'<div class="proj-linked-item">'+esc(t.name)+(t.due?'<span class="st-due">'+fmtDate(t.due)+'</span>':'')+'</div>').join('');
    linkedHtml+='</div>';
  }
  if(linkedReminders.length){
    linkedHtml+='<div class="proj-linked-group"><span class="proj-linked-label">&#128276; Reminders</span>';
    linkedHtml+=linkedReminders.map(r=>'<div class="proj-linked-item">'+esc(r.text)+(r.date?'<span class="st-due">'+fmtDate(r.date)+'</span>':'')+'</div>').join('');
    linkedHtml+='</div>';
  }
  if(linkedNotes.length){
    linkedHtml+='<div class="proj-linked-group"><span class="proj-linked-label">&#128221; Notes</span>';
    linkedHtml+=linkedNotes.map(n=>'<div class="proj-linked-item">'+esc(n.label||'Note')+(n.body?'<span class="proj-linked-preview">'+esc(n.body.substring(0,60))+(n.body.length>60?'\u2026':'')+'</span>':'')+'</div>').join('');
    linkedHtml+='</div>';
  }
  linkedHtml+='</div>';
}

return '<div class="project-card"><div class="proj-header" onclick="openProjectModal(\''+p.id+'\')"><span class="proj-expand '+(p.expanded?'open':'')+'">\u25B6</span><div class="proj-info"><div class="proj-name-row"><span class="proj-name editable" id="pn_'+p.id+'">'+esc(p.name)+'</span><button class="proj-edit-btn" onclick="event.stopPropagation();promptEditProject(\''+p.id+'\')" title="Rename project">&#9998;</button></div><div class="proj-meta"><span>'+total+' subtask'+(total!==1?'s':'')+'</span>'+(linkedNotes.length?'<span>'+linkedNotes.length+' note'+(linkedNotes.length!==1?'s':'')+'</span>':'')+''+(linkedReminders.length?'<span>'+linkedReminders.length+' reminder'+(linkedReminders.length!==1?'s':'')+'</span>':'')+'</div></div><div style="display:flex;gap:4px;align-items:center;"><span class="wt-clock-btn '+(_isScheduledToday(p.id)?'scheduled':'')+'" onclick="event.stopPropagation();handleWorkTodayClick(\'project\',\''+p.id+'\',\''+p.id+'\')" title="Work on today" style="width:20px;height:20px;font-size:10px;">\u{1F4C5}</span><span class="st-btn st-cal" onclick="exportProjectICS(\''+p.id+'\')">\u{1F4C5}</span><button class="proj-complete-btn" onclick="event.stopPropagation();markProjectComplete(\''+p.id+'\',this)" title="Mark complete">\u2713</button><span class="proj-delete" onclick="deleteProject(\''+p.id+'\')">\u2715</span></div></div><div class="subtask-area '+(p.expanded?'open':'')+'"><div class="proj-due-display">'+(p.due?'<span class="date-editable" id="pd_'+p.id+'">Ends: '+fmtDate(p.due)+'</span>':'<span class="date-editable" id="pd_'+p.id+'" style="color:var(--text-faint);">+ set end date</span>')+'</div>'+_renderProjSummary(p,total,linkedNotes.length,linkedReminders.length,projCompletedItems)+'<div class="subtask-list">'+(sorted.length===0?'<div class="empty-state" style="padding:10px;">No subtasks yet.</div>':sorted.map(st=>{return '<div class="subtask-item"><div class="st-check" onclick="toggleSubtask(\''+p.id+"','"+st.id+'\')"></div><span class="st-name editable" id="sn_'+st.id+'">'+esc(st.name)+'</span>'+(st.due?'<span class="st-due date-editable" id="sd_'+st.id+'">'+fmtDate(st.due)+'</span>':'<span class="st-due date-editable" id="sd_'+st.id+'" style="color:var(--text-faint);">+ date</span>')+'<div class="st-actions">'+(st.timeEst?'<span class="tl-time-badge">'+fmtTimeEst(st.timeEst)+'</span>':'')+'<span class="wt-clock-btn '+(_isScheduledToday(st.id)?'scheduled':'')+'" onclick="event.stopPropagation();handleWorkTodayClick(\'subtask\',\''+st.id+'\',\''+p.id+'\')" title="Work on today" style="width:18px;height:18px;font-size:9px;">\u{1F4C5}</span><span class="st-btn st-cal" onclick="exportSubtaskICS(\''+p.id+"','"+st.id+'\')">\u{1F4C5}</span><span class="st-btn st-del" onclick="deleteSubtask(\''+p.id+"','"+st.id+'\')">\u2715</span></div></div>';}).join(''))+'</div><div class="subtask-add"><input type="text" id="stN_'+p.id+'" placeholder="Next step..." onkeydown="if(event.key===\'Enter\')addSubtask(\''+p.id+'\')"><button class="mic-btn" id="stMic_'+p.id+'" onclick="toggleMic(\'stN_'+p.id+'\',\'stMic_'+p.id+'\')" title="Voice input">&#127908;</button><select id="stT_'+p.id+'" class="time-est-select"><option value="">Time?</option><option value="30">30m</option><option value="60">1hr</option><option value="90">1.5hr</option><option value="120">2hr</option><option value="180">3hr</option><option value="240">4hr</option><option value="360">6hr</option><option value="480">8hr</option><option value="720">12hr</option></select><input type="date" id="stD_'+p.id+'"><button class="btn btn-accent btn-sm" onclick="addSubtask(\''+p.id+'\')">+</button></div></div></div>';}).join('');
document.getElementById('projCount').textContent=state.projects.length;
// Append "Completed Projects" section at the bottom of the projects list
el.innerHTML+=_renderCompletedProjectsSection();
// Update completed subtasks badge (green) -- lifetime total, see taskListCompletedBadge above
var projCompCount=state.completedProjectSubtasksLifetime!==undefined?state.completedProjectSubtasksLifetime:(state.completedTasks||[]).filter(function(t){return t.source==='project';}).length;
var projCompBadge=document.getElementById('projCompletedBadge');
if(projCompBadge){
  projCompBadge.textContent='✓ '+projCompCount;
  projCompBadge.title=projCompCount+' completed subtask'+(projCompCount!==1?'s':'');
  projCompBadge.style.display=projCompCount>0?'inline-flex':'none';
}
// Subtask name editing (still works when unlocked)
state.projects.forEach(p=>{p.subtasks.forEach(st=>{const se=document.getElementById('sn_'+st.id);if(se)makeEditable(se,v=>{editSubtaskName(p.id,st.id,v.trim());});});});
// Attach date editors
state.projects.forEach(p=>{const pde=document.getElementById('pd_'+p.id);if(pde)makeDateClickable(pde,p.due,v=>editProjectDue(p.id,v));p.subtasks.forEach(st=>{const sde=document.getElementById('sd_'+st.id);if(sde)makeDateClickable(sde,st.due,v=>editSubtaskDue(p.id,st.id,v));});});
refreshEditables();updateNoteSelectors();if(typeof _updateTileSummaryProjects==='function')_updateTileSummaryProjects();}

// Always-available project rename -- uses a prompt so it works regardless of lock state
function promptEditProject(pid){
  const p=state.projects.find(p=>p.id===pid);if(!p)return;
  const newName=prompt('Rename project:',p.name);
  if(newName&&newName.trim()&&newName.trim()!==p.name){
    p.name=newName.trim();save();renderProjects();renderTaskList();
  }
}

// REMINDERS
function addReminder(){const t=document.getElementById('newRemText').value.trim();if(!t)return;const projVal=document.getElementById('newRemProject').value;const projIds=projVal?projVal.split(',').filter(Boolean):[];const q=_applyQuickAdd(t,{due:document.getElementById('newRemDate').value,time:document.getElementById('newRemTime').value},{date:true,time:true});state.reminders.push({id:'rem'+Date.now(),text:q.name,date:q.due,time:q.time,projectId:projIds[0]||'',projectIds:projIds});document.getElementById('newRemText').value='';document.getElementById('newRemDate').value='';document.getElementById('newRemTime').value='';document.getElementById('newRemProject').value='';renderProjMultiPickerChips(document.getElementById('newRemProjectPicker'));save();renderReminders();renderProjects();if(projIds.length>1)toast('Reminder added to '+projIds.length+' projects');}
function deleteReminder(id){_confirm('Delete this reminder?',function(){_tombstone(id);state.reminders=state.reminders.filter(r=>r.id!==id);save();renderReminders();},{destructive:true,confirmText:'Delete'});}
// R7 archive stage 2: ✓ on a reminder row -- the completed-task lifecycle
// applied to reminders. No confirm: unlike delete, this is non-destructive
// and reversible from the Archived section below.
function completeReminder(id){
  var r=(state.reminders||[]).find(function(x){return x.id===id;});
  if(!r)return;
  _archiveReminder(r,'done');
  save();_saveRemindersArchiveDoc();
  renderReminders();
  toast('✓ Archived');
}
// Repurposed (was dead code that DELETED past reminders destructively --
// defined but wired to nothing). Now archives them instead, reversible.
function clearPastReminders(){
  var _t=todayStr();
  var past=(state.reminders||[]).filter(function(r){return r.date&&r.date<_t;});
  if(!past.length)return;
  past.forEach(function(r){_archiveReminder(r,'sweep');});
  save();_saveRemindersArchiveDoc();
  renderReminders();
  toast(past.length+' past reminder'+(past.length!==1?'s':'')+' archived');
}
// Restore MUST mint a fresh id: the archived id is permanently in _tombstones
// (grow-only), so re-adding under it would be silently re-dropped by every
// future reconcile on every device. Encoded as a sync-merge test case.
function restoreArchivedReminder(id){
  var rec=(state.remindersArchive||[]).find(function(x){return x.id===id;});
  if(!rec)return;
  state.reminders.push({id:'r'+Date.now()+Math.random().toString(36).slice(2,6),text:rec.text,date:rec.date||'',time:rec.time||''});
  _archiveTombstone(rec.id);
  state.remindersArchive=state.remindersArchive.filter(function(x){return x.id!==id;});
  save();_saveRemindersArchiveDoc();
  renderReminders();
  toast('Reminder restored');
}
function purgeArchivedReminder(id){
  var rec=(state.remindersArchive||[]).find(function(x){return x.id===id;});
  if(!rec)return;
  _confirm('Permanently delete "'+rec.text+'" from the archive? This cannot be undone.',function(){
    _archiveTombstone(rec.id);
    state.remindersArchive=state.remindersArchive.filter(function(x){return x.id!==id;});
    save();_saveRemindersArchiveDoc();
    renderReminders();
  },{destructive:true,confirmText:'Delete Forever'});
}
// R7 archive stage 3: auto-sweep. Reminders dated more than 7 days past
// archive themselves (reason 'sweep') on the existing day-rollover tick --
// the 7-day grace keeps recently-missed items visible (and inside the
// triage-able window) while stopping the array from growing forever.
// Naturally idempotent: after one sweep nothing matches until the date
// advances, and two devices sweeping concurrently converge (same ids ->
// tombstone union + archive union keep one record; encoded as a sync-merge
// test in stage 1). Runs only after initApp's Promise.all has loaded both
// the blob and the archive doc, so it never sweeps into an unreconciled
// archive.
function _sweepPastReminders(){
  var cutoff=_tlPlusDays(todayStr(),-7);
  var stale=(state.reminders||[]).filter(function(r){return r.date&&r.date<cutoff;});
  if(!stale.length)return;
  stale.forEach(function(r){_archiveReminder(r,'sweep');});
  save();_saveRemindersArchiveDoc();
  if(typeof renderReminders==='function')renderReminders();
  toast(stale.length+' past reminder'+(stale.length!==1?'s':'')+' archived');
}
var _remArchiveOpen=false;
function _toggleRemArchiveSection(){_remArchiveOpen=!_remArchiveOpen;renderReminders();}
// Collapsed folder at the bottom of the FULL reminders view -- same pattern
// (and same CSS classes) as the Completed Projects folder. Also carries the
// "Archive past (N)" bulk action when any active reminder is past-dated.
function _renderRemindersArchiveSection(){
  var arch=state.remindersArchive||[];
  var _t=todayStr();
  var pastCount=(state.reminders||[]).filter(function(r){return r.date&&r.date<_t;}).length;
  if(arch.length===0&&pastCount===0)return '';
  var html='<div class="completed-projects-section">';
  if(pastCount>0){
    html+='<div class="tl-empty-hint" style="padding:0 0 8px;color:var(--text-dim);font-size:12px;">'
      +pastCount+' past reminder'+(pastCount!==1?'s':'')+' still active — '
      +'<a href="#" onclick="clearPastReminders();return false;">Archive past</a></div>';
  }
  if(arch.length>0){
    html+='<div class="completed-projects-toggle'+(_remArchiveOpen?' open':'')+'" onclick="_toggleRemArchiveSection()">'
      +'<span class="cp-arrow">▶</span>'
      +'<span>✓ Archived ('+arch.length+')</span>'
      +'</div>';
    html+='<div class="completed-projects-list'+(_remArchiveOpen?' open':'')+'">';
    arch.forEach(function(rec){
      var when=[];
      if(rec.date)when.push(fmtDate(rec.date)+(rec.time?' '+fmtTime(rec.time):''));
      when.push(rec.reason==='sweep'?'auto-archived':'completed');
      html+='<div class="completed-project-card">'
        +'<span class="cp-name">'+esc(rec.text)+'</span>'
        +'<span class="cp-stats">'+when.join(' · ')+'</span>'
        +'<span class="cp-action cp-restore" onclick="restoreArchivedReminder(\''+rec.id+'\')" title="Restore">↺</span>'
        +'<span class="cp-action cp-purge" onclick="purgeArchivedReminder(\''+rec.id+'\')" title="Permanently delete">✕</span>'
        +'</div>';
    });
    html+='</div>';
  }
  html+='</div>';
  return html;
}
function editReminderText(id,v){if(!v)return;const r=state.reminders.find(r=>r.id===id);if(r)r.text=v;save();}
// R7 stage 2 / R10: shared chronological reminder sort -- date first, then
// time within a date (an untimed reminder means "sometime that day", so it
// sorts ahead of the day's scheduled ones rather than falling through to
// insertion order), undated reminders last. Reused by renderReminders() and
// _buildWatchSnapshot() so there's one meaning of "reminders in order", not
// a duplicated comparator that could drift between the two.
function _reminderSortCompare(a,b){
  if(a.date&&b.date){
    const d=a.date.localeCompare(b.date);if(d!==0)return d;
    if(a.time&&!b.time)return 1;if(!a.time&&b.time)return -1;
    if(a.time&&b.time)return a.time.localeCompare(b.time);return 0;
  }
  if(a.date&&!b.date)return -1;if(!a.date&&b.date)return 1;return 0;
}
function renderReminders(){
if(_isEditingInPanel('reminderList')){_deferPanelRender('reminderList');return;}
const el=document.getElementById('reminderList');const today=todayStr();const sorted=[...state.reminders].sort(_reminderSortCompare);
// R7 stage 3: search, full-list view only -- same inOverlay guard as Tasks
// (the #remSearch input is CSS-hidden in tile mode but its value persists,
// so without the guard a leftover query would silently filter the tile too).
var remPanel=document.querySelector('.panel[data-panel="reminders"]');
var remInOverlay=remPanel&&!remPanel.classList.contains('panel-tile');
var remSearchEl=document.getElementById('remSearch');
var remSearch=remInOverlay&&remSearchEl?remSearchEl.value.toLowerCase().trim():'';
var visible=remSearch?sorted.filter(r=>(r.text||'').toLowerCase().indexOf(remSearch)>=0):sorted;
if(visible.length===0){el.innerHTML='<div class="empty-state">'+(remSearch?'No matching reminders.':'No reminders.')+'</div>'+(remInOverlay?_renderRemindersArchiveSection():'');document.getElementById('remCount').textContent=sorted.filter(r=>!r.date||r.date>=today).length;if(typeof _updateTileSummaryReminders==='function')_updateTileSummaryReminders();return;}
el.innerHTML=(remInOverlay?_remGroupedListHTML(visible,today,_remRenderLimit)+_renderRemindersArchiveSection():visible.map(_remRowHTML).join(''));
document.getElementById('remCount').textContent=sorted.filter(r=>!r.date||r.date>=today).length;
state.reminders.forEach(r=>{const e=document.getElementById('rt_'+r.id);if(e)makeEditable(e,v=>editReminderText(r.id,v));const rde=document.getElementById('rd_'+r.id);if(rde)makeDateClickable(rde,r.date,v=>editReminderDate(r.id,v));const rte=document.getElementById('rt2_'+r.id);if(rte)makeTimeClickable(rte,r.time,v=>editReminderTime(r.id,v));});refreshEditables();if(typeof _updateTileSummaryReminders==='function')_updateTileSummaryReminders();}
function _remRowHTML(r){return '<div class="reminder-item"><span class="rem-icon">\u{1F535}</span><div class="rem-body"><div class="rem-text editable" id="rt_'+r.id+'">'+esc(r.text)+'</div><div class="rem-when">'+'<span class="date-editable" id="rd_'+r.id+'">'+(r.date?fmtDate(r.date):'+ set date')+'</span>'+(r.time?' at <span class="date-editable" id="rt2_'+r.id+'">'+fmtTime(r.time)+'</span>':' <span class="date-editable" id="rt2_'+r.id+'" style="color:var(--text-faint);">+ time</span>')+'</div></div><div style="display:flex;gap:2px;"><span class="st-btn st-done" onclick="completeReminder(\''+r.id+'\')" title="Done — move to archive" aria-label="Done — move to archive">✓</span><span class="st-btn st-cal" onclick="exportReminderICS(\''+r.id+'\')" title="Add to calendar" aria-label="Add to calendar">\u{1F4C5}</span><span class="st-btn st-del" onclick="deleteReminder(\''+r.id+'\')" title="Delete" aria-label="Delete">✕</span></div></div>';}
// R7 stage 4: same grouping/jump-chip treatment as Tasks (_tlGroupedListHTML)
// -- Reminders has no sort dropdown, it's always date+time order, so this
// applies whenever the full list is showing rather than being gated on a
// sort value.
function _remGroupedListHTML(items,today,limit){
  var tomorrow=_tlPlusDays(today,1);
  var weekEnd=_tlPlusDays(today,7);
  var order=['overdue','today','tomorrow','week','later','none'];
  var buckets={};
  items.forEach(function(r){
    var info=_dateGroupInfo(r.date,today,tomorrow,weekEnd);
    if(!buckets[info.key])buckets[info.key]={label:info.label,rows:[]};
    buckets[info.key].rows.push(r);
  });
  var present=order.filter(function(k){return buckets[k];});
  if(present.length<2)return _tlBatchedRowsHTML(items,limit,_remRowHTML,_remShowMoreHTML);
  var chips=present.map(function(k){
    return '<button type="button" class="tl-jump-chip" onclick="document.getElementById(\'remgroup-'+k+'\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">'+esc(buckets[k].label)+' <span class="tl-jump-chip-count">'+buckets[k].rows.length+'</span></button>';
  }).join('');
  var remaining=limit;
  var body=present.map(function(k){
    var rows=buckets[k].rows;
    var take=Math.max(0,Math.min(remaining,rows.length));
    remaining-=take;
    return '<div class="tl-group-header" id="remgroup-'+k+'">'+esc(buckets[k].label)+'</div>'
      +rows.slice(0,take).map(_remRowHTML).join('');
  }).join('');
  if(items.length>limit)body+=_remShowMoreHTML(items.length-limit);
  return '<div class="tl-jump-chips">'+chips+'</div>'+body;
}

// ICS
function generateICS(events){let ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Centerpost//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';events.forEach(ev=>{const uid='cd-'+Date.now()+'-'+Math.random().toString(36).substr(2,8);const d=ev.date?ev.date.replace(/-/g,''):todayStr().replace(/-/g,'');ics+='BEGIN:VEVENT\r\nUID:'+uid+'\r\nDTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z\r\n';if(ev.time){const t=ev.time.replace(':','')+'00';ics+='DTSTART:'+d+'T'+t+'\r\n';const sm=parseInt(ev.time.split(':')[0])*60+parseInt(ev.time.split(':')[1])+60;ics+='DTEND:'+d+'T'+String(Math.floor(sm/60)).padStart(2,'0')+String(sm%60).padStart(2,'0')+'00\r\n';}else{ics+='DTSTART;VALUE=DATE:'+d+'\r\nDTEND;VALUE=DATE:'+d+'\r\n';}ics+='SUMMARY:'+icsEsc(ev.title)+'\r\n';if(ev.description)ics+='DESCRIPTION:'+icsEsc(ev.description)+'\r\n';ics+='BEGIN:VALARM\r\nTRIGGER:-PT15M\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\nEND:VEVENT\r\n';});ics+='END:VCALENDAR\r\n';return ics;}
function icsEsc(s){return s.replace(/[,;\\]/g,c=>'\\'+c).replace(/\n/g,'\\n');}
function downloadICS(fn,ics){const b=new Blob([ics],{type:'text/calendar;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);toast('\u{1F4C5} .ics downloaded');}
function showOutlookModal(title,date,time,desc){const ics=generateICS([{title,date,time,description:desc}]);const d=date||todayStr(),t=time||'09:00';const si=d+'T'+t+':00';const sm=parseInt(t.split(':')[0])*60+parseInt(t.split(':')[1])+60;const ei=d+'T'+String(Math.floor(sm/60)).padStart(2,'0')+':'+String(sm%60).padStart(2,'0')+':00';const wurl='https://outlook.live.com/calendar/0/action/compose?subject='+encodeURIComponent(title)+'&startdt='+si+'&enddt='+ei+'&body='+encodeURIComponent(desc||'');const mc=document.getElementById('modalContent');mc.innerHTML='<h3>\u{1F4C5} Add to Outlook</h3><p><strong>'+esc(title)+'</strong><br>'+(date?fmtDate(date):'No date')+(time?' at '+fmtTime(time):'')+'</p><div class="modal-actions"><button class="btn btn-outlook" id="ocsDownload">\u2B07 Download .ics</button><a href="#" target="_blank" rel="noopener noreferrer" class="btn btn-outlook" id="ocsWeb" style="text-decoration:none;">\u{1F310} Outlook Web</a><button class="btn" id="ocsCancel">Cancel</button></div>';const dl=document.getElementById('ocsDownload');if(dl)dl.onclick=function(){downloadICS('event.ics',ics);closeModal();};const web=document.getElementById('ocsWeb');if(web){web.href=wurl;web.onclick=function(){closeModal();};}const cancel=document.getElementById('ocsCancel');if(cancel)cancel.onclick=closeModal;document.getElementById('modalOverlay').classList.add('show');}
function closeModal(){document.getElementById('modalOverlay').classList.remove('show');}
function exportSubtaskICS(pid,sid){const p=state.projects.find(p=>p.id===pid);const s=p&&p.subtasks.find(s=>s.id===sid);if(!s)return;showOutlookModal(s.name+' ['+p.name+']',s.due,null,'Project: '+p.name);}
function exportProjectICS(pid){const p=state.projects.find(pr=>pr.id===pid);if(!p)return;const ev=p.subtasks.filter(s=>s.due&&!s.done).map(s=>({title:s.name+' ['+p.name+']',date:s.due,description:'Project: '+p.name}));if(ev.length===0){toast('No undone subtasks with dates.');return;}downloadICS(slugify(p.name)+'.ics',generateICS(ev));}
function exportAllToICS(){const ev=[];state.projects.forEach(p=>{p.subtasks.filter(s=>s.due&&!s.done).forEach(s=>{ev.push({title:s.name+' ['+p.name+']',date:s.due,description:'Project: '+p.name});});});state.reminders.filter(r=>r.date).forEach(r=>{ev.push({title:r.text,date:r.date,time:r.time});});if(ev.length===0){toast('Nothing to export.');return;}downloadICS('productivity-dashboard-all.ics',generateICS(ev));}
function exportReminderICS(id){const r=state.reminders.find(r=>r.id===id);if(!r)return;showOutlookModal(r.text,r.date,r.time,'Reminder');}

// =======================================
// NOTIFICATIONS (R1 phase 1 -- web, while-open delivery)
// =======================================
// Gentle, quiet-by-default nudges for due reminders and routine check-ins.
//
// SCOPE / HONESTY: web Notifications only fire while a Centerpost tab (or its
// service worker) is alive, and NOT at all inside the iOS WKWebView. True
// "notify me when the app is closed" on phone is phase 2 (the Capacitor
// @capacitor/local-notifications plugin), which reuses this same engine's
// scan/dedup/quiet-hours logic. Nothing here sets an app badge unless the
// user explicitly opts in.
function _defaultNotifPrefs(){
  return {enabled:false,quietStart:'21:00',quietEnd:'08:00',badges:false,
    routineMorning:{on:false,time:'08:00'},routineEvening:{on:false,time:'20:00'},
    // R16 Phase B: fixed to Sunday for v1 (no day picker) -- off by default,
    // same as every other individual nudge type here.
    weeklyReview:{on:false,time:'18:00'}};
}
function _ensureNotifPrefs(){
  if(!state.notifPrefs)state.notifPrefs=_defaultNotifPrefs();
  var d=_defaultNotifPrefs();
  for(var k in d){if(state.notifPrefs[k]===undefined)state.notifPrefs[k]=d[k];}
  if(!state.notifPrefs.routineMorning)state.notifPrefs.routineMorning={on:false,time:'08:00'};
  if(!state.notifPrefs.routineEvening)state.notifPrefs.routineEvening={on:false,time:'20:00'};
  if(!state.notifPrefs.weeklyReview)state.notifPrefs.weeklyReview={on:false,time:'18:00'};
  return state.notifPrefs;
}

// -- Fired-today tracking (device-local, so each device dedupes its own
//    while-open notifications; not synced). Resets on a new day.
var _notifFired={};
var _notifFiredDate='';
function _notifLoadFired(){
  try{
    var raw=localStorage.getItem('cpNotifFired');
    if(raw){var o=JSON.parse(raw);if(o&&o.date===todayStr()){_notifFired=o.keys||{};_notifFiredDate=o.date;return;}}
  }catch(e){}
  _notifFired={};_notifFiredDate=todayStr();
}
function _notifResetIfNewDay(){if(_notifFiredDate!==todayStr()){_notifFired={};_notifFiredDate=todayStr();}}
function _notifAlreadyFired(key){_notifResetIfNewDay();return !!_notifFired[key];}
function _notifMarkFired(key){_notifResetIfNewDay();_notifFired[key]=true;try{localStorage.setItem('cpNotifFired',JSON.stringify({date:_notifFiredDate,keys:_notifFired}));}catch(e){}}

function _notifInQuietHours(){
  var p=state.notifPrefs;if(!p)return false;
  var now=new Date();var cur=now.getHours()*60+now.getMinutes();
  var s=_hmToMin(p.quietStart||'21:00'),e=_hmToMin(p.quietEnd||'08:00');
  if(s===e)return false;
  if(s<e)return cur>=s&&cur<e;      // same-day window
  return cur>=s||cur<e;             // overnight window (e.g. 21:00 -> 08:00)
}

// Single place that touches the OS. Checks permission here (not in the tick)
// so the scan/dedup logic stays testable regardless of permission state.
function _notifShow(title,body,tag){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  var opts={body:body||'',tag:tag||undefined,renotify:false,silent:false};
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(function(reg){reg.showNotification(title,opts);})
        .catch(function(){try{new Notification(title,opts);}catch(e){}});
    }else{
      new Notification(title,opts);
    }
  }catch(e){}
}

// App-icon badge: OFF unless the user opts in. When on, count reminders due
// today or overdue. Never sets a badge otherwise (badges read as a shame
// scorecard -- see the review's ADHD persona).
function _notifUpdateBadge(){
  if(_notifNative())return; // native badge is handled through the bridge (see _notifSyncNative)
  var p=state.notifPrefs;
  try{
    if(p&&p.enabled&&p.badges&&navigator.setAppBadge){
      var today=todayStr();
      var count=(state.reminders||[]).filter(function(r){return r.date&&r.date<=today;}).length;
      if(count>0)navigator.setAppBadge(count);
      else if(navigator.clearAppBadge)navigator.clearAppBadge();
    }else if(navigator.clearAppBadge){
      navigator.clearAppBadge();
    }
  }catch(e){}
}

function _notifMaybeRoutine(which,time,curMin,today){
  var t=_hmToMin(time||(which==='morning'?'08:00':'20:00'));
  if(t>curMin)return;                 // not time yet
  if(curMin-t>60)return;              // missed the 60-min nudge window
  var key='routine-'+which+':'+today;
  if(_notifAlreadyFired(key))return;
  var items=(state.routines&&state.routines[which])||[];
  var undone=items.filter(function(i){return !i.done;}).length;
  if(undone===0)return;               // nothing left -> no nudge, no guilt
  _notifMarkFired(key);
  var label=which==='morning'?'☀ Morning routine':'🌙 Evening routine';
  _notifShow(label,undone+' item'+(undone!==1?'s':'')+' left — a gentle nudge, no pressure.','routine-'+which);
}

// R16 Phase B: fixed to Sunday for v1. Gated on now.getDay()===0 (JS's 0-indexed
// Date.getDay(); Sunday=0) BEFORE the time check, so this only ever reaches the
// per-day dedupe on the one day it can fire -- no separate per-week dedupe
// scheme needed, the existing per-day _notifFired reset already gives weekly
// semantics once combined with the day-of-week gate.
function _notifMaybeWeeklyReview(time,curMin,today,now){
  if(now.getDay()!==0)return;
  var t=_hmToMin(time||'18:00');
  if(t>curMin)return;                 // not time yet
  if(curMin-t>60)return;              // missed the 60-min nudge window
  var key='weekly-review:'+today;
  if(_notifAlreadyFired(key))return;
  _notifMarkFired(key);
  _notifShow('📆 Your Weekly Review','Take a moment to look back at your week.','weekly-review');
}

// The scan. Runs on an interval while the app is open (and shortly after load).
function _notifTick(){
  var p=state.notifPrefs;
  if(!p||!p.enabled){_notifUpdateBadge();return;}
  if(_notifInQuietHours()){_notifUpdateBadge();return;}
  var now=new Date();
  var today=todayStr();
  var curMin=now.getHours()*60+now.getMinutes();

  (state.reminders||[]).forEach(function(r){
    if(!r.time||!r.date||r.date!==today)return;
    var t=_hmToMin(r.time);
    if(t>curMin)return;               // not due yet
    if(curMin-t>30)return;            // too old -> don't fire a stale reminder on first open
    var key='rem:'+r.id+':'+today;
    if(_notifAlreadyFired(key))return;
    _notifMarkFired(key);
    var when=(typeof fmtTime==='function')?fmtTime(r.time):r.time;
    _notifShow('⏰ '+r.text,'Reminder for '+when,'rem-'+r.id);
  });

  if(p.routineMorning&&p.routineMorning.on)_notifMaybeRoutine('morning',p.routineMorning.time,curMin,today);
  if(p.routineEvening&&p.routineEvening.on)_notifMaybeRoutine('evening',p.routineEvening.time,curMin,today);
  if(p.weeklyReview&&p.weeklyReview.on)_notifMaybeWeeklyReview(p.weeklyReview.time,curMin,today,now);

  _notifUpdateBadge();
}

// -- Settings wiring -----------------------------------------------------
function toggleNotifEnabled(on){
  _ensureNotifPrefs();
  // Native (iOS shell): permission + delivery go through the notification bridge.
  if(_notifNative()){
    if(on){
      _notifPendingEnable=true;
      _notifNative().postMessage({action:'requestPermission'});
    }else{
      state.notifPrefs.enabled=false;save();_notifSyncNative();_renderNotifSettings();
    }
    return;
  }
  if(on){
    if(!('Notification' in window)){toast('Notifications aren\'t supported in this browser');_renderNotifSettings();return;}
    Notification.requestPermission().then(function(perm){
      if(perm==='granted'){
        state.notifPrefs.enabled=true;save();
        toast('✓ Notifications on');
        _notifShow('Centerpost notifications on','You\'ll get gentle nudges for due reminders and routines.','notif-welcome');
      }else{
        state.notifPrefs.enabled=false;save();
        toast(perm==='denied'?'Notifications are blocked in your browser settings':'Notifications not enabled');
      }
      _renderNotifSettings();
    });
  }else{
    state.notifPrefs.enabled=false;save();_notifUpdateBadge();_renderNotifSettings();
  }
}
function setNotifPref(k,v){_ensureNotifPrefs();state.notifPrefs[k]=v;save();if(k==='badges')_notifUpdateBadge();}
function setNotifRoutine(group,k,v){_ensureNotifPrefs();if(!state.notifPrefs[group])state.notifPrefs[group]={};state.notifPrefs[group][k]=v;save();}

function _renderNotifSettings(){
  var el=document.getElementById('notifSettings');if(!el)return;
  _ensureNotifPrefs();
  var p=state.notifPrefs;
  var native=!!_notifNative();
  var supported=native||('Notification' in window);
  // On native we can't read a synchronous permission state; we track it via the
  // bridge callback (_notifNativePermGranted, refreshed by checkPermission).
  var perm=native?(_notifNativePermGranted?'granted':'default'):(supported?Notification.permission:'unsupported');
  var enabled=!!p.enabled&&perm==='granted';
  var desc;
  if(native){desc='Reminders and routine nudges — delivered even when the app is closed. Turn on to allow notifications.';}
  else if(!supported){desc='Not supported in this browser.';}
  else if(perm==='denied'){desc='Blocked in your browser settings — enable Centerpost there first.';}
  else{desc='Gentle nudges for due reminders and routines. Only while the app is open (on desktop).';}
  var html='';
  html+='<div class="panel-toggle"><span class="pt-icon">🔔</span><div class="pt-info"><div class="pt-name">Enable notifications</div><div class="pt-desc">'+desc+'</div></div><label class="toggle-switch"><input type="checkbox" '+(enabled?'checked':'')+' '+((!supported||perm==='denied')?'disabled':'')+' onchange="toggleNotifEnabled(this.checked)"><span class="toggle-slider"></span></label></div>';
  if(enabled){
    html+='<div class="notif-row"><label>Quiet hours</label><span class="notif-time-pair"><input type="time" value="'+(p.quietStart||'21:00')+'" onchange="setNotifPref(\'quietStart\',this.value)"> to <input type="time" value="'+(p.quietEnd||'08:00')+'" onchange="setNotifPref(\'quietEnd\',this.value)"></span></div>';
    html+='<div class="panel-toggle"><span class="pt-icon">🔴</span><div class="pt-info"><div class="pt-name">App badge count</div><div class="pt-desc">Show a number on the app icon. Off by default.</div></div><label class="toggle-switch"><input type="checkbox" '+(p.badges?'checked':'')+' onchange="setNotifPref(\'badges\',this.checked)"><span class="toggle-slider"></span></label></div>';
    var rm=p.routineMorning||{on:false,time:'08:00'};
    var re=p.routineEvening||{on:false,time:'20:00'};
    html+='<div class="notif-row"><label class="notif-check"><input type="checkbox" '+(rm.on?'checked':'')+' onchange="setNotifRoutine(\'routineMorning\',\'on\',this.checked)"> Morning routine nudge</label><input type="time" value="'+(rm.time||'08:00')+'" onchange="setNotifRoutine(\'routineMorning\',\'time\',this.value)"></div>';
    html+='<div class="notif-row"><label class="notif-check"><input type="checkbox" '+(re.on?'checked':'')+' onchange="setNotifRoutine(\'routineEvening\',\'on\',this.checked)"> Evening routine nudge</label><input type="time" value="'+(re.time||'20:00')+'" onchange="setNotifRoutine(\'routineEvening\',\'time\',this.value)"></div>';
    var wr=p.weeklyReview||{on:false,time:'18:00'};
    html+='<div class="notif-row"><label class="notif-check"><input type="checkbox" '+(wr.on?'checked':'')+' onchange="setNotifRoutine(\'weeklyReview\',\'on\',this.checked)"> Weekly Review, Sundays</label><input type="time" value="'+(wr.time||'18:00')+'" onchange="setNotifRoutine(\'weeklyReview\',\'time\',this.value)"></div>';
  }
  el.innerHTML=html;
}

// -- Native path (R1 phase 2: iOS shell, schedule-ahead via NotificationBridge) --
// Mirrors the watch bridge. On iOS the web Notification API is dead, so instead
// of the poll-and-fire loop we register upcoming reminders (one-shot) and
// routine nudges (daily-repeating) with UNUserNotificationCenter, which fires
// them even when the app is closed. No-ops on the web build (handler absent).
var _notifNativePermGranted=false;
var _notifPendingEnable=false;
var _notifNativeSyncTimer=null;
function _notifNative(){
  try{return (window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.notify)||null;}catch(e){return null;}
}
function _notifTimeInQuiet(time){
  var p=state.notifPrefs;if(!p)return false;
  var cur=_hmToMin(time),s=_hmToMin(p.quietStart||'21:00'),e=_hmToMin(p.quietEnd||'08:00');
  if(s===e)return false;
  if(s<e)return cur>=s&&cur<e;
  return cur>=s||cur<e;
}
function _notifDateTimeToEpoch(date,time){
  try{
    var d=(date||'').split('-'),t=(time||'00:00').split(':');
    return new Date(parseInt(d[0],10),parseInt(d[1],10)-1,parseInt(d[2],10),parseInt(t[0],10),parseInt(t[1],10),0,0).getTime();
  }catch(e){return null;}
}
function _notifTodayTimeEpoch(time){
  var t=(time||'08:00').split(':');
  var d=new Date();d.setHours(parseInt(t[0],10),parseInt(t[1],10),0,0);
  return d.getTime();
}
// Build the full desired notification set (native replaces everything each sync).
function _notifBuildNativeItems(){
  var p=state.notifPrefs;if(!p||!p.enabled)return [];
  var items=[];
  var nowMs=Date.now();
  (state.reminders||[]).forEach(function(r){
    if(!r.date||!r.time)return;
    var at=_notifDateTimeToEpoch(r.date,r.time);
    if(at===null||at<=nowMs)return;          // past or invalid
    if(_notifTimeInQuiet(r.time))return;     // falls inside quiet hours
    var when=(typeof fmtTime==='function')?fmtTime(r.time):r.time;
    items.push({id:'rem_'+r.id,title:'⏰ '+(r.text||'Reminder'),body:'Reminder for '+when,at:at,repeatsDaily:false});
  });
  if(p.routineMorning&&p.routineMorning.on&&!_notifTimeInQuiet(p.routineMorning.time)){
    items.push({id:'routine_morning',title:'☀ Morning routine',body:'A gentle nudge for your morning routine — no pressure.',at:_notifTodayTimeEpoch(p.routineMorning.time),repeatsDaily:true});
  }
  if(p.routineEvening&&p.routineEvening.on&&!_notifTimeInQuiet(p.routineEvening.time)){
    items.push({id:'routine_evening',title:'🌙 Evening routine',body:'A gentle nudge for your evening routine — no pressure.',at:_notifTodayTimeEpoch(p.routineEvening.time),repeatsDaily:true});
  }
  // R16 Phase B: fixed to Sunday for v1 -- native derives the weekday from
  // repeatWeekly alone (hardcoded Sunday on that side too), so no day-of-week
  // value needs to cross the bridge at all.
  if(p.weeklyReview&&p.weeklyReview.on&&!_notifTimeInQuiet(p.weeklyReview.time)){
    items.push({id:'weekly_review',title:'📆 Your Weekly Review',body:'Take a moment to look back at your week.',at:_notifTodayTimeEpoch(p.weeklyReview.time),repeatWeekly:true});
  }
  return items.slice(0,60); // iOS caps pending notifications at 64
}
function _notifSyncNative(){
  var h=_notifNative();if(!h)return;
  var p=state.notifPrefs;
  if(!p||!p.enabled){
    h.postMessage({action:'cancelAll'});
    h.postMessage({action:'setBadge',count:0});
    return;
  }
  h.postMessage({action:'schedule',items:_notifBuildNativeItems()}); // native schedule() clears the old set first
  var badge=0;
  if(p.badges){var today=todayStr();badge=(state.reminders||[]).filter(function(r){return r.date&&r.date<=today;}).length;}
  h.postMessage({action:'setBadge',count:badge});
}
// R16 Phase B: sw.js's notificationclick posts this when the weekly-review
// notification is tapped (while-open engine only, native goes through the
// evalJS bridge directly -- see NotificationBridge's response delegate).
if(typeof navigator!=='undefined'&&navigator.serviceWorker){
  navigator.serviceWorker.addEventListener('message',function(e){
    if(e.data&&e.data.type==='openWeeklyReview'&&typeof openWeeklyReview==='function')openWeeklyReview();
  });
}
// Debounced -- called from save() so edits coalesce into one reschedule.
function _notifScheduleNativeSync(){
  if(!_notifNative())return;
  clearTimeout(_notifNativeSyncTimer);
  _notifNativeSyncTimer=setTimeout(_notifSyncNative,1500);
}
// Native -> JS permission callback (evaluateJavaScript from NotificationBridge).
window.__notifPermissionResult=function(granted){
  _notifNativePermGranted=!!granted;
  _ensureNotifPrefs();
  if(_notifPendingEnable){
    _notifPendingEnable=false;
    state.notifPrefs.enabled=!!granted;save();
    if(granted){toast('✓ Notifications on');_notifSyncNative();}
    else{toast('Enable notifications in iOS Settings › Centerpost');}
  }else if(!granted&&state.notifPrefs.enabled){
    // permission was revoked in iOS Settings since last run
    state.notifPrefs.enabled=false;save();
  }
  if(typeof _renderNotifSettings==='function')_renderNotifSettings();
};

// BRAIN DUMP
function handleDumpKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();const t=document.getElementById('brainDump').value.trim();if(!t)return;state.thoughts.push({id:'th'+Date.now(),text:t});document.getElementById('brainDump').value='';save();renderThoughts();_trackEvent('tool_use','brain_dump','Brain Dump');}}
function deleteThought(id){_confirm('Delete this thought?',function(){_tombstone(id);state.thoughts=state.thoughts.filter(t=>t.id!==id);save();renderThoughts();},{destructive:true,confirmText:'Delete'});}
function promoteThought(id){const th=state.thoughts.find(t=>t.id===id);if(!th)return;if(state.projects.length>0){const sp=_sortedProjects();const c=prompt('Promote to which project?\n\n'+sp.map((p,i)=>(i+1)+'. '+p.name).join('\n')+'\n\n(0 = reminders)','1');if(c===null)return;const idx=parseInt(c)-1;if(idx>=0&&idx<sp.length){sp[idx].subtasks.push({id:'st'+Date.now(),name:th.text,due:'',priority:'med',timeEst:'',done:false});deleteThought(id);renderProjects();renderTaskList();toast('Added to '+sp[idx].name);return;}}state.reminders.push({id:'rem'+Date.now(),text:th.text,date:'',time:''});deleteThought(id);renderReminders();toast('Moved to reminders');}
function editThought(id,v){if(!v)return;const t=state.thoughts.find(t=>t.id===id);if(t)t.text=v;save();}

// ===========================================================================
// BRAIN DUMP ORGANIZER -- Axis sorts thoughts into projects/tasks/notes
// ===========================================================================
var _bdoPlan = null;  // current organization plan from Axis

async function bdOrganize(){
  // Capture any text still in the textarea as a thought first
  var ta = document.getElementById('brainDump');
  if(ta && ta.value.trim()){
    state.thoughts.push({id:'th'+Date.now(),text:ta.value.trim()});
    ta.value=''; save(); renderThoughts();
  }

  if(!state.thoughts || state.thoughts.length===0){
    toast('Nothing to organize -- add some thoughts first');
    return;
  }

  var btn = document.getElementById('bdOrganizeBtn');
  if(btn) btn.disabled = true;

  // Open modal in loading state
  document.getElementById('bdoBody').innerHTML='<div class="bdo-status"><div class="bdo-spinner"></div> Axis is reading your thoughts…</div>';
  document.getElementById('bdoFooter').style.display='none';
  document.getElementById('bdOrganizeModal').classList.add('open');

  try {
    var plan = await _bdoRequestPlan();
    _bdoPlan = plan;
    _bdoRenderPlan(plan);
  } catch(e){
    console.error('[bdo] organize error', e);
    document.getElementById('bdoBody').innerHTML='<div class="bdo-empty">Axis couldn\'t organize right now.<br><span style="font-size:11px;">'+esc(e.message||'Unknown error')+'</span></div>';
  } finally {
    if(btn) btn.disabled = false;
  }
}

async function _bdoRequestPlan(){
  // -- Pre-process: split thoughts that contain multiple dash-prefixed lines --
  // A single brain dump entry like "- task one\n- task two\n- task three" should
  // arrive at Haiku as three items, not one. We split here so Haiku doesn't have
  // to infer structure from a wall of text.
  var rawThoughts = state.thoughts;
  var thoughts = [];
  rawThoughts.forEach(function(t){
    var text = (t.text||'').trim();
    // Check if the text has 2+ lines starting with - or * (a list pasted in)
    var lines = text.split('\n').map(function(l){return l.trim();}).filter(Boolean);
    var bulletLines = lines.filter(function(l){return /^[-*]\s+/.test(l);});
    if(bulletLines.length >= 2){
      // Split into individual items, each inherits a derived id
      bulletLines.forEach(function(l, i){
        var clean = l.replace(/^[-*]\s+/,'').trim();
        if(clean) thoughts.push({id: t.id+'_s'+i, text: clean, _parentId: t.id});
      });
      // Catch any non-bullet lines as a separate item (often context/title)
      lines.filter(function(l){return !/^[-*]\s+/.test(l);}).forEach(function(l,i){
        if(l.trim()) thoughts.push({id: t.id+'_h'+i, text: l.trim(), _parentId: t.id});
      });
    } else {
      thoughts.push({id: t.id, text: text});
    }
  });

  var projects = (state.projects||[]).map(function(p){ return p.name; });

  var sys = 'You are Axis, organizing a brain dump for an ADHD user of the Centerpost productivity app. '
    + 'Sort each thought into the best destination. Output ONLY raw JSON (no markdown, no code fences).\n\n'
    + 'EXISTING PROJECTS: '+(projects.length?JSON.stringify(projects):'(none yet)')+'\n\n'
    + 'SPLITTING RULE (critical): If a single thought contains multiple distinct actions or facts '
    + '(even on one line, separated by dashes or semicolons), output MULTIPLE items from it -- '
    + 'one per action. A thought like "call dispatch -email report -update chart" should produce '
    + '3 separate task items, not 1. Short procedural steps that belong together can stay as one note.\n\n'
    + 'DESTINATION RULES:\n'
    + '- "task": an actionable to-do with a clear next action verb (call, email, submit, reset, update…). '
    + 'Prefer task over note when there is any action to take. If it belongs to an existing project, '
    + 'set "project" to that exact name.\n'
    + '- "note": reference info, procedures, or context with NO clear single owner or deadline. '
    + 'Step-by-step instructions that are reference material (not assigned to anyone) are notes.\n'
    + '- "reminder": time-sensitive, needs to resurface on a specific date.\n'
    + '- "newproject": implies a whole new project thread should exist.\n\n'
    + 'BIAS TOWARD TASKS: When in doubt between task and note, choose task. '
    + 'ADHD brains benefit from actionable items more than reference text.\n\n'
    + 'When you are NOT confident, add a clarifying question instead of guessing.\n\n'
    + 'Return this exact JSON shape:\n'
    + '{"items":[{"thoughtId":"<id>","text":"<concise restatement>","dest":"task|note|reminder|newproject","project":"<project name or empty>","newProjectName":"<only if newproject>"}],'
    + '"questions":[{"thoughtId":"<id>","text":"<original>","question":"<short question>","options":["<opt1>","<opt2>","<opt3>"]}]}\n\n'
    + 'Every thought must appear in EITHER items OR questions. Keep questions rare. '
    + 'Rephrase each item\'s text as a clean, concise action or title -- remove filler words.';

  var userMsg = 'Organize these thoughts:\n'+JSON.stringify(thoughts.map(function(t){return {id:t.id,text:t.text};}));

  var endpoint = (typeof JARVIS_PROXY_URL!=='undefined' && JARVIS_PROXY_URL) || '';
  var res = await fetch(endpoint, {
    method:'POST',
    headers:await _jarvisAuthHeaders(),
    body:JSON.stringify({
      model:'claude-haiku-4-5-20251001',
      max_tokens:2000,
      system:sys,
      messages:[{role:'user',content:userMsg}]
    })
  });

  var raw = await res.text();
  if(!res.ok) throw new Error('HTTP '+res.status+' -- '+raw.slice(0,120));

  var data; try{ data=JSON.parse(raw); }catch(e){ throw new Error('Bad response from Axis'); }

  // Extract text from Anthropic response shape
  var txt='';
  if(data.content && Array.isArray(data.content)){
    txt = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
  } else if(typeof data.reply==='string'){
    txt = data.reply;
  }
  txt = txt.replace(/```json|```/g,'').trim();

  var plan; try{ plan=JSON.parse(txt); }catch(e){ throw new Error('Axis returned unparseable plan'); }
  if(!plan.items) plan.items=[];
  if(!plan.questions) plan.questions=[];
  return plan;
}

function _bdoRenderPlan(plan){
  var body = document.getElementById('bdoBody');
  var projects = (state.projects||[]).map(function(p){return p.name;});

  if(plan.items.length===0 && plan.questions.length===0){
    body.innerHTML='<div class="bdo-empty">Axis didn\'t find anything to organize.</div>';
    return;
  }

  var html='';

  // -- Clarifying questions first --
  if(plan.questions.length){
    html+='<div class="bdo-section"><div class="bdo-section-label"><i class="ti ti-help-circle" aria-hidden="true"></i> Axis needs your input</div>';
    plan.questions.forEach(function(q,qi){
      html+='<div class="bdo-question" data-qi="'+qi+'">';
      html+='<div class="bdo-question-text"><i class="ti ti-help-circle" aria-hidden="true"></i><div><em>"'+esc(q.text)+'"</em><br>'+esc(q.question)+'</div></div>';
      html+='<div class="bdo-question-opts">';
      (q.options||[]).forEach(function(opt,oi){
        html+='<button class="bdo-qopt" onclick="_bdoAnswerQuestion('+qi+','+oi+',this)">'+esc(opt)+'</button>';
      });
      html+='</div></div>';
    });
    html+='</div>';
  }

  // -- Confident items, each with Task / Note / Ignore picker --
  if(plan.items.length){
    html+='<div class="bdo-section"><div class="bdo-section-label">Proposed organization -- tap to change any</div>';
    plan.items.forEach(function(it,ii){
      // Map Axis dest to one of the three user-facing choices for pre-selection
      var presel = (it.dest==='task'||it.dest==='newproject') ? 'task' : (it.dest==='reminder' ? 'note' : 'note');
      it._userDest = presel;  // default -- user can override

      var projLabel = it.project ? (' <span class="bdo-dest-tag project" style="font-size:10px;">'+esc(it.project)+'</span>') :
                      (it.dest==='newproject' ? ' <span class="bdo-dest-tag newproj" style="font-size:10px;"><i class="ti ti-folder-plus" aria-hidden="true"></i> New: '+esc(it.newProjectName||'Project')+'</span>' : '');

      html+='<div class="bdo-item" id="bdoi_'+ii+'">';
      html+='<div class="bdo-item-body">';
      html+='<div class="bdo-item-text">'+esc(it.text)+'</div>';
      html+='<div class="bdo-iopt-row">';
      html+='<button class="bdo-iopt'+(presel==='task'?' sel-task':'')+'" onclick="_bdoPickItemDest('+ii+',\'task\',this)"><i class="ti ti-checklist" aria-hidden="true"></i> Task</button>';
      html+='<button class="bdo-iopt'+(presel==='note'?' sel-note':'')+'" onclick="_bdoPickItemDest('+ii+',\'note\',this)"><i class="ti ti-notebook" aria-hidden="true"></i> Note</button>';
      html+='<button class="bdo-iopt" onclick="_bdoPickItemDest('+ii+',\'ignore\',this)">Ignore</button>';
      if(projLabel) html+='<span style="margin-left:4px;display:inline-flex;align-items:center;">'+projLabel+'</span>';
      html+='</div>';
      html+='</div>';
      html+='</div>';
    });
    html+='</div>';
  }

  body.innerHTML=html;
  document.getElementById('bdoFooter').style.display='flex';
  _bdoUpdateApplyState();
}

// User answers a clarifying question → convert it into a plan item
function _bdoAnswerQuestion(qi, oi, btnEl){
  var q = _bdoPlan.questions[qi];
  if(!q) return;
  var answer = q.options[oi];

  // Mark selected visually
  var optsWrap = btnEl.parentElement;
  optsWrap.querySelectorAll('.bdo-qopt').forEach(function(b){b.classList.remove('selected');});
  btnEl.classList.add('selected');

  // Interpret the answer into a destination
  var projects = (state.projects||[]).map(function(p){return p.name;});
  var newItem = {thoughtId:q.thoughtId, text:q.text, dest:'task', project:'', priority:'med'};

  var ans = answer.toLowerCase();
  if(ans.indexOf('note')>=0){ newItem.dest='note'; }
  else if(ans.indexOf('reminder')>=0){ newItem.dest='reminder'; }
  else if(ans.indexOf('new project')>=0||ans.indexOf('new:')>=0){ newItem.dest='newproject'; newItem.newProjectName=q.text.slice(0,40); }
  else {
    // Check if the answer matches an existing project name
    var match = projects.find(function(p){ return ans.indexOf(p.toLowerCase())>=0; });
    if(match){ newItem.dest='task'; newItem.project=match; }
    else { newItem.dest='task'; }
  }

  // Store the resolved answer on the question, mark it answered
  q._resolved = newItem;
  _bdoUpdateApplyState();
}

function _bdoUpdateApplyState(){
  // Apply button enabled only when every question has been answered
  var unanswered = (_bdoPlan.questions||[]).filter(function(q){ return !q._resolved; }).length;
  var btn = document.getElementById('bdoApplyBtn');
  if(btn){
    btn.disabled = unanswered>0;
    btn.textContent = unanswered>0 ? 'Answer '+unanswered+' question'+(unanswered===1?'':'s')+' first' : 'Apply Organization';
  }
}

function _bdoPickItemDest(ii, dest, btnEl){
  var it = _bdoPlan && _bdoPlan.items[ii];
  if(!it) return;
  it._userDest = dest;
  var card = document.getElementById('bdoi_'+ii);
  if(card){
    card.querySelectorAll('.bdo-iopt').forEach(function(b){
      b.classList.remove('sel-task','sel-note','sel-ignore');
    });
    if(dest==='task') btnEl.classList.add('sel-task');
    else if(dest==='note') btnEl.classList.add('sel-note');
    else if(dest==='ignore') btnEl.classList.add('sel-ignore');
    if(dest==='ignore') card.classList.add('bdo-ignored');
    else card.classList.remove('bdo-ignored');
  }
}

function bdOrganizeApply(){
  if(!_bdoPlan) return;
  // Gather items -- use _userDest selection; skip anything set to 'ignore'
  var toApply = [];
  (_bdoPlan.items||[]).forEach(function(it){
    var dest = it._userDest || it.dest;
    if(dest !== 'ignore') toApply.push(Object.assign({}, it, {dest: dest}));
  });
  // Add resolved questions
  (_bdoPlan.questions||[]).forEach(function(q){ if(q._resolved) toApply.push(q._resolved); });

  if(toApply.length===0){ toast('Nothing selected to apply'); return; }

  var now = new Date();
  var counts = {task:0,note:0,reminder:0,project:0};
  var processedThoughtIds = [];

  toApply.forEach(function(it){
    processedThoughtIds.push(it.thoughtId);

    if(it.dest==='newproject'){
      var pname = it.newProjectName || it.text.slice(0,40);
      // Reuse existing project of same name if it exists
      var existing = (state.projects||[]).find(function(p){return p.name.toLowerCase()===pname.toLowerCase();});
      if(existing){
        existing.subtasks=existing.subtasks||[];
        existing.subtasks.push({id:'st'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',done:false});
      } else {
        state.projects.push({id:'p'+Date.now()+Math.random().toString(36).slice(2,6),name:pname,due:'',expanded:true,subtasks:[{id:'st'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',done:false}]});
        counts.project++;
      }
      counts.task++;
    }
    else if(it.dest==='task'){
      if(it.project){
        var proj = (state.projects||[]).find(function(p){return p.name.toLowerCase()===it.project.toLowerCase();});
        if(proj){
          proj.subtasks=proj.subtasks||[];
          proj.subtasks.push({id:'st'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',done:false});
        } else {
          state.tasks=state.tasks||[];
          state.tasks.push({id:'t'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',done:false});
        }
      } else {
        state.tasks=state.tasks||[];
        state.tasks.push({id:'t'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',done:false});
      }
      counts.task++;
    }
    else if(it.dest==='note'){
      var pid='';
      if(it.project){ var np=(state.projects||[]).find(function(p){return p.name.toLowerCase()===it.project.toLowerCase();}); if(np)pid=np.id; }
      state.notes=state.notes||[];
      state.notes.push({id:'n'+Date.now()+Math.random().toString(36).slice(2,6),label:it.text.slice(0,40),body:it.text,projectId:pid,projectIds:pid?[pid]:[],created:now.toISOString(),date:now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),time:now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})});
      counts.note++;
    }
    else if(it.dest==='reminder'){
      state.reminders=state.reminders||[];
      state.reminders.push({id:'rem'+Date.now()+Math.random().toString(36).slice(2,6),text:it.text,date:'',time:'',projectId:'',projectIds:[]});
      counts.reminder++;
    }
  });

  // Remove processed thoughts -- split sub-IDs (thoughtId_s0, _s1…) map back to parent
  var parentIdsToRemove = {};
  processedThoughtIds.forEach(function(id){
    // Sub-thought id format: originalId_s0, originalId_h0 -- strip the suffix
    var parentId = id.replace(/_[sh]\d+$/, '');
    parentIdsToRemove[parentId] = true;
    parentIdsToRemove[id] = true; // also handle non-split ids directly
  });
  state.thoughts = state.thoughts.filter(function(t){ if(parentIdsToRemove[t.id]){_tombstone(t.id);return false;} return true; });

  save();
  renderThoughts(); renderProjects(); renderTaskList(); renderNotes(); renderReminders();

  var parts=[];
  if(counts.task)parts.push(counts.task+' task'+(counts.task===1?'':'s'));
  if(counts.note)parts.push(counts.note+' note'+(counts.note===1?'':'s'));
  if(counts.reminder)parts.push(counts.reminder+' reminder'+(counts.reminder===1?'':'s'));
  if(counts.project)parts.push(counts.project+' new project'+(counts.project===1?'':'s'));
  toast('Organized into '+(parts.join(', ')||'nothing'));

  bdOrganizeClose();
}

function bdOrganizeClose(){
  document.getElementById('bdOrganizeModal').classList.remove('open');
  _bdoPlan = null;
}

// ── NOTES ORGANIZER (Organize with Axis for Notes) ──────────────────────
var _norgPlan = null;

async function noteOrganize(noteId){
  var note = (state.notes||[]).find(function(n){return n.id===noteId;});
  if(!note){
    toast('Note not found');
    return;
  }

  document.getElementById('norgBody').innerHTML='<div class="bdo-status"><div class="bdo-spinner"></div> Axis is reviewing this note…</div>';
  document.getElementById('norgFooter').style.display='none';
  document.getElementById('noteOrganizeModal').classList.add('open');

  try {
    var plan = await _norgRequestPlan(noteId);
    _norgPlan = plan;
    _norgRenderPlan(plan);
  } catch(e){
    console.error('[norg] organize error', e);
    document.getElementById('norgBody').innerHTML='<div class="bdo-empty">Axis couldn\'t organize right now.<br><span style="font-size:11px;">'+esc(e.message||'Unknown error')+'</span></div>';
  }
}

async function _norgRequestPlan(noteId){
  var projects = (state.projects||[]).map(function(p){ return p.name; });
  var srcNote = state.notes.find(function(n){return n.id===noteId;});
  if(!srcNote) return {items:[]};
  var noteData = {id:srcNote.id, label:srcNote.label||'', body:_stripHtml(srcNote.body||'').slice(0,800), projects:(srcNote.projectIds||[]).map(function(pid){var p=(state.projects||[]).find(function(x){return x.id===pid;});return p?p.name:'';}).filter(Boolean)};

  var sys = 'You are Axis, organizing a note for an ADHD user of the Centerpost productivity app. '
    + 'Break the note into individual actionable lines. Output ONLY raw JSON (no markdown, no code fences).\n\n'
    + 'EXISTING PROJECTS: '+(projects.length?JSON.stringify(projects):'(none yet)')+'\n\n'
    + 'For EACH distinct idea, bullet point, or actionable line in the note, create one item.\n'
    + 'Decide a destination for each:\n'
    + '- "task": actionable to-do item\n'
    + '- "reminder": time-sensitive item the user should be reminded about\n'
    + '- "ignore": informational only, no action needed\n\n'
    + 'For each item, also assign a project from the EXISTING PROJECTS list if it fits. Leave project empty string if none fit.\n\n'
    + 'IMPORTANT: The original note is NEVER deleted. You are extracting action items from it.\n\n'
    + 'Return this exact JSON shape:\n'
    + '{"items":[\n'
    + '  {"text":"<clear actionable restatement>","dest":"task|reminder|ignore","project":"<existing project name or empty>"}\n'
    + ']}\n\n'
    + 'Keep text concise and actionable. Bias toward creating tasks from anything that looks like a to-do.';

  var userMsg = 'Break this note into actionable items:\nTitle: '+noteData.label+'\nBody: '+noteData.body
    +(noteData.projects.length?'\nTagged projects: '+noteData.projects.join(', '):'');

  var endpoint = (typeof JARVIS_PROXY_URL!=='undefined' && JARVIS_PROXY_URL) || '';
  var res = await fetch(endpoint, {
    method:'POST',
    headers:await _jarvisAuthHeaders(),
    body:JSON.stringify({
      model:'claude-haiku-4-5-20251001',
      max_tokens:2000,
      system:sys,
      messages:[{role:'user',content:userMsg}]
    })
  });

  var raw = await res.text();
  if(!res.ok) throw new Error('HTTP '+res.status+' -- '+raw.slice(0,120));

  var data; try{ data=JSON.parse(raw); }catch(e){ throw new Error('Bad response from Axis'); }

  var txt='';
  if(data.content && Array.isArray(data.content)){
    txt = data.content.filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
  } else if(typeof data.reply==='string'){
    txt = data.reply;
  }
  txt = txt.replace(/```json|```/g,'').trim();

  var plan; try{ plan=JSON.parse(txt); }catch(e){ throw new Error('Axis returned unparseable plan'); }
  if(!plan.items) plan.items=[];
  return plan;
}

function _norgRenderPlan(plan){
  var body = document.getElementById('norgBody');

  if(plan.items.length===0){
    body.innerHTML='<div class="bdo-empty">Nothing actionable found in this note.</div>';
    return;
  }

  var html='<div class="bdo-section"><div class="bdo-section-label">Proposed organization -- tap to change any</div>';

  plan.items.forEach(function(it, ii){
    var presel = it.dest==='reminder' ? 'reminder' : (it.dest==='ignore' ? 'ignore' : 'task');
    it._userDest = presel;
    it._userProject = it.project || '';

    var projLabel = it._userProject ? ' <span class="bdo-dest-tag project" style="font-size:10px;cursor:pointer;" onclick="_norgPickProject('+ii+',this)">'+esc(it._userProject)+'</span>' : '';

    html+='<div class="bdo-item" id="norgi_'+ii+'">';
    html+='<div class="bdo-item-body">';
    html+='<div class="bdo-item-text">'+esc(it.text)+'</div>';
    html+='<div class="bdo-iopt-row">';
    html+='<button class="bdo-iopt'+(presel==='task'?' sel-task':'')+'" onclick="_norgPickDest('+ii+',\'task\',this)"><i class="ti ti-checklist" aria-hidden="true"></i> Task</button>';
    html+='<button class="bdo-iopt'+(presel==='reminder'?' sel-note':'')+'" onclick="_norgPickDest('+ii+',\'reminder\',this)"><i class="ti ti-bell" aria-hidden="true"></i> Reminder</button>';
    html+='<button class="bdo-iopt'+(presel==='ignore'?' sel-ignore':'')+'" onclick="_norgPickDest('+ii+',\'ignore\',this)">Ignore</button>';
    html+='<span class="norg-proj-wrap" id="norgproj_'+ii+'" style="margin-left:4px;display:inline-flex;align-items:center;">'+projLabel+'</span>';
    html+='<button class="bdo-iopt" style="margin-left:auto;font-size:10px;padding:2px 6px;" onclick="_norgPickProject('+ii+',this)"><i class="ti ti-folder" aria-hidden="true"></i> '+(it._userProject?'Change':'+ Project')+'</button>';
    html+='</div>';
    html+='</div>';
    html+='</div>';
  });

  html+='</div>';
  body.innerHTML=html;
  document.getElementById('norgFooter').style.display='flex';
}

function _norgPickDest(ii, dest, btnEl){
  var it = _norgPlan && _norgPlan.items[ii];
  if(!it) return;
  it._userDest = dest;
  var card = document.getElementById('norgi_'+ii);
  if(card){
    card.querySelectorAll('.bdo-iopt').forEach(function(b){
      b.classList.remove('sel-task','sel-note','sel-ignore');
    });
    if(dest==='task') btnEl.classList.add('sel-task');
    else if(dest==='reminder') btnEl.classList.add('sel-note');
    else if(dest==='ignore') btnEl.classList.add('sel-ignore');
    if(dest==='ignore') card.classList.add('bdo-ignored');
    else card.classList.remove('bdo-ignored');
  }
}

function _norgPickProject(ii, btnEl){
  var it = _norgPlan && _norgPlan.items[ii];
  if(!it) return;
  var existing = document.getElementById('norgProjPicker_'+ii);
  if(existing){ existing.remove(); return; }

  var projects = _sortedProjects ? _sortedProjects() : (state.projects||[]);
  var wrap = document.createElement('div');
  wrap.id = 'norgProjPicker_'+ii;
  wrap.style.cssText = 'position:absolute;z-index:10;background:var(--surface-raised);border:1px solid var(--border);border-radius:6px;padding:4px 0;max-height:200px;overflow-y:auto;min-width:160px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';

  var html = '<div style="padding:4px 10px;font-size:11px;cursor:pointer;color:var(--text-dim);" onclick="_norgSetProject('+ii+',\'\')">None (remove)</div>';
  projects.forEach(function(p){
    var sel = (it._userProject||'').toLowerCase()===(p.name||'').toLowerCase();
    html+='<div style="padding:4px 10px;font-size:11px;cursor:pointer;color:'+(sel?'var(--accent)':'var(--text)')+';font-weight:'+(sel?'700':'400')+';" onclick="_norgSetProject('+ii+',\''+esc(p.name).replace(/'/g,"\\'")+'\')">'+esc(p.name)+'</div>';
  });
  wrap.innerHTML = html;

  var row = btnEl.closest('.bdo-iopt-row');
  row.style.position = 'relative';
  row.appendChild(wrap);

  setTimeout(function(){ document.addEventListener('click', function closer(e){ if(!wrap.contains(e.target)&&e.target!==btnEl){ wrap.remove(); document.removeEventListener('click',closer); } }); },0);
}

function _norgSetProject(ii, projName){
  var it = _norgPlan && _norgPlan.items[ii];
  if(!it) return;
  it._userProject = projName;

  var projWrap = document.getElementById('norgproj_'+ii);
  if(projWrap){
    projWrap.innerHTML = projName ? '<span class="bdo-dest-tag project" style="font-size:10px;cursor:pointer;" onclick="_norgPickProject('+ii+',this)">'+esc(projName)+'</span>' : '';
  }
  var card = document.getElementById('norgi_'+ii);
  if(card){
    var projBtn = card.querySelector('.bdo-iopt-row button:last-child');
    if(projBtn){ projBtn.innerHTML = '<i class="ti ti-folder" aria-hidden="true"></i> '+(projName?'Change':'+ Project'); }
  }
  var picker = document.getElementById('norgProjPicker_'+ii);
  if(picker) picker.remove();
}

function noteOrganizeApply(){
  if(!_norgPlan) return;
  var counts = {task:0,reminder:0};

  _norgPlan.items.forEach(function(it){
    var dest = it._userDest || it.dest;
    if(dest==='ignore') return;

    var projName = it._userProject || '';

    if(dest==='task'){
      if(projName){
        var p=(state.projects||[]).find(function(x){return x.name.toLowerCase()===projName.toLowerCase();});
        if(p){
          p.subtasks=p.subtasks||[];
          p.subtasks.push({id:'st'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',done:false});
        } else {
          state.tasks=state.tasks||[];
          state.tasks.push({id:'t'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',projectId:'',projectIds:[],done:false});
        }
      } else {
        state.tasks=state.tasks||[];
        state.tasks.push({id:'t'+Date.now()+Math.random().toString(36).slice(2,6),name:it.text,due:'',priority:_safePriority(it.priority),timeEst:'',projectId:'',projectIds:[],done:false});
      }
      counts.task++;
    }
    else if(dest==='reminder'){
      state.reminders=state.reminders||[];
      state.reminders.push({id:'rem'+Date.now()+Math.random().toString(36).slice(2,6),text:it.text,date:'',time:'',projectId:'',projectIds:[]});
      counts.reminder++;
    }
  });

  save();
  renderNotes(); renderProjects(); renderTaskList(); renderReminders();

  var parts=[];
  if(counts.task)parts.push(counts.task+' task'+(counts.task===1?'':'s')+' created');
  if(counts.reminder)parts.push(counts.reminder+' reminder'+(counts.reminder===1?'':'s')+' created');
  toast(parts.length ? parts.join(', ') : 'No changes applied');

  noteOrganizeClose();
}

function noteOrganizeClose(){
  document.getElementById('noteOrganizeModal').classList.remove('open');
  _norgPlan = null;
}

function renderThoughts(){
if(_isEditingInPanel('thoughtChips')){_deferPanelRender('thoughtChips');return;}
document.getElementById('thoughtChips').innerHTML=state.thoughts.map(t=>'<div class="thought-chip"><span class="editable" id="tt_'+t.id+'">'+esc(t.text)+'</span><span class="chip-promote" onclick="promoteThought(\''+t.id+'\')">\u2197</span><span class="chip-x" onclick="deleteThought(\''+t.id+'\')">\u00D7</span></div>').join('');state.thoughts.forEach(t=>{const e=document.getElementById('tt_'+t.id);if(e)makeEditable(e,v=>editThought(t.id,v));});refreshEditables();}

// ENERGY & MOOD
function setEnergy(el,v){state.energy=v;document.querySelectorAll('#energyPills .em-pill').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');logMoodEntry();save();showStateAdvice();updateWellnessVisibility();var today=_dayKey();if(state.points&&state.points.lastEnergyDate!==today){state.points.lastEnergyDate=today;save();addPoints('mood_energy',el);}}
function setMood(el,v){state.mood=v;document.querySelectorAll('#moodPills .em-pill').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');logMoodEntry();save();showStateAdvice();updateWellnessVisibility();var today=_dayKey();if(state.points&&state.points.lastMoodDate!==today){state.points.lastMoodDate=today;save();addPoints('mood_energy',el);}}
var adviceMap={'high-focused':{t:'\u{1F525} Peak state \u2014 tackle your hardest task now.',cls:'state-advice-positive'},'high-scattered':{t:'\u26A1 Energy but no focus. Start a Pomodoro.',cls:'state-advice'},'high-anxious':{t:'\u{1F4A8} Burn off anxious energy with something physical.',cls:'state-advice'},'high-calm':{t:'\u2728 Great for creative work or complex problems.',cls:'state-advice-positive'},'good-focused':{t:'\u{1F44D} Solid state. Pick a medium-priority task.',c:'var(--green)'},'good-scattered':{t:'\u{1F4CB} List 3 things, do just the first one.',cls:'state-advice'},'good-anxious':{t:'\u{1F4DD} Channel worry into a task with a clear endpoint.',c:'var(--blue)'},'good-calm':{t:'\u{1F33F} Good baseline. Handle routine tasks or admin.',c:'var(--green)'},'low-focused':{t:'\u{1F3AF} Low but present? Detail work \u2014 editing, reviewing.',c:'var(--blue)'},'low-scattered':{t:'\u{1FAE7} Not deep work time. 5-min break, then one tiny task.',cls:'state-advice-alert'},'low-anxious':{t:'\u{1F9CA} Pause. Check the Grounding Toolkit \u2192',c:'var(--purple)'},'low-calm':{t:'\u2601\uFE0F Rest state. Gentle tasks or a proper break.',c:'var(--blue)'},'crashed-focused':{t:'\u26A0\uFE0F Running on fumes. Only truly urgent items.',cls:'state-advice-alert'},'crashed-scattered':{t:'\u{1F6D1} Brain needs a reset. Check the Grounding Toolkit \u2192',cls:'state-advice-alert'},'crashed-anxious':{t:'\u{1FAC2} Hardest state. Grounding Toolkit first, then reassess.',c:'var(--red)'},'crashed-calm':{t:'\u{1F319} Depleted but peaceful. Gentle admin or rest.',cls:'state-advice'}};
// R3 stage 2: when the advice text itself points at the Grounding Toolkit
// ("Check the Grounding Toolkit →"), that pointer must BE the door -- it was
// inert text, and on mobile the wellness panel had no other entry point at
// all (no MOBILE_PANELS row, no direct-jump caller): the app named its own
// remedy in its worst states and then dead-ended. Detected by text match so
// any future adviceMap copy that mentions the toolkit is automatically live.
function showStateAdvice(){const el=document.getElementById('stateAdvice');if(!state.energy||!state.mood){el.innerHTML='';return;}const k=state.energy+'-'+state.mood;const a=adviceMap[k];if(!a)return;var gt=/Grounding Toolkit/.test(a.t);el.innerHTML='<div class="decision-prompt state-advice '+(a.cls||'')+'"'+(gt?' role="button" tabindex="0" aria-label="Open the Grounding Toolkit" style="cursor:pointer;" onclick="openGroundingToolkit()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openGroundingToolkit();}"':'')+'>'+a.t+(gt?' <span style="text-decoration:underline;">Open</span>':'')+'</div>';}

// The one door that always opens. An explicit tap is an invitation, so this
// intentionally overrides the 'lean' Support Level -- R12's contract is that
// lean only suppresses UNINVITED popups, while the tools stay a tap away.
// Closes the Energy & Mood modal first (the advice banner lives inside it),
// then navigates: mobile pushes the wellness panel, desktop scrolls to it.
function openGroundingToolkit(){
  var wp=document.querySelector('[data-panel="wellness"]');
  if(!wp)return;
  wp.classList.remove('hidden-panel');
  if(typeof populateWellnessDropdown==='function')populateWellnessDropdown();
  if(typeof closeEnergyModal==='function')closeEnergyModal();
  if(_isMobile()){
    showMobilePanel('wellness');
  }else{
    wp.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

// WELLNESS TOOLKIT - conditional visibility
var triggerStates=['low','crashed','anxious','scattered'];
// R12: 'lean' support level suppresses the auto-popup entirely -- the panel
// itself, HALT+, and Breathwork stay reachable via the Tool Kit regardless,
// this only controls whether low mood/energy interrupts with it uninvited.
function shouldShowWellness(){if(state.supportLevel==='lean')return false;return triggerStates.includes(state.energy)||triggerStates.includes(state.mood);}

function updateWellnessVisibility(){
  const wp=document.querySelector('[data-panel="wellness"]');
  if(shouldShowWellness()){
    wp.classList.remove('hidden-panel');
    const triggers=[];
    if(triggerStates.includes(state.energy))triggers.push(state.energy);
    if(triggerStates.includes(state.mood))triggers.push(state.mood);
    document.getElementById('wellnessTrigger').textContent=triggers.join(' + ');
    populateWellnessDropdown();
  }else{
    wp.classList.add('hidden-panel');
    stopGuided();
  }
}

var wellnessTechniques=[
{id:'grounding54321',name:'5-4-3-2-1 Grounding',icon:'\u{1F590}\uFE0F',source:'Ackerman, 2017 \u2014 sensory-based anxiety intervention',bestFor:['anxious','scattered'],steps:[{n:'5',t:'Name <strong>5 things you can see</strong>.'},{n:'4',t:'Touch <strong>4 things you can feel</strong>. Notice textures.'},{n:'3',t:'Identify <strong>3 things you can hear</strong>.'},{n:'2',t:'Notice <strong>2 things you can smell</strong>.'},{n:'1',t:'<strong>1 thing you can taste</strong>.'}],guided:false},
{id:'box_breathing',name:'Box Breathing (4-4-4-4)',icon:'\u{1FAC1}',source:'Balban et al., 2023, Cell Reports Medicine \u2014 Navy SEAL protocol',bestFor:['anxious','crashed'],steps:[{n:'1',t:'<strong>Inhale</strong> through nose, 4 sec.'},{n:'2',t:'<strong>Hold</strong> 4 sec.'},{n:'3',t:'<strong>Exhale</strong> through mouth, 4 sec.'},{n:'4',t:'<strong>Hold empty</strong> 4 sec.'},{n:'\u2192',t:'Repeat 4\u20136 cycles. Activates parasympathetic nervous system.'}],guided:true,gd:{phases:['Inhale','Hold','Exhale','Hold'],dur:[4,4,4,4],cycles:5}},
{id:'physiological_sigh',name:'Physiological Sigh',icon:'\u{1F4A8}',source:'Balban et al., 2023, Cell Reports Medicine \u2014 Stanford/Huberman Lab',bestFor:['anxious','crashed'],steps:[{n:'1',t:'<strong>Deep inhale</strong> through nose.'},{n:'2',t:'<strong>Second short sniff</strong> in through nose (reinflates alveoli).'},{n:'3',t:'<strong>Long slow exhale</strong> through mouth \u2014 2x inhale length.'},{n:'\u2192',t:'Fastest known voluntary method to reduce autonomic arousal. Even 1 cycle works.'}],guided:false},
{id:'pmr',name:'Progressive Muscle Relaxation',icon:'\u{1F4AA}',source:'Jacobson, 1938; Toussaint et al., 2021 systematic review',bestFor:['anxious','low'],steps:[{n:'1',t:'<strong>Feet:</strong> Curl toes tight 5 sec, release.'},{n:'2',t:'<strong>Thighs:</strong> Squeeze 5 sec, release.'},{n:'3',t:'<strong>Fists:</strong> Clench 5 sec, release.'},{n:'4',t:'<strong>Shoulders:</strong> Shrug to ears 5 sec, drop.'},{n:'5',t:'<strong>Face:</strong> Scrunch everything 5 sec, release.'}],guided:false},
{id:'breathing_478',name:'4-7-8 Breathing',icon:'\u{1F30A}',source:'Weil, 2015; pranayama \u2014 extended exhale activates vagus nerve',bestFor:['anxious','low','crashed'],steps:[{n:'1',t:'<strong>Inhale</strong> through nose, <strong>4</strong> sec.'},{n:'2',t:'<strong>Hold</strong> <strong>7</strong> sec.'},{n:'3',t:'<strong>Exhale</strong> through mouth, <strong>8</strong> sec.'},{n:'\u2192',t:'Extended exhale shifts to parasympathetic dominance. Do 4 cycles.'}],guided:true,gd:{phases:['Inhale','Hold','Exhale'],dur:[4,7,8],cycles:4}},
{id:'body_scan',name:'2-Minute Body Scan',icon:'\u{1F9D8}',source:'Kabat-Zinn MBSR; Demarzo et al., 2017 meta-analysis',bestFor:['scattered','low','crashed'],steps:[{n:'1',t:'Close eyes. 3 slow breaths.'},{n:'2',t:'<strong>Scan feet to head.</strong> Notice without judgment.'},{n:'3',t:'Breathe <strong>into</strong> tension spots.'},{n:'4',t:'Open eyes slowly.'}],guided:false}
];

function populateWellnessDropdown(){
  const sel=document.getElementById('wellnessSelect');
  let sorted=[...wellnessTechniques];
  const triggers=[state.energy,state.mood].filter(x=>triggerStates.includes(x));
  sorted.sort((a,b)=>{const ar=triggers.some(t=>a.bestFor.includes(t))?0:1;const br=triggers.some(t=>b.bestFor.includes(t))?0:1;return ar-br;});
  sel.innerHTML='<option value="">Choose a technique...</option>'+sorted.map(t=>{const rel=triggers.some(tr=>t.bestFor.includes(tr));return '<option value="'+t.id+'">'+(rel?'\u2605 ':'')+t.icon+' '+t.name+'</option>';}).join('');
  document.getElementById('techniqueDetail').innerHTML='';
  // R3 stage 3: same no-decision-wall rule as the breathwork picker. The sort
  // above already ranks by match to the CURRENT mood/energy -- surface that
  // ranking as a preselected top pick with its steps rendered, instead of a
  // blank "Choose a technique..." at exactly the moment this panel exists
  // for. Rebuilding innerHTML wiped any prior selection anyway, so
  // auto-selecting is strictly more helpful, never less. showSelectedTechnique
  // only renders steps + a Start button; nothing auto-starts.
  if(sorted.length){sel.value=sorted[0].id;showSelectedTechnique();}
}

function showSelectedTechnique(){
  const id=document.getElementById('wellnessSelect').value;
  const el=document.getElementById('techniqueDetail');
  if(!id){el.innerHTML='';return;}
  const t=wellnessTechniques.find(t=>t.id===id);if(!t){el.innerHTML='';return;}
  el.innerHTML='<div class="technique-detail"><div class="td-name">'+t.icon+' '+t.name+'</div><div class="td-source">'+t.source+'</div>'+t.steps.map(s=>'<div class="tc-step"><span class="tc-step-num">'+s.n+'</span><span>'+s.t+'</span></div>').join('')+(t.guided?'<button class="tc-timer-btn" onclick="startGuided(\''+t.id+'\')">\u25B6 Start Guided Timer</button>':'')+'</div>';
}

var guidedInterval=null;
// R3 stage 4 follow-up (F11): the THIRD session surface, missed in the first
// pass. Unlike breathwork this timer runs IN-PANEL (no overlay of its own), so
// the z-900 capture FAB and Axis orb float straight over it -- confirmed on
// device in build 52. It's also the surface the new advice-banner path leads
// to, so it's the one a dysregulated user is most likely to actually reach.
// stopGuided() is called both by the Stop button and by the completion branch
// below, so the class is always torn down.
function startGuided(id){const t=wellnessTechniques.find(t=>t.id===id);if(!t||!t.guided)return;document.body.classList.add('cp-immersive');const disp=document.getElementById('guidedDisplay');disp.classList.add('active');disp.scrollIntoView({behavior:'smooth',block:'nearest'});const{phases,dur,cycles}=t.gd;let cycle=0,pi=0,count=dur[0];function tick(){document.getElementById('guidedPhase').textContent=phases[pi];document.getElementById('guidedCount').textContent=count;document.getElementById('guidedInstruction').textContent='Cycle '+(cycle+1)+' of '+cycles;count--;if(count<0){pi++;if(pi>=phases.length){pi=0;cycle++;if(cycle>=cycles){stopGuided();document.getElementById('guidedPhase').textContent='\u2713 Complete';document.getElementById('guidedCount').textContent='';document.getElementById('guidedInstruction').textContent='Well done. Take a moment.';if(typeof _logCheckIn==='function')_logCheckIn('grounding',{techniqueId:id,techniqueName:t.name});return;}}count=dur[pi];}}tick();guidedInterval=setInterval(tick,1000);}
function stopGuided(){clearInterval(guidedInterval);guidedInterval=null;document.body.classList.remove('cp-immersive');document.getElementById('guidedDisplay').classList.remove('active');}

// NOTES
// ── Rich-text (WYSIWYG) note editor support ───────────────────────────────
// Notes are stored as sanitized HTML (n.rich===true). Legacy notes are
// markdown/plain text and are auto-converted on load. All HTML is sanitized
// on save AND on display so a note body can never inject script/markup.

// Allowlist-based HTML sanitizer. Post-order DFS: clean descendants first,
// then unwrap disallowed elements (keeping their text), strip all attributes
// except a safe http(s) href on <a>.
function _sanitizeNoteHtml(html){
  if(!html) return '';
  var ALLOWED={B:1,STRONG:1,I:1,EM:1,U:1,H3:1,H4:1,UL:1,OL:1,LI:1,A:1,BR:1,P:1,DIV:1,SPAN:1};
  var root=document.createElement('div');
  root.innerHTML=html;
  (function clean(node){
    var kids=[].slice.call(node.childNodes);
    kids.forEach(function(child){
      if(child.nodeType===1){
        clean(child);
        var tag=child.tagName;
        if(!ALLOWED[tag]){
          while(child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        [].slice.call(child.attributes).forEach(function(attr){
          var an=attr.name.toLowerCase();
          if(tag==='A' && an==='href' && /^https?:\/\//i.test(attr.value.trim())) return;
          child.removeAttribute(attr.name);
        });
        if(tag==='A' && child.getAttribute('href')){
          child.setAttribute('target','_blank');
          child.setAttribute('rel','noopener noreferrer');
        }
      } else if(child.nodeType===8){
        node.removeChild(child);
      }
    });
  })(root);
  return root.innerHTML;
}

// Strip tags to plain text (used for search + empty checks).
function _stripHtml(h){
  if(!h) return '';
  var d=document.createElement('div'); d.innerHTML=h; return (d.textContent||'').trim();
}

// Render a note body for display, handling both formats.
function _renderNoteBody(n){
  if(!n) return '';
  if(n.rich===true) return _sanitizeNoteHtml(n.body||'');
  return _renderNoteMarkdown(n.body||'');
}

// One-time migration: convert legacy markdown notes to sanitized HTML.
var _notesMigrated=false;
function _migrateNotesRich(){
  if(_notesMigrated) return false;
  _notesMigrated=true;
  if(!state.notes||!state.notes.length) return false;
  var changed=false;
  for(var i=0;i<state.notes.length;i++){
    var n=state.notes[i];
    if(n && n.rich!==true){
      try{
        n.body=_sanitizeNoteHtml(_renderNoteMarkdown(n.body||''));
        n.rich=true;
        changed=true;
      }catch(e){ /* leave this note untouched on any error */ }
    }
  }
  return changed;
}

// Toolbar action on a contenteditable note editor. Buttons use
// onmousedown="event.preventDefault()" so the editor keeps its selection.
var _noteSavedRange=null;
function _noteFmt(targetId,kind){
  var ed=document.getElementById(targetId);
  if(!ed) return;
  ed.focus();
  if(kind==='bold'){ document.execCommand('bold'); }
  else if(kind==='italic'){ document.execCommand('italic'); }
  else if(kind==='header'){
    var blk=(document.queryCommandValue('formatBlock')||'').toLowerCase();
    document.execCommand('formatBlock', false, (blk==='h3'||blk==='<h3>')?'div':'h3');
  }
  else if(kind==='bullet'){ document.execCommand('insertUnorderedList'); }
  else if(kind==='link'){
    var sel=window.getSelection();
    if(sel && sel.rangeCount) _noteSavedRange=sel.getRangeAt(0).cloneRange();
    var url=prompt('Link URL (https://...)','https://');
    ed.focus();
    if(_noteSavedRange){ sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(_noteSavedRange); }
    if(url && /^https?:\/\//i.test(url)) document.execCommand('createLink', false, url);
    _noteSavedRange=null;
  }
  var ev=document.createEvent('Event'); ev.initEvent('input',true,true); ed.dispatchEvent(ev);
}

// Build a formatting toolbar targeting a given editor id.
function _noteToolbarHtml(targetId,extraId){
  function b(kind,title,inner){
    return '<button type="button" class="note-fmt-btn" title="'+title+'" onmousedown="event.preventDefault()" onclick="_noteFmt(\''+targetId+'\',\''+kind+'\')">'+inner+'</button>';
  }
  return '<div class="note-fmt-bar"'+(extraId?' id="'+extraId+'"':'')+' role="toolbar" aria-label="Formatting">'+
    b('bold','Bold','<b>B</b>')+b('italic','Italic','<i>I</i>')+b('header','Header','H')+
    b('bullet','Bullet list','&bull;')+b('link','Link','&#128279;')+'</div>';
}

function addNote(){const label=document.getElementById('newNoteLabel').value.trim();const bodyEl=document.getElementById('newNoteBody');const body=_sanitizeNoteHtml(bodyEl?bodyEl.innerHTML:'');const bodyText=_stripHtml(body);if(!label&&!bodyText)return;const projVal=document.getElementById('newNoteProject').value;const projIds=projVal?projVal.split(',').filter(Boolean):[];const now=new Date();state.notes.push({id:'n'+Date.now(),label:label||'Untitled',body:body,rich:true,projectId:projIds[0]||'',projectIds:projIds,created:now.toISOString(),date:now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),time:now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})});document.getElementById('newNoteLabel').value='';if(bodyEl)bodyEl.innerHTML='';document.getElementById('newNoteProject').value='';renderProjMultiPickerChips(document.getElementById('newNoteProjectPicker'));save();renderNotes();renderProjects();if(projIds.length>1)toast('Note added to '+projIds.length+' projects');_trackEvent('tool_use','add_note','Add Note');}
function deleteNote(id){_confirm('Delete this note?',function(){_tombstone(id);state.notes=state.notes.filter(n=>n.id!==id);save();renderNotes();},{destructive:true,confirmText:'Delete'});}
function editNoteLabel(id,v){if(!v)return;const n=state.notes.find(n=>n.id===id);if(n){n.label=v;save();}}
function editNoteBody(id,v){const n=state.notes.find(n=>n.id===id);if(n){n.body=v;save();}}

// -- Lightweight markdown renderer for note bodies --------------------------
// Supports: **bold**, *italic*, # / ## headers, - bullets, [text](url) links.
// Always escapes HTML first, so user text can never inject markup.
function _renderNoteMarkdown(text){
  if(!text) return '';
  // 1. Escape all HTML entities first (security + correctness)
  var s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  var lines = s.split('\n');
  var html = '';
  var inList = false;

  for(var i=0;i<lines.length;i++){
    var line = lines[i];
    var trimmed = line.trim();

    // Bullets: "- " or "* " at line start
    var bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if(bulletMatch){
      if(!inList){ html+='<ul>'; inList=true; }
      html += '<li>'+_mdInline(bulletMatch[1])+'</li>';
      continue;
    } else if(inList){
      html += '</ul>'; inList=false;
    }

    // Headers: ## or #
    if(/^##\s+/.test(trimmed)){
      html += '<h4>'+_mdInline(trimmed.replace(/^##\s+/,''))+'</h4>';
    } else if(/^#\s+/.test(trimmed)){
      html += '<h3>'+_mdInline(trimmed.replace(/^#\s+/,''))+'</h3>';
    } else if(trimmed===''){
      // blank line -- paragraph break (skip; spacing handled by p margins)
    } else {
      html += '<p>'+_mdInline(line)+'</p>';
    }
  }
  if(inList) html += '</ul>';
  return html;
}

// Inline markdown: bold, italic, links. Operates on already-escaped text.
function _mdInline(t){
  // Links [text](url) -- only http/https allowed
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function(m,txt,url){
    return '<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+txt+'</a>';
  });
  // Bold **text**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *text* (after bold so ** is consumed first)
  t = t.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
  return t;
}

// Guards the notes list against being rebuilt out from under an open editor.
// The Firestore realtime listener re-renders every panel on each snapshot
// (including our own saves), so a snapshot landing mid-edit would wipe the
// contenteditable the user is typing into. renderNotes() defers while a note
// editor holds focus; toggleNoteEdit() flushes the deferred render on close.
var _notesRenderPending=false;
function _noteEditorFocused(){
  var ae=document.activeElement;
  return !!(ae&&ae.classList&&ae.classList.contains('note-body-edit'));
}

// Toggle a single note between rendered view and rich edit mode
function toggleNoteEdit(id){
  var rendered = document.getElementById('nbr_'+id);
  var editor = document.getElementById('nb_'+id);
  var bar = document.getElementById('nbbarwrap_'+id);
  var toggle = document.getElementById('nbtoggle_'+id);
  if(!editor) return;
  var editing = editor.style.display !== 'none';
  if(editing){
    var clean = _sanitizeNoteHtml(editor.innerHTML);
    var n = state.notes.find(function(x){return x.id===id;});
    if(n){ n.body = clean; n.rich = true; save(); }
    if(rendered){ rendered.innerHTML = _renderNoteBody(n||{body:clean,rich:true}); rendered.style.display=''; }
    editor.style.display='none';
    if(bar) bar.style.display='none';
    if(toggle) toggle.innerHTML='<i class="ti ti-pencil" aria-hidden="true"></i>Edit';
    // Editing finished -- release focus (so the deferred-render guard clears),
    // then run any list rebuild that was deferred while the editor was open so
    // remote changes that arrived mid-edit now show.
    editor.blur();
    if(_notesRenderPending) renderNotes();
  } else {
    if(rendered) rendered.style.display='none';
    editor.style.display='';
    editor.focus();
    if(bar) bar.style.display='';
    if(toggle) toggle.innerHTML='<i class="ti ti-check" aria-hidden="true"></i>Done';
  }
}
function editNoteProject(id,projId){const n=state.notes.find(n=>n.id===id);if(n){n.projectId=projId;n.projectIds=projId?[projId]:[];save();renderNotes();renderProjects();}}
function editNoteProjects(id,projIdsStr){const n=state.notes.find(n=>n.id===id);if(n){var ids=projIdsStr?projIdsStr.split(',').filter(Boolean):[];n.projectIds=ids;n.projectId=ids[0]||'';save();renderProjects();}}
function autoResizeTextarea(ta){ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';}
function updateNoteSelectors(){
  // Filter dropdown for notes (still single-select) -- preserve current selection
  const noteFilterEl=document.getElementById('noteFilterProj');
  const prevNoteFilter=noteFilterEl?noteFilterEl.value:'all';
  const fOpts='<option value="all">All projects</option><option value="none">Untagged</option>'+_sortedProjects().map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
  if(noteFilterEl){
    noteFilterEl.innerHTML=fOpts;
    if(prevNoteFilter&&[].slice.call(noteFilterEl.options).some(function(o){return o.value===prevNoteFilter;}))noteFilterEl.value=prevNoteFilter;
  }
  // Filter dropdown for tasks (still single-select)
  var taskFilterEl=document.getElementById('tlFilterProj');
  if(taskFilterEl){
    var prevVal=taskFilterEl.value;
    taskFilterEl.innerHTML='<option value="all">Projects</option>'+_sortedProjects().map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join('');
    if(prevVal&&[].slice.call(taskFilterEl.options).some(function(o){return o.value===prevVal;}))taskFilterEl.value=prevVal;
  }
  // Render any open multi-pickers
  ['newNoteProjectPicker','tlNewProjectPicker','newRemProjectPicker'].forEach(function(pid){
    var picker=document.getElementById(pid);
    if(picker)renderProjMultiPickerChips(picker);
  });
}

// =======================================
// MULTI-PROJECT PICKER
// =======================================
function _getProjMultiSelected(picker){
  var hidden=document.getElementById(picker.dataset.target);
  if(!hidden||!hidden.value)return [];
  return hidden.value.split(',').filter(Boolean);
}
function _setProjMultiSelected(picker,ids){
  var hidden=document.getElementById(picker.dataset.target);
  if(hidden)hidden.value=ids.join(',');
  renderProjMultiPickerChips(picker);
}

function renderProjMultiPickerChips(picker){
  var selected=_getProjMultiSelected(picker);
  // Preserve any open dropdown
  var dropdown=picker.querySelector('.proj-multi-dropdown');
  picker.innerHTML='';
  if(selected.length===0){
    var ph=document.createElement('span');
    ph.className='proj-multi-placeholder';
    ph.textContent=picker.dataset.placeholder||(picker.dataset.allowNew?'+ Projects':'+ Tag projects (optional)');
    picker.appendChild(ph);
  }else{
    selected.forEach(function(pid){
      var p=state.projects.find(function(pr){return pr.id===pid;});
      if(!p)return;
      var chip=document.createElement('span');
      chip.className='proj-multi-chip';
      chip.innerHTML=esc(p.name)+' <span class="proj-multi-chip-x" onclick="event.stopPropagation();removeProjMultiChip(this,\''+pid+'\')">\u2715</span>';
      picker.appendChild(chip);
    });
  }
  if(dropdown)picker.appendChild(dropdown);
}

function removeProjMultiChip(xEl,pid){
  var picker=xEl.closest('.proj-multi-picker');
  if(!picker)return;
  var ids=_getProjMultiSelected(picker).filter(function(x){return x!==pid;});
  _setProjMultiSelected(picker,ids);
}

function openProjMultiPicker(ev,picker){
  if(ev.target.classList.contains('proj-multi-chip-x'))return;
  if(ev.target.closest('.proj-multi-dropdown'))return;
  
  // Close any other open dropdowns (now portaled to body -- find globally)
  document.querySelectorAll('.proj-multi-dropdown').forEach(function(d){
    if(d._owner!==picker)d.remove();
  });
  
  // Toggle: if a dropdown for THIS picker is already open, close it
  var existing=document.querySelector('.proj-multi-dropdown');
  if(existing&&existing._owner===picker){existing.remove();return;}
  
  var selected=_getProjMultiSelected(picker);
  var dropdown=document.createElement('div');
  dropdown.className='proj-multi-dropdown';
  dropdown._owner=picker; // tag for owner-aware close logic
  
  if(state.projects.length===0){
    var empty=document.createElement('div');
    empty.className='proj-multi-option';
    empty.style.color='var(--text-faint)';
    empty.style.fontStyle='italic';
    empty.textContent='No projects yet';
    dropdown.appendChild(empty);
  }else{
    state.projects.forEach(function(p){
      var opt=document.createElement('div');
      opt.className='proj-multi-option'+(selected.indexOf(p.id)>=0?' selected':'');
      opt.innerHTML='<span class="check-mark">'+(selected.indexOf(p.id)>=0?'✓':'')+'</span>'+esc(p.name);
      opt.onclick=function(e){
        e.stopPropagation();
        var sel=_getProjMultiSelected(picker);
        var idx=sel.indexOf(p.id);
        if(idx>=0)sel.splice(idx,1);
        else sel.push(p.id);
        _setProjMultiSelected(picker,sel);
        opt.classList.toggle('selected');
        opt.querySelector('.check-mark').textContent=opt.classList.contains('selected')?'✓':'';
      };
      dropdown.appendChild(opt);
    });
  }
  
  // "New project..." action if allowed
  if(picker.dataset.allowNew){
    var newOpt=document.createElement('div');
    newOpt.className='proj-multi-option action-new';
    newOpt.innerHTML='<span class="check-mark">+</span>New project...';
    newOpt.onclick=function(e){
      e.stopPropagation();
      var pname=prompt('New project name:');
      if(!pname||!pname.trim())return;
      var newProj={id:'p'+Date.now(),name:pname.trim(),due:'',expanded:true,subtasks:[]};
      state.projects.push(newProj);
      save();renderProjects();
      var sel=_getProjMultiSelected(picker);
      sel.push(newProj.id);
      _setProjMultiSelected(picker,sel);
      dropdown.remove();
      toast('Project "'+pname.trim()+'" created');
    };
    dropdown.appendChild(newOpt);
  }
  
  // Portal to body so panel/grid overflow can't clip us
  document.body.appendChild(dropdown);
  
  // Position dropdown anchored to picker, flipped above if not enough room below
  function positionDropdown(){
    var rect=picker.getBoundingClientRect();
    var ddH=dropdown.offsetHeight;
    var ddW=Math.max(rect.width,180);
    var spaceBelow=window.innerHeight-rect.bottom;
    var spaceAbove=rect.top;
    dropdown.style.width=ddW+'px';
    // Prefer below; flip above only if too little room below AND more room above
    var openUp=spaceBelow<ddH+10&&spaceAbove>spaceBelow;
    if(openUp){
      dropdown.style.top=Math.max(8,rect.top-ddH-4)+'px';
    }else{
      dropdown.style.top=(rect.bottom+4)+'px';
    }
    // Horizontal: align left edge with picker; clamp to viewport
    var left=rect.left;
    if(left+ddW>window.innerWidth-8)left=window.innerWidth-ddW-8;
    if(left<8)left=8;
    dropdown.style.left=left+'px';
  }
  positionDropdown();
  // After a tick (for accurate offsetHeight), reposition
  requestAnimationFrame(positionDropdown);
  
  // Reposition on scroll/resize while open
  var repositionHandler=function(){positionDropdown();};
  window.addEventListener('scroll',repositionHandler,true);
  window.addEventListener('resize',repositionHandler);
  
  // Click-outside to close
  setTimeout(function(){
    var handler=function(e){
      if(picker.contains(e.target))return;
      if(dropdown.contains(e.target))return;
      dropdown.remove();
      document.removeEventListener('click',handler);
      window.removeEventListener('scroll',repositionHandler,true);
      window.removeEventListener('resize',repositionHandler);
    };
    document.addEventListener('click',handler);
    // Also clean up listeners when dropdown is removed for any other reason
    var observer=new MutationObserver(function(){
      if(!document.body.contains(dropdown)){
        document.removeEventListener('click',handler);
        window.removeEventListener('scroll',repositionHandler,true);
        window.removeEventListener('resize',repositionHandler);
        observer.disconnect();
      }
    });
    observer.observe(document.body,{childList:true,subtree:false});
  },10);
}

function renderNotes(){
  // Defer the rebuild while a note editor has focus -- reassigning the list's
  // innerHTML below would destroy the open contenteditable and drop the
  // user's in-progress edit. The edit's own save + snapshot (or the flush in
  // toggleNoteEdit) re-renders once editing ends.
  if(_noteEditorFocused()){ _notesRenderPending=true; return; }
  _notesRenderPending=false;
  if(_migrateNotesRich())save();
  updateNoteSelectors();
  const el=document.getElementById('notesList');
  const filter=document.getElementById('noteFilterProj').value;
  const search=document.getElementById('noteSearch').value.toLowerCase().trim();
  let notes=[...state.notes];
  function noteProjIds(n){return (n.projectIds&&n.projectIds.length)?n.projectIds:(n.projectId?[n.projectId]:[]);}
  if(filter==='none')notes=notes.filter(n=>noteProjIds(n).length===0);
  else if(filter!=='all')notes=notes.filter(n=>noteProjIds(n).indexOf(filter)>=0);
  if(search)notes=notes.filter(n=>(n.label+' '+_stripHtml(n.body)).toLowerCase().includes(search));
  notes.sort((a,b)=>(b.created||'').localeCompare(a.created||''));
  if(notes.length===0){
    // R13/F23: was message-only, no next step -- same gap as Tasks/Timeline,
    // Projects already had the message+button pattern this now matches.
    el.innerHTML=state.notes.length===0
      ?'<div class="empty-state"><p style="margin:0 0 8px;color:var(--text-dim);">No notes yet. Add your first one below.</p><button class="btn btn-accent btn-sm" onclick="document.getElementById(\'newNoteLabel\').focus()" style="margin:0 auto;display:block;">+ Add your first note</button></div>'
      :'<div class="empty-state">No matching notes.</div>';
    document.getElementById('noteCount').textContent=state.notes.length;if(typeof _updateTileSummaryNotes==='function')_updateTileSummaryNotes();return;
  }
  el.innerHTML=notes.map(n=>{
    var pids=noteProjIds(n);
    var hasProjClass=pids.length?'has-proj':'';
    var projChips=pids.map(function(pid){
      var pr=state.projects.find(function(p){return p.id===pid;});
      return pr?'<span class="proj-multi-chip" style="font-size:10px;padding:1px 5px;">📂 '+esc(pr.name)+'</span>':'';
    }).join('');
    return '<div class="note-card">'+
      '<div class="note-header">'+
        '<input class="note-label-input" id="nl_'+n.id+'" value="'+esc(n.label)+'" placeholder="Short title..." />'+
        '<button class="note-edit-toggle" id="nbtoggle_'+n.id+'" onclick="toggleNoteEdit(\''+n.id+'\')"><i class="ti ti-pencil" aria-hidden="true"></i>Edit</button>'+
        '<button class="note-org-btn" onclick="noteOrganize(\''+n.id+'\')"><i class="ti ti-sparkles" aria-hidden="true"></i>Organize</button>'+
        '<span class="note-date">'+n.date+' '+n.time+'</span>'+
      '</div>'+
      '<div class="note-body-rendered" id="nbr_'+n.id+'" onclick="toggleNoteEdit(\''+n.id+'\')">'+_renderNoteBody(n)+'</div>'+
      '<div class="note-editable note-body-edit" id="nb_'+n.id+'" contenteditable="true" data-placeholder="Write your note..." style="display:none;">'+_renderNoteBody(n)+'</div>'+
      '<div id="nbbarwrap_'+n.id+'" style="display:none;">'+_noteToolbarHtml('nb_'+n.id,'nbbar_'+n.id)+'</div>'+
      '<div class="note-footer">'+
        '<div class="proj-multi-picker '+hasProjClass+'" id="npp_'+n.id+'" data-target="np_'+n.id+'" data-note-id="'+n.id+'" onclick="openProjMultiPicker(event,this)" style="font-size:11px;padding:3px 6px;min-height:24px;flex:1;">'+
          (pids.length===0?'<span class="proj-multi-placeholder">+ Tag projects</span>':projChips)+
        '</div>'+
        '<input type="hidden" id="np_'+n.id+'" value="'+pids.join(',')+'" onchange="editNoteProjects(\''+n.id+'\',this.value)">'+
        '<span class="note-delete" onclick="deleteNote(\''+n.id+'\')">\u2715</span>'+
      '</div>'+
    '</div>';
  }).join('');
  document.getElementById('noteCount').textContent=state.notes.length;
  notes.forEach(n=>{
    const li=document.getElementById('nl_'+n.id);
    if(li){li.addEventListener('blur',()=>editNoteLabel(n.id,li.value.trim()));}
    const bi=document.getElementById('nb_'+n.id);
    if(bi){
      bi.addEventListener('blur',()=>{
        var clean=_sanitizeNoteHtml(bi.innerHTML);
        var nn=state.notes.find(function(x){return x.id===n.id;});
        if(nn){ nn.body=clean; nn.rich=true; save(); }
        var r=document.getElementById('nbr_'+n.id);
        if(r)r.innerHTML=_renderNoteBody(nn||{body:clean,rich:true});
      });
    }
    // Empty notes (e.g. just created) open directly in edit mode
    const rEl=document.getElementById('nbr_'+n.id);
    if(rEl && !(n.body||'').trim()){
      toggleNoteEdit(n.id);
    }
    const ph=document.getElementById('np_'+n.id);
    if(ph){
      // Watch for changes via MutationObserver since hidden inputs don't fire change events natively
      var lastVal=ph.value;
      var poll=setInterval(function(){
        if(!document.body.contains(ph)){clearInterval(poll);return;}
        if(ph.value!==lastVal){lastVal=ph.value;editNoteProjects(n.id,ph.value);}
      },300);
    }
  });
  if(typeof _updateTileSummaryNotes==='function')_updateTileSummaryNotes();
}
// ROUTINES
function checkDailyRoutineReset(){
  const today=todayStr();
  // Primary guard: state field (persisted to Firestore)
  if(state.lastRoutineReset===today)return;
  // Secondary guard: sessionStorage so a Firestore pull mid-session can't re-trigger
  // (sessionStorage survives tab focus/visibility changes but clears on true tab close)
  var ssKey='_routineResetDate';
  if(sessionStorage.getItem(ssKey)===today){
    // Cloud state is stale -- update it without wiping done-checkmarks
    state.lastRoutineReset=today;
    save();
    return;
  }
  // R16 Phase A: snapshot the ENDING day's completion (state.lastRoutineReset,
  // NOT `today` which is the new day starting) before its checkmarks are wiped
  // below. Guarded on lastRoutineReset being set so a brand-new account's very
  // first day (nothing to snapshot yet) doesn't push a bogus empty entry.
  if(state.lastRoutineReset){
    var _rhSnap=function(tab){
      var list=state.routines[tab]||[];
      return {done:list.filter(function(r){return r.done;}).length,total:list.length};
    };
    if(!state.routineHistory)state.routineHistory=[];
    state.routineHistory.unshift({
      date:state.lastRoutineReset,
      morning:_rhSnap('morning'),evening:_rhSnap('evening'),custom:_rhSnap('custom')
    });
    if(state.routineHistory.length>60)state.routineHistory.length=60;
  }
  // New calendar day -- do the reset
  ['morning','evening','custom'].forEach(tab=>{
    if(state.routines[tab])state.routines[tab].forEach(r=>r.done=false);
  });
  state.lastRoutineReset=today;
  sessionStorage.setItem(ssKey,today);
  save();
  renderRoutines();
}
// The time-appropriate routine tab: mornings show Morning, afternoons/evenings
// show Evening. Used both for the Today view's routine slice and as the routines
// panel's per-open default (set once in initApp, then switchRoutineTab owns it
// for the rest of the session).
function _defaultRoutineTab(){return new Date().getHours()<12?'morning':'evening';}
function switchRoutineTab(tab,btn){state.currentRoutineTab=tab;state.routineTabDate=todayStr();save();document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderRoutines();}
function toggleRoutine(tab,id,e){if(e){var t=e.target;if(t.classList.contains('r-delete')||t.classList.contains('r-name')||t.closest('.r-delete')||t.closest('.r-name'))return;}const r=state.routines[tab].find(r=>r.id===id);if(r){var wasUndone=!r.done;r.done=!r.done;if(wasUndone&&r.done){var srcEl=document.querySelector('[data-rid="'+id+'"] .r-check');addPoints('routine',srcEl);_trackEvent('tool_use','routine_check','Routine Check');}}save();renderRoutines();_refreshTodayViewIfVisible();}
// Guarded cross-refresh so Today (R2) and Everything stay in sync regardless
// of which one the action originated from. No-ops entirely when Today is
// absent/hidden -- true for every account until R2b makes it a real mode.
function _refreshTodayViewIfVisible(){
  var el=document.getElementById('todayView');
  if(el&&el.style.display!=='none')renderTodayView();
}
function addRoutine(){const n=document.getElementById('newRoutineName').value.trim();if(!n)return;state.routines[state.currentRoutineTab].push({id:'r'+Date.now(),name:n,done:false});document.getElementById('newRoutineName').value='';save();renderRoutines();}
function deleteRoutine(tab,id){state.routines[tab]=state.routines[tab].filter(r=>r.id!==id);save();renderRoutines();}
function resetRoutines(){if(!confirm('Reset all routine checkmarks?'))return;state.routines[state.currentRoutineTab].forEach(r=>r.done=false);save();renderRoutines();toast('Routines reset');}
function editRoutineName(tab,id,v){if(!v)return;const r=state.routines[tab].find(r=>r.id===id);if(r)r.name=v;save();}
function renderRoutines(){const tab=state.currentRoutineTab,items=state.routines[tab]||[];const el=document.getElementById('routineList');if(items.length===0){el.innerHTML='<div class="empty-state">No routine items.</div>';}else{el.innerHTML=items.map(r=>'<div class="routine-item '+(r.done?'r-done':'')+'" data-rid="'+r.id+'" onclick="toggleRoutine(\''+tab+"','"+r.id+"',event)\""+' style="cursor:pointer"><div class="r-check '+(r.done?'r-checked':'')+'">'+(r.done?'\u2713':'')+'</div><span class="r-name editable" id="rn_'+r.id+'">'+esc(r.name)+'</span><span class="r-delete" onclick="event.stopPropagation();deleteRoutine(\''+tab+"','"+r.id+'\')">\u2715</span></div>').join('');}const done=items.filter(r=>r.done).length;document.getElementById('routineProgress').textContent=done+'/'+items.length;items.forEach(r=>{const e=document.getElementById('rn_'+r.id);if(e)makeEditable(e,v=>editRoutineName(tab,r.id,v));});refreshEditables();}

// DECISION
var prompts=['<strong>Can\'t start?</strong> 2-minute rule: commit to just 2 minutes.','<strong>Overwhelmed?</strong> Brain Dump everything. Then pick the smallest item.','<strong>Can\'t decide?</strong> "Which will I regret NOT doing tomorrow?"','<strong>Procrastinating?</strong> Name the feeling behind it.','<strong>Task too big?</strong> Break it down until each step feels silly.','<strong>Context switching?</strong> Write one sentence about where you left off.','<strong>Forgetting?</strong> Under 2 min \u2192 do now. Otherwise \u2192 Brain Dump.','<strong>Stuck in a loop?</strong> Change your physical state.','<strong>Perfectionism?</strong> C-minus draft. Done > perfect.','<strong>No motivation?</strong> Motivation follows action.','<strong>Decision fatigue?</strong> Top 3 only.','<strong>Emotional flooding?</strong> Try 5-4-3-2-1 grounding.','<strong>Avoiding a follow-up?</strong> Draft it now. Sending is separate.'];
function newDecisionPrompt(){const el=document.getElementById('decisionPrompt');el.innerHTML=prompts[Math.floor(Math.random()*prompts.length)];el.style.animation='none';el.offsetHeight;el.style.animation='chipIn 0.3s ease';}

// MOBILE
// --- MOBILE HOME TILE NAVIGATION -----------------------------------------
// Phone in landscape (wide but short) still counts as mobile — matches the
// max-height:600 "phone landscape" threshold already used for the header
// subtitle rule further down, so JS and CSS never disagree about which
// layout is active.
var _isMobile=function(){return window.innerWidth<=768 || (window.innerWidth>window.innerHeight && window.innerHeight<=600);};

// Detect standalone PWA mode (launched from home screen, not Safari)
// iOS exposes navigator.standalone, modern browsers also support display-mode media query
(function _detectStandalone(){
  var isStandalone=
    (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)
    ||window.navigator.standalone===true
    ||document.referrer.startsWith('android-app://');
  if(isStandalone){
    document.body.classList.add('standalone-pwa');
  }
})();

// Detect the Capacitor native shell (iOS/Android app, not the web build) so CSS
// can target native-only WKWebView quirks without affecting centerpost.app.
(function _detectCapacitor(){
  try{
    if(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform()){
      document.body.classList.add('capacitor-native');
    }
  }catch(e){}
})();

// ── APPLE WATCH BRIDGE ──────────────────────────────────────────────
// The iOS shell (MainViewController.swift) exposes a WebKit message handler
// named "watchData" and calls window.__watchApplyAction for actions coming
// back from the watch. No-ops on the web build (handler absent).

// Build the today-slice of state to send to the watch. Pure -- no side effects --
// so it can be both posted (pushWatchSnapshot) and returned directly as the
// completion value of an applied action (see __watchApplyAction below).
function _mapRoutine(r){return {id:r.id,name:r.name||'',done:!!r.done};}
function _buildWatchSnapshot(){
  // R10 (F22): this used to take the first 25 of each array in whatever
  // order they happened to be stored in -- no sort at all, so overdue/today
  // items could be pushed off the watch's tiny 25-item cap by anything
  // later in the array. Sorting before the cap means the cap only ever
  // trims the FURTHEST-out items, so "today's set" survives complete unless
  // there are genuinely more than 25 things due today alone. Same due-date
  // convention as renderTaskList()'s 'due' sort (undated last); reminders
  // reuse the shared _reminderSortCompare (R7 stage 2).
  var tasks=(state.tasks||[]).filter(function(t){return !t.done;})
    .sort(function(a,b){var da=a.due||'9999',db=b.due||'9999';return da.localeCompare(db);})
    .slice(0,25).map(function(t){
      return {id:t.id,title:t.name||'',done:false};
    });
  var reminders=(state.reminders||[]).slice().sort(_reminderSortCompare).slice(0,25).map(function(r){
    var when=((r.date?fmtDate(r.date):'')+(r.time?(r.date?' ':'')+fmtTime(r.time):'')).trim();
    return {id:r.id,text:r.text||'',time:when,done:false};
  });
  var points=(state.points&&state.points.current)||0;
  var R=state.routines||{};
  var routines={
    morning:(R.morning||[]).map(_mapRoutine),
    evening:(R.evening||[]).map(_mapRoutine),
    custom:(R.custom||[]).map(_mapRoutine)
  };
  var todayK=todayStr();
  var timeline=(state.tlBlocks||[]).filter(function(b){return (b.date||'')===todayK;})
    .sort(function(a,b){return (a.time||'').localeCompare(b.time||'');})
    .map(function(b){return {id:b.id||('tl'+(b.time||'')),name:b.name||'',time:b.time?fmtTime(b.time):''};});
  var timer={
    running:!!timerRunning,
    endAt:(timerEndAt||0),   // ms epoch when running, else 0
    total:timerTotal||0,     // seconds
    left:timerLeft||0        // seconds
  };
  var presets=(typeof TIMER_PRESETS!=='undefined'?TIMER_PRESETS:[]).map(function(p){return {label:p.label,minutes:p.minutes};});
  return {points:points,tasks:tasks,reminders:reminders,routines:routines,timeline:timeline,timer:timer,presets:presets,energy:state.energy||'',mood:state.mood||''};
}

// Push the today-slice of state to the watch. Called from save() and on init.
function pushWatchSnapshot(){
  try{
    var h=window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.watchData;
    if(!h)return; // not running inside the iOS shell
    h.postMessage(_buildWatchSnapshot());
  }catch(e){console.warn('[watch] pushSnapshot failed',e);}
}

// =======================================
// R10: HOME-SCREEN WIDGET SNAPSHOT -- static display only (Joe's call: no
// interactive App Intents in v1, tapping the widget's "+" deep-links into
// Quick Capture instead of writing data from the extension). The widget
// process runs independently of the app (even fully closed), so it can't
// read live JS state -- this pushes a small JSON snapshot through the native
// bridge into the shared App Group container whenever it actually changes;
// native writes it to UserDefaults(suiteName:) and asks WidgetKit to reload.
// =======================================
// Builds one day's payload. Split out of _computeWidgetSnapshot so the
// snapshot can carry TODAY *and* TOMORROW -- see the `days` array below for
// why that matters.
function _widgetDayPayload(day){
  var pr={high:0,med:1,low:2};
  // NOTE: pr[x]||1 would be wrong here -- high's rank is 0, which is falsy,
  // so || would silently coerce it to 1 (med) and scramble the sort. Use an
  // explicit undefined check instead.
  var prRank=function(p){var r=pr[p];return r===undefined?1:r;};
  var tasks=(state.tasks||[]).filter(function(t){return !t.done&&t.due===day;})
    .sort(function(a,b){return prRank(a.priority)-prRank(b.priority);});
  var reminders=(state.reminders||[]).filter(function(r){return r.date===day;});
  // Reads _tlCollectBlocks rather than raw state.tlBlocks so the widget shows
  // the SAME composite the app draws -- manual blocks plus the auto-derived
  // task/subtask/reminder rows, including the untimed 9am-cascade ones. Before
  // this it read tlBlocks directly, so a task that appeared on the in-app
  // timeline was simply missing from the widget.
  var blocks=(typeof _tlCollectBlocks==='function')?_tlCollectBlocks(day):[];
  var timeline=blocks.slice().sort(function(a,b){return a.startMin-b.startMin;})
    .map(function(b){
      var hh=Math.floor(b.startMin/60),mm=b.startMin%60;
      return {name:b.name||'',
              time:fmtTime((hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm)};
    });
  return {
    date:day,
    taskCount:tasks.length,
    reminderCount:reminders.length,
    items:tasks.slice(0,4).map(function(t){return {title:t.name,priority:t.priority||'med'};}),
    timeline:timeline.slice(0,6)
  };
}

function _computeWidgetSnapshot(){
  var today=_widgetDayPayload(todayStr());
  // `days` carries today AND tomorrow. This is what fixes the widget being
  // stuck on yesterday until the app is opened: the extension process can't
  // recompute anything on its own, so at midnight it had nothing new to read
  // and just re-rendered the previous day. With tomorrow already in the
  // container, TodayWidget.swift schedules a midnight entry that switches to
  // it unattended. Keep this ordered [today, tomorrow] -- the Swift side
  // matches on `date`, but the order keeps it readable in the debugger.
  var snap={
    days:[today,_widgetDayPayload(tomorrowStr())],
    presence:(state.points&&state.points.current)||0
  };
  // Today's fields stay MIRRORED at the top level so a widget build that
  // predates `days` (an older TestFlight install reading a newer snapshot)
  // still decodes and shows today correctly instead of going blank.
  snap.date=today.date;
  snap.taskCount=today.taskCount;
  snap.reminderCount=today.reminderCount;
  snap.items=today.items;
  snap.timeline=today.timeline;
  return snap;
}
var _lastWidgetSnapshot=null;
function _updateWidgetSnapshot(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(!h)return;
  var json=JSON.stringify(_computeWidgetSnapshot());
  if(json===_lastWidgetSnapshot)return; // avoid a redundant native round-trip on unrelated saves
  _lastWidgetSnapshot=json;
  try{h.postMessage({action:'updateWidgetSnapshot',snapshot:json});}catch(e){}
}

// Apply an action the watch sent (toggle a task/reminder, quick-add a task),
// routing through the real state mutators so points + Firestore stay correct.
// Returns the fresh snapshot -- WKWebView's evaluateJavaScript captures this as
// its completion value, which the native side uses as the direct reply to the
// watch. That's load-bearing: replying with a snapshot built BEFORE this action
// ran (the old behavior) let a second quick tap's "immediate" reply race ahead
// of the first tap's real update and visually revert it.
window.__watchApplyAction=function(action){
  try{
    if(!action||!action.cmd)return _buildWatchSnapshot();
    if(action.cmd==='toggle'){
      if(action.kind==='task'){
        if(typeof toggleTaskDone==='function')toggleTaskDone(action.id,'standalone');
      }else if(action.kind==='reminder'){
        _tombstone(action.id);
        state.reminders=(state.reminders||[]).filter(function(r){return r.id!==action.id;});
        save();
        if(typeof renderReminders==='function')renderReminders();
      }
    }else if(action.cmd==='routine'){
      if(typeof toggleRoutine==='function')toggleRoutine(action.tab,action.id);
    }else if(action.cmd==='timerStart'){
      if(typeof startTimer==='function')startTimer();
    }else if(action.cmd==='timerPause'){
      if(typeof pauseTimer==='function')pauseTimer();
    }else if(action.cmd==='timerReset'){
      if(typeof resetTimer==='function')resetTimer();
    }else if(action.cmd==='timerPreset'){
      if(typeof headerTimerSelectPreset==='function')headerTimerSelectPreset(action.idx|0);
    }else if(action.cmd==='energy'){
      state.energy=action.value;
      if(typeof logMoodEntry==='function')logMoodEntry();
      save();
      if(typeof showStateAdvice==='function')showStateAdvice();
      if(typeof updateWellnessVisibility==='function')updateWellnessVisibility();
      var _tdyE=(typeof _dayKey==='function')?_dayKey():'';
      if(state.points&&state.points.lastEnergyDate!==_tdyE){state.points.lastEnergyDate=_tdyE;save();if(typeof addPoints==='function')addPoints('mood_energy',null);}
    }else if(action.cmd==='mood'){
      state.mood=action.value;
      if(typeof logMoodEntry==='function')logMoodEntry();
      save();
      if(typeof showStateAdvice==='function')showStateAdvice();
      if(typeof updateWellnessVisibility==='function')updateWellnessVisibility();
      var _tdyM=(typeof _dayKey==='function')?_dayKey():'';
      if(state.points&&state.points.lastMoodDate!==_tdyM){state.points.lastMoodDate=_tdyM;save();if(typeof addPoints==='function')addPoints('mood_energy',null);}
    }else if(action.cmd==='breath'){
      if(typeof addPoints==='function')addPoints('breathwork',null);
      save();
    }else if(action.cmd==='add'){
      var name=(action.text||'').trim();
      if(name){
        state.tasks.push({id:'t'+Date.now(),name:name,due:'',priority:'med',timeEst:'',projectId:'',projectIds:[],done:false});
        save();
        if(typeof renderTaskList==='function')renderTaskList();
      }
    }else if(action.cmd==='braindump'){
      // Watch voice-capture -- lands in Brain Dump (state.thoughts) to organize later.
      // Same shape as handleDumpKey / shareIntoBrainDump so it syncs and renders identically.
      var thought=(action.text||'').trim();
      if(thought){
        if(!state.thoughts)state.thoughts=[];
        state.thoughts.push({id:'th'+Date.now(),text:thought});
        save();
        if(typeof renderThoughts==='function')renderThoughts();
      }
    }
    pushWatchSnapshot(); // also broadcast, in case the watch app is idle in the background
    return _buildWatchSnapshot(); // the direct reply value -- see comment above
  }catch(e){console.warn('[watch] applyAction failed',e);return _buildWatchSnapshot();}
};

var MOBILE_PANELS=[
  {id:'projects', icon:'<i class="ti ti-folder" aria-hidden="true"></i>',   label:'Projects',   badge:'projCount'},
  {id:'reminders',icon:'<i class="ti ti-bell" aria-hidden="true"></i>',     label:'Reminders',  badge:'remCount'},
  {id:'tasklist', icon:'<i class="ti ti-checklist" aria-hidden="true"></i>',label:'Tasks',       badge:'taskListCount'},
  {id:'timeline', icon:'<i class="ti ti-calendar-time" aria-hidden="true"></i>',label:'Timeline', badge:'tlBlockCount'},
  {id:'notes',    icon:'<i class="ti ti-notebook" aria-hidden="true"></i>', label:'Notes',       badge:'noteCount'},
  {id:'brain',    icon:'<i class="ti ti-brain" aria-hidden="true"></i>',    label:'Brain Dump',  badge:null},
  {id:'routines', icon:'<i class="ti ti-repeat" aria-hidden="true"></i>',   label:'Routines',    badge:null},
  {id:'time',     icon:'<i class="ti ti-tool" aria-hidden="true"></i>',     label:'Tool Kit',    badge:null, wide:true},
  {id:'decision', icon:'<i class="ti ti-help-circle" aria-hidden="true"></i>',label:'Stuck? Help',badge:null},
  {id:'admin',    icon:'<i class="ti ti-shield" aria-hidden="true"></i>',   label:'Admin',       badge:null, adminOnly:true, route:'#/admin'}
];

function buildMobileHome(){
  var grid=document.getElementById('mobilePanelGrid');
  if(!grid)return;
  var html='';
  MOBILE_PANELS.forEach(function(p){
    if(p.adminOnly&&!isAdmin)return;
    if(state.visiblePanels&&state.visiblePanels[p.id]===false)return;
    var badgeVal='';
    if(p.badge){
      var el=document.getElementById(p.badge);
      if(el)badgeVal=el.textContent||'';
    }
    var badgeHtml=badgeVal&&badgeVal!=='0'?'<span class="mnr-badge">'+badgeVal+'</span>':'';
    var rowAction=p.route?'window.location.hash=\''+p.route+'\'':"showMobilePanel('"+p.id+"')";
    html+='<button class="mobile-nav-row" onclick="'+rowAction+'">'
      +'<span class="mnr-icon">'+p.icon+'</span>'
      +'<span class="mnr-label">'+p.label+'</span>'
      +badgeHtml
      +'</button>';
  });
  grid.innerHTML=html;
  // Update clock on home screen
  var clk=document.getElementById('mobileHomeClock');
  if(clk){var now=new Date();clk.textContent=now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}
}

function showMobileHome(){
  if(!_isMobile())return;
  // Show the row-stack home screen
  document.getElementById('mobileHome').classList.add('active');
  // Hide the back bar (home has no back)
  document.getElementById('mobileBackBar').classList.remove('active');
  // Show header with banner + points/timer strip
  var hdr=document.querySelector('.header');
  if(hdr)hdr.classList.add('mobile-visible');
  // Remove panel-open padding (not needed with sticky header)
  var appWrap=document.querySelector('.app-wrap');
  if(appWrap)appWrap.classList.remove('panel-open');
  // Hide all panels — they open one at a time from the nav rows
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('mobile-visible');});
  // Rebuild rows so badge counts are fresh
  buildMobileHome();
  window.scrollTo(0,0);
}

function showMobilePanel(panelId){
  if(!_isMobile()){return;}
  // Hide home; the banner stays as the top chrome (back bar retired)
  document.getElementById('mobileHome').classList.remove('active');
  document.querySelector('.app-wrap').classList.add('panel-open');
  // Bug: in Today view, setViewMode('today') sets #dashboard{display:none}
  // as an inline style -- EVERY .panel, Tool Kit included, lives inside
  // #dashboard, so toggling .mobile-visible on the panel itself did nothing
  // while its ancestor stayed display:none. Worked fine from Everything
  // view only because #dashboard is already shown there. #todayView hides
  // in exchange so its content doesn't sit behind the opened panel; going
  // back restores whichever mode was active (_goMobileHome -> setViewMode
  // re-applies state.viewMode, untouched by this function).
  var dashEl=document.getElementById('dashboard');
  var todayEl=document.getElementById('todayView');
  if(dashEl)dashEl.style.display='';
  if(todayEl)todayEl.style.display='none';
  // Show requested panel. Also restore tile mode on every panel first --
  // mirrors closePanelOverlay()'s cleanup so whichever panel was previously
  // opened here (or on desktop) resets to its compact/summary render.
  document.querySelectorAll('.panel').forEach(function(p){
    p.classList.remove('mobile-visible');
    p.classList.add('panel-tile');
  });
  var target=document.querySelector('.panel[data-panel="'+panelId+'"]')
           ||document.querySelector('.panel[data-nav="'+panelId+'"]');
  // R3: dropped the user-hidden check here. buildMobileHome() already filters
  // visiblePanels===false panels out of the launcher's own nav rows, so this
  // was a second, redundant guard whose only effect was silently blocking
  // direct-jump callers (e.g. Today's "Open Tool Kit" button) whenever a
  // panel's visibility toggle happened to be off -- true for 'time' on every
  // brand-new account by default, tier aside. hidden-panel (admin) stays.
  if(target&&!target.classList.contains('hidden-panel')){
    target.classList.add('mobile-visible');
    // Slide in from the right; class removed after the animation so it can replay
    target.classList.add('mobile-panel-enter');
    setTimeout(function(){target.classList.remove('mobile-panel-enter');},350);
    // F10: this tab-bar path never learned the desktop "expand" panel's trick
    // (openPanelOverlay) of dropping tile mode so the full, untruncated list
    // renders instead of the compact tile preview. Without this, Tasks/Notes/
    // Projects opened from the mobile tab bar looked full-screen but still
    // rendered (and CSS-capped) as if they were the small home-tile summary --
    // a 220px scrollbox with a 17,000px+ scrollable interior at real volume.
    target.classList.remove('panel-tile');
    // R7 stage 5: start each fresh open back at the first batch rather than
    // silently carrying over a "Show more" expansion from a prior visit.
    if(panelId==='tasklist')_tlRenderLimit=_TL_RENDER_BATCH;
    else if(panelId==='reminders')_remRenderLimit=_TL_RENDER_BATCH;
    if(panelId==='projects'&&typeof renderProjects==='function')renderProjects();
    else if(panelId==='notes'&&typeof renderNotes==='function')renderNotes();
    else if(panelId==='tasklist'&&typeof renderTaskList==='function')renderTaskList();
    else if(panelId==='reminders'&&typeof renderReminders==='function')renderReminders();
    _ensurePanelBackBtn(target);
    // Scroll to top
    window.scrollTo(0,0);
  }
}
// R2 stage C: a visible way back out of a panel (F6 -- previously only an
// untaught swipe-right). Inserted as the FIRST child of the panel's own
// .panel-title (in-flow content) rather than a separate fixed bar, which
// would collide with .header -- it stays visible over an open panel by
// design. Guarded so re-opening the same panel doesn't stack duplicates.
function _ensurePanelBackBtn(panelEl){
  var title=panelEl.querySelector('.panel-title');
  if(!title||title.querySelector('.panel-mobile-back-btn'))return;
  var btn=document.createElement('button');
  btn.type='button';
  btn.className='mobile-back-btn panel-mobile-back-btn';
  btn.setAttribute('aria-label','Back');
  btn.onclick=function(){_goMobileHome();};
  title.insertBefore(btn,title.firstChild);
}

// Swipe right on an open mobile panel to go back home. Direction-locked so
// vertical scrolling is untouched; drags starting on horizontally-draggable
// elements (timeline/banner blocks) or form fields are left alone.
(function(){
  if(!('ontouchstart' in window))return;
  var startX=0,startY=0,dx=0,tracking=false,horizontal=null,panel=null;
  document.addEventListener('touchstart',function(e){
    if(!_isMobile())return;
    var wrap=document.querySelector('.app-wrap');
    if(!wrap||!wrap.classList.contains('panel-open'))return;
    if(e.touches.length!==1)return;
    var t=e.target;
    if(t.closest&&t.closest('.tl-block,.dpb-block,input,textarea,select'))return;
    panel=document.querySelector('.panel.mobile-visible');
    if(!panel)return;
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;
    dx=0;horizontal=null;tracking=true;
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!tracking||!panel)return;
    var cx=e.touches[0].clientX-startX,cy=e.touches[0].clientY-startY;
    if(horizontal===null){
      if(Math.abs(cx)<10&&Math.abs(cy)<10)return;
      horizontal=Math.abs(cx)>Math.abs(cy);
    }
    if(!horizontal)return;
    dx=Math.max(0,cx);
    panel.style.transition='none';
    panel.style.transform='translateX('+dx+'px)';
  },{passive:true});
  function endSwipe(){
    if(!tracking||!panel)return;
    panel.style.transition='';
    panel.style.transform='';
    if(horizontal&&dx>70)_goMobileHome();
    tracking=false;horizontal=null;dx=0;panel=null;
  }
  document.addEventListener('touchend',endSwipe,{passive:true});
  document.addEventListener('touchcancel',endSwipe,{passive:true});
})();

// On resize: if going to desktop, clean up mobile state
window.addEventListener('resize',function(){
  if(!_isMobile()){
    document.getElementById('mobileHome').classList.remove('active');
    document.getElementById('mobileBackBar').classList.remove('active');
    document.querySelector('.app-wrap')&&document.querySelector('.app-wrap').classList.remove('panel-open');
    var hdr=document.querySelector('.header');
    if(hdr)hdr.classList.remove('mobile-visible');
    // Clear any panel left open from mobile mode -- otherwise the next
    // transition back to mobile sees a stale .mobile-visible panel, thinks
    // one is still open, skips showMobileHome(), and the screen goes blank.
    document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('mobile-visible');});
  } else {
    // Going back to mobile -- restore the current mode's home surface
    // (Today view or the tile launcher) if no panel is open.
    var anyVisible=document.querySelector('.panel.mobile-visible');
    if(!anyVisible){_goMobileHome();}
  }
});

// UTILITY
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML.replace(/"/g,'&quot;');}
// Validators for fields the AI (or a tampered payload) can set. Values land in
// class/attribute positions, so whitelist instead of escaping at every render.
function _safePriority(p){return p==='low'||p==='high'?p:'med';}
function _safeDateStr(d){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')?d:'';}
function _safeTimeStr(t){return /^\d{1,2}:\d{2}$/.test(t||'')?t:'';}
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500);}
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'||e.target.isContentEditable)return;if(e.key==='b'||e.key==='B'){openQuickCapture();e.preventDefault();}if(e.key==='s'||e.key==='S'){startTimer();e.preventDefault();}if(e.key==='p'||e.key==='P'){pauseTimer();e.preventDefault();}});

// =======================================
// COMMAND PALETTE (F4) -- action registry, future features just push onto
// COMMAND_REGISTRY. Every entry here reuses an existing, already-wired
// function; the palette adds no new app behavior of its own.
// =======================================
var COMMAND_REGISTRY=[
  {id:'quick-capture',label:'Quick Capture / Brain Dump',keywords:'add note thought capture braindump',run:function(){openQuickCapture();}},
  {id:'start-timer',label:'Start Timer',keywords:'focus pomodoro begin work',run:function(){startTimer();}},
  {id:'pause-timer',label:'Pause Timer',keywords:'stop halt break',run:function(){pauseTimer();}},
  {id:'view-today',label:'Switch to Today View',keywords:'today view switch',run:function(){setViewMode('today');}},
  {id:'view-everything',label:'Switch to Everything View',keywords:'everything dashboard switch view',run:function(){setViewMode('everything');}},
  {id:'export-data',label:'Export My Data',keywords:'export download json backup account',run:function(){exportMyData();}},
  {id:'open-tasklist',label:'Open Task List',keywords:'tasks todo list',run:function(){openPanelOverlay('tasklist');}},
  {id:'open-timeline',label:'Open Timeline',keywords:'schedule work today blocks',run:function(){openPanelOverlay('timeline');}},
  {id:'open-toolkit',label:'Open Tool Kit',keywords:'grounding regulation halt breath wellness',run:function(){openPanelOverlay('time');}},
  {id:'open-projects',label:'Open Projects',keywords:'project subtasks',run:function(){openPanelOverlay('projects');}},
  {id:'open-reminders',label:'Open Reminders',keywords:'reminder alert',run:function(){openPanelOverlay('reminders');}},
  {id:'open-notes',label:'Open Notes',keywords:'note journal',run:function(){openPanelOverlay('notes');}},
  {id:'weekly-review',label:'Weekly Review',keywords:'recap summary week report review sunday',run:function(){openWeeklyReview();}},
  {id:'insights',label:'Insights',keywords:'points mood trends report insights correlations',run:function(){openPointsInsights();}}
];
var _cmdPaletteSelected=0;
var _cmdPaletteFiltered=COMMAND_REGISTRY;
function openCommandPalette(){
  var modal=document.getElementById('cmdPaletteModal');if(!modal)return;
  modal.classList.add('open');
  var input=document.getElementById('cmdPaletteInput');
  if(input){input.value='';input.focus();}
  _cmdPaletteSelected=0;
  _cmdPaletteFiltered=COMMAND_REGISTRY;
  _cmdPaletteRender();
}
function closeCommandPalette(){
  var modal=document.getElementById('cmdPaletteModal');if(!modal)return;
  modal.classList.remove('open');
}
function _cmdPaletteFilter(){
  var input=document.getElementById('cmdPaletteInput');
  var q=(input?input.value:'').trim().toLowerCase();
  _cmdPaletteFiltered=!q?COMMAND_REGISTRY:COMMAND_REGISTRY.filter(function(c){
    return c.label.toLowerCase().indexOf(q)>=0||c.keywords.toLowerCase().indexOf(q)>=0;
  });
  _cmdPaletteSelected=0;
  _cmdPaletteRender();
}
function _cmdPaletteRender(){
  var list=document.getElementById('cmdPaletteList');if(!list)return;
  if(_cmdPaletteFiltered.length===0){
    list.innerHTML='<div style="padding:12px;color:var(--text-faint);font-size:13px;">No matching commands</div>';
    return;
  }
  list.innerHTML=_cmdPaletteFiltered.map(function(c,i){
    return '<div class="cmd-palette-item" data-idx="'+i+'" onclick="_cmdPaletteRun('+i+')" style="padding:9px 10px;border-radius:6px;cursor:pointer;font-size:13px;'
      +(i===_cmdPaletteSelected?'background:var(--accent-bg,rgba(91,232,255,0.12));':'')+'">'+esc(c.label)+'</div>';
  }).join('');
}
function _cmdPaletteRun(i){
  var cmd=_cmdPaletteFiltered[i];
  if(!cmd)return;
  closeCommandPalette();
  cmd.run();
}
function _cmdPaletteKeydown(e){
  if(e.key==='Escape'){closeCommandPalette();e.preventDefault();return;}
  if(e.key==='ArrowDown'){_cmdPaletteSelected=Math.min(_cmdPaletteSelected+1,_cmdPaletteFiltered.length-1);_cmdPaletteRender();e.preventDefault();return;}
  if(e.key==='ArrowUp'){_cmdPaletteSelected=Math.max(_cmdPaletteSelected-1,0);_cmdPaletteRender();e.preventDefault();return;}
  if(e.key==='Enter'){_cmdPaletteRun(_cmdPaletteSelected);e.preventDefault();return;}
}
// Separate listener from the single-letter shortcut block above -- Cmd/Ctrl+K
// is a modifier combo, so (unlike b/s/p) it should fire even while typing in
// another field, and must not be folded into that input-focus-guarded block.
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){
    e.preventDefault();
    var modal=document.getElementById('cmdPaletteModal');
    if(modal&&modal.classList.contains('open')){closeCommandPalette();}
    else{openCommandPalette();}
  }
});

// =======================================
// MOOD/ENERGY LOGGING & TRENDS
// =======================================

// -- Mood & Energy History Chart --------------------------------------
var _mhActivePeriod=7;
function openMoodHistory(days){
  _mhActivePeriod=days||7;
  document.getElementById('moodHistoryModal').classList.add('open');
  renderMoodHistory(_mhActivePeriod);
}
function closeMoodHistory(){document.getElementById('moodHistoryModal').classList.remove('open');}

function renderMoodHistory(days){
  _mhActivePeriod=days;
  document.getElementById('mhBtn7').classList.toggle('active',days===7);
  document.getElementById('mhBtn30').classList.toggle('active',days===30);

  var ENERGY={high:4,good:3,low:2,crashed:1};
  var MOOD={focused:4,calm:3,scattered:2,anxious:1};
  var ELABELS={4:'High',3:'Good',2:'Low',1:'Crash'};
  var MLABELS={4:'Focused',3:'Calm',2:'Scattered',1:'Anxious'};

  var today=new Date();
  var labels=[],eData=[],mData=[];
  for(var i=days-1;i>=0;i--){
    var d=new Date(today);d.setDate(d.getDate()-i);
    var ds=d.toISOString().slice(0,10);
    var entry=(state.moodLog||[]).find(function(e){return e.date===ds;});
    labels.push(ds);
    eData.push(entry&&entry.energy?ENERGY[entry.energy]:null);
    mData.push(entry&&entry.mood?MOOD[entry.mood]:null);
  }

  var hasAny=eData.some(function(v){return v!==null;})||mData.some(function(v){return v!==null;});
  document.getElementById('mhNoData').style.display=hasAny?'none':'block';
  document.getElementById('mhChartWrap').style.display=hasAny?'block':'none';
  if(!hasAny)return;

  var W=580,H=200,padL=52,padR=12,padT=16,padB=38;
  var cW=W-padL-padR,cH=H-padT-padB;
  var n=days;
  var stepX=n>1?cW/(n-1):cW;

  function xp(i){return padL+i*stepX;}
  function yp(v){return padT+cH-((v-1)/3)*cH;}

  var svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">';

  // Grid + y-axis labels
  [1,2,3,4].forEach(function(v){
    var y=yp(v);
    svg+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="rgba(128,128,128,0.15)" stroke-width="1"/>';
    svg+='<text x="'+(padL-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="9" fill="rgba(128,128,128,0.7)">'+ELABELS[v]+'</text>';
  });

  // Build path segments (energy)
  var ePts=[];
  eData.forEach(function(v,i){if(v!==null)ePts.push({x:xp(i),y:yp(v),i:i,v:v});});
  for(var j=1;j<ePts.length;j++){
    if(ePts[j].i-ePts[j-1].i<=1)
      svg+='<line x1="'+ePts[j-1].x+'" y1="'+ePts[j-1].y+'" x2="'+ePts[j].x+'" y2="'+ePts[j].y+'" stroke="#d4a853" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>';
  }
  ePts.forEach(function(p){
    svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="4.5" fill="#d4a853" stroke="var(--surface-raised)" stroke-width="2"><title>'+labels[p.i]+': '+ELABELS[p.v]+'</title></circle>';
  });

  // Build path segments (mood)
  var mPts=[];
  mData.forEach(function(v,i){if(v!==null)mPts.push({x:xp(i),y:yp(v),i:i,v:v});});
  for(var k=1;k<mPts.length;k++){
    if(mPts[k].i-mPts[k-1].i<=1)
      svg+='<line x1="'+mPts[k-1].x+'" y1="'+mPts[k-1].y+'" x2="'+mPts[k].x+'" y2="'+mPts[k].y+'" stroke="#5f8fc7" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>';
  }
  mPts.forEach(function(p){
    svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="4.5" fill="#5f8fc7" stroke="var(--surface-raised)" stroke-width="2"><title>'+labels[p.i]+': '+MLABELS[p.v]+'</title></circle>';
  });

  // X-axis labels
  var step=days<=7?1:days<=14?2:Math.ceil(days/10);
  labels.forEach(function(ds,i){
    if(i%step===0||i===n-1){
      var dObj=new Date(ds+'T12:00:00Z');
      var lbl=i===n-1?'Today':(dObj.getUTCMonth()+1)+'/'+(dObj.getUTCDate());
      svg+='<text x="'+xp(i)+'" y="'+(H-10)+'" text-anchor="middle" font-size="9" fill="rgba(128,128,128,0.7)">'+lbl+'</text>';
      svg+='<line x1="'+xp(i)+'" y1="'+(H-padB+3)+'" x2="'+xp(i)+'" y2="'+(H-padB+8)+'" stroke="rgba(128,128,128,0.3)" stroke-width="1"/>';
    }
  });

  // Today marker
  svg+='<line x1="'+xp(n-1)+'" y1="'+padT+'" x2="'+xp(n-1)+'" y2="'+(H-padB)+'" stroke="#d4a853" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>';

  svg+='</svg>';
  document.getElementById('mhChartWrap').innerHTML=svg;
}

function logMoodEntry(){
  if(!state.energy&&!state.mood)return;
  const today=todayStr();
  let entry=state.moodLog.find(e=>e.date===today);
  if(!entry){entry={date:today};state.moodLog.push(entry);}
  if(state.energy)entry.energy=state.energy;
  if(state.mood)entry.mood=state.mood;
  entry.ts=new Date().toISOString();
  _trackEvent('tool_use','log_mood','Log Mood');
  _saveMoodLogDoc();
}




// =======================================
// ADMIN FUNCTIONS
// =======================================
function showAdminPanel(){
  const ap=document.getElementById('adminPanel');
  if(!ap)return;
  if(isAdmin){
    ap.classList.add('admin-route-overlay');
    ap.classList.remove('hidden-panel');
    document.body.classList.add('admin-overlay-open');
    if(!ap.querySelector('.admin-close-btn')){
      var closeBtn=document.createElement('button');
      closeBtn.className='admin-close-btn';
      closeBtn.textContent='← Back to Dashboard';
      closeBtn.onclick=function(){closeAdminPanel();};
      ap.insertBefore(closeBtn,ap.firstChild);
    }
    renderAdminPanel();
    _bootstrapInviteCodesIfEmpty().then(function(){renderInviteCodes();});
  }else{
    ap.classList.add('hidden-panel');
    ap.classList.remove('admin-route-overlay');
    document.body.classList.remove('admin-overlay-open');
  }
}
function closeAdminPanel(){
  var ap=document.getElementById('adminPanel');
  if(ap){ap.classList.remove('admin-route-overlay');ap.classList.add('hidden-panel');}
  document.body.classList.remove('admin-overlay-open');
  if(window.location.hash==='#/admin')history.replaceState(null,'',window.location.pathname);
}
function openAdminRoute(){
  if(!isAdmin){toast('Admin access required');return;}
  window.location.hash='#/admin';
}
window.addEventListener('hashchange',function(){
  if(window.location.hash==='#/admin'){showAdminPanel();}
  else{closeAdminPanel();}
});
window.closeAdminPanel=closeAdminPanel;
window.openAdminRoute=openAdminRoute;

async function renderAdminPanel(){
  if(!isAdmin||!db)return;
  try{
    const snap=await db.collection('users').get();
    const users=[];
    snap.forEach(doc=>{users.push({uid:doc.id,...doc.data()});});

    // Stats
    const total=users.length;
    const active=users.filter(u=>!u.disabled).length;
    const admins=users.filter(u=>u.admin).length;
    document.getElementById('adminStats').innerHTML=
      '<div class="admin-stat"><div class="as-val">'+total+'</div><div class="as-lbl">Total Users</div></div>'+
      '<div class="admin-stat"><div class="as-val">'+active+'</div><div class="as-lbl">Active</div></div>'+
      '<div class="admin-stat"><div class="as-val">'+admins+'</div><div class="as-lbl">Admins</div></div>';

    // User list
    const tbody=document.getElementById('adminUserList');
    tbody.innerHTML=users.map(u=>{
      const lastActive=u.lastActive?u.lastActive.toDate().toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Never';
      const isSelf=u.uid===currentUser.uid;
      const tier=u.accountTier||'free';
      // esc: accountTier comes from the user's own profile doc -- treat as untrusted
      const tierLabel=esc({free:'Free',pro:'Pro',premium:'Premium',legacy:'Legacy',owner:'Owner'}[tier]||tier);
      const isLegacy=u.accountTier==='legacy';
      const emailJs=esc(u.email).replace(/'/g,"\\'");
      return '<tr>'+
        '<td>'+esc(u.email)+(u.admin?' <span class="admin-badge admin">Admin</span>':'')+'</td>'+
        '<td><span class="admin-badge '+(u.disabled?'disabled':'active')+'">'+(u.disabled?'Disabled':'Active')+'</span></td>'+
        '<td><span class="admin-badge '+(isLegacy?'active':'disabled')+'" style="'+(isLegacy?'background:rgba(5,150,105,0.15);color:#059669;border-color:rgba(5,150,105,0.4)':'')+'">'+tierLabel+'</span></td>'+
        '<td>'+lastActive+'</td>'+
        '<td><div class="admin-actions">'+
        (!isSelf&&!u.disabled?'<button class="admin-action danger" onclick="adminDisableUser(\''+u.uid+'\')">Disable</button>':'')+
        (!isSelf&&u.disabled?'<button class="admin-action" onclick="adminEnableUser(\''+u.uid+'\')">Enable</button>':'')+
        '<button class="admin-action" onclick="adminResetPassword(\''+emailJs+'\')">Reset PW</button>'+
        (!isSelf&&!u.admin?'<button class="admin-action" onclick="adminMakeAdmin(\''+u.uid+'\')">Make Admin</button>':'')+
        (!isSelf&&!isLegacy?'<button class="admin-action" style="background:rgba(5,150,105,0.12);border-color:rgba(5,150,105,0.5);color:#059669;" onclick="adminGrantLegacy(\''+u.uid+'\')">Grant Legacy</button>':'')+
        (!isSelf&&isLegacy?'<button class="admin-action" onclick="adminRevokeLegacy(\''+u.uid+'\')">Revoke Legacy</button>':'')+
        (!isSelf?'<button class="admin-action danger" onclick="adminDeleteUser(\''+u.uid+'\',\''+emailJs+'\')">Delete</button>':'')+
        '</div></td></tr>';
    }).join('');
  }catch(e){console.log('Admin render error:',e);}
}

async function adminAddUser(){
  if(!isAdmin)return;
  const email=document.getElementById('adminNewEmail').value.trim();
  const pass=document.getElementById('adminNewPass').value;
  const err=document.getElementById('adminAddError');
  err.textContent='';
  if(!email||!pass){err.textContent='Enter email and password.';return;}
  if(pass.length<6){err.textContent='Password must be at least 6 characters.';return;}
  try{
    // Use secondary app to create user without signing out admin
    const secondaryApp=firebase.initializeApp(firebaseConfig,'secondary_'+Date.now());
    const cred=await secondaryApp.auth().createUserWithEmailAndPassword(email,pass);
    const newUid=cred.user.uid;
    await secondaryApp.auth().signOut();
    secondaryApp.delete();
    // Create profile in Firestore
    await db.collection('users').doc(newUid).set({
      email:email,admin:false,disabled:false,
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      lastActive:null
    });
    document.getElementById('adminNewEmail').value='';
    document.getElementById('adminNewPass').value='';
    toast('User '+email+' created');
    renderAdminPanel();
  }catch(e){err.textContent=e.message;}
}

// --- Legacy tier grant / revoke -------------------------------------------
// Firestore holds the tier for the UI; the Jarvis Worker's KV tier registry
// is what actually enforces AI access (S-2) -- sync both on every change.
async function _syncWorkerTier(uid,tier){
  try{
    var res=await fetch(JARVIS_PROXY_URL+'/admin-set-tier',{
      method:'POST',
      headers:await _jarvisAuthHeaders(),
      body:JSON.stringify({uid:uid,tier:tier})
    });
    if(!res.ok)throw new Error('HTTP '+res.status);
    return true;
  }catch(e){
    console.warn('[admin] worker tier sync failed:',e.message);
    toast('⚠ Tier saved, but Worker sync failed — AI access won’t change until you re-grant');
    return false;
  }
}
async function adminGrantLegacy(uid){
  if(!isAdmin)return;
  try{
    await db.collection('users').doc(uid).update({accountTier:'legacy'});
    await _syncWorkerTier(uid,'legacy');
    toast('Legacy access granted');
    renderAdminPanel();
  }catch(e){toast('Error: '+e.message);}
}
async function adminRevokeLegacy(uid){
  if(!isAdmin)return;
  try{
    await db.collection('users').doc(uid).update({accountTier:firebase.firestore.FieldValue.delete()});
    await _syncWorkerTier(uid,'');
    toast('Legacy access revoked');
    renderAdminPanel();
  }catch(e){toast('Error: '+e.message);}
}

// --- Music Streaming Modal ------------------------------------------------
// Opens the user's chosen platform in a new tab. No audio is streamed
// through Centerpost -- this sidesteps all copyright/licensing concerns.
// Only visible to Premium, Legacy, and Owner tiers.
function openMusicStreamingModal(){
  var cfg=getTierConfig();
  if(!cfg.musicStreaming){_tierUpgradeToast('Premium');return;}
  var overlay=document.getElementById('musicStreamOverlay');
  if(overlay)overlay.classList.remove('hidden');
}
function closeMusicStreamingModal(){
  var overlay=document.getElementById('musicStreamOverlay');
  if(overlay)overlay.classList.add('hidden');
}
function launchMusicPlatform(platform){
  var urls={
    spotify:'https://open.spotify.com',
    apple:'https://music.apple.com',
    amazon:'https://music.amazon.com'
  };
  var url=urls[platform];
  if(!url)return;
  window.open(url,'_blank','noopener,noreferrer');
  // Save preference
  if(!state.settings)state.settings={};
  state.settings.preferredMusicPlatform=platform;
  save();
  closeMusicStreamingModal();
  toast('Opening '+{spotify:'Spotify',apple:'Apple Music',amazon:'Amazon Music'}[platform]+'…');
}
// Codes live at /inviteCodes/{CODE} with fields: used, maxUses, note,
// disabled, createdAt, createdBy, lastUsedAt, lastUsedBy, lastUsedEmail.
// ===========================================================================
function _generateRandomCode(len){
  // Avoid ambiguous chars: no 0/O, no 1/I/L
  var chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var out='';
  for(var i=0;i<(len||8);i++)out+=chars[Math.floor(Math.random()*chars.length)];
  return out;
}

async function adminCreateInviteCode(){
  if(!isAdmin||!db)return;
  var codeEl=document.getElementById('newInviteCode');
  var maxUsesEl=document.getElementById('newInviteMaxUses');
  var noteEl=document.getElementById('newInviteNote');
  var err=document.getElementById('inviteCreateError');
  err.textContent='';
  var code=(codeEl.value||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
  if(!code)code=_generateRandomCode(8);
  if(code.length<4){err.textContent='Code must be at least 4 characters.';return;}
  if(code.length>32){err.textContent='Code must be 32 characters or fewer.';return;}
  var maxUses=parseInt(maxUsesEl.value,10);
  if(isNaN(maxUses)||maxUses<1)maxUses=1;
  if(maxUses>999)maxUses=999;
  try {
    var ref=db.collection('inviteCodes').doc(code);
    var existing=await ref.get();
    if(existing.exists){err.textContent='That code already exists. Pick a different one.';return;}
    await ref.set({
      code:code,
      used:0,
      maxUses:maxUses,
      note:(noteEl.value||'').trim(),
      disabled:false,
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      createdBy:currentUser.uid,
      createdByEmail:currentUser.email
    });
    codeEl.value='';
    maxUsesEl.value='1';
    noteEl.value='';
    toast('Invite code '+code+' created');
    renderInviteCodes();
  } catch(e){err.textContent=e.message||'Failed to create code.';}
}

async function adminToggleInviteCode(code,disable){
  if(!isAdmin||!db)return;
  try {
    await db.collection('inviteCodes').doc(code).update({disabled:!!disable});
    toast(disable?'Code disabled':'Code enabled');
    renderInviteCodes();
  } catch(e){toast('Failed: '+e.message);}
}

async function adminDeleteInviteCode(code){
  if(!isAdmin||!db)return;
  _confirm('Delete invite code "'+code+'"? Anyone who already used it keeps their account, but the code itself is removed.',async function(){
    try {
      await db.collection('inviteCodes').doc(code).delete();
      toast('Code '+code+' deleted');
      renderInviteCodes();
    } catch(e){toast('Failed: '+e.message);}
  },{destructive:true,confirmText:'Delete Code'});
}

async function adminCopyInviteCode(code){
  try {
    await navigator.clipboard.writeText(code);
    toast('Copied: '+code);
  } catch(e){
    // Fallback for old browsers / non-secure contexts
    var tmp=document.createElement('input');
    tmp.value=code;document.body.appendChild(tmp);tmp.select();
    try{document.execCommand('copy');toast('Copied: '+code);}catch(e2){toast('Copy failed');}
    tmp.remove();
  }
}

async function renderInviteCodes(){
  if(!isAdmin||!db)return;
  var tbody=document.getElementById('inviteCodeList');
  if(!tbody)return;
  try {
    var snap=await db.collection('inviteCodes').orderBy('createdAt','desc').get();
    if(snap.empty){
      tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:14px;">No codes yet. Create one above to start inviting beta users.</td></tr>';
      return;
    }
    var rows=[];
    snap.forEach(function(doc){
      var d=doc.data();
      var used=d.used||0;
      var max=d.maxUses||0;
      var usesTxt=max?used+' / '+max:used+' (unlimited)';
      var statusBadge;
      if(d.disabled){
        statusBadge='<span class="admin-badge disabled">Disabled</span>';
      } else if(max && used>=max){
        statusBadge='<span class="admin-badge disabled">Used up</span>';
      } else {
        statusBadge='<span class="admin-badge active">Active</span>';
      }
      var note=d.note?esc(d.note):'<span style="color:var(--text-faint);">--</span>';
      var codeJs=esc(d.code||doc.id).replace(/'/g,"\\'");
      rows.push(
        '<tr><td><code style="background:rgba(91,232,255,0.1);color:#5be8ff;padding:2px 8px;border-radius:4px;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:1px;">'+esc(d.code||doc.id)+'</code></td>'+
        '<td>'+usesTxt+'</td>'+
        '<td>'+statusBadge+'</td>'+
        '<td>'+note+'</td>'+
        '<td><div class="admin-actions">'+
          '<button class="admin-action" onclick="adminCopyInviteCode(\''+codeJs+'\')">Copy</button>'+
          (d.disabled
            ? '<button class="admin-action" onclick="adminToggleInviteCode(\''+codeJs+'\',false)">Enable</button>'
            : '<button class="admin-action" onclick="adminToggleInviteCode(\''+codeJs+'\',true)">Disable</button>')+
          '<button class="admin-action danger" onclick="adminDeleteInviteCode(\''+codeJs+'\')">Delete</button>'+
        '</div></td></tr>'
      );
    });
    tbody.innerHTML=rows.join('');
  } catch(e){
    console.warn('[admin] renderInviteCodes failed',e);
    tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--red);padding:14px;">Failed to load codes: '+esc(e.message||'unknown error')+'. Make sure Firestore rules allow admin read/write on /inviteCodes.</td></tr>';
  }
}

// Bootstrap: if no codes exist on first admin load, create a starter code
// so the admin has something to hand out immediately.
async function _bootstrapInviteCodesIfEmpty(){
  if(!isAdmin||!db)return;
  try {
    var snap=await db.collection('inviteCodes').limit(1).get();
    if(snap.empty){
      var starter='BETA-'+_generateRandomCode(5);
      await db.collection('inviteCodes').doc(starter).set({
        code:starter,used:0,maxUses:10,
        note:'Auto-generated starter code (10 uses)',disabled:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        createdBy:currentUser.uid,createdByEmail:currentUser.email
      });
      toast('Created starter invite code: '+starter);
    }
  } catch(e){console.warn('[admin] bootstrap codes failed',e);}
}

async function adminDisableUser(uid){
  if(!isAdmin)return;
  _confirm('Disable this user? They will not be able to sign in.',async function(){
    try{await db.collection('users').doc(uid).update({disabled:true});toast('User disabled');renderAdminPanel();}catch(e){toast('Error: '+e.message);}
  },{destructive:true,confirmText:'Disable'});
}
async function adminEnableUser(uid){
  if(!isAdmin)return;
  try{await db.collection('users').doc(uid).update({disabled:false});toast('User enabled');renderAdminPanel();}catch(e){toast('Error: '+e.message);}
}
async function adminResetPassword(email){
  if(!isAdmin)return;
  _confirm('Send a password reset email to '+email+'?',async function(){
    try{await firebase.auth().sendPasswordResetEmail(email);toast('Password reset sent to '+email);}catch(e){toast('Error: '+e.message);}
  },{confirmText:'Reset Password'});
}
async function adminMakeAdmin(uid){
  if(!isAdmin)return;
  _confirm('Make this user an admin?',async function(){
    try{await db.collection('users').doc(uid).update({admin:true});toast('Admin granted');renderAdminPanel();}catch(e){toast('Error: '+e.message);}
  },{confirmText:'Make Admin',icon:'ti-shield'});
}
async function adminDeleteUser(uid,email){
  if(!isAdmin)return;
  _confirm('Delete user '+email+'? Their data will also be deleted.',async function(){
    try{
      await db.collection('users').doc(uid).collection('data').doc('dashboard').delete();
      await db.collection('users').doc(uid).delete();
      toast('User '+email+' deleted');
      renderAdminPanel();
    }catch(e){toast('Error: '+e.message);}
  },{destructive:true,confirmText:'Delete User'});
}

// =======================================
// BREATHWORK ENGINE
// =======================================
var breathTechniques={
  box:{
    name:'Box Breathing (4-4-4-4)',
    source:'Balban et al., 2023 \u2014 Navy SEAL protocol',
    desc:'Equal inhale, hold, exhale, hold. Activates parasympathetic nervous system and reduces cortisol.',
    phases:['Inhale','Hold','Exhale','Hold'],
    durations:[4,4,4,4],
    cycles:4,
    cues:['Breathe in slowly through your nose','Keep your lungs full, stay relaxed','Release slowly through your mouth','Stay empty, stay calm']
  },
  '478':{
    name:'4-7-8 Breathing',
    source:'Weil, 2015; pranayama tradition \u2014 vagus nerve activation',
    desc:'Extended exhale (2x inhale) shifts autonomic balance toward parasympathetic dominance. Powerful for anxiety.',
    phases:['Inhale','Hold','Exhale'],
    durations:[4,7,8],
    cycles:4,
    cues:['Quietly through your nose','Gently hold, body relaxed','Slowly and completely through your mouth']
  },
  sigh:{
    name:'Physiological Sigh',
    source:'Balban et al., 2023, Cell Reports Medicine \u2014 Stanford/Huberman Lab',
    desc:'Fastest known voluntary method to reduce autonomic arousal. Double inhale reinflates alveoli, long exhale calms.',
    phases:['Deep Inhale','Quick Sniff In','Long Exhale'],
    durations:[3,1,6],
    cycles:6,
    cues:['Deep breath through your nose','Short sharp sniff on top','Slow and long through your mouth']
  },
  scan:{
    name:'2-Minute Body Scan',
    source:'Kabat-Zinn MBSR; Demarzo et al., 2017 meta-analysis',
    desc:'Redirects attention from rumination to body awareness. Even brief scans reduce cortisol and cognitive fusion.',
    phases:['Settle In','Feet & Legs','Torso & Hands','Arms & Shoulders','Neck & Face','Integrate'],
    durations:[8,15,15,15,15,12],
    cycles:1,
    cues:['Close your eyes. Three slow breaths.','Notice your feet on the ground. Scan up through calves, knees, thighs.','Feel your belly rise and fall. Notice your hands resting.','Scan forearms, upper arms. Let shoulders drop.','Relax your jaw. Soften your forehead. Unclench.','Breathe into any remaining tension. Open your eyes slowly.']
  },
  resonance:{
    name:'Resonance Breathing (5.5-5.5)',
    source:'Lehrer & Gevirtz, 2014 \u2014 heart rate variability optimization',
    desc:'Breathing at ~5.5 breaths/min maximizes heart rate variability. The gold standard for vagal tone training.',
    phases:['Inhale','Exhale'],
    durations:[5,6],
    cycles:6,
    cues:['Slowly fill your lungs through your nose','Gently release, letting your body soften']
  },
  alternate:{
    name:'Alternate Nostril Breathing',
    source:'Telles et al., 2013; Nadi Shodhana from Hatha Yoga tradition',
    desc:'Balances sympathetic and parasympathetic activity. Reduces blood pressure and improves attention.',
    phases:['Right Nostril In','Hold','Left Nostril Out','Left Nostril In','Hold','Right Nostril Out'],
    durations:[4,2,4,4,2,4],
    cycles:3,
    cues:['Close left nostril, inhale right','Close both, hold gently','Close right nostril, exhale left','Keep right closed, inhale left','Close both, hold gently','Close left nostril, exhale right']
  },
  '22exhale':{
    name:'2:1 Extended Exhale (4-8)',
    source:'Gerritsen & Band, 2018 review \u2014 slow breathing and vagal stimulation',
    desc:'Exhale twice as long as inhale. Reliably increases parasympathetic activity and reduces anxiety.',
    phases:['Inhale','Exhale'],
    durations:[4,8],
    cycles:5,
    cues:['Breathe in smoothly through your nose','Long, slow release through your mouth']
  }
};

function showBreathDesc(){
  const id=document.getElementById('breathSelect').value;
  const desc=document.getElementById('breathDesc');
  const btn=document.getElementById('breathStartBtn');
  if(!id){if(desc)desc.innerHTML='';btn.style.display='none';return;}
  const t=breathTechniques[id];
  if(desc)desc.innerHTML='<strong style="color:var(--teal);">'+t.name+'</strong><br>'+t.desc+'<br><span style="color:var(--text-faint);font-size:10px;">'+t.source+'</span>';
  btn.style.display='block';
}

var breathInterval=null;
var breathActive=false;
var _breathSessionStartMs=0; // R15: wall-clock session start for Apple Health logging
var CIRC=628.3; // 2 * PI * 100
var breathVoice=null;
var breathVoiceReady=false;
var breathMuted=true;
var _breathCurrentAudio=null;  // HTML Audio for ElevenLabs breathwork voice
function toggleBreathMute(){
  breathMuted=!breathMuted;
  const btn=document.getElementById('breathMuteBtn');
  if(breathMuted){
    btn.textContent='\u{1F507} Voice Off';
    btn.classList.add('muted');
    if(_breathCurrentAudio){_breathCurrentAudio.pause();_breathCurrentAudio=null;}
    try{speechSynthesis.cancel();}catch(e){}
  }else{
    btn.textContent='\u{1F50A} Voice On';
    btn.classList.remove('muted');
  }
}

// VOICE SETUP -- warm female US English
function initBreathVoice(){
  if(!('speechSynthesis' in window))return;
  function pickVoice(){
    const voices=speechSynthesis.getVoices();
    if(!voices.length)return;
    // Prefer: Samantha (macOS/iOS), Microsoft Aria, Google US English Female
    const preferred=['samantha','aria','zira','female','woman'];
    const usVoices=voices.filter(v=>v.lang&&v.lang.startsWith('en')&&(v.lang.includes('US')||v.lang.includes('us')||v.lang==='en-US'||v.lang==='en_US'));
    const allEn=usVoices.length?usVoices:voices.filter(v=>v.lang&&v.lang.startsWith('en'));
    // Try to find a preferred female voice
    for(const pref of preferred){
      const match=allEn.find(v=>v.name.toLowerCase().includes(pref));
      if(match){breathVoice=match;breathVoiceReady=true;return;}
    }
    // Fallback: any English voice
    if(allEn.length){breathVoice=allEn[0];breathVoiceReady=true;}
  }
  pickVoice();
  if(!breathVoiceReady) speechSynthesis.onvoiceschanged=pickVoice;
}

async function speak(text){
  if(!breathActive||breathMuted)return;
  // Stop any in-flight breath audio
  if(_breathCurrentAudio){_breathCurrentAudio.pause();_breathCurrentAudio=null;}
  try{
    var res=await fetch(JARVIS_PROXY_URL+'/ops-speak',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:text}),
    });
    if(!res.ok)throw new Error('HTTP '+res.status);
    var blob=await res.blob();
    var blobUrl=URL.createObjectURL(blob);
    _breathCurrentAudio=new Audio(blobUrl);
    _breathCurrentAudio.volume=0.5;
    _breathCurrentAudio.onended=function(){URL.revokeObjectURL(blobUrl);_breathCurrentAudio=null;};
    _breathCurrentAudio.onerror=function(){URL.revokeObjectURL(blobUrl);_breathCurrentAudio=null;};
    _breathCurrentAudio.play();
  }catch(e){
    if(!breathVoiceReady)return;
    try{
      speechSynthesis.cancel();
      const utt=new SpeechSynthesisUtterance(text);
      if(breathVoice)utt.voice=breathVoice;
      utt.rate=0.85;utt.pitch=1.05;utt.volume=0.45;
      speechSynthesis.speak(utt);
    }catch(e2){console.log('Speech error:',e2);}
  }
}


// --- Breathwork: compute per-technique @keyframes and inject into <style id="breathKF"> ---
function buildBreathKeyframes(t){
  const total=t.durations.reduce((a,b)=>a+b,0);
  const SMIN=0.35,SMAX=1.0;
  const EASE='cubic-bezier(0.4,0,0.2,1)';

  function classify(phase){
    const p=phase.toLowerCase();
    if(p.includes('exhale')||p.includes('out')) return 'exhale';
    if(p.includes('inhale')||p.includes('sniff')||p.includes(' in')||p==='inhale') return 'inhale';
    return 'hold';
  }

  let kfOrb='@keyframes breathCycle {\n';
  let kfGlow='@keyframes breathGlow {\n';
  let cumSec=0,curScale=SMIN;

  t.phases.forEach((phase,i)=>{
    const pct=parseFloat((cumSec/total*100).toFixed(2));
    const type=classify(phase);
    const target=type==='inhale'?SMAX:type==='exhale'?SMIN:curScale;
    const seg=(type==='inhale'||type==='exhale')?EASE:'linear';
    const glowNow=parseFloat(((curScale-SMIN)/(SMAX-SMIN)).toFixed(2));
    kfOrb+=`  ${pct}%{transform:scale(${curScale});animation-timing-function:${seg};}\n`;
    kfGlow+=`  ${pct}%{opacity:${glowNow};animation-timing-function:${seg};}\n`;
    cumSec+=t.durations[i];
    curScale=target;
  });

  const finalGlow=parseFloat(((curScale-SMIN)/(SMAX-SMIN)).toFixed(2));
  kfOrb+=`  100%{transform:scale(${curScale});}\n}`;
  kfGlow+=`  100%{opacity:${finalGlow};}\n}`;

  let el=document.getElementById('breathKF');
  if(!el){el=document.createElement('style');el.id='breathKF';document.head.appendChild(el);}
  el.textContent=kfOrb+'\n'+kfGlow;
}

// R15 tier 1: haptic breathing. The web engine stays the single source of truth
// for timing (same as the orb animation + voice cues) -- native is a dumb
// effector that plays one duration-parameterized pattern per phase. On the
// iPhone (WKWebView) haptics MUST go native (iOS has no navigator.vibrate); the
// vibrate fallback below only does anything on Android web and is a harmless
// no-op on desktop.
//
// kind: 'in'|'out'  -> a CoreHaptics swell ramping over `seconds`
//       'hold'      -> silence (stillness is the point) -- sent for completeness
//       'tick'      -> one soft tap (non-breath transitions, e.g. body-scan regions)
//       'complete'  -> distinct success pattern
//       'prepare'/'release' -> start/stop the native engine around a session
function _breathClassifyPhase(techId,label){
  // Body scan isn't breath-paced; every region is a plain attention cue. Guard
  // by id FIRST so its "Settle In" phase can't be misread as an inhale.
  if(techId==='scan')return 'tick';
  var s=String(label||'');
  if(/exhale|\bout\b/i.test(s))return 'out';
  if(/inhale|sniff|\bin\b/i.test(s))return 'in';
  if(/hold/i.test(s))return 'hold';
  return 'tick';
}
function _breathHaptic(kind,seconds){
  if(!state.breathHaptics)return;
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h){
    try{h.postMessage({action:'haptic',kind:kind,seconds:(typeof seconds==='number'?seconds:0)});}catch(e){}
    return;
  }
  // Web fallback (Android only; desktop has no vibration hardware -> no-op).
  if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){
    try{
      if(kind==='complete')navigator.vibrate([40,60,40]);
      else if(kind==='in'||kind==='out'||kind==='tick')navigator.vibrate(30);
    }catch(e){}
  }
}

// R15 tier 2: Apple Health (Mindful Minutes). Native-only -- HealthKit is iOS,
// reached through the same `notify` channel as haptics/notifications.
function _healthRequestAuth(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(!h)return;
  try{h.postMessage({action:'requestHealthAuth'});}catch(e){}
}
// native -> JS after the OS authorization flow resolves. NOTE: for a WRITE type,
// HealthKit deliberately does NOT reveal whether the user allowed or denied
// (privacy), so `granted` here means "HealthKit is available and the sheet
// completed", NOT "the user said yes". We only flip the toggle back off when
// HealthKit is genuinely unavailable (e.g. iPad) -- if a user denied write at
// the sheet, the toggle stays on and completion writes just no-op silently
// (they can re-grant in Apple Health > Sources). Mirrors __notifPermissionResult.
window.__healthAuthResult=function(granted){
  if(granted)return;
  state.healthKitMindful=false;
  if(typeof save==='function')save();
  if(typeof _renderBreathHealthSettings==='function')_renderBreathHealthSettings();
};
function _healthLogMindful(startMs,endMs){
  if(!state.healthKitMindful)return;
  if(!(endMs>startMs))return;
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(!h)return;
  try{h.postMessage({action:'logMindful',start:startMs,end:endMs});}catch(e){}
}

function startBreathwork(){
  const id=document.getElementById('breathSelect').value;
  if(!id)return;
  // R3 stage 4 (F11): the floating capture + Axis buttons stayed on top of
  // the full-screen calming session (overlay z-index 500 < their 900).
  // Chrome has no place inside an immersive surface -- body class hides both
  // (see .cp-immersive in app.css); removed again on stop.
  document.body.classList.add('cp-immersive');
  const t=breathTechniques[id];
  breathActive=true;
  _trackEvent('tool_use','breathwork','Breathwork');
  initBreathVoice();
  // R15: wall-clock start (Date, not performance.now) so a completed session can
  // be logged to Apple Health with real sample dates; also warms the haptic engine.
  _breathSessionStartMs=Date.now();
  _breathHaptic('prepare');

  const isScan=(id==='scan');
  const totalCycleSec=t.durations.reduce((a,b)=>a+b,0);

  document.getElementById('breathOverlay').classList.add('active');
  document.getElementById('breathName').textContent=t.name;

  // Show correct visual
  const orbWrap=document.getElementById('breathOrbWrap');
  const scanWrap=document.getElementById('bodyScanWrap');
  orbWrap.style.display=isScan?'none':'flex';
  scanWrap.style.display=isScan?'flex':'none';

  if(isScan){
    document.querySelectorAll('.scan-part').forEach(p=>p.classList.remove('scan-lit','scan-glow'));
  } else {
    // Inject technique-specific @keyframes then apply CSS animation -- zero rAF height writes
    buildBreathKeyframes(t);
    const orb=document.getElementById('breathOrb');
    const glow=document.getElementById('breathOrbGlow');
    orb.style.animation='none';
    glow.style.animation='none';
    void orb.offsetWidth; // flush so the new animation fires from frame 0
    orb.style.animation=`breathCycle ${totalCycleSec}s linear ${t.cycles} forwards`;
    glow.style.animation=`breathGlow ${totalCycleSec}s linear ${t.cycles} forwards`;
  }

  // -- Tick: updates TEXT only (countdown + phase label). No layout-triggering properties. --
  const SCAN_MAP={
    'Settle In':[],
    'Feet & Legs':['sp-lleg','sp-rleg','sp-lfoot','sp-rfoot'],
    'Torso & Hands':['sp-torso','sp-lhand','sp-rhand'],
    'Arms & Shoulders':['sp-larm','sp-rarm'],
    'Neck & Face':['sp-neck','sp-head'],
    'Integrate':['sp-head','sp-neck','sp-torso','sp-larm','sp-rarm','sp-lhand','sp-rhand','sp-lleg','sp-rleg','sp-lfoot','sp-rfoot']
  };

  function updateBodyScan(phase){
    document.querySelectorAll('.scan-part').forEach(p=>p.classList.remove('scan-lit','scan-glow'));
    const parts=SCAN_MAP[phase]||[];
    const isIntegrate=(phase==='Integrate');
    parts.forEach(pid=>{const el=document.getElementById(pid);if(el)el.classList.add(isIntegrate?'scan-glow':'scan-lit');});
  }

  function onBreathComplete(){
    clearInterval(breathInterval);breathInterval=null;
    document.getElementById('breathPhase').textContent='\u2713 Complete';
    document.getElementById('breathCount').textContent='';
    document.getElementById('breathInstruction').textContent='Well done. Take a moment before returning.';
    document.getElementById('breathCycleInfo').textContent='';
    if(isScan){document.querySelectorAll('.scan-part').forEach(p=>{p.classList.remove('scan-lit');p.classList.add('scan-glow');});}
    document.querySelector('.breath-content').classList.add('breath-complete');
    setTimeout(()=>{document.querySelector('.breath-content').classList.remove('breath-complete');},600);
    speak('Well done. Take a moment.');
    _breathHaptic('complete');
    addPoints('breathwork');
    if(typeof _logCheckIn==='function')_logCheckIn('breath',{techniqueId:id,techniqueName:t.name,cycles:t.cycles});
    // R15 tier 2: log the finished session to Apple Health (Mindful Minutes),
    // only if the user opted in. Full-session span from the wall-clock start.
    if(typeof _healthLogMindful==='function'&&_breathSessionStartMs)_healthLogMindful(_breathSessionStartMs,Date.now());
    setTimeout(()=>{if(breathActive)stopBreathwork();},6000);
  }

  const sessionStart=performance.now();
  let lastPhaseKey='';

  function tick(){
    if(!breathActive)return;
    const elapsed=(performance.now()-sessionStart)/1000;
    const currentCycle=Math.floor(elapsed/totalCycleSec);
    if(currentCycle>=t.cycles){onBreathComplete();return;}

    const posInCycle=elapsed%totalCycleSec;
    let acc=0,pi=0;
    for(let i=0;i<t.phases.length;i++){
      acc+=t.durations[i];
      if(posInCycle<acc){pi=i;break;}
      if(i===t.phases.length-1)pi=i;
    }
    const phaseStart=acc-t.durations[pi];
    const remaining=t.durations[pi]-(posInCycle-phaseStart);
    const countDown=Math.ceil(remaining);
    const phaseKey=currentCycle+'-'+pi;

    // textContent writes -- safe, no layout reflow
    document.getElementById('breathPhase').textContent=t.phases[pi];
    document.getElementById('breathCount').textContent=countDown>0?countDown:'';
    document.getElementById('breathInstruction').textContent=t.cues[pi];
    if(t.cycles>1)document.getElementById('breathCycleInfo').textContent='Cycle '+(currentCycle+1)+' of '+t.cycles;

    if(phaseKey!==lastPhaseKey){
      lastPhaseKey=phaseKey;
      if(isScan)updateBodyScan(t.phases[pi]);
      speak(t.cues[pi]);
      // R15: haptic swell synced to the phase the user is entering.
      _breathHaptic(_breathClassifyPhase(id,t.phases[pi]),t.durations[pi]);
    }
  }

  tick();
  breathInterval=setInterval(tick,100); // text-only, 100ms is plenty
}

function stopBreathwork(){
  breathActive=false;
  document.body.classList.remove('cp-immersive');
  clearInterval(breathInterval);breathInterval=null;
  _breathHaptic('release'); // R15: tear down the native haptic engine
  if(_breathCurrentAudio){_breathCurrentAudio.pause();_breathCurrentAudio=null;}
  try{speechSynthesis.cancel();}catch(e){}
  const orb=document.getElementById('breathOrb');
  const glow=document.getElementById('breathOrbGlow');
  if(orb){orb.style.animation='none';orb.style.transform='scale(0.35)';}
  if(glow){glow.style.animation='none';glow.style.opacity='0';}
  document.getElementById('breathOverlay').classList.remove('active');
  document.getElementById('bodyScanWrap').style.display='none';
  document.querySelectorAll('.scan-part').forEach(p=>p.classList.remove('scan-lit','scan-glow'));
  _unblurDashboard();
}



// =======================================
// TASK LIST
// =======================================
var TIME_LABELS={'30':'30m','60':'1hr','90':'1.5hr','120':'2hr','180':'3hr','240':'4hr','360':'6hr','480':'8hr','720':'12hr','999':'4hr+'};
function fmtTimeEst(v){return TIME_LABELS[v]||'';}
var TIME_ORDER={'':9999,'30':30,'60':60,'90':90,'120':120,'180':180,'240':240,'360':360,'480':480,'720':720,'999':999};

function getAllTasks(){
  var tasks=[];
  // Pull subtasks from all projects
  state.projects.forEach(function(p){
    p.subtasks.forEach(function(st){
      tasks.push({id:st.id,name:st.name,done:st.done,priority:st.priority||'med',timeEst:st.timeEst||'',time:st.time||'',due:st.due||'',recurrence:st.recurrence||null,projectId:p.id,projectName:p.name,source:'project'});
    });
  });
  // Add standalone tasks
  (state.tasks||[]).forEach(function(t){
    var pName='';
    if(t.projectId){var pr=state.projects.find(function(p){return p.id===t.projectId;});if(pr)pName=pr.name;}
    tasks.push({id:t.id,name:t.name,done:t.done,priority:t.priority||'med',timeEst:t.timeEst||'',time:t.time||'',due:t.due||'',recurrence:t.recurrence||null,projectId:t.projectId||'',projectName:pName,source:'standalone'});
  });
  return tasks;
}

// =======================================
// TODAY VIEW (R2a) -- an opinionated "just today" composition, reachable via
// setViewMode('today') for verification. NOT yet the default (R2b wires the
// persistent toggle + persisted state.viewMode); nothing changes for an
// existing user until then.
//
// NOTE ON REUSE: this is intentionally its OWN filter, not factored out of
// _buildWatchSnapshot as the original staging note assumed. The watch
// snapshot's "tasks" is standalone-only, "not done", capped at 25 -- a
// different definition of "today" than this view needs (today/overdue,
// standalone + project subtasks, via getAllTasks()). Unifying them would
// silently change what ships to Joe's watch face; not this stage's job.
// =======================================
function _todaySlice(){
  var today=todayStr();
  var tasks=getAllTasks().filter(function(t){return !t.done&&t.due&&t.due<=today;})
    .sort(function(a,b){return (a.due||'').localeCompare(b.due||'');});
  var reminders=(state.reminders||[]).filter(function(r){return r.date&&r.date<=today;})
    .sort(function(a,b){return (a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||'');});
  var routineTab=_defaultRoutineTab();
  var routines=(state.routines&&state.routines[routineTab])||[];
  return {today:today,tasks:tasks,reminders:reminders,routineTab:routineTab,routines:routines};
}

function renderTodayView(){
  if(_isEditingInPanel('todayView')){_deferPanelRender('todayView');return;}
  var el=document.getElementById('todayView');
  if(!el)return;
  var slice=_todaySlice();
  var hour=new Date().getHours();
  var greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  var dateLine=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  var html='<div class="today-header"><div class="today-greeting">'+greeting+'</div><div class="today-date">'+dateLine+'</div></div>';

  // Timeline: reuses _tlCollectBlocks (same composite the desktop day-progress
  // banner draws from -- manual blocks + reminders/subtasks/tasks that have a
  // specific time set, deduped so a scheduled item doesn't double up). A timed
  // task/reminder can therefore also appear below in Tasks/Reminders -- same
  // overlap the Timeline panel and Task List already have on desktop, not new.
  var tlBlocks=(typeof _tlCollectBlocks==='function'?_tlCollectBlocks():[])
    .slice().sort(function(a,b){return a.startMin-b.startMin;});
  html+='<div class="today-section"><div class="today-section-title">Timeline</div>';
  html+=tlBlocks.length===0
    ?'<div class="empty-state">Nothing scheduled today.</div>'
    :'<div id="todayTimelineList">'+tlBlocks.map(function(b){
        var colorIdx=_tlProjectColor(b.projectId);
        var palette=['#5b8ce8','#7fb3a0','#e88c6a','#c77dba','#a0a0aa','#9e7bff','#5be8ff','#ff6b9d'];
        var color=colorIdx==='no-proj'?'rgba(255,255,255,0.4)':palette[colorIdx];
        var endMin=b.startMin+b.durMin;
        return '<div class="reminder-item" onclick="editTimelineBlock(\''+b.id+'\')">'
          +'<span class="rem-icon" style="color:'+color+';">●</span>'
          +'<div class="rem-body">'
          +'<div class="rem-text">'+esc(b.name)+'</div>'
          +'<div class="rem-when">'+_tlFmtTime(b.startMin)+' – '+_tlFmtTime(endMin)+'</div>'
          +'</div></div>';
      }).join('')+'</div>';
  html+='</div>';

  html+='<div class="today-section"><div class="today-section-title">Today &amp; overdue</div>';
  html+=slice.tasks.length===0
    ?'<div class="empty-state">Nothing due today.</div>'
    :'<div id="todayTaskList">'+slice.tasks.map(_taskRowHTML).join('')+'</div>';
  html+='</div>';

  html+='<div class="today-section"><div class="today-section-title">'+(slice.routineTab==='morning'?'Morning routine':'Evening routine')+'</div>';
  html+=slice.routines.length===0
    ?'<div class="empty-state">No '+slice.routineTab+' routine set up.</div>'
    :'<div id="todayRoutineList">'+slice.routines.map(function(r){
        return '<div class="routine-item '+(r.done?'r-done':'')+'" onclick="toggleRoutine(\''+slice.routineTab+"','"+r.id+'\',event)">'
          +'<div class="r-check '+(r.done?'r-checked':'')+'">'+(r.done?'✓':'')+'</div>'
          +'<span class="r-name">'+esc(r.name)+'</span>'
          +'</div>';
      }).join('')+'</div>';
  html+='</div>';

  html+='<div class="today-section"><div class="today-section-title">Reminders</div>';
  html+=slice.reminders.length===0
    ?'<div class="empty-state">No reminders due.</div>'
    :'<div id="todayReminderList">'+slice.reminders.map(function(r){
        return '<div class="reminder-item"><span class="rem-icon">🔵</span><div class="rem-body">'
          +'<div class="rem-text">'+esc(r.text)+'</div>'
          +'<div class="rem-when">'+(r.date?fmtDate(r.date):'')+(r.time?' at '+fmtTime(r.time):'')+'</div>'
          +'</div></div>';
      }).join('')+'</div>';
  html+='</div>';

  html+='<div class="today-section"><button class="btn btn-accent" onclick="if(_isMobile()){showMobilePanel(\'time\');}else{openPanelOverlay(\'time\');}">Open Tool Kit</button></div>';

  el.innerHTML=html;
  slice.tasks.forEach(function(t){_wireTaskRowEditable(t,el);});
  refreshEditables();
}

// R2b: the persistent Today/Everything switch, driving both platforms. Persists
// state.viewMode, syncs every .vms-btn (there are two -- desktop header + mobile
// home header -- both keyed by class, not id, so this one call updates both),
// and swaps #todayView vs #dashboard. On mobile the Today branch also clears any
// open-panel state (Today is a home-like surface: header visible, no back-bar,
// nothing left mobile-visible, scrolled to top), while Everything hands off to
// showMobileHome() exactly as before.
function setViewMode(mode){
  var todayEl=document.getElementById('todayView');
  var dashEl=document.getElementById('dashboard');
  if(!todayEl||!dashEl)return;
  if(mode!=='today')mode='everything';
  state.viewMode=mode;
  save();
  document.querySelectorAll('.vms-btn').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
  if(mode==='today'){
    renderTodayView();
    todayEl.style.display='';
    dashEl.style.display='none';
    if(_isMobile()){
      document.getElementById('mobileHome').classList.remove('active');
      var mbb=document.getElementById('mobileBackBar');if(mbb)mbb.classList.remove('active');
      var aw=document.querySelector('.app-wrap');if(aw)aw.classList.remove('panel-open');
      document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('mobile-visible');});
      var hdr=document.querySelector('.header');if(hdr)hdr.classList.add('mobile-visible');
      window.scrollTo(0,0);
    }
  }else{
    todayEl.style.display='none';
    dashEl.style.display='';
    if(_isMobile())showMobileHome();
  }
}
// One entry point for "go to the mobile home surface" that honors the current
// mode -- Today lands on the Today view, Everything on the tile launcher.
// Replaces the three bare showMobileHome() calls that hardcoded Everything
// (back-bar tap, swipe-back, resize-into-mobile). Safe on desktop: setViewMode
// no-ops its mobile-only side effects there.
function _goMobileHome(){setViewMode(state.viewMode);}

// Task-row markup, factored out of renderTaskList so the Today view (R2)
// renders the identical row -- same ids, same editable wiring, same actions.
// Pure string builder; ids are per-task, so it's safe to mount in any container.
function _taskRowHTML(t){
  var nameId='tlname_'+t.id;
  var dueId='tldue_'+t.id;
  var dueHTML;
  if(t.due){
    dueHTML='<span class="date-editable tl-due-edit" id="'+dueId+'">'+fmtDate(t.due)+'</span>';
  }else{
    dueHTML='<span class="date-editable tl-due-edit" id="'+dueId+'" style="color:var(--text-faint);">+ date</span>';
  }
  return '<div class="tl-item">'+
    '<div class="tl-check" onclick="toggleTaskDone(\''+t.id+'\',\''+t.source+'\',\''+t.projectId+'\')"></div>'+
    '<div class="tl-body"><div class="tl-name"><span class="editable" id="'+nameId+'">'+esc(t.name)+'</span></div>'+
    '<div class="tl-meta">'+
    '<span class="tl-proj-badge tl-editable-badge" id="tlproj_'+t.id+'" onclick="event.stopPropagation();showTaskProjectPicker(\''+t.id+'\',\''+t.source+'\',\''+(t.projectId||'')+'\',this)">'+(t.projectName?esc(t.projectName):'+ project')+'</span>'+
    '<span class="tl-time-badge tl-editable-badge" id="tltime_'+t.id+'" onclick="event.stopPropagation();showTaskTimePicker(\''+t.id+'\',\''+t.source+'\',\''+(t.projectId||'')+'\',this)">'+(t.timeEst?fmtTimeEst(t.timeEst):'+ time')+'</span>'+
    '<span class="tl-time-badge tl-editable-badge" id="tlstart_'+t.id+'" onclick="event.stopPropagation();showTaskStartPicker(\''+t.id+'\',\''+t.source+'\',\''+(t.projectId||'')+'\',this)">'+(t.time?'\u{1F551} '+_tlFmtTime(_tlParseTime(t.time)):'+ start')+'</span>'+
    '<span class="tl-repeat-badge tl-editable-badge" id="tlrepeat_'+t.id+'" onclick="event.stopPropagation();showTaskRepeatPicker(\''+t.id+'\',\''+t.source+'\',\''+(t.projectId||'')+'\',this)">'+(t.recurrence&&t.recurrence.freq?'\u{1F501} '+_recurrenceBadgeLabel(t):'+ repeat')+'</span>'+
    dueHTML+
    '</div></div>'+
    '<span class="wt-clock-btn '+(_isScheduledToday(t.id)?'scheduled':'')+'" onclick="event.stopPropagation();handleWorkTodayClick(\''+(t.source==='standalone'?'task':'subtask')+'\',\''+t.id+'\',\''+(t.projectId||'')+'\')" title="Work on this today">&#128197;</span>'+
    (t.source==='standalone'
      ?'<span class="tl-del" onclick="deleteStandaloneTask(\''+t.id+'\')" title="Delete task">✕</span>'
      :'<span class="tl-del" onclick="deleteSubtask(\''+t.projectId+'\',\''+t.id+'\')" title="Delete subtask">✕</span>')+
    '</div>';
}
// Editable-cell wiring for one task row, factored alongside _taskRowHTML.
// Caller is responsible for calling refreshEditables() once after wiring a batch.
// `root` scopes the cell lookup to ONE view's container. The Today view and the
// Everything task list both render task rows from _taskRowHTML with identical
// element ids (tlname_<id>/tldue_<id>), so a bare document.getElementById would
// always resolve to whichever view is first in the DOM (Today) and leave the
// other view's name/date cells unwired -- silently breaking inline editing there.
// Scoping to the caller's container wires each view's own cells independently.
function _wireTaskRowEditable(t,root){
  var scope=root||document;
  var nameEl=scope.querySelector('[id="tlname_'+t.id+'"]');
  var dueEl=scope.querySelector('[id="tldue_'+t.id+'"]');
  if(nameEl){
    if(t.source==='standalone'){
      makeEditable(nameEl,function(v){editStandaloneTaskName(t.id,v);});
    }else{
      makeEditable(nameEl,function(v){editSubtaskName(t.projectId,t.id,v);});
    }
  }
  if(dueEl){
    if(t.source==='standalone'){
      makeDateClickable(dueEl,t.due,function(v){editStandaloneTaskDue(t.id,v);});
    }else{
      makeDateClickable(dueEl,t.due,function(v){editSubtaskDue(t.projectId,t.id,v);});
    }
  }
}

function renderTaskList(){
  if(_isEditingInPanel('taskListItems')){_deferPanelRender('taskListItems');return;}
  var el=document.getElementById('taskListItems');if(!el)return;
  var all=getAllTasks();
  var sortBy=document.getElementById('tlSortBy');var sort=sortBy?sortBy.value:'due';
  var filterProj=document.getElementById('tlFilterProj');var filt=filterProj?filterProj.value:'all';
  var upcomingEl=document.getElementById('taskUpcomingOnly');

  // Detect overlay mode -- skip blank-when-unchecked if expanded
  var taskPanel=document.querySelector('.panel[data-panel="tasklist"]');
  var inOverlay=taskPanel&&!taskPanel.classList.contains('panel-tile');
  // "Show all" toggle: when checked on the tile, render every task using
  // the current sort (due date is the default). Date-window filter removed.
  var showAll=!inOverlay&&upcomingEl&&upcomingEl.checked;

  // Filter by project
  if(filt!=='all')all=all.filter(function(t){return t.projectId===filt||(t.projectIds&&t.projectIds.indexOf(filt)>=0);});

  // Save total count (for badge) before any further filtering
  var totalCount=all.filter(function(t){return !t.done;}).length;

  // R7 stage 3: search, full-list view only. Guarded on inOverlay -- the
  // #tlSearch input is CSS-hidden in tile mode (same rule as Notes' search),
  // but its DOM node and value persist once hidden, so without this guard a
  // query typed during a prior full-list visit would silently keep filtering
  // the tile's "due today" view after the panel collapsed again.
  var tlSearchEl=document.getElementById('tlSearch');
  var tlSearch=inOverlay&&tlSearchEl?tlSearchEl.value.toLowerCase().trim():'';
  if(tlSearch)all=all.filter(function(t){return (t.name||'').toLowerCase().indexOf(tlSearch)>=0;});

  // Update completed counter badge (green) -- lifetime total, not the capped
  // archive's length (that pins at COMPLETED_TASKS_MAX once you cross it).
  // Computed here, before the tile/overlay branching below, because the tile
  // (collapsed) branch used to `return` before ever reaching this -- the
  // badge is part of the panel header (visible in tile mode too) but was
  // only ever updated when the panel was expanded/showAll, so completing a
  // task from the tile silently never moved it.
  var compCount=state.completedTasksLifetime!==undefined?state.completedTasksLifetime:(state.completedTasks||[]).length;
  var compBadge=document.getElementById('taskListCompletedBadge');
  if(compBadge){
    compBadge.textContent='✓ '+compCount;
    compBadge.title=compCount+' completed task'+(compCount!==1?'s':'');
    compBadge.style.display=compCount>0?'inline-flex':'none';
  }
  // Completed archive folder (only present in the expanded view, hence the
  // null guard -- harmless no-op when the tile branch returns below)
  var compEl=document.getElementById('taskListCompleted');
  if(compEl){
    var comp=state.completedTasks||[];
    if(comp.length===0){
      compEl.innerHTML='';
    }else{
      // Three different numbers used to be in play here: the lifetime total,
      // the stored archive (capped at COMPLETED_TASKS_MAX), and a hardcoded
      // slice of 50 that actually got rendered. The header showed the middle
      // one, so it read "Completed (100)" while listing 50 rows and while the
      // real total was higher -- it looked like a ceiling on work done.
      //
      // Now: the headline number is the LIFETIME total (same source as the
      // panel-header badge, so the two agree), and the qualifier states how
      // many are actually listed. Everything the archive holds is rendered --
      // it is already in memory and the folder is collapsed by default, so
      // there was nothing bought by rendering only half of it.
      var compLifetime=state.completedTasksLifetime!==undefined?state.completedTasksLifetime:comp.length;
      // Only qualify when something is genuinely hidden; under the cap the
      // count and the list match and the extra clause is just noise.
      var compSub=compLifetime>comp.length
        ?' <span style="font-size:11px;color:var(--text-faint);font-weight:400;">· '+comp.length+' most recent</span>'
        :'';
      compEl.innerHTML='<div class="tl-completed-header" onclick="toggleCompletedFolder(this)">'
        +'<span class="tl-completed-arrow">&#9654;</span>'
        +'<span>&#10003; Completed ('+compLifetime+')'+compSub+'</span>'
        +'</div>'
        +'<div class="tl-completed-list">'
        +comp.map(function(t){
          var d=t.archivedAt?new Date(t.archivedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
          return '<div class="tl-item tl-done" style="opacity:0.65;">'
            +'<div class="tl-check checked" style="cursor:default;">✓</div>'
            +'<div class="tl-body"><div class="tl-name">'+esc(t.name)+'</div>'
            +'<div class="tl-meta">'+(t.projectName?'<span class="tl-proj-badge">'+esc(t.projectName)+'</span>':'')
            +(d?'<span style="font-size:10px;color:var(--text-faint);">'+d+'</span>':'')
            +'</div></div>'
            +'<span class="tl-del" onclick="removeCompleted(\''+t.id+'\')" title="Remove">✕</span>'
            +'</div>';
        }).join('')
        // The old "+N older items" footer counted the gap between the 50 rows
        // rendered and the 100 stored. Every stored item is listed now, so it
        // would always read "+0"; what is genuinely not shown (completions
        // older than the archive cap) is covered by the header's qualifier.
        +'</div>';
    }
  }

  // Sort
  if(sort==='time'){
    all.sort(function(a,b){var ta=TIME_ORDER[a.timeEst]||9999,tb=TIME_ORDER[b.timeEst]||9999;return ta-tb;});
  }else if(sort==='project'){
    all.sort(function(a,b){var na=a.projectName||'zzz',nb=b.projectName||'zzz';return na.localeCompare(nb);});
  }else if(sort==='due'){
    all.sort(function(a,b){var da=a.due||'9999',db=b.due||'9999';return da.localeCompare(db);});
  }

  var today=todayStr();
  var pcEl=document.getElementById('pc_tasklist');
  
  // Mobile/tile default: show TODAY's due tasks instead of blanking the tile.
  // The tile used to render nothing here regardless of what state.tasks held,
  // while the count badge above it kept showing the real total -- a fresh
  // capture looked like it vanished (F9). "Show all" (checked) still renders
  // the full unfiltered list via the branch below; this only changes the
  // unchecked default.
  if(!inOverlay&&!showAll){
    var todayTasks=all.filter(function(t){return !t.done&&t.due===today;});
    var hiddenCount=totalCount-todayTasks.length;
    var showAllLink='<a href="#" onclick="document.getElementById(\'taskUpcomingOnly\').checked=true;renderTaskList();return false;">Show all</a>';
    // Overdue triage bar: with the tile defaulting to "just today", overdue
    // items are otherwise invisible here -- after a few days away they'd
    // silently rot behind the Show-all toggle. One-tap batch actions, no
    // per-item decisions (that's the point: triage must be cheaper than
    // avoidance). Muted styling on purpose -- it's a count, not an alarm.
    var triageHTML=_tlTriageBarHTML(all,today);
    if(todayTasks.length===0){
      el.innerHTML=triageHTML
        +'<div class="tl-empty-hint" style="padding:8px 0;color:var(--text-dim);font-size:13px;">'
        +(hiddenCount>0
          ?'Nothing due today. '+hiddenCount+' other task'+(hiddenCount!==1?'s':'')+' — '+showAllLink
          :'Nothing due today. Add one below.')
        +'</div>';
      if(pcEl){pcEl.style.flex='none';pcEl.style.minHeight='0';}
    }else{
      if(pcEl){pcEl.style.flex='';pcEl.style.minHeight='';}
      el.innerHTML=triageHTML
        +todayTasks.map(_tlRowWithSelect).join('')
        +(hiddenCount>0?'<div class="tl-empty-hint" style="padding:8px 0 0;color:var(--text-dim);font-size:13px;">'+hiddenCount+' more task'+(hiddenCount!==1?'s':'')+' not due today — '+showAllLink+'</div>':'');
      todayTasks.forEach(function(t){_wireTaskRowEditable(t,el);});
      refreshEditables();
    }
    document.getElementById('taskListCount').textContent=totalCount;
    if(typeof _updateTileSummaryTasklist==='function')_updateTileSummaryTasklist();
    return;
  }
  
  // Checkbox is checked -- show matching items or blank if none
  if(all.length===0){
    // R13/F23: this was a bare blank region -- no message, no next step.
    // (F9's original capture-trust bug was a DIFFERENT cause of the same
    // blank-looking panel, already fixed in R1; this is the genuinely-
    // nothing-here case, which was never addressed.)
    var tlNothingFiltered=tlSearch||filt!=='all';
    el.innerHTML='<div class="empty-state"><p style="margin:0 0 8px;color:var(--text-dim);">'
      +(tlNothingFiltered?'No matching tasks.':'No tasks yet. Add one below.')
      +'</p>'
      +(tlNothingFiltered?'':'<button class="btn btn-accent btn-sm" onclick="document.getElementById(\'tlNewName\').focus()" style="margin:0 auto;display:block;">+ Add your first task</button>')
      +'</div>';
    if(pcEl){pcEl.style.flex='';pcEl.style.minHeight='';}
  }else{
    if(pcEl){pcEl.style.flex='';pcEl.style.minHeight='';}
    el.innerHTML=(sort==='due')
      ?_tlGroupedListHTML(all,today,_tlRenderLimit)
      :_tlBatchedRowsHTML(all,_tlRenderLimit,_tlRowWithSelect,_tlShowMoreHTML);
    all.forEach(function(t){_wireTaskRowEditable(t,el);});
    refreshEditables();
  }
  document.getElementById('taskListCount').textContent=totalCount;
  updateTLProjectDropdowns();
  if(typeof _updateTileSummaryTasklist==='function')_updateTileSummaryTasklist();
}

// =======================================
// OVERDUE TRIAGE (R1 stage 4) -- one-tap batch recovery for the re-entry-
// after-days-away case. The tile's "just today" default (stage 1) means
// overdue tasks never render there; this bar is how they surface, with an
// exit ramp instead of a wall. Design constraints, in order: (1) each action
// is ONE tap that decides for every overdue item at once -- no per-item
// review pass; (2) nothing here deletes or completes anything, so no
// tombstones and no new merge rules -- due-date edits ride the same save()
// path as editStandaloneTaskDue/editSubtaskDue; (3) a batch rewrite of due
// dates gets an 8s in-bar Undo (in-memory only) since there is no other way
// back to the old dates.
// "Top 3" = the three MOST RECENTLY due (b.due vs a.due below): a task due
// yesterday is far likelier still live than one from three weeks ago, so the
// recent ones surface and the stale ones snooze. Recurring tasks are included
// on purpose -- _nextRecurrenceDate already counts forward from today for
// late completions, so shifting their due can't derail the cadence.
// =======================================
var _tlTriageUndo=null,_tlTriageNote='',_tlTriageNoteTimer=null;
function _tlPlusDays(dayStr,days){
  var d=new Date(dayStr+'T00:00:00');
  d.setDate(d.getDate()+days);
  return _dayKey(d);
}
function _tlSetDueByRef(ref,newDue){
  if(ref.source==='standalone'){
    var t=(state.tasks||[]).find(function(x){return x.id===ref.id;});
    if(t)t.due=newDue;
  }else{
    var p=state.projects.find(function(p){return p.id===ref.projectId;});
    var s=p&&p.subtasks.find(function(s){return s.id===ref.id;});
    if(s)s.due=newDue;
  }
}
function _tlTriageBarHTML(all,today){
  if(_tlTriageNote){
    return '<div class="tl-triage-bar tl-triage-note">'+_tlTriageNote
      +' · <a onclick="tlTriageUndo()">Undo</a></div>';
  }
  var od=all.filter(function(t){return !t.done&&t.due&&t.due<today;});
  if(!od.length)return '';
  var n=od.length,one=(n===1);
  var b='<div class="tl-triage-bar"><span class="tl-triage-label">'+n+' overdue</span>';
  b+='<button class="tl-triage-btn" onclick="tlTriage(\'all\')">'+(one?'Move to today':'Move all to today')+'</button>';
  if(n>=4)b+='<button class="tl-triage-btn" onclick="tlTriage(\'top3\')">Top 3 today, snooze rest</button>';
  b+='<button class="tl-triage-btn" onclick="tlTriage(\'snooze\')">'+(one?'Snooze a week':'Snooze all a week')+'</button>';
  b+='</div>';
  return b;
}
// R7 stage 4: group the full (expanded) list by due-date bucket with jump
// chips at the top -- this is the actual fix for "380 tasks is 150+ swipes"
// (F10); stage 1 made the list reachable, this makes it navigable. Only
// meaningful when sorted by due date and when there's more than one bucket
// present -- otherwise it's pure noise over the plain row list.
function _tlGroupedListHTML(items,today,limit){
  var tomorrow=_tlPlusDays(today,1);
  var weekEnd=_tlPlusDays(today,7);
  var order=['overdue','today','tomorrow','week','later','none'];
  var buckets={};
  items.forEach(function(t){
    var info=_dateGroupInfo(t.due,today,tomorrow,weekEnd);
    if(!buckets[info.key])buckets[info.key]={label:info.label,rows:[]};
    buckets[info.key].rows.push(t);
  });
  var present=order.filter(function(k){return buckets[k];});
  if(present.length<2)return _tlBatchedRowsHTML(items,limit,_tlRowWithSelect,_tlShowMoreHTML);
  var chips=present.map(function(k){
    return '<button type="button" class="tl-jump-chip" onclick="document.getElementById(\'tlgroup-'+k+'\').scrollIntoView({behavior:\'smooth\',block:\'start\'})">'+esc(buckets[k].label)+' <span class="tl-jump-chip-count">'+buckets[k].rows.length+'</span></button>';
  }).join('');
  // Every header renders regardless of the batch limit so jump chips always
  // have a real target -- only the ROWS under each bucket are capped, in
  // bucket order, so a "Show more" at the end always reveals the next
  // chronological rows rather than jumping around.
  var remaining=limit;
  var body=present.map(function(k){
    var rows=buckets[k].rows;
    var take=Math.max(0,Math.min(remaining,rows.length));
    remaining-=take;
    return '<div class="tl-group-header" id="tlgroup-'+k+'">'+esc(buckets[k].label)+'</div>'
      +rows.slice(0,take).map(_tlRowWithSelect).join('');
  }).join('');
  if(items.length>limit)body+=_tlShowMoreHTML(items.length-limit);
  return '<div class="tl-jump-chips">'+chips+'</div>'+body;
}
function tlTriage(mode){
  // Recollect at click time -- the rendered bar may be stale (sync, edits).
  var today=todayStr();
  var od=getAllTasks().filter(function(t){return !t.done&&t.due&&t.due<today;});
  if(!od.length){renderTaskList();return;}
  od.sort(function(a,b){return b.due.localeCompare(a.due);}); // most recently due first
  _tlTriageUndo=od.map(function(t){return {id:t.id,source:t.source,projectId:t.projectId,oldDue:t.due};});
  var week=_tlPlusDays(today,7);
  var n=od.length;
  if(mode==='all'){
    od.forEach(function(t){_tlSetDueByRef(t,today);});
    _tlTriageNote='Moved '+n+' to today';
  }else if(mode==='snooze'){
    od.forEach(function(t){_tlSetDueByRef(t,week);});
    _tlTriageNote='Snoozed '+n+' to next week';
  }else{
    var k=Math.min(3,n);
    od.slice(0,k).forEach(function(t){_tlSetDueByRef(t,today);});
    od.slice(k).forEach(function(t){_tlSetDueByRef(t,week);});
    _tlTriageNote=k+' moved to today, '+(n-k)+' snoozed a week';
  }
  save();
  renderProjects(); // subtask due dates show in the Projects panel too
  renderTaskList();
  if(_tlTriageNoteTimer)clearTimeout(_tlTriageNoteTimer);
  _tlTriageNoteTimer=setTimeout(function(){
    _tlTriageNote='';_tlTriageUndo=null;_tlTriageNoteTimer=null;
    renderTaskList();
  },8000);
}
function tlTriageUndo(){
  if(!_tlTriageUndo)return;
  _tlTriageUndo.forEach(function(r){_tlSetDueByRef(r,r.oldDue);});
  _tlTriageUndo=null;_tlTriageNote='';
  if(_tlTriageNoteTimer){clearTimeout(_tlTriageNoteTimer);_tlTriageNoteTimer=null;}
  save();
  renderProjects();
  renderTaskList();
  toast('Restored previous due dates');
}

// =======================================
// TASK LIST -- FILTERS DISCLOSURE (F4). Everything view's task panel only:
// this whole section is wired from the tasklist panel markup and reached only
// through renderTaskList()'s own row map (_tlRowWithSelect). renderTodayView
// renders its own rows straight from _taskRowHTML (no select-mode wrapper),
// so none of this can appear on the Today view.
// =======================================
// toggleTaskFilters removed with the Filters disclosure it opened (Joe's call:
// the task panel was too cluttered). The saved-filter and bulk-select helpers
// below are now unreachable from the UI but left intact and guarded, so the
// section can be restored by re-adding the markup alone.

// -- Saved filter presets: bundle the existing sort/project/show-all controls --
function _renderSavedFilterOptions(){
  var sel=document.getElementById('tlSavedFilterSelect');if(!sel)return;
  var presets=state.savedTaskFilters||[];
  sel.innerHTML='<option value="">Saved filters…</option>'+presets.map(function(p,i){
    return '<option value="'+i+'">'+esc(p.name)+'</option>';
  }).join('');
}
function saveCurrentTaskFilter(){
  var name=prompt('Name this filter:');
  if(!name)return;
  var sortBy=document.getElementById('tlSortBy');
  var filterProj=document.getElementById('tlFilterProj');
  var upcomingEl=document.getElementById('taskUpcomingOnly');
  if(!state.savedTaskFilters)state.savedTaskFilters=[];
  state.savedTaskFilters.push({
    name:name,
    sort:sortBy?sortBy.value:'due',
    proj:filterProj?filterProj.value:'all',
    upcomingOnly:!!(upcomingEl&&upcomingEl.checked)
  });
  save();
  _renderSavedFilterOptions();
  toast('Filter saved');
}
function applySavedTaskFilter(idxStr){
  if(idxStr==='')return;
  var preset=(state.savedTaskFilters||[])[parseInt(idxStr,10)];
  if(!preset)return;
  var sortBy=document.getElementById('tlSortBy');
  var filterProj=document.getElementById('tlFilterProj');
  var upcomingEl=document.getElementById('taskUpcomingOnly');
  if(sortBy)sortBy.value=preset.sort;
  if(filterProj)filterProj.value=preset.proj;
  if(upcomingEl)upcomingEl.checked=preset.upcomingOnly;
  renderTaskList();
}

// R7 stage 5: progressive rendering past ~100 items (F10). Stage 1 made the
// panel grow to its full natural height (page scrolls, no inner scrollbox
// anymore) rather than a bounded scrollable div -- that rules out classic
// windowed/recycling virtualization (translateY row positioning needs a
// fixed-height scroll viewport, and reintroducing one would undo stage 1).
// This is the safe equivalent: render the first 100 rows, a manual "Show
// more" control appends the next 100. Existing rendered rows are never
// removed/recycled, so an in-progress inline edit is never at risk -- and
// renderTaskList()/renderReminders() already defer any re-render while
// editing is active (_isEditingInPanel), so a show-more click mid-edit
// elsewhere in the list is already covered by that same guard.
var _TL_RENDER_BATCH=100;
var _tlRenderLimit=_TL_RENDER_BATCH;
var _remRenderLimit=_TL_RENDER_BATCH;
function _tlShowMoreHTML(remainingCount){
  return '<div class="tl-show-more"><button type="button" class="tl-jump-chip" onclick="_tlRenderLimit+='+_TL_RENDER_BATCH+';renderTaskList();">Show more ('+remainingCount+' left)</button></div>';
}
function _remShowMoreHTML(remainingCount){
  return '<div class="tl-show-more"><button type="button" class="tl-jump-chip" onclick="_remRenderLimit+='+_TL_RENDER_BATCH+';renderReminders();">Show more ('+remainingCount+' left)</button></div>';
}
function _tlBatchedRowsHTML(items,limit,rowFn,showMoreFn){
  var html=items.slice(0,limit).map(rowFn).join('');
  if(items.length>limit)html+=showMoreFn(items.length-limit);
  return html;
}

// -- Batch select / bulk operations --
var _tlSelectMode=false;
var _tlSelected=Object.create(null);
function toggleTaskSelectMode(on){
  _tlSelectMode=!!on;
  _tlSelected=Object.create(null);
  var actions=document.getElementById('tlSelectModeActions');
  if(actions)actions.style.display=_tlSelectMode?'flex':'none';
  var selectAll=document.getElementById('tlSelectAll');
  if(selectAll)selectAll.checked=false;
  renderTaskList();
}
function _tlToggleSelect(id,checked){
  if(checked)_tlSelected[id]=true;else delete _tlSelected[id];
}
function _tlToggleSelectAll(checked){
  document.querySelectorAll('#taskListItems .tl-select-check').forEach(function(cb){
    cb.checked=checked;
    _tlToggleSelect(cb.dataset.id,checked);
  });
}
// Wraps _taskRowHTML with a select checkbox ONLY when _tlSelectMode is on.
// Deliberately a separate function (not a second param on _taskRowHTML)
// since renderTodayView also calls _taskRowHTML via a bare .map() -- adding a
// param there would receive the array index as a truthy "selectable" flag
// for every row past the first and leak the checkbox onto Today.
function _tlRowWithSelect(t){
  var row=_taskRowHTML(t);
  if(!_tlSelectMode)return row;
  var checked=_tlSelected[t.id]?' checked':'';
  return row.replace('<div class="tl-item">','<div class="tl-item"><input type="checkbox" class="tl-select-check" data-id="'+t.id+'"'+checked+' onclick="event.stopPropagation();_tlToggleSelect(\''+t.id+'\',this.checked)" style="margin-right:8px;flex-shrink:0;">');
}
function _tlBulkComplete(){
  var ids=Object.keys(_tlSelected);
  if(!ids.length){toast('No tasks selected');return;}
  var all=getAllTasks();
  var n=0;
  ids.forEach(function(id){
    var t=all.find(function(t){return t.id===id;});
    if(t&&!t.done){toggleTaskDone(t.id,t.source,t.projectId);n++;}
  });
  _tlSelected=Object.create(null);
  toast('Completed '+n+' task'+(n!==1?'s':''));
}
function _tlBulkDelete(){
  var ids=Object.keys(_tlSelected);
  if(!ids.length){toast('No tasks selected');return;}
  var all=getAllTasks();
  _confirm('Delete '+ids.length+' selected task'+(ids.length!==1?'s':'')+'?',function(){
    ids.forEach(function(id){
      var t=all.find(function(t){return t.id===id;});
      if(!t)return;
      _tombstone(id);
      if(t.source==='standalone'){
        state.tasks=state.tasks.filter(function(x){return x.id!==id;});
      }else{
        var p=state.projects.find(function(p){return p.id===t.projectId;});
        if(p)p.subtasks=p.subtasks.filter(function(x){return x.id!==id;});
      }
    });
    _tlSelected=Object.create(null);
    save();renderProjects();renderTaskList();
    toast('Deleted '+ids.length+' task'+(ids.length!==1?'s':''));
  },{destructive:true,confirmText:'Delete'});
}

// -- Schedule to timeline: wires existing timeEst data into the existing
// tlBlocks pipeline. Mirrors _writeBlock's block shape (legacy.js ~9050) and
// reuses _suggestWorkTime's existing gap-finding so batched items stack
// without conflicting, exactly like the single-item Work Today flow does.
function _taskToTimelineBlock(t,targetDate){
  targetDate=targetDate||todayStr();
  var duration=Math.min(parseInt(t.timeEst)||60,720);
  var startMin=_suggestWorkTime(duration,targetDate);
  var hh=Math.floor(startMin/60),mm=startMin%60;
  var timeVal=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
  var block=_buildTimelineBlock({
    name:t.name,
    date:targetDate,
    time:timeVal,
    duration:duration,
    projectId:t.projectId||'',
    priority:t.priority||'med',
    linkedType:t.source==='standalone'?'task':'subtask',
    linkedId:t.id
  });
  if(!state.tlBlocks)state.tlBlocks=[];
  state.tlBlocks.push(block);
  return block;
}
function _scheduleSelectedToTimeline(){
  var ids=Object.keys(_tlSelected);
  if(!ids.length){toast('No tasks selected');return;}
  var all=getAllTasks();
  var scheduled=0,noTime=0,already=0;
  ids.forEach(function(id){
    var t=all.find(function(t){return t.id===id;});
    if(!t||t.done)return;
    if(!t.timeEst){noTime++;return;}
    if(_isScheduledToday(id)){already++;return;}
    _taskToTimelineBlock(t);
    scheduled++;
  });
  save();renderTaskList();renderTimeline();
  if(typeof updateDayProgress==='function')updateDayProgress();
  var msg='Scheduled '+scheduled+' task'+(scheduled!==1?'s':'');
  if(noTime)msg+=', '+noTime+' skipped (no time estimate)';
  if(already)msg+=', '+already+' already scheduled';
  toast(msg);
}

function toggleTaskDone(id,source,projId){
  var srcEl=document.querySelector('.tl-check[onclick*="'+id+'"]')||document.querySelector('.st-check[onclick*="'+id+'"]');
  if(source==='project'){
    var p=state.projects.find(function(p){return p.id===projId;});
    if(p){
      var s=p.subtasks.find(function(s){return s.id===id;});
      if(s){
        _archiveCompletedTask({
          id:s.id,name:s.name,projectName:p.name,projectId:p.id,
          archivedAt:new Date().toISOString(),source:'project'
        });
        if(s.linkGroupId){
          state.projects.forEach(function(pr){
            pr.subtasks=pr.subtasks.filter(function(x){if(x.linkGroupId===s.linkGroupId){_tombstone(x.id);_tlUnlinkBlocks(x.id);return false;}return true;});
          });
        }else{
          _tombstone(id);
          _tlUnlinkBlocks(id);
          p.subtasks=p.subtasks.filter(function(x){return x.id!==id;});
        }
        if(typeof _materializeRecurrence==='function')_materializeRecurrence(s,function(nextDue){
          p.subtasks.push({id:'st'+Date.now()+Math.random().toString(36).slice(2,5),name:s.name,due:nextDue,priority:s.priority,timeEst:s.timeEst||'',time:s.time||'',done:false,recurrence:s.recurrence});
        });
        addPoints('subtask',srcEl);
      }
    }
    renderProjects();
  }else{
    var t=state.tasks.find(function(t){return t.id===id;});
    if(t){
      var pName=t.projectId?((state.projects.find(function(p){return p.id===t.projectId;})||{}).name||''):'';
      _archiveCompletedTask({
        id:t.id,name:t.name,projectName:pName,projectId:t.projectId||'',projectIds:t.projectIds||[],
        archivedAt:new Date().toISOString(),source:'standalone'
      });
      _tombstone(id);
      _tlUnlinkBlocks(id);
      state.tasks=state.tasks.filter(function(x){return x.id!==id;});
      if(typeof _materializeRecurrence==='function')_materializeRecurrence(t,function(nextDue){
        state.tasks.push({id:'tk'+Date.now()+Math.random().toString(36).slice(2,5),name:t.name,due:nextDue,priority:t.priority,timeEst:t.timeEst||'',time:t.time||'',projectId:'',projectIds:[],done:false,recurrence:t.recurrence});
      });
      addPoints('task',srcEl);
    }
  }
  save();renderTaskList();_refreshTodayViewIfVisible();
}

function addStandaloneTask(){
  var nameEl=document.getElementById('tlNewName');
  var name=nameEl.value.trim();if(!name)return;
  var projHidden=document.getElementById('tlNewProject');
  var projVal=projHidden.value;
  var projIds=projVal?projVal.split(',').filter(Boolean):[];
  var timeEst=document.getElementById('tlNewTime').value;
  var due=document.getElementById('tlNewDue').value;
  // time:true so "workout 6am daily" captures the start time on creation, the
  // same way the reminders form already does. Without a start time the task is
  // auto-placed in the first open slot instead.
  var q=_applyQuickAdd(name,{due:due},{date:true,time:true,recurrence:true});
  name=q.name;due=q.due;

  if(projIds.length>=1){
    // Add as subtask to EACH selected project, sharing a linkGroupId
    var groupId=projIds.length>1?'lg'+Date.now():null;
    var addedCount=0;
    projIds.forEach(function(pid){
      var pr=state.projects.find(function(p){return p.id===pid;});
      if(pr){
        pr.subtasks.push({
          id:'st'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
          name:name,due:due,priority:'med',timeEst:timeEst,time:q.time||'',done:false,
          linkGroupId:groupId,recurrence:q.recurrence
        });
        addedCount++;
      }
    });
    renderProjects();
    if(addedCount>1)toast('Task added to '+addedCount+' projects');
    else ;
  }else{
    // Add as standalone task
    state.tasks.push({id:'tk'+Date.now(),name:name,due:due,priority:'med',timeEst:timeEst,time:q.time||'',projectId:'',projectIds:[],done:false,recurrence:q.recurrence});
    ;
  }
  nameEl.value='';document.getElementById('tlNewDue').value='';
  projHidden.value='';
  renderProjMultiPickerChips(document.getElementById('tlNewProjectPicker'));
  save();renderTaskList();
}

function deleteStandaloneTask(id){
  _confirm('Delete this task?',function(){
    _tombstone(id);
    state.tasks=state.tasks.filter(function(t){return t.id!==id;});
    save();renderTaskList();
  },{destructive:true,confirmText:'Delete'});
}

function clearDoneTasks(){
  // Tasks now auto-archive when checked. This is a no-op kept for backwards compat.
  toast('Tasks auto-archive when checked');
}

function updateTLProjectDropdowns(){
  // Update filter dropdown
  var filt=document.getElementById('tlFilterProj');
  if(filt){
    var cur=filt.value;
    filt.innerHTML='<option value="all">All Projects</option>'+_sortedProjects().map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join('');
    filt.value=cur;
  }
  // Update add-task project dropdown
  var add=document.getElementById('tlNewProject');
  if(add){
    var cur2=add.value;
    add.innerHTML='<option value="">No project</option><option value="__new__">+ New project...</option>'+_sortedProjects().map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>';}).join('');
    if(cur2&&cur2!=='__new__')add.value=cur2;
  }
}

// PANEL EXPAND/COLLAPSE
function toggleExpand(btn){const panel=btn.closest('.panel');panel.classList.toggle('expanded');checkOverflows();}

// =======================================
// PANEL TILE / OVERLAY EXPANSION SYSTEM
// =======================================
var _panelOverlayCurrent=null;

// -- Usage analytics -- fire-and-forget to Jarvis /ops-track ----------
function _trackEvent(type,id,name){
  _logLocalUsage(id);
  try{
    fetch(JARVIS_PROXY_URL+'/ops-track',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type,id,name:name||id})
    }).catch(function(){});
  }catch(e){}
}

// Local (device-side) usage counter -- powers the Points Insights overlay.
// Separate from the remote ops beacon above, which the client can't read back.
function _logLocalUsage(sourceId){
  if(!state.panelUseLog)state.panelUseLog={};
  var today=_dayKey();
  if(!state.panelUseLog[today])state.panelUseLog[today]={};
  state.panelUseLog[today][sourceId]=(state.panelUseLog[today][sourceId]||0)+1;
  save();
}

// _trackEvent only fires for a handful of named actions (add note, log mood,
// routine check, etc). Most real engagement with a panel -- typing, checking
// things off, just working in it -- never hits one of those. This delegated
// listener catches any click inside any dashboard panel so "panel uses" on
// the Insights overlay reflects actual day-to-day use, not just the narrow
// set of specially-instrumented actions.
var _panelUsageListenerBound=false;
function _bindPanelUsageTracking(){
  if(_panelUsageListenerBound)return;
  _panelUsageListenerBound=true;
  document.addEventListener('click',function(e){
    var panelEl=e.target.closest&&e.target.closest('.panel[data-panel]');
    if(panelEl&&panelEl.dataset.panel)_logLocalUsage('panel:'+panelEl.dataset.panel);
  },true);
}

function openPanelOverlay(panelKey){
  var panel=document.querySelector('.panel[data-panel="'+panelKey+'"]');
  if(!panel)return;
  var overlay=document.getElementById('panelOverlay');
  var body=document.getElementById('panelOverlayBody');
  var titleEl=document.getElementById('panelOverlayTitle');
  if(!overlay||!body||!titleEl)return;
  
  // Close any other open overlay first
  if(_panelOverlayCurrent)closePanelOverlay();
  
  // Get the title text + icon from the panel header
  var titleNode=panel.querySelector('.panel-title');
  var titleHTML=titleNode?titleNode.innerHTML.replace(/<span class="drag-handle"[^<]*<\/span>/,''):panelKey;
  titleEl.innerHTML=titleHTML;
  
  // Move the panel into the overlay (preserve original position with placeholder)
  var placeholder=document.createElement('div');
  placeholder.className='panel-placeholder';
  placeholder.dataset.placeholderFor=panelKey;
  placeholder.style.display='none';
  panel.parentNode.insertBefore(placeholder,panel);
  
  // Remove tile mode while in overlay (so all content is visible). Also clear
  // user-hidden: a panel can be opened here even when disabled in Settings
  // (e.g. jumping to a note from the project view), and the overlay must show
  // it. closePanelOverlay() re-applies Settings visibility when it moves back.
  panel.classList.remove('panel-tile');
  panel.classList.remove('user-hidden');
  body.appendChild(panel);
  
  overlay.classList.add('open');
  _panelOverlayCurrent=panelKey;
  _trackEvent('panel_view',panelKey,panelKey);

  // R7 stage 5: same fresh-batch reset as the mobile tab-bar path.
  if(panelKey==='tasklist')_tlRenderLimit=_TL_RENDER_BATCH;
  else if(panelKey==='reminders')_remRenderLimit=_TL_RENDER_BATCH;
  // Re-render to refresh content (some renderers depend on element visibility)
  if(panelKey==='projects'&&typeof renderProjects==='function')renderProjects();
  else if(panelKey==='reminders'&&typeof renderReminders==='function')renderReminders();
  else if(panelKey==='notes'&&typeof renderNotes==='function')renderNotes();
  else if(panelKey==='tasklist'&&typeof renderTaskList==='function')renderTaskList();
}

function closePanelOverlay(){
  if(!_panelOverlayCurrent)return;
  var panelKey=_panelOverlayCurrent;
  var overlay=document.getElementById('panelOverlay');
  var body=document.getElementById('panelOverlayBody');
  var panel=body?body.querySelector('.panel[data-panel="'+panelKey+'"]'):null;
  var placeholder=document.querySelector('.panel-placeholder[data-placeholder-for="'+panelKey+'"]');
  
  if(panel&&placeholder){
    // Restore tile mode and move panel back to dashboard
    panel.classList.add('panel-tile');
    placeholder.parentNode.insertBefore(panel,placeholder);
    placeholder.parentNode.removeChild(placeholder);
    // Re-apply Settings visibility -- the panel may have been force-shown in
    // the overlay while disabled (see openPanelOverlay).
    if(typeof applyPanelVisibility==='function')applyPanelVisibility();
  }

  if(overlay)overlay.classList.remove('open');
  _panelOverlayCurrent=null;
  
  // Refresh tile summaries
  updateAllTileSummaries();
  
  // Re-render the closed panel so tile view is always fresh
  if(panelKey==='projects'&&typeof renderProjects==='function')renderProjects();
  else if(panelKey==='tasklist'&&typeof renderTaskList==='function')renderTaskList();
  else if(panelKey==='notes'&&typeof renderNotes==='function')renderNotes();
  else if(panelKey==='reminders'&&typeof renderReminders==='function')renderReminders();
  else if(panelKey==='routines'&&typeof renderRoutines==='function')renderRoutines();
  else if(panelKey==='brain'&&typeof renderThoughts==='function')renderThoughts();
  else if(panelKey==='timeline'&&typeof renderTimeline==='function')renderTimeline();
}

// ESC key closes overlay
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&_panelOverlayCurrent)closePanelOverlay();
});

function updateAllTileSummaries(){
  _updateTileSummaryProjects();
  _updateTileSummaryReminders();
  _updateTileSummaryNotes();
  _updateTileSummaryTasklist();
}

function _summaryPill(text,cls,title){
  return '<span class="panel-tile-summary-pill'+(cls?' '+cls:'')+'"'+(title?' title="'+title+'"':'')+'>'+text+'</span>';
}

function _updateTileSummaryProjects(){
  var el=document.getElementById('tile-summary-projects');
  if(!el)return;
  var active=(state.projects||[]).length;
  var done=(state.completedProjects||[]).length;
  var html='';
  if(active>0)html+=_summaryPill(active+' active');
  if(done>0)html+=_summaryPill('\u2713 '+done+' done','',done+' completed project'+(done!==1?'s':''));
  if(!html)html='<span style="color:var(--text-faint);font-style:italic;">No projects yet</span>';
  el.innerHTML=html;
}

function _updateTileSummaryReminders(){
  var el=document.getElementById('tile-summary-reminders');
  if(!el)return;
  var rems=state.reminders||[];
  var todayKey=todayStr();
  var todayCount=0,overdueCount=0,upcomingCount=0;
  rems.forEach(function(r){
    if(!r.date){upcomingCount++;return;}
    if(r.date===todayKey)todayCount++;
    else if(r.date<todayKey)overdueCount++;
    else upcomingCount++;
  });
  var html='';
  if(overdueCount>0)html+=_summaryPill(overdueCount+' overdue','urgent');
  if(todayCount>0)html+=_summaryPill(todayCount+' today','warn');
  if(upcomingCount>0)html+=_summaryPill(upcomingCount+' upcoming');
  if(!html)html='<span style="color:var(--text-faint);font-style:italic;">No reminders</span>';
  el.innerHTML=html;
}

function _updateTileSummaryNotes(){
  var el=document.getElementById('tile-summary-notes');
  if(!el)return;
  var n=(state.notes||[]).length;
  var html='';
  if(n>0)html+=_summaryPill(n+' note'+(n!==1?'s':''));
  else html='<span style="color:var(--text-faint);font-style:italic;">No notes yet</span>';
  el.innerHTML=html;
}

function _updateTileSummaryTasklist(){
  var el=document.getElementById('tile-summary-tasklist');
  if(!el)return;
  var todayKey=todayStr();
  var allTasks=[];
  state.projects.forEach(function(p){
    p.subtasks.forEach(function(st){allTasks.push(st);});
  });
  (state.tasks||[]).forEach(function(t){if(!t.done)allTasks.push(t);});
  
  var dueToday=0,overdue=0;
  allTasks.forEach(function(t){
    if(t.due===todayKey)dueToday++;
    else if(t.due&&t.due<todayKey)overdue++;
  });
  // Only the two pills that actually prompt action. Dropped deliberately:
  //  - "N active": a raw backlog count, already on the panel-header badge.
  //  - "N done": read state.completedTasks.length, which is a CAPPED recent
  //    subset (COMPLETED_TASKS_MAX), so it plateaus at the cap and reports a
  //    number that is simply wrong. The header's completed badge is the
  //    accurate one -- it uses the lifetime counter -- so this was both
  //    redundant and misleading. Do not reintroduce it from that array.
  var html='';
  if(overdue>0)html+=_summaryPill(overdue+' overdue','urgent');
  if(dueToday>0)html+=_summaryPill(dueToday+' today','warn');
  // "No tasks yet" must mean exactly that -- with the active pill gone, a
  // healthy list with nothing overdue or due today also produces no pills, and
  // claiming there are no tasks then would be a lie.
  if(!html&&allTasks.length===0)html='<span style="color:var(--text-faint);font-style:italic;">No tasks yet</span>';
  el.innerHTML=html;
}

function checkOverflows(){document.querySelectorAll('.panel-content').forEach(pc=>{if(pc.scrollHeight>pc.clientHeight+10){pc.classList.add('has-overflow');}else{pc.classList.remove('has-overflow');}});}
// Run overflow check after renders
var _origRenderProjects=renderProjects;renderProjects=function(){_origRenderProjects();checkOverflows();}
var _origRenderReminders=renderReminders;renderReminders=function(){_origRenderReminders();checkOverflows();}
var _origRenderNotes=renderNotes;renderNotes=function(){_origRenderNotes();checkOverflows();}
var _origRenderRoutines=renderRoutines;renderRoutines=function(){_origRenderRoutines();checkOverflows();}

// INIT - called after auth

// --- SHARE TARGET HANDLER ---------------------------------------------------
// Activated when the app is opened via the OS Share sheet (Android/Chrome PWA).
// Reads ?share_text=, ?share_title=, ?share_url= from the URL and shows an
// inbox banner so the user can route the content to Brain Dump or Notes.
function checkShareTarget(){
  const p=new URLSearchParams(window.location.search);
  const text=(p.get('share_text')||'').trim();
  const title=(p.get('share_title')||'').trim();
  const url=(p.get('share_url')||'').trim();
  if(!text&&!title&&!url)return;

  // Build a clean preview string
  const parts=[];
  if(title)parts.push(title);
  if(text&&text!==title)parts.push(text);
  if(url)parts.push(url);
  const combined=parts.join('\n');

  // Remove params from URL without reload
  window.history.replaceState({},'',window.location.pathname);

  // Build and show the inbox banner
  const div=document.createElement('div');
  div.className='share-inbox';
  div.id='shareInbox';
  div.innerHTML=`
    <button class="share-inbox-dismiss" onclick="document.getElementById('shareInbox').remove()" title="Dismiss">&times;</button>
    <div class="share-inbox-title">&#128228; Incoming Share</div>
    <div class="share-inbox-preview" id="sharePreview">${esc(combined)}</div>
    <div class="share-inbox-actions">
      <button class="share-inbox-btn primary" onclick="shareIntoBrainDump()">&#129504; Brain Dump</button>
      <button class="share-inbox-btn" onclick="shareIntoNote()">&#128221; Add as Note</button>
      <button class="share-inbox-btn" onclick="shareIntoReminder()">&#128276; Add as Reminder</button>
    </div>`;
  // Store text on the element for the action functions
  div._shareText=combined;
  div._shareTitle=title||text.slice(0,40)||'Shared item';
  document.body.appendChild(div);
}

function shareIntoBrainDump(){
  const d=document.getElementById('shareInbox');if(!d)return;
  const text=d._shareText;
  state.thoughts.push({id:'th'+Date.now(),text:text});
  save();renderThoughts();
  // Make sure Brain Dump panel is visible and briefly highlight it
  if(_isMobile())showMobilePanel('brain');
  const bp=document.querySelector('[data-panel="brain"]');
  if(bp){bp.scrollIntoView({behavior:'smooth',block:'nearest'});bp.style.outline='2px solid var(--accent)';setTimeout(()=>{bp.style.outline='';},1800);}
  d.remove();
  toast('Added to Brain Dump ✓');
}

function shareIntoNote(){
  const d=document.getElementById('shareInbox');if(!d)return;
  const now=new Date();
  state.notes.push({id:'n'+Date.now(),label:d._shareTitle,body:d._shareText,projectId:'',created:now.toISOString(),date:now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),time:now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})});
  save();renderNotes();
  if(_isMobile())showMobilePanel('notes');
  const np=document.querySelector('[data-panel="notes"]');
  if(np){np.scrollIntoView({behavior:'smooth',block:'nearest'});np.style.outline='2px solid var(--accent)';setTimeout(()=>{np.style.outline='';},1800);}
  d.remove();
  toast('Added to Notes ✓');
}

function shareIntoReminder(){
  const d=document.getElementById('shareInbox');if(!d)return;
  state.reminders.push({id:'rem'+Date.now(),text:d._shareText,date:'',time:''});
  save();renderReminders();
  if(_isMobile())showMobilePanel('reminders');
  const rp=document.querySelector('[data-panel="reminders"]');
  if(rp){rp.scrollIntoView({behavior:'smooth',block:'nearest'});rp.style.outline='2px solid var(--accent)';setTimeout(()=>{rp.style.outline='';},1800);}
  d.remove();
  toast('Added to Reminders ✓');
}
// ----------------------------------------------------------------------------

// =======================================
// VOICE INPUT
// =======================================
var _micRec=null,_micBtn=null;
function toggleMic(targetId,btnId){
  const btn=document.getElementById(btnId);
  const target=document.getElementById(targetId);
  if(!btn||!target){return;}
  // If already listening on this button, stop
  if(_micBtn===btnId&&_micRec){_micRec.stop();return;}
  // Stop any other active mic first
  if(_micRec){_micRec.stop();}
  if(!('SpeechRecognition' in window||'webkitSpeechRecognition' in window)){
    toast('Voice input not supported in this browser');return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const rec=new SR();
  rec.lang='en-US';rec.continuous=true;rec.interimResults=true;
  var base='';
  rec.onstart=function(){
    _micRec=rec;_micBtn=btnId;
    base=target.value?target.value.trimEnd()+' ':'';
    btn.classList.add('listening');btn.textContent='\u23F9 Stop';
  };
  rec.onresult=function(e){
    var interim='',final=base;
    for(var i=e.resultIndex;i<e.results.length;i++){
      if(e.results[i].isFinal)final+=e.results[i][0].transcript;
      else interim+=e.results[i][0].transcript;
    }
    // Update base on each final chunk so next interim appends correctly
    if(e.results[e.results.length-1].isFinal)base=final;
    target.value=final+interim;
    target.dispatchEvent(new Event('input'));
  };
  rec.onerror=function(e){if(e.error!=='aborted')toast('Mic: '+e.error);stopMic(btnId);};
  rec.onend=function(){stopMic(btnId);};
  rec.start();
}
function stopMic(btnId){
  const btn=document.getElementById(btnId);
  if(btn){btn.classList.remove('listening');btn.textContent='\uD83C\uDFA4';}
  _micRec=null;_micBtn=null;
}

// =======================================
// BREATHWORK MODAL
// =======================================
function _blurDashboard(){document.getElementById('dashboard').style.filter='blur(3px)';document.getElementById('dashboard').style.pointerEvents='none';}
function _unblurDashboard(){document.getElementById('dashboard').style.filter='';document.getElementById('dashboard').style.pointerEvents='';}

function toggleCompletedFolder(header){
  var arrow=header.querySelector('.tl-completed-arrow');
  var list=header.nextElementSibling;
  arrow.classList.toggle('open');
  list.classList.toggle('open');
}

function removeCompleted(id){
  _archiveTombstone(id); // durable removal -- a stale device can't re-add it
  state.completedTasks=state.completedTasks.filter(function(t){return t.id!==id;});
  // F3: completedTasks persists to its own doc; save() still runs for the
  // _archiveTombstones map (which stays in the blob) and the UI.
  if(typeof _saveCompletedTasksDoc==='function')_saveCompletedTasksDoc();
  save();renderTaskList();
}

// =======================================
// PROJECT DETAIL MODAL
// =======================================
function openProjectModal(pid){
  var p=state.projects.find(function(pr){return pr.id===pid;});
  if(!p)return;
  document.getElementById('projDetailModal').classList.add('open');
  _blurDashboard();
  var today=todayStr();
  var done=p.subtasks.filter(function(s){return s.done;}).length;
  var done=p.subtasks.filter(function(s){return s.done;}).length;
  var total=p.subtasks.length;
  // Header
  document.getElementById('pmdTitle').textContent=p.name;
  var metaParts=[(done+'/'+total+' subtasks')];
  if(p.due)metaParts.push('Ends: '+fmtDate(p.due));
  var linkedNotes=(state.notes||[]).filter(function(n){return (n.projectIds&&n.projectIds.indexOf(pid)>=0)||n.projectId===pid;});
  var linkedTasks=(state.tasks||[]).filter(function(t){return (t.projectIds&&t.projectIds.indexOf(pid)>=0)||t.projectId===pid;});
  var linkedReminders=(state.reminders||[]).filter(function(r){return (r.projectIds&&r.projectIds.indexOf(pid)>=0)||r.projectId===pid;});
  if(linkedTasks.length)metaParts.push(linkedTasks.length+' task'+(linkedTasks.length!==1?'s':''));
  if(linkedNotes.length)metaParts.push(linkedNotes.length+' note'+(linkedNotes.length!==1?'s':''));
  if(linkedReminders.length)metaParts.push(linkedReminders.length+' reminder'+(linkedReminders.length!==1?'s':''));
  document.getElementById('pmdMeta').textContent=metaParts.join(' · ');

  var html='';

  // Subtasks
  html+='<div class="proj-modal-section"><div class="proj-modal-section-title">&#128203; Subtasks</div>';
  if(p.subtasks.length===0){html+='<div style="font-size:13px;color:var(--text-faint);padding:6px 0;">No subtasks yet.</div>';}
  else{
    var sorted=[...p.subtasks].sort(function(a,b){
      if(a.done!==b.done)return a.done?1:-1;
      if(a.due&&b.due)return a.due.localeCompare(b.due);
      if(a.due)return -1;if(b.due)return 1;return 0;
    });
    html+=sorted.map(function(st){
      var nameId='pmd_stname_'+st.id;
      var dueId='pmd_stdue_'+st.id;
      var dueHTML;
      if(st.due){
        dueHTML='<span class="date-editable" id="'+dueId+'" style="font-size:11px;color:var(--text-dim);">'+fmtDate(st.due)+'</span>';
      }else{
        dueHTML='<span class="date-editable" id="'+dueId+'" style="font-size:11px;color:var(--text-faint);">+ date</span>';
      }
      return '<div class="pmd-subtask">'
        +'<div class="pmd-st-check" onclick="pmdToggleSubtask(\''+pid+'\',\''+st.id+'\')"></div>'
        +'<span class="pmd-st-name">'
        +'<span class="editable" id="'+nameId+'">'+esc(st.name)+'</span></span>'
        +dueHTML
        +(st.timeEst?'<span class="tl-time-badge">'+fmtTimeEst(st.timeEst)+'</span>':'')
        +'<span class="st-btn st-del" onclick="deleteSubtask(\''+pid+'\',\''+st.id+'\')" title="Delete">\u2715</span>'
        +'</div>';
    }).join('');
  }
  html+='</div>';

  // Linked tasks
  if(linkedTasks.length){
    html+='<div class="proj-modal-section"><div class="proj-modal-section-title">&#128203; Linked Tasks</div>';
    html+=linkedTasks.map(function(t){
      var nameId='pmd_tname_'+t.id;
      var dueId='pmd_tdue_'+t.id;
      var dueHTML=t.due?
        '<div class="pmd-item-meta">Due: <span class="date-editable" id="'+dueId+'">'+fmtDate(t.due)+'</span></div>':
        '<div class="pmd-item-meta">Due: <span class="date-editable" id="'+dueId+'" style="color:var(--text-faint);">+ set</span></div>';
      return '<div class="pmd-item"><div class="pmd-item-label">'
        +'<span class="editable" id="'+nameId+'">'+esc(t.name)+'</span>'+(t.done?' <span style="color:var(--text-faint);font-size:11px;">(done)</span>':'')
        +'</div>'+dueHTML+'</div>';
    }).join('');
    html+='</div>';
  }

  // Linked reminders
  if(linkedReminders.length){
    html+='<div class="proj-modal-section"><div class="proj-modal-section-title">&#128276; Reminders</div>';
    html+=linkedReminders.map(function(r){
      return '<div class="pmd-item"><div class="pmd-item-label">'+esc(r.text)+'</div>'
        +(r.date?'<div class="pmd-item-meta">'+fmtDate(r.date)+(r.time?' at '+fmtTime(r.time):'')+'</div>':'')+'</div>';
    }).join('');
    html+='</div>';
  }

  // Linked notes
  if(linkedNotes.length){
    html+='<div class="proj-modal-section"><div class="proj-modal-section-title">&#128221; Notes</div>';
    html+=linkedNotes.map(function(n){
      return '<div class="pmd-item"><div class="pmd-item-label">'+esc(n.label||'Note')+'</div>'
        +(n.date?'<div class="pmd-item-meta">'+n.date+(n.time?' · '+n.time:'')+'</div>':'')
        +(n.body?'<div class="pmd-item-body">'+esc(n.body)+'</div>':'')+'</div>';
    }).join('');
    html+='</div>';
  }

  // Quick add subtask
  html+='<div class="proj-modal-section"><div class="proj-modal-section-title">&#43; Add Subtask</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    +'<input type="text" id="pmdNewSt" placeholder="Next step..." style="flex:1;min-width:140px;">'
    +'<select id="pmdNewPri" style="font-size:12px;padding:4px 6px;background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-sm);font-family:inherit;color:var(--text-dim);">'
    +'<option value="low">Low</option><option value="med" selected>Med</option><option value="high">High</option></select>'
    +'<input type="date" id="pmdNewDate" style="font-size:12px;">'
    +'<button class="btn btn-accent btn-sm" onclick="pmdAddSubtask(\''+pid+'\')">+ Add</button>'
    +'</div></div>';

  document.getElementById('pmdBody').innerHTML=html;
  
  // Wire editable subtask names + due dates inside the modal
  p.subtasks.forEach(function(st){
    var nameEl=document.getElementById('pmd_stname_'+st.id);
    if(nameEl){
      makeEditable(nameEl,function(v){editSubtaskName(pid,st.id,v);});
    }
    var dueEl=document.getElementById('pmd_stdue_'+st.id);
    if(dueEl){
      makeDateClickable(dueEl,st.due,function(v){editSubtaskDue(pid,st.id,v);});
    }
  });
  // Wire editable linked tasks (standalone tasks tagged to this project)
  linkedTasks.forEach(function(t){
    var nameEl=document.getElementById('pmd_tname_'+t.id);
    if(nameEl){
      makeEditable(nameEl,function(v){editStandaloneTaskName(t.id,v);});
    }
    var dueEl=document.getElementById('pmd_tdue_'+t.id);
    if(dueEl){
      makeDateClickable(dueEl,t.due,function(v){editStandaloneTaskDue(t.id,v);});
    }
  });
  refreshEditables();
}

function closeProjectModal(){
  document.getElementById('projDetailModal').classList.remove('open');
  _unblurDashboard();
}

function pmdToggleSubtask(pid,sid){
  var p=state.projects.find(function(pr){return pr.id===pid;});
  if(!p)return;
  var s=p.subtasks.find(function(st){return st.id===sid;});
  if(!s)return;
  var srcEl=document.querySelector('.pmd-st-check[onclick*="'+sid+'"]');
  _archiveCompletedTask({
    id:s.id,name:s.name,projectName:p.name,projectId:p.id,
    archivedAt:new Date().toISOString(),source:'project'
  });
  if(s.linkGroupId){
    state.projects.forEach(function(pr){
      pr.subtasks=pr.subtasks.filter(function(x){return x.linkGroupId!==s.linkGroupId;});
    });
  }else{
    p.subtasks=p.subtasks.filter(function(x){return x.id!==sid;});
  }
  addPoints('subtask',srcEl);
  save();renderProjects();renderTaskList();
  openProjectModal(pid); // refresh modal
}

function pmdAddSubtask(pid){
  var nm=document.getElementById('pmdNewSt').value.trim();
  if(!nm)return;
  var p=state.projects.find(function(pr){return pr.id===pid;});
  if(!p)return;
  p.subtasks.push({id:'st'+Date.now(),name:nm,due:document.getElementById('pmdNewDate').value,
    priority:document.getElementById('pmdNewPri').value,timeEst:'',done:false});
  save();renderProjects();renderTaskList();
  openProjectModal(pid); // refresh modal
}

// =======================================
// CHECK-IN LOG (R6): persists HALT+/breathwork/grounding completions so the
// regulation toolkit has memory instead of resetting every time it's opened.
// Deliberately descriptive, not diagnostic -- see _haltTrendLine/getStateInsights
// below for the only two places this data surfaces, both plain counts, no advice.
// =======================================
var CHECKIN_LOG_MAX=500; // cap pre-emptively; matches the journal-split precedent (R3/R5)
function _logCheckIn(type,payload){
  if(!state.checkins)state.checkins=[];
  var entry=Object.assign({id:'ci'+Date.now()+Math.random().toString(36).slice(2,6),ts:new Date().toISOString(),type:type},payload||{});
  state.checkins.push(entry);
  if(state.checkins.length>CHECKIN_LOG_MAX)state.checkins=state.checkins.slice(state.checkins.length-CHECKIN_LOG_MAX);
  _saveCheckinsDoc();
  return entry;
}
function _checkinsSince(days){
  var cutoff=Date.now()-days*86400000;
  return (state.checkins||[]).filter(function(c){return new Date(c.ts).getTime()>=cutoff;});
}

// Single write path for the completed-tasks archive -- dedupes what used to be
// three identical inline `unshift(...) + slice(0,100)` blocks (toggleSubtask,
// toggleTaskDone x2, pmdToggleSubtask). The caller builds the record (its
// fields vary by source), this prepends, enforces the cap, and (F3 / Stage 2b)
// persists to the completedTasks OWN doc -- no longer the dashboard blob. The
// callers still call save() too, for the live-item mutation (task removed from
// state.tasks etc.); that no longer carries completedTasks.
var COMPLETED_TASKS_MAX=100;
function _archiveCompletedTask(record){
  if(!state.completedTasks)state.completedTasks=[];
  state.completedTasks.unshift(record);
  if(state.completedTasks.length>COMPLETED_TASKS_MAX)state.completedTasks=state.completedTasks.slice(0,COMPLETED_TASKS_MAX);
  // Lifetime counters are separate from the capped archive above -- the array
  // only ever holds the most recent COMPLETED_TASKS_MAX items, so its .length
  // cannot be used as a running total once that cap is hit. These increment
  // forever regardless of the slice.
  state.completedTasksLifetime=(state.completedTasksLifetime||0)+1;
  if(record.source==='project')state.completedProjectSubtasksLifetime=(state.completedProjectSubtasksLifetime||0)+1;
  if(typeof _saveCompletedTasksDoc==='function')_saveCompletedTasksDoc();
}

// R16 Phase A: mirrors _checkinsSince's window filter, but completedTasks
// entries carry an ISO archivedAt (not a bare .ts field).
function _tasksCompletedSince(days){
  var cutoff=Date.now()-days*86400000;
  return (state.completedTasks||[]).filter(function(t){return t.archivedAt&&new Date(t.archivedAt).getTime()>=cutoff;});
}

// R16 Phase A: "X of N days" fully-completed-day counts, matching the framing
// Joe described ("morning routine done 5/7 days") -- a per-day complete/not
// flag, not an aggregate item tally. Walks the exact last `days` CALENDAR days
// starting from YESTERDAY (today's routine is still in progress and hasn't
// been snapshotted into history yet, so it can't count either way). A day with
// total===0 (every item deleted that day) is deliberately NOT counted as
// complete -- guards the vacuous-truth case of an empty list satisfying
// done===total. Custom routines aren't summarized here -- see routineHistory's
// comment for why.
function _routineConsistencySince(days){
  var byDate={};
  (state.routineHistory||[]).forEach(function(e){byDate[e.date]=e;});
  // trackedDays: how many of the window's days actually had this routine in
  // use (total>0), regardless of completion -- lets a caller distinguish
  // "never set this routine up" (trackedDays===0, nothing to show) from
  // "set it up but didn't finish it" (trackedDays>0, completeDays low but
  // real -- show it plainly, no judgment, same as every other state-card row).
  var out={morning:{completeDays:0,trackedDays:0,total:days},evening:{completeDays:0,trackedDays:0,total:days}};
  var d=new Date();d.setDate(d.getDate()-1);
  for(var i=0;i<days;i++){
    var e=byDate[_dayKey(d)];
    ['morning','evening'].forEach(function(tab){
      if(e&&e[tab]&&e[tab].total>0){
        out[tab].trackedDays++;
        if(e[tab].done===e[tab].total)out[tab].completeDays++;
      }
    });
    d.setDate(d.getDate()-1);
  }
  return out;
}

// =======================================
// R5: CHECKINS + MOODLOG DOCUMENT I/O -- generalizes the R3 journal pattern
// (own doc under users/{uid}/data/, own localStorage mirror, own save --
// no E-1 optimistic-concurrency transaction, matching journal's precedent
// since both are append-mostly/edit-rarely with low collision risk) so these
// two growing collections stop riding along in every single dashboard-doc
// write. Unlike journal (lazy-loaded only when opened), these load EAGERLY
// during init since HALT+/State-&-Regulation/mood chart can render at any
// time. state.checkins/state.moodLog stay the canonical in-memory arrays --
// every existing read call site (_checkinsSince, _renderStateCard, mood
// chart, insights) is untouched; only persistence moves.
// =======================================
function _checkinsStorageKey(){return 'cpCheckins_'+(currentUser?currentUser.uid:'local');}
async function _loadCheckinsDoc(){
  var loaded=null;
  if(firebaseReady&&db&&currentUser){
    try{
      var snap=await db.collection('users').doc(currentUser.uid).collection('data').doc('checkins').get();
      if(snap.exists)loaded=snap.data();
    }catch(e){console.log('checkins load (cloud) error:',e);}
  }
  if(!loaded){
    try{var s=localStorage.getItem(_checkinsStorageKey());if(s)loaded=JSON.parse(s);}catch(e){}
  }
  if(loaded&&Array.isArray(loaded.items)){
    state.checkins=loaded.items;
  }else if((state.checkins||[]).length){
    // ONE-TIME MIGRATION: pre-R5 data lives in state.checkins, merged in by
    // load() from the old dashboard blob. Adopt it as the new doc's seed.
    await _saveCheckinsDoc();
  }
  try{localStorage.setItem(_checkinsStorageKey(),JSON.stringify({v:1,items:state.checkins||[]}));}catch(e){}
}
async function _saveCheckinsDoc(){
  var doc={v:1,items:state.checkins||[]};
  try{localStorage.setItem(_checkinsStorageKey(),JSON.stringify(doc));}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      await db.collection('users').doc(currentUser.uid).collection('data').doc('checkins')
        .set({v:1,items:doc.items,updated:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(e){console.log('checkins save (cloud) error:',e);}
  }
}

function _moodLogStorageKey(){return 'cpMoodLog_'+(currentUser?currentUser.uid:'local');}
async function _loadMoodLogDoc(){
  var loaded=null;
  if(firebaseReady&&db&&currentUser){
    try{
      var snap=await db.collection('users').doc(currentUser.uid).collection('data').doc('moodLog').get();
      if(snap.exists)loaded=snap.data();
    }catch(e){console.log('moodLog load (cloud) error:',e);}
  }
  if(!loaded){
    try{var s=localStorage.getItem(_moodLogStorageKey());if(s)loaded=JSON.parse(s);}catch(e){}
  }
  if(loaded&&Array.isArray(loaded.entries)){
    state.moodLog=loaded.entries;
  }else if((state.moodLog||[]).length){
    // ONE-TIME MIGRATION, same shape as checkins above.
    await _saveMoodLogDoc();
  }
  try{localStorage.setItem(_moodLogStorageKey(),JSON.stringify({v:1,entries:state.moodLog||[]}));}catch(e){}
}
async function _saveMoodLogDoc(){
  var doc={v:1,entries:state.moodLog||[]};
  try{localStorage.setItem(_moodLogStorageKey(),JSON.stringify(doc));}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      await db.collection('users').doc(currentUser.uid).collection('data').doc('moodLog')
        .set({v:1,entries:doc.entries,updated:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(e){console.log('moodLog save (cloud) error:',e);}
  }
}

// F3 (Stage 2b): completedTasks lives in its OWN doc now, off the 1 MB
// dashboard blob -- same R5 recipe as checkins/moodLog (own doc, localStorage
// mirror, eager load, zero-backend self-seed migration), with ONE difference:
// the load RECONCILES rather than blindly overwriting. completedTasks used to
// ride the dashboard's realtime union-reconcile (SYNC_UNION_ARRAYS +
// _archiveTombstones); moving it to a load-once doc would otherwise reintroduce
// the removeCompleted resurrection Stage 2a fixed. So on load we union the
// cloud copy with local by id and drop anything in _archiveTombstones --
// reusing the pure sync-merge helpers -- preserving "removed stays removed" and
// "concurrent completions both survive". We give up only the LIVE cross-device
// update of the completed folder (fine for an archive; same tradeoff
// checkins/moodLog already make). completedProjects/completedWorkouts stay in
// the blob for now (a later increment), so _archiveTombstones is still in use.
function _completedTasksStorageKey(){return 'cpCompletedTasks_'+(currentUser?currentUser.uid:'local');}
async function _loadCompletedTasksDoc(){
  var loaded=null;
  if(firebaseReady&&db&&currentUser){
    try{
      var snap=await db.collection('users').doc(currentUser.uid).collection('data').doc('completedTasks').get();
      if(snap.exists)loaded=snap.data();
    }catch(e){console.log('completedTasks load (cloud) error:',e);}
  }
  if(!loaded){
    try{var s=localStorage.getItem(_completedTasksStorageKey());if(s)loaded=JSON.parse(s);}catch(e){}
  }
  // 1. Reconcile the archive ARRAY first, so its length is final before we use
  //    it as the lifetime floor below. Union local (old-blob or prior-session
  //    data) with the loaded copy by id, then drop history entries the user
  //    cleared. (When there's no loaded doc but we already hold items from the
  //    old dashboard blob, this leaves them in place for the seed/save below --
  //    the pre-Stage-2b one-time migration.)
  if(loaded&&Array.isArray(loaded.items)){
    state.completedTasks=_dropTombstoned(mergeById(state.completedTasks,loaded.items),state._archiveTombstones||{});
  }
  // 2. Reconcile the lifetime COUNTERS: max of {in-memory, loaded doc, array
  //    length as floor}. Seeds a pre-counter doc from the array, preserves a
  //    real synced total, and self-heals a `lifetime:0` an earlier save may
  //    have persisted before the counter existed (the bug that pinned the
  //    badge at 0 across reloads). Because array length is a floor, the counter
  //    can never read below the archive in hand.
  //    reconcileLifetimeCounter is the canonical, unit-tested impl in
  //    sync-merge.js. This path runs during initApp's Promise.all, so it must
  //    NOT throw if a stale Service-Worker cache serves an old sync-merge.js
  //    that predates that symbol (a real prod crash: legacy.js updated but the
  //    unhashed sync-merge.js came from cache). Fall back to the identical
  //    one-line max so init always completes; the two stay in lockstep.
  var _rlc=(typeof reconcileLifetimeCounter==='function')
    ?reconcileLifetimeCounter
    :function(a,b,c){return Math.max(a||0,b||0,c||0);};
  var _arr=state.completedTasks||[];
  state.completedTasksLifetime=_rlc(
    state.completedTasksLifetime, loaded&&loaded.lifetime, _arr.length);
  state.completedProjectSubtasksLifetime=_rlc(
    state.completedProjectSubtasksLifetime, loaded&&loaded.projectLifetime,
    _arr.filter(function(t){return t.source==='project';}).length);
  // 3. Persist the reconciled array + healed counters back ONCE (cloud + local
  //    mirror). Skip only the truly-empty first-run case (no doc, no items).
  if((loaded&&Array.isArray(loaded.items))||_arr.length){
    await _saveCompletedTasksDoc();
  }
  try{localStorage.setItem(_completedTasksStorageKey(),JSON.stringify({v:1,items:state.completedTasks||[],lifetime:state.completedTasksLifetime||0,projectLifetime:state.completedProjectSubtasksLifetime||0}));}catch(e){}
}
async function _saveCompletedTasksDoc(){
  if(_accountDeleted)return;
  // Lifetime counters live HERE, in the completedTasks own-doc, not the
  // dashboard blob -- they count this doc's history, so keeping them atomic
  // with it gives one load/save/reconcile path instead of two docs that drift.
  var doc={v:1,items:state.completedTasks||[],lifetime:state.completedTasksLifetime||0,projectLifetime:state.completedProjectSubtasksLifetime||0};
  try{localStorage.setItem(_completedTasksStorageKey(),JSON.stringify(doc));}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      await db.collection('users').doc(currentUser.uid).collection('data').doc('completedTasks')
        .set({v:1,items:doc.items,lifetime:doc.lifetime,projectLifetime:doc.projectLifetime,updated:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(e){console.log('completedTasks save (cloud) error:',e);}
  }
}

// =======================================
// R7 (Ship-3): REMINDERS ARCHIVE -- own doc, same recipe as completedTasks
// above (own Firestore doc + localStorage mirror + load-time reconcile via
// the pure sync-merge helpers + lifetime counter). Reminders previously had
// only destructive exits (delete / clear-past both tombstone AND destroy the
// record); at heavy-logger scale the array just grew forever. Archiving is
// the completed-task lifecycle applied to reminders: tombstone the live id
// (so reconcileSync drops it from the ACTIVE array everywhere -- 'reminders'
// is in SYNC_ACTIVE_ARRAYS), move a record into this doc. The record reuses
// the live id, which is exactly the completedTasks "survives its own
// tombstone" pattern: this doc is filtered by _archiveTombstones ONLY.
// Contract encoded in test/sync-merge.test.mjs ("R7 archive model" cases).
// =======================================
var REMINDERS_ARCHIVE_MAX=200;
function _remindersArchiveStorageKey(){return 'cpRemindersArchive_'+(currentUser?currentUser.uid:'local');}
// Move one live reminder into the archive. Pure state mutation -- callers
// decide when to save()/persist/re-render (a sweep batches many of these).
function _archiveReminder(r,reason){
  if(!r||!r.id)return;
  if(!state.remindersArchive)state.remindersArchive=[];
  state.remindersArchive.unshift({id:r.id,text:r.text||'',date:r.date||'',time:r.time||'',archivedAt:new Date().toISOString(),reason:reason||'done'});
  if(state.remindersArchive.length>REMINDERS_ARCHIVE_MAX)state.remindersArchive=state.remindersArchive.slice(0,REMINDERS_ARCHIVE_MAX);
  state.remindersArchiveLifetime=(state.remindersArchiveLifetime||0)+1;
  _tombstone(r.id);
  state.reminders=state.reminders.filter(function(x){return x.id!==r.id;});
}
async function _loadRemindersArchiveDoc(){
  var loaded=null;
  if(firebaseReady&&db&&currentUser){
    try{
      var snap=await db.collection('users').doc(currentUser.uid).collection('data').doc('remindersArchive').get();
      if(snap.exists)loaded=snap.data();
    }catch(e){console.log('remindersArchive load (cloud) error:',e);}
  }
  if(!loaded){
    try{var s=localStorage.getItem(_remindersArchiveStorageKey());if(s)loaded=JSON.parse(s);}catch(e){}
  }
  // Reconcile the archive array (union by id, drop user-cleared records),
  // then the lifetime counter (max with the array length as floor -- same
  // self-healing recipe as completedTasks, incl. the stale-SW fallback).
  if(loaded&&Array.isArray(loaded.items)){
    state.remindersArchive=_dropTombstoned(mergeById(state.remindersArchive,loaded.items),state._archiveTombstones||{});
  }
  var _rlc=(typeof reconcileLifetimeCounter==='function')
    ?reconcileLifetimeCounter
    :function(a,b,c){return Math.max(a||0,b||0,c||0);};
  var _arr=state.remindersArchive||[];
  state.remindersArchiveLifetime=_rlc(
    state.remindersArchiveLifetime, loaded&&loaded.lifetime, _arr.length);
  if((loaded&&Array.isArray(loaded.items))||_arr.length){
    await _saveRemindersArchiveDoc();
  }
  try{localStorage.setItem(_remindersArchiveStorageKey(),JSON.stringify({v:1,items:state.remindersArchive||[],lifetime:state.remindersArchiveLifetime||0}));}catch(e){}
}
async function _saveRemindersArchiveDoc(){
  if(_accountDeleted)return;
  var doc={v:1,items:state.remindersArchive||[],lifetime:state.remindersArchiveLifetime||0};
  try{localStorage.setItem(_remindersArchiveStorageKey(),JSON.stringify(doc));}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      await db.collection('users').doc(currentUser.uid).collection('data').doc('remindersArchive')
        .set({v:1,items:doc.items,lifetime:doc.lifetime,updated:firebase.firestore.FieldValue.serverTimestamp()});
    }catch(e){console.log('remindersArchive save (cloud) error:',e);}
  }
}

// =======================================
// R14: INSIGHTS DATA EXPORT -- downloads check-ins, mood/energy, and daily
// Presence totals as separate CSVs. Exports FULL history (not just the
// currently selected week/month/lifetime tab), matching exportAllToICS's
// precedent of "give me everything, I'll filter it myself." Reuses
// downloadICS's blob-download pattern under a generic name. Formatting
// helpers (_csvEsc/_csvRows/downloadCSV/_checkinDetail) live in
// csv-export.js; these orchestrators stay here since they read state directly.
// =======================================
function _exportCheckinsCSV(){
  var rows=[['Date','Time','Type','Detail']];
  (state.checkins||[]).slice().sort(function(a,b){return new Date(a.ts)-new Date(b.ts);}).forEach(function(c){
    var d=new Date(c.ts);
    rows.push([d.toLocaleDateString('en-US'),d.toLocaleTimeString('en-US'),c.type,_checkinDetail(c)]);
  });
  downloadCSV('centerpost-checkins.csv',_csvRows(rows));
}
function _exportMoodLogCSV(){
  var rows=[['Date','Mood (1-4)','Energy (1-4)']];
  (state.moodLog||[]).slice().sort(function(a,b){return (a.date||'').localeCompare(b.date||'');}).forEach(function(m){
    rows.push([m.date||'',m.mood!=null?m.mood:'',m.energy!=null?m.energy:'']);
  });
  downloadCSV('centerpost-mood-energy.csv',_csvRows(rows));
}
function _exportPointsCSV(){
  var rows=[['Date','Presence Earned']];
  var totals=(state.points&&state.points.totalsByDay)||{};
  Object.keys(totals).sort().forEach(function(d){
    rows.push([d,totals[d]]);
  });
  downloadCSV('centerpost-presence-daily.csv',_csvRows(rows));
}
function exportInsightsData(){
  var hasData=(state.checkins||[]).length||(state.moodLog||[]).length||Object.keys((state.points&&state.points.totalsByDay)||{}).length;
  if(!hasData){toast('Nothing to export yet.');return;}
  _exportCheckinsCSV();
  setTimeout(_exportMoodLogCSV,300);
  setTimeout(_exportPointsCSV,600);
  toast('⬇ Exporting 3 CSV files...');
}

// =======================================
// HALT+ SENSORY CHECK
// =======================================
var _haltChecked={};




var HALT_ITEMS=[
  {key:'H',letter:'H',icon:'&#127860;',label:'Hungry',
   question:'When did you last eat a real meal or drink water?',
   action:'Even a small snack with protein stabilizes blood glucose and directly improves prefrontal cortex function. Dehydration of just 1% impairs attention and working memory. Water first, then food. Set a 5-minute timer, eat something, then return.'},
  {key:'A',letter:'A',icon:'&#128560;',label:'Anxious / Activated',
   question:'Is there background anxiety, worry, or anticipatory stress running right now?',
   action:'Name what\'s circling: write one sentence in Brain Dump. Then try a Physiological Sigh (double inhale through nose, long exhale through mouth) -- the fastest documented way to lower heart rate and cortisol. The anxiety may still be there, but it won\'t be running at full volume.'},
  {key:'L',letter:'L',icon:'&#128338;',label:'Late / Behind',
   question:'Are you behind on something? Is time pressure creating a cognitive loop?',
   action:'Lateness anxiety hijacks working memory. Write down the ONE thing you\'re behind on and just the next physical action. That offloads the loop from your brain to the page. If you\'re actually late -- decide now: text ahead, or just go. Limbo is the most expensive mental state.'},
  {key:'T',letter:'T',icon:'&#128564;',label:'Tired',
   question:'How many hours of sleep last night? Is there accumulated fatigue this week?',
   action:'If genuinely sleep-deprived, shift to maintenance tasks. A 10–20 minute nap (not longer -- that causes grogginess) restores alertness more than caffeine without the crash. If napping isn\'t possible, cold water on your face or a 5-minute walk outside both produce measurable alertness improvements.'},
  {key:'N',letter:'N+',icon:'&#128266;',label:'Noise / Sensory Load',
   question:'Is the environment louder, brighter, or more chaotic than your nervous system can filter?',
   action:'ADHD brains have reduced sensory gating -- you can\'t filter background inputs as efficiently. This isn\'t willpower. Options: headphones with brown noise, move to a quieter space, reduce screen brightness, or face away from visual chaos. The 15 seconds to put in headphones routinely doubles focus duration for sensory-sensitive people.'},
  {key:'L2',letter:'+',icon:'&#128267;',label:'Low Energy State',
   question:'Is your energy crashed or flat -- no motivation, foggy, depleted (not just tired)?',
   action:'If it\'s 2–4pm, this is likely your natural cortisol trough. A 10-minute walk outside resets the cortisol curve best. If persistent across the day, check Energy & Mood and consider the Wellness Toolkit next.'},
  {key:'T2',letter:'+',icon:'&#127777;',label:'Temperature',
   question:'Are you too hot or cold? Is the room temperature uncomfortable?',
   action:'Thermal discomfort is a continuous background stressor that depletes attentional resources without you realizing it. Optimal cognitive performance is 70–77°F. Add or remove a layer, adjust a thermostat, or move. This sounds trivial but is one of the most impactful and fastest environment fixes.'}
];

function openHaltModal(){
  _haltChecked={};
  document.getElementById('haltModal').classList.add('open');
  _blurDashboard();
  _renderHalt();
}
function closeHaltModal(){
  var addressed=HALT_ITEMS.filter(function(item){return !!_haltChecked[item.key];}).map(function(item){return item.key;});
  if(addressed.length>0){
    _logCheckIn('halt',{items:addressed,count:addressed.length});
  }
  _haltChecked={};
  document.getElementById('haltModal').classList.remove('open');
  _unblurDashboard();
}
// Quiet, descriptive line under the HALT+ header -- e.g. "'Tired' has come up
// in 4 of your last 5 check-ins." Never appears until there's real signal
// (>=3 sessions in the last 14 days), and never moralizes or nags.
function _haltTrendLine(){
  var recent=_checkinsSince(14).filter(function(c){return c.type==='halt';});
  if(recent.length<3)return '';
  var freq={};
  recent.forEach(function(c){(c.items||[]).forEach(function(k){freq[k]=(freq[k]||0)+1;});});
  var topKey=null,topCount=0;
  Object.keys(freq).forEach(function(k){if(freq[k]>topCount){topCount=freq[k];topKey=k;}});
  if(!topKey||topCount<2)return '';
  var item=HALT_ITEMS.find(function(i){return i.key===topKey;});
  if(!item)return '';
  return '"'+item.label+'" has come up in '+topCount+' of your last '+recent.length+' check-ins.';
}
function _renderHalt(){
  var body=document.getElementById('haltBody');
  var html='<div class="halt-intro">A one-tap diagnostic for <strong>physical and environmental inputs</strong> that tank executive function before you know why. Tap each to expand, address it, and check it off.</div>';
  var trend=_haltTrendLine();
  if(trend)html+='<div class="halt-trend">'+esc(trend)+'</div>';
  HALT_ITEMS.forEach(function(item){
    var isChecked=!!_haltChecked[item.key];
    // R9/F16: was a plain onclick div -- no way for a keyboard/VoiceOver user
    // to tell this is interactive, expandable, or currently open. role/
    // tabindex/aria-expanded make it a real accordion trigger; aria-expanded
    // starts false since HALT+ always opens fully collapsed, and haltToggle()
    // keeps it in sync (this function isn't re-run on toggle, only on check).
    html+='<div class="halt-item"><div class="halt-item-header" role="button" tabindex="0" aria-expanded="false" aria-controls="halt-body-'+item.key+'" onclick="haltToggle(\''+item.key+'\')" onkeydown="_haltHeaderKeydown(event,\''+item.key+'\')">'
      +'<div class="halt-item-icon" aria-hidden="true">'+item.icon+'</div>'
      +'<div class="halt-item-label">'+item.label+'</div>'
      +'<span class="halt-item-letter">'+item.letter+'</span>'
      +'<div class="halt-item-check'+(isChecked?' checked':'')+'" aria-hidden="true">'+( isChecked?'&#10003;':'')+'</div>'
      +'</div>'
      +'<div class="halt-item-body" id="halt-body-'+item.key+'">'
      +'<div class="halt-item-question">'+item.question+'</div>'
      +'<div class="halt-item-action">'+item.action+'</div>'
      +'<div style="margin-top:10px;">'
      +'<button class="btn btn-sm'+(isChecked?' btn-accent':'')+'" onclick="haltCheck(event,\''+item.key+'\')">'
      +(isChecked?'&#10003; Addressed':'Mark as Addressed')+'</button>'
      +'</div></div></div>';
  });
  html+='<div class="halt-summary" id="haltSummary"></div>';
  html+='<button class="halt-reset-btn" onclick="haltReset()">&#8634; Reset All</button>';
  body.innerHTML=html;
  _updateHaltSummary();
}
function haltToggle(key){
  var bd=document.getElementById('halt-body-'+key);
  if(!bd)return;
  var nowOpen=bd.classList.toggle('open');
  var hdr=bd.previousElementSibling;
  if(hdr&&hdr.classList.contains('halt-item-header'))hdr.setAttribute('aria-expanded',nowOpen?'true':'false');
}
// Enter/Space activate the header same as a click; Space is prevented from
// also scrolling the page (the default behavior for a focused non-button div).
function _haltHeaderKeydown(e,key){
  if(e.key==='Enter'||e.key===' '){e.preventDefault();haltToggle(key);}
}
function haltCheck(e,key){e.stopPropagation();_haltChecked[key]=!_haltChecked[key];_renderHalt();var bd=document.getElementById('halt-body-'+key);if(bd)bd.classList.add('open');_updateHaltSummary();}
function _updateHaltSummary(){
  var checked=Object.keys(_haltChecked).filter(function(k){return _haltChecked[k];}).length;
  var total=HALT_ITEMS.length;
  var el=document.getElementById('haltSummary');if(!el)return;
  if(checked===0){el.classList.remove('visible');el.textContent='';return;}
  el.classList.add('visible');
  var remaining=total-checked;
  if(remaining===0){el.innerHTML='<strong style="color:var(--green);">&#10003; All items addressed.</strong> Physical/environmental state is clear. If still stuck, the issue is likely task initiation -- try the Stuck? panel or Brain Dump.';}
  else{el.innerHTML='<strong>'+checked+' of '+total+' addressed.</strong> '+remaining+' item'+(remaining!==1?'s':'')+' still to check.';}
}
function haltReset(){_haltChecked={};_renderHalt();}

// =======================================
// URGE LOG (R13): log an impulse and put a deliberate, wall-clock-timed pause
// between noticing it and acting on it ("urge surfing"). Independent of the
// focus timer (own globals) so both can run at once. Only logs a check-in
// once an outcome is known -- matches _logCheckIn's existing convention of
// recording completed signal, not every modal open.
// =======================================
var URGE_TYPES=[
  {key:'buy',icon:'&#128717;',label:'Impulse buy'},
  {key:'phone',icon:'&#128241;',label:'Phone / social media'},
  {key:'snack',icon:'&#127850;',label:'Snack / food'},
  {key:'skip',icon:'&#9193;',label:'Skip a task'},
  {key:'other',icon:'&#8230;',label:'Other'}
];
var URGE_DELAYS=[5,10,20];
var _urgeStep='idle'; // idle -> running -> outcome
var _urgeType=null,_urgeNote='';
var urgeTimerLeft=0,urgeTimerEndAt=null,urgeTimerRunning=false,urgeTimerInterval=null,urgeDelayMinutes=0;

// F5: give the urge pause the same native lock-screen presence the focus timer
// has (R7 tier 2), threaded through the EXACT existing `notify`-channel plumbing
// -- no new bridge, no new native target. The urge timer's real state lives in
// the JS runtime (suspended in the background), so these are fire-and-forget:
// the Live Activity counts down natively and a scheduled local notification
// alerts on completion even while JS is asleep.
//
// PRIVACY: an impulse/craving pause on a LOCK SCREEN is sensitive. Everything
// that can surface there uses NEUTRAL wording only -- never the urge type or
// the user's note. Those stay in-app.
var URGE_NOTIF_ID='urge-timer';
function _urgeLiveActivityStart(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h&&urgeTimerEndAt){
    try{h.postMessage({action:'startLiveActivity',id:URGE_NOTIF_ID,at:urgeTimerEndAt,title:'Pause',label:'Riding it out',iconName:'hourglass'});}catch(e){}
  }
}
function _urgeLiveActivityEnd(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h){try{h.postMessage({action:'endLiveActivity',id:URGE_NOTIF_ID});}catch(e){}}
}
function _urgeNotifStart(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h&&urgeTimerEndAt){
    try{h.postMessage({action:'scheduleTimer',id:URGE_NOTIF_ID,at:urgeTimerEndAt,title:'Pause complete',body:'Your pause is complete — check in when you’re ready.'});}catch(e){}
  }
}
function _urgeNotifCancel(){
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h){try{h.postMessage({action:'cancelTimer',id:URGE_NOTIF_ID});}catch(e){}}
}
// Distinct tactile signature for the urge pause, deliberately different from the
// breathwork swell. Gated on the same single haptics preference (state.breathHaptics)
// -- if a user turned haptics off, they get none here either.
function _urgeHaptic(kind){
  if(!state.breathHaptics)return;
  var h=(typeof _notifNative==='function')?_notifNative():null;
  if(h){
    try{h.postMessage({action:'haptic',kind:kind});}catch(e){}
    return;
  }
  // Web fallback (Android only; desktop no-op). Distinct from breath patterns.
  if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){
    try{
      if(kind==='urgeComplete')navigator.vibrate([30,50,30,50,50]);
      else if(kind==='urgeStart')navigator.vibrate(20);
    }catch(e){}
  }
}
// Defensive teardown: if the pause is not running, make sure no Live Activity or
// pending completion notification is left dangling.
function _urgeClearNative(){
  _urgeLiveActivityEnd();
  _urgeNotifCancel();
}

function openUrgeModal(){
  document.getElementById('urgeModal').classList.add('open');
  _blurDashboard();
  // Reopening after the pause already resolved (or was never started) shouldn't
  // leave a stale Activity/notification around.
  if(_urgeStep!=='running')_urgeClearNative();
  _renderUrge();
}
function closeUrgeModal(){
  // Deliberately does NOT stop a running delay -- closing the modal shouldn't
  // break the pause the user started; reopening the toolkit button resumes
  // showing the live countdown (see openUrgeModal -> _renderUrge).
  document.getElementById('urgeModal').classList.remove('open');
  _unblurDashboard();
}
function urgeSelectType(key){_urgeType=key;_renderUrge();}
function urgeStartDelay(minutes){
  if(!_urgeType)return;
  var noteEl=document.getElementById('urgeNoteInput');
  if(noteEl)_urgeNote=noteEl.value.trim();
  _trackEvent('tool_use','urge_log','Urge Log');
  urgeDelayMinutes=minutes;
  urgeTimerLeft=minutes*60;
  urgeTimerEndAt=Date.now()+(urgeTimerLeft*1000);
  urgeTimerRunning=true;
  _urgeStep='running';
  clearInterval(urgeTimerInterval);
  urgeTimerInterval=setInterval(_urgeTick,500);
  // F5: native lock-screen countdown + a completion alert that fires even if the
  // app is backgrounded (JS suspended), plus a distinct "locking in" buzz.
  _urgeLiveActivityStart();
  _urgeNotifStart();
  _urgeHaptic('urgeStart');
  _renderUrge();
}
function _urgeTick(){
  if(urgeTimerEndAt!==null)urgeTimerLeft=Math.max(0,Math.round((urgeTimerEndAt-Date.now())/1000));
  var el=document.getElementById('urgeCountdown');
  if(el){var m=Math.floor(urgeTimerLeft/60),s=urgeTimerLeft%60;el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
  if(urgeTimerLeft<=0&&urgeTimerRunning)_urgeComplete();
}
function _urgeComplete(){
  urgeTimerRunning=false;clearInterval(urgeTimerInterval);urgeTimerInterval=null;urgeTimerEndAt=null;
  // F5: the pause elapsed -- retire the Live Activity and give the distinct
  // completion buzz. (This branch only runs with JS alive, i.e. foreground; in
  // the background the native notification scheduled at start is the alert.)
  _urgeLiveActivityEnd();
  _urgeHaptic('urgeComplete');
  toast('⏳ Delay complete — how do you feel now?');
  if((typeof _notifNative!=='function'||!_notifNative())&&typeof _notifShow==='function'&&document.visibilityState!=='visible'){
    _notifShow('✋ Delay complete','How do you feel about the urge now?','urge-log');
  }
  _urgeStep='outcome';
  _renderUrge();
}
function urgeDecideNow(){
  if(!urgeTimerRunning)return;
  urgeTimerRunning=false;clearInterval(urgeTimerInterval);urgeTimerInterval=null;urgeTimerEndAt=null;
  // F5: decided early -- the pause never elapsed, so kill the Live Activity and
  // the still-pending completion notification before it can fire.
  _urgeClearNative();
  _urgeStep='outcome';
  _renderUrge();
}
function urgeOutcome(result){
  var item=URGE_TYPES.find(function(t){return t.key===_urgeType;});
  _logCheckIn('urge',{urgeType:_urgeType,urgeLabel:item?item.label:_urgeType,note:_urgeNote||undefined,delayMinutes:urgeDelayMinutes,outcome:result});
  addPoints('urge',document.getElementById('urgeOutcomeBtn-'+result));
  toast(result==='passed'?'✓ Logged — nice work riding it out.':'✓ Logged — no judgment, the pause still counted.');
  _urgeStep='idle';_urgeType=null;_urgeNote='';urgeDelayMinutes=0;urgeTimerLeft=0;
  // F5: defensive -- back to idle, ensure nothing native is left dangling.
  _urgeClearNative();
  _renderUrge();
}
function _renderUrge(){
  var body=document.getElementById('urgeBody');
  if(!body)return;
  var html='';
  if(_urgeStep==='running'){
    var t=URGE_TYPES.find(function(x){return x.key===_urgeType;});
    var m=Math.floor(urgeTimerLeft/60),s=urgeTimerLeft%60;
    html+='<div class="urge-running">'
      +'<div class="urge-running-type">'+(t?t.icon+' '+t.label:'')+'</div>'
      +'<div class="urge-countdown" id="urgeCountdown">'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'</div>'
      +'<div class="urge-running-sub">Sit with it. It’s OK if it doesn’t fully pass — the pause is the point.</div>'
      +'<button class="btn btn-sm" onclick="urgeDecideNow()">I’ve decided</button>'
      +'</div>';
  }else if(_urgeStep==='outcome'){
    html+='<div class="urge-outcome">'
      +'<div class="urge-outcome-prompt">What happened?</div>'
      +'<button class="btn btn-accent" id="urgeOutcomeBtn-passed" onclick="urgeOutcome(\'passed\')">Urge passed</button>'
      +'<button class="btn" id="urgeOutcomeBtn-acted" onclick="urgeOutcome(\'acted\')">Did it anyway</button>'
      +'</div>';
  }else{
    html+='<div class="urge-intro">Notice an urge to act on impulse? Log it, then put a deliberate pause between the urge and the action. Most urges fade within minutes.</div>';
    html+='<div class="urge-type-grid">';
    URGE_TYPES.forEach(function(t){
      html+='<button class="urge-type-btn'+(_urgeType===t.key?' selected':'')+'" aria-pressed="'+(_urgeType===t.key?'true':'false')+'" onclick="urgeSelectType(\''+t.key+'\')">'
        +'<span class="urge-type-icon" aria-hidden="true">'+t.icon+'</span><span>'+t.label+'</span></button>';
    });
    html+='</div>';
    if(_urgeType==='other'){
      html+='<input type="text" id="urgeNoteInput" class="urge-note-input" aria-label="What’s the urge (optional)" placeholder="What’s the urge? (optional)" value="'+esc(_urgeNote)+'">';
    }
    html+='<div class="urge-delay-label" id="urgeDelayLabel">Choose a delay:</div>';
    html+='<div class="urge-delay-grid" role="group" aria-labelledby="urgeDelayLabel">';
    URGE_DELAYS.forEach(function(mins){
      html+='<button class="urge-delay-btn"'+(_urgeType?'':' disabled')+' onclick="urgeStartDelay('+mins+')">'+mins+' min</button>';
    });
    html+='</div>';
  }
  body.innerHTML=html;
}

// =======================================
// WELLNESS WHEEL (SAMHSA 8 Dimensions)
// =======================================
var WELLNESS_DIMENSIONS=[
  {key:'emotional',name:'Emotional',icon:'\u{1F60C}',
   def:'Coping effectively with life and creating satisfying relationships. Includes engaging in self-care, managing stress, and acknowledging your feelings.'},
  {key:'environmental',name:'Environmental',icon:'\u{1F33F}',
   def:'Good health by occupying pleasant, stimulating environments that support well-being. Includes having a comfortable indoor space and getting outside in nature.'},
  {key:'financial',name:'Financial',icon:'\u{1F4B0}',
   def:'Satisfaction with current and future financial situations. Includes managing debt, building savings, and feeling secure about money matters.'},
  {key:'intellectual',name:'Intellectual',icon:'\u{1F4DA}',
   def:'Recognizing creative abilities and finding ways to expand knowledge and skills. Includes pursuing personal interests, education, and intellectually stimulating activities.'},
  {key:'occupational',name:'Occupational',icon:'\u{1F4BC}',
   def:'Personal satisfaction and enrichment from one\u2019s work. Includes work-life balance, having a sense of accomplishment, and meaningful contribution.'},
  {key:'physical',name:'Physical',icon:'\u{1F3C3}',
   def:'Recognizing the need for physical activity, healthy foods, and sleep. Includes nutrition, exercise, sleep hygiene, and mindful substance use.'},
  {key:'social',name:'Social',icon:'\u{1F465}',
   def:'Developing a sense of connection, belonging, and a well-developed support system. Includes nurturing relationships and contributing to your community.'},
  {key:'spiritual',name:'Spiritual',icon:'\u{1F54A}\uFE0F',
   def:'Expanding a sense of purpose and meaning in life. Includes connecting to your values, practices, or beliefs that bring perspective and inner peace.'}
];

function openWellnessModal(){
  document.getElementById('wellnessModal').classList.add('open');
  _blurDashboard();
  _renderWellness();
}

function closeWellnessModal(){
  document.getElementById('wellnessModal').classList.remove('open');
  _unblurDashboard();
}

function _renderWellness(){
  if(!state.wellnessNotes)state.wellnessNotes={};
  var body=document.getElementById('wellnessBody');
  var html='<div class="well-intro">'
    +'The <strong>SAMHSA Wellness Wheel</strong> recognizes 8 dimensions of well-being. Click any dimension to expand it, read the definition, and add a personal note about how you can grow in that area.'
    +' <span style="color:#7fb3a0;">+4 Presence</span> for each note saved.'
    +'</div>';
  html+='<div class="well-list">';
  WELLNESS_DIMENSIONS.forEach(function(d){
    var existing=(state.wellnessNotes[d.key]||{}).note||'';
    var hasNote=existing.trim().length>0;
    html+='<div class="well-item'+(hasNote?' has-note':'')+'" id="well-'+d.key+'">'
      +'<div class="well-item-header" onclick="_wellToggle(\''+d.key+'\')">'
      +'<span class="well-icon">'+d.icon+'</span>'
      +'<span class="well-name">'+d.name+'</span>'
      +(hasNote?'<span class="well-note-indicator">\u2713 noted</span>':'')
      +'<span class="well-arrow">\u25B6</span>'
      +'</div>'
      +'<div class="well-item-body">'
      +'<div class="well-def">'+d.def+'</div>'
      +'<div class="well-note-label">My note for this area</div>'
      +'<textarea class="well-note-input" id="well-note-'+d.key+'" placeholder="What would help you grow here? Example: try and make 2 new connections over the next couple of months">'+esc(existing)+'</textarea>'
      +'<div class="well-note-actions">'
      +'<span class="well-note-saved" id="well-saved-'+d.key+'">'+(hasNote?'Last updated '+_wellFormatDate((state.wellnessNotes[d.key]||{}).updatedAt):'')+'</span>'
      +'<button class="well-save-btn" onclick="_wellSave(\''+d.key+'\')">Save</button>'
      +'</div>'
      +'</div>'
      +'</div>';
  });
  html+='</div>';
  body.innerHTML=html;
}

function _wellToggle(key){
  var item=document.getElementById('well-'+key);
  if(!item)return;
  var arrow=item.querySelector('.well-arrow');
  var open=item.classList.toggle('expanded');
  if(arrow)arrow.classList.toggle('open',open);
  if(open){
    setTimeout(function(){
      var ta=document.getElementById('well-note-'+key);
      if(ta)ta.focus();
    },50);
  }
}

function _wellSave(key){
  var ta=document.getElementById('well-note-'+key);
  if(!ta)return;
  var newText=ta.value.trim();
  if(!state.wellnessNotes)state.wellnessNotes={};
  var existing=(state.wellnessNotes[key]||{}).note||'';
  
  if(!newText){
    // Empty save = clear the note (no points)
    delete state.wellnessNotes[key];
    save();
    _renderWellness();
    setTimeout(function(){
      var item=document.getElementById('well-'+key);
      if(item){item.classList.add('expanded');var arrow=item.querySelector('.well-arrow');if(arrow)arrow.classList.add('open');}
    },10);
    return;
  }
  
  // Award points only if new content was added (not just resaving same text)
  var isNewOrUpdated=newText!==existing.trim();
  state.wellnessNotes[key]={note:newText,updatedAt:new Date().toISOString()};
  save();
  
  if(isNewOrUpdated){
    var btnEl=document.querySelector('#well-'+key+' .well-save-btn');
    addPoints('wellness_note',btnEl);
    toast('\u2713 Wellness note saved');
  }else{
    toast('No changes to save');
  }
  
  _renderWellness();
  // Re-expand the same item
  setTimeout(function(){
    var item=document.getElementById('well-'+key);
    if(item){item.classList.add('expanded');var arrow=item.querySelector('.well-arrow');if(arrow)arrow.classList.add('open');}
  },10);
}

function _wellFormatDate(iso){
  if(!iso)return '';
  var d=new Date(iso);
  var now=new Date();
  var diffMs=now-d;
  var diffMin=Math.floor(diffMs/60000);
  if(diffMin<1)return 'just now';
  if(diffMin<60)return diffMin+' min ago';
  var diffHr=Math.floor(diffMin/60);
  if(diffHr<24)return diffHr+'h ago';
  var diffDay=Math.floor(diffHr/24);
  if(diffDay<7)return diffDay+'d ago';
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}


// =======================================
// FOCUS MUSIC (YouTube IFrame API)
// =======================================
// =======================================
// MUSIC PLAYER (YouTube IFrame API + Playlist Switcher)
// =======================================
var MUSIC_PLAYLISTS=[
  {id:'PLeSVVJPLz73E_INwG2Oj5W_CG25Ac2t6l',name:'Rock Vibes',icon:'🤘'},
  {id:'PLeSVVJPLz73HAqvoVE-8litfOeQk6oQ8m',name:'Khruangbin',icon:'🎸'},
  {id:'PLeSVVJPLz73HUhdxoKKMJFfBgB5U_4JWC',name:'Jazz',icon:'🎷'},
  {id:'PLeSVVJPLz73FPBtEZXCUPrLybUGbGoz8i',name:'90s Grunge',icon:'🎤'},
  {id:'PLeSVVJPLz73FGftTDMuiefwuadwf4IAiF',name:'ADHD Focus',icon:'🎯'}
];
var currentPlaylistIdx=0;
var ytPlayer=null,ytPlayerReady=false,ytAPILoading=false;

function _loadYTAPI(callback){
  if(typeof YT!=='undefined'&&YT.Player){callback();return;}
  window.onYouTubeIframeAPIReady=callback;
  if(ytAPILoading)return;
  ytAPILoading=true;
  var tag=document.createElement('script');
  tag.src='https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function _createYTPlayer(playlistId){
  var host=document.getElementById('ytPlayerHost');
  if(!host)return;
  host.innerHTML='<div id="ytPlayerInner"></div>';
  ytPlayer=new YT.Player('ytPlayerInner',{
    height:'1',width:'1',
    playerVars:{listType:'playlist',list:playlistId,autoplay:1,controls:0,modestbranding:1,playsinline:1},
    events:{
      'onReady':function(e){
        ytPlayerReady=true;
        try{e.target.playVideo();}catch(err){}
        _updateMusicUI();
      },
      'onStateChange':_updateMusicUI,
      'onError':function(e){
        console.error('YT Player error:',e.data);
        var msgs={2:'Invalid playlist',5:'HTML5 player error',100:'Playlist not found',101:'Playlist owner disallows embedded playback',150:'Playlist owner disallows embedded playback'};
        alert('Music error: '+(msgs[e.data]||'Error code '+e.data));
      }
    }
  });
}

function musicHandleClick(ev){
  // Always close dropdown on regular click
  var dd=document.getElementById('musicDropdown');
  if(dd&&dd.style.display==='block'){dd.style.display='none';}
  focusMusicToggle();
}

function focusMusicToggle(){
  // Lazy-load YT API and create player on first use
  if(!ytPlayer){
    _loadYTAPI(function(){_createYTPlayer(MUSIC_PLAYLISTS[currentPlaylistIdx].id);});
    return;
  }
  // Toggle play/pause
  if(!ytPlayerReady)return;
  try{
    var st=ytPlayer.getPlayerState();
    if(st===1){ytPlayer.pauseVideo();}
    else{ytPlayer.playVideo();}
  }catch(err){console.error('Music toggle error:',err);}
}

function focusMusicSkip(){
  if(ytPlayer&&ytPlayerReady){
    try{ytPlayer.nextVideo();}catch(err){console.error('Skip error:',err);}
  }
}

function musicToggleDropdown(ev){
  var dd=document.getElementById('musicDropdown');
  if(!dd)return;
  if(dd.style.display==='block'){dd.style.display='none';return;}
  
  // Build dropdown contents
  var html=MUSIC_PLAYLISTS.map(function(p,i){
    var current=i===currentPlaylistIdx;
    return '<div class="music-dropdown-item'+(current?' current':'')+'" onclick="event.stopPropagation();musicSelectPlaylist('+i+')">'
      +'<span class="music-dropdown-icon">'+p.icon+'</span>'
      +'<span class="music-dropdown-name">'+esc(p.name)+'</span>'
      +(current?'<span class="music-dropdown-check">&#9654; playing</span>':'')
      +'</div>';
  }).join('');
  dd.innerHTML=html;
  dd.style.display='block';
  
  // Click-outside to close
  setTimeout(function(){
    var handler=function(e){
      var wrap=document.querySelector('.toolkit-music-wrap');
      if(!wrap||!wrap.contains(e.target)){
        dd.style.display='none';
        document.removeEventListener('click',handler);
      }
    };
    document.addEventListener('click',handler);
  },10);
}

function musicSelectPlaylist(idx){
  if(idx<0||idx>=MUSIC_PLAYLISTS.length)return;
  
  var dd=document.getElementById('musicDropdown');
  if(dd)dd.style.display='none';
  
  // No-op if same playlist already selected
  if(idx===currentPlaylistIdx&&ytPlayer&&ytPlayerReady)return;
  
  currentPlaylistIdx=idx;
  var playlistId=MUSIC_PLAYLISTS[idx].id;
  
  // If player exists, switch playlist; otherwise create with this one
  if(ytPlayer&&ytPlayerReady){
    try{
      // Stop current playback first to avoid the API restarting the current track
      ytPlayer.stopVideo();
      // Use cuePlaylist to load without auto-playing, then call playVideo
      // The string form (just playlist ID) is more reliable than the object form
      ytPlayer.cuePlaylist({list:playlistId,listType:'playlist',index:0,startSeconds:0,suggestedQuality:'small'});
      // Give the API a tick to process the new playlist before starting
      setTimeout(function(){
        try{ytPlayer.playVideo();}catch(err){console.error('Auto-play after switch error:',err);}
      },200);
    }catch(err){
      console.error('Playlist switch error:',err);
    }
  }else if(!ytPlayer){
    _loadYTAPI(function(){_createYTPlayer(playlistId);});
  }
  _updateMusicUI();
}

function _updateMusicUI(){
  var btn=document.getElementById('focusMusicBtn');
  var ctrls=document.getElementById('musicControls');
  var stateIcon=document.getElementById('musicStateIcon');
  var emoji=document.getElementById('musicEmoji');
  var label=document.getElementById('musicLabel');
  if(!btn||!ctrls)return;
  
  var currentName=MUSIC_PLAYLISTS[currentPlaylistIdx].name;
  
  if(!ytPlayer||!ytPlayerReady){
    ctrls.style.display='none';
    btn.classList.remove('playing');
    if(emoji)emoji.classList.remove('music-emoji-spin');
    if(label)label.textContent='Music';
    return;
  }
  
  ctrls.style.display='inline-flex';
  var st;
  try{st=ytPlayer.getPlayerState();}catch(err){st=-1;}
  // States: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
  if(st===1){
    btn.classList.add('playing');
    if(stateIcon)stateIcon.innerHTML='&#9208;'; // pause icon (next action)
    if(emoji)emoji.classList.add('music-emoji-spin');
    if(label)label.textContent=currentName;
  }else{
    btn.classList.remove('playing');
    if(stateIcon)stateIcon.innerHTML='&#9654;'; // play icon (next action)
    if(emoji)emoji.classList.remove('music-emoji-spin');
    if(label)label.textContent=currentName+' (paused)';
  }
}

// =======================================
// POINTS / REWARDS SYSTEM
// =======================================
var TIER_THRESHOLDS=[
  {name:'bronze',label:'Bronze',icon:'🥉',min:0,max:100,color:'#cd7f32'},
  {name:'silver',label:'Silver',icon:'🥈',min:100,max:300,color:'#dadada'},
  {name:'gold',label:'Gold',icon:'🥇',min:300,max:700,color:'#ffd700'},
  {name:'diamond',label:'Diamond',icon:'💎',min:700,max:1500,color:'#b9f2ff'},
  {name:'mythic',label:'Mythic',icon:'⭐',min:1500,max:Infinity,color:'#ff9ec0'}
];

var POINT_VALUES={
  daily_login:1,
  routine:1,
  breathwork:2,
  timer:3,
  urge:4,
  subtask:3,
  mood_energy:3,
  wellness_note:4,
  journal:5,
  task:5,
  recovery:8,
  workout:15,
  project:25
};

// R8: runs the quick-add text through parseQuickAdd and decides what to
// apply. Asymmetric on purpose -- date/time only fill in when the field is
// genuinely EMPTY (a picker the user already set is visibly non-empty, so
// silently overriding it would be surprising); priority always applies when
// an explicit "!token" is present, since a priority <select> always shows
// SOME value (usually "med") whether the user touched it or not, so there's
// no visible "untouched" state to protect. opts picks which fields this
// particular form actually has a home for (see call sites).
function _applyQuickAdd(nameValue,current,opts){
  var out={name:nameValue,due:current.due||'',time:current.time||'',recurrence:null};
  if(typeof window.parseQuickAdd!=='function')return out;
  var parsed=window.parseQuickAdd(nameValue);
  out.name=parsed.name||nameValue;
  if(opts.date&&parsed.due&&!current.due)out.due=parsed.due;
  if(opts.time&&parsed.time&&!current.time)out.time=parsed.time;
  if(opts.recurrence&&parsed.recurrence)out.recurrence=parsed.recurrence;
  // A repeat with nothing to repeat FROM never fires: the recurrence engine
  // advances from the due date, and the timeline only shows dated items -- so
  // "workout 6am daily" with no date would silently show up nowhere. Anchor it
  // to today, exactly as editTaskRecurrence already does for the repeat badge.
  if(out.recurrence&&!out.due)out.due=todayStr();
  return out;
}
var RECUR_LABEL={daily:'daily',weekly:'weekly',monthly:'monthly'};
// Short label for the task-row repeat badge -- weekly recurrence always
// tracks the due date's weekday, so show that day (e.g. "Mon") instead of
// the generic "weekly".
function _recurrenceBadgeLabel(t){
  if(!t||!t.recurrence||!t.recurrence.freq)return '';
  if(t.recurrence.freq==='weekly'&&t.due){
    var dow=new Date(t.due+'T00:00:00').getDay();
    if(!isNaN(dow))return WEEKDAY_NAMES[dow].slice(0,3);
  }
  return RECUR_LABEL[t.recurrence.freq]||t.recurrence.freq;
}
// Live "→ Jul 16, 3:00 PM, repeats monthly" chip under a quick-add text
// input -- informational only, teaches the syntax as you type. Shows only
// badges the target form actually supports (see opts).
function _renderQuickAddPreview(inputId,previewId,opts){
  var inp=document.getElementById(inputId),el=document.getElementById(previewId);
  if(!inp||!el)return;
  if(typeof window.parseQuickAdd!=='function'){el.style.display='none';return;}
  var p=window.parseQuickAdd(inp.value);
  var bits=[];
  if(opts.date&&p.due)bits.push(fmtDate(p.due));
  if(opts.time&&p.time)bits.push(fmtTime(p.time));
  if(opts.recurrence&&p.recurrence)bits.push('repeats '+(RECUR_LABEL[p.recurrence.freq]||p.recurrence.freq));
  if(bits.length===0){el.style.display='none';el.textContent='';return;}
  el.style.display='block';
  el.textContent='→ '+bits.join(', ');
}

// =======================================
// R9: QUICK CAPTURE -- one global entry point (the "B" key, and a floating
// button) to jot something down from anywhere without deciding up front
// where it belongs. Reuses R8's parser: if the text carries a date/time/
// priority/recurrence signal, it becomes a real Task; otherwise it's a plain
// Brain Dump thought, matching the app's existing "capture now, triage
// later" default (same field shapes as addStandaloneTask/handleDumpKey).
// =======================================
// R13/F23: "Home is a list of doors with no 'start here'" -- the review
// found this true even with the onboarding tour in place (tour is skippable,
// and a returning user who skipped it on day 1 never gets another nudge).
// Gated on onboardingSeen===true specifically so this never competes with
// the tour itself on a brand-new account (initApp only fires the tour when
// that's still false) -- this is for the AFTER case.
function _maybeShowFabHint(){
  if(state.onboardingSeen!==true)return;
  if(state.fabHintDismissed)return;
  var empty=(state.tasks||[]).length===0&&(state.notes||[]).length===0
    &&(state.projects||[]).length===0&&(state.reminders||[]).length===0;
  if(!empty)return;
  var el=document.getElementById('fabHint');
  if(el)el.style.display='flex';
}
function dismissFabHint(){
  if(state.fabHintDismissed)return;
  state.fabHintDismissed=true;save();
  var el=document.getElementById('fabHint');
  if(el)el.style.display='none';
}
function openQuickCapture(){
  var modal=document.getElementById('quickCaptureModal');
  if(!modal)return;
  modal.classList.add('open');
  _blurDashboard();
  // R13: tapping the FAB at all counts as having found it -- no need to also
  // require dismissing the hint bubble separately.
  if(typeof dismissFabHint==='function')dismissFabHint();
  var input=document.getElementById('quickCaptureInput');
  var preview=document.getElementById('quickCapturePreview');
  if(input)input.value='';
  if(preview){preview.style.display='none';preview.textContent='';}
  // Focus MUST happen synchronously in the same call stack as the tap/click
  // that opened this modal -- iOS WebKit only raises the soft keyboard for a
  // focus() called with "transient activation" still active, and a
  // setTimeout (even a few ms) drops that flag. The visibility toggle above
  // is a synchronous classList change, so the element is already focusable.
  if(input)input.focus();
}
// Clears + blurs the input BEFORE hiding the modal, so a discard is always
// unambiguous: Escape calls this directly (never wants a save), and if the
// blur that follows fires the onBlur-save handler below, it finds nothing
// there and no-ops. Also called at the end of a successful submit, where
// clearing is a harmless no-op (text is already saved) and blurring ensures
// the keyboard actually dismisses even though the modal is just hidden via
// CSS, not removed from focus.
function closeQuickCapture(){
  var input=document.getElementById('quickCaptureInput');
  if(input){input.value='';input.blur();}
  var modal=document.getElementById('quickCaptureModal');
  if(!modal)return;
  modal.classList.remove('open');
  _unblurDashboard();
}
function quickCaptureKeydown(e){
  if(e.key==='Escape'){closeQuickCapture();return;}
  if(e.key==='Enter'){e.preventDefault();submitQuickCapture();}
}
// R9 fix: the input saves on BLUR (any loss of focus -- Enter, the Save
// button, tapping outside, or iOS's own keyboard-dismiss "done"/checkmark
// control, which never fires a click or keydown event Claude can hook into
// directly). One mechanism instead of enumerating every way focus can leave
// an input. Safe to call more than once for the same edit -- it clears the
// input on success, so a second call (e.g. Enter followed by the blur that
// naturally follows) just finds empty text and no-ops.
// F1: routing core shared by Quick Capture (submitQuickCapture) and the native
// capture-queue drain (__drainCaptureQueue). DOM-free and does NOT save/render/
// toast -- it only parses the string and pushes the resulting task-or-thought
// into state, returning {type,name,id}. That lets a single capture or a whole
// batch decide when to persist and re-render. Same task/thought split
// submitQuickCapture has always used; ids carry a random suffix so a batch
// drained within one millisecond can't collide.
function _captureString(text){
  text=(text||'').trim();
  if(!text)return null;
  var p=(typeof window.parseQuickAdd==='function')?window.parseQuickAdd(text):{name:text,due:null,time:null,recurrence:null};
  var hasSignal=!!(p.due||p.time||p.recurrence);
  if(hasSignal){
    var t={id:'tk'+Date.now()+Math.random().toString(36).slice(2,6),name:p.name,due:p.due||'',priority:'med',timeEst:'',projectId:'',projectIds:[],done:false,recurrence:p.recurrence};
    state.tasks.push(t);
    return {type:'task',name:p.name,id:t.id};
  }
  if(!state.thoughts)state.thoughts=[];
  var th={id:'th'+Date.now()+Math.random().toString(36).slice(2,6),text:text};
  state.thoughts.push(th);
  return {type:'thought',name:text,id:th.id};
}
// Scroll a freshly captured row/chip into view and flash it briefly, so a
// capture is provably visible rather than only toasted -- the toast fades in
// ~2s and is easy to miss if you looked away. Scoped to ONE container's
// subtree (not a bare getElementById) because Today and Everything render
// task rows from the same _taskRowHTML ids -- see _wireTaskRowEditable's
// comment on the same bug class. Silently no-ops if the row isn't rendered
// at all (e.g. Stage 1's "today only" tile hid a task not due today; the
// "N more tasks -- Show all" hint already explains that case).
function _flashNewCapture(containerId,innerIdPrefix,id,rowClass){
  var container=document.getElementById(containerId);
  if(!container)return;
  var inner=container.querySelector('[id="'+innerIdPrefix+id+'"]');
  var row=inner&&inner.closest('.'+rowClass);
  if(!row)return;
  row.scrollIntoView({behavior:'smooth',block:'nearest'});
  row.classList.add('cp-just-captured');
  // Must match the cp-just-captured animation duration in app.css (2s) --
  // removing the class early truncates the fade mid-flight.
  setTimeout(function(){row.classList.remove('cp-just-captured');},2000);
}
function submitQuickCapture(){
  var input=document.getElementById('quickCaptureInput');
  if(!input)return;
  var text=input.value.trim();
  if(!text)return;
  var res=_captureString(text);
  if(!res){closeQuickCapture();return;}
  save();
  if(res.type==='task'){
    renderTaskList();
    _flashNewCapture('taskListItems','tlname_',res.id,'tl-item');
    toast('✓ Task added: '+res.name);
    _trackEvent('tool_use','quick_capture_task','Quick Capture');
  }else{
    renderThoughts();
    _flashNewCapture('thoughtChips','tt_',res.id,'thought-chip');
    toast('✓ Captured to Brain Dump');
    _trackEvent('tool_use','quick_capture_thought','Quick Capture');
  }
  closeQuickCapture();
}
// F1: native capture-queue drain. The iOS shell reads the shared App Group
// queue on foreground and calls this with a JSON array of {id,text}; each is
// routed through the same _captureString core Quick Capture uses. Persists and
// re-renders ONCE for the batch, then returns a JSON string of the ids it
// processed -- the native side reads that back (via evaluateJavaScript) and
// removes exactly those from the queue, so an item appended mid-drain survives.
// No-ops safely off-shell or on malformed input.
window.__drainCaptureQueue=function(itemsJson){
  var items;
  try{items=JSON.parse(itemsJson);}catch(e){return '[]';}
  if(!Array.isArray(items)||items.length===0)return '[]';
  var processed=[],sawTask=false,sawThought=false;
  items.forEach(function(it){
    if(!it||typeof it.text!=='string')return;
    var res=_captureString(it.text);
    if(!res)return;
    if(res.type==='task')sawTask=true;else sawThought=true;
    if(it.id!=null)processed.push(it.id);
  });
  if(processed.length){
    save();
    if(sawTask&&typeof renderTaskList==='function')renderTaskList();
    if(sawThought&&typeof renderThoughts==='function')renderThoughts();
    if(typeof toast==='function')toast('✓ Captured '+processed.length+' item'+(processed.length!==1?'s':''));
    if(typeof _trackEvent==='function')_trackEvent('tool_use','native_capture_drain','Native Capture');
  }
  return JSON.stringify(processed);
};

// R11: first-run guided tour. Nine short steps, skippable at every point;
// mirrors QuickCapture's open/close conventions (_blurDashboard/.open class).
// R2c: retargeted to the capture -> Today -> toolkit arc now that new
// accounts land on the Today view (R2b), not a panel grid. Plain text cards,
// no DOM anchoring -- renderOnboardingStep derives "X of N" from .length, so
// changing the count here is self-consistent with no other code changes.
var ONBOARDING_STEPS=[
  {title:'Welcome to Centerpost',body:"A quick tour — eight short steps, then you're on your own. Skip any time."},
  {title:'Today',body:"This is home: what's due, your current routine, and today's reminders, all in one place."},
  {title:'Quick Capture',body:"Tap the pencil (or press B) from anywhere and type — it figures out if it's a task or a thought."},
  {title:'Today / Everything',body:'Today stays calm and focused. Flip to Everything any time for the full set of panels.'},
  {title:'Tool Kit',body:'Breathing, grounding, HALT+ check-ins, and the focus timer — always one tap away.'},
  // R7: first-run version of the existing Settings toggle (setSupportLevel /
  // _renderSupportLevelSettings). Placed right after Tool Kit -- the exact
  // feature this preference controls. Renders its own markup in
  // renderOnboardingStep() below; body is unused for this step.
  {title:'How much support do you want?',interactive:'supportLevel'},
  {title:'Axis',body:'Your AI assistant. Ask it to plan your day, break down a task, or just talk something through.'},
  {title:"That's the essentials",body:"You're all set — jump in whenever you're ready."}
];
var _onboardingStep=0;
function openOnboardingTour(){
  var modal=document.getElementById('onboardingTourModal');
  if(!modal)return;
  _onboardingStep=0;
  renderOnboardingStep();
  modal.classList.add('open');
  _blurDashboard();
}
function closeOnboardingTour(){
  var modal=document.getElementById('onboardingTourModal');
  if(!modal)return;
  modal.classList.remove('open');
  _unblurDashboard();
}
function _onboardingFinish(){
  state.onboardingSeen=true;save();
  closeOnboardingTour();
}
function onboardingSkip(){_onboardingFinish();}
function onboardingNext(){
  if(_onboardingStep>=ONBOARDING_STEPS.length-1){_onboardingFinish();return;}
  _onboardingStep++;renderOnboardingStep();
}
function onboardingBack(){
  if(_onboardingStep<=0)return;
  _onboardingStep--;renderOnboardingStep();
}
function renderOnboardingStep(){
  var step=ONBOARDING_STEPS[_onboardingStep];
  var titleEl=document.getElementById('onboardingTitle');
  var bodyEl=document.getElementById('onboardingBody');
  var progEl=document.getElementById('onboardingProgress');
  var backBtn=document.getElementById('onboardingBackBtn');
  var nextBtn=document.getElementById('onboardingNextBtn');
  if(titleEl)titleEl.textContent=step.title;
  if(bodyEl){
    if(step.interactive==='supportLevel'){
      // R7: same markup/copy as _renderSupportLevelSettings (Settings panel),
      // reused verbatim so the tour and Settings never drift. setSupportLevel
      // writes the real preference; the second call re-renders THIS step so
      // the highlight updates immediately (Settings, if open elsewhere, was
      // already refreshed by setSupportLevel itself).
      var cur=state.supportLevel||'full';
      bodyEl.innerHTML=
        '<div class="support-level-row">'
        +'<button class="support-level-btn'+(cur==='full'?' active':'')+'" onclick="setSupportLevel(\'full\');renderOnboardingStep();">'
        +'<strong>Full</strong><span>Grounding Toolkit surfaces on its own when mood or energy is low</span></button>'
        +'<button class="support-level-btn'+(cur==='lean'?' active':'')+'" onclick="setSupportLevel(\'lean\');renderOnboardingStep();">'
        +'<strong>Lean</strong><span>Nothing pops up uninvited — open it yourself when you want it</span></button>'
        +'</div>';
    }else{
      bodyEl.textContent=step.body;
    }
  }
  if(progEl)progEl.textContent=(_onboardingStep+1)+' of '+ONBOARDING_STEPS.length;
  if(backBtn)backBtn.style.visibility=_onboardingStep===0?'hidden':'visible';
  if(nextBtn)nextBtn.textContent=_onboardingStep===ONBOARDING_STEPS.length-1?'Get Started':'Next';
}

// R8: RRULE-lite recurrence -- daily/weekly/monthly, interval N. Returns the
// next due date (YYYY-MM-DD) or null if recurrence/due is missing/malformed.
function _nextRecurrenceDate(dueStr,recurrence){
  if(!dueStr||!recurrence||!recurrence.freq)return null;
  var d=new Date(dueStr+'T00:00:00');
  if(isNaN(d.getTime()))return null;
  // Completed late (due date already in the past): count forward from today
  // instead of the stale due date, so the next occurrence isn't born overdue.
  var today=new Date(todayStr()+'T00:00:00');
  if(d.getTime()<today.getTime())d=today;
  var n=recurrence.interval||1;
  var origDay=d.getDate();
  if(recurrence.freq==='daily')d.setDate(d.getDate()+n);
  else if(recurrence.freq==='weekly')d.setDate(d.getDate()+7*n);
  else if(recurrence.freq==='monthly'){
    // setMonth overflows into the following month when the target month is
    // shorter (Jan 31 + 1mo -> Mar 3, not Feb 28) -- clamp to the target
    // month's actual last day instead.
    d.setDate(1);
    d.setMonth(d.getMonth()+n);
    var lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(origDay,lastDay));
  }
  else return null;
  return _dayKey(d);
}
// Push the next occurrence of a completed recurring task/subtask. Called from
// the completion path (never on delete) -- completing IS the "done, schedule
// the next one" signal; deleting a recurring item just deletes it, no re-spawn.
function _materializeRecurrence(item,pushFn){
  if(!item||!item.recurrence||!item.due)return;
  var nextDue=_nextRecurrenceDate(item.due,item.recurrence);
  if(!nextDue)return;
  pushFn(nextDue);
}

function getCurrentTier(pts){
  pts=pts||0;
  for(var i=TIER_THRESHOLDS.length-1;i>=0;i--){
    if(pts>=TIER_THRESHOLDS[i].min)return TIER_THRESHOLDS[i];
  }
  return TIER_THRESHOLDS[0];
}

function getNextTier(pts){
  var cur=getCurrentTier(pts);
  var idx=TIER_THRESHOLDS.findIndex(function(t){return t.name===cur.name;});
  return TIER_THRESHOLDS[idx+1]||null;
}

function checkMonthReset(){
  var nowKey=_monthKey();
  if(state.points.monthKey!==nowKey){
    // Carry over lifetime, reset current
    state.points.lifetimeTotal=(state.points.lifetimeTotal||0)+(state.points.current||0);
    state.points.current=0;
    state.points.monthKey=nowKey;
    state.points.lastTier='bronze';
    // Trim totalsByDay to last 90 days -- but fold anything falling off the
    // window into a permanent per-month archive first, so the Lifetime view
    // keeps its monthly breakdown instead of losing it to a single running total.
    var cutoff=new Date();cutoff.setDate(cutoff.getDate()-90);
    var cutKey=_dayKey(cutoff);
    Object.keys(state.points.totalsByDay).forEach(function(k){
      if(k<cutKey){
        var mk=k.slice(0,7);
        state.points.monthlyTotals[mk]=(state.points.monthlyTotals[mk]||0)+state.points.totalsByDay[k];
        delete state.points.totalsByDay[k];
      }
    });
    if(!state.panelUseLog)state.panelUseLog={};
    if(!state.usageMonthlyTotals)state.usageMonthlyTotals={};
    Object.keys(state.panelUseLog).forEach(function(k){
      if(k<cutKey){
        var umk=k.slice(0,7);
        var dayTotal=Object.keys(state.panelUseLog[k]).reduce(function(sum,src){return sum+state.panelUseLog[k][src];},0);
        state.usageMonthlyTotals[umk]=(state.usageMonthlyTotals[umk]||0)+dayTotal;
        delete state.panelUseLog[k];
      }
    });
    save();
  }
}

function awardDailyLogin(){
  var today=_dayKey();
  if(state.points.lastLoginDate!==today){
    var prevDate=state.points.lastLoginDate;
    state.points.lastLoginDate=today;
    addPoints('daily_login');
    // R9: a gentle nudge after a real gap -- never a count of missed days.
    // Matches the house style of signal-gated, non-moralizing copy (see
    // _haltTrendLine). Local-midnight date math throughout -- never
    // new Date('YYYY-MM-DD'), see CLAUDE.md's sync-invariants section.
    if(prevDate){
      var pd=prevDate.split('-'),td=today.split('-');
      var prevMs=new Date(parseInt(pd[0],10),parseInt(pd[1],10)-1,parseInt(pd[2],10)).getTime();
      var todayMs=new Date(parseInt(td[0],10),parseInt(td[1],10)-1,parseInt(td[2],10)).getTime();
      var daysSince=Math.round((todayMs-prevMs)/86400000);
      if(daysSince>=3&&typeof toast==='function'){
        // Slight delay so this doesn't collide with/get clipped by other
        // startup toasts (e.g. initPanelVisibility's "New panels available!").
        setTimeout(function(){toast('Welcome back');},1500);
      }
    }
  }
}

function addPoints(source,sourceEl){
  if(!state.points)state.points={current:0,monthKey:_monthKey(),lastTier:'bronze',totalsByDay:{},lastLoginDate:'',lifetimeTotal:0};
  checkMonthReset();
  var amount=POINT_VALUES[source]||0;
  if(amount<=0)return;
  
  var prevTier=getCurrentTier(state.points.current);
  state.points.current+=amount;
  var newTier=getCurrentTier(state.points.current);
  
  // Track daily
  var today=_dayKey();
  state.points.totalsByDay[today]=(state.points.totalsByDay[today]||0)+amount;
  
  save();
  renderPointsBadge();
  
  // Floating popup
  showPointFloater(amount,sourceEl);
  
  // Tier-up celebration
  if(newTier.name!==prevTier.name){
    state.points.lastTier=newTier.name;
    save();
    setTimeout(function(){triggerTierUp(newTier);},300);
  }
}

function showPointFloater(amount,sourceEl){
  if(state.hidePoints)return; // F6: hide-toggle suppresses the celebratory UI, not the tally
  var container=document.getElementById('pointPopupContainer');
  if(!container)return;
  var floater=document.createElement('div');
  floater.className='point-popup-floater';
  floater.textContent='+'+amount;
  
  // Position - near source element if provided, otherwise near badge
  var x,y;
  if(sourceEl&&sourceEl.getBoundingClientRect){
    var rect=sourceEl.getBoundingClientRect();
    x=rect.left+rect.width/2;
    y=rect.top;
  }else{
    var badge=document.getElementById('pointsBadge');
    if(badge){
      var br=badge.getBoundingClientRect();
      x=br.left+br.width/2;
      y=br.bottom;
    }else{x=window.innerWidth/2;y=80;}
  }
  floater.style.left=(x-15)+'px';
  floater.style.top=y+'px';
  container.appendChild(floater);
  setTimeout(function(){if(floater.parentNode)floater.parentNode.removeChild(floater);},1500);
}

function renderPointsBadge(){
  if(!state.points)return;
  checkMonthReset();
  var badge=document.getElementById('pointsBadge');
  var iconEl=document.getElementById('ptTierIcon');
  var valEl=document.getElementById('ptValue');
  if(!badge||!valEl)return;
  
  var tier=getCurrentTier(state.points.current);
  var classes=['tier-bronze','tier-silver','tier-gold','tier-diamond','tier-mythic'];
  classes.forEach(function(c){badge.classList.remove(c);});
  badge.classList.add('tier-'+tier.name);
  if(iconEl)iconEl.textContent=tier.icon;
  valEl.textContent=state.points.current;
}

function togglePointsPopup(){
  var pop=document.getElementById('pointsPopup');
  if(!pop)return;
  if(pop.style.display==='block'){pop.style.display='none';return;}
  renderPointsPopup();
  pop.style.display='block';
  // Click-outside to close
  setTimeout(function(){
    var handler=function(e){
      if(!pop.contains(e.target)&&!document.getElementById('pointsBadge').contains(e.target)){
        pop.style.display='none';
        document.removeEventListener('click',handler);
      }
    };
    document.addEventListener('click',handler);
  },10);
}

function renderPointsPopup(){
  var pop=document.getElementById('pointsPopup');
  if(!pop)return;
  var pts=state.points.current||0;
  var tier=getCurrentTier(pts);
  var next=getNextTier(pts);
  var today=_dayKey();
  var todayPts=state.points.totalsByDay[today]||0;
  
  // Week total = last 7 days including today
  var weekPts=0;
  for(var i=0;i<7;i++){
    var d=new Date();d.setDate(d.getDate()-i);
    weekPts+=(state.points.totalsByDay[_dayKey(d)]||0);
  }
  
  var progressPct=0;
  var progressLabel='';
  if(next){
    var range=next.min-tier.min;
    var into=pts-tier.min;
    progressPct=Math.min(100,Math.round((into/range)*100));
    progressLabel=(next.min-pts)+' to '+next.label+' '+next.icon;
  }else{
    progressPct=100;
    progressLabel='Mythic -- top tier!';
  }
  
  var html='<div class="points-popup-section">'
    +'<div class="points-popup-tier-row" style="color:'+tier.color+';">'
    +'<span style="font-size:20px;">'+tier.icon+'</span> '+tier.label
    +'</div>'
    +'<div class="points-popup-progress"><div class="points-popup-progress-fill" style="width:'+progressPct+'%;background:'+tier.color+';"></div></div>'
    +'<div class="points-popup-next">'+progressLabel+'</div>'
    +'</div>'
    +'<div class="points-popup-section">'
    +'<div class="points-popup-row"><span class="points-popup-label">Today</span><span class="points-popup-value">'+todayPts+' Presence</span></div>'
    +'<div class="points-popup-row"><span class="points-popup-label">Last 7 days</span><span class="points-popup-value">'+weekPts+' Presence</span></div>'
    +'<div class="points-popup-row"><span class="points-popup-label">This month</span><span class="points-popup-value">'+pts+' Presence</span></div>'
    +'</div>'
    +'<div class="points-popup-section">'
    +'<div class="points-popup-row"><span class="points-popup-label">Lifetime</span><span class="points-popup-value">'+(state.points.lifetimeTotal+pts)+' Presence</span></div>'
    +'</div>'
    +'<div class="points-popup-actions">'
    +'<button class="btn btn-sm" onclick="togglePointsPopup();openPointsInsights();">📈 View Insights</button>'
    +'</div>';
  pop.innerHTML=html;
}

// =======================================
// POINTS INSIGHTS OVERLAY
// Correlates points, mood/energy, and panel/tool usage over week/month/lifetime
// so the user can see whether more Centerpost use tracks with better mood.
// =======================================
var _piActivePeriod='week';
var _PI_ENERGY_NUM={high:4,good:3,low:2,crashed:1};
var _PI_MOOD_NUM={focused:4,calm:3,scattered:2,anxious:1};

function openPointsInsights(){
  document.getElementById('pointsInsightsModal').classList.add('open');
  renderPointsInsights(_piActivePeriod);
}
function closePointsInsights(){
  document.getElementById('pointsInsightsModal').classList.remove('open');
}

function _usageTotalForDay(dayKey){
  var day=state.panelUseLog[dayKey];
  if(!day)return 0;
  return Object.keys(day).reduce(function(sum,src){return sum+day[src];},0);
}

// Returns an ordered array of {label,dateKey,points,energy,mood,usage} rows
// for 'week' (7 days), 'month' (30 days), or 'lifetime' (one row per month).
function getInsightsSeries(period){
  if(period==='lifetime'){
    var monthKeys={};
    Object.keys(state.points.monthlyTotals).forEach(function(k){monthKeys[k]=true;});
    Object.keys(state.usageMonthlyTotals).forEach(function(k){monthKeys[k]=true;});
    Object.keys(state.points.totalsByDay).forEach(function(k){monthKeys[k.slice(0,7)]=true;});
    Object.keys(state.panelUseLog).forEach(function(k){monthKeys[k.slice(0,7)]=true;});
    (state.moodLog||[]).forEach(function(e){if(e.date)monthKeys[e.date.slice(0,7)]=true;});
    var months=Object.keys(monthKeys).sort();
    return months.map(function(mk){
      var pts=(state.points.monthlyTotals[mk]||0);
      Object.keys(state.points.totalsByDay).forEach(function(k){if(k.slice(0,7)===mk)pts+=state.points.totalsByDay[k];});
      var usage=(state.usageMonthlyTotals[mk]||0);
      Object.keys(state.panelUseLog).forEach(function(k){if(k.slice(0,7)===mk)usage+=_usageTotalForDay(k);});
      var energyVals=[],moodVals=[];
      (state.moodLog||[]).forEach(function(e){
        if(e.date&&e.date.slice(0,7)===mk){
          if(e.energy&&_PI_ENERGY_NUM[e.energy])energyVals.push(_PI_ENERGY_NUM[e.energy]);
          if(e.mood&&_PI_MOOD_NUM[e.mood])moodVals.push(_PI_MOOD_NUM[e.mood]);
        }
      });
      var avg=function(arr){return arr.length?arr.reduce(function(a,b){return a+b;},0)/arr.length:null;};
      var d=new Date(mk+'-15T12:00:00Z');
      return {label:d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}),dateKey:mk,points:pts,energy:avg(energyVals),mood:avg(moodVals),usage:usage};
    });
  }

  var days=period==='month'?30:7;
  var rows=[];
  var today=new Date();
  for(var i=days-1;i>=0;i--){
    var d=new Date(today);d.setDate(d.getDate()-i);
    var dk=_dayKey(d);
    var entry=(state.moodLog||[]).find(function(e){return e.date===dk;});
    rows.push({
      label:i===0?'Today':(d.getMonth()+1)+'/'+d.getDate(),
      dateKey:dk,
      points:state.points.totalsByDay[dk]||0,
      energy:entry&&entry.energy?_PI_ENERGY_NUM[entry.energy]:null,
      mood:entry&&entry.mood?_PI_MOOD_NUM[entry.mood]:null,
      usage:_usageTotalForDay(dk)
    });
  }
  return rows;
}

// Plain-English correlation callout: splits rows into more-active/less-active
// halves by usage and compares average mood between them.
function getUsageMoodInsight(rows){
  var withMood=rows.filter(function(r){return r.mood!==null&&r.mood!==undefined;});
  if(withMood.length<4)return 'Keep logging mood and using Centerpost -- insights unlock after a few more days of data.';
  var sorted=rows.slice().sort(function(a,b){return b.usage-a.usage;});
  var half=Math.floor(sorted.length/2);
  var moreActive=sorted.slice(0,half).filter(function(r){return r.mood!==null;});
  var lessActive=sorted.slice(sorted.length-half).filter(function(r){return r.mood!==null;});
  if(moreActive.length<2||lessActive.length<2)return 'Keep logging mood and using Centerpost -- insights unlock after a few more days of data.';
  var avg=function(arr){return arr.reduce(function(s,r){return s+r.mood;},0)/arr.length;};
  var moreAvg=avg(moreActive),lessAvg=avg(lessActive);
  var diff=moreAvg-lessAvg;
  if(Math.abs(diff)<0.15)return 'Your mood looks fairly steady regardless of how much you use Centerpost on a given day.';
  if(diff>0)return 'On your most active days, mood averaged '+moreAvg.toFixed(1)+'/4 vs '+lessAvg.toFixed(1)+'/4 on your least active days -- more engagement is tracking with a better mood.';
  return 'On your least active days, mood averaged '+lessAvg.toFixed(1)+'/4 vs '+moreAvg.toFixed(1)+'/4 on your most active days -- worth noticing what is different on the low-use days.';
}

function getProductivityTips(rows){
  var tips=[];
  var withUsage=rows.filter(function(r){return r.usage>0;});
  var avgUsage=withUsage.length?withUsage.reduce(function(s,r){return s+r.usage;},0)/rows.length:0;
  var loggedDays=rows.filter(function(r){return r.mood!==null;}).length;
  if(loggedDays<rows.length*0.5){
    tips.push('You are only logging mood/energy on about '+Math.round(loggedDays/rows.length*100)+'% of days shown -- logging daily (even a quick tap) makes these patterns much clearer.');
  }
  if(avgUsage>0&&avgUsage<2){
    tips.push('Usage is light in this window. Try a single 25-minute focus-timer session on your next task -- it is a quick, low-friction way to re-engage and earn Presence.');
  }
  var lowUsageLowMood=rows.filter(function(r){return r.usage<=1&&r.mood!==null&&r.mood<=2;});
  if(lowUsageLowMood.length>=2){
    tips.push('Low-usage days tend to coincide with lower mood -- on tough days, body-doubling (working alongside the app open, even without finishing tasks) can help more than pushing through alone.');
  }
  if(tips.length<2)tips.push('Breaking work into subtasks earns Presence more often than waiting for one big task to finish -- frequent small wins are proven to help sustain ADHD motivation better than large infrequent ones.');
  return tips.slice(0,2);
}

function renderInsightsChart(rows){
  var wrap=document.getElementById('piChartWrap');
  var noData=document.getElementById('piNoData');
  if(!wrap)return;
  var hasAny=rows.some(function(r){return r.points>0||r.usage>0||r.mood!==null||r.energy!==null;});
  if(noData)noData.style.display=hasAny?'none':'block';
  wrap.style.display=hasAny?'block':'none';
  if(!hasAny){wrap.innerHTML='';return;}

  var W=640,H=220,padL=20,padR=20,padT=16,padB=34;
  var cW=W-padL-padR,cH=H-padT-padB;
  var n=rows.length;
  var stepX=n>1?cW/(n-1):cW;
  function xp(i){return padL+i*stepX;}
  function yp1to4(v){return padT+cH-((v-1)/3)*cH;}

  var maxPoints=Math.max(1,Math.max.apply(null,rows.map(function(r){return r.points;})));
  var maxUsage=Math.max(1,Math.max.apply(null,rows.map(function(r){return r.usage;})));
  var barW=Math.max(3,Math.min(18,stepX*0.55));

  var svg='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">';

  [1,2,3,4].forEach(function(v){
    var y=yp1to4(v);
    svg+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="rgba(128,128,128,0.12)" stroke-width="1"/>';
  });

  // Points bars (own scale, drawn from the baseline)
  rows.forEach(function(r,i){
    if(r.points<=0)return;
    var h=(r.points/maxPoints)*cH;
    var x=xp(i)-barW/2,y=padT+cH-h;
    svg+='<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h+'" rx="2" fill="#c77dba" opacity="0.55"><title>'+r.label+': '+r.points+' Presence</title></rect>';
  });

  // Panel/tool usage line (own scale)
  var uPts=rows.map(function(r,i){return {x:xp(i),y:padT+cH-((r.usage/maxUsage)*cH),i:i,v:r.usage};});
  for(var u=1;u<uPts.length;u++){
    svg+='<line x1="'+uPts[u-1].x+'" y1="'+uPts[u-1].y+'" x2="'+uPts[u].x+'" y2="'+uPts[u].y+'" stroke="#5fbf80" stroke-width="2" stroke-dasharray="4,3" opacity="0.85"/>';
  }
  uPts.forEach(function(p){
    if(p.v<=0)return;
    svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="#5fbf80"><title>'+rows[p.i].label+': '+p.v+' uses</title></circle>';
  });

  // Energy line (1-4 scale, gaps skipped)
  var ePts=[];
  rows.forEach(function(r,i){if(r.energy!==null&&r.energy!==undefined)ePts.push({x:xp(i),y:yp1to4(r.energy),i:i,v:r.energy});});
  for(var e=1;e<ePts.length;e++){
    if(ePts[e].i-ePts[e-1].i<=1)
      svg+='<line x1="'+ePts[e-1].x+'" y1="'+ePts[e-1].y+'" x2="'+ePts[e].x+'" y2="'+ePts[e].y+'" stroke="#d4a853" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>';
  }
  ePts.forEach(function(p){
    svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#d4a853" stroke="var(--surface-raised)" stroke-width="2"><title>'+rows[p.i].label+' energy: '+p.v.toFixed(1)+'/4</title></circle>';
  });

  // Mood line (1-4 scale, gaps skipped)
  var mPts=[];
  rows.forEach(function(r,i){if(r.mood!==null&&r.mood!==undefined)mPts.push({x:xp(i),y:yp1to4(r.mood),i:i,v:r.mood});});
  for(var m=1;m<mPts.length;m++){
    if(mPts[m].i-mPts[m-1].i<=1)
      svg+='<line x1="'+mPts[m-1].x+'" y1="'+mPts[m-1].y+'" x2="'+mPts[m].x+'" y2="'+mPts[m].y+'" stroke="#5f8fc7" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>';
  }
  mPts.forEach(function(p){
    svg+='<circle cx="'+p.x+'" cy="'+p.y+'" r="4" fill="#5f8fc7" stroke="var(--surface-raised)" stroke-width="2"><title>'+rows[p.i].label+' mood: '+p.v.toFixed(1)+'/4</title></circle>';
  });

  // X-axis labels
  var step=n<=7?1:n<=14?2:Math.ceil(n/10);
  rows.forEach(function(r,i){
    if(i%step===0||i===n-1){
      svg+='<text x="'+xp(i)+'" y="'+(H-10)+'" text-anchor="middle" font-size="9" fill="rgba(128,128,128,0.7)">'+r.label+'</text>';
    }
  });

  svg+='</svg>';
  wrap.innerHTML=svg;
}

function renderPointsInsights(period){
  _piActivePeriod=period;
  var wkBtn=document.getElementById('piBtnWeek'),moBtn=document.getElementById('piBtnMonth'),lfBtn=document.getElementById('piBtnLifetime');
  if(wkBtn)wkBtn.classList.toggle('active',period==='week');
  if(moBtn)moBtn.classList.toggle('active',period==='month');
  if(lfBtn)lfBtn.classList.toggle('active',period==='lifetime');

  var rows=getInsightsSeries(period);
  renderInsightsChart(rows);

  var insightEl=document.getElementById('piInsightText');
  if(insightEl)insightEl.textContent=getUsageMoodInsight(rows);

  var tipsEl=document.getElementById('piTips');
  if(tipsEl){
    var tips=getProductivityTips(rows);
    tipsEl.innerHTML=tips.map(function(t){return '<div class="pi-tip">'+'💡 '+t+'</div>';}).join('');
  }

  var stateEl=document.getElementById('piStateCard');
  if(stateEl)stateEl.innerHTML=_renderStateCard(period);
}

// R6: descriptive counts only -- breathwork/grounding/HALT+ usage for the
// selected period. No inference, no "you should," no comparisons. Small-n
// guarded (nothing renders until there's at least one entry of a kind).
function _renderStateCard(period){
  var days=period==='week'?7:period==='month'?30:36500; // lifetime = effectively unbounded
  var entries=_checkinsSince(days);
  if(entries.length===0)return '';
  var breath=entries.filter(function(c){return c.type==='breath';});
  var grounding=entries.filter(function(c){return c.type==='grounding';});
  var halt=entries.filter(function(c){return c.type==='halt';});
  var urge=entries.filter(function(c){return c.type==='urge';});

  var rows=[];
  if(breath.length)rows.push('<div class="pi-state-row"><span class="pi-state-icon">🟧</span>Breathwork: <strong>'+breath.length+'</strong> session'+(breath.length!==1?'s':'')+'</div>');
  if(grounding.length)rows.push('<div class="pi-state-row"><span class="pi-state-icon">🧘</span>Grounding techniques: <strong>'+grounding.length+'</strong> completed</div>');
  if(urge.length){
    var passed=urge.filter(function(c){return c.outcome==='passed';}).length;
    rows.push('<div class="pi-state-row"><span class="pi-state-icon">✋</span>Urges logged: <strong>'+urge.length+'</strong> — passed <strong>'+passed+'</strong> of '+urge.length+'</div>');
  }
  if(halt.length){
    var freq={};
    halt.forEach(function(c){(c.items||[]).forEach(function(k){freq[k]=(freq[k]||0)+1;});});
    var topKey=null,topCount=0;
    Object.keys(freq).forEach(function(k){if(freq[k]>topCount){topCount=freq[k];topKey=k;}});
    var topItem=topKey?HALT_ITEMS.find(function(i){return i.key===topKey;}):null;
    var suffix=(topItem&&topCount>=2)?' — most often "'+topItem.label+'" ('+topCount+'x)':'';
    rows.push('<div class="pi-state-row"><span class="pi-state-icon">🛑</span>HALT+ check-ins: <strong>'+halt.length+'</strong>'+suffix+'</div>');
  }
  if(rows.length===0)return '';
  return '<div class="pi-state-title">State &amp; Regulation</div>'+rows.join('');
}

// R16 Phase A: Weekly Review. A purpose-built, on-demand summary -- deliberately
// reuses existing Insights data functions (getInsightsSeries/getUsageMoodInsight/
// _renderStateCard) rather than recomputing anything, plus the two genuinely new
// pieces (tasks completed, routine consistency). Same "descriptive counts only,
// small-n guarded" convention as _renderStateCard: an empty-state message when
// there's nothing to show yet, rather than a mostly-blank modal.
function openWeeklyReview(){
  var modal=document.getElementById('weeklyReviewModal');
  if(!modal)return;
  var body=document.getElementById('weeklyReviewBody');
  if(body)body.innerHTML=_renderWeeklyReview();
  modal.classList.add('open');
  _blurDashboard();
  _trackEvent('tool_use','weekly_review','Weekly Review');
}
function closeWeeklyReview(){
  var modal=document.getElementById('weeklyReviewModal');
  if(!modal)return;
  modal.classList.remove('open');
  _unblurDashboard();
}
function _renderWeeklyReview(){
  var days=7;
  var rows=getInsightsSeries('week');
  var totalPoints=rows.reduce(function(sum,r){return sum+(r.points||0);},0);
  var tasks=_tasksCompletedSince(days);
  var projectNames={};
  tasks.forEach(function(t){if(t.projectName)projectNames[t.projectName]=true;});
  var projectCount=Object.keys(projectNames).length;
  var rc=_routineConsistencySince(days);
  var stateCard=_renderStateCard('week');

  // NOTE: getUsageMoodInsight() always returns a non-empty string (even its
  // own "not enough data yet" filler text) -- unlike _renderStateCard, it has
  // no "return '' when empty" convention, so it's deliberately EXCLUDED from
  // this check. Using it here would make hasAnything always true and the
  // empty-state below would never fire.
  var hasAnything=totalPoints>0||tasks.length>0||!!stateCard
    ||rc.morning.trackedDays>0||rc.evening.trackedDays>0;
  if(!hasAnything){
    return '<div class="wr-empty">Not enough activity yet this week. Check back after using Centerpost a few more days.</div>';
  }
  var moodLine=getUsageMoodInsight(rows);

  var rangeLabel=(rows.length?rows[0].label:'')+' – '+(rows.length?rows[rows.length-1].label:'');
  var html='<div class="wr-range">'+rangeLabel+'</div>';

  if(totalPoints>0)html+='<div class="wr-row"><span class="wr-icon">🏅</span><strong>'+totalPoints+'</strong> Presence points this week</div>';

  if(tasks.length>0){
    html+='<div class="wr-row"><span class="wr-icon">✅</span><strong>'+tasks.length+'</strong> task'+(tasks.length!==1?'s':'')+' completed'
        +(projectCount?' across <strong>'+projectCount+'</strong> project'+(projectCount!==1?'s':''):'')
        +'</div>';
  }

  if(moodLine)html+='<div class="wr-row wr-mood">'+esc(moodLine)+'</div>';

  if(rc.morning.trackedDays>0)html+='<div class="wr-row"><span class="wr-icon">☀</span>Morning routine: <strong>'+rc.morning.completeDays+'</strong> of '+rc.morning.total+' days</div>';
  if(rc.evening.trackedDays>0)html+='<div class="wr-row"><span class="wr-icon">🌙</span>Evening routine: <strong>'+rc.evening.completeDays+'</strong> of '+rc.evening.total+' days</div>';

  if(stateCard)html+='<div class="wr-state-wrap">'+stateCard+'</div>';

  html+='<div class="wr-journal-cta"><button class="btn" onclick="closeWeeklyReview();openJournal();">📖 Open Journal to reflect</button></div>';
  return html;
}

function triggerTierUp(tier){
  if(state.hidePoints)return; // F6: hide-toggle suppresses the celebratory UI, not the tally
  var overlay=document.getElementById('fireworksOverlay');
  if(!overlay)return;
  overlay.classList.add('show');
  overlay.innerHTML='';
  
  // Banner
  var banner=document.createElement('div');
  banner.className='tier-up-banner';
  banner.style.color=tier.color;
  banner.innerHTML=tier.icon+' '+tier.label.toUpperCase()+' TIER!';
  overlay.appendChild(banner);
  
  // Fireworks bursts at random positions
  var colors=['#ffd700','#ff6b9d','#7fdfff','#a0f0a0','#ffaa44','#c77dba'];
  var bursts=6;
  for(var b=0;b<bursts;b++){
    setTimeout(function(){
      var cx=Math.random()*window.innerWidth;
      var cy=Math.random()*window.innerHeight*0.7+window.innerHeight*0.1;
      var color=colors[Math.floor(Math.random()*colors.length)];
      _spawnBurst(overlay,cx,cy,color);
    },b*250);
  }
  
  // Auto-cleanup
  setTimeout(function(){
    overlay.classList.remove('show');
    overlay.innerHTML='';
  },2800);
}

function _spawnBurst(parent,cx,cy,color){
  var particles=24;
  for(var i=0;i<particles;i++){
    var p=document.createElement('div');
    p.className='firework-particle';
    var angle=(i/particles)*Math.PI*2;
    var distance=80+Math.random()*60;
    var tx=Math.cos(angle)*distance;
    var ty=Math.sin(angle)*distance;
    p.style.left=cx+'px';
    p.style.top=cy+'px';
    p.style.background=color;
    p.style.boxShadow='0 0 6px '+color;
    p.style.setProperty('--tx',tx+'px');
    p.style.setProperty('--ty',ty+'px');
    parent.appendChild(p);
    // Cleanup
    setTimeout(function(el){return function(){if(el.parentNode)el.parentNode.removeChild(el);};}(p),1600);
  }
}

// =======================================
// TASK TIMER (elapsed stopwatch)
// =======================================
function ttStart(){}
function ttPause(){}
function ttReset(){}

// -- Custom confirm dialog -- replaces all browser confirm() calls ------
var _confirmOnDo=null,_confirmOnAlt=null;
function _confirm(msg,onDo,opts){
  opts=opts||{};
  _confirmOnDo=onDo||null;_confirmOnAlt=opts.onAlt||null;
  var iconEl=document.getElementById('confirmDialogIcon');
  var msgEl=document.getElementById('confirmDialogMsg');
  var okBtn=document.getElementById('confirmOkBtn');
  var altBtn=document.getElementById('confirmAltBtn');
  var cancelBtn=document.getElementById('confirmCancelBtn');
  var bd=document.getElementById('confirmDialogBd');
  var iconName=opts.icon||(opts.destructive?'ti-alert-circle':'ti-help-circle');
  iconEl.innerHTML='<i class="ti '+iconName+'" aria-hidden="true"></i>';
  iconEl.className='confirm-dialog-icon'+(opts.destructive?' cdx-destructive':opts.warn?' cdx-warn':'');
  msgEl.textContent=msg;
  okBtn.textContent=opts.confirmText||(opts.destructive?'Delete':'Confirm');
  okBtn.className='btn '+(opts.destructive?'btn-danger':'btn-accent-solid');
  if(opts.altText){altBtn.textContent=opts.altText;altBtn.style.display='';}
  else{altBtn.style.display='none';}
  cancelBtn.style.display=opts.noCancel?'none':'';
  bd.onclick=opts.noCancel?null:_confirmCancel;
  document.getElementById('confirmDialog').classList.add('open');
}
function _confirmDo(){
  document.getElementById('confirmDialog').classList.remove('open');
  var cb=_confirmOnDo;_confirmOnDo=null;_confirmOnAlt=null;if(cb)cb();
}
function _confirmAlt(){
  document.getElementById('confirmDialog').classList.remove('open');
  var cb=_confirmOnAlt;_confirmOnDo=null;_confirmOnAlt=null;if(cb)cb();
}
function _confirmCancel(){
  document.getElementById('confirmDialog').classList.remove('open');
  _confirmOnDo=null;_confirmOnAlt=null;
}
// Wrapper for gcalDisconnect confirm (called from rendered HTML strings)
function _confirmGcalDisconnect(){
  _confirm('Disconnect Google Calendar? Synced events stay in Google but Centerpost will forget which ones it created.',gcalDisconnect,{confirmText:'Disconnect',icon:'ti-calendar-off'});
}

function openEnergyModal(){
  document.getElementById('energyModal').classList.add('open');
  _blurDashboard();
  // Restore selected pill states
  if(state.energy){const pills=document.querySelectorAll('#energyPills .em-pill');['high','good','low','crashed'].forEach((v,i)=>{pills[i]&&pills[i].classList.toggle('selected',v===state.energy);});}
  if(state.mood){const pills=document.querySelectorAll('#moodPills .em-pill');['focused','scattered','anxious','calm'].forEach((v,i)=>{pills[i]&&pills[i].classList.toggle('selected',v===state.mood);});}
  showStateAdvice();
}
function closeEnergyModal(){
  document.getElementById('energyModal').classList.remove('open');
  _unblurDashboard();
}

function openBreathworkModal(){
  document.getElementById('breathworkModal').classList.add('open');
  _blurDashboard();
  // R3 stage 1: no decision wall at the door (F12). A blank "Choose a
  // technique..." dropdown asks a dysregulated user to make a choice before
  // anything happens -- exactly the moment the app's own premise says choice
  // is hardest. Preselect the Physiological Sigh (shortest at ~1 min, and per
  // its own citation the fastest known voluntary downshift) and render its
  // description so Begin Session is visible with ZERO taps. The dropdown
  // stays for switching; a selection the user already made this session is
  // respected, not overwritten.
  var sel=document.getElementById('breathSelect');
  if(sel&&!sel.value)sel.value='sigh';
  showBreathDesc();
}
function closeBreathworkModal(){
  document.getElementById('breathworkModal').classList.remove('open');
  _unblurDashboard();
}
function startBreathworkFromModal(){
  // Close the picker but keep dashboard blurred (breath-overlay has its own dark backdrop)
  document.getElementById('breathworkModal').classList.remove('open');
  startBreathwork();
}

// =======================================
// TIMER MODAL
// =======================================
function openTimerModal(){
  document.getElementById('timerModal').classList.add('open');
  _blurDashboard();
  _syncTimerPresetBtns();
}
function closeTimerModal(){
  document.getElementById('timerModal').classList.remove('open');
  _unblurDashboard();
}
function setTimerPreset(){}
function setTimerPresetDirect(mins,btn){
  document.getElementById('timerPreset').value=String(mins);
  setTimerPreset();
  _syncTimerPresetBtns();
}
function _syncTimerPresetBtns(){
  const val=document.getElementById('timerPreset').value;
  ['25','15','5','45'].forEach(function(v){
    const b=document.getElementById('tp'+v);
    if(b)b.classList.toggle('active',v===val);
  });
}

// =======================================
// JOURNAL
// =======================================
var _journalUnlocked=false;
var _journalMode='unlock';   // 'unlock' | 'migrate' | 'create'
var _journalKey=null;        // AES-GCM CryptoKey while unlocked (memory only)
var _journalMeta=null;       // {salt,iterations,verifier} from the journal doc
var _journalEntries=[];      // [{id,date,projId,projName,mood,enc}] at rest
var _journalPlain={};        // id -> decrypted text (memory only, while unlocked)
var _pinBuffer='';
var _setPinBuffer='';
var _setPinStage=0; // 0=first entry, 1=confirm
var _setPinFirst='';
var _changingPin=false; // true while setting a replacement PIN (re-encrypt)

// ── Journal document I/O (own doc: users/{uid}/data/journal, mirrored to localStorage) ──
function _journalStorageKey(){return 'cpJournal_'+(currentUser?currentUser.uid:'local');}

async function _loadJournalDoc(){
  _journalMeta=null;_journalEntries=[];
  var loaded=null;
  if(firebaseReady&&db&&currentUser){
    try{
      var snap=await db.collection('users').doc(currentUser.uid).collection('data').doc('journal').get();
      if(snap.exists)loaded=snap.data();
    }catch(e){console.log('journal load (cloud) error:',e);}
  }
  if(!loaded){
    try{var s=localStorage.getItem(_journalStorageKey());if(s)loaded=JSON.parse(s);}catch(e){}
  }
  if(loaded){
    if(Array.isArray(loaded.entries))_journalEntries=loaded.entries;
    if(loaded.salt&&loaded.verifier)_journalMeta={salt:loaded.salt,iterations:loaded.iterations||JournalCrypto.PBKDF2_ITERATIONS,verifier:loaded.verifier};
    try{localStorage.setItem(_journalStorageKey(),JSON.stringify({v:1,salt:loaded.salt||'',iterations:loaded.iterations||JournalCrypto.PBKDF2_ITERATIONS,verifier:loaded.verifier||'',entries:_journalEntries}));}catch(e){}
  }
}

async function _saveJournalDoc(){
  var doc={v:1,salt:_journalMeta?_journalMeta.salt:'',iterations:_journalMeta?_journalMeta.iterations:JournalCrypto.PBKDF2_ITERATIONS,verifier:_journalMeta?_journalMeta.verifier:'',entries:_journalEntries};
  try{localStorage.setItem(_journalStorageKey(),JSON.stringify(doc));}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      var cloud={};for(var k in doc)cloud[k]=doc[k];
      cloud.updated=firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('users').doc(currentUser.uid).collection('data').doc('journal').set(cloud);
    }catch(e){console.log('journal save (cloud) error:',e);if(typeof toast==='function')toast('Journal saved locally (cloud sync failed)');}
  }
}

async function _decryptAllEntries(){
  _journalPlain={};
  for(var i=0;i<_journalEntries.length;i++){
    var e=_journalEntries[i];
    try{_journalPlain[e.id]=await JournalCrypto.decryptText(_journalKey,e.enc);}
    catch(_){_journalPlain[e.id]='[unable to decrypt]';}
  }
}

// First-time / legacy setup: derive a key, and NON-DESTRUCTIVELY copy any
// existing plaintext entries into the encrypted doc. The old state.journal /
// state.journalPin are left intact as a safety net (scrubbed in Phase 3).
async function _journalSetupAndMigrate(pin){
  var salt=JournalCrypto.randomSaltB64();
  var iterations=JournalCrypto.PBKDF2_ITERATIONS;
  var key=await JournalCrypto.deriveKey(pin,salt,iterations);
  var verifier=await JournalCrypto.makeVerifier(key);
  _journalMeta={salt:salt,iterations:iterations,verifier:verifier};
  _journalKey=key;
  var legacy=(state.journal||[]);
  var migrated=[];
  _journalPlain={};
  for(var i=0;i<legacy.length;i++){
    var e=legacy[i];
    var enc=await JournalCrypto.encryptText(key,e.text||'');
    var id=e.id||('j'+Date.now()+'_'+i);
    migrated.push({id:id,date:e.date||new Date().toISOString(),projId:e.projId||'',projName:e.projName||'',mood:e.mood||'',enc:enc});
    _journalPlain[id]=e.text||'';
  }
  _journalEntries=migrated.concat(_journalEntries||[]);
  await _saveJournalDoc();
}

// Change PIN: re-encrypt every entry from the in-memory plaintext under a new key.
async function _journalRekey(newPin){
  var salt=JournalCrypto.randomSaltB64();
  var iterations=JournalCrypto.PBKDF2_ITERATIONS;
  var key=await JournalCrypto.deriveKey(newPin,salt,iterations);
  var verifier=await JournalCrypto.makeVerifier(key);
  var re=[];
  for(var i=0;i<_journalEntries.length;i++){
    var e=_journalEntries[i];
    var txt=_journalPlain[e.id]!=null?_journalPlain[e.id]:'';
    re.push({id:e.id,date:e.date,projId:e.projId||'',projName:e.projName||'',mood:e.mood||'',enc:await JournalCrypto.encryptText(key,txt)});
  }
  _journalMeta={salt:salt,iterations:iterations,verifier:verifier};
  _journalKey=key;_journalEntries=re;
  await _saveJournalDoc();
}

// ── Open / close ──────────────────────────────────────────────────────
async function openJournal(){
  _journalUnlocked=false;_journalKey=null;_journalPlain={};
  _pinBuffer='';_setPinBuffer='';_setPinStage=0;_setPinFirst='';_changingPin=false;
  document.getElementById('journalOverlay').classList.add('open');
  // R3 stage 4 (F11): journal is a full-screen surface too -- the FAB floated
  // over the PIN pad and the editor's character count. Same immersive rule.
  document.body.classList.add('cp-immersive');
  _blurDashboard();
  document.getElementById('journalMain').style.display='none';
  document.getElementById('journalPinGate').style.display='none';
  document.getElementById('journalSetPin').style.display='none';
  if(!(window.JournalCrypto&&JournalCrypto.isSupported())){
    if(typeof toast==='function')toast('Secure journal unavailable in this browser');
    return;
  }
  await _loadJournalDoc();
  if(_journalMeta){
    _journalMode='unlock';
    _showPinGate('Journal is locked','Enter your PIN to open your journal');
  }else if(state.journalPin){
    _journalMode='migrate';
    _showPinGate('Journal is locked','Enter your PIN to open your journal');
  }else if((state.journal||[]).length){
    _journalMode='create';
    _showSetPin('Create a PIN','Encrypt your '+state.journal.length+' existing '+(state.journal.length===1?'entry':'entries')+'. Choose a 4+ digit PIN.');
  }else{
    _journalMode='create';
    _showSetPin('Create a PIN','Protect your journal with a 4+ digit PIN.');
  }
}

function closeJournal(){
  document.getElementById('journalOverlay').classList.remove('open');
  document.body.classList.remove('cp-immersive');
  _unblurDashboard();
  _journalUnlocked=false;_journalKey=null;_journalPlain={};
  _pinBuffer='';_setPinBuffer='';_setPinStage=0;_setPinFirst='';_changingPin=false;
}

// ── View switching (only reachable once unlocked) ─────────────────────
function _enterUnlocked(){
  _journalUnlocked=true;
  document.getElementById('journalPinGate').style.display='none';
  document.getElementById('journalSetPin').style.display='none';
  document.getElementById('journalMain').style.display='flex';
  document.getElementById('journalEntriesView').style.display='none';
  document.getElementById('journalCompose').style.display='flex';
  document.getElementById('journalViewToggle').classList.remove('active');
  _updateJournalMeta();
  _populateJournalProjDropdowns();
  _scrubLegacyJournal();
  var ta=document.getElementById('journalText');if(ta)ta.focus();
}

// Phase 3: once entries are safely encrypted in their own doc and proven
// decryptable (we only reach here after a successful unlock/migrate), remove
// the legacy plaintext journal + PIN from the main dashboard blob. Guarded so
// we never delete anything that isn't represented in the encrypted set, and
// idempotent (a no-op once the blob is already clean).
function _scrubLegacyJournal(){
  var legacyCount=(state.journal&&state.journal.length)||0;
  var hasLegacyPin=!!state.journalPin;
  if(!legacyCount&&!hasLegacyPin)return;
  if(legacyCount&&_journalEntries.length<legacyCount)return; // safety: encrypted set is smaller — don't scrub
  state.journal=[];
  state.journalPin='';
  save();
}

function _updateJournalMeta(){
  const now=new Date();
  var ds=document.getElementById('journalDateStamp');
  if(ds)ds.textContent=now.toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' — '+now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  var ec=document.getElementById('journalEntryCount');
  if(ec)ec.textContent=_journalEntries.length+' '+(_journalEntries.length===1?'entry':'entries');
  const ta=document.getElementById('journalText');
  if(ta&&!ta._cpBound){ta._cpBound=true;ta.addEventListener('input',function(){document.getElementById('journalCharCount').textContent=ta.value.length+' characters';});}
}

function _populateJournalProjDropdowns(){
  const opts='<option value="">No project tag</option>'+_sortedProjects().map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
  document.getElementById('journalProjTag').innerHTML=opts;
  const fopts='<option value="all">All projects</option>'+_sortedProjects().map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
  document.getElementById('journalFilterProj').innerHTML=fopts;
}

async function saveJournalEntry(){
  if(!_journalKey){if(typeof toast==='function')toast('Unlock the journal first');return;}
  const text=document.getElementById('journalText').value.trim();
  if(!text){toast('Write something first');return;}
  const projId=document.getElementById('journalProjTag').value;
  const mood=document.getElementById('journalMoodTag').value;
  const proj=projId?state.projects.find(p=>p.id===projId):null;
  const id='j'+Date.now();
  var enc;
  try{enc=await JournalCrypto.encryptText(_journalKey,text);}
  catch(e){toast('Could not encrypt entry');return;}
  _journalEntries.unshift({id:id,date:new Date().toISOString(),projId:projId||'',projName:proj?proj.name:'',mood:mood||'',enc:enc});
  _journalPlain[id]=text;
  document.getElementById('journalText').value='';
  document.getElementById('journalCharCount').textContent='0 characters';
  document.getElementById('journalProjTag').value='';
  document.getElementById('journalMoodTag').value='';
  _updateJournalMeta();
  await _saveJournalDoc();
  addPoints('journal');
}

function toggleJournalView(){
  const ev=document.getElementById('journalEntriesView');
  const compose=document.getElementById('journalCompose');
  const btn=document.getElementById('journalViewToggle');
  if(ev.style.display==='none'||!ev.style.display){
    compose.style.display='none';
    ev.style.display='flex';
    btn.classList.add('active');
    renderJournalEntries();
  } else {
    lockJournalEntries();
  }
}

function lockJournalEntries(){
  document.getElementById('journalEntriesView').style.display='none';
  document.getElementById('journalCompose').style.display='flex';
  document.getElementById('journalViewToggle').classList.remove('active');
}

// ── PIN gate (verify / migrate) ──────────────────────────────────────
function _showPinGate(title,sub){
  _pinBuffer='';
  document.getElementById('journalSetPin').style.display='none';
  document.getElementById('journalMain').style.display='none';
  document.getElementById('journalPinGate').style.display='flex';
  var t=document.querySelector('#journalPinGate .journal-pin-title');
  var s=document.querySelector('#journalPinGate .journal-pin-sub');
  if(t)t.textContent=title||'Journal is locked';
  if(s)s.textContent=sub||'Enter your PIN to open your journal';
  document.getElementById('journalPinError').textContent='';
  _renderPinDots('journalPinDots',0);
}

function journalPinKey(k){
  const err=document.getElementById('journalPinError');
  if(k==='C'){_pinBuffer='';_renderPinDots('journalPinDots',0);err.textContent='';return;}
  if(k==='DEL'){_pinBuffer=_pinBuffer.slice(0,-1);_renderPinDots('journalPinDots',_pinBuffer.length);return;}
  if(_pinBuffer.length>=12)return;
  _pinBuffer+=k;
  _renderPinDots('journalPinDots',_pinBuffer.length);
}

function _journalPinFail(err){
  err.textContent='Incorrect PIN. Try again.';
  document.querySelectorAll('#journalPinDots .pin-dot').forEach(d=>d.classList.add('shake'));
  setTimeout(function(){document.querySelectorAll('#journalPinDots .pin-dot').forEach(d=>d.classList.remove('shake'));},500);
  _pinBuffer='';_renderPinDots('journalPinDots',0);
}

async function journalPinSubmit(){
  const err=document.getElementById('journalPinError');
  const pin=_pinBuffer;
  if(pin.length<4){err.textContent='PIN must be at least 4 digits';return;}
  if(_journalMode==='migrate'){
    if(pin!==(state.journalPin||'')){_journalPinFail(err);return;}
    err.textContent='Encrypting your journal…';
    try{await _journalSetupAndMigrate(pin);}
    catch(e){console.log('journal migrate error:',e);err.textContent='Something went wrong. Try again.';return;}
    _pinBuffer='';
    _enterUnlocked();
    return;
  }
  var key;
  try{
    key=await JournalCrypto.deriveKey(pin,_journalMeta.salt,_journalMeta.iterations);
    var ok=await JournalCrypto.checkVerifier(key,_journalMeta.verifier);
    if(!ok){_journalPinFail(err);return;}
  }catch(e){console.log('journal unlock error:',e);_journalPinFail(err);return;}
  _journalKey=key;
  await _decryptAllEntries();
  _pinBuffer='';
  _enterUnlocked();
}

// ── Set / change PIN ─────────────────────────────────────────────────
function _showSetPin(title,sub){
  _setPinBuffer='';_setPinStage=0;_setPinFirst='';
  document.getElementById('journalPinGate').style.display='none';
  document.getElementById('journalMain').style.display='none';
  document.getElementById('journalEntriesView').style.display='none';
  document.getElementById('journalSetPin').style.display='flex';
  document.getElementById('setPinTitle').textContent=title||'Create a PIN';
  document.getElementById('setPinSub').textContent=sub||'Choose a 4+ digit PIN.';
  document.getElementById('setPinError').textContent='';
  _renderPinDots('setPinDots',0);
}

function setPinKey(k){
  const err=document.getElementById('setPinError');
  if(k==='C'){_setPinBuffer='';_renderPinDots('setPinDots',0);err.textContent='';return;}
  if(k==='DEL'){_setPinBuffer=_setPinBuffer.slice(0,-1);_renderPinDots('setPinDots',_setPinBuffer.length);return;}
  if(_setPinBuffer.length>=12)return;
  _setPinBuffer+=k;
  _renderPinDots('setPinDots',_setPinBuffer.length);
}

async function setPinSubmit(){
  const err=document.getElementById('setPinError');
  if(_setPinStage===0){
    if(_setPinBuffer.length<4){err.textContent='Choose at least 4 digits';return;}
    _setPinFirst=_setPinBuffer;_setPinBuffer='';_setPinStage=1;
    document.getElementById('setPinTitle').textContent='Confirm your PIN';
    document.getElementById('setPinSub').textContent='Enter the same PIN again to confirm.';
    err.textContent='';_renderPinDots('setPinDots',0);
    return;
  }
  if(_setPinBuffer!==_setPinFirst){
    err.textContent='PINs did not match. Start over.';
    document.querySelectorAll('#setPinDots .pin-dot').forEach(d=>d.classList.add('shake'));
    setTimeout(function(){document.querySelectorAll('#setPinDots .pin-dot').forEach(d=>d.classList.remove('shake'));},500);
    _setPinBuffer='';_setPinStage=0;_setPinFirst='';
    document.getElementById('setPinTitle').textContent=_changingPin?'Set a new PIN':'Create a PIN';
    document.getElementById('setPinSub').textContent='Choose a 4+ digit PIN.';
    _renderPinDots('setPinDots',0);
    return;
  }
  const pin=_setPinFirst;
  _setPinBuffer='';_setPinStage=0;_setPinFirst='';
  try{
    if(_changingPin){_changingPin=false;err.textContent='Re-encrypting…';await _journalRekey(pin);}
    else{err.textContent='Encrypting…';await _journalSetupAndMigrate(pin);}
  }catch(e){console.log('journal set-pin error:',e);err.textContent='Something went wrong. Try again.';return;}
  _enterUnlocked();
}

function changeJournalPin(){
  if(!_journalUnlocked){toast('Unlock the journal first');return;}
  _changingPin=true;
  _showSetPin('Set a new PIN','Choose a new 4+ digit PIN. Your entries will be re-encrypted.');
}

function _renderPinDots(containerId,count){
  var c=document.getElementById(containerId);
  if(!c)return;
  var slots=Math.max(4,count);
  var html='';
  for(var i=0;i<slots;i++){html+='<span class="pin-dot'+(i<count?' filled':'')+'"></span>';}
  c.innerHTML=html;
  // R9: text equivalent of the dot fill-state for screen readers.
  var status=document.getElementById(containerId+'Status');
  if(status)status.textContent=count+' of '+slots+' digits entered';
}

function renderJournalEntries(){
  const list=document.getElementById('journalEntriesList');
  if(!list)return;
  const q=(document.getElementById('journalSearch').value||'').toLowerCase();
  const fp=document.getElementById('journalFilterProj').value;
  let entries=_journalEntries.filter(function(e){
    if(fp!=='all'&&e.projId!==fp)return false;
    var txt=_journalPlain[e.id]||'';
    if(q&&!txt.toLowerCase().includes(q))return false;
    return true;
  });
  if(!entries.length){
    list.innerHTML='<div class="journal-empty">No entries yet.<br>Write your first one using the compose area.</div>';
    return;
  }
  const MOOD_LABELS={reflective:'&#129300; Reflective',grateful:'&#128149; Grateful',anxious:'&#128560; Anxious',motivated:'&#128293; Motivated',frustrated:'&#128548; Frustrated',content:'&#127774; Content',uncertain:'&#129300; Uncertain'};
  list.innerHTML=entries.map(function(e){
    const d=new Date(e.date);
    const dStr=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})+' — '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    const tags=(e.projName?'<span class="jec-tag">&#128194; '+esc(e.projName)+'</span>':'')+(e.mood?'<span class="jec-tag mood-tag">'+(MOOD_LABELS[e.mood]||esc(e.mood))+'</span>':'');
    return '<div class="journal-entry-card"><div class="jec-header"><div class="jec-meta"><div class="jec-date">'+dStr+'</div>'+(tags?'<div class="jec-tags">'+tags+'</div>':'')+'</div><div class="jec-actions"><button class="jec-del" onclick="deleteJournalEntry(\''+e.id+'\')" title="Delete entry">&#128465;</button></div></div><div class="jec-body">'+esc(_journalPlain[e.id]||'')+'</div></div>';
  }).join('');
}

function deleteJournalEntry(id){
  _confirm('Delete this journal entry? This cannot be undone.',function(){
    _journalEntries=_journalEntries.filter(function(e){return e.id!==id;});
    delete _journalPlain[id];
    _updateJournalMeta();
    _saveJournalDoc();
    renderJournalEntries();
  },{destructive:true,confirmText:'Delete'});
}

// Phase 4: decrypted backup. Only works while unlocked (the key is in memory).
// This is the escape hatch for the "forgotten PIN = unrecoverable" tradeoff.
function exportJournalDecrypted(){
  if(!_journalUnlocked||!_journalKey){if(typeof toast==='function')toast('Unlock the journal first');return;}
  var rows=_journalEntries.map(function(e){
    return {id:e.id,date:e.date,projName:e.projName||'',mood:e.mood||'',text:(_journalPlain[e.id]!=null?_journalPlain[e.id]:'')};
  });
  var bundle={exportedAt:new Date().toISOString(),note:'Decrypted Centerpost journal export — this file is NOT encrypted. Keep it private.',entryCount:rows.length,entries:rows};
  var blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'});
  var u=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=u;a.download='centerpost-journal-'+todayStr()+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(u);
  if(typeof toast==='function')toast('✓ Journal exported (decrypted — keep it safe)');
}
// =======================================
// WORKOUT MODAL
// =======================================
function openWorkoutModal(){
  document.getElementById('workoutModal').classList.add('open');
  _blurDashboard();
  renderWorkout();
  updateCompletedWorkoutsCounter();
}
function closeWorkoutModal(){
  document.getElementById('workoutModal').classList.remove('open');
  _unblurDashboard();
}

// =======================================
// WORKOUT PANEL
// =======================================
var WO_ACTIVE_DAY=null;

var WO_DAYS=[
  {label:'Monday',type:'lift',prog:0},
  {label:'Tuesday',type:'walk'},
  {label:'Wednesday',type:'lift',prog:1},
  {label:'Thursday',type:'walk'},
  {label:'Friday',type:'lift',prog:2},
  {label:'Saturday',type:'walk'},
  {label:'Sunday',type:'rest'}
];

// -- Exercise database ------------------------------------------------------
var WO_EXERCISES={
  // HORIZONTAL PUSH
  db_bench:{name:'DB Bench Press',muscles:'Chest · Anterior Deltoid · Triceps',
    steps:['Lie flat, feet on floor. Dumbbells at chest, palms forward.','Press upward until arms nearly locked, slight arc inward.','Lower slowly 2–3 s, feel chest stretch.','Shoulder blades pinched back throughout -- no shrugging.'],
    tip:'Control the descent. If no bench, do floor press.',
    alts:['smith_bench','db_incline','db_floor_press','cable_chest','pushup_weighted','pec_deck','dips_chest','cable_crossover','chest_press_machine']},
  db_incline:{name:'Incline DB Press',muscles:'Upper Chest · Anterior Deltoid · Triceps',
    steps:['Set bench 30–45°. Kick DBs up as you lie back.','Press upward at bench angle, not straight up.','Lower to outside upper chest, elbows ~60°.','Pause at bottom, drive back up.'],
    tip:'Upper chest is often underdeveloped. Go lighter than flat press.',
    alts:['db_bench','db_floor_press','cable_chest','pushup_weighted','pec_deck','dips_chest','cable_crossover','smith_bench','chest_press_machine']},
  db_floor_press:{name:'DB Floor Press',muscles:'Chest · Triceps',
    steps:['Lie on floor, knees bent. DBs at chest, elbows on floor.','Press to full extension, squeeze chest at top.','Lower until elbows touch floor -- that is the ROM.','Great option when bench is taken.'],
    tip:'Floor limits shoulder strain. Excellent for shoulder-sensitive days.',
    alts:['db_bench','db_incline','cable_chest','pushup_weighted','pec_deck','dips_chest','cable_crossover','smith_bench','chest_press_machine']},
  cable_chest:{name:'Cable Chest Fly',muscles:'Chest (inner) · Anterior Deltoid',
    steps:['Cables at chest height, stand center, one foot forward.','Arms slightly bent -- hug a tree arc.','Bring hands together, squeeze pec at end.','Open slowly, control the stretch.'],
    tip:'Lead with elbows, not hands. Keep bend consistent.',
    alts:['db_bench','db_incline','db_floor_press','pushup_weighted','pec_deck','dips_chest','cable_crossover','smith_bench','chest_press_machine']},
  pushup_weighted:{name:'Weighted Push-Up',muscles:'Chest · Triceps · Core',
    steps:['Plate on upper back or weighted vest. High plank.','Lower chest near floor, elbows 45° from torso.','Press back up, squeeze chest at top.','Body straight line throughout.'],
    tip:'Backpack with books works if no vest or plates.',
    alts:['db_bench','db_incline','db_floor_press','cable_chest','pec_deck','dips_chest','cable_crossover','smith_bench','chest_press_machine']},
  pec_deck:{name:'Pec Deck Machine',muscles:'Chest (isolation) · Anterior Deltoid',
    steps:['Adjust seat so handles are at chest height.','Grip handles, elbows bent ~90°.','Bring handles together in front of chest.','Open slowly -- feel the stretch.'],
    tip:'Machine keeps you in the groove. Great finishing move or when the free weights area is packed.',
    alts:['db_bench','db_incline','cable_chest','pushup_weighted','dips_chest','cable_crossover','smith_bench','chest_press_machine','db_floor_press']},
  dips_chest:{name:'Chest Dips (Weighted)',muscles:'Lower Chest · Triceps · Anterior Deltoid',
    steps:['Grip parallel bars, lean torso forward ~30°.','Lower until upper arms parallel to floor.','Drive up, squeezing chest -- slight forward lean maintained.','Add dip belt with plates as you progress.'],
    tip:'The forward lean is what makes it a chest dip vs tricep dip.',
    alts:['db_bench','db_incline','cable_chest','pushup_weighted','pec_deck','cable_crossover','smith_bench','chest_press_machine','db_floor_press']},
  cable_crossover:{name:'Cable Crossover',muscles:'Chest (full sweep) · Anterior Deltoid',
    steps:['High cables. Step forward, one foot staggered.','Pull handles down and in, crossing slightly at the bottom.','Squeeze hard at crossover point.','Return slowly to stretch.'],
    tip:'Different angle than standard fly -- great for the lower-chest sweep.',
    alts:['db_bench','cable_chest','pec_deck','dips_chest','pushup_weighted','db_incline','db_floor_press','smith_bench','chest_press_machine']},
  smith_bench:{name:'Smith Machine Bench',muscles:'Chest · Triceps · Anterior Deltoid',
    steps:['Lie on bench under Smith bar. Grip shoulder-width.','Unrack and lower to lower chest.','Press back up, lock out at top.','Fixed path reduces stabilizer demand -- good for overload.'],
    tip:'Good for going heavy when no spotter is available.',
    alts:['db_bench','db_incline','pec_deck','cable_chest','chest_press_machine','pushup_weighted','dips_chest','cable_crossover','db_floor_press']},
  chest_press_machine:{name:'Chest Press Machine',muscles:'Chest · Triceps · Anterior Deltoid',
    steps:['Set seat so handles are at chest height.','Grip handles, elbows bent, pull shoulder blades back.','Press forward to full extension.','Control return -- do not let the stack slam.'],
    tip:'Zero balance required. Great for focusing purely on pressing strength.',
    alts:['db_bench','db_incline','pec_deck','cable_chest','smith_bench','pushup_weighted','dips_chest','cable_crossover','db_floor_press']},

  // KNEE-DOMINANT / QUADS
  goblet_squat:{name:'Goblet Squat',muscles:'Quads · Glutes · Core',
    steps:['Hold one heavy DB at chest, cupping the top end.','Feet shoulder-width, toes slightly out.','Knees out as you sit straight down, chest tall.','Drive through heels, squeeze glutes at top.'],
    tip:'The DB counterbalances you. Go heavy -- it\'s stable.',
    alts:['db_front_squat','leg_press','hack_squat','box_squat','sumo_squat','smith_squat','walking_lunge','wall_sit','step_ups']},
  db_front_squat:{name:'DB Front Squat',muscles:'Quads · Glutes · Upper Back · Core',
    steps:['DBs at shoulder height, elbows high.','Squat down keeping elbows up -- forces upright torso.','Drive back up through heels.'],
    tip:'Elbows high is the key cue. Cross arms to support DBs if wrists bother you.',
    alts:['goblet_squat','leg_press','hack_squat','box_squat','sumo_squat','smith_squat','walking_lunge','wall_sit','step_ups']},
  leg_press:{name:'Leg Press',muscles:'Quads · Glutes · Hamstrings',
    steps:['Feet hip-width on platform. Knees ~90° when loaded.','Release safety and lower platform controlled.','Stop at 90° -- knees don\'t collapse.','Press through heels, don\'t lock out.'],
    tip:'Higher foot position = more glutes; lower = more quads.',
    alts:['goblet_squat','db_front_squat','hack_squat','box_squat','sumo_squat','smith_squat','walking_lunge','wall_sit','step_ups']},
  hack_squat:{name:'Hack Squat (DB)',muscles:'Quads (primary) · Glutes',
    steps:['DBs at sides, heels elevated 1–2 in on a plate.','Squat straight down, torso upright.','Knees travel over toes -- intended.','Drive through balls of feet.'],
    tip:'Heel elevation is the key for quad emphasis.',
    alts:['goblet_squat','db_front_squat','leg_press','box_squat','sumo_squat','smith_squat','walking_lunge','wall_sit','step_ups']},
  box_squat:{name:'Box Squat (DB)',muscles:'Glutes · Hamstrings · Quads',
    steps:['Box behind you at knee height. DBs at sides.','Sit BACK (not down) onto the box, hip hinge.','Briefly pause, drive up through heels, squeeze glutes.'],
    tip:'Reinforces sit-back hip pattern. Great for glutes.',
    alts:['goblet_squat','db_front_squat','leg_press','hack_squat','sumo_squat','smith_squat','walking_lunge','wall_sit','step_ups']},
  sumo_squat:{name:'Sumo Squat (DB)',muscles:'Quads · Glutes · Adductors',
    steps:['Wide stance, toes turned out 45°. Hold one heavy DB between legs.','Lower straight down, chest tall.','Inner thighs and glutes drive up.','Wider stance = more inner thigh and glute.'],
    tip:'Comfortable for people with hip mobility limitations.',
    alts:['goblet_squat','db_front_squat','leg_press','hack_squat','box_squat','smith_squat','walking_lunge','wall_sit','step_ups']},
  smith_squat:{name:'Smith Machine Squat',muscles:'Quads · Glutes · Hamstrings',
    steps:['Bar on upper traps. Feet slightly forward of hips.','Squat to parallel or below.','Drive up, push head back into bar at top.'],
    tip:'Fixed path lets you focus on depth and quad tension without balance concerns.',
    alts:['goblet_squat','db_front_squat','leg_press','hack_squat','box_squat','sumo_squat','walking_lunge','wall_sit','step_ups']},
  walking_lunge:{name:'Walking Lunge (DB)',muscles:'Quads · Glutes · Balance',
    steps:['DBs at sides. Step forward into a lunge.','Back knee drops toward floor without touching.','Step the back foot up to meet the front.','Continue forward alternating legs.'],
    tip:'Excellent for space and athleticism. 10 reps each leg.',
    alts:['goblet_squat','db_front_squat','leg_press','hack_squat','box_squat','sumo_squat','smith_squat','wall_sit','step_ups']},
  wall_sit:{name:'Wall Sit',muscles:'Quads (isometric) · Glutes · Core',
    steps:['Back flat against a wall, feet about 2 ft out, hip-width.','Slide down until thighs are parallel, knees at 90°.','Press through heels -- back stays glued to the wall.','Hold for time. 30–60 s per set.'],
    tip:'Add a DB on your thighs or sink lower to progress. Perfect when every rack is taken.',
    alts:['goblet_squat','db_front_squat','leg_press','hack_squat','box_squat','sumo_squat','smith_squat','walking_lunge','step_ups']},

  // VERTICAL PULL / BACK
  pullups:{name:'Pull-Ups',muscles:'Lats · Biceps · Rear Deltoid · Core',
    steps:['Overhand grip, hands just outside shoulders.','Depress shoulder blades first.','Drive elbows toward hips.','Lower slowly 2–3 s.'],
    tip:'A great compound move. Band or negatives if needed. Earn the reps.',
    alts:['lat_pulldown','assisted_pullup','db_row','cable_row','t_bar_row','chest_supported_row','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  lat_pulldown:{name:'Lat Pulldown',muscles:'Lats · Biceps · Rear Deltoid',
    steps:['Overhand, just outside shoulder width. Lean back 10–15°.','Drive elbows down to hips.','Pull to upper chest. Control return.'],
    tip:'Focus on elbow path -- lats pull the arm down.',
    alts:['pullups','assisted_pullup','db_row','cable_row','t_bar_row','chest_supported_row','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  assisted_pullup:{name:'Assisted Pull-Up',muscles:'Lats · Biceps · Core',
    steps:['Set assistance weight. Grip just outside shoulders.','Same motion: shoulder blades down, elbows to hips.','Lower slowly. Reduce assistance 5 lbs every 2–3 weeks.'],
    tip:'A progression tool. Track it and chip away.',
    alts:['pullups','lat_pulldown','db_row','cable_row','t_bar_row','chest_supported_row','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  db_row:{name:'Single-Arm DB Row',muscles:'Lats · Rhomboids · Rear Delt · Biceps',
    steps:['One hand and knee on bench. Row DB toward hip, not shoulder.','Elbow behind body at top -- hold 1 s.','Lower slowly. Finish all reps one side, then switch.'],
    tip:'Pulling to the hip is key. Allows heavy loading with good form.',
    alts:['pullups','lat_pulldown','assisted_pullup','cable_row','t_bar_row','chest_supported_row','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  cable_row:{name:'Seated Cable Row',muscles:'Lats · Rhomboids · Biceps · Rear Delt',
    steps:['Low cable row. Feet on platform, knees slightly bent.','Retract shoulder blades before pulling.','Pull handle to lower abdomen, elbows close.','Control return -- slight forward lean only.'],
    tip:'Keep torso upright. Leaning back makes it a lower-back exercise.',
    alts:['pullups','lat_pulldown','assisted_pullup','db_row','t_bar_row','chest_supported_row','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  t_bar_row:{name:'T-Bar Row',muscles:'Lats · Rhomboids · Rear Delt · Biceps',
    steps:['Straddle the barbell/T-bar handle. Hip hinge, flat back.','Row to lower chest, elbows close.','Squeeze shoulder blades together at top.','Lower with control.'],
    tip:'One of the heaviest row variations. Great for thickness.',
    alts:['pullups','lat_pulldown','db_row','cable_row','assisted_pullup','chest_supported_row','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  chest_supported_row:{name:'Chest-Supported DB Row',muscles:'Rhomboids · Rear Delt · Lats · Biceps',
    steps:['Set incline bench to 30–45°. Lie chest-down, DBs hanging.','Row both DBs up toward hips simultaneously.','Squeeze shoulder blades together.','Lower slowly -- full stretch.'],
    tip:'Chest support eliminates lower-back fatigue. Pure back work.',
    alts:['cable_row','db_row','pullups','lat_pulldown','t_bar_row','assisted_pullup','straight_arm_pulldown','ring_row','close_grip_pulldown']},
  straight_arm_pulldown:{name:'Straight-Arm Pulldown',muscles:'Lats (isolation) · Core',
    steps:['High cable, rope or straight bar. Arms nearly straight.','Pull bar down to thighs with a sweeping arc.','Feel the lat stretch at top -- that\'s the money.','Return slowly.'],
    tip:'Pure lat isolation. Great as a warm-up or finishing move.',
    alts:['pullups','lat_pulldown','db_row','cable_row','t_bar_row','chest_supported_row','assisted_pullup','ring_row','close_grip_pulldown']},
  close_grip_pulldown:{name:'Close-Grip Pulldown',muscles:'Lats (lower) · Biceps',
    steps:['Use close neutral-grip handle. Sit tall.','Drive elbows straight down to sides.','Pull to upper chest.','Full stretch at top.'],
    tip:'Neutral grip is easier on the shoulders and hits lower lats well.',
    alts:['pullups','lat_pulldown','db_row','cable_row','t_bar_row','chest_supported_row','straight_arm_pulldown','assisted_pullup','ring_row']},
  ring_row:{name:'Ring Row (TRX Row)',muscles:'Lats · Rhomboids · Rear Delt · Core',
    steps:['Set rings or TRX at waist height. Grip and lean back.','Body straight like a plank. Pull chest to handles.','Elbows drive back past body.','Lower with control. Walk feet out to increase difficulty.'],
    tip:'Bodyweight but surprisingly tough. Angle your body for the right challenge.',
    alts:['pullups','lat_pulldown','db_row','cable_row','t_bar_row','chest_supported_row','straight_arm_pulldown','close_grip_pulldown','assisted_pullup']},

  // HIP-DOMINANT / POSTERIOR CHAIN
  rdl:{name:'Romanian Deadlift (DB)',muscles:'Hamstrings · Glutes · Lower Back',
    steps:['DBs at thighs, soft knee bend, feet hip-width.','Hinge at hips, pushing butt backward.','Lower to mid-shin (feel stretch).','Drive hips forward, squeeze glutes at top.'],
    tip:'Hip hinge, not squat. Keep DBs close to legs.',
    alts:['leg_curl','good_morning','kb_swing','stiff_leg_dl','nordic_curl','hip_thrust','sumo_rdl','single_leg_rdl','cable_pull_through']},
  leg_curl:{name:'Lying Leg Curl',muscles:'Hamstrings (isolated)',
    steps:['Face down, pad just above ankles.','Curl heels toward glutes, full ROM.','Hold 1 s at top.','Lower slowly -- eccentric is key.'],
    tip:'Standing single-leg cable curl is a great substitute.',
    alts:['rdl','good_morning','kb_swing','stiff_leg_dl','nordic_curl','hip_thrust','sumo_rdl','single_leg_rdl','cable_pull_through']},
  good_morning:{name:'Good Morning',muscles:'Hamstrings · Glutes · Lower Back',
    steps:['Light DB at chest or bar across upper traps.','Feet hip-width, soft knee bend.','Hinge forward until torso near parallel -- feel hamstring stretch.','Drive hips forward to return.'],
    tip:'GO LIGHT. This is a hamstring stretch strengthener, not a max effort move.',
    alts:['rdl','leg_curl','kb_swing','stiff_leg_dl','nordic_curl','hip_thrust','sumo_rdl','single_leg_rdl','cable_pull_through']},
  kb_swing:{name:'Kettlebell Swing',muscles:'Hamstrings · Glutes · Core · Shoulders',
    steps:['KB between legs. Hike it back with a hip hinge.','Explosively snap hips forward.','Let momentum swing weight to chest height -- arms guide only.','Control the hike back pattern.'],
    tip:'Power comes entirely from the hip snap. Think "hip, not arms."',
    alts:['rdl','leg_curl','good_morning','stiff_leg_dl','nordic_curl','hip_thrust','sumo_rdl','single_leg_rdl','cable_pull_through']},
  stiff_leg_dl:{name:'Stiff-Leg Deadlift (DB)',muscles:'Hamstrings · Glutes · Lower Back',
    steps:['DBs at thighs, legs nearly straight (not locked).','Hinge forward, flat back, lower toward floor.','Stop at your flexibility limit.','Drive up with hamstrings and glutes.'],
    tip:'More hamstring stretch than RDL. Good for mobility gains.',
    alts:['rdl','leg_curl','good_morning','kb_swing','nordic_curl','hip_thrust','sumo_rdl','single_leg_rdl','cable_pull_through']},
  nordic_curl:{name:'Nordic Curl',muscles:'Hamstrings (eccentric, very high demand)',
    steps:['Kneel on mat, feet anchored under a bench or bar.','Keep body straight hip-to-knee as you lower torso toward floor.','Lower as slowly as possible -- use arms to catch if needed.','Pull back up using hamstrings (or push up from floor).'],
    tip:'Regarded as one of the most effective hamstring exercises in sports science research. Very hard -- start with negatives only.',
    alts:['rdl','leg_curl','good_morning','kb_swing','stiff_leg_dl','hip_thrust','sumo_rdl','single_leg_rdl','cable_pull_through']},
  hip_thrust:{name:'Hip Thrust (DB or Barbell)',muscles:'Glutes (primary) · Hamstrings',
    steps:['Sit with upper back against a bench. Bar or DB on hips.','Feet flat, knees ~90° at top.','Drive hips up until body is straight hip to shoulder.','Squeeze glutes hard at top for 1 s -- lower controlled.'],
    tip:'The single most effective glute exercise per EMG research (Contreras et al., 2015). Go heavy.',
    alts:['rdl','leg_curl','good_morning','kb_swing','stiff_leg_dl','nordic_curl','sumo_rdl','single_leg_rdl','cable_pull_through']},
  sumo_rdl:{name:'Sumo RDL (DB)',muscles:'Hamstrings · Glutes · Adductors',
    steps:['Wide stance, toes turned out 45°. DBs between legs.','Hinge at hips keeping chest tall.','Lower DBs along inner legs to mid-shin.','Drive hips through, squeeze glutes.'],
    tip:'Wider stance shifts some load to adductors and changes glute activation angle.',
    alts:['rdl','leg_curl','good_morning','kb_swing','stiff_leg_dl','nordic_curl','hip_thrust','single_leg_rdl','cable_pull_through']},
  single_leg_rdl:{name:'Single-Leg RDL (DB)',muscles:'Hamstrings · Glutes · Balance · Core',
    steps:['Hold one or two DBs. Stand on one leg, soft bend.','Hinge at hip, extending free leg behind you for balance.','Lower DB to mid-shin on standing leg side.','Drive back up -- same hip hinges both ways.'],
    tip:'Outstanding for addressing leg imbalances. Balance will improve quickly.',
    alts:['rdl','leg_curl','good_morning','kb_swing','stiff_leg_dl','nordic_curl','hip_thrust','sumo_rdl','cable_pull_through']},
  cable_pull_through:{name:'Cable Pull-Through',muscles:'Glutes · Hamstrings · Lower Back',
    steps:['Low cable behind you, rope attachment. Straddle cable.','Hip hinge forward, grabbing rope between legs.','Drive hips forward explosively to standing.','Control the hinge back.'],
    tip:'Hip hinge pattern with constant cable tension. Teaches the RDL/swing pattern very well.',
    alts:['rdl','leg_curl','good_morning','kb_swing','stiff_leg_dl','nordic_curl','hip_thrust','sumo_rdl','single_leg_rdl']},

  // UNILATERAL LOWER
  step_ups:{name:'Weighted Step-Ups',muscles:'Glutes · Quads · Hamstrings · Core',
    steps:['DBs at sides. Box at knee height.','Entire foot on box -- don\'t use trailing leg to push.','Drive through heel to step up, knee lifts opposite leg.','Step back down controlled. All reps one leg, then switch.'],
    tip:'A strong unilateral builder. Heel drive is everything.',
    alts:['reverse_lunge','split_squat','bulgarian_split','db_lateral_lunge','hip_thrust','curtsy_lunge','single_leg_rdl','walking_lunge','step_mill']},
  reverse_lunge:{name:'Reverse Lunge (DB)',muscles:'Glutes · Quads · Hamstrings · Balance',
    steps:['DBs at sides, feet hip-width.','Step one foot back and lower back knee near floor.','Front knee stays over ankle.','Push through front heel to return. Alternate.'],
    tip:'Easier on knees than forward lunge. Better glute activation.',
    alts:['step_ups','split_squat','bulgarian_split','db_lateral_lunge','hip_thrust','curtsy_lunge','single_leg_rdl','walking_lunge','step_mill']},
  split_squat:{name:'Split Squat (DB)',muscles:'Quads · Glutes · Hip Flexors',
    steps:['Long split stance -- front forward, back extended. DBs at sides.','Lower straight down until back knee near floor.','Front shin stays as vertical as possible.','All reps one side then switch.'],
    tip:'Static stance -- no movement. Purely a drop and drive.',
    alts:['step_ups','reverse_lunge','bulgarian_split','db_lateral_lunge','hip_thrust','curtsy_lunge','single_leg_rdl','walking_lunge','step_mill']},
  bulgarian_split:{name:'Bulgarian Split Squat',muscles:'Glutes · Quads · Hip Flexors · Balance',
    steps:['Rear foot on bench. DBs at sides.','Lower until front thigh parallel -- front shin vertical at bottom.','Drive through front heel to return.','Go lighter than you think -- this is brutal.'],
    tip:'Often called the king of lower body. Use Smith machine or TRX initially.',
    alts:['step_ups','reverse_lunge','split_squat','db_lateral_lunge','hip_thrust','curtsy_lunge','single_leg_rdl','walking_lunge','step_mill']},
  db_lateral_lunge:{name:'Lateral Lunge (DB)',muscles:'Glutes (lateral) · Adductors · Quads',
    steps:['DBs at sides. Wide step to one side, bend that knee.','Other leg stays straight. Sit into the hip.','Push through bent leg heel to return. Alternate.'],
    tip:'Frontal plane movement -- often neglected. Great complement to step-ups.',
    alts:['step_ups','reverse_lunge','split_squat','bulgarian_split','hip_thrust','curtsy_lunge','single_leg_rdl','walking_lunge','step_mill']},
  curtsy_lunge:{name:'Curtsy Lunge (DB)',muscles:'Glutes (lateral) · Adductors · Quads',
    steps:['DBs at sides. Step one foot diagonally BEHIND and across.','Lower back knee toward floor in a curtsy pattern.','Drive through front heel to return.','Alternate sides.'],
    tip:'Hits the lateral glute in a unique way. Great variety for glute development.',
    alts:['step_ups','reverse_lunge','split_squat','bulgarian_split','db_lateral_lunge','hip_thrust','single_leg_rdl','walking_lunge','step_mill']},
  step_mill:{name:'Step Mill (Stair Climber)',muscles:'Glutes · Quads · Calves · Conditioning',
    steps:['Step on and set a moderate pace.','Whole foot on each step -- drive through the heel.','Stand tall, fingertips only on the rails.','Skip a step now and then for extra glute work.'],
    tip:'Leaning on the rails robs the work. 10–15 min doubles as a leg finisher and conditioning.',
    alts:['step_ups','reverse_lunge','split_squat','bulgarian_split','db_lateral_lunge','hip_thrust','curtsy_lunge','single_leg_rdl','walking_lunge']},

  // SHOULDER / OVERHEAD PUSH
  db_shoulder_press:{name:'DB Shoulder Press',muscles:'Anterior & Lateral Delt · Triceps',
    steps:['Seated or standing. DBs at shoulder height, palms forward.','Press upward -- hands arc slightly inward at top.','Stop just before lockout.','Lower to shoulder height with control.'],
    tip:'Seated with back support reduces lower-back strain.',
    alts:['arnold_press','lateral_raise','db_upright_row','machine_shoulder','cable_lateral','rear_delt_fly','front_raise','face_pull','overhead_press_machine']},
  arnold_press:{name:'Arnold Press',muscles:'All 3 Delt Heads · Triceps · Rotator Cuff',
    steps:['Start with palms facing YOU at shoulder height.','Press and rotate -- palms face FORWARD at top.','Reverse on the way down.','Rotation recruits all three delt heads.'],
    tip:'Named after Arnold. Go slightly lighter -- wider ROM.',
    alts:['db_shoulder_press','lateral_raise','db_upright_row','machine_shoulder','cable_lateral','rear_delt_fly','front_raise','face_pull','overhead_press_machine']},
  lateral_raise:{name:'Lateral Raise (DB)',muscles:'Lateral Delt (isolated)',
    steps:['Light DBs at sides, slight elbow bend.','Raise arms out to shoulder height -- no higher.','Pause, lower over 3 s.','Lead with elbows, pinky slightly higher than thumb.'],
    tip:'Start at 8–15 lbs. Most people go too heavy and it becomes a trap shrug.',
    alts:['db_shoulder_press','arnold_press','db_upright_row','machine_shoulder','cable_lateral','rear_delt_fly','front_raise','face_pull','overhead_press_machine']},
  db_upright_row:{name:'DB Upright Row',muscles:'Lateral Delt · Upper Traps · Biceps',
    steps:['DBs at thighs, overhand, close grip.','Pull straight up toward chin, elbows lead.','Elbows higher than wrists throughout.','Stop at chest height.'],
    tip:'Wide grip = more delt; narrow = more trap. Stop at chest to protect shoulder.',
    alts:['db_shoulder_press','arnold_press','lateral_raise','machine_shoulder','cable_lateral','rear_delt_fly','front_raise','face_pull','overhead_press_machine']},
  machine_shoulder:{name:'Shoulder Press Machine',muscles:'Anterior & Lateral Delt · Triceps',
    steps:['Seat adjusted so handles are at shoulder height.','Press upward to near extension.','Lower with control.'],
    tip:'Fixed path. Good for overloading when shoulder stability is an issue.',
    alts:['db_shoulder_press','arnold_press','lateral_raise','db_upright_row','cable_lateral','rear_delt_fly','front_raise','face_pull','overhead_press_machine']},
  cable_lateral:{name:'Cable Lateral Raise',muscles:'Lateral Delt (constant tension)',
    steps:['Single low cable, handle in outside hand.','Raise arm to shoulder height, arc slightly across body.','Control return -- cable maintains tension at bottom.','Complete all reps, switch sides.'],
    tip:'Cable provides tension at the bottom where DBs are easiest -- better overall stimulus.',
    alts:['db_shoulder_press','arnold_press','lateral_raise','machine_shoulder','rear_delt_fly','front_raise','face_pull','overhead_press_machine','db_upright_row']},
  rear_delt_fly:{name:'Rear Delt Fly (DB)',muscles:'Rear Deltoid · Rhomboids · Lower Traps',
    steps:['Seated, lean forward until torso nearly parallel.','DBs hanging, slight elbow bend.','Raise arms out to sides -- pinch shoulder blades.','Hold 1 s at top, lower slowly.'],
    tip:'Rear delts are chronically underdeveloped. Light weight, high reps.',
    alts:['db_shoulder_press','arnold_press','lateral_raise','machine_shoulder','cable_lateral','front_raise','face_pull','overhead_press_machine','db_upright_row']},
  overhead_press_machine:{name:'Overhead Press Machine',muscles:'Anterior & Lateral Delt · Triceps',
    steps:['Set seat. Grip handles at shoulder level.','Press overhead to near full extension.','Lower controlled.'],
    tip:'Overhead press machines vary -- some allow more freedom of movement than others.',
    alts:['db_shoulder_press','arnold_press','lateral_raise','machine_shoulder','cable_lateral','rear_delt_fly','front_raise','face_pull','db_upright_row']},

  // REAR DELT / ROTATOR CUFF
  face_pull:{name:'Face Pull',muscles:'Rear Deltoid · Rotator Cuff · Rear Traps',
    steps:['High cable with rope attachment. Grab ends with palms down.','Pull rope toward face, elbows flare wide and high.','External rotate at end -- elbows behind the rope at top.','Return slowly -- this range of motion is rare and valuable.'],
    tip:'One of the best shoulder health exercises. Often called "the most important exercise you\'re not doing." 15–20 reps every session.',
    alts:['rear_delt_fly','lateral_raise','cable_lateral','machine_shoulder','db_upright_row','arnold_press','db_shoulder_press','ring_row','overhead_press_machine']},

  // TRICEPS
  db_tricep_ext:{name:'DB Tricep Extension (Overhead)',muscles:'Triceps (long head emphasis)',
    steps:['Seated or standing. Hold one DB with both hands overhead.','Lower DB behind head, elbows pointing forward.','Press back up to full extension -- squeeze triceps.','Keep elbows from flaring out.'],
    tip:'Overhead position puts the long head of the tricep in a stretched position -- highest growth stimulus.',
    alts:['cable_pushdown','skull_crusher','close_grip_press','db_kickback','bench_dip','diamond_push_up','tricep_machine','cable_overhead_tri','dips_chest']},
  cable_pushdown:{name:'Cable Pushdown (Rope)',muscles:'Triceps (all heads)',
    steps:['High cable, rope attachment. Elbows fixed at sides.','Push rope down and out -- separate at bottom.','Full extension, squeeze triceps.','Control return -- stop when forearms are parallel.'],
    tip:'Keep elbows pinned to sides throughout. If they drift forward, reduce weight.',
    alts:['db_tricep_ext','skull_crusher','close_grip_press','db_kickback','bench_dip','diamond_push_up','tricep_machine','cable_overhead_tri','dips_chest']},
  skull_crusher:{name:'Skull Crushers (DB)',muscles:'Triceps (all heads)',
    steps:['Lie flat, DBs extended above chest.','Lower DBs toward temples by bending only at elbow.','Extend back up -- keep upper arms vertical.'],
    tip:'Keep upper arms still. Only the forearms move. Go lighter than you think.',
    alts:['db_tricep_ext','cable_pushdown','close_grip_press','db_kickback','bench_dip','diamond_push_up','tricep_machine','cable_overhead_tri','dips_chest']},
  close_grip_press:{name:'Close-Grip DB Press',muscles:'Triceps · Chest (inner)',
    steps:['Hold DBs together at chest, palms facing each other.','Press straight up while keeping DBs touching.','Lower slowly.'],
    tip:'Neutral grip targets triceps more than standard bench.',
    alts:['db_tricep_ext','cable_pushdown','skull_crusher','db_kickback','bench_dip','diamond_push_up','tricep_machine','cable_overhead_tri','dips_chest']},
  db_kickback:{name:'DB Tricep Kickback',muscles:'Triceps (all heads)',
    steps:['Hinge forward 45°, upper arm parallel to floor.','Extend forearm back to full lockout.','Hold 1 s, lower slowly.'],
    tip:'Light weight only. The lockout is where triceps fully contract.',
    alts:['db_tricep_ext','cable_pushdown','skull_crusher','close_grip_press','bench_dip','diamond_push_up','tricep_machine','cable_overhead_tri','dips_chest']},
  bench_dip:{name:'Bench Dip',muscles:'Triceps · Lower Chest · Anterior Deltoid',
    steps:['Hands on bench edge behind you, fingers forward. Legs extended.','Lower hips by bending elbows to ~90°.','Elbows point straight back, not out.','Press back to lockout. Plate on lap to progress.'],
    tip:'Keep hips close to the bench to protect the shoulders. Bend knees to make it easier.',
    alts:['db_tricep_ext','cable_pushdown','skull_crusher','close_grip_press','db_kickback','diamond_push_up','tricep_machine','cable_overhead_tri','dips_chest']},
  tricep_machine:{name:'Tricep Extension Machine',muscles:'Triceps (all heads)',
    steps:['Set seat so elbows line up with the pivot point.','Arms on pad, grip handles.','Extend to full lockout -- squeeze 1 s.','Control the return, don\'t let the stack slam.'],
    tip:'Fixed path removes cheating. Great for a heavy finisher or drop set.',
    alts:['db_tricep_ext','cable_pushdown','skull_crusher','close_grip_press','db_kickback','bench_dip','diamond_push_up','cable_overhead_tri','dips_chest']},
  cable_overhead_tri:{name:'Cable Overhead Tricep Extension',muscles:'Triceps (long head emphasis)',
    steps:['Rope on a low cable. Face away, rope behind head, staggered stance.','Elbows high and pointing forward.','Extend arms overhead to lockout.','Return slowly -- deep stretch behind the head.'],
    tip:'Constant cable tension plus the overhead stretch -- ideal combination for the long head.',
    alts:['db_tricep_ext','cable_pushdown','skull_crusher','close_grip_press','db_kickback','bench_dip','diamond_push_up','tricep_machine','dips_chest']},

  // BICEPS
  db_bicep_curl:{name:'DB Bicep Curl',muscles:'Biceps · Brachialis · Brachioradialis',
    steps:['Stand or sit, DBs at sides, palms forward.','Curl both up simultaneously -- elbows stay pinned to sides.','Squeeze biceps at top.','Lower slowly -- 2–3 s.'],
    tip:'Slow the lowering -- the eccentric builds more muscle.',
    alts:['hammer_curl','incline_curl','concentration_curl','cable_curl','preacher_curl','db_21s','reverse_curl','cable_hammer_curl','machine_curl']},
  hammer_curl:{name:'Hammer Curl',muscles:'Brachialis · Biceps · Brachioradialis',
    steps:['DBs at sides, palms facing each other (hammer grip).','Curl upward -- no rotation.','Hold 1 s, lower slowly.'],
    tip:'Brachialis sits under the bicep and when built, pushes the bicep up making your arm look bigger. Very underrated.',
    alts:['db_bicep_curl','incline_curl','concentration_curl','cable_curl','preacher_curl','db_21s','reverse_curl','cable_hammer_curl','machine_curl']},
  incline_curl:{name:'Incline DB Curl',muscles:'Biceps (long head peak)',
    steps:['Lie back on incline bench (45–60°). Arms hang behind body.','Curl DBs up without moving upper arms.','Full stretch at bottom is the key stimulus.'],
    tip:'The incline position creates a unique stretch on the long head of the bicep -- excellent for peak development.',
    alts:['db_bicep_curl','hammer_curl','concentration_curl','cable_curl','preacher_curl','db_21s','reverse_curl','cable_hammer_curl','machine_curl']},
  concentration_curl:{name:'Concentration Curl',muscles:'Biceps (isolated peak)',
    steps:['Seated, lean forward, elbow braced against inner thigh.','Curl DB up fully, rotating wrist outward at top.','Lower fully.','Complete all reps one arm, then switch.'],
    tip:'Maximum isolation with zero body swing. Quality over quantity.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','cable_curl','preacher_curl','db_21s','reverse_curl','cable_hammer_curl','machine_curl']},
  preacher_curl:{name:'Preacher Curl (DB or Cable)',muscles:'Biceps (lower/short head)',
    steps:['Arms over preacher pad, elbows at edge of pad.','Curl up -- full contraction.','Lower fully -- critical to get the stretch.','Do not let elbows lift off pad.'],
    tip:'Eliminates any cheating. Great for adding lower bicep thickness.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','cable_curl','concentration_curl','db_21s','reverse_curl','cable_hammer_curl','machine_curl']},
  cable_curl:{name:'Cable Curl',muscles:'Biceps (constant tension)',
    steps:['Low cable, straight bar or EZ bar. Stand shoulder-width.','Curl up -- keep elbows still.','Cable provides tension at the bottom where DBs are lightest.'],
    tip:'Constant tension throughout the movement is the advantage over DBs.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','concentration_curl','preacher_curl','db_21s','reverse_curl','cable_hammer_curl','machine_curl']},
  db_21s:{name:'DB 21s (Bicep)',muscles:'Biceps (extended time under tension)',
    steps:['7 reps bottom half: full hang to elbows at 90°.','7 reps top half: 90° to full squeeze.','7 full-range reps to finish.','All 21 without setting the DBs down.'],
    tip:'Go much lighter than your normal curl weight -- the burn sneaks up fast.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','concentration_curl','preacher_curl','cable_curl','reverse_curl','cable_hammer_curl','machine_curl']},
  reverse_curl:{name:'Reverse Curl (DB or EZ Bar)',muscles:'Brachioradialis · Forearms · Biceps',
    steps:['Overhand (palms-down) grip at thighs.','Curl up keeping wrists straight, elbows pinned to sides.','Squeeze at top.','Lower slowly -- 2–3 s.'],
    tip:'Builds the forearm and elbow-flexor strength most curl work misses. Go light.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','concentration_curl','preacher_curl','cable_curl','db_21s','cable_hammer_curl','machine_curl']},
  cable_hammer_curl:{name:'Cable Hammer Curl (Rope)',muscles:'Brachialis · Brachioradialis · Biceps',
    steps:['Low cable with rope attachment. Neutral grip on the rope ends.','Curl up without rotating the wrists.','Squeeze 1 s at top.','Lower slowly -- tension stays on through the bottom.'],
    tip:'The cable keeps tension where DB hammer curls go slack at the bottom.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','concentration_curl','preacher_curl','cable_curl','db_21s','reverse_curl','machine_curl']},
  machine_curl:{name:'Machine Bicep Curl',muscles:'Biceps (isolated)',
    steps:['Set seat so elbows align with the machine pivot.','Arms on pad, grip handles.','Curl to full contraction, squeeze 1 s.','Lower with control to a full stretch.'],
    tip:'Zero body swing possible. Ideal for high-rep finishers and drop sets.',
    alts:['db_bicep_curl','hammer_curl','incline_curl','concentration_curl','preacher_curl','cable_curl','db_21s','reverse_curl','cable_hammer_curl']},

  // DEADLIFT / HIP HINGE COMPOUND
  db_deadlift:{name:'DB Deadlift',muscles:'Hamstrings · Glutes · Lower Back · Quads · Traps',
    steps:['DBs on floor outside feet. Hinge and grip.','Flat back, chest tall, hips above knees.','Drive through floor -- hips and shoulders rise together.','Stand tall, squeeze glutes. Lower with control.'],
    tip:'Think "push the floor away" not "pull the weight up." Full compound movement.',
    alts:['rdl','hip_thrust','kb_swing','stiff_leg_dl','sumo_rdl','trap_bar_dl','good_morning','cable_pull_through','nordic_curl']},
  trap_bar_dl:{name:'Trap Bar Deadlift',muscles:'Quads · Glutes · Hamstrings · Lower Back',
    steps:['Stand inside hex bar. Grip handles.','Hinge to grab, flat back, hips above knees.','Drive through floor simultaneously with hips and shoulders.','Lockout -- squeeze glutes, stand tall.'],
    tip:'Trap bar reduces lower back stress vs conventional. Higher quad involvement. Excellent for athletes.',
    alts:['rdl','db_deadlift','hip_thrust','kb_swing','stiff_leg_dl','sumo_rdl','good_morning','cable_pull_through','nordic_curl']},

  // -- CORE (anti-extension, anti-rotation, anti-lateral flexion) --
  plank:{name:'Plank',muscles:'Core (anti-extension) · Glutes · Shoulders',
    steps:['Forearms on floor, elbows under shoulders. Feet hip-width.','Body straight line head to heels.','Squeeze glutes and brace abs hard -- no sagging hips.','Breathe steadily. Hold for time.'],
    tip:'Quality over duration. 30 seconds with perfect form beats 2 minutes with sagging hips. Progress by adding load (plate on back).',
    alts:['side_plank','dead_bug','pallof_press','ab_wheel','hanging_knee_raise','farmer_carry','suitcase_carry']},
  side_plank:{name:'Side Plank',muscles:'Obliques · QL · Glute Medius',
    steps:['Lie on side. Forearm on floor, elbow under shoulder.','Lift hips so body is straight line from ankle to head.','Top arm reaches toward ceiling or rests on hip.','Hold for time, then switch sides.'],
    tip:'Anti-lateral flexion is often neglected. Crucial for spine stability under one-sided loads (think patient carries).',
    alts:['plank','dead_bug','pallof_press','ab_wheel','hanging_knee_raise','suitcase_carry']},
  dead_bug:{name:'Dead Bug',muscles:'Deep Core · Transverse Abdominis · Hip Flexors',
    steps:['Lie on back, arms straight up, knees over hips at 90°.','Press lower back into floor -- maintain throughout.','Slowly extend opposite arm and leg toward floor.','Return controlled. Alternate sides.'],
    tip:'Trains the core to resist extension under limb movement. Foundation for everything else. Slow is hard.',
    alts:['plank','side_plank','pallof_press','ab_wheel','hanging_knee_raise']},
  pallof_press:{name:'Pallof Press (Cable)',muscles:'Core (anti-rotation) · Obliques · Shoulders',
    steps:['Cable at chest height. Stand sideways to cable, feet shoulder-width.','Grip handle with both hands at chest.','Press arms straight out, resisting the rotational pull.','Hold 2 sec, return. Complete all reps, switch sides.'],
    tip:'The cable WANTS to twist you. Your job is to refuse. Single best anti-rotation exercise for occupational core strength.',
    alts:['plank','side_plank','dead_bug','ab_wheel','hanging_knee_raise','suitcase_carry']},
  ab_wheel:{name:'Ab Wheel Rollout',muscles:'Core · Lats · Shoulders · Hip Flexors',
    steps:['Kneel on pad, grip ab wheel under shoulders.','Roll forward, extending arms -- keep core braced, no back sag.','Roll only as far as you can without losing flat back.','Pull back using abs and lats.'],
    tip:'Start kneeling, partial range. Build to full extension before attempting from feet. One of the hardest core exercises.',
    alts:['plank','side_plank','dead_bug','pallof_press','hanging_knee_raise']},
  hanging_knee_raise:{name:'Hanging Knee Raise',muscles:'Lower Abs · Hip Flexors · Grip',
    steps:['Hang from pull-up bar, dead hang.','Knees up toward chest -- curl pelvis at top.','Lower slowly, no swing.','Progress to straight leg raises.'],
    tip:'The pelvic tilt at the top is what hits the abs. Just lifting knees without that = mostly hip flexor work.',
    alts:['plank','side_plank','dead_bug','pallof_press','ab_wheel']},

  // -- LOADED CARRIES (occupational -- grip + core + gait under load) --
  farmer_carry:{name:'Farmer Carry',muscles:'Grip · Core · Traps · Forearms · Glutes',
    steps:['Heavy DBs or KBs at sides. Stand tall, shoulders pulled back.','Walk forward with normal gait. Do NOT shuffle.','Brace core, breathe steady. No side-bending.','Carry for distance or time.'],
    tip:'Single most occupationally relevant exercise for first responders. Pair patient transfers and gear carries with this. Start ~25% bodyweight per hand, build up.',
    alts:['suitcase_carry','overhead_carry','plank','side_plank','pallof_press']},
  suitcase_carry:{name:'Suitcase Carry',muscles:'Core (anti-lateral flexion) · Grip · Obliques · QL',
    steps:['One heavy DB or KB in ONE hand. Other hand free.','Walk tall -- do NOT let weighted side dip down.','Active brace against the asymmetric load.','Carry for distance, then switch sides.'],
    tip:'The unbalanced load forces obliques and QL to work hard. Direct training for one-sided carries like jump bags or scene gear.',
    alts:['farmer_carry','overhead_carry','side_plank','pallof_press','plank']},
  overhead_carry:{name:'Overhead Carry',muscles:'Shoulders · Core · Upper Back · Grip',
    steps:['Press DB or KB overhead with one or both arms.','Lock arms out -- bicep by ear.','Walk forward maintaining the lockout.','Tight core, ribs down, no arching back.'],
    tip:'Tests shoulder stability and overhead mobility under fatigue. Start light. Excellent for overhead reach jobs (extrication, hose pulls).',
    alts:['farmer_carry','suitcase_carry','plank','pallof_press','db_shoulder_press']},

  // -- CALVES --
  standing_calf_raise:{name:'Standing Calf Raise',muscles:'Gastrocnemius (upper calf)',
    steps:['Stand on edge of step, balls of feet on edge, heels off.','Hold DBs at sides or use calf raise machine.','Lower heels below step level -- feel stretch.','Press up onto toes hard, squeeze 1 sec at top.','Lower slowly.'],
    tip:'Knee straight = gastroc (upper calf). Full ROM is key -- most people barely move. Reps 10–15.',
    alts:['seated_calf_raise','single_leg_calf_raise','walking_lunge','step_ups']},
  seated_calf_raise:{name:'Seated Calf Raise',muscles:'Soleus (lower calf)',
    steps:['Seated calf machine or DB on knees with feet on plate.','Knees bent 90° throughout.','Lower heels, stretch.','Press up onto toes, hold 1 sec.','Lower slowly.'],
    tip:'Knee bent = soleus (lower calf). Often more responsive than gastroc. Pair with standing calf raise for full development.',
    alts:['standing_calf_raise','single_leg_calf_raise','walking_lunge','step_ups']},
  single_leg_calf_raise:{name:'Single-Leg Calf Raise',muscles:'Gastrocnemius · Balance · Foot Stability',
    steps:['Stand on one foot on edge of step. Other foot lifted.','Hold DB on same side for added load.','Lower heel below step.','Press up onto toes, hold 1 sec.','Complete all reps, switch sides.'],
    tip:'Catches and corrects side-to-side imbalances. Helps with ankle stability on uneven ground.',
    alts:['standing_calf_raise','seated_calf_raise','walking_lunge','step_ups']},

  // === BODY-PART SPLIT additions ======================================
  cable_fly:{name:'Cable Fly (Chest)',muscles:'Pecs · Front Delts',
    steps:['Cables at upper position. Stand center, slight forward lean.','Grab handles, arms slightly bent, palms forward.','Bring hands together in front of chest in arc motion.','Squeeze pecs at midline. Slow return.'],
    tip:'Stretch is where the chest grows. Don\'t shortcut the lengthening phase.',
    alts:['db_fly','db_bench','db_incline','pec_deck','push_up']},
  db_fly:{name:'DB Fly',muscles:'Pecs · Front Delts',
    steps:['Lie on bench, DBs above chest, slight elbow bend.','Lower DBs in wide arc, feeling chest stretch.','Bring DBs back up in same arc -- don\'t bend elbows more at top.','Squeeze pecs together at top.'],
    tip:'Keep that slight elbow bend locked throughout. Going too heavy turns this into a press.',
    alts:['cable_fly','db_bench','db_incline','pec_deck','push_up']},
  skull_crusher_ez:{name:'Skull Crusher (EZ Bar)',muscles:'Triceps (all heads)',
    steps:['Lie on bench, EZ bar held overhead, arms vertical.','Lower bar to forehead by bending elbows only -- upper arms stay vertical.','Press back up using triceps.','Lock out without moving upper arms.'],
    tip:'The "skull crusher" name is a warning. Control the descent. Elbows track inward slightly.',
    alts:['db_tricep_ext','tricep_pushdown','close_grip_bench','tricep_kickback','dip']},
  tricep_pushdown:{name:'Tricep Pushdown (Cable)',muscles:'Triceps (lateral head emphasis)',
    steps:['Cable at top, rope or straight bar attachment.','Elbows pinned to sides throughout.','Push down until arms locked, squeeze 1 sec.','Slow return -- feel stretch at top.'],
    tip:'Elbow position is everything. If they flare out, you\'re recruiting chest. Lock them at your sides.',
    alts:['skull_crusher_ez','db_tricep_ext','close_grip_bench','tricep_kickback','dip']},
  tricep_kickback:{name:'Tricep Kickback (DB)',muscles:'Triceps · Rear Delt (stabilizer)',
    steps:['Bent over, one hand on bench, DB in opposite hand.','Upper arm parallel to floor and locked there.','Extend forearm back until arm is straight.','Squeeze, slow return.'],
    tip:'Low-load isolation. Great for tricep finishers.',
    alts:['db_tricep_ext','tricep_pushdown','skull_crusher_ez','close_grip_bench','dip']},
  close_grip_bench:{name:'Close-Grip Bench Press',muscles:'Triceps · Inner Chest',
    steps:['Bench press setup, hands ~shoulder-width (not narrower than that).','Lower bar to lower chest, elbows tucked.','Press back up driving through triceps.','Lock out elbows fully.'],
    tip:'Don\'t go narrower than shoulder-width -- wrist pain isn\'t worth it. Tucking elbows is what loads triceps.',
    alts:['skull_crusher_ez','db_tricep_ext','tricep_pushdown','dip','push_up']},
  dip:{name:'Dips (Triceps focus)',muscles:'Triceps · Lower Chest · Front Delts',
    steps:['Dip bars, body upright (not leaning forward -- that targets chest).','Lower until upper arms parallel to floor.','Press back up using triceps.','Lock out fully.'],
    tip:'Upright torso = triceps. Leaning forward = chest. Pick your focus and commit.',
    alts:['close_grip_bench','tricep_pushdown','skull_crusher_ez','db_tricep_ext','push_up']},
  bent_over_row:{name:'Bent-Over Row (Barbell)',muscles:'Mid Back · Lats · Rear Delts',
    steps:['Hinge at hips with barbell, back flat, knees slightly bent.','Row bar to lower chest/upper abs.','Squeeze shoulder blades.','Slow return with control.'],
    tip:'Bigger compound version of DB row. Form first, weight second -- keep that flat back.',
    alts:['db_row','cable_row','lat_pulldown','pullups','t_bar_row']},
  chin_up:{name:'Chin-Up (Underhand)',muscles:'Biceps · Lats · Mid Back',
    steps:['Underhand grip on pull-up bar, shoulder-width.','Hang fully, pull body up until chin clears bar.','Squeeze biceps and lats at top.','Lower with control to full hang.'],
    tip:'More biceps than pull-ups. The "best bicep exercise nobody does" because it\'s hard. Add weight if you can do 10+.',
    alts:['pullups','db_bicep_curl','preacher_curl','hammer_curl','cable_curl']},
  reverse_pec_deck:{name:'Reverse Pec Deck',muscles:'Rear Delts · Mid Traps · Rhomboids',
    steps:['Sit facing the pec deck (reverse direction). Grip handles.','Pull handles out and back, squeezing shoulder blades.','Pause 1 sec at full contraction.','Slow controlled return.'],
    tip:'Cleaner ROM than DB rear delt flies -- machine doesn\'t cheat for you.',
    alts:['rear_delt_fly','face_pull','db_row','cable_row']},
  front_raise:{name:'Front Raise (DB)',muscles:'Front Delts',
    steps:['DBs in front of thighs, arms straight.','Raise one or both up to shoulder height in front of body.','Slow controlled descent.','No swinging.'],
    tip:'Front delts already get hammered by bench/incline. One light set is plenty.',
    alts:['db_shoulder_press','lateral_raise','arnold_press']},
  shrug:{name:'DB Shrug',muscles:'Upper Traps',
    steps:['Heavy DBs at sides, arms straight, stand tall.','Lift shoulders straight up toward ears.','Hold 1 sec at top.','Slow descent. No rolling motion.'],
    tip:'Don\'t roll the shoulders -- pure vertical movement. Rolling is an old myth and risks the rotator cuff.',
    alts:['farmer_carry','db_row','db_shoulder_press']},

  // === BODYWEIGHT / HIIT track ========================================
  push_up:{name:'Push-Up',muscles:'Chest · Triceps · Front Delts · Core',
    steps:['Plank position, hands shoulder-width, body straight.','Lower chest to floor, elbows ~45° from torso.','Press back up to start.','Brace core throughout -- no sagging hips.'],
    tip:'Hands wider = more chest. Hands closer = more tricep (diamond). Both build the chest.',
    alts:['db_bench','db_incline','dip','incline_push_up','decline_push_up','diamond_push_up']},
  incline_push_up:{name:'Incline Push-Up',muscles:'Lower Chest · Triceps · Core',
    steps:['Hands on elevated surface (couch, bench, counter).','Body angled, plank-tight from head to heels.','Lower chest to surface, press back up.','Higher surface = easier.'],
    tip:'Regression for standard push-ups. Lower the surface as you build strength.',
    alts:['push_up','decline_push_up','diamond_push_up','db_bench']},
  decline_push_up:{name:'Decline Push-Up',muscles:'Upper Chest · Front Delts · Triceps',
    steps:['Feet on elevated surface, hands on floor.','Plank position, body straight.','Lower chest toward floor.','Press back up.'],
    tip:'Progression from standard. Hits upper chest harder. Higher feet = harder.',
    alts:['push_up','diamond_push_up','db_incline','dip']},
  diamond_push_up:{name:'Diamond Push-Up',muscles:'Triceps (heavy) · Inner Chest',
    steps:['Hands together under chest, thumbs and index fingers forming diamond.','Lower chest to hands.','Press back up.','Keep elbows tracking close to torso.'],
    tip:'Tricep-dominant push-up variation. Hard. Build to it from regular push-ups.',
    alts:['push_up','decline_push_up','close_grip_bench','dip']},
  pike_push_up:{name:'Pike Push-Up',muscles:'Shoulders · Triceps · Upper Chest',
    steps:['Push-up start, then pike hips up -- body in inverted V.','Bend elbows, lower head toward floor between hands.','Press back up to pike position.','Higher feet = more shoulder load.'],
    tip:'Bodyweight overhead press substitute. Building block toward handstand push-ups.',
    alts:['handstand_hold','push_up','decline_push_up','db_shoulder_press']},
  handstand_hold:{name:'Wall Handstand Hold',muscles:'Shoulders · Core · Wrists',
    steps:['Hands on floor 6" from wall, kick up to handstand.','Heels touch wall, stack joints (wrists, elbows, shoulders, hips, ankles).','Push floor away -- no shoulder shrug.','Hold for time.'],
    tip:'Build static strength before handstand push-ups. Quality holds > sloppy reps.',
    alts:['pike_push_up','db_shoulder_press','plank']},
  inverted_row:{name:'Inverted Row',muscles:'Mid Back · Lats · Rear Delts · Biceps',
    steps:['Bar/sturdy table at hip-to-chest height. Grip overhand, body underneath.','Hang at full arm extension, body straight.','Pull chest to bar, squeeze shoulder blades.','Slow controlled descent.'],
    tip:'Bodyweight row. Higher bar = easier, lower bar = harder. Feet elevated = harder still.',
    alts:['pullups','db_row','lat_pulldown','chin_up']},
  bw_squat:{name:'Bodyweight Squat',muscles:'Quads · Glutes · Core',
    steps:['Feet shoulder-width, toes slightly out.','Sit back and down, chest tall, knees track over toes.','Descend until thighs parallel (or lower).','Drive through heels to stand.'],
    tip:'Foundation of all squat work. Build to 30+ reps before adding load.',
    alts:['goblet_squat','jump_squat','pistol_progression','lunge_bw']},
  jump_squat:{name:'Jump Squat',muscles:'Quads · Glutes · Power · Calves',
    steps:['Descend into squat.','Explode up, jumping as high as possible.','Land softly, immediately descend into next rep.','Knees soft on landing.'],
    tip:'Plyometric/HIIT staple. Land softly -- joints take the brunt if you slap-land.',
    alts:['bw_squat','goblet_squat','box_jump','jump_lunge','burpee']},
  pistol_progression:{name:'Pistol Squat Progression',muscles:'Quads · Glutes · Balance · Mobility',
    steps:['Stand on one leg, other leg extended forward.','Slowly descend by bending standing leg.','Use TRX or door frame for assist as needed.','Press back up, stay tall.'],
    tip:'Bodyweight single-leg squat. Progress: assisted → unassisted partial → full pistol. Takes months.',
    alts:['bulgarian_split','bw_squat','step_ups','reverse_lunge','split_squat']},
  lunge_bw:{name:'Bodyweight Lunge',muscles:'Quads · Glutes · Hamstrings · Balance',
    steps:['Step forward or backward, lower back knee toward floor.','Front shin vertical, knee tracks over ankle.','Drive through front heel to return.','Alternate or all one side.'],
    tip:'Forward lunges build quads more, reverse lunges easier on knees. Pick based on what your knees say.',
    alts:['reverse_lunge','split_squat','walking_lunge','bulgarian_split','jump_lunge']},
  jump_lunge:{name:'Jump Lunge (Plyometric)',muscles:'Quads · Glutes · Power · Cardio',
    steps:['Start in lunge position.','Jump explosively, switch legs mid-air.','Land in opposite lunge.','Continue alternating.'],
    tip:'High demand. Keep that front shin vertical even when fatigued -- that\'s when knees go bad.',
    alts:['jump_squat','lunge_bw','box_jump','burpee']},
  glute_bridge:{name:'Glute Bridge',muscles:'Glutes · Hamstrings · Core',
    steps:['Lie on back, knees bent, feet flat on floor near butt.','Push through heels to lift hips up.','Squeeze glutes hard at top.','Slow descent.'],
    tip:'Bodyweight hip thrust substitute. Single-leg version when bilateral becomes easy.',
    alts:['single_leg_glute_bridge','hip_thrust','rdl','cable_pull_through']},
  single_leg_glute_bridge:{name:'Single-Leg Glute Bridge',muscles:'Glutes · Hamstrings · Core',
    steps:['Lie on back, one knee bent foot on floor, other leg extended.','Push through standing heel, lift hips.','Squeeze glute at top, keep extended leg in line with body.','Slow descent, switch sides each set.'],
    tip:'Unilateral glute work that catches imbalances. Great for runners and on-foot first responders.',
    alts:['glute_bridge','hip_thrust','bulgarian_split','step_ups']},
  burpee:{name:'Burpee',muscles:'Full Body · Cardio · Power',
    steps:['Stand. Squat down, hands on floor.','Kick legs back to plank, do a push-up (optional).','Jump feet back to hands.','Stand and jump with hands overhead.'],
    tip:'The classic full-body HIIT exercise. Drop the push-up if pace is the goal. 10 burpees = a serious minute.',
    alts:['mountain_climber','jump_squat','bear_crawl','jump_lunge']},
  mountain_climber:{name:'Mountain Climber',muscles:'Core · Cardio · Hip Flexors · Shoulders',
    steps:['Plank position, hands under shoulders.','Drive one knee toward chest.','Switch legs quickly, like running in place.','Keep hips low -- no piking up.'],
    tip:'Cardio + core + shoulder stability all at once. Pace it like sprint intervals.',
    alts:['burpee','bear_crawl','plank','high_knees']},
  bear_crawl:{name:'Bear Crawl',muscles:'Core · Shoulders · Quads · Coordination',
    steps:['Hands and feet on floor, knees hovering just off ground.','Crawl forward -- opposite hand and foot move together.','Knees stay low (1-2" off floor).','Quick small steps.'],
    tip:'Anti-rotation core work disguised as cardio. Looks easy until you try it.',
    alts:['mountain_climber','crab_walk','burpee','plank']},
  crab_walk:{name:'Crab Walk',muscles:'Shoulders · Triceps · Glutes · Core',
    steps:['Sit, hands behind you, feet flat in front.','Lift hips so body forms reverse plank.','Walk forward or backward.','Hips stay lifted throughout.'],
    tip:'Hits triceps and posterior chain together -- rare combo. Burns the back of the arms.',
    alts:['bear_crawl','plank','glute_bridge','dip']},
  high_knees:{name:'High Knees',muscles:'Cardio · Hip Flexors · Calves',
    steps:['Stand tall, run in place.','Drive knees up toward chest -- at least to belt height.','Pump arms.','Keep pace fast.'],
    tip:'Easy HIIT warm-up or finisher. Tabata-style for 4 min wrecks the cardio system.',
    alts:['mountain_climber','burpee','jump_squat','jumping_jack']},
  jumping_jack:{name:'Jumping Jack',muscles:'Cardio · Shoulders · Calves',
    steps:['Stand feet together, arms at sides.','Jump feet out wide while raising arms overhead.','Jump back to start.','Keep pace consistent.'],
    tip:'Warm-up classic. 30-60 sec gets the heart rate primed for harder intervals.',
    alts:['high_knees','mountain_climber','burpee','jump_squat']},
  box_jump:{name:'Box Jump',muscles:'Quads · Glutes · Power · Calves',
    steps:['Stand in front of sturdy box (12-30" tall).','Quarter squat, swing arms back.','Explode up onto box, landing soft with quarter squat.','Step DOWN (don\'t jump down -- protects knees).'],
    tip:'Step down every rep. Jumping down compounds knee load over reps and is the #1 box jump injury.',
    alts:['jump_squat','jump_lunge','burpee','step_ups']},
  jump_rope:{name:'Jump Rope',muscles:'Cardio · Calves · Coordination',
    steps:['Rope handles in each hand, rope behind feet.','Small jumps, just clearing the rope.','Light on toes, knees soft.','Wrists turn the rope, not arms.'],
    tip:'Most underrated cardio tool. 10 min jump rope ≈ 30 min jogging at higher impact efficiency.',
    alts:['jumping_jack','high_knees','box_jump','mountain_climber']},
  hollow_hold:{name:'Hollow Body Hold',muscles:'Deep Core · Hip Flexors',
    steps:['Lie on back. Arms overhead, legs straight.','Lift shoulders and legs off floor, lower back pressed into floor.','Hold the "banana" position.','Breathe steadily. Hold for time.'],
    tip:'Gymnastics staple. Foundation for advanced bodyweight skills. Lower back must stay glued to floor.',
    alts:['plank','dead_bug','hanging_knee_raise','ab_wheel']},
  
  // === HIIT PROTOCOL BLOCKS (treated as "exercises" so they fit the same UI) ===
  tabata_burpees:{name:'Tabata Burpees (4 min)',muscles:'Full Body · Maximal Cardio',
    steps:['Set a Tabata timer: 20 sec work / 10 sec rest, 8 rounds = 4 min total.','Burpees for the 20 sec all-out.','Rest fully for 10 sec.','Count total reps across rounds -- aim to maintain.'],
    tip:'Authentic Tabata is ALL OUT effort. If you can do more than 8-10 burpees per round, push harder. Track total reps weekly.',
    alts:['tabata_mountain_climbers','amrap_full_body','emom_squats']},
  tabata_mountain_climbers:{name:'Tabata Mountain Climbers (4 min)',muscles:'Core · Cardio',
    steps:['20 sec all-out mountain climbers.','10 sec rest.','Repeat 8 rounds = 4 min total.','Count reps -- both knees count as one rep.'],
    tip:'Lower-impact Tabata option than burpees. Still wrecks the cardio system.',
    alts:['tabata_burpees','amrap_full_body','emom_squats']},
  emom_squats:{name:'EMOM Squats (10 min)',muscles:'Quads · Glutes · Conditioning',
    steps:['Every Minute On the Minute, do 15 bodyweight squats.','Rest remainder of the minute.','When reps spill into the next minute, you\'re done.','Goal: complete all 10 rounds.'],
    tip:'EMOM forces consistency. Rest decreases as you fatigue. 150 squats in 10 min is no joke.',
    alts:['tabata_burpees','amrap_full_body','jump_squat']},
  amrap_full_body:{name:'AMRAP Full Body (15 min)',muscles:'Full Body · Conditioning',
    steps:['Set 15-min timer. Do as many rounds as possible:','10 push-ups','15 bodyweight squats','20 mountain climbers (count both knees)','30 sec plank','Track total rounds completed each week.'],
    tip:'CrossFit-style metcon. Steady pace beats sprint-and-die. Track rounds to measure progress.',
    alts:['tabata_burpees','emom_squats','tabata_mountain_climbers']},
  sprint_intervals:{name:'Sprint Intervals (Outdoor)',muscles:'Power · VO2 Max · Legs',
    steps:['Warm up 5 min easy jog.','Sprint 30 sec at 85-90% effort.','Recover 90 sec walking.','Repeat 6-8 rounds. Cool down 5 min.'],
    tip:'Best evidence-based cardio for first-responder fitness. Mimics scene-burst physiology. Outdoor track or open field.',
    alts:['jump_rope','tabata_burpees','box_jump','emom_squats']},

  // KETTLEBELL
  kb_turkish_getup:{name:'KB Turkish Get-Up',muscles:'Full Body · Core · Shoulder Stabilizers · Hips',
    steps:['Lie on back, KB pressed overhead in one hand, same-side knee bent.','Roll onto opposite elbow, then hand. Bridge hips up.','Sweep back leg under you to kneeling. Stand up.','Reverse every step back to the floor. That is 1 rep.'],
    tip:'The single best exercise for total-body stabilizer strength (Liebenson, 2011). Go slow -- each rep should take 30-45 seconds. Master the pattern with no weight first.',
    alts:['kb_windmill','kb_gladiator','plank','dead_bug']},
  kb_clean_press:{name:'KB Clean & Press',muscles:'Full Body · Shoulders · Core · Glutes',
    steps:['KB on floor between feet. Hike and clean it to rack position in one motion -- elbow tight to body.','From rack, press overhead to full lockout, bicep near ear.','Lower to rack, then drop back to hike position.','All reps one side, then switch.'],
    tip:'The clean is a fast hip hinge, not an arm curl. Let the hip snap do the work. The press is strict -- no leg drive (Lake & Lauder, 2012).',
    alts:['db_shoulder_press','arnold_press','kb_swing','kb_turkish_getup']},
  kb_windmill:{name:'KB Windmill',muscles:'Obliques · Hips · Shoulder Stability · Hamstrings',
    steps:['KB pressed overhead, feet angled 45° away from the loaded side.','Push hip out toward the KB side. Slowly hinge and rotate torso down.','Free hand slides down the inside of the front leg toward the floor.','Drive back up through the hip, eyes on the KB throughout.'],
    tip:'Deep lateral core and hip stability under load (McGill, 2010). Start light -- this exposes mobility limits fast. Keep the overhead arm locked and packed.',
    alts:['kb_turkish_getup','kb_gladiator','side_plank','dead_bug']},
  kb_renegade_row:{name:'KB Renegade Row',muscles:'Lats · Rhomboids · Anti-Rotation Core · Triceps',
    steps:['Two KBs on floor, shoulder width. Get into high plank on the handles.','Shift weight to one arm, row the other KB to hip. Minimize hip rotation.','Lower with control, repeat other side. That is 1 rep.','Keep feet wide for stability -- narrow feet make it harder.'],
    tip:'One of the highest anti-rotation core demands of any exercise. The row is secondary -- resisting rotation is the point. If hips sway, go lighter.',
    alts:['db_row','plank','dead_bug','kb_gladiator']},
  kb_halo:{name:'KB Halo',muscles:'Shoulders · Rotator Cuff · Core · Thoracic Mobility',
    steps:['Hold KB by the horns, bottoms-up at chest height.','Circle the KB around your head -- close to the skull, elbows tight.','Complete a full orbit, then reverse direction.','Keep core braced and ribs down throughout.'],
    tip:'Outstanding shoulder mobility and stability warmup. Use as the first exercise or between heavy sets. Light weight -- this is about control, not load.',
    alts:['face_pull','lateral_raise','kb_windmill','kb_turkish_getup']},
  kb_gladiator:{name:'KB Gladiator',muscles:'Obliques · Glutes · Shoulder Stability · Full Body',
    steps:['Start in side plank on one hand, KB in top hand pressed overhead.','Top leg steps forward into a lunge position while maintaining the overhead hold.','Drive back to side plank, then rotate into a push-up position and through to the other side.','The full sequence is: side plank → lunge → push-up → opposite side plank. That is 1 rep.'],
    tip:'An advanced full-body stabilizer chain exercise. Combines anti-lateral flexion, overhead stability, and hip control in one movement. Master the side plank hold with KB overhead before attempting the full flow. Scale by removing the lunge or doing it unloaded.',
    alts:['kb_turkish_getup','kb_windmill','kb_renegade_row','plank']}
};

// -- 3-Day Evidence-Based Whole-Body Program -------------------------------
// Basis: Schoenfeld et al. (2016) -- twice-weekly frequency per muscle group optimal.
// Each day trains upper AND lower body. Days alternate push/pull emphasis to allow recovery.
var WO_PROGRAM=[
  {
    day:'A',name:'Push + Squat (Heavy)',
    rationale:'Horizontal push and knee-dominant squat lead the session heavy -- 6-10 reps, full 2-min rest -- since higher-intensity loading is the strongest driver of strength and bone density after 50. Vertical push and a row balance the pressing volume for shoulder health and weekly back frequency. Tricep, calves, and core finish it off.',
    exercises:[
      {id:'db_bench',sets:'4×6–8',rest:'2 min',note:'Heavy horizontal push -- leave 1-2 reps in the tank'},
      {id:'goblet_squat',sets:'3×6–10',rest:'2 min',note:'Heavy knee-dominant lower'},
      {id:'db_shoulder_press',sets:'3×8–10',rest:'90 sec',note:'Vertical push'},
      {id:'chest_supported_row',sets:'3×10–12',rest:'90 sec',note:'Horizontal pull -- balances the pressing volume'},
      {id:'db_tricep_ext',sets:'2×12–15',rest:'60 sec',note:'Tricep long-head'},
      {id:'standing_calf_raise',sets:'3×10–15',rest:'45 sec',note:'Gastroc'},
      {id:'plank',sets:'3×30–45 sec',rest:'45 sec',note:'Core finisher -- anti-extension'}
    ]
  },
  {
    day:'B',name:'Pull + Hinge (Heavy)',
    rationale:'Trap bar deadlift anchors the session heavy -- 8-10 reps, full 2-min rest -- the single highest-payoff lift for strength and bone density at this age. Pull-ups run on a rep-target progression instead of open-ended max sets. Incline press adds the week\'s second chest session. Unilateral leg work, rear delts, biceps, and deep core round it out.',
    exercises:[
      {id:'pullups',sets:'3×6–10',rest:'2 min',note:'Vertical pull -- add load once you clear the top of the range'},
      {id:'trap_bar_dl',sets:'4×8–10',rest:'2 min',note:'Heavy hip hinge -- the day\'s anchor lift'},
      {id:'db_incline',sets:'3×10–12',rest:'90 sec',note:'Upper chest -- second weekly chest session'},
      {id:'bulgarian_split',sets:'3×8–10 each',rest:'90 sec',note:'Unilateral posterior'},
      {id:'face_pull',sets:'3×15–20',rest:'60 sec',note:'Rear delt / rotator cuff'},
      {id:'db_bicep_curl',sets:'2×10–12',rest:'60 sec',note:'Bicep isolation'},
      {id:'dead_bug',sets:'3×8 each side',rest:'45 sec',note:'Core finisher -- deep core'}
    ]
  },
  {
    day:'C',name:'Full-Body Compound + Carry',
    rationale:'Hip hinge compound + upper chest. Horizontal pull + quad variation. Lateral delt + frontal plane lower. Loaded carry for grip, core, occupational strength.',
    exercises:[
      {id:'db_deadlift',sets:'3×8–10',rest:'2 min',note:'Full compound hip hinge'},
      {id:'db_incline',sets:'3×10–12',rest:'90 sec',note:'Upper chest push'},
      {id:'cable_row',sets:'3×10–12',rest:'90 sec',note:'Horizontal pull'},
      {id:'hack_squat',sets:'3×12–15',rest:'90 sec',note:'Quad-dominant variation'},
      {id:'lateral_raise',sets:'3×12–15',rest:'60 sec',note:'Lateral delt isolation'},
      {id:'db_lateral_lunge',sets:'3×12 each',rest:'60 sec',note:'Frontal plane lower'},
      {id:'farmer_carry',sets:'3×30–40 sec',rest:'60 sec',note:'Loaded carry -- grip + core + occupational'}
    ]
  }
];

// -- BODY-PART SPLIT (Option 2: Chest/Tri · Back/Bi · Legs/Shoulders) --------
// Evidence basis: Classic isolation-focused split for hypertrophy. Higher volume
// per muscle on its dedicated day. Best when frequency-per-muscle isn't a priority
// and you want focused exhaustion of one area at a time.
var WO_PROGRAM_BODYSPLIT=[
  {
    day:'A',name:'Chest + Triceps',
    rationale:'High-volume chest work paired with the muscle group most synergistic -- triceps. Chest compounds first while fresh, then isolation work, then tricep finishers.',
    exercises:[
      {id:'db_bench',sets:'4×8–10',rest:'90 sec',note:'Primary chest compound'},
      {id:'db_incline',sets:'3×10–12',rest:'90 sec',note:'Upper chest emphasis'},
      {id:'cable_fly',sets:'3×12–15',rest:'60 sec',note:'Chest stretch + pump'},
      {id:'close_grip_bench',sets:'3×8–10',rest:'90 sec',note:'Compound tricep movement'},
      {id:'skull_crusher_ez',sets:'3×10–12',rest:'60 sec',note:'Long head emphasis'},
      {id:'tricep_pushdown',sets:'3×12–15',rest:'45 sec',note:'Lateral head finisher'},
      {id:'plank',sets:'3×30–45 sec',rest:'45 sec',note:'Core finisher'}
    ]
  },
  {
    day:'B',name:'Back + Biceps',
    rationale:'Vertical pull, horizontal pull, lat isolation, then bicep work. Back gets the priority -- biceps are heavily involved already, so isolation comes last.',
    exercises:[
      {id:'pullups',sets:'4×max',rest:'2 min',note:'Vertical pull priority'},
      {id:'bent_over_row',sets:'4×8–10',rest:'90 sec',note:'Heavy compound row'},
      {id:'lat_pulldown',sets:'3×10–12',rest:'90 sec',note:'Lat isolation'},
      {id:'face_pull',sets:'3×15–20',rest:'45 sec',note:'Rear delts + rotator cuff'},
      {id:'db_bicep_curl',sets:'3×10–12',rest:'60 sec',note:'Bicep compound'},
      {id:'hammer_curl',sets:'3×10–12',rest:'60 sec',note:'Brachialis emphasis'},
      {id:'dead_bug',sets:'3×8 each side',rest:'45 sec',note:'Anti-extension core'}
    ]
  },
  {
    day:'C',name:'Legs + Shoulders',
    rationale:'Quad-dominant + hip-dominant lower work, then full shoulder rotation (front, side, rear delts). Most demanding day -- leave it for when energy is highest.',
    exercises:[
      {id:'goblet_squat',sets:'4×8–10',rest:'2 min',note:'Quad-dominant compound'},
      {id:'rdl',sets:'4×8–10',rest:'90 sec',note:'Posterior chain'},
      {id:'bulgarian_split',sets:'3×10 each',rest:'90 sec',note:'Unilateral'},
      {id:'standing_calf_raise',sets:'4×12–15',rest:'45 sec',note:'Calves'},
      {id:'db_shoulder_press',sets:'4×8–10',rest:'90 sec',note:'Vertical push'},
      {id:'lateral_raise',sets:'3×12–15',rest:'45 sec',note:'Side delts'},
      {id:'rear_delt_fly',sets:'3×12–15',rest:'45 sec',note:'Rear delts'}
    ]
  }
];

// -- BODYWEIGHT / HIIT (Option 3: No gym, weighted vest optional) ------------
// Evidence basis: HIIT (Gibala et al., 2012) produces VO2 max gains equivalent to
// continuous cardio in a fraction of the time. Strength block uses bodyweight
// progressions (Calatayud et al., 2014) showing push-ups can match bench press
// for hypertrophy in similar rep ranges.
var WO_PROGRAM_BODYWEIGHT=[
  {
    day:'A',name:'Upper Power + HIIT',
    rationale:'Bodyweight push/pull at hypertrophy rep ranges, followed by an all-out HIIT finisher. Use weighted vest for added load if available. 30-40 min total.',
    exercises:[
      {id:'push_up',sets:'4×10–20',rest:'60 sec',note:'Primary push (incline/decline to scale)'},
      {id:'inverted_row',sets:'4×8–15',rest:'60 sec',note:'Primary pull'},
      {id:'pike_push_up',sets:'3×8–12',rest:'60 sec',note:'Shoulder/overhead push'},
      {id:'diamond_push_up',sets:'3×8–12',rest:'45 sec',note:'Tricep focus'},
      {id:'plank',sets:'3×45–60 sec',rest:'30 sec',note:'Core anti-extension'},
      {id:'tabata_burpees',sets:'1× 4 min',rest:'--',note:'HIIT finisher'}
    ]
  },
  {
    day:'B',name:'Lower Power + HIIT',
    rationale:'Bodyweight squat/hinge patterns at higher volume, unilateral work for stability, finishing with sprint or jump intervals for explosive power.',
    exercises:[
      {id:'bw_squat',sets:'4×15–25',rest:'60 sec',note:'Squat pattern volume'},
      {id:'reverse_lunge',sets:'3×10 each',rest:'60 sec',note:'Unilateral (bodyweight)'},
      {id:'single_leg_glute_bridge',sets:'3×10 each',rest:'45 sec',note:'Posterior chain isolation'},
      {id:'standing_calf_raise',sets:'3×15–25',rest:'30 sec',note:'Calves (bodyweight)'},
      {id:'hollow_hold',sets:'3×20–40 sec',rest:'30 sec',note:'Deep core static'},
      {id:'sprint_intervals',sets:'1× 6–8 rounds',rest:'--',note:'HIIT finisher'}
    ]
  },
  {
    day:'C',name:'Full Body MetCon',
    rationale:'Mixed-modality circuit. Builds work capacity that translates to occupational tasks (scene calls, patient transfers, long shifts). AMRAP format pushes endurance.',
    exercises:[
      {id:'burpee',sets:'3×8–12',rest:'60 sec',note:'Warm-up explosive set'},
      {id:'push_up',sets:'3×12–20',rest:'45 sec',note:'Upper push'},
      {id:'inverted_row',sets:'3×10–15',rest:'45 sec',note:'Upper pull'},
      {id:'jump_squat',sets:'3×10–15',rest:'45 sec',note:'Lower explosive'},
      {id:'bear_crawl',sets:'3×30–45 sec',rest:'30 sec',note:'Anti-rotation core'},
      {id:'amrap_full_body',sets:'1× 15 min',rest:'--',note:'Conditioning finisher'}
    ]
  }
];

// -- KETTLEBELL (Option 4: Full-body functional, core + stabilizers) ----------
// Evidence basis: KB training produces significant improvements in core stability,
// posterior chain power, and shoulder stabilizer endurance (Jay et al., 2011;
// Lake & Lauder, 2012). Unilateral loading and offset center of mass demand
// constant anti-rotation and anti-lateral-flexion from the deep core.
var WO_PROGRAM_KETTLEBELL=[
  {
    day:'A',name:'KB Push + Core Stability',
    rationale:'Turkish Get-Up builds full-body stabilizer strength through every plane. Clean & Press develops overhead power. Windmill and Gladiator target deep lateral core and hip stability under load.',
    exercises:[
      {id:'kb_halo',sets:'2×8 each direction',rest:'30 sec',note:'Shoulder mobility warmup'},
      {id:'kb_turkish_getup',sets:'3×2 each side',rest:'90 sec',note:'Full-body stabilizer — go slow'},
      {id:'kb_clean_press',sets:'3×6–8 each side',rest:'90 sec',note:'Power + overhead strength'},
      {id:'goblet_squat',sets:'3×10–12',rest:'90 sec',note:'Knee-dominant lower'},
      {id:'kb_windmill',sets:'3×5 each side',rest:'60 sec',note:'Lateral core + hip stability'},
      {id:'kb_gladiator',sets:'2×3 each side',rest:'90 sec',note:'Advanced stabilizer chain'},
      {id:'plank',sets:'3×30–45 sec',rest:'45 sec',note:'Anti-extension finisher'}
    ]
  },
  {
    day:'B',name:'KB Pull + Posterior Chain',
    rationale:'Swing is the foundational KB hip hinge — explosive posterior chain power. Renegade rows demand anti-rotation core. Single-leg work builds balance and addresses asymmetries.',
    exercises:[
      {id:'kb_halo',sets:'2×8 each direction',rest:'30 sec',note:'Shoulder mobility warmup'},
      {id:'kb_swing',sets:'5×15',rest:'60 sec',note:'Posterior chain power — hip snap'},
      {id:'kb_renegade_row',sets:'3×6–8 each side',rest:'90 sec',note:'Anti-rotation core + back'},
      {id:'single_leg_rdl',sets:'3×8 each side',rest:'60 sec',note:'Unilateral posterior chain + balance'},
      {id:'kb_turkish_getup',sets:'2×2 each side',rest:'90 sec',note:'Stabilizer maintenance'},
      {id:'kb_gladiator',sets:'2×3 each side',rest:'90 sec',note:'Full-body stabilizer flow'},
      {id:'dead_bug',sets:'3×8 each side',rest:'45 sec',note:'Deep core finisher'}
    ]
  },
  {
    day:'C',name:'KB Full-Body Flow',
    rationale:'Every major movement pattern in one session — hinge, squat, press, pull, carry, and rotational stability. High demand on core and stabilizers throughout. The session firefighters and first responders benefit from most.',
    exercises:[
      {id:'kb_halo',sets:'2×8 each direction',rest:'30 sec',note:'Shoulder mobility warmup'},
      {id:'kb_turkish_getup',sets:'3×2 each side',rest:'90 sec',note:'Full-body stabilizer prime mover'},
      {id:'kb_swing',sets:'4×15',rest:'60 sec',note:'Posterior chain power'},
      {id:'kb_clean_press',sets:'3×6–8 each side',rest:'90 sec',note:'Upper-body power'},
      {id:'goblet_squat',sets:'3×10–12',rest:'90 sec',note:'Quad-dominant lower'},
      {id:'kb_renegade_row',sets:'3×6–8 each side',rest:'90 sec',note:'Anti-rotation pull'},
      {id:'kb_windmill',sets:'3×5 each side',rest:'60 sec',note:'Lateral core under load'},
      {id:'kb_gladiator',sets:'2×3 each side',rest:'90 sec',note:'Advanced full-body flow'},
      {id:'farmer_carry',sets:'3×30–40 sec',rest:'60 sec',note:'Grip + core + occupational carry'}
    ]
  }
];

// Track registry -- all available program variations
var WO_TRACKS={
  primary:{name:'Primary',icon:'💪',label:'Gym · Push/Pull/Full-body',program:WO_PROGRAM},
  bodysplit:{name:'Body Split',icon:'🏋️',label:'Gym · Chest+Tri / Back+Bi / Legs+Shoulders',program:WO_PROGRAM_BODYSPLIT},
  bodyweight:{name:'Bodyweight + HIIT',icon:'🤸',label:'No gym · BW + HIIT, 30–40 min',program:WO_PROGRAM_BODYWEIGHT},
  kettlebell:{name:'Kettlebell',icon:'🔔',label:'KB · Full-body functional, core + stabilizers',program:WO_PROGRAM_KETTLEBELL}
};

var WO_COOLDOWN=[
  'Chest doorway stretch -- 30 sec each side',
  'Standing hamstring stretch -- 30 sec each leg',
  'Hip flexor lunge stretch -- 30 sec each side',
  'Lat stretch (hang or overhead reach) -- 30 sec',
  'Shoulder cross-body stretch -- 30 sec each arm',
  'Quad stretch standing -- 30 sec each leg',
  "Child's pose (back/hip opener) -- 60 sec"
];

function renderWorkout(){
  var today=new Date().getDay();
  var dayMap=[6,0,1,2,3,4,5];
  var todayIdx=dayMap[today];
  if(WO_ACTIVE_DAY===null)WO_ACTIVE_DAY=todayIdx;
  var sel=document.getElementById('woDaySelect');
  if(sel){
    sel.innerHTML=WO_DAYS.map(function(d,i){
      var typeLabel=d.type==='lift'?' -- Weights':d.type==='walk'?' -- Active Recovery':' -- Rest';
      var star=i===todayIdx?' \u2605':'';
      return '<option value="'+i+'"'+(i===WO_ACTIVE_DAY?' selected':'')+'>'+d.label+typeLabel+star+'</option>';
    }).join('');
  }
  var dayType=WO_DAYS[WO_ACTIVE_DAY].type;
  var html='';
  if(dayType==='lift') html+=_renderLiftDay();
  else if(dayType==='walk') html+=_renderWalkDay();
  else html='<div class="wo-walk-card" style="background:#f0eee8;border-color:#c0b890;"><div class="wo-walk-icon">&#128564;</div><div class="wo-walk-title" style="color:#4a3e28;">Rest Day</div><div class="wo-walk-desc" style="color:#3a3028;">Recovery is where the adaptation happens.<br>Sleep well, stay hydrated, eat protein.</div></div>';
  document.getElementById('woContent').innerHTML=html;
}

function woSetDay(idx){WO_ACTIVE_DAY=idx;renderWorkout();}

function _renderWalkDay(){
  var dayName=WO_DAYS[WO_ACTIVE_DAY].label;
  var activeActivity=WO_ACTIVE_DAY===5?'hike':'walk'; // Saturday default hike, others walk
  var activities={
    walk:{
      icon:'&#127939;',name:'Walk',
      desc:'45 minutes at a conversational, Zone 2 pace (100–120 bpm). The gold standard for aerobic base building and active recovery.',
      options:[
        'Flat neighborhood or trail -- maintain easy breathing','Treadmill incline 3–5% for extra challenge without impact',
        'Aim for 4,000–6,000 steps minimum','Swing your arms naturally -- activates core and improves gait'
      ]
    },
    hike:{
      icon:'&#9968;',name:'Hike',
      desc:'45–60 minutes on uneven terrain. Improves balance, recruits stabilizers, and burns more calories than flat walking at the same pace.',
      options:[
        'Choose trails with moderate elevation change','Trekking poles reduce knee strain on descents',
        'Uneven ground activates glutes and ankles differently than pavement','Watch footing -- proprioception work is the bonus'
      ]
    },
    yoga:{
      icon:'&#129335;',name:'Yoga / Mobility',
      desc:'30–45 minutes of movement-based recovery. Targets the exact muscles loaded in your lifting sessions: hip flexors, hamstrings, lats, chest, and thoracic spine.',
      options:[
        'Sun salutations × 5 -- warm up the whole chain','Pigeon pose -- 90 sec each side for hip flexors and glutes',
        'Thread-the-needle -- 60 sec each side for thoracic rotation','Downward dog -- calf and hamstring lengthening',
        'Child\'s pose wide -- lat stretch','Cat-cow × 10 -- spinal decompression after deadlifts'
      ]
    }
  };

  var html='<div class="wo-recovery-header">&#127807; '+dayName+' -- Active Recovery</div>'
    +'<div class="wo-activity-tabs">';
  ['walk','hike','yoga'].forEach(function(key){
    var a=activities[key];
    var cls='wo-activity-tab'+(key===activeActivity?' active':'');
    html+='<button class="'+cls+'" onclick="woSwitchActivity(this,\''+key+'\')">'
      +a.icon+'<br>'+a.name+'</button>';
  });
  html+='</div>';

  // Render details for active activity
  html+=_renderActivityDetail(activities[activeActivity]);
  return html;
}

function _renderActivityDetail(a){
  var optHtml=a.options.map(function(o){return '<div class="wo-activity-option">'+o+'</div>';}).join('');
  return '<div class="wo-activity-detail">'
    +'<div class="wo-activity-icon">'+a.icon+'</div>'
    +'<div class="wo-activity-name">'+a.name+'</div>'
    +'<div class="wo-activity-desc">'+a.desc+'</div>'
    +'<div class="wo-activity-options"><div class="wo-activity-options-title">How to do it well</div>'+optHtml+'</div>'
    +'</div>'
    +'<div class="wo-complete-section">'
    +'<label class="wo-complete-label">'
    +'<input type="checkbox" onclick="completeWorkout(\'recovery\','+WO_ACTIVE_DAY+')"> ✓ Recovery Completed'
    +'</label>'
    +'</div>';
}

function woSwitchActivity(btn,key){
  // Update active tab
  btn.closest('.modal-blur-body').querySelectorAll('.wo-activity-tab').forEach(function(t){t.classList.remove('active');});
  btn.classList.add('active');
  // Re-render detail panel
  var activities={
    walk:{icon:'&#127939;',name:'Walk',
      desc:'45 minutes at a conversational, Zone 2 pace (100–120 bpm). The gold standard for aerobic base building and active recovery.',
      options:['Flat neighborhood or trail -- maintain easy breathing','Treadmill incline 3–5% for extra challenge without impact',
        'Aim for 4,000–6,000 steps minimum','Swing your arms naturally -- activates core and improves gait']},
    hike:{icon:'&#9968;',name:'Hike',
      desc:'45–60 minutes on uneven terrain. Improves balance, recruits stabilizers, and burns more calories than flat walking at the same pace.',
      options:['Choose trails with moderate elevation change','Trekking poles reduce knee strain on descents',
        'Uneven ground activates glutes and ankles differently than pavement','Watch footing -- proprioception work is the bonus']},
    yoga:{icon:'&#129335;',name:'Yoga / Mobility',
      desc:'30–45 minutes of movement-based recovery. Targets the exact muscles loaded in your lifting sessions.',
      options:['Sun salutations × 5 -- warm up the whole chain','Pigeon pose -- 90 sec each side for hip flexors and glutes',
        'Thread-the-needle -- 60 sec each side for thoracic rotation','Downward dog -- calf and hamstring lengthening',
        "Child's pose wide -- lat stretch",'Cat-cow × 10 -- spinal decompression after deadlifts']}
  };
  var existing=btn.closest('.modal-blur-body').querySelector('.wo-activity-detail');
  if(existing){
    var tmp=document.createElement('div');
    tmp.innerHTML=_renderActivityDetail(activities[key]);
    existing.replaceWith(tmp.firstChild);
  }
}

function _renderLiftDay(){
  var liftDayMap={0:0,2:1,4:2};
  var progIdx=liftDayMap[WO_ACTIVE_DAY];
  if(progIdx===undefined)progIdx=0;
  
  // Determine which track is selected for this day (default 'primary')
  if(!state.workoutTracks)state.workoutTracks={};
  var dayLetter=['A','B','C'][progIdx];
  var trackId=state.workoutTracks[dayLetter]||'primary';
  if(!WO_TRACKS[trackId])trackId='primary';
  
  var program=WO_TRACKS[trackId].program;
  var prog=program[progIdx];
  
  // -- Track selector at top ----------------------------------------
  var html='<div class="wo-track-selector">'
    +'<div class="wo-track-label">Workout style:</div>'
    +'<div class="wo-track-buttons">';
  Object.keys(WO_TRACKS).forEach(function(tid){
    var t=WO_TRACKS[tid];
    var active=tid===trackId?' active':'';
    html+='<button class="wo-track-btn'+active+'" onclick="setWorkoutTrack(\''+dayLetter+'\',\''+tid+'\')" title="'+esc(t.label)+'">'
      +'<span class="wo-track-icon">'+t.icon+'</span>'
      +'<span class="wo-track-name">'+t.name+'</span>'
      +'</button>';
  });
  html+='</div></div>';
  
  // Warmup
  html+='<div class="wo-section"><div class="wo-section-title">Warmup (10 min)</div>'
    +'<div class="wo-cooldown"><div class="wo-cooldown-item">'
    +(trackId==='bodyweight'?'5 min easy jog or jumping jacks + dynamic stretches (leg swings, arm circles)':'Treadmill walk at warmup pace -- 10 minutes')
    +'</div></div></div>';
  
  html+='<div class="wo-day-rationale"><strong>Day '+prog.day+': '+prog.name+'</strong><br>'+prog.rationale+'</div>';
  
  // Render all exercises
  html+='<div class="wo-section"><div class="wo-section-title">Today\'s Exercises</div>';
  prog.exercises.forEach(function(ex,idx){
    html+=_renderExercise(ex,'ex_'+idx);
    if(idx<prog.exercises.length-1&&ex.rest!=='--'){
      html+='<div style="text-align:center;padding:8px 0;"><span class="wo-rest-badge">&#9202; '+ex.rest+' rest</span></div>';
    }
  });
  html+='</div>';
  
  html+='<div class="wo-section"><div class="wo-section-title">Cooldown (5–10 min)</div><div class="wo-cooldown">';
  WO_COOLDOWN.forEach(function(s){html+='<div class="wo-cooldown-item">'+s+'</div>';});
  html+='</div></div>';
  
  // Add completion checkbox
  html+='<div class="wo-complete-section">'
    +'<label class="wo-complete-label">'
    +'<input type="checkbox" onclick="completeWorkout(\'lift\','+progIdx+')"> ✓ Workout Completed'
    +'</label>'
    +'</div>';
  
  return html;
}

function setWorkoutTrack(dayLetter,trackId){
  if(!state.workoutTracks)state.workoutTracks={};
  state.workoutTracks[dayLetter]=trackId;
  save();
  // Re-render the workout modal
  if(typeof openWorkoutModal==='function'){
    var body=document.querySelector('#workoutModal .modal-blur-body');
    if(body){
      body.innerHTML=_renderLiftDay();
    }
  }
  toast('Switched to '+WO_TRACKS[trackId].name);
}

function _renderExercise(ex,slotId){
  var exData=WO_EXERCISES[ex.id];
  var log=(state.workoutLog&&state.workoutLog[ex.id])||{weight:'',reps:'',sets:''};
  var firstAlt=exData.alts&&exData.alts.length?WO_EXERCISES[exData.alts[0]]:null;
  var primaryLabel=firstAlt?exData.name+' / '+firstAlt.name:exData.name;
  var opts='<option value="'+ex.id+'">'+primaryLabel+'</option>'
    +exData.alts.map(function(aid){var a=WO_EXERCISES[aid];return a?'<option value="'+aid+'">'+a.name+'</option>':'';}).join('');
  return '<div class="wo-exercise">'
    +'<div class="wo-ex-top">'
    +'<select class="wo-ex-select" data-primary="'+ex.id+'" onchange="woExChanged(this)">'+opts+'</select>'
    +'<button class="btn btn-sm wo-quicksub" onclick="woQuickSub(this)" title="Random alternative -- for crowded gym or variety" style="font-size:11px;padding:3px 8px;flex-shrink:0;">&#127922;</button>'
    +'<button class="btn btn-sm" onclick="showExerciseInfo(this.closest(\'.wo-exercise\').querySelector(\'.wo-ex-select\').value)" style="font-size:11px;padding:3px 9px;flex-shrink:0;">&#9432; How-to</button>'
    +'</div>'
    +'<div class="wo-ex-note">'+ex.sets+' &bull; '+ex.note+'</div>'
    +'<div class="wo-log-row">'
    +'<span class="wo-log-label">Log:</span>'
    +'<input class="wo-log-input" type="number" inputmode="numeric" placeholder="sets" value="'+esc(log.sets||'')+'" oninput="woLog(this.closest(\'.wo-exercise\').querySelector(\'.wo-ex-select\').value,\'sets\',this.value)" title="Sets done">'
    +'<span class="wo-log-label">×</span>'
    +'<input class="wo-log-input" type="number" inputmode="decimal" placeholder="lbs" value="'+esc(log.weight||'')+'" oninput="woLog(this.closest(\'.wo-exercise\').querySelector(\'.wo-ex-select\').value,\'weight\',this.value)" title="Weight used">'
    +'<span class="wo-log-label">@</span>'
    +'<input class="wo-log-input" type="number" inputmode="numeric" placeholder="reps" value="'+esc(log.reps||'')+'" oninput="woLog(this.closest(\'.wo-exercise\').querySelector(\'.wo-ex-select\').value,\'reps\',this.value)" title="Reps done">'
    +'</div>'
    +'</div>';
}

function woExChanged(sel){
  var exId=sel.value;
  var container=sel.closest('.wo-exercise');
  var log=(state.workoutLog&&state.workoutLog[exId])||{weight:'',reps:'',sets:''};
  var inputs=container.querySelectorAll('.wo-log-input');
  if(inputs[0])inputs[0].value=log.sets||'';
  if(inputs[1])inputs[1].value=log.weight||'';
  if(inputs[2])inputs[2].value=log.reps||'';
}

function woQuickSub(btnEl){
  var container=btnEl.closest('.wo-exercise');
  var sel=container.querySelector('.wo-ex-select');
  if(!sel)return;
  // Collect all option values except the currently selected one
  var current=sel.value;
  var opts=Array.from(sel.options).map(function(o){return o.value;}).filter(function(v){return v!==current;});
  if(opts.length===0){toast('No alternatives available');return;}
  // Pick a random one
  var pick=opts[Math.floor(Math.random()*opts.length)];
  sel.value=pick;
  // Trigger change handler manually so log values update
  woExChanged(sel);
  // Brief flash to show change happened
  btnEl.style.transform='scale(1.2)';
  setTimeout(function(){btnEl.style.transform='';},200);
  var newName=(WO_EXERCISES[pick]||{}).name||pick;
  toast('\u{1F3B2} Swapped to '+newName);
}

function woLog(exId,field,val){
  if(!state.workoutLog)state.workoutLog={};
  if(!state.workoutLog[exId])state.workoutLog[exId]={weight:'',reps:'',sets:''};
  state.workoutLog[exId][field]=val;
  save();
}

function showExerciseInfo(exId){
  var ex=WO_EXERCISES[exId];if(!ex)return;
  var stepsHtml=ex.steps.map(function(s,i){return '<li data-n="'+(i+1)+'">'+s+'</li>';}).join('');
  var altsHtml=ex.alts.slice(0,6).map(function(aid){
    var a=WO_EXERCISES[aid];
    return a?'<span style="display:inline-block;margin:3px 4px 0 0;padding:3px 10px;background:var(--surface-raised);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--teal);cursor:pointer;" onclick="showExerciseInfo(\''+aid+'\')">'+a.name+'</span>':'';
  }).join('');
  var html='<div class="wo-modal">'
    +'<div class="wo-modal-name">'+ex.name+'</div>'
    +'<div class="wo-modal-muscles">'+ex.muscles+'</div>'
    +'<ol class="wo-modal-steps">'+stepsHtml+'</ol>'
    +'<div class="wo-modal-tip"><strong>Tip:</strong> '+ex.tip+'</div>'
    +(altsHtml?'<div style="margin-top:12px;"><div style="font-size:11px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Related Exercises</div>'+altsHtml+'</div>':'')
    +'</div>';
  document.getElementById('modalContent').innerHTML=html;
  document.getElementById('modalOverlay').classList.add('show');
}

function completeWorkout(type,dayIndex){
  var timestamp=new Date().toISOString();
  var dayLabel=WO_DAYS[WO_ACTIVE_DAY]?WO_DAYS[WO_ACTIVE_DAY].label:'Unknown';
  var workoutName='';
  if(type==='lift'){
    var prog=WO_PROGRAM[dayIndex];
    workoutName='Day '+prog.day+': '+prog.name;
  }else if(type==='recovery'){
    workoutName=dayLabel+' -- Active Recovery';
  }
  
  var record={
    type:type,
    dayIndex:dayIndex,
    dayLabel:dayLabel,
    workoutName:workoutName,
    timestamp:timestamp,
    date:timestamp.split('T')[0]
  };
  
  state.completedWorkouts.push(record);
  // Lifetime counter survives the cap below (counter UI reads this, not .length)
  state.workoutLifetimeCount=(state.workoutLifetimeCount||state.completedWorkouts.length-1)+1;
  if(state.completedWorkouts.length>100)state.completedWorkouts=state.completedWorkouts.slice(-100);
  save();
  
  // Award points
  addPoints(type==='lift'?'workout':'recovery');
  
  // Show confirmation and update counter
  alert('✓ Workout completed!\n\n'+workoutName+'\n'+new Date(timestamp).toLocaleString());
  updateCompletedWorkoutsCounter();
}

function updateCompletedWorkoutsCounter(){
  var counter=document.getElementById('completedWorkoutsCounter');
  if(counter){
    counter.textContent=Math.max(state.workoutLifetimeCount||0,state.completedWorkouts.length);
  }
}



// =======================================
// TIMELINE + WORK-TODAY -- at script scope so renderers and HTML onclick handlers can see them
// =======================================
// =======================================
// TIMELINE PANEL -- daily time-blocking
// =======================================
var TL_DAY_START_H=5;   // 5 AM -- matches day-progress bar
var TL_DAY_END_H=22;    // 10 PM
var TL_HOUR_PX=52;      // px per hour
var TL_COLOR_COUNT=8;   // palette size

function _tlProjectColor(projectId){
  if(!projectId)return 'no-proj';
  // Stable hash → palette index
  var hash=0;
  for(var i=0;i<projectId.length;i++)hash=((hash<<5)-hash+projectId.charCodeAt(i))|0;
  return Math.abs(hash)%TL_COLOR_COUNT;
}

// === WORK TODAY scheduling ===
var _wtCurrentItem=null; // {type, id, projectId, name, defaultDuration}
var _wtSelectedDay='today'; // 'today' or 'tomorrow'

function tomorrowStr(){
  var d=new Date();
  d.setDate(d.getDate()+1);
  var pad=function(n){return n<10?'0'+n:''+n;};
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function _wtTargetDate(){
  return _wtSelectedDay==='tomorrow'?tomorrowStr():todayStr();
}

function wtSetDay(day){
  if(day!=='today'&&day!=='tomorrow')return;
  _wtSelectedDay=day;
  // Update toggle visual state
  document.querySelectorAll('.wt-day-btn').forEach(function(btn){
    if(btn.dataset.day===day){
      btn.classList.add('active');
      btn.style.background='rgba(91,232,255,0.18)';
      btn.style.color='#5be8ff';
    }else{
      btn.classList.remove('active');
      btn.style.background='var(--surface-raised)';
      btn.style.color='var(--text-dim)';
    }
  });
  // Update modal title
  var titleEl=document.getElementById('wtModalTitle');
  if(titleEl)titleEl.innerHTML='&#128197; Schedule for '+(day==='tomorrow'?'Tomorrow':'Today');
  // Recompute suggestion + conflicts for the new day
  if(_wtCurrentItem){
    var dur=parseInt(document.getElementById('wtDuration').value)||60;
    var suggested=_suggestWorkTime(dur,_wtTargetDate());
    var hh=Math.floor(suggested/60),mm=suggested%60;
    var timeStr=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
    // Only auto-fill the suggestion if user hasn't manually changed it
    document.getElementById('wtTime').value=timeStr;
    document.getElementById('wtSuggestion').textContent='💡 Suggested ('+day+'): '+_tlFmtTime(suggested)+' -- first open slot';
    _wtUpdateConflicts();
  }
}

function _isScheduledToday(itemId){
  var today=todayStr();
  return (state.tlBlocks||[]).some(function(b){
    return b.date===today&&b.linkedId===itemId;
  });
}

function _findScheduledBlock(itemId){
  var today=todayStr();
  return (state.tlBlocks||[]).find(function(b){return b.date===today&&b.linkedId===itemId;});
}

function _suggestWorkTime(durationMin,targetDate){
  // Find first available slot of >=durationMin minutes between start and 6pm.
  // For today: start is now-rounded-up (but no earlier than 9am).
  // For tomorrow or any future day: start is 9am (no "now" constraint).
  var isToday=!targetDate||targetDate===todayStr();
  var blocks=_tlCollectBlocks(targetDate);
  var startCandidate;
  if(isToday){
    var now=new Date();
    var nowMin=now.getHours()*60+now.getMinutes();
    startCandidate=Math.max(540,Math.ceil(nowMin/30)*30); // 9am or later
    var dayEnd=18*60;
    if(startCandidate>=dayEnd)startCandidate=Math.max(8*60,nowMin); // late-day fallback
  }else{
    startCandidate=540; // 9am for future days
  }
  
  // Sort blocks by start
  var sorted=blocks.slice().sort(function(a,b){return a.startMin-b.startMin;});
  
  // Walk gaps
  var candidate=startCandidate;
  for(var i=0;i<sorted.length;i++){
    var b=sorted[i];
    var bEnd=b.startMin+b.durMin;
    if(b.startMin>=candidate+durationMin)return candidate;
    if(bEnd>candidate)candidate=Math.ceil(bEnd/15)*15;
  }
  return candidate;
}

function _findConflicts(startMin,durMin,excludeId,targetDate){
  var endMin=startMin+durMin;
  var blocks=_tlCollectBlocks(targetDate);
  return blocks.filter(function(b){
    if(b.linkedId===excludeId)return false;
    var bEnd=b.startMin+b.durMin;
    return b.startMin<endMin&&bEnd>startMin;
  });
}

function handleWorkTodayClick(itemType,itemId,projectId){
  // If already scheduled, ask what to do
  var existing=_findScheduledBlock(itemId);
  if(existing){
    var name=existing.name;
    _confirm('"'+name+'" is scheduled at '+_tlFmtTime(_tlParseTime(existing.time))+'. Unschedule it?',function(){
      state.tlBlocks=(state.tlBlocks||[]).filter(function(b){return b.id!==existing.id;});
      save();
      renderProjects();renderTaskList();renderTimeline();
      if(typeof updateDayProgress==='function')updateDayProgress();
      toast('Unscheduled');
    },{confirmText:'Unschedule',icon:'ti-calendar-x'});
    return;
  }
  
  // Resolve the item
  var name='',duration=60,priority='med';
  if(itemType==='task'){
    var t=(state.tasks||[]).find(function(t){return t.id===itemId;});
    if(!t){toast('Task not found');return;}
    name=t.name;duration=parseInt(t.timeEst)||60;priority=t.priority||'med';
  }else if(itemType==='subtask'){
    var p=(state.projects||[]).find(function(p){return p.id===projectId;});
    if(!p){toast('Project not found');return;}
    var st=(p.subtasks||[]).find(function(s){return s.id===itemId;});
    if(!st){toast('Subtask not found');return;}
    name=st.name;duration=parseInt(st.timeEst)||60;priority=st.priority||'med';
  }else if(itemType==='project'){
    var pr=(state.projects||[]).find(function(p){return p.id===itemId;});
    if(!pr){toast('Project not found');return;}
    name=pr.name+' (work session)';duration=60;priority='med';
  }else{return;}
  
  if(duration>720)duration=720; // cap (largest selectable duration)
  
  _wtCurrentItem={type:itemType,id:itemId,projectId:projectId||'',name:name,duration:duration,priority:priority};
  // Default to the day the timeline panel is currently showing (today or tomorrow)
  _wtSelectedDay=(typeof _tlViewDay!=='undefined'&&_tlViewDay==='tomorrow')?'tomorrow':'today';
  
  // Reset the day toggle visuals
  document.querySelectorAll('.wt-day-btn').forEach(function(btn){
    if(btn.dataset.day===_wtSelectedDay){
      btn.classList.add('active');
      btn.style.background='rgba(91,232,255,0.18)';
      btn.style.color='#5be8ff';
    }else{
      btn.classList.remove('active');
      btn.style.background='var(--surface-raised)';
      btn.style.color='var(--text-dim)';
    }
  });
  var titleEl=document.getElementById('wtModalTitle');
  if(titleEl)titleEl.innerHTML='&#128197; Schedule for '+(_wtSelectedDay==='tomorrow'?'Tomorrow':'Today');
  
  // Suggest a time for the selected day
  var suggested=_suggestWorkTime(duration,_wtTargetDate());
  var hh=Math.floor(suggested/60),mm=suggested%60;
  var timeStr=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
  
  // Open modal
  document.getElementById('wtItemName').textContent=name;
  document.getElementById('wtTime').value=timeStr;
  document.getElementById('wtDuration').value=String(duration);
  document.getElementById('wtSuggestion').textContent='💡 Suggested ('+_wtSelectedDay+'): '+_tlFmtTime(suggested)+' -- first open slot';
  _wtUpdateConflicts();
  
  // Reset modal to standard "Schedule" button if it was previously in edit mode
  var modalBody=document.querySelector('#workTodayModal .modal-blur-body');
  if(modalBody){
    var editRow=modalBody.querySelector('.wt-button-row');
    if(editRow){
      var newRow=document.createElement('div');
      newRow.style.cssText='display:flex;gap:8px;justify-content:flex-end;';
      newRow.innerHTML=
        '<button class="btn btn-sm" onclick="closeWorkTodayModal()" style="font-size:12px;">Cancel</button>'
        +'<button class="btn btn-accent btn-sm" id="wtScheduleBtn" onclick="confirmWorkToday()" style="font-size:12px;background:#5be8ff;color:#02141a;">Schedule</button>';
      editRow.replaceWith(newRow);
    }
  }
  
  document.getElementById('workTodayModal').classList.add('open');
  
  // Wire change handlers to refresh conflict warning live
  var t=document.getElementById('wtTime');
  var d=document.getElementById('wtDuration');
  t.oninput=_wtUpdateConflicts;
  d.onchange=_wtUpdateConflicts;
}

function _wtUpdateConflicts(){
  if(!_wtCurrentItem)return;
  var timeVal=document.getElementById('wtTime').value;
  var durVal=parseInt(document.getElementById('wtDuration').value);
  if(!timeVal||!durVal)return;
  var startMin=_tlParseTime(timeVal);
  var conflicts=_findConflicts(startMin,durVal,_wtCurrentItem.id,_wtTargetDate());
  var cEl=document.getElementById('wtConflict');
  if(conflicts.length){
    cEl.style.display='block';
    cEl.textContent='⚠ Overlaps with: '+conflicts.map(function(c){return c.name;}).join(', ');
  }else{
    cEl.style.display='none';
  }
}

function closeWorkTodayModal(){
  document.getElementById('workTodayModal').classList.remove('open');
  _wtCurrentItem=null;
}

function confirmWorkToday(){
  if(!_wtCurrentItem)return;
  var timeVal=document.getElementById('wtTime').value;
  var durVal=parseInt(document.getElementById('wtDuration').value);
  if(!timeVal){toast('Pick a time');return;}
  if(!durVal){toast('Pick a duration');return;}
  
  var targetDate=_wtTargetDate();
  var isToday=targetDate===todayStr();
  
  // Late-end warning only when scheduling for today
  if(isToday){
    var startMin=_tlParseTime(timeVal);
    var endMin=startMin+durVal;
    var END_OF_DAY=20*60; // 8 PM
    if(endMin>END_OF_DAY){
      var endLabel=_tlFmtTime(endMin);
      _confirm('This block would end at '+endLabel+' -- after 8 PM.',
        function(){_writeBlock(targetDate,timeVal,durVal);},
        {confirmText:'Today Anyway',altText:'Push to Tomorrow',onAlt:function(){_scheduleForTomorrow(timeVal,durVal);},icon:'ti-clock-exclamation',warn:true}
      );
      return;
    }
  }
  
  _writeBlock(targetDate,timeVal,durVal);
}

function _scheduleForTomorrow(timeVal,durVal){
  var tomorrow=new Date();
  tomorrow.setDate(tomorrow.getDate()+1);
  var pad=function(n){return n<10?'0'+n:''+n;};
  var tomorrowStr=tomorrow.getFullYear()+'-'+pad(tomorrow.getMonth()+1)+'-'+pad(tomorrow.getDate());
  _writeBlock(tomorrowStr,timeVal,durVal);
}

// Single source of truth for a task/subtask-linked tlBlocks entry's shape,
// shared by the single-item Work Today flow (_writeBlock, below) and the F4
// batch "Add selected to Timeline" path (_taskToTimelineBlock). Previously
// each hand-built the same object literal -- a drift risk if one gained a
// field the other didn't. Deliberately pure (no state mutation, no save/
// render): the two callers have different lifecycles by design -- the modal
// flow does one save+render per confirm, the batch flow defers a single
// save+render across N pushes -- so each keeps owning its own push and
// side-effect timing; only the object shape is shared.
function _buildTimelineBlock(opts){
  return {
    id:'tlb'+Date.now()+Math.random().toString(36).slice(2),
    name:opts.name,
    date:opts.date,
    time:opts.time,
    duration:opts.duration,
    projectId:opts.projectId||'',
    projectIds:[],
    priority:opts.priority||'med',
    linkedType:opts.linkedType,
    linkedId:opts.linkedId
  };
}

function _writeBlock(dateStr,timeVal,durVal){
  if(!state.tlBlocks)state.tlBlocks=[];
  // If editing an existing block, update it in place
  if(_wtCurrentItem&&_wtCurrentItem._editBlockId){
    var existing=state.tlBlocks.find(function(b){return b.id===_wtCurrentItem._editBlockId;});
    if(existing){
      existing.date=dateStr;
      existing.time=timeVal;
      existing.duration=durVal;
      save();
      closeWorkTodayModal();
      renderProjects();renderTaskList();renderTimeline();
      if(typeof updateDayProgress==='function')updateDayProgress();
      toast('Updated -- '+_tlFmtTime(_tlParseTime(timeVal)));
      return;
    }
  }
  // Otherwise create new
  state.tlBlocks.push(_buildTimelineBlock({
    name:_wtCurrentItem.name,
    date:dateStr,
    time:timeVal,
    duration:durVal,
    projectId:(_wtCurrentItem.type==='subtask'||_wtCurrentItem.type==='project')?_wtCurrentItem.projectId:'',
    priority:_wtCurrentItem.priority,
    linkedType:_wtCurrentItem.type,
    linkedId:_wtCurrentItem.id
  }));
  save();
  closeWorkTodayModal();
  renderProjects();renderTaskList();renderTimeline();
  if(typeof updateDayProgress==='function')updateDayProgress();
  var today=todayStr();
  if(dateStr===today){
    toast('Scheduled today -- '+_tlFmtTime(_tlParseTime(timeVal)));
  }else{
    toast('Pushed to tomorrow -- '+_tlFmtTime(_tlParseTime(timeVal)));
  }
}

// Edit an existing block -- opens the Work Today modal pre-filled with block data
function editTimelineBlock(blockId){
  var block=(state.tlBlocks||[]).find(function(b){return b.id===blockId;});
  if(!block){toast('Block not found');return;}
  
  _wtCurrentItem={
    type:block.linkedType||'manual',
    id:block.linkedId||block.id,
    projectId:block.projectId||'',
    name:block.name,
    duration:parseInt(block.duration)||60,
    priority:block.priority||'med',
    _editBlockId:block.id // signal to _writeBlock that this is an edit
  };
  
  document.getElementById('wtItemName').textContent=block.name;
  document.getElementById('wtTime').value=block.time;
  document.getElementById('wtDuration').value=String(block.duration);
  document.getElementById('wtSuggestion').textContent='✏ Editing existing block -- change time or duration, then Update';
  
  // Show the delete button (added in edit mode)
  var modalBody=document.querySelector('#workTodayModal .modal-blur-body');
  if(modalBody){
    // Replace Schedule button with Update + Delete
    var btnRow=modalBody.querySelector('.wt-button-row');
    if(btnRow)btnRow.remove();
    var newRow=document.createElement('div');
    newRow.className='wt-button-row';
    newRow.style.cssText='display:flex;gap:8px;justify-content:space-between;align-items:center;';
    newRow.innerHTML=
      '<button class="btn btn-sm" onclick="deleteEditingBlock()" style="font-size:12px;background:rgba(229,57,53,0.15);border-color:#e53935;color:#e53935;">🗑 Delete</button>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">'
      +'<button class="btn btn-sm" onclick="pushBlockToGoogle(\''+block.id+'\')" style="font-size:11px;" title="Open in Google Calendar">📅 → Google</button>'
      +'<button class="btn btn-sm" onclick="closeWorkTodayModal()" style="font-size:12px;">Cancel</button>'
      +'<button class="btn btn-accent btn-sm" onclick="confirmWorkToday()" style="font-size:12px;background:#5be8ff;color:#02141a;">Update</button>'
      +'</div>';
    // Replace the existing schedule button row
    var existingBtns=Array.from(modalBody.querySelectorAll('button')).find(function(b){return b.textContent.trim()==='Schedule';});
    if(existingBtns&&existingBtns.parentElement){
      existingBtns.parentElement.replaceWith(newRow);
    }else{
      modalBody.appendChild(newRow);
    }
  }
  
  _wtUpdateConflicts();
  document.getElementById('workTodayModal').classList.add('open');
  
  var t=document.getElementById('wtTime');
  var d=document.getElementById('wtDuration');
  if(t)t.oninput=_wtUpdateConflicts;
  if(d)d.onchange=_wtUpdateConflicts;
}

function deleteEditingBlock(){
  if(!_wtCurrentItem||!_wtCurrentItem._editBlockId)return;
  var blockName=_wtCurrentItem.name;
  _confirm('Delete "'+blockName+'"?',function(){
    var id=_wtCurrentItem._editBlockId;
    state.tlBlocks=(state.tlBlocks||[]).filter(function(b){return b.id!==id;});
    save();
    closeWorkTodayModal();
    renderProjects();renderTaskList();renderTimeline();
    if(typeof updateDayProgress==='function')updateDayProgress();
  },{destructive:true,confirmText:'Delete'});
  toast('Deleted');
}

// === Drag-to-reschedule (works on both banner and timeline) ===
var _tlDragInProgress=false;

// Drop any timeline block pinned to an item that has just been completed.
//
// Without this, completing a task that had been dragged (or scheduled with the
// clock button) leaves an orphan block sitting on the timeline forever: the
// auto-derived rows check `done`, but a real tlBlock is independent state and
// nothing was clearing it. That breaks the core rule for these blocks -- they
// go away when the item is checked off, and only then.
//
// Plain filter + save, matching what reminderPopupDone already does for
// reminder-linked blocks. No _tombstone: tlBlocks is not one of
// SYNC_ACTIVE_ARRAYS in sync-merge.js, so it is not tombstone-reconciled and a
// tombstone here would be inert.
function _tlUnlinkBlocks(itemId){
  if(!itemId||!state.tlBlocks)return;
  state.tlBlocks=state.tlBlocks.filter(function(b){return b.linkedId!==itemId;});
}

// Turn an auto-placed (derived) task/subtask block into a REAL linked tlBlock at
// the given time. Once materialized it is canonical: _tlCollectBlocks skips
// auto-derivation for any item a tlBlock links to, so the item stops being
// re-placed at its computed slot and stays where the user dropped it.
function _tlMaterializeDerived(d,timeVal,dateStr){
  var realId=d.id.replace(/^task_/,'').replace(/^st_/,'');
  var block=_buildTimelineBlock({
    name:d.name,
    date:dateStr||todayStr(),
    time:timeVal,
    duration:d.durMin,
    projectId:d.projectId||'',
    priority:d.priority||'med',
    linkedType:d.source==='task'?'task':'subtask',
    linkedId:realId
  });
  if(!state.tlBlocks)state.tlBlocks=[];
  state.tlBlocks.push(block);
  return block;
}

function _tlAttachDragHandlers(el,blockId,mode,derived,dateStr){
  // mode: 'banner' (horizontal drag) or 'timeline' (vertical drag)
  // state.tlBlocks entries (manual + clock-button scheduled) drag directly.
  // Auto-placed task/subtask blocks also drag: the first drag materializes them
  // into a real linked tlBlock at the drop point (see _tlMaterializeDerived).
  // Reminder-derived blocks stay fixed -- they follow the reminder's own time,
  // so dragging one would just be overwritten on the next render.
  var inTlBlocks=(state.tlBlocks||[]).some(function(b){return b.id===blockId;});
  var canMaterialize=!inTlBlocks&&!!derived&&
    (derived.source==='task'||derived.source==='subtask');
  if(!inTlBlocks&&!canMaterialize){el.style.cursor='default';return;}

  var dragging=false,startCoord=0,initialStartMin=0,pxPerMin=0,blockRef=null,pendingMin=null;

  el.addEventListener('pointerdown',function(e){
    if(e.button!==0&&e.pointerType==='mouse')return; // left button only for mouse
    // If pointerdown originated on the delete X (or any element marked as a control),
    // bail out -- let that element's own click handler fire normally.
    if(e.target&&e.target.closest&&e.target.closest('.tl-block-del'))return;
    blockRef=(state.tlBlocks||[]).find(function(b){return b.id===blockId;});
    // Derived block: stand in with its rendered geometry so the drag maths
    // below are identical. Nothing is written to state until the drop, so a
    // tap that doesn't move creates nothing.
    if(!blockRef&&canMaterialize){
      var _hh=Math.floor(derived.startMin/60),_mm=derived.startMin%60;
      blockRef={time:(_hh<10?'0':'')+_hh+':'+(_mm<10?'0':'')+_mm,
                duration:derived.durMin};
    }
    if(!blockRef)return;
    e.preventDefault();
    e.stopPropagation();
    
    initialStartMin=_tlParseTime(blockRef.time);
    pendingMin=initialStartMin;
    
    if(mode==='banner'){
      var bar=document.getElementById('dayProgressBar');
      if(!bar)return;
      var rect=bar.getBoundingClientRect();
      // Banner spans 5am-8pm = 900 min
      pxPerMin=rect.width/900;
      startCoord=e.clientX;
    }else{
      // Timeline: 52px per hour
      pxPerMin=TL_HOUR_PX/60;
      startCoord=e.clientY;
    }
    
    dragging=true;
    _tlDragInProgress=true;
    try{el.setPointerCapture(e.pointerId);}catch(err){}
    el.classList.add('dragging');
  });
  
  el.addEventListener('pointermove',function(e){
    if(!dragging)return;
    e.preventDefault();
    
    var deltaPx=(mode==='banner'?e.clientX:e.clientY)-startCoord;
    var deltaMin=deltaPx/pxPerMin;
    // Snap to 15-min increments
    var snappedDelta=Math.round(deltaMin/15)*15;
    var newStartMin=initialStartMin+snappedDelta;
    
    // Constrain to valid range
    var maxStart=24*60-(parseInt(blockRef.duration)||60);
    newStartMin=Math.max(0,Math.min(maxStart,newStartMin));
    pendingMin=newStartMin;
    
    // Live visual update
    if(mode==='banner'){
      var BANNER_START=5*60,BANNER_RANGE=900;
      var dur=parseInt(blockRef.duration)||60;
      var endMin=newStartMin+dur;
      if(endMin<=BANNER_START||newStartMin>=20*60){el.style.display='none';return;}
      var clippedStart=Math.max(newStartMin,BANNER_START);
      var clippedEnd=Math.min(endMin,20*60);
      el.style.display='';
      el.style.left=((clippedStart-BANNER_START)/BANNER_RANGE)*100+'%';
      el.style.width=((clippedEnd-clippedStart)/BANNER_RANGE)*100+'%';
    }else{
      el.style.top=_tlMinutesToY(newStartMin)+'px';
    }
  });
  
  var commit=function(e){
    if(!dragging)return;
    dragging=false;
    _tlDragInProgress=false;
    try{el.releasePointerCapture(e.pointerId);}catch(err){}
    el.classList.remove('dragging');
    
    if(pendingMin===null||pendingMin===initialStartMin){
      // No real movement -- re-render to clean up any partial visual changes
      renderTimeline();
      return;
    }
    
    // Commit new time to state
    var hh=Math.floor(pendingMin/60),mm=pendingMin%60;
    var newTime=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm;
    var liveBlock=(state.tlBlocks||[]).find(function(b){return b.id===blockId;});
    // First drag of an auto-placed task: promote it to a real linked block at
    // the drop point. Done here rather than on pointerdown so a stray tap never
    // silently pins a task to its computed slot.
    if(!liveBlock&&canMaterialize){
      liveBlock=_tlMaterializeDerived(derived,newTime,dateStr);
    }
    if(liveBlock){
      liveBlock.time=newTime;
      save();
      renderTimeline();
      if(typeof updateDayProgress==='function')updateDayProgress();
      toast('Moved to '+_tlFmtTime(pendingMin));
    }
  };
  
  el.addEventListener('pointerup',commit);
  el.addEventListener('pointercancel',commit);
}


function renderBannerBlocks(){
  var bar=document.getElementById('dayProgressBar');
  if(!bar)return;
  // Remove existing overlay container
  var existing=bar.querySelector('.day-progress-bar-blocks');
  if(existing)existing.remove();
  
  var blocks=_tlCollectBlocks();
  if(blocks.length===0)return;
  
  // Banner window: 5am → 8pm = 15 hours
  var BANNER_START=5*60,BANNER_END=20*60,BANNER_RANGE=BANNER_END-BANNER_START;
  
  var palette=['#5b8ce8','#7fb3a0','#e88c6a','#c77dba','#a0a0aa','#9e7bff','#5be8ff','#ff6b9d'];
  
  var container=document.createElement('div');
  container.className='day-progress-bar-blocks';
  
  blocks.forEach(function(b){
    var startMin=b.startMin;
    var endMin=startMin+b.durMin;
    // Clip to banner range
    if(endMin<=BANNER_START||startMin>=BANNER_END)return;
    var clippedStart=Math.max(startMin,BANNER_START);
    var clippedEnd=Math.min(endMin,BANNER_END);
    var leftPct=((clippedStart-BANNER_START)/BANNER_RANGE)*100;
    var widthPct=((clippedEnd-clippedStart)/BANNER_RANGE)*100;
    var colorIdx=_tlProjectColor(b.projectId);
    var color=colorIdx==='no-proj'?'rgba(255,255,255,0.4)':palette[colorIdx];
    
    var block=document.createElement('div');
    block.className='dpb-block';
    block.style.left=leftPct+'%';
    block.style.width=widthPct+'%';
    block.style.background=color;
    block.title=b.name+' -- '+_tlFmtTime(startMin)+' to '+_tlFmtTime(endMin)+' · drag to reschedule';
    block.dataset.blockId=b.id;
    _tlAttachDragHandlers(block,b.id,'banner',b,todayStr());
    block.addEventListener('click',function(ev){
      if(_tlDragInProgress)return;
      ev.stopPropagation();
      editTimelineBlock(b.id);
    });
    container.appendChild(block);
  });
  
  bar.appendChild(container);
}

function _tlMinutesToY(minutes){
  // minutes from midnight → Y px offset within tl-grid
  var startMin=TL_DAY_START_H*60;
  return ((minutes-startMin)/60)*TL_HOUR_PX;
}

function _tlParseTime(hhmm){
  if(!hhmm||hhmm.indexOf(':')<0)return null;
  var parts=hhmm.split(':');
  return parseInt(parts[0])*60+parseInt(parts[1]);
}

function _tlFmtTime(min){
  var h=Math.floor(min/60),m=min%60;
  var ap=h<12?'a':'p';
  var h12=h===0?12:h>12?h-12:h;
  return h12+(m===0?'':':'+(m<10?'0':'')+m)+ap;
}

function _tlFmtHour(h){
  var ap=h<12?'a':'p';
  var h12=h===0?12:h>12?h-12:h;
  return h12+ap;
}

function _tlCollectBlocks(targetDate){
  // Returns array of block objects for the given date (defaults to today).
  // Sources: explicit tlBlocks (manual + scheduled-via-modal) take priority.
  // Auto-derivation from reminders/subtasks/tasks happens ONLY if no tlBlock
  // already links to that item -- prevents an item from showing on multiple
  // days when its "official" schedule has been moved via the schedule modal.
  var today=targetDate||todayStr();
  var blocks=[];
  
  // Build set of all linkedIds across ALL tlBlocks (any date).
  // If a tlBlock anywhere points to a task/subtask, that tlBlock is the
  // canonical scheduling for that item -- skip auto-derivation entirely.
  var linkedIds={};
  (state.tlBlocks||[]).forEach(function(b){
    if(b.linkedId)linkedIds[b.linkedId]=true;
  });
  
  // 1. Manual / modal-scheduled tlBlocks for THIS date
  (state.tlBlocks||[]).forEach(function(b){
    if(b.date===today){
      blocks.push({
        id:b.id,name:b.name,startMin:_tlParseTime(b.time),durMin:parseInt(b.duration||60),
        projectId:b.projectId||'',priority:b.priority||'med',source:'manual'
      });
    }
  });
  
  // 2. Reminders with date matching AND time set -- auto-derive if no tlBlock links to it
  (state.reminders||[]).forEach(function(r){
    if(r.date===today&&r.time&&!linkedIds[r.id]){
      var projId=(r.projectIds&&r.projectIds[0])||r.projectId||'';
      blocks.push({
        id:'rem_'+r.id,name:r.text,startMin:_tlParseTime(r.time),durMin:30,
        projectId:projId,priority:'med',source:'reminder'
      });
    }
  });
  
  // 3. Subtasks with due matching AND time -- auto-derive only if no tlBlock links to it
  (state.projects||[]).forEach(function(p){
    (p.subtasks||[]).forEach(function(st){
      if(!st.done&&st.due===today&&st.time&&!linkedIds[st.id]){
        blocks.push({
          id:'st_'+st.id,name:st.name,startMin:_tlParseTime(st.time),
          durMin:parseInt(st.timeEst)||60,
          projectId:p.id,priority:st.priority||'med',source:'subtask'
        });
      }
    });
  });
  
  // 4. Standalone tasks with due matching AND time -- auto-derive only if no tlBlock links to it
  (state.tasks||[]).forEach(function(t){
    if(!t.done&&t.due===today&&t.time&&!linkedIds[t.id]){
      var projId=t.projectId||(t.projectIds&&t.projectIds[0])||'';
      blocks.push({
        id:'task_'+t.id,name:t.name,startMin:_tlParseTime(t.time),
        durMin:parseInt(t.timeEst)||60,
        projectId:projId,priority:t.priority||'med',source:'task'
      });
    }
  });
  
  // Drop anything whose time didn't parse BEFORE the untimed pass below --
  // otherwise a garbage time would count as an occupied slot and push the
  // 9am cascade around for no reason.
  blocks=blocks.filter(function(b){return b.startMin!==null&&!isNaN(b.startMin);});

  // 5. Untimed tasks/subtasks due on this date -- a task that "falls on" a day
  // shows up on that day's timeline without needing a time set. It is placed in
  // the FIRST GAP BIG ENOUGH FOR ITS OWN LENGTH, searching forward from 9am,
  // stepping 15 min (matching the drag snap). Anything already placed -- real
  // blocks, timed items, and earlier untimed ones -- is treated as occupied, so
  // a derived block never buries a real 6am workout or an existing meeting.
  //
  // Length comes from the task's own time estimate, the same `timeEst` the
  // timed rows above use. An earlier version hardcoded 30 minutes here and
  // silently squashed hour-long tasks; the estimate is real user input and is
  // not ours to discard. 30 min is only the fallback when no estimate is set.
  //
  // Same `source` values as the timed rows above, so these can't be deleted
  // from the timeline -- they clear when the item is checked off, which is the
  // requested behavior. They CAN be dragged: _tlAttachDragHandlers materializes
  // a derived block into a real linked tlBlock on first drag.
  var UNTIMED_START=9*60, UNTIMED_STEP=15, UNTIMED_FALLBACK_DUR=30;
  var DAY_END=TL_DAY_END_H*60;
  // '999' is the "4hr+" sentinel in TIME_LABELS, not a real 999-minute task.
  // Left as-is it would swallow the whole grid and shove everything else out.
  var estDur=function(v){
    var n=parseInt(v);
    if(!n||isNaN(n))return UNTIMED_FALLBACK_DUR;
    return n>=999?240:n;
  };
  var untimed=[];
  (state.projects||[]).forEach(function(p){
    (p.subtasks||[]).forEach(function(st){
      if(!st.done&&st.due===today&&!st.time&&!linkedIds[st.id]){
        untimed.push({id:'st_'+st.id,name:st.name,projectId:p.id,
          priority:st.priority||'med',source:'subtask',durMin:estDur(st.timeEst)});
      }
    });
  });
  (state.tasks||[]).forEach(function(t){
    if(!t.done&&t.due===today&&!t.time&&!linkedIds[t.id]){
      untimed.push({id:'task_'+t.id,name:t.name,
        projectId:t.projectId||(t.projectIds&&t.projectIds[0])||'',
        priority:t.priority||'med',source:'task',durMin:estDur(t.timeEst)});
    }
  });

  if(untimed.length){
    // Occupied intervals, growing as each item is placed so later ones pack in
    // after earlier ones rather than on top of them.
    var taken=blocks.map(function(b){return [b.startMin,b.startMin+b.durMin];});
    // Longest first: a 2hr task placed after three 30m ones would otherwise be
    // pushed past gaps that were big enough for it before they got filled.
    untimed.sort(function(a,b){return b.durMin-a.durMin;}).forEach(function(u){
      var dur=u.durMin;
      var lastStart=DAY_END-dur;
      var slot=UNTIMED_START;
      var fits=function(s){
        return !taken.some(function(iv){return s<iv[1]&&s+dur>iv[0];});
      };
      while(slot<=lastStart&&!fits(slot))slot+=UNTIMED_STEP;
      // Day genuinely full: park it at 9am rather than off the end of the grid.
      // It will overlap, but an overlapping visible block beats an invisible one.
      if(slot>lastStart)slot=UNTIMED_START;
      taken.push([slot,slot+dur]);
      blocks.push({id:u.id,name:u.name,startMin:slot,durMin:dur,
        projectId:u.projectId,priority:u.priority,source:u.source});
    });
  }

  return blocks;
}

function _tlBuildLegend(){
  // Build legend from projects that have blocks on the active view date
  var blocks=_tlCollectBlocks(typeof _tlViewDate==='function'?_tlViewDate():undefined);
  var seen={};
  blocks.forEach(function(b){
    if(b.projectId&&!seen[b.projectId])seen[b.projectId]=true;
  });
  var projIds=Object.keys(seen);
  var el=document.getElementById('tlLegend');
  if(!el)return;
  if(projIds.length===0){el.innerHTML='';return;}
  
  var palette=['#5b8ce8','#7fb3a0','#e88c6a','#c77dba','#a0a0aa','#9e7bff','#5be8ff','#ff6b9d'];
  var html=projIds.map(function(pid){
    var p=(state.projects||[]).find(function(p){return p.id===pid;});
    if(!p)return '';
    var c=_tlProjectColor(pid);
    return '<span class="tl-legend-item"><span class="tl-legend-dot" style="background:'+palette[c]+';"></span><span class="tl-legend-label">'+esc(p.name)+'</span></span>';
  }).join('');
  el.innerHTML=html;
}

var _tlViewDay='today'; // 'today' or 'tomorrow' -- controls which day the panel shows

function _tlViewDate(){
  return _tlViewDay==='tomorrow'?tomorrowStr():todayStr();
}

function tlSetViewDay(day){
  if(day!=='today'&&day!=='tomorrow')return;
  _tlViewDay=day;
  // Update tab visuals
  document.querySelectorAll('.tl-day-tab').forEach(function(btn){
    if(btn.dataset.day===day){
      btn.classList.add('active');
      btn.style.background='rgba(91,232,255,0.18)';
      btn.style.color='#5be8ff';
    }else{
      btn.classList.remove('active');
      btn.style.background='var(--surface-raised)';
      btn.style.color='var(--text-dim)';
    }
  });
  // Update panel title
  var titleEl=document.getElementById('tlPanelTitle');
  if(titleEl)titleEl.textContent=day==='tomorrow'?"Tomorrow's Timeline":"Today's Timeline";
  renderTimeline();
}

function renderTimeline(){
  var grid=document.getElementById('tlGrid');
  if(!grid)return;
  
  var viewDate=_tlViewDate();
  var isToday=viewDate===todayStr();
  
  // Build hour rows
  var html='';
  for(var h=TL_DAY_START_H;h<TL_DAY_END_H;h++){
    html+='<div class="tl-hour-row" style="height:'+TL_HOUR_PX+'px;"><div class="tl-hour-label">'+_tlFmtHour(h)+'</div></div>';
  }
  grid.innerHTML=html;
  
  // Place "now" line -- only when viewing today
  if(isToday){
    var now=new Date();
    var nowMin=now.getHours()*60+now.getMinutes();
    if(nowMin>=TL_DAY_START_H*60&&nowMin<TL_DAY_END_H*60){
      var nowY=_tlMinutesToY(nowMin);
      var nowDiv=document.createElement('div');
      nowDiv.className='tl-now-line';
      nowDiv.style.top=nowY+'px';
      grid.appendChild(nowDiv);
    }
  }
  
  // Place blocks for the active view date
  var blocks=_tlCollectBlocks(viewDate);
  var winStart=TL_DAY_START_H*60;   // 5am in minutes
  var winEnd=TL_DAY_END_H*60;       // 10pm in minutes
  blocks.forEach(function(b){
    var blockEnd=b.startMin+b.durMin;
    // Skip if block is entirely outside the visible window
    if(blockEnd<=winStart||b.startMin>=winEnd)return;
    // Clip to visible window (block may start before 5am or end after 10pm)
    var visStart=Math.max(b.startMin,winStart);
    var visEnd=Math.min(blockEnd,winEnd);
    var visDur=visEnd-visStart;
    var clippedStart=visStart>b.startMin;  // true if start was clipped
    var clippedEnd=visEnd<blockEnd;        // true if end was clipped
    var y=_tlMinutesToY(visStart);
    var height=Math.max(24,(visDur/60)*TL_HOUR_PX-2);
    var colorClass='tl-color-'+_tlProjectColor(b.projectId);
    var proj=b.projectId?(state.projects||[]).find(function(p){return p.id===b.projectId;}):null;
    var projName=proj?proj.name:'';
    var endMin=b.startMin+b.durMin;
    var div=document.createElement('div');
    div.className='tl-block '+colorClass+(clippedStart?' tl-block-clipped-top':'')+(clippedEnd?' tl-block-clipped-bottom':'');
    div.style.top=y+'px';
    div.style.height=height+'px';
    if(clippedStart){
      // Show a visual cue that this block started earlier
      div.style.borderTop='2px dashed rgba(255,255,255,0.4)';
      div.style.borderRadius='0 4px 4px 4px';
    }
    if(clippedEnd){
      div.style.borderBottom='2px dashed rgba(255,255,255,0.4)';
      div.style.borderRadius=(clippedStart?'0 4px':'4px 4px')+' 4px 0';
    }
    div.dataset.blockId=b.id;
    div.dataset.source=b.source;
    div.innerHTML=
      '<div class="tl-block-title">'+esc(b.name)
      +(clippedStart?' <span style="font-size:9px;opacity:0.7">← started '+_tlFmtTime(b.startMin)+'</span>':'')
      +'</div>'
      +'<div class="tl-block-meta">'+_tlFmtTime(b.startMin)+' – '+_tlFmtTime(endMin)+' · '+b.durMin+'m</div>'
      +(projName?'<div class="tl-block-proj">'+esc(projName)+'</div>':'')
      +(b.source==='manual'?'<div class="tl-block-del" onclick="event.stopPropagation();deleteTimelineBlock(\''+b.id+'\')" title="Delete block">&#10005;</div>':'');
    if(b.source==='manual'){
      div.addEventListener('click',function(ev){
        if(_tlDragInProgress)return;
        if(ev.target.classList&&ev.target.classList.contains('tl-block-del'))return;
        editTimelineBlock(b.id);
      });
    }
    _tlAttachDragHandlers(div,b.id,'timeline',b,viewDate);
    grid.appendChild(div);
  });
  
  if(blocks.length===0){
    var emptyDiv=document.createElement('div');
    emptyDiv.className='tl-empty-state';
    emptyDiv.innerHTML='<p>Your timeline is clear. Add a block to plan your day.</p><button class="btn btn-accent btn-sm" onclick="document.getElementById(\'tlBlockName\').focus()">+ Add a time block</button>';
    grid.appendChild(emptyDiv);
  }
  // Update count badge + legend
  var countEl=document.getElementById('tlBlockCount');
  if(countEl)countEl.textContent=blocks.length;
  _tlBuildLegend();
  // Refresh banner overlay
  if(typeof renderBannerBlocks==='function')renderBannerBlocks();
  // Refresh the Today view's Timeline section (no-ops if Today isn't the
  // active view). Every tlBlocks mutation (add/delete/edit/drag/unlink)
  // already routes through this function, same as renderBannerBlocks above --
  // one call here covers all of them instead of threading it into each site.
  if(typeof _refreshTodayViewIfVisible==='function')_refreshTodayViewIfVisible();
}

function addTimelineBlock(){
  var nameEl=document.getElementById('tlBlockName');
  var timeEl=document.getElementById('tlBlockStart');
  var durEl=document.getElementById('tlBlockDur');
  var projEl=document.getElementById('tlBlockProj');
  var name=nameEl.value.trim();
  if(!name){toast('Block needs a name');return;}
  if(!timeEl.value){toast('Pick a start time');return;}
  
  if(!state.tlBlocks)state.tlBlocks=[];
  var projIds=(projEl.value||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
  // Use the active panel view day so blocks land on whatever day the user is looking at
  var blockDate=(typeof _tlViewDate==='function')?_tlViewDate():todayStr();
  state.tlBlocks.push({
    id:'tlb'+Date.now()+Math.random().toString(36).slice(2),
    name:name,
    date:blockDate,
    time:timeEl.value,
    duration:parseInt(durEl.value)||60,
    projectId:projIds[0]||'',
    projectIds:projIds,
    priority:'med'
  });
  save();
  nameEl.value='';
  // Reset picker UI
  projEl.value='';
  var picker=document.getElementById('tlBlockProjPicker');
  if(picker)picker.innerHTML='<span class="proj-multi-placeholder">+ Project (color)</span>';
  renderTimeline();
  if(typeof updateDayProgress==='function')updateDayProgress();
  var dayLabel=blockDate===todayStr()?'today':(blockDate===tomorrowStr()?'tomorrow':blockDate);
  
}

function deleteTimelineBlock(id){
  var block=(state.tlBlocks||[]).find(function(b){return b.id===id;});
  var blockName=block?block.name:'this block';
  _confirm('Delete "'+blockName+'"?',function(){
    state.tlBlocks=(state.tlBlocks||[]).filter(function(b){return b.id!==id;});
    save();
    renderProjects();renderTaskList();renderTimeline();
    if(typeof updateDayProgress==='function')updateDayProgress();
    toast('Deleted');
  },{destructive:true,confirmText:'Delete'});
}

function clearTimelineBlocks(){
  var viewDate=(typeof _tlViewDate==='function')?_tlViewDate():todayStr();
  var dayLabel=viewDate===todayStr()?'today':(viewDate===tomorrowStr()?'tomorrow':viewDate);
  var count=(state.tlBlocks||[]).filter(function(b){return b.date===viewDate;}).length;
  if(count===0){toast('No manual blocks to clear for '+dayLabel);return;}
  _confirm('Delete all '+count+' manual blocks for '+dayLabel+'?',function(){
    state.tlBlocks=(state.tlBlocks||[]).filter(function(b){return b.date!==viewDate;});
    save();renderTimeline();
    if(typeof updateDayProgress==='function')updateDayProgress();
    toast('Manual blocks cleared');
  },{destructive:true,confirmText:'Clear All'});
}

// === Outlook .ics export ===
function _icsEscape(s){
  return (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
}

function _icsTimestamp(date,minutes){
  // date is YYYY-MM-DD, minutes is from midnight
  var d=new Date(date+'T00:00:00');
  d.setMinutes(d.getMinutes()+minutes);
  var pad=function(n){return n<10?'0'+n:''+n;};
  return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'T'+pad(d.getHours())+pad(d.getMinutes())+'00';
}

function exportTimelineICS(){
  var viewDate=(typeof _tlViewDate==='function')?_tlViewDate():todayStr();
  var dayLabel=viewDate===todayStr()?'today':(viewDate===tomorrowStr()?'tomorrow':viewDate);
  var blocks=_tlCollectBlocks(viewDate);
  if(blocks.length===0){toast('No blocks for '+dayLabel+' to export');return;}
  var lines=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Centerpost//Timeline//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  blocks.forEach(function(b){
    var proj=b.projectId?(state.projects||[]).find(function(p){return p.id===b.projectId;}):null;
    var summary=b.name;
    var description=(proj?'Project: '+proj.name+'\n':'')+'Source: '+b.source+' (Centerpost)';
    lines.push('BEGIN:VEVENT');
    lines.push('UID:'+b.id+'@centerpost.app');
    lines.push('DTSTAMP:'+_icsTimestamp(viewDate,b.startMin));
    lines.push('DTSTART:'+_icsTimestamp(viewDate,b.startMin));
    lines.push('DTEND:'+_icsTimestamp(viewDate,b.startMin+b.durMin));
    lines.push('SUMMARY:'+_icsEscape(summary));
    lines.push('DESCRIPTION:'+_icsEscape(description));
    if(proj)lines.push('CATEGORIES:'+_icsEscape(proj.name));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  var ics=lines.join('\r\n');
  var blob=new Blob([ics],{type:'text/calendar'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='centerpost-timeline-'+viewDate+'.ics';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Downloaded .ics -- drag into Outlook');
}

function connectOutlookGraph(){
  toast('Outlook two-way sync requires Azure AD app setup -- coming in next build');
}

// === Google Calendar push ===
// Uses Google Calendar's render URL -- no API key, no auth setup required.
// User just needs to be logged into their Google account in the browser.
// Each block opens in a new tab pre-filled; user clicks "Save" to add it.
function _pad2(n){return n<10?'0'+n:''+n;}

function _gcalUrl(block,dateStr){
  // dateStr format: YYYY-MM-DD; convert to YYYYMMDD for Google
  var d=dateStr.replace(/-/g,'');
  var startMin=block.startMin;
  var endMin=startMin+block.durMin;
  var startStamp=d+'T'+_pad2(Math.floor(startMin/60))+_pad2(startMin%60)+'00';
  var endStamp=d+'T'+_pad2(Math.floor(endMin/60))+_pad2(endMin%60)+'00';
  
  var proj=block.projectId?(state.projects||[]).find(function(p){return p.id===block.projectId;}):null;
  var title=block.name;
  var details=(proj?'Project: '+proj.name+'\n':'')+'Source: Centerpost ('+block.source+')';
  
  var params=new URLSearchParams({
    action:'TEMPLATE',
    text:title,
    dates:startStamp+'/'+endStamp,
    details:details
  });
  return 'https://calendar.google.com/calendar/render?'+params.toString();
}

function pushToGoogleCalendar(){
  var viewDate=(typeof _tlViewDate==='function')?_tlViewDate():todayStr();
  var dayLabel=viewDate===todayStr()?'today':(viewDate===tomorrowStr()?'tomorrow':viewDate);
  var blocks=_tlCollectBlocks(viewDate);
  if(blocks.length===0){toast('No blocks for '+dayLabel+' to push');return;}
  
  // Sort by start time so tabs open in chronological order
  blocks.sort(function(a,b){return a.startMin-b.startMin;});
  
  // Open all blocks in tabs; show confirm when >1 tab will open
  var _openGcalTabs=function(){
    var opened=0;
    blocks.forEach(function(b,i){
      setTimeout(function(){
        var w=window.open(_gcalUrl(b,viewDate),'_blank');
        if(w)opened++;
      },i*250);
    });
    setTimeout(function(){
      toast(blocks.length===1?'Opened in Google Calendar -- click Save':'Opened '+blocks.length+' tab(s) in Google Calendar -- click Save in each');
    },blocks.length*250+100);
  };
  if(blocks.length>1){
    _confirm('Push '+blocks.length+' blocks for '+dayLabel+' to Google Calendar? Each block opens in a new tab -- allow pop-ups if prompted.',_openGcalTabs,{confirmText:'Push All',icon:'ti-calendar-plus'});
    return;
  }
  _openGcalTabs();
}

// Push a single block to Google Calendar (used from edit modal)
function pushBlockToGoogle(blockId){
  var block=(state.tlBlocks||[]).find(function(b){return b.id===blockId;});
  if(!block){toast('Block not found');return;}
  var startMin=_tlParseTime(block.time);
  if(isNaN(startMin)){toast('Invalid block time');return;}
  var blockData={
    name:block.name,
    startMin:startMin,
    durMin:parseInt(block.duration)||60,
    projectId:block.projectId||'',
    priority:block.priority||'med',
    source:block.linkedType||'manual'
  };
  window.open(_gcalUrl(blockData,block.date),'_blank');
  toast('Opened in Google Calendar -- click Save');
}

// Auto-refresh timeline every minute so the "now" line moves
setInterval(function(){
  if(_tlDragInProgress)return; // Don't yank the block out of the user's hand
  var el=document.getElementById('tlGrid');
  if(el&&document.visibilityState==='visible')renderTimeline();
},60000);

// =======================================
// END TIMELINE
// =======================================

// =======================================
// END TIMELINE
// =======================================

// =======================================
// THEME SYSTEM
// =======================================
var THEMES=[
  {key:'dark',name:'Dark',tier:'free',bg:'#1a1917',surface:'#242320',accent:'#d4a853'},
  {key:'light',name:'Light',tier:'free',bg:'#f6f4f0',surface:'#ffffff',accent:'#b08830'},
  {key:'starry',name:'Starry Night',tier:'pro',bg:'#0a0e1a',surface:'#10152a',accent:'#7b68ee'},
  {key:'sunny',name:'Sunny Sky',tier:'pro',bg:'#e8f0fa',surface:'#ffffff',accent:'#e07828'},
  {key:'ocean',name:'Midnight Ocean',tier:'pro',bg:'#0a1a1a',surface:'#0f2222',accent:'#20c9a6'},
  {key:'sunset',name:'Sunset Horizon',tier:'pro',bg:'#1a1018',surface:'#1e1420',accent:'#e84a7a'},
  {key:'police',name:'Police Dark',tier:'premium',bg:'#0a0c14',surface:'#101420',accent:'#3a7aee'},
  {key:'fire',name:'Fire Dark',tier:'premium',bg:'#120808',surface:'#1a0e0e',accent:'#e53935'},
  {key:'autumn',name:'Autumn Ember',tier:'premium',bg:'#f0ebe0',surface:'#faf5ec',accent:'#c06030'},
  {key:'storm-dark',name:'Storm Dark',tier:'premium',bg:'#0c0f14',surface:'#111520',accent:'#7ab8e8'},
  {key:'galaxy',name:'Galaxy',tier:'premium',bg:'#050a18',surface:'#0a1124',accent:'#4a90e8'}
];
// Retired from the picker (Joe's call) but deliberately left in THEMES itself --
// applyTheme()/_applySavedTheme() still resolve these by key, so anyone already
// on one of these keeps working correctly; only renderThemeSelector() excludes
// them from the selectable grid. Bring one back by removing its key here.
var RETIRED_THEME_KEYS=['ocean','sunset','police','fire','autumn'];
// Build stamp -- bump this on each deploy. Shown at the bottom of Settings so
// you can confirm on any device exactly which build it's running.
var APP_BUILD='2026.06.06b-beta';
// BETA: ignore tier gating for themes (every theme selectable). Set to false
// to restore the per-tier theme locks after beta.
var BETA_ALL_THEMES=true;
// R4 (F13): the landing banner promises "all features are free while the
// developer is testing" -- an unqualified claim. Meanwhile applyTierGating()
// still blur-locked panels whose OWN home row advertised a live item count
// (e.g. Reminders showing "40" then opening behind an Upgrade paywall), and
// _injectPanelLockBadge's "Upgrade to Pro" button called only _tierUpgradeToast
// -- a toast, no purchase flow, so the lock protected nothing anyway. Same
// single-flag pattern as BETA_ALL_THEMES, applied to the rest of
// applyTierGating() so the beta banner stops contradicting the UI under it.
// Set to false to restore real tier enforcement post-beta -- every check
// below reads this flag, nothing else needs to change.
var BETA_ALL_FEATURES=true;

function applyTheme(key){
  // Block if theme is above current tier
  var cfg=getTierConfig();
  var theme=THEMES.find(function(t){return t.key===key;});
  if(!BETA_ALL_THEMES&&theme&&cfg.allowedThemeTiers.indexOf(theme.tier)<0){
    if(typeof toast==='function')toast('⚡ Upgrade to unlock this theme');
    return;
  }
  if(key==='dark'){
    document.body.removeAttribute('data-theme');
  }else{
    document.body.setAttribute('data-theme',key);
  }
  if(!state.settings)state.settings={};
  state.settings.theme=key;
  save();
  renderThemeSelector();
  if(theme){
    var metas=document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach(function(m){m.setAttribute('content',theme.bg);});
  }
  _emsUpdateOverlays(key);
}

// -- Emergency theme overlays (fire = strobe+fire+embers, police = strobe) --
var _emsEmberInterval=null;
function _emsUpdateOverlays(key){
  if(key==='fire'){
    _emsStartEmbers();
  } else {
    _emsStopEmbers();
  }
  if(key==='starry'){
    _starryStart();
  } else {
    _starryStop();
  }
  if(key==='storm-dark'||key==='storm-light'){
    _stormStart();
  } else {
    _stormStop();
  }
  if(key==='galaxy'){
    _galaxyStart();
  } else {
    _galaxyStop();
  }
}

// -- Galaxy: dense flowing orbital trails (canvas) ----------------
// Eccentric, slowly-precessing orbits around the core; trails emerge
// from per-frame fade + additive blending. Warm amber/gold palette.
var _galaxyAnim=null;
function _galaxyStart(){
  var layer=document.getElementById('galaxyLayer');
  if(!layer)return;
  if(_galaxyAnim){ return; } // already running
  var cv=document.getElementById('galaxyCanvas');
  if(!cv){
    cv=document.createElement('canvas');
    cv.id='galaxyCanvas';
    cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;';
    layer.appendChild(cv);
  }
  _galaxyAnim=_galaxyEngine(cv);
}
function _galaxyStop(){
  if(_galaxyAnim){ _galaxyAnim.stop(); _galaxyAnim=null; }
  var layer=document.getElementById('galaxyLayer');
  if(layer){ layer.querySelectorAll('.gstar').forEach(function(e){e.remove();}); }
}

function _galaxyEngine(cv){
  var ctx=cv.getContext('2d');
  var raf=null, running=true, W,H,cx,cy;
  var dpr=Math.min(window.devicePixelRatio||1, 1.5);
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function size(){
    W=window.innerWidth; H=window.innerHeight;
    cv.width=Math.max(1,W*dpr); cv.height=Math.max(1,H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cx=W*0.52; cy=H*0.46;
  }
  size();
  window.addEventListener('resize', size);

  var COLORS=[
    [255,190,110],[255,170,80],[255,150,70],[255,120,70],
    [255,210,150],[255,235,200],[255,160,90],[255,180,100],
    [160,195,255],[200,220,255]  // sparse cool accents
  ];
  var maxR=Math.max(W,H)*0.62;
  var N=Math.max(260, Math.min(520, Math.floor((W*H)/3200)));
  var DISK=0.46;
  var DA=0.52, cosDA=Math.cos(DA), sinDA=Math.sin(DA);
  var P=[];
  for(var i=0;i<N;i++){
    var r=Math.pow(Math.random(),0.62)*maxR;
    var warm=Math.random()<0.9;
    var ci=warm?Math.floor(Math.random()*8):8+Math.floor(Math.random()*2);
    P.push({
      r:r, e:Math.random()*0.5, w:Math.random()*Math.PI*2,
      prec:(-0.0006 + Math.random()*0.0012),
      th:Math.random()*Math.PI*2,
      sp:(0.0007 + 0.9/(r+60)) * (0.7+Math.random()*0.6),
      c:COLORS[ci], sz:0.5 + Math.random()*1.5, br:0.30 + Math.random()*0.55
    });
  }

  var t0=performance.now();
  // one render step; `advance` moves the orbits forward
  function step(advance){
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='rgba(8,5,14,0.115)';
    ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='lighter';
    for(var i=0;i<P.length;i++){
      var p=P[i];
      if(advance){ p.th+=p.sp; p.w+=p.prec; }
      var rad=p.r*(1-p.e*p.e)/(1+p.e*Math.cos(p.th-p.w));
      var ex=Math.cos(p.th)*rad, ey=Math.sin(p.th)*rad*DISK;
      var x=cx + ex*cosDA - ey*sinDA;
      var y=cy + ex*sinDA + ey*cosDA;
      var c=p.c;
      ctx.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+p.br.toFixed(3)+')';
      ctx.beginPath(); ctx.arc(x,y,p.sz,0,6.2832); ctx.fill();
    }
    var t=(performance.now()-t0)/1000;
    var pulse=0.5+0.5*Math.sin(t*0.7);
    var coreR=maxR*0.26;
    var g=ctx.createRadialGradient(cx,cy,0,cx,cy,coreR);
    g.addColorStop(0,'rgba(255,245,225,'+(0.42+pulse*0.12).toFixed(3)+')');
    g.addColorStop(0.18,'rgba(255,205,150,0.22)');
    g.addColorStop(0.5,'rgba(255,150,90,0.08)');
    g.addColorStop(1,'rgba(255,120,70,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(cx,cy,coreR,0,6.2832); ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }

  function frame(){
    if(!running)return;
    step(true);
    raf=requestAnimationFrame(frame);
  }

  if(reduce){
    // build a dense static field, then hold (no animation)
    for(var k=0;k<140;k++){ step(true); }
    running=false;
  } else {
    for(var j=0;j<40;j++){ step(true); } // prime so it opens already-rich
    frame();
  }

  function vis(){
    if(reduce)return;
    if(document.hidden){ running=false; if(raf)cancelAnimationFrame(raf); }
    else if(!running){ running=true; frame(); }
  }
  document.addEventListener('visibilitychange', vis);

  return { stop:function(){
    running=false;
    if(raf)cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    document.removeEventListener('visibilitychange', vis);
    try{ ctx.clearRect(0,0,W,H); }catch(e){}
    if(cv&&cv.parentNode){ cv.parentNode.removeChild(cv); }
  }};
}

// -- Starry Night: stars + fireflies ------------------------------
var _starryActive=false;
var _fireflyInterval=null;

function _starryStart(){
  if(_starryActive)return;
  _starryActive=true;
  _spawnStars();
  _spawnFireflies();
}

function _starryStop(){
  _starryActive=false;
  var sl=document.getElementById('starryLayer');
  var fl=document.getElementById('firefliesLayer');
  // Remove dynamically-spawned elements; CSS ::before moon stays hidden via display:none
  if(sl)sl.querySelectorAll('.star').forEach(function(e){e.remove();});
  if(fl)fl.innerHTML='';
  if(_fireflyInterval){clearInterval(_fireflyInterval);_fireflyInterval=null;}
}

function _starryRand(min,max){return min+Math.random()*(max-min);}

function _spawnStars(){
  var layer=document.getElementById('starryLayer');
  if(!layer)return;
  // Remove any old stars
  layer.querySelectorAll('.star').forEach(function(e){e.remove();});
  // Spawn ~200 stars concentrated in the upper 60% of the screen.
  // Higher opacity floors (dim 0.45, bright 0.8+) keep them consistently visible.
  for(var i=0;i<200;i++){
    var s=document.createElement('div');
    s.className='star';
    var sz=_starryRand(0.8,2.8);
    var top=_starryRand(0,60);
    var left=_starryRand(1,99);
    var dim=_starryRand(0.45,0.70);      // never goes very dim -- always visible
    var bright=_starryRand(0.82,1.0);    // peaks near full white
    var dur=_starryRand(2.5,7);
    var delay=_starryRand(0,6);
    s.style.cssText=[
      'width:'+sz+'px',
      'height:'+sz+'px',
      'top:'+top+'vh',
      'left:'+left+'vw',
      '--dim:'+dim,
      '--bright:'+bright,
      '--dur:'+dur+'s',
      'animation-delay:'+delay+'s',
      'opacity:'+dim
    ].join(';');
    layer.appendChild(s);
  }
}

function _spawnFireflies(){
  var layer=document.getElementById('firefliesLayer');
  if(!layer)return;
  layer.innerHTML='';
  // 14 fireflies spread across the bottom zone
  for(var i=0;i<14;i++){
    _spawnOneFirefly(layer);
  }
  // Occasionally add/remove a firefly to keep it feeling alive
  _fireflyInterval=setInterval(function(){
    if(!_starryActive)return;
    var layer2=document.getElementById('firefliesLayer');
    if(!layer2)return;
    var old=layer2.querySelectorAll('.firefly');
    // Replace a random one
    var idx=Math.floor(Math.random()*old.length);
    if(old[idx])old[idx].remove();
    _spawnOneFirefly(layer2);
  },3200);
}

function _spawnOneFirefly(layer){
  var f=document.createElement('div');
  f.className='firefly';
  var sz=_starryRand(3,7);             // 3–7px -- noticeably larger than stars
  var top=_starryRand(10,85);          // anywhere in the bottom overlay
  var left=_starryRand(3,96);
  var pdur=_starryRand(2.2,5.0);       // pulse duration
  var ddur=_starryRand(7,14);          // drift duration (slow)
  var pDelay=_starryRand(0,4);
  var dDelay=_starryRand(0,6);
  // Small random drift vectors
  function rv(){return (_starryRand(8,22)*(Math.random()>0.5?1:-1)).toFixed(1)+'px';}
  function rvy(){return (-_starryRand(4,20)).toFixed(1)+'px';}
  f.style.cssText=[
    'width:'+sz+'px',
    'height:'+sz+'px',
    'top:'+top+'%',
    'left:'+left+'%',
    '--pdur:'+pdur+'s',
    '--ddur:'+ddur+'s',
    'animation-delay:'+pDelay+'s,'+dDelay+'s',
    '--dx1:'+rv(),'--dy1:'+rvy(),
    '--dx2:'+rv(),'--dy2:'+rvy(),
    '--dx3:'+rv(),'--dy3:'+rvy(),
    '--dx4:'+rv(),'--dy4:'+rvy(),
    'opacity:0'
  ].join(';');
  layer.appendChild(f);
}

// -- Storm theme: rain + lightning --------------------------------
var _stormActive=false;
var _stormRainInterval=null;
var _stormRainStreaks=[];

function _stormStart(){
  if(_stormActive)return;
  _stormActive=true;
  _spawnRain();
}

function _stormStop(){
  _stormActive=false;
  if(_stormRainInterval){clearInterval(_stormRainInterval);_stormRainInterval=null;}
  var layer=document.getElementById('stormLayer');
  if(layer)layer.querySelectorAll('.rain-streak').forEach(function(e){e.remove();});
}

function _spawnRain(){
  var layer=document.getElementById('stormLayer');
  if(!layer)return;
  // 140 streaks staggered across the first cycle, then loop indefinitely.
  // No self-destruct timeout -- the animation is infinite so streaks just keep falling.
  for(var i=0;i<140;i++){
    _spawnOneRainStreak(layer);
  }
}

function _spawnOneRainStreak(layer){
  var r=document.createElement('div');
  r.className='rain-streak';
  var left=_starryRand(0,100);
  var dur=_starryRand(0.50,0.90);
  var del=_starryRand(0,dur);    // stagger so they don't all start together
  var len=_starryRand(12,36);
  var ang=_starryRand(10,20);
  r.style.cssText=[
    'left:'+left+'%',
    'height:'+len+'px',
    '--rdur:'+dur+'s',
    '--rdel:'+del+'s',
    '--rang:'+ang+'deg'
  ].join(';');
  layer.appendChild(r);
}
function _emsStartEmbers(){
  _emsStopEmbers();
  if(!container)return;
  _emsEmberInterval=setInterval(function(){
    if(document.body.getAttribute('data-theme')!=='fire'){_emsStopEmbers();return;}
    var e=document.createElement('div');
    e.className='ember';
    e.style.left=(Math.random()*96+2)+'%';
    e.style.bottom='0';
    e.style.setProperty('--dx',((Math.random()-0.5)*60)+'px');
    var sz=Math.random()*4+2;
    e.style.width=sz+'px';e.style.height=sz+'px';
    var dur=1.2+Math.random()*1.6;
    e.style.animationDuration=dur+'s';
    e.style.animationDelay=(Math.random()*0.5)+'s';
    container.appendChild(e);
    setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e);},(dur+0.6)*1000);
  },280);
}
function _emsStopEmbers(){
  if(_emsEmberInterval){clearInterval(_emsEmberInterval);_emsEmberInterval=null;}
  var container=document.getElementById('emsFire');
  if(container)container.innerHTML='';
}

function renderThemeSelector(){
  var el=document.getElementById('themeSelector');
  if(!el)return;
  var currentTheme=(state.settings&&state.settings.theme)||'dark';
  var cfg=getTierConfig();
  el.innerHTML=THEMES.filter(function(t){return RETIRED_THEME_KEYS.indexOf(t.key)<0;}).map(function(t){
    var allowed=BETA_ALL_THEMES||cfg.allowedThemeTiers.indexOf(t.tier)>=0;
    var active=t.key===currentTheme?' active':'';
    // R4 (F13): the badge rendered "Pro"/"Premium" even on themes BETA_ALL_THEMES
    // had already made clickable -- paid-tier signaling on a feature the user
    // can actually use for free reads as a paywall regardless of whether it's
    // technically locked.
    var tierLabel=(BETA_ALL_THEMES&&t.tier!=='free')?'Beta':(t.tier.charAt(0).toUpperCase()+t.tier.slice(1));
    var tierClass='theme-tier-'+t.tier;
    if(!allowed){
      return '<button class="theme-btn theme-btn-locked" onclick="_tierUpgradeToast()" title="Upgrade to '+tierLabel+' to unlock">'+
        '<div class="theme-swatch" style="position:relative;">'+
          '<div class="theme-swatch-bg" style="background:'+t.bg+';opacity:0.4;"></div>'+
          '<div class="theme-swatch-accent" style="background:'+t.accent+';opacity:0.4;"></div>'+
          '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;">🔒</span>'+
        '</div>'+
        '<div class="theme-btn-name" style="opacity:0.4;">'+t.name+'</div>'+
        '<span class="theme-tier-badge '+tierClass+'">'+tierLabel+'</span>'+
      '</button>';
    }
    return '<button class="theme-btn'+active+'" onclick="applyTheme(\''+t.key+'\')">'+
      '<div class="theme-swatch">'+
        '<div class="theme-swatch-bg" style="background:'+t.bg+';"></div>'+
        '<div class="theme-swatch-accent" style="background:'+t.accent+';"></div>'+
      '</div>'+
      '<div class="theme-btn-name">'+t.name+'</div>'+
      '<span class="theme-tier-badge '+tierClass+'">'+tierLabel+'</span>'+
    '</button>';
  }).join('');
}

function _applySavedTheme(){
  var saved=(state.settings&&state.settings.theme)||'dark';
  if(saved!=='dark'){
    document.body.setAttribute('data-theme',saved);
  }
  var theme=THEMES.find(function(t){return t.key===saved;});
  if(theme){
    var metas=document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach(function(m){m.setAttribute('content',theme.bg);});
  }
  _emsUpdateOverlays(saved);
}


async function initApp(){
await load();
// R5: checkins/moodLog load from their own docs (eagerly -- unlike journal,
// which is lazy-loaded on open -- since HALT+/State-&-Regulation/mood chart
// can render at any time). Must run after load() so pre-migration data
// already merged into state.checkins/state.moodLog is available to adopt.
await Promise.all([_loadCheckinsDoc(),_loadMoodLogDoc(),_loadCompletedTasksDoc(),_loadRemindersArchiveDoc()]);
initPanelVisibility();applyPanelOrder();applyPanelVisibility();applyPointsVisibility();updateLockUI();updateClock();updateTimeLeft();setInterval(updateClock,1000);setInterval(updateTimeLeft,30000);updateTimerDisplay();renderPointsBadge();awardDailyLogin();
_bindPanelUsageTracking();
// -- DAILY ROUTINE RESET -- robust against tabs left open overnight --
// 1. Run once immediately after load so stale checks clear before the user sees them.
// 2. Poll every 60s for the date change.
// 3. Also re-check whenever the tab becomes visible again (handles iOS/PWA where
//    a backgrounded app may not fire intervals for hours but will fire visibilitychange).
// Rolls the home-screen widget over at midnight WITHOUT needing the app to be
// reopened, for the case where the phone is sitting there with Centerpost
// still in the foreground. _updateWidgetSnapshot no-ops unless the JSON
// actually changed, so running it on this existing 60s tick is nearly free --
// and when the date flips, the snapshot's `date`/`days` change, so it pushes.
// (The extension ALSO rolls itself over via its midnight timeline entry --
// see TodayWidget.swift. This handles app-open, that handles app-closed.)
function _dayRolloverTick(){
  try { checkDailyRoutineReset(); } catch(e){}
  try { if(typeof _sweepPastReminders==='function')_sweepPastReminders(); } catch(e){}
  try { if(typeof _updateWidgetSnapshot==='function')_updateWidgetSnapshot(); } catch(e){}
}
_dayRolloverTick();
setInterval(_dayRolloverTick,60000);
// Notifications (R1 phase 1): dedupe store + periodic scan while the app is open.
if(typeof _notifLoadFired==='function'){
  _notifLoadFired();_ensureNotifPrefs();
  if(_notifNative()){
    // iOS shell: no poll loop -- sync scheduled notifications + refresh permission state.
    setTimeout(function(){_notifNative().postMessage({action:'checkPermission'});_notifSyncNative();},2500);
  }else{
    setInterval(_notifTick,45000);setTimeout(_notifTick,4000);
  }
}
document.addEventListener('visibilitychange',function(){
  if(!document.hidden){
    _dayRolloverTick();
  }
});
window.addEventListener('focus',function(){ _dayRolloverTick(); });

// -- Reminder auto-schedule + popup (deferred so Firestore data is loaded) --
setTimeout(function(){
  try { autoScheduleTodayReminders(); } catch(e){console.warn('[reminders] auto-schedule failed',e);}
  try { checkAndShowReminderPopup(); } catch(e){console.warn('[reminders] popup failed',e);}
},1500);

// =======================================
// PULL-TO-REFRESH (mobile)
// =======================================
(function(){
  var THRESHOLD=70;        // px to drag before refresh fires
  var MAX_PULL=120;        // max visual drag distance
  var DAMPING=0.5;         // resistance after threshold
  var startY=0,currentY=0,pulling=false,refreshing=false;
  var ind=null;
  
  function getIndicator(){
    if(!ind)ind=document.getElementById('ptrIndicator');
    return ind;
  }
  
  function updateIndicator(distance){
    var el=getIndicator();
    if(!el)return;
    if(distance<=0){
      el.style.transform='translate(-50%,-100%)';
      el.classList.remove('visible','threshold-met');
      return;
    }
    var capped=Math.min(distance,MAX_PULL);
    // Translate down: at 0 it's offscreen (-100%), at THRESHOLD it should be at ~12px below top
    var offsetPx=Math.min(capped*0.6,80);
    el.style.transform='translate(-50%,calc(-100% + '+offsetPx+'px))';
    el.classList.add('visible');
    if(distance>=THRESHOLD){
      el.classList.add('threshold-met');
    }else{
      el.classList.remove('threshold-met');
    }
  }
  
  function reset(){
    var el=getIndicator();
    if(el){
      el.style.transition='transform 0.25s ease,opacity 0.2s';
      el.style.transform='translate(-50%,-100%)';
      el.classList.remove('visible','threshold-met','refreshing');
      setTimeout(function(){if(el)el.style.transition='';},300);
    }
    pulling=false;
    startY=0;currentY=0;
  }
  
  async function triggerRefresh(){
    if(refreshing)return;
    refreshing=true;
    var el=getIndicator();
    if(el){
      el.classList.add('refreshing','visible');
      el.classList.remove('threshold-met');
      el.style.transform='translate(-50%,calc(-100% + 80px))';
    }
    try{
      if(typeof load==='function')await load();
      if(typeof _loadCheckinsDoc==='function')await _loadCheckinsDoc();
      if(typeof _loadMoodLogDoc==='function')await _loadMoodLogDoc();
      if(typeof _loadCompletedTasksDoc==='function')await _loadCompletedTasksDoc();
      if(typeof renderProjects==='function')renderProjects();
      if(typeof renderReminders==='function')renderReminders();
      if(typeof renderNotes==='function')renderNotes();
      if(typeof renderTaskList==='function')renderTaskList();
      if(typeof renderTimeline==='function')renderTimeline();
      if(typeof renderRoutines==='function')renderRoutines();
      if(typeof updateAllTileSummaries==='function')updateAllTileSummaries();
      if(typeof buildMobileHome==='function')buildMobileHome();
      if(typeof toast==='function')toast('Refreshed');
    }catch(e){
      console.warn('[PTR] refresh error:',e);
    }
    // Hold the spinner briefly so user sees the refresh happened
    setTimeout(function(){
      refreshing=false;
      reset();
    },600);
  }
  
  // Only attach on touch devices
  if(!('ontouchstart' in window))return;
  
  var container=null;
  function ensureContainer(){
    // In the new vertical layout, panels scroll inside app-wrap or the window
    if(!container)container=document.querySelector('.app-wrap')||document.documentElement;
    return container;
  }
  
  document.addEventListener('touchstart',function(e){
    if(refreshing)return;
    if(!_isMobile())return; // Only on mobile
    var c=ensureContainer();
    if(!c)return;
    // Only fire if scroll is at top (check both element and window scroll)
    var scrollTop=c.scrollTop||window.pageYOffset||0;
    if(scrollTop>0)return;
    startY=e.touches[0].clientY;
    currentY=startY;
    pulling=true;
  },{passive:true});
  
  document.addEventListener('touchmove',function(e){
    if(!pulling||refreshing)return;
    currentY=e.touches[0].clientY;
    var delta=currentY-startY;
    // If user scrolls UP (delta<0) or we lose top contact, cancel
    if(delta<=0){
      updateIndicator(0);
      return;
    }
    var c=ensureContainer();
    if(c){
      var scrollTop=c.scrollTop||window.pageYOffset||0;
      if(scrollTop>0){
        pulling=false;
        updateIndicator(0);
        return;
      }
    }
    // Apply damping past threshold
    var dist=delta;
    if(dist>THRESHOLD)dist=THRESHOLD+(dist-THRESHOLD)*DAMPING;
    updateIndicator(dist);
  },{passive:true});
  
  document.addEventListener('touchend',function(){
    if(!pulling||refreshing)return;
    var delta=currentY-startY;
    if(delta>=THRESHOLD){
      triggerRefresh();
    }else{
      reset();
    }
  },{passive:true});
  
  document.addEventListener('touchcancel',function(){
    if(!pulling||refreshing)return;
    reset();
  },{passive:true});
})();




document.addEventListener('visibilitychange',function(){if(!document.hidden){awardDailyLogin();renderTimeline();}});

// Open the routines panel on the time-appropriate tab (Morning before noon,
// Evening after) -- UNLESS the user manually switched tabs earlier today, in
// which case honor that choice (it persists across reloads). Set once here,
// after load() has hydrated state and before startRealtimeSync(); a new day
// falls back to the time default so one evening switch doesn't pin every
// morning to Evening. switchRoutineTab() owns the choice for the session
// (preserved across sync echoes by the guard in startRealtimeSync).
if(state.routineTabDate!==todayStr())state.currentRoutineTab=_defaultRoutineTab();
renderProjects();renderReminders();renderThoughts();renderNotes();renderRoutines();renderTaskList();renderTimeline();checkDailyRoutineReset();newDecisionPrompt();initDragDrop();updateAllTileSummaries();_applySavedTheme();renderThemeSelector();applyTierGating();updateFocusBanner();updateFocusModeUI();
// R2b: desktop keeps its header-visibility line; setViewMode owns the initial
// paint of Today-vs-Everything (and, on mobile, home-vs-launcher) from the
// persisted state.viewMode -- replacing the old unconditional showMobileHome().
if(!_isMobile()){document.querySelector('.header')&&document.querySelector('.header').classList.add('mobile-visible');}
setViewMode(state.viewMode);
if(state.energy){const c=document.querySelectorAll('#energyPills .em-pill');const m=['high','good','low','crashed'];const i=m.indexOf(state.energy);if(i>=0)c[i].classList.add('selected');}
if(state.mood){const c=document.querySelectorAll('#moodPills .em-pill');const m=['focused','scattered','anxious','calm'];const i=m.indexOf(state.mood);if(i>=0)c[i].classList.add('selected');}
showStateAdvice();updateWellnessVisibility();
startRealtimeSync();
if(typeof pushWatchSnapshot==='function')pushWatchSnapshot(); // seed the watch on load
if(window.location.hash==='#/admin')showAdminPanel();
// --- Service Worker registration + update-available toast ---
// When the SW updates (e.g. you ship a new sw.js or bump CACHE_VERSION),
// `controllerchange` fires once the new SW takes control. The new version
// is already active in the background at that point; instead of reloading
// the page out from under the user, show a tap-to-refresh toast and let
// them choose the moment.
function showUpdateToast(){
  var el=document.getElementById('updateToast');
  if(!el){
    el=document.createElement('div');
    el.id='updateToast';
    el.className='toast update-toast';
    el.textContent='Update available — tap to refresh';
    el.onclick=function(){window.location.reload();};
    document.body.appendChild(el);
  }
  requestAnimationFrame(function(){el.classList.add('show');});
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js', {updateViaCache:'none'})
    .then(function(reg){
      // Force a check for updates on every page load (cheap, no-op if nothing changed)
      try { reg.update(); } catch(e) {}
      // When a new SW is found, push it to activate ASAP -- iOS PWAs otherwise
      // cling to the old worker (and old HTML) across warm resumes.
      reg.addEventListener('updatefound', function(){
        var nw=reg.installing;
        if(!nw)return;
        nw.addEventListener('statechange', function(){
          if(nw.state==='installed' && navigator.serviceWorker.controller){
            try{ nw.postMessage({type:'SKIP_WAITING'}); }catch(e){}
          }
        });
      });
    })
    .catch(function(e){console.log('SW:',e);});
  // iOS PWAs resume from the background without re-checking for updates on
  // their own, so force an update check every time the app becomes visible.
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState!=='visible')return;
    navigator.serviceWorker.getRegistration().then(function(reg){
      if(reg){ try{ reg.update(); }catch(e){} }
    });
  });
  // On a first-ever install `controllerchange` also fires (clients.claim),
  // but the page is already the newest version — no toast for that case.
  var _hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(!_hadSW){ _hadSW=true; return; }
    showUpdateToast();
  });
}
// --- iOS: zoom back out when leaving a text field (no rotation needed) ---
// On iOS, focusing a field with font-size < 16px auto-zooms in and never
// resets on blur. Keep that helpful zoom-in, but when focus leaves a field
// (and no other field is focused) briefly clamp the viewport to scale 1.0 --
// which snaps the page back out -- then restore the zoomable viewport so
// pinch-zoom and the next field's zoom-in still work.
(function(){
  if(!('ontouchstart' in window))return;
  var vp=document.querySelector('meta[name="viewport"]');
  if(!vp)return;
  var zoomable=vp.getAttribute('content');
  var clamped=zoomable+', maximum-scale=1.0';
  function isField(el){return el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);}
  document.addEventListener('focusin',function(e){
    if(isField(e.target))vp.setAttribute('content',zoomable);
  });
  document.addEventListener('focusout',function(e){
    if(!isField(e.target))return;
    setTimeout(function(){
      if(isField(document.activeElement))return; // moved to another field -- keep zoom
      vp.setAttribute('content',clamped);        // snap back out to scale 1.0
      setTimeout(function(){vp.setAttribute('content',zoomable);},350); // re-allow zoom
    },0);
  });
})();
// Handle Web Share Target inbound data
setTimeout(checkShareTarget, 400); // slight delay so panels render first
// R11: brand-new accounts only (see load()'s first-time branch). Small delay
// lets the dashboard's initial paint settle before the full-screen blur hits.
if(state.onboardingSeen===false && typeof openOnboardingTour==='function'){
  setTimeout(openOnboardingTour,600);
}
if(typeof _maybeShowFabHint==='function')setTimeout(_maybeShowFabHint,600);
}
// Auth is handled by Firebase onAuthStateChanged listener in Script 1

// ── SCRIPT 4: JARVIS + CALENDAR ─────────────────────────────────
// =======================================
// JARVIS -- AI ASSISTANT
// =======================================

// -- Proxy config -----------------------------------------------------
// JARVIS_PROXY_URL is defined in config.js
async function _jarvisAuthHeaders(){
  var h={'Content-Type':'application/json'};
  try{
    var user=firebase.auth().currentUser;
    if(user){h['Authorization']='Bearer '+(await user.getIdToken());}
  }catch(e){console.warn('[Jarvis] getIdToken failed:',e);}
  return h;
}
var _jarvisOpen=false;
var _jarvisHistory=[]; // {role:'user'|'assistant', content:'...'}
var _jarvisThinking=false;
var _jarvisSpeech=null;
var _jarvisListening=false;
var _jarvisMode='chat'; // 'chat' | 'breakdown:projects' | 'breakdown:tasks'

// -- AXIS PROFILE ("About You") --------------------------------------
// Optional per-user context that personalizes Axis's system prompt. Lives in
// its own small doc (users/{uid}/data/profile) rather than the giant
// dashboard blob -- it's independent, low-frequency-write data, same
// rationale as the journal split. Nothing here is required: an empty profile
// falls back to a neutral persona (see _axisPersonaLine below), so a fresh
// beta user never gets told they're "Joe" or anyone else.
var _axisProfile={name:'',roleContext:'',personalityType:'',neurotype:'',learningStyle:'',leadershipStyle:'',otherContext:''};
function _axisProfileStorageKey(){return 'cpAxisProfile_'+(currentUser?currentUser.uid:'local');}
function _axisProfileHasContent(p){
  return !!(p.name||p.roleContext||p.personalityType||p.neurotype||p.learningStyle||p.leadershipStyle||p.otherContext);
}
async function _loadAxisProfile(){
  var loaded=null;
  try{var s=localStorage.getItem(_axisProfileStorageKey());if(s)loaded=JSON.parse(s);}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      var snap=await db.collection('users').doc(currentUser.uid).collection('data').doc('profile').get();
      if(snap.exists)loaded=snap.data();
    }catch(e){console.log('axis profile load error:',e);}
  }
  if(loaded){_axisProfile=Object.assign({},_axisProfile,loaded);delete _axisProfile.updated;}
}
async function _saveAxisProfile(){
  try{localStorage.setItem(_axisProfileStorageKey(),JSON.stringify(_axisProfile));}catch(e){}
  if(firebaseReady&&db&&currentUser){
    try{
      var doc=Object.assign({},_axisProfile,{updated:firebase.firestore.FieldValue.serverTimestamp()});
      await db.collection('users').doc(currentUser.uid).collection('data').doc('profile').set(doc);
    }catch(e){console.log('axis profile save error:',e);if(typeof toast==='function')toast('Profile saved locally (cloud sync failed)');}
  }
}
function saveAxisProfileFromForm(){
  ['name','roleContext','personalityType','neurotype','learningStyle','leadershipStyle','otherContext'].forEach(function(k){
    var el=document.getElementById('axisProfile_'+k);
    if(el)_axisProfile[k]=el.value.trim();
  });
  _saveAxisProfile();
  toast('✓ About You saved');
}
function resetAxisProfile(){
  _confirm('Clear your About You profile? Axis will go back to a generic persona until you fill it in again.',function(){
    _axisProfile={name:'',roleContext:'',personalityType:'',neurotype:'',learningStyle:'',leadershipStyle:'',otherContext:''};
    _saveAxisProfile();
    _renderAxisProfileForm();
    toast('About You cleared');
  },{destructive:true,confirmText:'Clear'});
}
function _renderAxisProfileForm(){
  ['name','roleContext','personalityType','neurotype','learningStyle','leadershipStyle','otherContext'].forEach(function(k){
    var el=document.getElementById('axisProfile_'+k);
    if(el)el.value=_axisProfile[k]||'';
  });
}
// Builds the persona description Axis's system prompt is built around.
// Empty profile -> neutral, correct-for-anyone default. Filled profile ->
// the specific context the user chose to share, nothing assumed.
function _axisPersonaLine(){
  var p=_axisProfile||{};
  if(!_axisProfileHasContent(p)){
    return 'a personal ADHD-aware productivity dashboard.';
  }
  function clean(s){return (s||'').trim().replace(/\.+$/,'');}
  var parts=[];
  if(p.roleContext)parts.push(clean(p.roleContext)+'.');
  if(p.personalityType)parts.push('Personality type: '+clean(p.personalityType)+'.');
  if(p.neurotype)parts.push('Neurotype: '+clean(p.neurotype)+'.');
  if(p.learningStyle)parts.push('Learning style: '+clean(p.learningStyle)+'.');
  if(p.leadershipStyle)parts.push('Leadership style: '+clean(p.leadershipStyle)+'.');
  if(p.otherContext)parts.push(clean(p.otherContext)+'.');
  var namePart=p.name?' built and used by '+clean(p.name)+'.':'.';
  return 'a personal ADHD-aware productivity dashboard'+namePart+(parts.length?' '+parts.join(' '):'');
}

var JARVIS_SYSTEM=function(){
  var today=new Date();
  var dateStr=today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  var timeStr=today.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  var todayKey=today.toISOString().slice(0,10);

  // -- Build COMPLETE structured context ---------------------------
  // Projects with all subtasks (full detail)
  var projects=(state.projects||[]).map(function(p){
    return {
      id:p.id,
      name:p.name,
      due:p.due||null,
      subtaskCount:(p.subtasks||[]).length,
      subtasks:(p.subtasks||[]).map(function(st){
        return {
          name:st.name,
          due:st.due||null,
          priority:st.priority||'med',
          timeEst:st.timeEst||null,
          done:!!st.done
        };
      })
    };
  });

  // All standalone tasks
  var tasks=(state.tasks||[]).filter(function(t){return !t.done;}).map(function(t){
    var projName='';
    if(t.projectId){
      var p=(state.projects||[]).find(function(p){return p.id===t.projectId;});
      if(p)projName=p.name;
    }
    if(!projName&&t.projectIds&&t.projectIds.length){
      var names=t.projectIds.map(function(pid){
        var p=(state.projects||[]).find(function(p){return p.id===pid;});
        return p?p.name:null;
      }).filter(Boolean);
      projName=names.join(', ');
    }
    return {
      name:t.name,
      due:t.due||null,
      priority:t.priority||'med',
      timeEst:t.timeEst||null,
      project:projName||null
    };
  });

  // All notes (truncate body to keep size sane)
  var notes=(state.notes||[]).map(function(n){
    var body=(n.body||'').slice(0,300);
    if((n.body||'').length>300)body+='...';
    var projNames=[];
    if(n.projectIds&&n.projectIds.length){
      projNames=n.projectIds.map(function(pid){
        var p=(state.projects||[]).find(function(p){return p.id===pid;});
        return p?p.name:null;
      }).filter(Boolean);
    }
    return {label:n.label||'',body:body,projects:projNames};
  });

  // All upcoming reminders (future or undated)
  var reminders=(state.reminders||[]).filter(function(r){
    return !r.date||r.date>=todayKey;
  }).map(function(r){
    var projNames=[];
    if(r.projectIds&&r.projectIds.length){
      projNames=r.projectIds.map(function(pid){
        var p=(state.projects||[]).find(function(p){return p.id===pid;});
        return p?p.name:null;
      }).filter(Boolean);
    }
    return {text:r.text,date:r.date||null,time:r.time||null,projects:projNames};
  });

  // Recent completed tasks (last 20)
  var completed=(state.completedTasks||[]).slice(0,20).map(function(ct){
    return {name:ct.name,project:ct.projectName||null,archivedAt:ct.archivedAt||null};
  });

  // Completed/archived projects
  var archivedProjects=(state.completedProjects||[]).map(function(cp){
    return {name:cp.name,completedTaskCount:cp.completedTaskCount||0,archivedAt:cp.archivedAt||null};
  });

  // Wellness notes (your reflections on the 8 SAMHSA dimensions)
  var wellness=[];
  var wn=state.wellnessNotes||{};
  Object.keys(wn).forEach(function(k){
    if(wn[k]&&wn[k].note){
      wellness.push({dimension:k,note:wn[k].note,updatedAt:wn[k].updatedAt||null});
    }
  });

  // Routines status today
  var routines={};
  ['morning','evening','custom'].forEach(function(tab){
    if(state.routines&&state.routines[tab]){
      routines[tab]=state.routines[tab].map(function(r){return {name:r.name,done:!!r.done};});
    }
  });

  // Energy/Mood
  var energyMood={};
  if(state.energyEntries&&state.energyEntries.length){
    var latestE=state.energyEntries[state.energyEntries.length-1];
    energyMood.energy={level:latestE.level,note:latestE.note||'',time:latestE.time||null};
  }
  if(state.moodEntries&&state.moodEntries.length){
    var latestM=state.moodEntries[state.moodEntries.length-1];
    energyMood.mood={value:latestM.value,note:latestM.note||'',time:latestM.time||null};
  }

  // Points/tier status
  var pointsInfo={
    current:(state.points&&state.points.current)||0,
    lifetimeTotal:(state.points&&state.points.lifetimeTotal)||0,
    tier:_jarvisCurrentTier()
  };

  // Timeline blocks -- manually scheduled items (name, date, time, duration, project)
  // Include blocks from the past 24h through the next 14 days so Axis can read today's schedule
  var tlCutoffPast=new Date();tlCutoffPast.setDate(tlCutoffPast.getDate()-1);
  var tlCutoffPastStr=tlCutoffPast.toISOString().slice(0,10);
  var tlCutoffFuture=new Date();tlCutoffFuture.setDate(tlCutoffFuture.getDate()+14);
  var tlCutoffFutureStr=tlCutoffFuture.toISOString().slice(0,10);
  var timelineBlocks=(state.tlBlocks||[])
    .filter(function(b){return b.date&&b.date>=tlCutoffPastStr&&b.date<=tlCutoffFutureStr;})
    .sort(function(a,b){return (a.date+' '+(a.time||'')).localeCompare(b.date+' '+(b.time||''));})
    .map(function(b){
      var projName='';
      var pid=b.projectId||(b.projectIds&&b.projectIds[0]);
      if(pid){var pr=(state.projects||[]).find(function(p){return p.id===pid;});if(pr)projName=pr.name;}
      return {
        name:b.name,
        date:b.date,
        time:b.time||null,
        durationMinutes:b.duration||60,
        project:projName||null,
        priority:b.priority||'med',
        type:b.linkedType||'manual'
      };
    });

  var context={
    today:dateStr,
    time:timeStr,
    todayDate:todayKey,
    projects:projects,
    standaloneTasks:tasks,
    notes:notes,
    upcomingReminders:reminders,
    recentlyCompletedTasks:completed,
    archivedProjects:archivedProjects,
    wellnessReflections:wellness,
    todaysRoutines:routines,
    energyMood:energyMood,
    timelineBlocks:timelineBlocks,
    points:pointsInfo
  };

  // -- BREAKDOWN MODE: focused system prompt for AI task-breakdown --
  if(_jarvisMode==='breakdown:projects'||_jarvisMode==='breakdown:tasks'){
    var ordered=_jarvisBuildBreakdownContext(_jarvisMode==='breakdown:projects'?'projects':'tasks');
    var scopeLabel=_jarvisMode==='breakdown:projects'?'project':'task';
    return 'You are Axis in BREAKDOWN MODE inside Centerpost -- '+_axisPersonaLine()+' It is now '+dateStr+', '+timeStr+'.\n\n'
      +'Your single job: break a chosen '+scopeLabel+' into actionable micro-steps for an ADHD brain.\n\n'
      +'The user\'s items are listed below in suggested completion order: not-done before done; within not-done: overdue → today → tomorrow → later → undated; tiebreak by shorter time-estimate first to reduce initiation friction.\n\n'
      +'=== ITEMS IN COMPLETION ORDER ===\n'+ordered+'\n=== END ITEMS ===\n\n'
      +'CRITICAL OUTPUT FORMAT: respond with ONLY a raw JSON object -- no markdown fences. Format: {"reply":"...","actions":[]}. In breakdown mode you NEVER use actions -- leave the array empty and put the breakdown inside reply.\n\n'
      +'When the user names or numbers an item, do this:\n'
      +'1. Acknowledge which one in ONE short line.\n'
      +'2. Produce 3–8 micro-steps in the order they should be done. Each step must be small enough to start in under 2 minutes.\n'
      +'3. Mark the very first step with "🚀 START HERE".\n'
      +'4. If any step would take more than 30 minutes, split it further.\n'
      +'5. End with one line beginning "First physical action:" -- what the user\'s hands should literally do right now (open a tab, pick up a phone, walk to a room, etc.).\n\n'
      +'Style: no preambles, no "great choice," no over-explaining. The user dislikes filler. Use \\n inside the reply string for line breaks. Number the steps 1. 2. 3. For subtasks of a step, indent with two spaces.\n\n'
      +'If the user types something that does not match any listed item, ask once for clarification and re-show the top 5 items by completion order.';
  }

  return 'You are Axis, an AI assistant embedded in Centerpost -- '+_axisPersonaLine()+'\n\nIt is now '+dateStr+', '+timeStr+'.\n\nYou have FULL access to the dashboard state below. Reference it precisely to answer questions about due dates, subtasks, projects, completed work, wellness reflections, routines, energy/mood, or anything else.\n\n=== DATA FIELD GUIDE ===\n- timelineBlocks = items manually scheduled on the TIMELINE PANEL (name, date, time, duration). Use THIS field for any question about the timeline, schedule, or blocked time. Do NOT substitute task due dates for timeline questions.\n- standaloneTasks / projects = task list and project subtasks. Use for task management questions.\n- upcomingReminders = reminders panel items.\n\n=== DASHBOARD STATE ===\n'+JSON.stringify(context,null,2)+'\n=== END STATE ===\n\nCRITICAL OUTPUT FORMAT: Respond with ONLY a raw JSON object. No markdown, no code fences, no explanation before or after. Format: {"reply":"...","actions":[]}\n\n=== RESPONSE STYLE RULES (STRICT -- ADHD-OPTIMIZED) ===\n\n1. **Count questions get count-first replies.** When asked "how many" or for any count: give the NUMBER first, then a single short urgency flag if applicable, then offer to expand. Maximum 2 short sentences.\n   - Example query: "How many tasks do I have?"\n   - GOOD reply: "You have 14 open tasks. 2 are overdue. Want me to list them?"\n   - GOOD reply: "8 active projects. All on track. Want me to list them by due date?"\n   - BAD reply: "You currently have 14 open tasks across 5 projects. The high priority ones are [lists everything]..." -- TOO MUCH UPFRONT.\n\n2. **List questions still default to a summary.** Even for "show me" or "what are", lead with a count + urgency summary, then offer to expand UNLESS the user explicitly said "list them all" or "show me each."\n   - "What\\\'s due this week?" → "6 items due this week, 2 today. Want the full list or just today\\\'s?"\n\n3. **Always end open-ended summary replies with an expansion offer** ("Want me to list them?", "Want details?", "Want today\\\'s breakdown?"). Phrase it naturally, not robotically.\n\n4. **If urgency flagging would clutter the reply, omit it.** No flag needed when nothing is overdue.\n\n5. **Definitions of urgency flags:**\n   - "Overdue" = due date is BEFORE today\\\'s date '+todayKey+'.\n   - "Due today" = due date === '+todayKey+'.\n\n6. **For action confirmations after add/complete/etc**: One short sentence. "Added \\\'Call dispatch\\\', due tomorrow." No follow-up question needed.\n\n7. **For specific data lookups** (e.g. "when is X due", "what project is X in"): Direct answer, no expansion offer.\n\n8. **Once the user confirms they want details**, THEN provide the full list -- but still use compact formatting: each item on one line with due date in parentheses. Group by project or urgency if list >8 items.\n\n=== ACTION TYPES ===\n{"type":"add_task","name":"string","due":"YYYY-MM-DD or null"}\n{"type":"add_project","name":"string","due":"YYYY-MM-DD or null"}\n{"type":"add_subtask","projectName":"string","name":"string","due":"YYYY-MM-DD or null"}\n{"type":"add_note","label":"string","body":"string"}\n{"type":"add_reminder","text":"string","date":"YYYY-MM-DD or null","time":"HH:MM or null"}\n{"type":"complete_task","name":"string"}\n\nFor pure questions with no state changes, use actions:[]. Parse relative dates using today\\\'s date.\n\n=== TIMELINE READOUT FORMAT ===\nWhen the user asks what is on their timeline (any phrasing: \"what\\\'s on my timeline\", \"what do I have scheduled\", \"read my timeline\", \"what\\\'s tomorrow\", etc.) ALWAYS read out the full list of blocks directly. Do NOT use the count-first-then-offer pattern for timeline questions -- just give the items. Format each entry as \"{time} -- {name}\" only. Do NOT include duration or project unless the user explicitly asks. If there are no blocks, say so directly. Example reply: \"3 blocks tomorrow: 9:00 AM -- Station meeting, 1:30 PM -- Report writing, 3:00 PM -- Training review.\"';
};

function _jarvisCurrentTier(){
  var current=(state.points&&state.points.current)||0;
  if(current>=1500)return 'Mythic';
  if(current>=700)return 'Diamond';
  if(current>=300)return 'Gold';
  if(current>=100)return 'Silver';
  return 'Bronze';
}

// === BREAKDOWN MODE ===
// Order items by suggested completion sequence:
//   1. Not-done first (done items sink to bottom)
//   2. Due bucket: overdue → today → tomorrow → later → undated
//   3. Priority: high → med → low
//   4. Shorter time-estimate first (lowest initiation friction)
function _jarvisOrderByCompletion(items){
  var PRI={high:0,med:1,medium:1,low:2};
  var t=new Date();t.setHours(0,0,0,0);
  function bucket(dateStr){
    if(!dateStr)return 4;
    var d=new Date(dateStr+'T00:00:00');
    if(isNaN(d.getTime()))return 4;
    var diffDays=Math.round((d-t)/86400000);
    if(diffDays<0)return 0;        // overdue
    if(diffDays===0)return 1;      // today
    if(diffDays===1)return 2;      // tomorrow
    return 3;                      // later
  }
  function timeMin(v){
    if(v===null||v===undefined||v==='')return 999;
    var n=parseInt(v,10);
    return isNaN(n)?999:n;
  }
  return items.slice().sort(function(a,b){
    if(!!a.done!==!!b.done)return a.done?1:-1;
    var db=bucket(a.due)-bucket(b.due);
    if(db)return db;
    var pr=(PRI[(a.priority||'med').toLowerCase()]??3)-(PRI[(b.priority||'med').toLowerCase()]??3);
    if(pr)return pr;
    return timeMin(a.timeEst)-timeMin(b.timeEst);
  });
}

function _jarvisFmtDate(d){
  if(!d)return '';
  var dt=new Date(d+'T00:00:00');
  if(isNaN(dt.getTime()))return d;
  var today=new Date();today.setHours(0,0,0,0);
  var diff=Math.round((dt-today)/86400000);
  if(diff<0)return 'OVERDUE '+dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  if(diff===0)return 'today';
  if(diff===1)return 'tomorrow';
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

// Build the markdown-style context the AI sees in breakdown mode
function _jarvisBuildBreakdownContext(scope){
  var out='';
  var mark=function(x){return x.done?'✓':'○';};

  if(scope==='projects'){
    // Project objects need a 'due' alias for the sort helper (they use p.due directly -- already matches)
    var projOrdered=_jarvisOrderByCompletion((state.projects||[]).map(function(p){
      // Project is "done" if all subtasks are done AND it has subtasks
      var allDone=(p.subtasks||[]).length>0&&(p.subtasks||[]).every(function(s){return s.done;});
      // Highest-priority subtask floats project up (use 'high' if any subtask is high)
      var hasHigh=(p.subtasks||[]).some(function(s){return s.priority==='high';});
      var hasMed=(p.subtasks||[]).some(function(s){return s.priority==='med';});
      return {_orig:p,id:p.id,name:p.name,due:p.due,done:allDone,priority:hasHigh?'high':(hasMed?'med':'low'),timeEst:''};
    }));
    out+='Projects (in suggested completion order):\n\n';
    projOrdered.forEach(function(po,i){
      var p=po._orig;
      var dueTxt=p.due?' -- due '+_jarvisFmtDate(p.due):'';
      out+=(i+1)+'. '+mark(po)+' '+p.name+dueTxt+'\n';
      // Subtasks for this project, also ordered
      var subs=_jarvisOrderByCompletion(p.subtasks||[]);
      subs.forEach(function(s){
        var bits=[];
        if(s.timeEst)bits.push(s.timeEst+'m');
        if(s.due)bits.push('due '+_jarvisFmtDate(s.due));
        var meta=bits.length?' ['+bits.join(' · ')+']':'';
        out+='   - '+mark(s)+' '+s.name+meta+'\n';
      });
      // Standalone tasks linked to this project
      var linked=(state.tasks||[]).filter(function(t){
        return t.projectId===p.id||(t.projectIds&&t.projectIds.indexOf(p.id)>=0);
      });
      _jarvisOrderByCompletion(linked).forEach(function(t){
        var bits=[];
        if(t.timeEst)bits.push(t.timeEst+'m');
        if(t.due)bits.push('due '+_jarvisFmtDate(t.due));
        var meta=bits.length?' ['+bits.join(' · ')+']':'';
        out+='   - '+mark(t)+' '+t.name+meta+' (task)\n';
      });
      out+='\n';
    });
  } else if(scope==='tasks'){
    // All tasks: standalone tasks + every project subtask, flattened and ordered
    var all=[];
    (state.tasks||[]).forEach(function(t){
      var pName='';
      if(t.projectId){var p=(state.projects||[]).find(function(p){return p.id===t.projectId;});if(p)pName=p.name;}
      if(!pName&&t.projectIds&&t.projectIds.length){
        pName=t.projectIds.map(function(pid){var p=(state.projects||[]).find(function(p){return p.id===pid;});return p?p.name:null;}).filter(Boolean).join(', ');
      }
      all.push({_kind:'task',_proj:pName,name:t.name,due:t.due,priority:t.priority||'med',timeEst:t.timeEst,done:!!t.done});
    });
    (state.projects||[]).forEach(function(p){
      (p.subtasks||[]).forEach(function(s){
        all.push({_kind:'subtask',_proj:p.name,name:s.name,due:s.due,priority:s.priority||'med',timeEst:s.timeEst,done:!!s.done});
      });
    });
    var ordered=_jarvisOrderByCompletion(all);
    out+='Tasks (in suggested completion order):\n\n';
    ordered.forEach(function(t,i){
      var bits=[];
      if(t.timeEst)bits.push(t.timeEst+'m');
      if(t.due)bits.push('due '+_jarvisFmtDate(t.due));
      var meta=bits.length?' ['+bits.join(' · ')+']':'';
      var projTag=t._proj?' -- '+t._proj:'';
      out+=(i+1)+'. '+mark(t)+' '+t.name+projTag+meta+'\n';
    });
  }
  return out||'(no items found)';
}

// Open the Jarvis panel directly into Breakdown mode
function openJarvisBreakdown(scope){
  // scope: 'projects' | 'tasks'
  _jarvisMode='breakdown:'+scope;
  _trackEvent('tool_use','jarvis_ai','Jarvis AI');
  _jarvisHistory=[]; // start fresh -- don't pollute breakdown with prior chat

  // Update panel chrome
  var panel=document.getElementById('jarvisPanel');
  var titleEl=document.getElementById('jarvisPanelTitle');
  var fab=document.getElementById('jarvisFab');
  if(panel)panel.classList.add('breakdown-mode');
  if(titleEl)titleEl.textContent='Breakdown';

  // Rebuild the messages area with the ordered preview as a seed assistant message
  var preview=_jarvisBuildBreakdownContext(scope);
  var greeting=scope==='projects'
    ? 'Which project should we break down? Type a number or name from the list below.'
    : 'Which task should we break down? Type a number or name from the list below.';
  var container=document.getElementById('jarvisMessages');
  if(container){
    container.innerHTML=''; // wipe greeting + any prior chat
    var seedMsg=document.createElement('div');
    seedMsg.className='jarvis-msg assistant';
    var bubble=document.createElement('div');
    bubble.className='jarvis-msg-bubble';
    bubble.style.whiteSpace='pre-wrap';
    bubble.style.fontFamily='ui-monospace, SFMono-Regular, Menlo, monospace';
    bubble.style.fontSize='12px';
    bubble.style.lineHeight='1.5';
    bubble.textContent=greeting+'\n\n'+preview;
    seedMsg.appendChild(bubble);
    container.appendChild(seedMsg);
    container.scrollTop=0;
    // Seed history so the AI sees what the user sees (they share the same list)
    _jarvisHistory.push({role:'assistant',content:greeting+'\n\n'+preview});
  }

  // Open panel if not already open
  if(!_jarvisOpen){
    _jarvisOpen=true;
    if(panel)panel.classList.add('open');
    if(fab)fab.classList.add('active');
  }

  // Update input placeholder
  var inp=document.getElementById('jarvisInput');
  if(inp){
    inp.placeholder=scope==='projects'?'Type a project number or name...':'Type a task number or name...';
    setTimeout(function(){inp.focus();},280);
  }
}

// Reset Breakdown mode back to chat (called when panel closes)
function _jarvisExitBreakdownMode(){
  if(_jarvisMode==='chat')return;
  _jarvisMode='chat';
  var panel=document.getElementById('jarvisPanel');
  var titleEl=document.getElementById('jarvisPanelTitle');
  if(panel)panel.classList.remove('breakdown-mode');
  if(titleEl)titleEl.textContent='Axis';
  var inp=document.getElementById('jarvisInput');
  if(inp)inp.placeholder='Ask anything or give a command...';
  var container=document.getElementById('jarvisMessages');
  if(container){
    container.innerHTML='<div class="jarvis-greeting">How can I help you today?</div>';
  }
  _jarvisHistory=[];
}

function toggleJarvis(){
  _jarvisOpen=!_jarvisOpen;
  var panel=document.getElementById('jarvisPanel');
  var fab=document.getElementById('jarvisFab');
  var tkBtn=document.querySelector('.toolkit-jarvis');
  panel.classList.toggle('open',_jarvisOpen);
  if(fab)fab.classList.toggle('active',_jarvisOpen);
  if(tkBtn)tkBtn.classList.toggle('active',_jarvisOpen);
  if(!_jarvisOpen){
    // Closing -- reset breakdown mode so next open is clean chat
    _jarvisExitBreakdownMode();
  }
  if(_jarvisOpen){
    setTimeout(function(){
      var inp=document.getElementById('jarvisInput');
      if(inp)inp.focus();
    },280);
  }
}

function _jarvisAddMessage(role,content,actionSummary){
  _jarvisHistory.push({role:role,content:content});
  var container=document.getElementById('jarvisMessages');
  if(!container)return;
  var div=document.createElement('div');
  div.className='jarvis-msg '+role;
  var bubble=document.createElement('div');
  bubble.className='jarvis-msg-bubble';
  bubble.textContent=content;
  div.appendChild(bubble);
  if(actionSummary){
    var act=document.createElement('div');
    act.className='jarvis-msg-action';
    act.textContent='✓ '+actionSummary;
    div.appendChild(act);
  }
  container.appendChild(div);
  container.scrollTop=container.scrollHeight;
}

function _jarvisShowThinking(){
  var container=document.getElementById('jarvisMessages');
  if(!container)return;
  var div=document.createElement('div');
  div.className='jarvis-msg assistant';
  div.id='jarvis-thinking-msg';
  div.innerHTML='<div class="jarvis-thinking-bubble"><div class="jarvis-reactor"><div class="jarvis-reactor-core"></div></div><div class="jarvis-thinking-label">Processing</div></div>';
  container.appendChild(div);
  container.scrollTop=container.scrollHeight;
  var dot=document.getElementById('jarvisStatusDot');
  if(dot)dot.classList.add('thinking');
}

function _jarvisHideThinking(){
  var el=document.getElementById('jarvis-thinking-msg');
  if(el)el.remove();
  var dot=document.getElementById('jarvisStatusDot');
  if(dot)dot.classList.remove('thinking');
}

function _jarvisExecuteActions(actions){
  if(!actions||!actions.length)return '';
  var done=[];
  actions.forEach(function(a){
    try{
      if(a.type==='add_task'){
        var t={id:'t'+Date.now()+Math.random().toString(36).slice(2),name:a.name,priority:_safePriority(a.priority),due:_safeDateStr(a.due),projectId:'',projectIds:[],source:'standalone',done:false};
        if(!state.tasks)state.tasks=[];
        state.tasks.unshift(t);
        done.push('Added task: "'+a.name+'"');
        save();renderTaskList();
      }else if(a.type==='add_project'){
        var p={id:'p'+Date.now()+Math.random().toString(36).slice(2),name:a.name,due:_safeDateStr(a.due),subtasks:[],expanded:false};
        if(!state.projects)state.projects=[];
        state.projects.push(p);
        done.push('Added project: "'+a.name+'"');
        save();renderProjects();
      }else if(a.type==='add_subtask'){
        var proj=(state.projects||[]).find(function(p){return p.name.toLowerCase().includes((a.projectName||'').toLowerCase());});
        if(proj){
          var st={id:'st'+Date.now()+Math.random().toString(36).slice(2),name:a.name,priority:_safePriority(a.priority),due:_safeDateStr(a.due),done:false};
          proj.subtasks.push(st);
          done.push('Added subtask "'+a.name+'" to '+proj.name);
          save();renderProjects();renderTaskList();
        }else{done.push('Project "'+a.projectName+'" not found');}
      }else if(a.type==='add_note'){
        var n={id:'n'+Date.now()+Math.random().toString(36).slice(2),label:a.label||'',body:a.body||'',projectIds:[],createdAt:new Date().toISOString()};
        if(!state.notes)state.notes=[];
        state.notes.unshift(n);
        done.push('Added note: "'+(a.label||a.body.slice(0,30))+'"');
        save();renderNotes();
      }else if(a.type==='add_reminder'){
        var r={id:'r'+Date.now()+Math.random().toString(36).slice(2),text:a.text,date:_safeDateStr(a.date),time:_safeTimeStr(a.time),projectIds:[]};
        if(!state.reminders)state.reminders=[];
        state.reminders.push(r);
        done.push('Added reminder: "'+a.text+'"');
        save();renderReminders();
      }else if(a.type==='complete_task'){
        // Find by name match in tasks or project subtasks
        var found=false;
        (state.tasks||[]).forEach(function(t){
          if(!found&&t.name.toLowerCase().includes((a.name||'').toLowerCase())){
            toggleTaskDone(t.id,'standalone','');
            done.push('Completed: "'+t.name+'"');
            found=true;
          }
        });
        if(!found){
          (state.projects||[]).forEach(function(pr){
            (pr.subtasks||[]).forEach(function(st){
              if(!found&&st.name.toLowerCase().includes((a.name||'').toLowerCase())){
                toggleSubtask(pr.id,st.id);
                done.push('Completed: "'+st.name+'"');
                found=true;
              }
            });
          });
        }
        if(!found)done.push('Task "'+a.name+'" not found');
      }
    }catch(err){console.error('Jarvis action error:',err);}
  });
  updateAllTileSummaries();
  return done.join('; ');
}

async function jarvisSend(){
  var inp=document.getElementById('jarvisInput');
  if(!inp)return;
  var text=inp.value.trim();
  if(!text||_jarvisThinking)return;

  inp.value='';
  inp.style.height='auto';
  _jarvisAddMessage('user',text);
  _jarvisThinking=true;
  _jarvisShowThinking();

  var sendBtn=document.getElementById('jarvisSendBtn');
  if(sendBtn)sendBtn.disabled=true;

  // Build messages for API (keep last 8 exchanges for context)
  var apiMessages=_jarvisHistory.slice(-16).map(function(m){
    return {role:m.role,content:m.content};
  });

  try{
    var endpoint = JARVIS_PROXY_URL || 'https://api.anthropic.com/v1/messages';
    var res=await fetch(endpoint,{
      method:'POST',
      headers:await _jarvisAuthHeaders(),
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:1000,
        system:JARVIS_SYSTEM(),
        messages:apiMessages
      })
    });
    
    // Read raw response text first so we can log and inspect on error
    var rawText=await res.text();
    var data;
    try{data=JSON.parse(rawText);}catch(e){data={parseError:true,raw:rawText};}
    
    console.log('[Jarvis] HTTP',res.status);
    if(DEBUG)console.log('[Jarvis] response payload',data);
    _jarvisHideThinking();

    // -- HTTP-level errors ---------------------------------------
    if(!res.ok){
      // Free-tier daily AI quota reached (Worker returns code:'ai_quota')
      if(res.status===403&&data&&data.code==='ai_quota'){
        _jarvisAddMessage('assistant','You’ve used today’s free Axis requests. Your quota resets tomorrow — or upgrade for unlimited access.');
        if(typeof toast==='function')toast('⚡ Free AI quota reached for today');
        _jarvisThinking=false;
        if(sendBtn)sendBtn.disabled=false;
        return;
      }
      var statusMsg='HTTP '+res.status;
      var detail='';
      if(data&&data.error){
        // Worker error format: {error: "...", detail?: "..."}
        // Anthropic error format: {type:"error", error:{type:"...", message:"..."}}
        if(typeof data.error==='string'){
          detail=data.error+(data.detail?' -- '+data.detail:'');
        }else if(data.error.message){
          detail=(data.error.type?'['+data.error.type+'] ':'')+data.error.message;
        }
      }else if(data&&data.parseError){
        detail='Non-JSON response: '+(data.raw||'').slice(0,200);
      }
      
      // Provide actionable guidance for common cases
      var hint='';
      if(res.status===401||(detail&&detail.toLowerCase().includes('api key'))){
        hint=' → Check that ANTHROPIC_API_KEY secret is set on the Cloudflare Worker (Settings → Variables and Secrets).';
      }else if(res.status===403){
        hint=' → The Worker is rejecting this origin. Make sure your domain is in ALLOWED_ORIGINS in jarvis-worker.js.';
      }else if(res.status===404){
        hint=' → Endpoint not found. Verify JARVIS_PROXY_URL is correct.';
      }else if(res.status===429){
        hint=' → Rate limited. Wait a moment and retry.';
      }else if(res.status===500||res.status===502){
        hint=' → Worker or upstream error. Check Cloudflare Worker logs (Logs tab in dashboard) for details.';
      }
      
      _jarvisAddMessage('assistant',statusMsg+': '+(detail||'unknown error')+hint);
      _jarvisThinking=false;
      if(sendBtn)sendBtn.disabled=false;
      return;
    }

    // -- Anthropic error response inside 200 OK (rare but possible) -
    if(data&&data.type==='error'){
      var aErr=data.error||{};
      _jarvisAddMessage('assistant','API error ['+(aErr.type||'unknown')+']: '+(aErr.message||'unknown'));
      _jarvisThinking=false;
      if(sendBtn)sendBtn.disabled=false;
      return;
    }

    // -- Extract message content --------------------------------
    var raw='';
    if(data&&data.content&&Array.isArray(data.content)&&data.content.length>0){
      // Join all text-type content blocks (model could return multiple)
      raw=data.content.filter(function(b){return b.type==='text'&&b.text;}).map(function(b){return b.text;}).join('').trim();
    }
    if(!raw){
      _jarvisAddMessage('assistant','Empty response from API. Stop reason: '+(data.stop_reason||'unknown')+'. Check console for full payload.');
      _jarvisThinking=false;
      if(sendBtn)sendBtn.disabled=false;
      return;
    }

    // Parse JSON response -- robustly extract the JSON object regardless of surrounding text
    var parsed;
    try{
      // Strategy 1: strip markdown fences, try direct parse
      var clean=raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim();
      parsed=JSON.parse(clean);
    }catch(e1){
      try{
        // Strategy 2: extract first {...} block from anywhere in the response
        var start=raw.indexOf('{');
        var end=raw.lastIndexOf('}');
        if(start!==-1&&end>start){
          parsed=JSON.parse(raw.slice(start,end+1));
        }else{throw new Error('No JSON object found');}
      }catch(e2){
        // Strategy 3: treat entire response as plain text reply, no actions
        parsed={reply:raw,actions:[]};
      }
    }

    var reply=parsed.reply||'Done.';
    var actionSummary=_jarvisExecuteActions(parsed.actions||[]);
    _jarvisAddMessage('assistant',reply,actionSummary);

  }catch(err){
    _jarvisHideThinking();
    var errMsg=err.message||'Unknown error';
    if(errMsg.includes('Failed to fetch')||errMsg.includes('CORS')||errMsg.includes('NetworkError')){
      _jarvisAddMessage('assistant','To use Axis on centerpost.app, set your Cloudflare Worker URL in the JARVIS_PROXY_URL constant near the top of the Axis script block. See the jarvis-worker.js and wrangler.toml files for setup instructions.');
    }else{
      _jarvisAddMessage('assistant','Something went wrong: '+errMsg);
    }
  }

  _jarvisThinking=false;
  if(sendBtn)sendBtn.disabled=false;
  var inp2=document.getElementById('jarvisInput');
  if(inp2)inp2.focus();
  // Restart wake-word listener once the exchange is complete
  if(typeof _wakeWordEnabled!=='undefined'&&_wakeWordEnabled&&!_wakeWordActive){
    setTimeout(_startWakeWord,800);
  }
}

// === VOICE INPUT ===
function jarvisToggleMic(){
  if(_jarvisListening){_jarvisStopMic();return;}
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('Voice input not supported in this browser. Try Chrome.');return;}
  _jarvisSpeech=new SR();
  _jarvisSpeech.continuous=false;
  _jarvisSpeech.interimResults=true;
  _jarvisSpeech.lang='en-US';
  var inp=document.getElementById('jarvisInput');
  _jarvisSpeech.onresult=function(e){
    var transcript='';
    for(var i=0;i<e.results.length;i++){transcript+=e.results[i][0].transcript;}
    if(inp)inp.value=transcript;
  };
  _jarvisSpeech.onend=function(){
    _jarvisListening=false;
    var btn=document.getElementById('jarvisMicBtn');
    if(btn)btn.classList.remove('listening');
    // Auto-send if we got something
    var val=inp?inp.value.trim():'';
    if(val)jarvisSend();
  };
  _jarvisSpeech.onerror=function(e){
    _jarvisListening=false;
    var btn=document.getElementById('jarvisMicBtn');
    if(btn)btn.classList.remove('listening');
    if(e.error!=='aborted')toast('Mic error: '+e.error);
  };
  _jarvisSpeech.start();
  _jarvisListening=true;
  var btn=document.getElementById('jarvisMicBtn');
  if(btn)btn.classList.add('listening');
}

function _jarvisStopMic(){
  if(_jarvisSpeech){try{_jarvisSpeech.stop();}catch(e){}}
  _jarvisListening=false;
  var btn=document.getElementById('jarvisMicBtn');
  if(btn)btn.classList.remove('listening');
}

// =======================================
// =======================================================================
// REMINDER POPUP + AUTO-SCHEDULE ON TIMELINE
// Runs on app init and on visibility return (handles overnight).
// =======================================================================

// -- 1. Auto-schedule today's reminders in the first open timeline slot -
function autoScheduleTodayReminders(){
  var today=todayStr();
  var rems=(state.reminders||[]).filter(function(r){
    return r.date===today && !r._autoScheduled && !r._dismissed;
  });
  if(!rems.length)return;
  if(!state.tlBlocks)state.tlBlocks=[];

  rems.forEach(function(r){
    // Skip if already on timeline (by linkedId)
    var alreadyOn=(state.tlBlocks||[]).some(function(b){return b.linkedId===r.id&&b.date===today;});
    if(alreadyOn){r._autoScheduled=true;return;}

    // Default duration: 30min. If reminder has a time, use that exact slot.
    var dur=30;
    var startMin;
    if(r.time){
      // Parse HH:MM
      var parts=r.time.split(':');
      startMin=parseInt(parts[0],10)*60+(parseInt(parts[1],10)||0);
    } else {
      // Find first available 30-min gap from now / 9am, no later than 8pm
      startMin=_suggestWorkTime?_suggestWorkTime(dur,today):null;
      if(startMin===null||startMin===undefined){
        var now=new Date();
        var nowMin=now.getHours()*60+now.getMinutes();
        startMin=Math.max(540,Math.ceil(nowMin/30)*30);
      }
    }

    var h=Math.floor(startMin/60);
    var m=startMin%60;
    var timeStr=(h<10?'0':'')+h+':'+(m<10?'0':'')+m;

    state.tlBlocks.push({
      id:'rem_tl_'+r.id+'_'+Date.now(),
      name:'🔔 '+r.text,
      date:today,
      time:timeStr,
      startMin:startMin,
      duration:dur,
      projectId:r.projectId||'',
      projectIds:r.projectIds||[],
      priority:'med',
      linkedType:'reminder',
      linkedId:r.id,
      color:'#f97316'  // distinct orange so reminders stand out from tasks
    });
    r._autoScheduled=true;
  });
  save();
  if(typeof renderTimeline==='function')renderTimeline();
}

// -- 2. Today reminder popup ---------------------------------------------
var _reminderPopupShownDate=null;

function checkAndShowReminderPopup(){
  var today=todayStr();
  // Only show once per calendar day per session
  if(_reminderPopupShownDate===today)return;
  var rems=(state.reminders||[]).filter(function(r){
    return r.date===today && !r._dismissed && !r._done;
  });
  if(!rems.length)return;
  _reminderPopupShownDate=today;
  openReminderPopup(rems);
}

function openReminderPopup(rems){
  var overlay=document.getElementById('reminderPopupOverlay');
  var list=document.getElementById('reminderPopupList');
  var sub=document.getElementById('reminderPopupSub');
  if(!overlay||!list)return;

  sub.textContent=rems.length+' reminder'+(rems.length>1?'s':'')+' due today';
  list.innerHTML=rems.map(function(r){
    var meta=r.time?('⏰ '+_tlFmtTime?_tlFmtTime(_tlParseTime(r.time)):r.time):'No time set';
    return '<div class="rem-popup-item" id="rpi_'+r.id+'">'+
      '<div class="rem-popup-item-text">'+esc(r.text)+'</div>'+
      '<div class="rem-popup-item-meta">'+meta+'</div>'+
      '<div class="rem-popup-item-actions">'+
        '<button class="rpa-done" onclick="reminderPopupDone(\''+r.id+'\')">✓ Mark done</button>'+
        '<button class="rpa-snooze" onclick="reminderPopupToggleSnooze(\''+r.id+'\')">⏰ Move</button>'+
        '<button onclick="reminderPopupDismiss(\''+r.id+'\')">× Dismiss</button>'+
      '</div>'+
      '<div class="rem-popup-snooze-row" id="rps_'+r.id+'">'+
        '<div class="snooze-inputs">'+
          '<input type="date" id="rpsd_'+r.id+'" value="">'+
          '<input type="time" id="rpst_'+r.id+'" value="">'+
          '<button onclick="reminderPopupSnooze(\''+r.id+'\')">Save</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  overlay.classList.remove('hidden');
}

function closeReminderPopup(){
  var overlay=document.getElementById('reminderPopupOverlay');
  if(overlay)overlay.classList.add('hidden');
}

function _reminderPopupRemoveItem(id){
  var el=document.getElementById('rpi_'+id);
  if(el)el.remove();
  // If no items left, close popup
  var list=document.getElementById('reminderPopupList');
  if(list&&!list.querySelector('.rem-popup-item'))closeReminderPopup();
}

function reminderPopupDone(id){
  var r=(state.reminders||[]).find(function(r){return r.id===id;});
  if(r){r._done=true;r._dismissed=true;}
  // Remove any auto-scheduled timeline block for this reminder
  state.tlBlocks=(state.tlBlocks||[]).filter(function(b){return b.linkedId!==id;});
  save();
  if(typeof renderReminders==='function')renderReminders();
  if(typeof renderTimeline==='function')renderTimeline();
  _reminderPopupRemoveItem(id);
  toast('Reminder marked done');
}

function reminderPopupDismiss(id){
  var r=(state.reminders||[]).find(function(r){return r.id===id;});
  if(r)r._dismissed=true;
  save();
  _reminderPopupRemoveItem(id);
  toast('Reminder dismissed for today');
}

function reminderPopupToggleSnooze(id){
  var row=document.getElementById('rps_'+id);
  if(!row)return;
  var isOpen=row.classList.contains('open');
  // Close any other open snooze rows
  document.querySelectorAll('.rem-popup-snooze-row.open').forEach(function(r){r.classList.remove('open');});
  if(!isOpen){
    row.classList.add('open');
    // Pre-fill with existing date/time
    var rem=(state.reminders||[]).find(function(r){return r.id===id;});
    if(rem){
      document.getElementById('rpsd_'+id).value=rem.date||'';
      document.getElementById('rpst_'+id).value=rem.time||'';
    }
  }
}

function reminderPopupSnooze(id){
  var dateEl=document.getElementById('rpsd_'+id);
  var timeEl=document.getElementById('rpst_'+id);
  var newDate=dateEl?dateEl.value:'';
  var newTime=timeEl?timeEl.value:'';
  if(!newDate){toast('Pick a date first');return;}

  var r=(state.reminders||[]).find(function(r){return r.id===id;});
  if(r){
    r.date=newDate;
    r.time=newTime;
    r._dismissed=false;
    r._autoScheduled=false;
    // Remove the old auto-scheduled block -- new date might be different
    state.tlBlocks=(state.tlBlocks||[]).filter(function(b){return b.linkedId!==id;});
    save();
    if(typeof renderReminders==='function')renderReminders();
    if(typeof renderTimeline==='function')renderTimeline();
    _reminderPopupRemoveItem(id);
    toast('Reminder moved to '+newDate+(newTime?' at '+newTime:''));
  }
}

// WAKE WORD -- "Hey Axis" (also accepts "Hey Jarvis" for legacy users)
// =======================================
var _wakeWordSR=null;
var _wakeWordActive=false;       // currently armed and listening for wake word
var _wakeWordEnabled=false;      // user-toggleable preference (persists); default OFF -- continuous mic listening can cause issues on iOS/Safari
var _wakeWordRetryTimer=null;
var _wakeWordSupported=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
var WAKE_PHRASES=['hey axis','hi axis','hey, axis','okay axis','ok axis','axis','hey jarvis','hi jarvis','hey, jarvis','okay jarvis','ok jarvis','jarvis'];

function _wakeWordMatches(transcript){
  var t=transcript.toLowerCase().trim();
  for(var i=0;i<WAKE_PHRASES.length;i++){
    if(t.indexOf(WAKE_PHRASES[i])>=0)return true;
  }
  return false;
}

function _startWakeWord(){
  if(!_wakeWordSupported||!_wakeWordEnabled||_wakeWordActive)return;
  if(_jarvisListening)return; // command mic has priority
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  try{
    _wakeWordSR=new SR();
    _wakeWordSR.continuous=true;
    _wakeWordSR.interimResults=true;
    _wakeWordSR.lang='en-US';
    _wakeWordSR.onresult=function(e){
      for(var i=e.resultIndex;i<e.results.length;i++){
        var transcript=e.results[i][0].transcript;
        if(_wakeWordMatches(transcript)){
          _onWakeWordDetected();
          return;
        }
      }
    };
    _wakeWordSR.onerror=function(e){
      // 'no-speech' and 'aborted' are normal; just keep restarting
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){
        _wakeWordEnabled=false;
        _updateWakeWordUI();
        toast('Mic permission denied. Wake word disabled.');
      }
    };
    _wakeWordSR.onend=function(){
      _wakeWordActive=false;
      // Auto-restart if still enabled and command mic isn't active
      if(_wakeWordEnabled&&!_jarvisListening&&document.visibilityState==='visible'){
        clearTimeout(_wakeWordRetryTimer);
        _wakeWordRetryTimer=setTimeout(_startWakeWord,400);
      }
    };
    _wakeWordSR.start();
    _wakeWordActive=true;
    _updateWakeWordUI();
  }catch(err){
    console.warn('[Wake word] start failed:',err);
    _wakeWordActive=false;
  }
}

function _stopWakeWord(){
  clearTimeout(_wakeWordRetryTimer);
  if(_wakeWordSR){try{_wakeWordSR.stop();_wakeWordSR.abort();}catch(e){}}
  _wakeWordSR=null;
  _wakeWordActive=false;
  _updateWakeWordUI();
}

function _onWakeWordDetected(){
  // Pause wake word, open Jarvis, start command capture
  _stopWakeWord();
  if(!_jarvisOpen)toggleJarvis();
  // Brief audible cue + auto-start mic for command
  toast('\u{1F3A4} Listening...');
  setTimeout(function(){
    if(!_jarvisListening)jarvisToggleMic();
  },300);
}

function toggleWakeWord(){
  _wakeWordEnabled=!_wakeWordEnabled;
  if(!state)state={};
  state.jarvisWakeEnabled=_wakeWordEnabled;
  if(typeof save==='function')save();
  if(_wakeWordEnabled){
    _startWakeWord();
    toast('Wake word enabled -- say "Hey Axis"');
  }else{
    _stopWakeWord();
    toast('Wake word disabled');
  }
  _updateWakeWordUI();
}

function _updateWakeWordUI(){
  var btn=document.getElementById('jarvisWakeBtn');
  if(!btn)return;
  if(!_wakeWordSupported){
    btn.style.display='none';
    return;
  }
  btn.title=_wakeWordEnabled?'Wake word ON ("Hey Axis") -- tap to disable':'Wake word OFF -- tap to enable';
  btn.classList.toggle('enabled',_wakeWordEnabled);
  btn.classList.toggle('active',_wakeWordActive&&_wakeWordEnabled);
  btn.textContent=_wakeWordEnabled?'\u{1F3A4}':'\u{1F507}';
}

// Resume wake word when command mic finishes
var _origJarvisToggleMic=jarvisToggleMic;
jarvisToggleMic=function(){
  // If wake word was listening, pause it while command mic is active
  if(_wakeWordActive)_stopWakeWord();
  _origJarvisToggleMic.apply(this,arguments);
};

// Tab visibility -- pause when hidden, restart when visible
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden'){
    if(_wakeWordActive)_stopWakeWord();
  }else if(document.visibilityState==='visible'){
    if(_wakeWordEnabled&&!_wakeWordActive&&!_jarvisListening){
      setTimeout(_startWakeWord,500);
    }
  }
});

// Init wake word on dashboard load -- restore saved preference, auto-start if enabled
function _initWakeWord(){
  // Restore from persisted state
  if(state&&typeof state.jarvisWakeEnabled==='boolean'){
    _wakeWordEnabled=state.jarvisWakeEnabled;
  }
  _updateWakeWordUI();
  // Only auto-start after a user gesture has occurred at some point;
  // otherwise some browsers block the mic. Will start on first toggle or after first click.
  if(_wakeWordEnabled&&_wakeWordSupported){
    // Defer to give DOM time and avoid auto-start before any user interaction
    var primed=false;
    var primer=function(){
      if(primed)return;
      primed=true;
      document.removeEventListener('click',primer);
      document.removeEventListener('keydown',primer);
      if(_wakeWordEnabled&&!_wakeWordActive)_startWakeWord();
    };
    document.addEventListener('click',primer,{once:true});
    document.addEventListener('keydown',primer,{once:true});
  }
}

// Wait for state to be loaded before init
setTimeout(_initWakeWord,1500);

// =======================================
// VOICE READBACK -- TTS for Jarvis replies
// =======================================
var _jarvisVoiceEnabled=false;           // user-toggleable preference (persists); default OFF to prevent device issues
var _jarvisVoiceSupported=!!window.speechSynthesis;
var _jarvisCurrentUtterance=null;
var _jarvisCurrentAudio=null;         // HTML Audio element for ElevenLabs TTS
var _jarvisPreferredVoice=null;

function _jarvisPickVoice(){
  if(!_jarvisVoiceSupported)return null;
  var voices=window.speechSynthesis.getVoices();
  if(!voices||!voices.length)return null;
  // Preference order: high-quality English voices
  var prefs=['Google US English','Samantha','Microsoft Aria Online (Natural) - English (United States)','Microsoft Jenny Online (Natural) - English (United States)','Karen','Daniel','Alex'];
  for(var i=0;i<prefs.length;i++){
    var v=voices.find(function(vc){return vc.name===prefs[i];});
    if(v)return v;
  }
  // Fallback: first en-US voice
  var enUS=voices.find(function(v){return v.lang==='en-US';});
  if(enUS)return enUS;
  // Fallback: any English voice
  var en=voices.find(function(v){return v.lang&&v.lang.indexOf('en')===0;});
  return en||voices[0];
}

function _jarvisCleanForSpeech(text){
  if(!text)return '';
  // Strip markdown, URLs, and special characters that don't speak well
  return text
    .replace(/```[\s\S]*?```/g,'')          // code blocks
    .replace(/`([^`]+)`/g,'$1')             // inline code
    .replace(/\*\*([^*]+)\*\*/g,'$1')       // bold
    .replace(/\*([^*]+)\*/g,'$1')           // italics
    .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1') // markdown links → just text
    .replace(/https?:\/\/\S+/g,'')          // raw URLs
    .replace(/#+\s/g,'')                    // headers
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,'') // emoji
    .replace(/\s+/g,' ')                    // collapse whitespace
    .trim();
}

async function _jarvisSpeak(text){
  if(!_jarvisVoiceEnabled)return;
  var clean=_jarvisCleanForSpeech(text);
  if(!clean)return;

  // Stop any in-flight audio before starting new utterance
  _jarvisStopSpeaking();

  // Pause wake word during speech to avoid feedback loop
  var wakeWasActive=_wakeWordActive;
  if(wakeWasActive)_stopWakeWord();

  var voiceBtn=document.getElementById('jarvisVoiceBtn');
  if(voiceBtn)voiceBtn.classList.add('speaking');

  var _done=function(){
    _jarvisCurrentAudio=null;
    if(voiceBtn)voiceBtn.classList.remove('speaking');
    if(wakeWasActive&&_wakeWordEnabled)setTimeout(_startWakeWord,400);
  };

  try{
    var res=await fetch(JARVIS_PROXY_URL+'/ops-speak',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:clean}),
    });
    if(!res.ok)throw new Error('HTTP '+res.status);
    var blob=await res.blob();
    var blobUrl=URL.createObjectURL(blob);
    _jarvisCurrentAudio=new Audio(blobUrl);
    _jarvisCurrentAudio.onended=function(){URL.revokeObjectURL(blobUrl);_done();};
    _jarvisCurrentAudio.onerror=function(){URL.revokeObjectURL(blobUrl);_done();};
    _jarvisCurrentAudio.play();
  }catch(e){
    console.warn('[Jarvis voice] ElevenLabs unavailable, falling back to browser TTS:',e.message);
    if(!_jarvisVoiceSupported){_done();return;}
    var u=new SpeechSynthesisUtterance(clean);
    u.rate=1.05;u.pitch=1.0;u.volume=1.0;
    if(_jarvisPreferredVoice)u.voice=_jarvisPreferredVoice;
    u.onend=function(){_jarvisCurrentUtterance=null;_done();};
    u.onerror=function(){_jarvisCurrentUtterance=null;_done();};
    _jarvisCurrentUtterance=u;
    try{window.speechSynthesis.speak(u);}catch(err){console.warn('[Jarvis voice] Browser TTS also failed:',err);_done();}
  }
}

function _jarvisStopSpeaking(){
  if(_jarvisCurrentAudio){_jarvisCurrentAudio.pause();_jarvisCurrentAudio=null;}
  if(_jarvisVoiceSupported){try{window.speechSynthesis.cancel();}catch(e){}}
  _jarvisCurrentUtterance=null;
  var voiceBtn=document.getElementById('jarvisVoiceBtn');
  if(voiceBtn)voiceBtn.classList.remove('speaking');
}

function toggleJarvisVoice(){
  // If currently speaking, stop and disable
  if(_jarvisCurrentAudio||_jarvisCurrentUtterance||(window.speechSynthesis&&window.speechSynthesis.speaking)){
    _jarvisStopSpeaking();
    _jarvisVoiceEnabled=false;
  }else{
    _jarvisVoiceEnabled=!_jarvisVoiceEnabled;
  }
  if(!state)state={};
  state.jarvisVoiceEnabled=_jarvisVoiceEnabled;
  if(typeof save==='function')save();
  _updateVoiceUI();
  toast(_jarvisVoiceEnabled?'Voice readback enabled':'Voice readback muted');
}

function _updateVoiceUI(){
  var btn=document.getElementById('jarvisVoiceBtn');
  if(!btn)return;
  if(!_jarvisVoiceSupported){
    btn.style.display='none';
    return;
  }
  btn.title=_jarvisVoiceEnabled?'Voice readback ON -- tap to mute':'Voice readback OFF -- tap to enable';
  btn.classList.toggle('enabled',_jarvisVoiceEnabled);
  btn.textContent=_jarvisVoiceEnabled?'\u{1F50A}':'\u{1F507}';
}

// Voices in many browsers load asynchronously
if(_jarvisVoiceSupported){
  _jarvisPreferredVoice=_jarvisPickVoice();
  window.speechSynthesis.onvoiceschanged=function(){
    _jarvisPreferredVoice=_jarvisPickVoice();
  };
}

// Hook into _jarvisAddMessage to auto-speak assistant replies
var _origJarvisAddMessage=_jarvisAddMessage;
_jarvisAddMessage=function(role,content,actionSummary){
  _origJarvisAddMessage.apply(this,arguments);
  if(role==='assistant'&&_jarvisVoiceEnabled){
    // Speak the reply (action summary is shown visually, not voiced)
    _jarvisSpeak(content);
  }
};

// Stop speaking when panel closes
var _origToggleJarvis=toggleJarvis;
toggleJarvis=function(){
  // If we're closing the panel while speaking, stop the speech
  if(_jarvisOpen&&_jarvisCurrentUtterance)_jarvisStopSpeaking();
  _origToggleJarvis.apply(this,arguments);
};

// Restore preference on load
function _initJarvisVoice(){
  if(state&&typeof state.jarvisVoiceEnabled==='boolean'){
    _jarvisVoiceEnabled=state.jarvisVoiceEnabled;
  }
  _updateVoiceUI();
}
setTimeout(_initJarvisVoice,1500);

// ===========================================================================
// CALENDAR SYNC -- Google Calendar (two-way) | Outlook pattern in OUTLOOK_NEXT.md
// ===========================================================================

// -- CONFIG -----------------------------------------------------------------
// GOOGLE_CLIENT_ID is defined in config.js

var GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email';
var GCAL_CALENDAR_NAME = 'Centerpost';
var GCAL_API_BASE = 'https://www.googleapis.com/calendar/v3';

// -- INTERNAL STATE ---------------------------------------------------------
var _gcalTokenClient = null;
var _gcalAccessToken = null;
var _gcalTokenExpiry = 0;
var _gcalGisLoaded = false;
var _gcalSyncing = false;

// -- GIS BOOTSTRAP ----------------------------------------------------------
function _gcalLoadGis(){
  return new Promise(function(resolve, reject){
    if(window.google && window.google.accounts && window.google.accounts.oauth2){
      _gcalGisLoaded = true;
      resolve();
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = function(){ _gcalGisLoaded = true; resolve(); };
    s.onerror = function(){ reject(new Error('Failed to load Google Identity Services')); };
    document.head.appendChild(s);
  });
}

function _gcalInitTokenClient(){
  if(!GOOGLE_CLIENT_ID){
    toast('Set GOOGLE_CLIENT_ID in index.html first (see SETUP_GUIDE.md)');
    return false;
  }
  if(_gcalTokenClient) return true;
  _gcalTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: function(resp){
      // If a _gcalEnsureToken promise is waiting, route there.
      if(_gcalInteractiveCb){ _gcalInteractiveCb(resp); return; }
      // Otherwise this is an interactive gcalConnect() flow.
      if(resp.error){
        toast('Google auth: '+(resp.error_description||resp.error));
        _gcalSetSyncingUI(false);
        return;
      }
      _gcalAccessToken = resp.access_token;
      _gcalTokenExpiry = Date.now() + ((resp.expires_in||3600) * 1000) - 60000;
      _gcalOnAuthSuccess();
    }
  });
  return true;
}

// -- PUBLIC: CONNECT / DISCONNECT -------------------------------------------
async function gcalConnect(){
  try {
    _gcalSetSyncingUI(true);
    await _gcalLoadGis();
    if(!_gcalInitTokenClient()){ _gcalSetSyncingUI(false); return; }
    // Interactive -- prompts the user to pick account & grant consent
    _gcalTokenClient.requestAccessToken({ prompt: 'consent' });
  } catch(e){
    toast('Connect failed: '+e.message);
    _gcalSetSyncingUI(false);
  }
}

async function _gcalOnAuthSuccess(){
  // Fetch user email
  try {
    var r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer '+_gcalAccessToken }
    });
    if(r.ok){
      var info = await r.json();
      state.gcal.email = info.email || null;
    }
  } catch(e){ console.warn('[gcal] userinfo failed', e); }
  // Ensure dedicated calendar exists
  await _gcalEnsureCalendar();
  state.gcal.connected = true;
  save();
  _gcalSetSyncingUI(false);
  _gcalUpdateUI();
  if(document.getElementById('gcalModal').classList.contains('open')) _gcalRenderModal();
  toast('Connected to Google Calendar'+(state.gcal.email?' as '+state.gcal.email:''));
}

function gcalDisconnect(){
  if(_gcalAccessToken && window.google && google.accounts && google.accounts.oauth2){
    try { google.accounts.oauth2.revoke(_gcalAccessToken, function(){}); } catch(e){}
  }
  _gcalAccessToken = null;
  _gcalTokenExpiry = 0;
  _gcalTokenClient = null;
  state.gcal = {connected:false,email:null,calendarId:null,autoPush:false,showExternal:true,lastPush:null,lastPull:null,pulledEvents:[]};
  // Clear gcalEventId markers from all items (they reference a calendar we no longer track)
  (state.tasks||[]).forEach(function(t){ delete t.gcalEventId; });
  (state.projects||[]).forEach(function(p){
    delete p.gcalEventId;
    (p.subtasks||[]).forEach(function(s){ delete s.gcalEventId; });
  });
  (state.reminders||[]).forEach(function(r){ delete r.gcalEventId; });
  save();
  _gcalUpdateUI();
  if(typeof renderTimeline === 'function') renderTimeline();
  if(document.getElementById('gcalModal').classList.contains('open')) _gcalRenderModal();
  toast('Disconnected from Google Calendar');
}

// -- TOKEN HANDLING ---------------------------------------------------------
var _gcalTokenPromise = null;   // single in-flight token request
var _gcalInteractiveCb = null;  // callback target for the active request

async function _gcalEnsureToken(interactive){
  if(_gcalAccessToken && Date.now() < _gcalTokenExpiry) return true;
  if(!GOOGLE_CLIENT_ID) return false;

  // If a token request is already in flight, await the same promise rather than
  // starting a second one (which would clobber the callback and hang the first).
  if(_gcalTokenPromise) return _gcalTokenPromise;

  _gcalTokenPromise = (async function(){
    try {
      await _gcalLoadGis();
      if(!_gcalInitTokenClient()) return false;
    } catch(e){ console.warn('[gcal] GIS load failed', e); return false; }

    return new Promise(function(resolve){
      // Single shared callback -- set once in _gcalInitTokenClient -- routes here.
      _gcalInteractiveCb = function(resp){
        _gcalInteractiveCb = null;
        if(resp && resp.access_token){
          _gcalAccessToken = resp.access_token;
          _gcalTokenExpiry = Date.now() + ((resp.expires_in||3600) * 1000) - 60000;
          resolve(true);
        } else {
          console.warn('[gcal] token request failed', (resp&&resp.error)||'no error detail');
          resolve(false);
        }
      };
      try {
        // Empty prompt = silent if possible. On failure (common on Safari/iOS
        // third-party cookie blocking) the caller falls back to interactive connect.
        _gcalTokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      } catch(e){
        console.warn('[gcal] requestAccessToken threw', e);
        _gcalInteractiveCb = null;
        resolve(false);
      }
    });
  })();

  var result = await _gcalTokenPromise;
  _gcalTokenPromise = null;
  return result;
}

// -- HTTP HELPER ------------------------------------------------------------
async function _gcalFetch(method, path, body, _isRetry){
  var ok = await _gcalEnsureToken();
  if(!ok){
    console.warn('[gcal] no valid token for '+method+' '+path);
    return null;
  }
  var opts = {
    method: method,
    headers: { Authorization: 'Bearer '+_gcalAccessToken, 'Content-Type': 'application/json' }
  };
  if(body) opts.body = JSON.stringify(body);
  try {
    var r = await fetch(GCAL_API_BASE+path, opts);
    if(r.status === 204) return {_deleted:true};
    // Token rejected mid-flight -- force one refresh and retry exactly once.
    if(r.status === 401 && !_isRetry){
      console.warn('[gcal] 401 -- forcing token refresh and retrying once');
      _gcalAccessToken = null; _gcalTokenExpiry = 0;
      return _gcalFetch(method, path, body, true);
    }
    var data = await r.json();
    if(data.error){ console.warn('[gcal] '+method+' '+path, r.status, data.error); }
    return data;
  } catch(e){
    console.error('[gcal] fetch error', method, path, e);
    return null;
  }
}

// -- CALENDAR MANAGEMENT ----------------------------------------------------
async function _gcalEnsureCalendar(){
  // Check existing
  if(state.gcal.calendarId){
    var verify = await _gcalFetch('GET', '/calendars/'+encodeURIComponent(state.gcal.calendarId));
    if(verify && !verify.error && verify.id) return state.gcal.calendarId;
  }
  // Look in calendar list
  var list = await _gcalFetch('GET', '/users/me/calendarList');
  if(list && list.items){
    var found = list.items.find(function(c){ return c.summary === GCAL_CALENDAR_NAME; });
    if(found){ state.gcal.calendarId = found.id; save(); return found.id; }
  }
  // Create new
  var tz = 'UTC';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch(e){}
  var created = await _gcalFetch('POST', '/calendars', {
    summary: GCAL_CALENDAR_NAME,
    description: 'Auto-synced from Centerpost productivity dashboard',
    timeZone: tz
  });
  if(created && created.id){ state.gcal.calendarId = created.id; save(); return created.id; }
  return null;
}

// -- EVENT BUILDER ----------------------------------------------------------
function _gcalPad2(n){ return n<10?'0'+n:''+n; }
function _gcalBuildEvent(item){
  // item: {id, name, date, time?, durMin?, priority?, projectName?, kind, sourceId}
  var summary = item.name;
  if(item.projectName) summary = '['+item.projectName+'] '+summary;
  if(item.priority === 'high' && summary.indexOf('[HIGH]')===-1) summary = '🔴 '+summary;
  var description = 'Centerpost ' + (item.kind || 'item');
  if(item.projectName) description += ' -- project: '+item.projectName;
  if(item.priority) description += '\nPriority: '+item.priority;
  if(item.durMin) description += '\nTime estimate: '+item.durMin+' min';
  description += '\n\n(Synced from Centerpost)';
  // Time handling
  var start, end;
  if(item.time){
    var startDate = new Date(item.date+'T'+item.time+':00');
    var dur = parseInt(item.durMin||60);
    var endDate = new Date(startDate.getTime() + dur*60000);
    start = { dateTime: startDate.toISOString() };
    end   = { dateTime: endDate.toISOString() };
  } else {
    // All-day
    var d = new Date(item.date+'T00:00:00');
    var d2 = new Date(d.getTime()); d2.setDate(d2.getDate()+1);
    start = { date: item.date };
    end   = { date: d2.getFullYear()+'-'+_gcalPad2(d2.getMonth()+1)+'-'+_gcalPad2(d2.getDate()) };
  }
  // Color (Google IDs: 11=red, 5=yellow, 9=blue, 10=green)
  var colorMap = { high:'11', med:'5', low:'9' };
  var ev = {
    summary: summary,
    description: description,
    start: start,
    end: end,
    extendedProperties: {
      private: {
        centerpostId: item.sourceId || item.id,
        centerpostKind: item.kind || 'item'
      }
    }
  };
  if(item.priority && colorMap[item.priority]) ev.colorId = colorMap[item.priority];
  return ev;
}

// -- PUSH -------------------------------------------------------------------
async function _gcalPushItem(item){
  if(!state.gcal.connected || !item.date) return null;
  var calId = state.gcal.calendarId || await _gcalEnsureCalendar();
  if(!calId) return null;
  var payload = _gcalBuildEvent(item);
  var existing = item.existingEventId;
  var result;
  if(existing){
    result = await _gcalFetch('PUT',
      '/calendars/'+encodeURIComponent(calId)+'/events/'+existing, payload);
  } else {
    result = await _gcalFetch('POST',
      '/calendars/'+encodeURIComponent(calId)+'/events', payload);
  }
  return (result && result.id) ? result.id : null;
}

async function gcalPushAll(){
  if(!state.gcal.connected){ openGcalModal(); return; }
  if(_gcalSyncing) return;
  _gcalSyncing = true;
  _gcalSetSyncingUI(true);
  var pushed = 0, failed = 0;

  try {
    // -- Pre-flight auth check --------------------------------------------
    // Validates / silently refreshes the access token ONCE before iterating.
    // Avoids grinding through N items that all return null on expired auth.
    var tokenOk = await _gcalEnsureToken();
    if(!tokenOk){
      // Silent refresh failed (common on Safari/iOS). Trigger interactive consent.
      toast('Google session expired -- reconnecting…');
      _gcalAccessToken = null; _gcalTokenExpiry = 0;
      tokenOk = await _gcalEnsureToken(true);
      if(!tokenOk){
        toast('Could not reconnect to Google -- open Calendar settings to re-authorize');
        openGcalModal();
        return;
      }
    }

    // 1. Standalone tasks with due date (not done)
    for(var i=0;i<(state.tasks||[]).length;i++){
      var t = state.tasks[i];
      if(!t.due || t.done) continue;
      var eid = await _gcalPushItem({
        name: t.name, date: t.due, time: t.time, durMin: parseInt(t.timeEst)||60,
        priority: t.priority||'med', kind: 'task', sourceId: t.id, existingEventId: t.gcalEventId
      });
      if(eid){ t.gcalEventId = eid; pushed++; } else { failed++; }
    }

    // 2. Project subtasks with due date (not done)
    for(var p=0;p<(state.projects||[]).length;p++){
      var proj = state.projects[p];
      for(var s=0;s<(proj.subtasks||[]).length;s++){
        var st = proj.subtasks[s];
        if(!st.due || st.done) continue;
        var seid = await _gcalPushItem({
          name: st.name, date: st.due, time: st.time, durMin: parseInt(st.timeEst)||60,
          priority: st.priority||'med', kind: 'subtask', projectName: proj.name,
          sourceId: st.id, existingEventId: st.gcalEventId
        });
        if(seid){ st.gcalEventId = seid; pushed++; } else { failed++; }
      }
    }

    // 3. Reminders with a date
    for(var r=0;r<(state.reminders||[]).length;r++){
      var rem = state.reminders[r];
      if(!rem.date) continue;
      var reid = await _gcalPushItem({
        name: rem.text, date: rem.date, time: rem.time, durMin: 30,
        priority: 'med', kind: 'reminder', sourceId: rem.id, existingEventId: rem.gcalEventId
      });
      if(reid){ rem.gcalEventId = reid; pushed++; } else { failed++; }
    }

    // 4. Manual timeline blocks
    for(var b=0;b<(state.tlBlocks||[]).length;b++){
      var blk = state.tlBlocks[b];
      if(!blk.date || !blk.time) continue;
      if(blk.linkedId && blk.linkedType){
        var _dup=false;
        if(blk.linkedType==='task'){
          var _lt=(state.tasks||[]).find(function(x){return x.id===blk.linkedId;});
          if(_lt&&_lt.gcalEventId&&_lt.due===blk.date)_dup=true;
        }else if(blk.linkedType==='subtask'){
          var _dupFound=false;
          for(var _pi=0;_pi<(state.projects||[]).length&&!_dupFound;_pi++){
            var _lp=state.projects[_pi];
            var _ls=(_lp.subtasks||[]).find(function(x){return x.id===blk.linkedId;});
            if(_ls&&_ls.gcalEventId&&_ls.due===blk.date){_dup=true;_dupFound=true;}
          }
        }
        if(_dup)continue;
      }
      var projName = '';
      if(blk.projectId){
        var bp = (state.projects||[]).find(function(p){return p.id===blk.projectId;});
        if(bp) projName = bp.name;
      }
      var beid = await _gcalPushItem({
        name: blk.name, date: blk.date, time: blk.time, durMin: parseInt(blk.duration)||60,
        priority: blk.priority||'med', kind: 'block', projectName: projName,
        sourceId: blk.id, existingEventId: blk.gcalEventId
      });
      if(beid){ blk.gcalEventId = beid; pushed++; } else { failed++; }
    }

    state.gcal.lastPush = new Date().toISOString();
    save();
    toast('Pushed '+pushed+' item'+(pushed===1?'':'s')+' to Google Calendar'+(failed?' ('+failed+' failed)':''));

  } catch(e) {
    console.error('[gcal] gcalPushAll error', e);
    toast('Google Calendar push error: '+e.message);
  } finally {
    _gcalSyncing = false;
    _gcalSetSyncingUI(false);
    _gcalUpdateUI();
    if(document.getElementById('gcalModal')&&document.getElementById('gcalModal').classList.contains('open'))_gcalRenderModal();
  }
}

// -- DELETE PROPAGATION -----------------------------------------------------
async function _gcalDeleteEvent(eventId){
  if(!state.gcal.connected || !eventId || !state.gcal.calendarId) return;
  await _gcalFetch('DELETE',
    '/calendars/'+encodeURIComponent(state.gcal.calendarId)+'/events/'+eventId);
}

// -- PULL -------------------------------------------------------------------
async function gcalPullEvents(){
  if(!state.gcal.connected){ openGcalModal(); return; }
  if(_gcalSyncing) return;
  _gcalSyncing = true;
  _gcalSetSyncingUI(true);

  try {
    var tokenOk = await _gcalEnsureToken();
    if(!tokenOk){
      toast('Google session expired -- re-authorize in Calendar settings');
      openGcalModal();
      return;
    }

    var now = new Date();
    var min = new Date(now); min.setDate(min.getDate() - 1); min.setHours(0,0,0,0);
    var max = new Date(now); max.setDate(max.getDate() + 14); max.setHours(23,59,59,999);
    var qs = '?timeMin='+encodeURIComponent(min.toISOString())+
             '&timeMax='+encodeURIComponent(max.toISOString())+
             '&singleEvents=true&orderBy=startTime&maxResults=100';

    var external = [];
    var primary = await _gcalFetch('GET', '/calendars/primary/events'+qs);
    if(primary && primary.items){
      primary.items.forEach(function(e){
        var ep = e.extendedProperties && e.extendedProperties.private;
        if(ep && ep.centerpostId) return;
        var startDt = e.start && (e.start.dateTime || e.start.date);
        var endDt   = e.end   && (e.end.dateTime   || e.end.date);
        if(!startDt) return;
        external.push({
          id: 'gcal-'+e.id,
          eventId: e.id,
          title: e.summary || '(no title)',
          start: startDt,
          end: endDt,
          location: e.location || '',
          allDay: !(e.start && e.start.dateTime),
          source: 'google',
          htmlLink: e.htmlLink || ''
        });
      });
    }
    state.gcal.pulledEvents = external;
    state.gcal.lastPull = new Date().toISOString();
    save();
    if(typeof renderTimeline === 'function') renderTimeline();
    toast('Pulled '+external.length+' external event'+(external.length===1?'':'s')+' from Google Calendar');

  } catch(e){
    console.error('[gcal] gcalPullEvents error', e);
    toast('Google Calendar pull error: '+e.message);
  } finally {
    _gcalSyncing = false;
    _gcalSetSyncingUI(false);
    _gcalUpdateUI();
    if(document.getElementById('gcalModal')&&document.getElementById('gcalModal').classList.contains('open'))_gcalRenderModal();
  }
}

// Helper for timeline integration: returns external GCal events for a given YYYY-MM-DD
function gcalEventsForDate(dateStr){
  if(!state.gcal || !state.gcal.connected || !state.gcal.showExternal) return [];
  return (state.gcal.pulledEvents||[]).filter(function(e){
    if(e.allDay){ return e.start === dateStr; }
    // Timed: compare YYYY-MM-DD portion
    return (e.start||'').slice(0,10) === dateStr;
  }).map(function(e){
    var startMin = 0;
    if(!e.allDay && e.start){
      var d = new Date(e.start);
      startMin = d.getHours()*60 + d.getMinutes();
    }
    var durMin = 60;
    if(!e.allDay && e.start && e.end){
      durMin = Math.max(15, Math.round((new Date(e.end) - new Date(e.start))/60000));
    }
    return {
      id: e.id, name: e.title, startMin: startMin, durMin: durMin,
      projectId: '', priority: 'med', source: 'gcal-external',
      external: true, htmlLink: e.htmlLink
    };
  });
}

// -- UI HELPERS -------------------------------------------------------------
function _gcalSetSyncingUI(on){
  var chip = document.getElementById('gcalStatusChip');
  if(chip) chip.classList.toggle('syncing', !!on);
}

function _gcalUpdateUI(){
  var chip = document.getElementById('gcalStatusChip');
  var lbl  = document.getElementById('gcalStatusLabel');
  if(!chip || !lbl) return;
  if(state.gcal && state.gcal.connected){
    chip.classList.add('connected');
    lbl.textContent = '✓ Sync: on';
  } else {
    chip.classList.remove('connected');
    lbl.textContent = '✗ Sync: off';
  }
}

function _gcalRelTime(iso){
  if(!iso) return 'never';
  var diff = (Date.now() - new Date(iso).getTime())/1000;
  if(diff < 60) return Math.floor(diff)+'s ago';
  if(diff < 3600) return Math.floor(diff/60)+' min ago';
  if(diff < 86400) return Math.floor(diff/3600)+' hr ago';
  return Math.floor(diff/86400)+' day'+(diff>=172800?'s':'')+' ago';
}

function openGcalModal(){
  _gcalRenderModal();
  var m = document.getElementById('gcalModal');
  if(m) m.classList.add('open');
}

function closeGcalModal(){
  var m = document.getElementById('gcalModal');
  if(m) m.classList.remove('open');
}

function _gcalRenderModal(){
  var body = document.getElementById('gcalModalBody');
  if(!body) return;
  var html = '';

  if(!GOOGLE_CLIENT_ID){
    html += '<div class="gcal-status-row"><span class="gcal-dot"></span><div><strong>Not configured.</strong><br><span style="font-size:12px;color:var(--text-dim);">Open index.html, find <code>GOOGLE_CLIENT_ID</code> near the bottom of the script, and paste your OAuth client ID from Google Cloud Console.</span></div></div>';
    html += '<div class="gcal-help"><strong>One-time setup:</strong><br>1. Go to <code>console.cloud.google.com</code><br>2. Create a project &amp; enable Google Calendar API<br>3. Create OAuth client ID (Web app)<br>4. Add <code>https://centerpost.app</code> as Authorized JavaScript origin<br>5. Paste the Client ID into <code>GOOGLE_CLIENT_ID</code> and redeploy<br><br>Full guide: see <code>GOOGLE_CALENDAR_SETUP.md</code>.</div>';
    body.innerHTML = html;
    return;
  }

  if(state.gcal && state.gcal.connected){
    // Check whether the in-memory access token is still valid.
    // After a page refresh state.gcal.connected stays true but _gcalAccessToken
    // is null -- show a re-auth prompt rather than letting Push silently fail.
    var sessionActive = _gcalAccessToken && Date.now() < _gcalTokenExpiry;

    if(!sessionActive){
      html += '<div class="gcal-status-row" style="border-left:3px solid var(--orange);padding-left:10px;">';
      html += '<span class="gcal-dot" style="background:var(--orange);"></span>';
      html += '<div><strong>Session expired.</strong><br><span style="font-size:12px;color:var(--text-dim);">Your Google Calendar connection is saved but the session token needs to be refreshed. This happens after every page reload -- tap Re-authorize to restore sync.</span></div></div>';
      html += '<dl class="gcal-info-grid"><dt>Account</dt><dd>'+esc(state.gcal.email||'(saved)')+'</dd>';
      html += '<dt>Calendar</dt><dd>'+GCAL_CALENDAR_NAME+'</dd>';
      html += '<dt>Last push</dt><dd>'+_gcalRelTime(state.gcal.lastPush)+'</dd></dl>';
      html += '<div class="gcal-actions">';
      html += '<button class="gcal-btn primary" onclick="gcalConnect()">&#128279; Re-authorize</button>';
      html += '<button class="gcal-btn danger" onclick="_confirmGcalDisconnect()">Disconnect</button>';
      html += '</div>';
      body.innerHTML = html;
      return;
    }

    html += '<div class="gcal-status-row connected"><span class="gcal-dot"></span><div><strong>Connected.</strong> Your Centerpost items can now sync with Google Calendar.</div></div>';
    html += '<dl class="gcal-info-grid">';
    html += '<dt>Account</dt><dd>'+esc(state.gcal.email||'(unknown)')+'</dd>';
    html += '<dt>Calendar</dt><dd>'+GCAL_CALENDAR_NAME+'</dd>';
    html += '<dt>Last push</dt><dd>'+_gcalRelTime(state.gcal.lastPush)+'</dd>';
    html += '<dt>Last pull</dt><dd>'+_gcalRelTime(state.gcal.lastPull)+'</dd>';
    if(state.gcal.pulledEvents) html += '<dt>External events</dt><dd>'+state.gcal.pulledEvents.length+' cached</dd>';
    html += '</dl>';

    html += '<div class="gcal-actions">';
    html += '<button class="gcal-btn primary" onclick="gcalPushAll()" '+(_gcalSyncing?'disabled':'')+'>&#11014; Push All to Google</button>';
    html += '<button class="gcal-btn" onclick="gcalPullEvents()" '+(_gcalSyncing?'disabled':'')+'>&#11015; Pull Events from Google</button>';
    html += '</div>';

    html += '<label class="gcal-toggle-row"><input type="checkbox" '+(state.gcal.showExternal?'checked':'')+' onchange="state.gcal.showExternal=this.checked;save();_gcalUpdateUI();if(typeof renderTimeline===\'function\')renderTimeline();"><div class="gcal-toggle-label">Show external events in Timeline<div class="gcal-toggle-hint">Events from your primary Google Calendar that didn\'t originate in Centerpost.</div></div></label>';

    html += '<label class="gcal-toggle-row"><input type="checkbox" '+(state.gcal.autoPush?'checked':'')+' onchange="state.gcal.autoPush=this.checked;save();"><div class="gcal-toggle-label">Auto-push new items (experimental)<div class="gcal-toggle-hint">When ON, new tasks/subtasks/reminders with a date push automatically. Off by default -- use the manual button until you trust it.</div></div></label>';

    html += '<div class="gcal-actions" style="margin-top:14px;">';
    html += '<button class="gcal-btn danger" onclick="_confirmGcalDisconnect()">Disconnect</button>';
    html += '</div>';

    html += '<div class="gcal-help">&#9881; <strong>What syncs:</strong> tasks, project subtasks, reminders, and timeline blocks with a date. Items without a date stay local. <br><br>&#128274; <strong>What doesn\'t sync:</strong> Brain Dump thoughts, notes, journal entries, mood/energy logs, wellness reflections, Presence.</div>';
  } else {
    html += '<div class="gcal-status-row"><span class="gcal-dot"></span><div><strong>Not connected.</strong><br><span style="font-size:12px;color:var(--text-dim);">Connect to push tasks, subtasks, and reminders to a "'+GCAL_CALENDAR_NAME+'" calendar in your Google account, and pull events back into the Timeline panel.</span></div></div>';
    html += '<div class="gcal-actions">';
    html += '<button class="gcal-btn primary" onclick="gcalConnect()" '+(_gcalSyncing?'disabled':'')+'>&#128279; Connect Google Calendar</button>';
    html += '</div>';
    html += '<div class="gcal-help"><strong>Privacy:</strong> auth happens in a Google popup. Centerpost never sees your password. The access token lives only in this browser tab and expires in 1 hour. You can disconnect anytime.</div>';
  }
  body.innerHTML = html;
}

// Initialize chip on load
setTimeout(function(){
  if(state && state.gcal) _gcalUpdateUI();
}, 1500);

// ===========================================================================
// OPTIONAL: Auto-sync hooks. Disabled by default (state.gcal.autoPush=false).
// When user enables autoPush, these wrappers push individual items on create.
// Deletes always propagate when connected (independent of autoPush).
// ===========================================================================

// Wrap addStandaloneTask: auto-push the newly added task if enabled
(function(){
  if(typeof addStandaloneTask !== 'function') return;
  var _orig = addStandaloneTask;
  addStandaloneTask = function(){
    var beforeLen = (state.tasks||[]).length;
    var ret = _orig.apply(this, arguments);
    try {
      if(state.gcal && state.gcal.connected && state.gcal.autoPush){
        // The new task is the last appended to state.tasks
        var t = state.tasks[state.tasks.length-1];
        if(t && t.due && !t.done){
          _gcalPushItem({
            name: t.name, date: t.due, time: t.time, durMin: parseInt(t.timeEst)||60,
            priority: t.priority||'med', kind: 'task', sourceId: t.id
          }).then(function(eid){
            if(eid){ t.gcalEventId = eid; save(); }
          });
        }
      }
    } catch(e){ console.warn('[gcal] auto-push task failed', e); }
    return ret;
  };
})();

// Wrap deleteStandaloneTask: propagate delete to Google
(function(){
  if(typeof deleteStandaloneTask !== 'function') return;
  var _orig = deleteStandaloneTask;
  deleteStandaloneTask = function(id){
    try {
      if(state.gcal && state.gcal.connected){
        var t = (state.tasks||[]).find(function(x){return x.id===id;});
        if(t && t.gcalEventId) _gcalDeleteEvent(t.gcalEventId);
      }
    } catch(e){ console.warn('[gcal] delete propagation failed', e); }
    return _orig.apply(this, arguments);
  };
})();

// Wrap deleteSubtask: propagate delete
(function(){
  if(typeof deleteSubtask !== 'function') return;
  var _orig = deleteSubtask;
  deleteSubtask = function(pid, sid){
    try {
      if(state.gcal && state.gcal.connected){
        var p = (state.projects||[]).find(function(x){return x.id===pid;});
        var s = p && p.subtasks.find(function(x){return x.id===sid;});
        if(s && s.gcalEventId) _gcalDeleteEvent(s.gcalEventId);
      }
    } catch(e){ console.warn('[gcal] delete subtask propagation failed', e); }
    return _orig.apply(this, arguments);
  };
})();

// Wrap deleteProject: propagate deletes for all its subtasks
(function(){
  if(typeof deleteProject !== 'function') return;
  var _orig = deleteProject;
  deleteProject = function(id){
    try {
      if(state.gcal && state.gcal.connected){
        var p = (state.projects||[]).find(function(x){return x.id===id;});
        if(p){
          (p.subtasks||[]).forEach(function(s){
            if(s.gcalEventId) _gcalDeleteEvent(s.gcalEventId);
          });
        }
      }
    } catch(e){ console.warn('[gcal] delete project propagation failed', e); }
    return _orig.apply(this, arguments);
  };
})();

// ===========================================================================
// TIMELINE HOOK: inject external Google events into _tlCollectBlocks output.
// We monkey-patch by wrapping the original and appending external events.
// ===========================================================================
(function(){
  if(typeof _tlCollectBlocks !== 'function') return;
  var _origCollect = _tlCollectBlocks;
  _tlCollectBlocks = function(targetDate){
    var blocks = _origCollect.apply(this, arguments) || [];
    try {
      var date = targetDate || (typeof todayStr==='function'?todayStr():null);
      if(date){
        var ext = gcalEventsForDate(date);
        // Avoid duplicating external events that somehow got pushed back
        blocks = blocks.concat(ext);
      }
    } catch(e){ console.warn('[gcal] timeline merge failed', e); }
    return blocks;
  };
})();

