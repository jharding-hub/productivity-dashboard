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
          title="Days you showed up and put in effort — any real action counts the day, however small. It only ever goes up; missing a day costs you nothing. Tap for detail."
          aria-label="Days shown up. Tap for detail."
          style={{ cursor: 'pointer' }}
        >
          <span className="points-tier-icon" id="ptTierIcon">{'🥉'}</span>
          <span className="points-value" id="ptValue">0</span>
          {/* Headline is DAYS SHOWN UP, not the point total -- see
              TIER_THRESHOLDS in legacy.js for the reasoning. */}
          <span className="points-label" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, fontSize: 9, opacity: 0.7, letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 600 }}>
            <span>Days</span>
            <span>shown up</span>
          </span>
          {/* Panel survey 2026-08-18 (I-4): the full two-line label above is
              hidden on mobile to save header space (F24), which left the
              compact badge reading as a bare medal+number -- three personas
              misread it as a streak or notification count on first glance.
              The tap-popup has carried a full explainer since 2026-08-04;
              this is a one-word visual hint that the number IS "days",
              costing a few px instead of the 69px the full label needed. */}
          <span className="points-label-compact">days</span>
        </div>
        <div className="points-popup" id="pointsPopup" style={{ display: 'none' }}></div>
      </div>

      {/* The floating +Presence container, the YouTube host, and the Music
          Streaming modal all moved OUT of this component into
          PointsMusicOverlays (mounted at .app-wrap level). They were trapped
          in .header's stacking context (sticky + z-index:50), so their own
          z-index never applied against panels/overlays. Only the badge above
          belongs in the header. */}
    </>
  );
}
