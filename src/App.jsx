import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './app.css';
import markup from './app-body.html?raw';
import DayTimelineBanner from './components/DayTimelineBanner';
import RoutinesPanel from './components/RoutinesPanel';
import WorkoutModal from './components/WorkoutModal';
import EnergyMoodModal from './components/EnergyMoodModal';
import GroundingToolkit from './components/GroundingToolkit';
import PointsFocusMusic from './components/PointsFocusMusic';
import PointsInsightsOverlay from './components/PointsInsightsOverlay';
import JournalOverlay from './components/JournalOverlay';
import AxisAssistant from './components/AxisAssistant';
import HaltModal from './components/HaltModal';
import UrgeLogModal from './components/UrgeLogModal';
import BreathworkOverlay from './components/BreathworkOverlay';
import CalendarSyncModal from './components/CalendarSyncModal';
import ToolKitPanel from './components/ToolKitPanel';
import LandingLogin from './components/LandingLogin';
import StatusBar from './components/StatusBar';
import ProjectDashboard from './components/ProjectDashboard';

let legacyLoaded = false;

export default function App() {
  const ref = useRef(null);
  const [mounts, setMounts] = useState({});
  const [projectDashboardOpen, setProjectDashboardOpen] = useState(false);

  useEffect(() => {
    if (!ref.current || legacyLoaded) return;
    legacyLoaded = true;
    ref.current.innerHTML = markup;

    setMounts({
      banner: document.getElementById('day-timeline-banner-root'),
      routines: document.getElementById('routines-panel-root'),
      workout: document.getElementById('workout-modal-root'),
      energyMood: document.getElementById('energy-mood-modal-root'),
      grounding: document.getElementById('grounding-toolkit-root'),
      pointsMusic: document.getElementById('points-focus-music-root'),
      pointsInsights: document.getElementById('points-insights-overlay-root'),
      journal: document.getElementById('journal-overlay-root'),
      axis: document.getElementById('axis-assistant-root'),
      halt: document.getElementById('halt-modal-root'),
      urge: document.getElementById('urge-modal-root'),
      breathwork: document.getElementById('breathwork-overlay-root'),
      calendarSync: document.getElementById('calendar-sync-modal-root'),
      toolkit: document.getElementById('toolkit-panel-root'),
      landingLogin: document.getElementById('landing-login-root'),
      statusBar: document.getElementById('status-bar-root'),
    });

    const script = document.createElement('script');
    script.src = '/legacy.js';
    script.onload = () => {
      const origOpen = window.openPanelOverlay;
      window.openPanelOverlay = function(panelKey) {
        if (panelKey === 'projects') {
          setProjectDashboardOpen(true);
          return;
        }
        if (origOpen) origOpen(panelKey);
      };
    };
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <div ref={ref} />
      {mounts.banner && createPortal(<DayTimelineBanner />, mounts.banner)}
      {mounts.routines && createPortal(<RoutinesPanel />, mounts.routines)}
      {mounts.workout && createPortal(<WorkoutModal />, mounts.workout)}
      {mounts.energyMood && createPortal(<EnergyMoodModal />, mounts.energyMood)}
      {mounts.grounding && createPortal(<GroundingToolkit />, mounts.grounding)}
      {mounts.pointsMusic && createPortal(<PointsFocusMusic />, mounts.pointsMusic)}
      {mounts.pointsInsights && createPortal(<PointsInsightsOverlay />, mounts.pointsInsights)}
      {mounts.journal && createPortal(<JournalOverlay />, mounts.journal)}
      {mounts.axis && createPortal(<AxisAssistant />, mounts.axis)}
      {mounts.halt && createPortal(<HaltModal />, mounts.halt)}
      {mounts.urge && createPortal(<UrgeLogModal />, mounts.urge)}
      {mounts.breathwork && createPortal(<BreathworkOverlay />, mounts.breathwork)}
      {mounts.calendarSync && createPortal(<CalendarSyncModal />, mounts.calendarSync)}
      {mounts.toolkit && createPortal(<ToolKitPanel />, mounts.toolkit)}
      {mounts.landingLogin && createPortal(<LandingLogin />, mounts.landingLogin)}
      {mounts.statusBar && createPortal(<StatusBar />, mounts.statusBar)}
      <ProjectDashboard
        open={projectDashboardOpen}
        onClose={() => setProjectDashboardOpen(false)}
      />
    </>
  );
}
