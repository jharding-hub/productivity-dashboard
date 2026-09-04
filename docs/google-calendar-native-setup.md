# Google Calendar sync on the native iOS app

## Why native needs its own OAuth client

The web app signs in with Google Identity Services. That cannot work inside the
Capacitor app, and it is not a misconfiguration we can fix in the console.

The WebView's origin is `capacitor://localhost`. Google rejects every OAuth
origin that is not `http(s)`, with:

> Access blocked: Authorization Error — Error 400: invalid_request
> You can't sign in to this app because it doesn't comply with Google's OAuth
> 2.0 policy for keeping apps secure.

The Authorized JavaScript origins field also refuses custom schemes, so there is
nothing that could be registered to make it work. Verified by replaying the real
client id against `accounts.google.com` from each candidate origin —
`capacitor://localhost` and `file://` produce that exact wording, while an
ordinary unregistered https origin produces the *different* `redirect_uri_mismatch`
wording. The two error texts are diagnostic; don't confuse them.

What Google does allow for a native app is the authorization-code flow with
PKCE, carried in the system browser. That is what `GoogleAuthBridge.swift` does.

## One-time setup in Google Cloud Console

Project: **1065593793454** (the same project as the existing web client).

1. Open <https://console.cloud.google.com/apis/credentials> and make sure the
   project selector at the top shows the Centerpost project.
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. Application type: **iOS** (not Web — a second, separate client).
4. Name: `Centerpost iOS`.
5. Bundle ID: `app.centerpost.app`
6. Click **CREATE**. Copy the client ID it shows.
7. Paste it into `GOOGLE_IOS_CLIENT_ID` in `public/config.js`, commit, push.
8. Re-sync and ship the native app — a web deploy alone does not update it.

No redirect URI needs entering by hand: for an iOS client Google derives it from
the reversed client id, and `ASWebAuthenticationSession` intercepts that scheme
directly, so no `CFBundleURLTypes` entry is required either.

## Known limit: the 7-day refresh token

While the OAuth consent screen's publishing status is **Testing**, Google
expires refresh tokens after **7 days**. The app handles this correctly — the
silent refresh fails, and Calendar settings shows "Re-authorize", which now
works on native — but it means roughly a weekly re-consent tap.

To stop that, set the consent screen's publishing status to **In production**.
With sensitive scopes and no verification the consent screen shows an
"unverified app" warning that you click through (Advanced → Go to Centerpost),
and there is a 100-user cap — both fine for a personal/small install, and
refresh tokens then stop expiring on a timer.

## How it fits together

- `public/config.js` — `GOOGLE_IOS_CLIENT_ID`, empty until step 7.
- `public/legacy.js` — the NATIVE AUTH BRIDGE block; `gcalConnect`,
  `_gcalEnsureToken` and `gcalDisconnect` branch to it when the WebView bridge
  is present. Everything downstream (`_gcalFetch`, push, pull) is untouched:
  googleapis.com echoes `capacitor://localhost` back in
  `Access-Control-Allow-Origin`, so the calendar calls themselves were never
  the problem.
- `ios/App/App/GoogleAuthBridge.swift` — the flow, plus the refresh token in the
  Keychain. Scopes are pinned there, not passed from JS; keep them in sync with
  `GOOGLE_SCOPES` in legacy.js.

Native ends up slightly better than web here: the web build's token is a
memory-only variable, so centerpost.app asks for consent again after every
reload. Native's refresh token survives in the Keychain.
