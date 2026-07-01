import { useState, useEffect, useCallback, useRef } from 'react';

function getState() {
  return window.state || { projects: [], tasks: [], notes: [], reminders: [], completedTasks: [] };
}

function save() {
  if (typeof window.save === 'function') window.save();
}

function syncLegacy() {
  if (typeof window.renderProjects === 'function') window.renderProjects();
  if (typeof window.renderTaskList === 'function') window.renderTaskList();
  if (typeof window.renderNotes === 'function') window.renderNotes();
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(m)}/${parseInt(day)}/${y.slice(2)}`;
}

function fmtTimeEst(t) {
  if (!t) return '';
  const m = parseInt(t);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

function priorityColor(p) {
  return { high: 'var(--red)', med: 'var(--accent)', low: 'var(--text-faint)' }[p] || 'var(--accent)';
}

function priorityLabel(p) {
  return { high: 'High', med: 'Med', low: 'Low' }[p] || 'Med';
}

function getAllTasks(pid) {
  const s = getState();
  const project = (s.projects || []).find(p => p.id === pid);
  const subtasks = (project?.subtasks || []).map(st => ({ ...st, _source: 'subtask', _pid: pid }));
  const linked = (s.tasks || []).filter(t => (t.projectIds && t.projectIds.includes(pid)) || t.projectId === pid)
    .map(t => ({ ...t, _source: 'task' }));
  return [...subtasks, ...linked];
}

function getLinkedNotes(pid) {
  const s = getState();
  return (s.notes || []).filter(n => (n.projectIds && n.projectIds.includes(pid)) || n.projectId === pid);
}

function getLinkedReminders(pid) {
  const s = getState();
  return (s.reminders || []).filter(r => (r.projectIds && r.projectIds.includes(pid)) || r.projectId === pid);
}

function sortNotesByDate(notes) {
  return [...notes].sort((a, b) => {
    const da = a.created || a.updated || a.date || '';
    const db = b.created || b.updated || b.date || '';
    return db.localeCompare(da);
  });
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function findScheduledBlock(itemId) {
  const s = getState();
  return (s.tlBlocks || []).find(b => b.linkedId === itemId);
}

function scheduleTask(t, day, time, duration) {
  const s = getState();
  if (!s.tlBlocks) s.tlBlocks = [];
  const dateStr = day === 'tomorrow' ? tomorrowStr() : todayStr();
  const dur = duration || parseInt(t.timeEst) || 60;
  s.tlBlocks.push({
    id: 'tlb' + Date.now() + Math.random().toString(36).slice(2),
    name: t.name,
    date: dateStr,
    time: time,
    duration: String(Math.min(dur, 720)),
    projectId: t._pid || '',
    projectIds: [],
    priority: t.priority || 'med',
    linkedType: t._source === 'subtask' ? 'subtask' : 'task',
    linkedId: t.id,
  });
  save();
  if (typeof window.renderTimeline === 'function') window.renderTimeline();
  if (typeof window.updateDayProgress === 'function') window.updateDayProgress();
  syncLegacy();
}

function unscheduleTask(itemId) {
  const s = getState();
  s.tlBlocks = (s.tlBlocks || []).filter(b => b.id !== itemId && b.linkedId !== itemId);
  save();
  if (typeof window.renderTimeline === 'function') window.renderTimeline();
  if (typeof window.updateDayProgress === 'function') window.updateDayProgress();
  syncLegacy();
}

function fmtTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function sanitizeNoteHtml(html) {
  if (typeof window._sanitizeNoteHtml === 'function') return window._sanitizeNoteHtml(html);
  return html;
}

function stripHtml(html) {
  if (typeof window._stripHtml === 'function') return window._stripHtml(html);
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

function RichEditor({ editorRef, placeholder }) {
  const id = useRef('pd-note-' + Math.random().toString(36).slice(2)).current;

  const fmt = (kind) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    if (kind === 'bold') document.execCommand('bold');
    else if (kind === 'italic') document.execCommand('italic');
    else if (kind === 'header') {
      const blk = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      document.execCommand('formatBlock', false, (blk === 'h3' || blk === '<h3>') ? 'div' : 'h3');
    } else if (kind === 'bullet') document.execCommand('insertUnorderedList');
    else if (kind === 'highlight') {
      const cur = document.queryCommandValue('backColor');
      const isHighlighted = cur && cur !== 'rgba(0, 0, 0, 0)' && cur !== 'transparent' && cur !== '';
      document.execCommand('hiliteColor', false, isHighlighted ? 'transparent' : '#ffe066');
    } else if (kind === 'link') {
      const sel = window.getSelection();
      let savedRange = null;
      if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
      const url = prompt('Link URL (https://...)', 'https://');
      ed.focus();
      if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
      if (url && /^https?:\/\//i.test(url)) document.execCommand('createLink', false, url);
    }
  };

  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 28, height: 26, padding: '0 7px',
    fontSize: 12, fontFamily: 'inherit',
    color: 'var(--text-dim)', background: 'var(--surface-raised)',
    border: '1px solid var(--border)', borderRadius: 6,
    cursor: 'pointer',
  };

  return (
    <div>
      <div ref={editorRef}
        contentEditable
        data-placeholder={placeholder || 'Write a note...'}
        className="note-editable"
        onKeyDown={e => {
          if (e.key === 'Enter' && e.metaKey) {
            e.preventDefault();
            editorRef.current?.closest?.('[data-note-form]')?.querySelector?.('[data-add-note]')?.click();
          }
        }}
        style={{
          minHeight: 100, maxHeight: 280, overflowY: 'auto',
          width: '100%', background: 'var(--surface-raised)',
          border: '1px solid var(--border)', borderRadius: 8,
          padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
          color: 'var(--text)', lineHeight: 1.6, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
        <button type="button" style={btnStyle} title="Bold" onMouseDown={e => e.preventDefault()} onClick={() => fmt('bold')}><b>B</b></button>
        <button type="button" style={btnStyle} title="Italic" onMouseDown={e => e.preventDefault()} onClick={() => fmt('italic')}><i>I</i></button>
        <button type="button" style={btnStyle} title="Header" onMouseDown={e => e.preventDefault()} onClick={() => fmt('header')}>H</button>
        <button type="button" style={btnStyle} title="Bullet list" onMouseDown={e => e.preventDefault()} onClick={() => fmt('bullet')}>&bull;</button>
        <button type="button" style={btnStyle} title="Highlight" onMouseDown={e => e.preventDefault()} onClick={() => fmt('highlight')}>
          <span style={{ background: '#ffe066', color: '#333', padding: '0 3px', borderRadius: 2, fontSize: 11, fontWeight: 700 }}>A</span>
        </button>
        <button type="button" style={btnStyle} title="Link" onMouseDown={e => e.preventDefault()} onClick={() => fmt('link')}>&#128279;</button>
      </div>
    </div>
  );
}

function ProjectDropdown({ projects, selectedId, onSelect, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDue, setNewDue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const selected = projects.find(p => p.id === selectedId);

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600,
        color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6,
        padding: '2px 4px',
      }}>
        <i className="ti ti-folder" style={{ color: 'var(--accent)', fontSize: 16 }} />
        {selected ? selected.name : 'Projects'}
        <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 14, color: 'var(--text-dim)' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          marginTop: 4, minWidth: 260,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 6px' }}>
            {sorted.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '12px 8px', textAlign: 'center' }}>
                No projects yet
              </div>
            )}
            {sorted.map(p => {
              const pTasks = getAllTasks(p.id);
              const done = pTasks.filter(t => t.done).length;
              const total = pTasks.length;
              const isActive = p.id === selectedId;
              return (
                <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); setShowAdd(false); }} style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                  width: '100%', textAlign: 'left',
                  padding: '9px 10px', marginBottom: 2,
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  border: isActive ? '1px solid var(--accent-dim)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  color: isActive ? 'var(--accent)' : 'var(--text)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 8 }}>
                    {total > 0 && <span>{done}/{total}</span>}
                    {p.due && <span>{fmtDate(p.due)}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border)' }}>
            {!showAdd ? (
              <button onClick={() => setShowAdd(true)} style={{
                width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 600,
                background: 'transparent', border: 'none',
                color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <i className="ti ti-plus" style={{ fontSize: 14 }} /> Add New
              </button>
            ) : (
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <input type="text" value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim()) {
                      onAddNew(newName.trim(), newDue);
                      setNewName(''); setNewDue(''); setShowAdd(false); setOpen(false);
                    }
                  }}
                  autoFocus
                  placeholder="Project name..."
                  style={inputStyle({})} />
                <div style={{ display: 'flex', gap: 5 }}>
                  <input type="date" value={newDue}
                    onChange={e => setNewDue(e.target.value)}
                    style={inputStyle({ flex: 1, fontSize: 11 })} />
                  <button onClick={() => {
                    if (newName.trim()) {
                      onAddNew(newName.trim(), newDue);
                      setNewName(''); setNewDue(''); setShowAdd(false); setOpen(false);
                    }
                  }} style={addBtnStyle}>+</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const BANNER_HOUR_MARKERS = [
  { pct: '6.67%', label: '6a' }, { pct: '13.33%', label: '7a' },
  { pct: '20%', label: '8a' }, { pct: '26.67%', label: '9a' },
  { pct: '33.33%', label: '10a' }, { pct: '40%', label: '11a' },
  { pct: '46.67%', label: '12p' }, { pct: '53.33%', label: '1p' },
  { pct: '60%', label: '2p' }, { pct: '66.67%', label: '3p' },
  { pct: '73.33%', label: '4p' }, { pct: '80%', label: '5p' },
  { pct: '86.67%', label: '6p' }, { pct: '93.33%', label: '7p' },
];

const BLOCK_PALETTE = ['#5b8ce8','#7fb3a0','#e88c6a','#c77dba','#a0a0aa','#9e7bff','#5be8ff','#ff6b9d'];

function tlProjectColor(projectId) {
  if (!projectId) return null;
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0;
  return Math.abs(hash) % 8;
}

function tlParseTime(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':');
  return parseInt(h) * 60 + parseInt(m);
}

function collectTodayBlocks() {
  const s = getState();
  const today = todayStr();
  const blocks = [];
  (s.tlBlocks || []).forEach(b => {
    if (b.date === today) {
      const startMin = tlParseTime(b.time);
      if (startMin == null) return;
      blocks.push({
        id: b.id, name: b.name, startMin, durMin: parseInt(b.duration || 60),
        projectId: b.projectId || '',
      });
    }
  });
  return blocks;
}

function useClock() {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const update = () => {
      setClock(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return { clock };
}

function ProjectBanner({ tick }) {
  const [elapsed, setElapsed] = useState(0);
  const [nowPct, setNowPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const pct = Math.max(0, Math.min(100, ((mins - 300) / 900) * 100));
      setElapsed(pct);
      setNowPct(pct);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  const blocks = collectTodayBlocks();
  const BANNER_START = 300, BANNER_RANGE = 900;

  return (
    <div className="day-progress-bar" style={{ height: 64, borderRadius: 10 }}>
      <div className="day-progress-elapsed" style={{ width: `${elapsed}%` }} />
      <span className="day-progress-edge-label start">5a</span>
      <span className="day-progress-edge-label end">8p</span>
      {BANNER_HOUR_MARKERS.map(({ pct, label }) => (
        <div key={label} className="day-progress-marker" style={{ left: pct }}>
          <span className="day-progress-marker-label">{label}</span>
        </div>
      ))}
      <div className="day-progress-now" style={{ left: `${nowPct}%` }} />
      <div className="header-title-on-bar">Centerpost</div>
      <div className="header-subtitle">
        <span className="hs-prod">Productivity</span>
        <span className="hs-dash">&nbsp;Dashboard</span>
      </div>
      {blocks.length > 0 && (
        <div className="day-progress-bar-blocks">
          {blocks.map(b => {
            const endMin = b.startMin + b.durMin;
            if (endMin <= BANNER_START || b.startMin >= BANNER_START + BANNER_RANGE) return null;
            const clippedStart = Math.max(b.startMin, BANNER_START);
            const clippedEnd = Math.min(endMin, BANNER_START + BANNER_RANGE);
            const leftPct = ((clippedStart - BANNER_START) / BANNER_RANGE) * 100;
            const widthPct = ((clippedEnd - clippedStart) / BANNER_RANGE) * 100;
            const colorIdx = tlProjectColor(b.projectId);
            const color = colorIdx == null ? 'rgba(255,255,255,0.4)' : BLOCK_PALETTE[colorIdx];
            return (
              <div key={b.id} className="dpb-block" style={{
                left: `${leftPct}%`, width: `${widthPct}%`, background: color,
              }} title={b.name} />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProjectDashboard({ open, onClose }) {
  const [selectedId, setSelectedId] = useState(null);
  const [tick, setTick] = useState(0);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPri, setNewTaskPri] = useState('med');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newNoteName, setNewNoteName] = useState('');
  const [scheduleFor, setScheduleFor] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const taskInputRef = useRef(null);
  const noteEditorRef = useRef(null);
  const { clock } = useClock();

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    window.addEventListener('centerpost-state-change', refresh);
    return () => window.removeEventListener('centerpost-state-change', refresh);
  }, [refresh]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (open && typeof window._logLocalUsage === 'function') window._logLocalUsage('panel:projects');
  }, [open]);

  if (!open) return null;

  const s = getState();
  const projects = s.projects || [];
  const selected = projects.find(p => p.id === selectedId);
  const allTasks = selected ? getAllTasks(selectedId) : [];
  const allNotes = selected ? sortNotesByDate(getLinkedNotes(selectedId)) : [];
  const reminders = selected ? getLinkedReminders(selectedId) : [];
  const today = todayStr();

  const priRank = { high: 0, med: 1, low: 2 };
  const sortedTasks = [...allTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aHasDue = !!a.due, bHasDue = !!b.due;
    if (aHasDue && bHasDue) {
      const dc = a.due.localeCompare(b.due);
      if (dc !== 0) return dc;
      return (priRank[a.priority] ?? 1) - (priRank[b.priority] ?? 1);
    }
    if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
    return (priRank[a.priority] ?? 1) - (priRank[b.priority] ?? 1);
  });

  const doneCount = allTasks.filter(t => t.done).length;
  const totalCount = allTasks.length;

  const addProject = (name, due) => {
    const newId = 'p' + Date.now();
    s.projects.push({ id: newId, name, due: due || '', expanded: true, subtasks: [] });
    setSelectedId(newId);
    save(); refresh(); syncLegacy();
  };

  const addTask = () => {
    if (!selected || !newTaskName.trim()) return;
    if (!s.tasks) s.tasks = [];
    s.tasks.push({
      id: 'tl' + Date.now(), name: newTaskName.trim(), due: newTaskDue,
      priority: newTaskPri, timeEst: newTaskTime, done: false, projectIds: [selectedId],
    });
    setNewTaskName('');
    setNewTaskDue('');
    setNewTaskPri('med');
    setNewTaskTime('');
    save(); refresh(); syncLegacy();
    taskInputRef.current?.focus();
  };

  const toggleTask = (t) => {
    if (t._source === 'subtask') {
      const proj = s.projects.find(p => p.id === t._pid);
      const st = proj?.subtasks.find(st => st.id === t.id);
      if (st) st.done = !st.done;
    } else {
      const task = (s.tasks || []).find(x => x.id === t.id);
      if (task) task.done = !task.done;
    }
    save(); refresh(); syncLegacy();
  };

  const deleteTask = (t) => {
    if (t._source === 'subtask') {
      const proj = s.projects.find(p => p.id === t._pid);
      if (proj) proj.subtasks = proj.subtasks.filter(st => st.id !== t.id);
    } else {
      s.tasks = (s.tasks || []).filter(x => x.id !== t.id);
    }
    save(); refresh(); syncLegacy();
  };

  const cyclePriority = (t) => {
    const cycle = { low: 'med', med: 'high', high: 'low' };
    if (t._source === 'subtask') {
      const proj = s.projects.find(p => p.id === t._pid);
      const st = proj?.subtasks.find(st => st.id === t.id);
      if (st) st.priority = cycle[st.priority || 'med'] || 'med';
    } else {
      const task = (s.tasks || []).find(x => x.id === t.id);
      if (task) task.priority = cycle[task.priority || 'med'] || 'med';
    }
    save(); refresh(); syncLegacy();
  };

  const addNote = () => {
    const ed = noteEditorRef.current;
    const bodyHtml = ed ? sanitizeNoteHtml(ed.innerHTML) : '';
    const bodyText = stripHtml(bodyHtml);
    if (!selected || (!newNoteName.trim() && !bodyText.trim())) return;
    if (!s.notes) s.notes = [];
    const now = new Date();
    s.notes.push({
      id: 'n' + Date.now(),
      label: newNoteName.trim() || 'Note',
      body: bodyHtml,
      rich: true,
      projectIds: [selectedId],
      date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      created: now.toISOString(),
      updated: now.toISOString(),
    });
    setNewNoteName('');
    if (ed) ed.innerHTML = '';
    save(); refresh(); syncLegacy();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      color: 'var(--text)',
    }}>
      {/* Header with banner */}
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Banner + clock row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 20px 6px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ProjectBanner tick={tick} />
          </div>
          <div className="header-right" style={{ flexShrink: 0 }}>
            <div className="header-timer-outer">
              <span className="header-timer-label-tag">Timer</span>
              <div className="header-timer-wrap">
                <button className="header-timer-btn"
                  onClick={() => { if (typeof window.headerTimerClick === 'function') window.headerTimerClick(); }}
                  title="Focus timer">
                  <span className="header-timer-label" id="pdHeaderTimerLabel">{clock}</span>
                </button>
                <button className="header-timer-arrow"
                  onClick={() => { if (typeof window.headerTimerToggleDropdown === 'function') window.headerTimerToggleDropdown('pd'); }}
                  title="Pick duration">▾</button>
                <div className="header-timer-dropdown" id="pdHeaderTimerDropdown" style={{ display: 'none' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Nav row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '4px 20px 8px',
        }}>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-dim)', cursor: 'pointer', padding: '6px 14px', fontSize: 13,
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>←</span> Dashboard
          </button>

          <ProjectDropdown
            projects={projects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddNew={addProject}
          />

          {selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <button onClick={() => {
                const name = prompt('Rename project:', selected.name);
                if (name && name.trim()) {
                  selected.name = name.trim(); save(); refresh(); syncLegacy();
                }
              }} style={{
                background: 'none', border: 'none', color: 'var(--text-faint)',
                cursor: 'pointer', fontSize: 13, padding: 4, flexShrink: 0,
              }} title="Rename">
                <i className="ti ti-pencil" />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {doneCount}/{totalCount} tasks
                {selected.due ? ` · Due ${fmtDate(selected.due)}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2-column body */}
      <div className="pd-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>
            <div style={{ textAlign: 'center' }}>
              <i className="ti ti-folder-open" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 15 }}>Select a project from the dropdown above</div>
            </div>
          </div>
        ) : (
          <>
            {/* Column 1: Tasks (~37%) */}
            <div className="pd-col-tasks" style={{
              flex: '0 0 37%', minWidth: 0,
              borderRight: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <i className="ti ti-checkbox" style={{ color: 'var(--accent)', fontSize: 15 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Tasks</span>
                {totalCount > 0 && <CountBadge>{doneCount}/{totalCount}</CountBadge>}
                {totalCount > 0 && (
                  <div style={{
                    flex: 1, height: 3, borderRadius: 2, marginLeft: 8,
                    background: 'var(--surface-raised)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${(doneCount / totalCount) * 100}%`,
                      background: doneCount === totalCount ? 'var(--green)' : 'var(--accent)',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {sortedTasks.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '20px 0', textAlign: 'center' }}>
                    No tasks yet
                  </div>
                )}
                {sortedTasks.map(t => {
                  const scheduled = findScheduledBlock(t.id);
                  return (
                    <div key={t.id} style={{
                      position: 'relative',
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', marginBottom: 2,
                      background: t.done ? 'transparent' : 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <Checkbox checked={t.done} onChange={() => toggleTask(t)} />
                      <PriorityDot priority={t.priority} onClick={() => cyclePriority(t)} />
                      <span style={{
                        flex: 1, fontSize: 13, minWidth: 0,
                        textDecoration: t.done ? 'line-through' : 'none',
                        opacity: t.done ? 0.5 : 1,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{t.name}</span>
                      {t.timeEst && <Badge>{fmtTimeEst(t.timeEst)}</Badge>}
                      {t.due && <DateBadge date={t.due} today={today} />}
                      <ScheduleBtn
                        scheduled={scheduled}
                        onClick={() => {
                          if (scheduled) {
                            unscheduleTask(t.id);
                            refresh();
                          } else {
                            setScheduleFor(scheduleFor?.id === t.id ? null : t);
                          }
                        }}
                      />
                      <DeleteBtn onClick={() => deleteTask(t)} />
                      {scheduleFor?.id === t.id && (
                        <SchedulePopover
                          task={t}
                          onSchedule={(day, time, dur) => {
                            scheduleTask(t, day, time, dur);
                            setScheduleFor(null);
                            refresh();
                          }}
                          onClose={() => setScheduleFor(null)}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Reminders */}
                {reminders.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: 1, color: 'var(--text-dim)', marginBottom: 6,
                    }}>Reminders</div>
                    {reminders.map(r => (
                      <div key={r.id} style={{
                        padding: '6px 10px', marginBottom: 2,
                        background: 'var(--surface-raised)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                      }}>
                        <i className="ti ti-bell" style={{ color: 'var(--purple)', fontSize: 13 }} />
                        <span style={{ flex: 1 }}>{r.text}</span>
                        {r.date && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmtDate(r.date)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add task */}
              <div style={{
                borderTop: '1px solid var(--border)', padding: '8px 12px',
                display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                <input ref={taskInputRef} type="text" value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="Add task..."
                  style={inputStyle({})} />
                <div style={{ display: 'flex', gap: 5 }}>
                  <select value={newTaskPri} onChange={e => setNewTaskPri(e.target.value)} style={selectStyle}>
                    <option value="low">Low</option>
                    <option value="med">Med</option>
                    <option value="high">High</option>
                  </select>
                  <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                    style={inputStyle({ flex: 1, fontSize: 11 })} />
                  <input type="text" value={newTaskTime} onChange={e => setNewTaskTime(e.target.value)}
                    placeholder="Time" style={inputStyle({ width: 55, fontSize: 11 })} />
                  <button onClick={addTask} style={addBtnStyle}>+ Add</button>
                </div>
              </div>
            </div>

            {/* Column 2: Notes (remaining ~63%) */}
            <div className="pd-col-notes" style={{
              flex: '1 1 0', minWidth: 0,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <i className="ti ti-notebook" style={{ color: 'var(--blue)', fontSize: 15 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Notes</span>
                {allNotes.length > 0 && <CountBadge>{allNotes.length}</CountBadge>}
              </div>

              {/* Note entry with RTF editor */}
              <div data-note-form style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <input type="text" value={newNoteName}
                  onChange={e => setNewNoteName(e.target.value)}
                  placeholder="Title..."
                  style={inputStyle({ fontSize: 13, fontWeight: 600 })} />
                <RichEditor editorRef={noteEditorRef} placeholder="Write a note... (⌘ Enter to save)" />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button data-add-note onClick={addNote} style={addBtnStyle}>+ Add Note</button>
                </div>
              </div>

              {/* Existing notes */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {allNotes.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '20px 0', textAlign: 'center' }}>
                    No notes yet
                  </div>
                )}
                {allNotes.map(n => {
                  const isOpen = expandedNotes.has(n.id);
                  return (
                    <div key={n.id} style={{
                      marginBottom: 6,
                      background: 'var(--surface-raised)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    }}>
                      <div
                        onClick={() => setExpandedNotes(prev => {
                          const next = new Set(prev);
                          next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                          return next;
                        })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', cursor: 'pointer', userSelect: 'none',
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', width: 12, textAlign: 'center' }}>
                          {isOpen ? '▾' : '▸'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {n.label || 'Note'}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
                          {n.date && fmtDate(n.date)}{n.time ? ` · ${n.time}` : ''}
                        </span>
                      </div>
                      {isOpen && n.body && (
                        <div className="note-editable" style={{
                          fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6,
                          wordBreak: 'break-word', border: 'none', padding: '0 14px 10px 32px',
                          minHeight: 'auto', background: 'transparent',
                        }}
                        dangerouslySetInnerHTML={
                          n.body.includes('<') ? { __html: n.body } : undefined
                        }
                        children={n.body.includes('<') ? undefined : n.body}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{
      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
      border: checked ? 'none' : '2px solid var(--border-focus)',
      background: checked ? 'var(--green)' : 'transparent',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>
      {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
    </div>
  );
}

function PriorityDot({ priority, onClick }) {
  return (
    <div onClick={e => { e.stopPropagation(); onClick(); }} style={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: priorityColor(priority),
      cursor: 'pointer',
    }} title={`Priority: ${priorityLabel(priority)}`} />
  );
}

function DateBadge({ date, today }) {
  const isPast = date < today;
  const isToday = date === today;
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3,
      background: isPast ? 'var(--red-dim)' : isToday ? 'var(--accent-glow)' : 'var(--surface)',
      color: isPast ? 'var(--red)' : isToday ? 'var(--accent)' : 'var(--text-dim)',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {fmtDate(date)}
    </span>
  );
}

function Badge({ children }) {
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3,
      background: 'var(--surface)', color: 'var(--text-dim)', fontWeight: 600,
    }}>{children}</span>
  );
}

function CountBadge({ children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
      background: 'var(--surface-raised)', padding: '1px 8px', borderRadius: 10,
    }}>{children}</span>
  );
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} style={{
      background: 'none', border: 'none', color: 'var(--text-faint)',
      cursor: 'pointer', fontSize: 11, padding: '1px 4px',
      borderRadius: 3, lineHeight: 1, opacity: 0.6,
    }} title="Delete">✕</button>
  );
}

const inputStyle = (extra) => ({
  padding: '7px 10px', fontSize: 12,
  background: 'var(--surface-raised)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
  fontFamily: 'inherit', outline: 'none', width: '100%',
  boxSizing: 'border-box',
  ...extra,
});

const selectStyle = {
  fontSize: 11, padding: '5px 6px',
  background: 'var(--surface-raised)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)',
  fontFamily: 'inherit',
};

const addBtnStyle = {
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  background: 'var(--accent)', color: 'var(--bg)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
};

function ScheduleBtn({ scheduled, onClick }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} style={{
      background: 'none', border: 'none',
      color: scheduled ? 'var(--teal)' : 'var(--text-faint)',
      cursor: 'pointer', fontSize: 14, padding: '1px 3px',
      borderRadius: 3, lineHeight: 1, opacity: scheduled ? 1 : 0.5,
      display: 'flex', alignItems: 'center',
    }} title={scheduled ? `Scheduled ${fmtTime12(scheduled.time)} — click to unschedule` : 'Schedule to timeline'}>
      <i className={scheduled ? 'ti ti-calendar-check' : 'ti ti-calendar-plus'} />
    </button>
  );
}

function SchedulePopover({ task, onSchedule, onClose }) {
  const [day, setDay] = useState('today');
  const defaultDur = parseInt(task.timeEst) || 60;
  const [duration, setDuration] = useState(String(defaultDur));
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const defaultTime = `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`;
  const [time, setTime] = useState(defaultTime);
  const popRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const durOptions = [
    { label: '15m', value: '15' },
    { label: '30m', value: '30' },
    { label: '1h', value: '60' },
    { label: '1.5h', value: '90' },
    { label: '2h', value: '120' },
    { label: '3h', value: '180' },
  ];

  return (
    <div ref={popRef} onClick={e => e.stopPropagation()} style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 50,
      marginTop: 4,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
      padding: '12px 14px', width: 240,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
        Schedule to Timeline
      </div>

      {/* Day toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {['today', 'tomorrow'].map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontFamily: 'inherit', border: '1px solid',
            background: day === d ? 'rgba(91,232,255,0.15)' : 'var(--surface-raised)',
            borderColor: day === d ? 'rgba(91,232,255,0.3)' : 'var(--border)',
            color: day === d ? '#5be8ff' : 'var(--text-dim)',
          }}>
            {d === 'today' ? 'Today' : 'Tomorrow'}
          </button>
        ))}
      </div>

      {/* Time */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
          Time
        </label>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{
          ...inputStyle({}), width: '100%', fontSize: 13,
        }} />
      </div>

      {/* Duration */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
          Duration
        </label>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {durOptions.map(o => (
            <button key={o.value} onClick={() => setDuration(o.value)} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontFamily: 'inherit', border: '1px solid',
              background: duration === o.value ? 'var(--accent-glow)' : 'var(--surface-raised)',
              borderColor: duration === o.value ? 'var(--accent-dim)' : 'var(--border)',
              color: duration === o.value ? 'var(--accent)' : 'var(--text-dim)',
            }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSchedule(day, time, parseInt(duration))} style={{
          flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700,
          background: 'rgba(91,232,255,0.15)', color: '#5be8ff',
          border: '1px solid rgba(91,232,255,0.3)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Schedule
        </button>
        <button onClick={onClose} style={{
          padding: '7px 12px', fontSize: 12,
          background: 'var(--surface-raised)', color: 'var(--text-dim)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
