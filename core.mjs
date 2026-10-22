// Shared, DOM-independent task, backup and focus rules.
export const VERSION = 1;
export const DAY = 86400000;
const OFFSET = 8 * 3600000;
export const COLORS = ['#356A51', '#7194BB', '#C59658', '#A685AF', '#CF8C91', '#6DADA4'];
export const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
export const clone = value => JSON.parse(JSON.stringify(value));
export const bjDate = (at = Date.now()) => new Date(at + OFFSET).toISOString().slice(0, 10);
export const bjTime = (at = Date.now()) => new Date(at + OFFSET).toISOString().slice(11, 19);
export const dayStart = (at = Date.now()) => Math.floor((at + OFFSET - 4 * 3600000) / DAY) * DAY - OFFSET + 4 * 3600000;
export const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
export const weekday = date => (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
export const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
export const validColor = color => /^#[\da-f]{6}$/i.test(color || '');
export function countdown(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return (s >= 3600 ? String(Math.floor(s / 3600)).padStart(2, '0') + ':' : '') + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
export function duration(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return s >= 3600 ? `${Math.floor(s / 3600)}小时 ${Math.floor(s % 3600 / 60)}分` : s >= 60 ? `${Math.floor(s / 60)}分 ${s % 60}秒` : `${s}秒`;
}
export function newTask(date = bjDate(), goalId = '') {
  return {id: uid(), title: '', notes: '', date, time: '', priority: 1, done: false, repeat: '不重复', series: '', autoParent: '', reminder: false, reminded: false, example: false, goalId, completedAt: 0};
}
export function fresh(at = Date.now()) {
  const p = {id: uid(), name: '日常专注', color: COLORS[0], goalId: ''};
  const example = {...newTask(bjDate(at)), title: '示例：安排今天最重要的一件事', notes: '点击正文编辑；勾选左侧方框完成。也可以在设置中清除这条例子。', example: true};
  return {format: 'shiri-web', version: VERSION, tasks: [example], goals: [], focus: {focusMinutes: 25, breakMinutes: 5, selectedId: p.id, projects: [p], segments: [], session: null}, settings: {petEnabled: true, petMotion: true, sidebarOpen: true}, updatedAt: at};
}
export function toggleTask(state, id, at = Date.now()) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done; task.completedAt = task.done ? at : 0;
  if (!task.done) {state.tasks = state.tasks.filter(t => t.autoParent !== task.id || t.done); return;}
  if (task.repeat === '不重复') return;
  task.series ||= uid();
  const date = addDays(task.date, task.repeat === '每天' ? 1 : 7);
  if (!state.tasks.some(t => t.series === task.series && t.date === date)) state.tasks.push({...task, id: uid(), date, autoParent: task.id, done: false, completedAt: 0, reminded: false});
}
export const currentProject = state => state.focus.projects.find(p => p.id === state.focus.selectedId);
function preparePending(state){
  const s=state.focus.session;
  if(s?.phase==='focus'&&!s.pending){
    s.pending=state.focus.segments.filter(p=>p.sessionId===s.id);
    state.focus.segments=state.focus.segments.filter(p=>p.sessionId!==s.id);
  }
}
export function createSession(state) {
  const f = state.focus;
  return {id: uid(), phase: 'focus', running: false, remaining: f.focusMinutes * 60000, deadline: 0, activeFrom: 0, projectId: f.selectedId, goalId: currentProject(state)?.goalId || ''};
}
export const remaining = (state, at = Date.now()) => {
  const s = state.focus.session;
  return s ? Math.max(0, s.running ? s.deadline - at : s.remaining) : state.focus.focusMinutes * 60000;
};
export function capture(state, at) {
  const s = state.focus.session;
  if (!s?.running || s.phase !== 'focus') return;
  preparePending(state);
  const end = Math.min(at, s.deadline);
  if (end <= s.activeFrom) return;
  // Keep an unfinished round with its timer. Only reconcile publishes its segments.
  const segments = s.pending ||= [], last = segments.at(-1);
  if (last && last.sessionId === s.id && last.end === s.activeFrom && last.projectId === s.projectId && last.goalId === s.goalId) last.end = end;
  else segments.push({id: uid(), sessionId: s.id, projectId: s.projectId, goalId: s.goalId || '', start: s.activeFrom, end});
  s.activeFrom = end;
}
export function reconcile(state, at = Date.now()) {
  const s = state.focus.session;
  if (!s?.running || at < s.deadline) return '';
  const ended = s.deadline;
  if (s.phase === 'focus') {
    capture(state, ended);
    state.focus.segments.push(...(s.pending || []));
    s.pending = [];
    s.phase = 'break'; s.remaining = state.focus.breakMinutes * 60000; s.deadline = ended + s.remaining; s.activeFrom = 0;
    if (at < s.deadline) return 'focus-finished';
  }
  state.focus.session = createSession(state);
  return s.phase === 'break' && ended < s.deadline ? 'both-finished' : 'break-finished';
}
export function toggleFocus(state, at = Date.now()) {
  reconcile(state, at);
  const s = state.focus.session ||= createSession(state);
  if (s.running) {capture(state, at); s.remaining = Math.max(0, s.deadline - at); s.running = false;}
  else {if (s.remaining <= 0) s.remaining = (s.phase === 'focus' ? state.focus.focusMinutes : state.focus.breakMinutes) * 60000; s.deadline = at + s.remaining; s.activeFrom = at; s.running = true;}
}
export function resetFocus(state, at = Date.now()) {preparePending(state);capture(state, at); state.focus.session = createSession(state);}
export function startBreak(state, at = Date.now()) {
  preparePending(state);
  capture(state, at);
  state.focus.session = {...createSession(state), phase: 'break', running: true, remaining: state.focus.breakMinutes * 60000, deadline: at + state.focus.breakMinutes * 60000, activeFrom: 0};
}
export function configureFocus(state, values, at = Date.now()) {
  const {focusMinutes, breakMinutes, name, color, goalId = ''} = values;
  if (!Number.isInteger(focusMinutes) || focusMinutes < 1 || focusMinutes > 360 || !Number.isInteger(breakMinutes) || breakMinutes < 1 || breakMinutes > 120 || !name?.trim() || name.trim().length > 120 || !validColor(color) || (goalId && !state.goals.some(g => g.id === goalId))) throw Error('请检查时长、任务名称、颜色及长期任务归属。');
  preparePending(state);capture(state, at);
  const f = state.focus;
  let p = f.projects.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
  if (!p) {p = {id: uid(), name: name.trim(), color, goalId}; f.projects.push(p);}
  else {p.color = color; p.goalId = goalId;}
  f.selectedId = p.id; f.focusMinutes = focusMinutes; f.breakMinutes = breakMinutes; f.session = createSession(state);
}
export function focusSegments(state, at = Date.now()) {
  const s=state.focus.session;
  return s?.phase==='focus'?state.focus.segments.filter(p=>p.sessionId!==s.id):state.focus.segments;
}
export function statistics(state, at = Date.now()) {
  const start = dayStart(at), end = start + DAY, sums = new Map();
  for (const s of focusSegments(state, at)) {
    const ms = Math.max(0, Math.min(s.end, end) - Math.max(s.start, start));
    if (ms) sums.set(s.projectId, (sums.get(s.projectId) || 0) + ms);
  }
  return state.focus.projects.map(p => ({...p, ms: sums.get(p.id) || 0})).filter(p => p.ms >= 1000).sort((a, b) => b.ms - a.ms);
}
export function goalEffort(state, id, at = Date.now()) {
  const tasks = state.tasks.filter(t => t.goalId === id), done = tasks.filter(t => t.done), segments = focusSegments(state, at).filter(s => s.goalId === id);
  return {tasks, done, days: new Set(done.map(t => t.completedAt ? bjDate(t.completedAt) : t.date)).size, ms: segments.reduce((n, s) => n + s.end - s.start, 0), segments};
}
const fail = message => {throw Error(message || '备份格式无效，原有数据未修改。');};
const bounded = (s, max, required = false) => typeof s === 'string' && s.length <= max && (!required || !!s.trim());
export function validate(state) {
  if (!state || state.format !== 'shiri-web' || state.version !== VERSION || !Array.isArray(state.tasks) || state.tasks.length > 20000 || !Array.isArray(state.goals) || state.goals.length > 5000) fail();
  const ids = new Set(), goalIds = new Set();
  for (const g of state.goals) {
    if (!g || !bounded(g.id, 200, true) || goalIds.has(g.id) || !bounded(g.title, 120, true) || !bounded(g.notes, 4000) || !validColor(g.color) || typeof g.done !== 'boolean' || !Number.isFinite(g.createdAt)) fail('长期任务数据无效。');
    goalIds.add(g.id);
  }
  for (const t of state.tasks) {
    if (!t || !bounded(t.id, 200, true) || ids.has(t.id) || !bounded(t.title, 120, true) || !bounded(t.notes, 4000) || !validDate(t.date) || (t.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) || ![0, 1, 2].includes(t.priority) || !['不重复', '每天', '每周'].includes(t.repeat) || typeof t.done !== 'boolean' || !bounded(t.goalId, 200) || (t.goalId && !goalIds.has(t.goalId)) || !Number.isFinite(t.completedAt) || !bounded(t.series, 200) || !bounded(t.autoParent, 200)) fail('日程包含无效的标题、日期、时间或归属。');
    ids.add(t.id);
  }
  const f = state.focus;
  if (!f || !Number.isInteger(f.focusMinutes) || f.focusMinutes < 1 || f.focusMinutes > 360 || !Number.isInteger(f.breakMinutes) || f.breakMinutes < 1 || f.breakMinutes > 120 || !Array.isArray(f.projects) || f.projects.length < 1 || f.projects.length > 5000 || !Array.isArray(f.segments) || f.segments.length > 200000) fail('专注数据无效。');
  const projects = new Set();
  for (const p of f.projects) {
    if (!p || !bounded(p.id, 200, true) || projects.has(p.id) || !bounded(p.name, 120, true) || !validColor(p.color) || !bounded(p.goalId, 200)) fail('专注任务数据无效。');
    projects.add(p.id);
  }
  if (!projects.has(f.selectedId)) fail('专注任务选择无效。');
  for (const s of f.segments) if (!s || !projects.has(s.projectId) || !bounded(s.goalId, 200) || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.start < -62135596800000 || s.end > 253402300799999 || s.start >= s.end) fail('专注时段无效。');
  if (!state.settings || typeof state.settings.petEnabled !== 'boolean' || typeof state.settings.petMotion !== 'boolean' || typeof state.settings.sidebarOpen !== 'boolean') fail('偏好设置无效。');
  const s = f.session;
  if(s?.pending && (!Array.isArray(s.pending)||s.pending.length>200000||s.pending.some(p=>!p||p.projectId!==s.projectId||!bounded(p.goalId,200)||!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start>=p.end)))fail('待完成的专注时段无效。');
  if (s && (!['focus', 'break'].includes(s.phase) || typeof s.running !== 'boolean' || !projects.has(s.projectId) || !bounded(s.id, 200, true) || !bounded(s.goalId, 200) || !Number.isFinite(s.remaining) || s.remaining < 0 || s.remaining > 360 * 60000 || !Number.isFinite(s.deadline) || !Number.isFinite(s.activeFrom) || (s.running && (s.deadline <= 0 || (s.phase === 'focus' && (s.activeFrom <= 0 || s.activeFrom > s.deadline)))))) fail('计时状态无效。');
  return state;
}
const fromTicks = ticks => ticks ? Number(ticks) / 10000 - 62135596800000 : 0;
export function parseBackup(text, at = Date.now()) {
  if (text.length > 200 * 1024 * 1024) fail('文件超过 200 MB，请分篇导出手记。');
  let raw; try {raw = JSON.parse(text);} catch {fail('文件不是有效的 JSON 备份。');}
  if (raw?.format === 'shiri-web') {
    const state = validate(raw); state.focus.session = null;
    return {type: 'web', state};
  }
  if (raw && [1, 2].includes(raw.Version) && Array.isArray(raw.Tasks)) {
    const state = fresh(at); state.tasks = []; state.goals = [];
    state.goals = (raw.Goals || []).map(g => ({id: g.Id, title: g.Title, notes: g.Notes || '', color: g.Color, createdAt: fromTicks(g.CreatedTicks), done: !!g.Done}));
    state.tasks = raw.Tasks.map(t => ({id: t.Id, title: t.Title, notes: t.Notes || '', date: t.Date, time: t.Time || '', priority: t.Priority, done: !!t.Done, repeat: t.Repeat || '不重复', series: t.Series || '', autoParent: t.AutoParent || '', reminder: !!t.Reminder, reminded: !!t.Reminded, example: !!t.IsExample, goalId: t.GoalId || '', completedAt: fromTicks(t.CompletedTicks)}));
    validate(state); return {type: 'tasks', state};
  }
  if (raw?.Version === 1 && Array.isArray(raw.Projects) && Array.isArray(raw.Segments)) {
    const state = fresh(at);
    state.focus = {focusMinutes: raw.FocusMinutes, breakMinutes: raw.BreakMinutes, selectedId: raw.SelectedId, projects: raw.Projects.map(p => ({id: p.Id, name: p.Name, color: p.Color, goalId: p.GoalId || ''})), segments: raw.Segments.map(s => ({id: `${s.ProjectId}-${s.StartTicks}`, sessionId: 'desktop', projectId: s.ProjectId, goalId: s.GoalId || '', start: fromTicks(s.StartTicks), end: fromTicks(s.EndTicks)})), session: null};
    validate(state); return {type: 'focus', state};
  }
  fail('请选择拾日网页版备份，或 Windows 版 tasks.json / focus.json。');
}
export function mergeBackup(current, imported) {
  const next = clone(current), incoming = imported.state;
  const addUnique = (target, source) => {const ids = new Set(target.map(x => x.id)); for (const x of source) if (!ids.has(x.id)) {target.push(clone(x)); ids.add(x.id);}};
  if (imported.type !== 'focus') {addUnique(next.goals, incoming.goals); addUnique(next.tasks, incoming.tasks);}
  if (imported.type !== 'tasks') {
    addUnique(next.focus.projects, incoming.focus.projects);
    const keys = new Set(next.focus.segments.map(s => [s.projectId, s.start, s.end, s.goalId].join('|')));
    for (const s of incoming.focus.segments) {const key = [s.projectId, s.start, s.end, s.goalId].join('|'); if (!keys.has(key)) {next.focus.segments.push(clone(s)); keys.add(key);}}
  }
  return validate(next);
}
export const POSES = {Curious: 3, Sulky: 27, Happy: 62};
export const PET_CHAIN = [0,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,63,64,65,66,67,68,69,70,1,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,2];
export const POSE_POSITIONS = {Curious: 0, Sulky: 33, Happy: PET_CHAIN.length - 1};
export function petMessage(lines, group, variation, tokens) {
  const candidates = lines.filter(l => l.Group === group);
  if (!candidates.length) throw Error('缺少大肥鱼台词：' + group);
  const line = candidates[Math.abs(variation) % candidates.length];
  return {...line, Text: line.Text.replace(/\{(context|effort|time|goal|remaining|next)\}/g, (_, key) => String(tokens[key] ?? ''))};
}
