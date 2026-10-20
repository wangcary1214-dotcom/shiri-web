import {DAY, COLORS, uid, clone, bjDate, bjTime, dayStart, addDays, weekday, validDate, validColor, countdown, duration, newTask, fresh, toggleTask, currentProject, remaining, capture, reconcile, toggleFocus, resetFocus, startBreak, configureFocus, statistics, goalEffort, validate, parseBackup, mergeBackup, POSES, PET_CHAIN, POSE_POSITIONS, petMessage} from './core.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  plus:'M12 5v14M5 12h14', sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  flag:'M5 21V4m0 0c4-5 9 5 14 0v10c-5 5-10-5-14 0', chart:'M4 20h16M7 16v-5m5 5V5m5 11v-8',
  settings:'m10 3 4 0 .6 3 2 .9 2.7-1.1 2 3.4-2.2 2.1v2.2l2.2 2.1-2 3.4-2.7-1.1-2 .9-.6 3h-4l-.6-3-2-.9-2.7 1.1-2-3.4 2.2-2.1v-2.2L2.7 9.3l2-3.4L7.4 7l2-.9L10 3M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  search:'M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', timer:'M9 2h6m-3 0v3m6 1 2-2M12 9v5l3 2M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  calendar:'M8 2v4m8-4v4M4 10h16M5 4h14a1 1 0 0 1 1 1v15H4V5a1 1 0 0 1 1-1M8 14h2m4 0h2m-8 4h2',
  heart:'M12 20 3.5 11.5C-2 4.5 7 0 12 6c5-6 14-1.5 8.5 5.5L12 20', expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  reset:'M3 5v6h6M4 10a8 8 0 1 1 1 8', play:'m9 5 10 7-10 7V5', pause:'M8 5v14M16 5v14', check:'m5 12 4 4L19 6',
  clock:'M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', link:'m10 14 4-4m-6 5-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 0 2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0',
  download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4', upload:'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4', menu:'M4 6h16M4 12h16M4 18h16', panel:'M3 4h18v16H3V4m12 0v16', back:'m10 5-7 7 7 7M3 12h18', 'chevron-down':'m6 9 6 6 6-6', leaf:'M20 3C7 1 1 9 6 16c6 7 16-1 14-13M4 21 16 8', edit:'m15 4 5 5M4 20l1-6L16 3l5 5-11 11-6 1'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.leaf}"></path></svg>`;
function fillIcons(root = document) {root.querySelectorAll('[data-icon]').forEach(e => {e.innerHTML = icon(e.dataset.icon);});}
fillIcons();

const KEY = 'shiri.web.v1', BACKUP = KEY + '.previous';
let state, storageBlocked = false, initialRaw;
try {
  initialRaw = localStorage.getItem(KEY);
  state = initialRaw ? validate(JSON.parse(initialRaw)) : fresh();
} catch (e) {state = fresh(); storageBlocked = true; showStorageWarning('未能读取本机数据，原文件未覆盖。请在设置中恢复上一次保存，或导入备份。' + e.message);}
let page = 'today', selectedDate = bjDate(), selectedGoal = '', tab = 'focus', focusOpen = false;
let month = bjDate().slice(0,7), year = Number(bjDate().slice(0,4)), query = '', sort = 'time';
let petHidden = false, petVariation = 0, petStreak = 0, lastPetClick = 0, lines = [], petExpression = 'Curious';
let images = [], imagesReady = false, petRaf = 0, petPosition = 0, petAnimationId = 0;
let undoValue = null, undoRevision = '', toastTimer, editorMode = '', editorId = '', installPrompt = null;
let audio = null, offlineReady = false, lastDay = bjDate(), lastCheckpoint = Date.now(), lastStatsSecond = 0;
function showStorageWarning(message) {const el = $('#storage-warning'); el.textContent = message; el.hidden = false;}
function persist() {
  if (storageBlocked) throw Error('本机存储不可用。请先导出备份，再从设置恢复数据。');
  state.updatedAt = Date.now(); state.revision = uid();
  const encoded = JSON.stringify(state);
  try {
    const previous = localStorage.getItem(KEY);
    if (previous) localStorage.setItem(BACKUP, previous);
    localStorage.setItem(KEY, encoded);
    $('#storage-warning').hidden = true;
  } catch (e) {showStorageWarning('保存失败，原有数据保留。请立即在设置中导出备份；浏览器空间可能不足。'); throw Error('保存失败，请导出备份后检查浏览器存储空间。');}
}
function refreshFromDisk() {
  if (storageBlocked) return;
  try {const raw = localStorage.getItem(KEY); if (raw) {const latest = validate(JSON.parse(raw)); if (latest.revision !== state.revision) state = latest;}} catch (e) {storageBlocked = true; showStorageWarning('其他页面修改了存储，但数据无法读取。请先导出当前备份。');}
}
function mutate(fn, message = '', undo = false, petRefresh = false) {
  refreshFromDisk();
  const previous = clone(state);
  try {
    fn(); validate(state); persist();
    if (undo) {undoValue = {tasks: previous.tasks, goals: previous.goals, projectGoals: previous.focus.projects.map(p => [p.id, p.goalId])}; undoRevision = state.revision;}
    render();
    if (petRefresh) updatePet(false);
    if (message) toast(message, undo);
    return true;
  } catch (e) {state = previous; render(); toast(e.message); return false;}
}
function toast(message, undo = false) {
  clearTimeout(toastTimer); $('#toast-message').textContent = message; $('#toast-undo').hidden = !undo; $('#toast').hidden = false;
  toastTimer = setTimeout(() => {$('#toast').hidden = true;}, undo ? 8000 : 5500);
}
async function confirmAction(title, message) {
  const dialog = $('#confirm-dialog'); $('#confirm-title').textContent = title; $('#confirm-message').textContent = message; dialog.showModal();
  return new Promise(resolve => {
    const finish = value => {dialog.close(); $('#confirm-yes').onclick = null; $('#confirm-no').onclick = null; dialog.oncancel = null; resolve(value);};
    $('#confirm-yes').onclick = () => finish(true); $('#confirm-no').onclick = () => finish(false); dialog.oncancel = e => {e.preventDefault(); finish(false);};
  });
}
const todayTasks = () => state.tasks.filter(t => t.date === bjDate());
const matches = (...texts) => !query || texts.some(t => String(t || '').toLocaleLowerCase().includes(query));
const goalFor = id => state.goals.find(g => g.id === id);
const sortedTasks = tasks => [...tasks].sort((a,b) => sort === 'priority' ? b.priority - a.priority || a.time.localeCompare(b.time) : (a.time || '99:99').localeCompare(b.time || '99:99') || b.priority - a.priority);
function dateLabel(date, withYear = false) {const d = new Date(date + 'T00:00:00Z'); return `${withYear ? d.getUTCFullYear() + '年 ' : ''}${d.getUTCMonth()+1}月 ${d.getUTCDate()}日` + (withYear ? ` · 星期${'日一二三四五六'[d.getUTCDay()]}` : '');}
function switchPage(next, goal = '') {
  const returningHome = next === 'today' && (page !== 'today' || selectedDate !== bjDate());
  page = next; selectedGoal = goal;
  if (returningHome) {selectedDate = bjDate(); petHidden = false;}
  if (next === 'today' && !goal && !returningHome) petHidden = false;
  closeNav(); $('#search').value = ''; query = ''; petStreak = 0; render(); updatePet(false);
  history.replaceState(null, '', next === 'goals' ? '#goals' : '#today');
}
function chooseDate(date) {
  if (!validDate(date)) return;
  page = 'today'; selectedGoal = ''; selectedDate = date;
  if (date === bjDate()) petHidden = false;
  month = date.slice(0,7); year = Number(date.slice(0,4)); closeNav(); render(); updatePet(false);
}
function render() {
  const today = todayTasks();
  $('#today-count').textContent = today.filter(t => !t.done).length;
  $('#goals-count').textContent = state.goals.filter(g => !g.done).length;
  $$('.nav-item').forEach(e => e.classList.toggle('active', e.dataset.view === page));
  $('#week-strip').hidden = page !== 'today'; $('#return-today').hidden = page !== 'today';
  if (page === 'today') {
    $('#view-title').textContent = selectedDate === bjDate() ? '我的一天' : dateLabel(selectedDate);
    $('#view-tag').textContent = selectedDate === bjDate() ? 'TODAY' : 'DAY BY DAY';
    $('#view-description').textContent = query ? `查找“${$('#search').value}” · 所有日期` : '把重要的事，放进今天。';
    renderWeek(); renderTasks();
  } else if (selectedGoal && goalFor(selectedGoal)) renderGoalDetail();
  else {selectedGoal = ''; renderGoals();}
  document.body.classList.toggle('sidebar-collapsed', !state.settings.sidebarOpen);
  $('#sidebar-toggle-label').textContent = state.settings.sidebarOpen ? '收起右栏' : '展开右栏';
  $('.sidebar-toggle').setAttribute('aria-expanded', String(state.settings.sidebarOpen));
  $$('.right-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  for (const name of ['focus','calendar','companion']) $('#panel-' + name).hidden = tab !== name;
  renderUpcoming(); renderCalendar(); renderProgress(); renderStats(); renderFocusAgenda(); renderPetVisibility(); tickView();
  $('#content-hint').textContent = state.tasks.some(t => t.example) ? '只有一条示例任务，可在设置中清除。' : '做一件小事，也是在好好生活。';
}
function renderWeek() {
  const monday = addDays(selectedDate, -weekday(selectedDate));
  $('#week-strip').innerHTML = `<button class="week-arrow" data-week="-7" aria-label="上一周">‹</button>` + Array.from({length:7},(_,i) => {
    const d = addDays(monday,i), has = state.tasks.some(t => t.date === d);
    return `<button class="week-day ${d===selectedDate?'selected':''} ${has?'has-tasks':''}" data-date="${d}" aria-label="${dateLabel(d,true)}" aria-pressed="${d===selectedDate}"><span>周${'一二三四五六日'[i]}</span><strong>${Number(d.slice(8))}</strong><i></i></button>`;
  }).join('') + `<button class="week-arrow" data-week="7" aria-label="下一周">›</button>`;
}
function taskHTML(t) {
  const g = goalFor(t.goalId);
  return `<article class="task-row ${t.done?'done':''}"><button class="task-check" data-complete="${html(t.id)}" aria-label="${t.done?'取消完成':'完成'}：${html(t.title)}" aria-pressed="${t.done}">${t.done?icon('check'):''}</button><button class="task-body" data-edit-task="${html(t.id)}"><strong>${html(t.title)}</strong><span class="task-meta">${t.time?`<span>${icon('clock')}${html(t.time)}</span>`:''}${query?`<span>${html(t.date)}</span>`:''}${g?`<span style="color:${g.color}">${icon('link')}${html(g.title)}</span>`:''}${t.repeat!=='不重复'?`<span>${icon('reset')}${t.repeat}</span>`:''}${t.reminder?'<span>提醒</span>':''}${!t.time&&!g&&t.repeat==='不重复'&&!t.reminder?'<span>留给自己的一小步</span>':''}</span></button><button class="priority-button ${t.priority===2?'important':''}" data-star="${html(t.id)}" aria-label="${t.priority===2?'取消重要标记':'标记为重要'}：${html(t.title)}" aria-pressed="${t.priority===2}">${t.priority===2?'★':'☆'}</button></article>`;
}
function emptyHTML(title, description, action = 'new-task', label = '安排一件小事') {return `<div class="empty-state">${icon('leaf')}<h3>${html(title)}</h3><p>${html(description)}</p>${action?`<button class="soft-button" data-action="${action}">${icon('plus')}${html(label)}</button>`:''}</div>`;}
function renderTasks() {
  const list = state.tasks.filter(t => query ? matches(t.title,t.notes,goalFor(t.goalId)?.title) : t.date === selectedDate);
  const pending = sortedTasks(list.filter(t => !t.done)), done = sortedTasks(list.filter(t => t.done));
  $('#content').innerHTML = `<div class="task-section-title"><strong>${query?'搜索结果':selectedDate===bjDate()?'今日任务':'这一天的安排'}<span class="count">${list.length}</span></strong><button class="text-button" data-action="sort">↓ ${sort==='time'?'时间排序':'重要优先'}</button></div>` +
    (pending.length ? `<div class="task-list">${pending.map(taskHTML).join('')}</div>` : done.length ? emptyHTML('今天的安排，都完成啦','把这一刻的轻松，也留给自己。','', '') : emptyHTML(query?'没有找到相关任务':'这一天，还留着很多可能',query?'试试标题、备注或长期任务的名字。':'从一件小事开始，也可以慢悠悠地过。',query?'':'new-task')) +
    (done.length ? `<p class="completed-label">已完成 · ${done.length}</p><div class="task-list">${done.map(taskHTML).join('')}</div>` : '');
}
function renderGoals() {
  $('#view-title').textContent = '远方计划'; $('#view-tag').textContent = 'LITTLE BY LITTLE'; $('#view-description').textContent = '把向往放在远方，把努力留在每天。';
  const goals = state.goals.filter(g => matches(g.title,g.notes)).sort((a,b) => Number(a.done)-Number(b.done) || b.createdAt-a.createdAt);
  $('#content').innerHTML = `<div class="goal-toolbar"><p>${goals.length} 个愿望，慢慢靠近</p><button class="soft-button" data-action="new-goal">${icon('plus')}写下一个远方</button></div>` +
    (goals.length ? `<div class="goal-list">${goals.map(g => {const e=goalEffort(state,g.id); return `<button class="goal-card ${g.done?'done':''}" style="--goal-color:${g.color}" data-goal="${html(g.id)}"><span class="eyebrow">${g.done?'已经抵达':'正在路上'}</span><h3>${html(g.title)}</h3><p>${html(g.notes||'给每天的一点努力，找一个方向。')}</p><div class="goal-metrics-inline"><span>${e.done.length} / ${e.tasks.length} 件小事</span><span>专注 ${duration(e.ms)}</span><span>${e.days} 天有足迹</span></div></button>`;}).join('')}</div>` : emptyHTML(query?'没有找到相关计划':'给未来的自己，写一封短笺',query?'换个关键词试试看。':'长期计划没有截止日期，每一天的努力都能归在这里。',query?'':'new-goal','写下一个远方'));
}
function renderGoalDetail() {
  const g=goalFor(selectedGoal), e=goalEffort(state,g.id);
  $('#view-title').textContent=g.title; $('#view-tag').textContent=g.done?'ARRIVED':'ON THE WAY'; $('#view-description').textContent='每一小步，都会在这里留下痕迹。';
  const history = [...e.done.map(t=>({at:t.completedAt||Date.parse(t.date+'T12:00:00+08:00'),title:'完成了「'+t.title+'」',detail:t.date})),...e.segments.map(s=>({at:s.end,title:'专注于「'+(state.focus.projects.find(p=>p.id===s.projectId)?.name||g.title)+'」',detail:bjDate(s.start)+' · '+duration(s.end-s.start)}))].sort((a,b)=>b.at-a.at).slice(0,40);
  $('#content').innerHTML=`<div class="goal-detail-top"><button class="soft-button" data-action="back-goals">${icon('back')}所有远方</button><button class="soft-button" data-action="edit-goal">${icon('edit')}编辑</button><button class="soft-button" data-action="goal-done">${icon('check')}${g.done?'重新出发':'标记抵达'}</button></div>${g.notes?`<p class="goal-detail-notes">${html(g.notes)}</p>`:''}<div class="goal-metrics"><div class="goal-metric"><small>完成的小事</small><strong>${e.done.length} / ${e.tasks.length}</strong></div><div class="goal-metric"><small>为此专注</small><strong id="goal-focus-duration">${duration(e.ms)}</strong></div><div class="goal-metric"><small>留下足迹的日子</small><strong>${e.days} 天</strong></div></div><div class="goal-toolbar"><h2>向这个远方，再走一步</h2><div class="inline-tools"><button class="soft-button" data-action="new-task" title="添加所属日程">${icon('plus')}</button><button class="soft-button" data-action="goal-focus" title="为这个远方专注">${icon('timer')}</button></div></div><div class="task-list">${sortedTasks(e.tasks.filter(t=>!t.done)).map(taskHTML).join('')||emptyHTML('下一小步，还由你来写','为这个计划安排日程，或留一段专注时间。','new-task','安排一小步')}</div><div class="task-section-title section-gap"><strong>一路走来的努力</strong><span class="fine-print">最近 40 条</span></div>${history.length?history.map(h=>`<div class="effort-entry"><strong>${html(h.title)}</strong><small>${html(h.detail)}</small></div>`).join(''):emptyHTML('努力会在这里生根','完成关联日程或开始专注，就会留下记录。','')}`;
}
function renderUpcoming() {
  const next = sortedTasks(state.tasks.filter(t=>!t.done&&t.date>=bjDate())).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99')).slice(0,5);
  $('#upcoming').innerHTML=next.length?next.map(t=>`<button class="upcoming-item" data-edit-task="${html(t.id)}"><strong>${html(t.title)}</strong><small>${t.date===bjDate()?'今天':dateLabel(t.date)}${t.time?' · '+html(t.time):''}</small></button>`).join(''):'<p class="upcoming-empty">没有待办，今天可以轻松一点。</p>';
}
function renderProgress() {
  const list=todayTasks(), done=list.filter(t=>t.done).length, percentage=list.length?Math.round(done/list.length*100):0;
  $('#day-progress-label').textContent=percentage+'%'; $('#day-progress').value=percentage;
  $('#day-progress-description').textContent=list.length?`今天完成 ${done} / ${list.length} 件事。${done===list.length?'辛苦啦，好好奖励自己。':'从眼前的一小步开始。'}`:'今天没有任务，真是轻松惬意的一天。';
}
function renderStats() {
  const start=dayStart(), slices=statistics(state), total=slices.reduce((s,p)=>s+p.ms,0);
  $('#stats-period').textContent=`${bjDate(start).slice(5).replace('-','/')} 04:00 — ${bjDate(start+DAY).slice(5).replace('-','/')} 04:00 · 北京时间`;
  let position=0;
  const stops=slices.map(p=>{const from=position;position+=p.ms/total*100;return `${p.color} ${from}% ${position}%`;});
  $('#focus-pie').style.background=slices.length?`conic-gradient(${stops.join(',')})`:'#edf2e8';
  $('#pie-empty').hidden=!!slices.length; $('#focus-pie').setAttribute('aria-label',slices.length?slices.map(p=>p.name+' '+duration(p.ms)).join('；'):'今日还没有专注记录');
  $('#stats-total').textContent='共 '+(total?duration(total):'0 分钟');
  $('#pie-legend').innerHTML=slices.map(p=>`<div class="legend-row"><i style="background:${p.color}"></i><span class="legend-name" title="${html(p.name)}">${html(p.name)}</span><span>${Math.round(p.ms/total*100)}% · ${html(duration(p.ms))}</span></div>`).join('');
}
function monthCells(value, mini=false) {
  const first=value+'-01', start=addDays(first,-weekday(first));
  return '一二三四五六日'.split('').map(d=>`<span class="weekday">${d}</span>`).join('')+Array.from({length:42},(_,i)=>{
    const date=addDays(start,i); if(mini&&!date.startsWith(value))return '<span></span>';
    const has=state.tasks.some(t=>t.date===date), outside=!date.startsWith(value);
    return `<button data-date="${date}" class="${outside?'outside ':''}${date===bjDate()?'today ':''}${date===selectedDate?'selected ':''}${has?'has-task':''}" aria-label="${dateLabel(date,true)}${has?'，有任务':''}" ${date===selectedDate?'aria-current="date"':''}>${Number(date.slice(8))}</button>`;
  }).join('');
}
function renderCalendar() {
  $('#calendar-summary').textContent=dateLabel(bjDate(),true); $('#month-label').textContent=`${month.slice(0,4)}年 ${Number(month.slice(5))}月`;
  $('#month-grid').innerHTML=monthCells(month); $('#year-label').textContent=year+'年';
  $('#year-grid').innerHTML=Array.from({length:12},(_,i)=>`<section class="mini-month"><h3>${i+1}月</h3><div class="month-grid">${monthCells(year+'-'+String(i+1).padStart(2,'0'),true)}</div></section>`).join('');
}
function renderFocusAgenda() {
  const tasks=sortedTasks(todayTasks());
  $('#focus-agenda-list').innerHTML=tasks.length?tasks.map(t=>`<div class="agenda-item ${t.done?'done':''}"><span>${t.done?'✓':html(t.time||'·')}</span><strong>${html(t.title)}</strong></div>`).join(''):'<p class="upcoming-empty">今天没有安排，轻松地专注一会儿吧。</p>';
}
function tickView() {
  const now=Date.now(), s=state.focus.session, p=currentProject(state), rest=s?.phase==='break', running=!!s?.running, text=countdown(remaining(state,now));
  $('#beijing-date').textContent=dateLabel(bjDate(now),true); $('#big-clock').textContent=bjTime(now); $('#big-date').textContent=dateLabel(bjDate(now),true);
  $('#small-countdown').textContent=text; $('#big-countdown').textContent=text; $('#focus-name').textContent=p.name; $('#big-project').textContent=rest?'休息一会儿':p.name;
  $('#focus-phase').textContent=rest?(running?'休息也很重要':'休息已暂停'):(running?'专心眼前这一小步':s&&remaining(state)<state.focus.focusMinutes*60000?'专注已暂停':'留一段不被打扰的时间');
  $('#big-phase').textContent=rest?'给努力的自己，留一点空白':running?'留一段时间，只做一件事':'准备好，就从现在开始';
  const durationMs=(rest?state.focus.breakMinutes:state.focus.focusMinutes)*60000;
  const progress=Math.max(0,Math.min(1,remaining(state,now)/durationMs));
  $('#ring-progress').style.strokeDashoffset=String(1043.009*(1-progress)); $('#ring-progress').style.stroke=rest?'#83A5B5':p.color;
  $('#big-countdown').style.color=rest?'#7193A4':p.color;
  $('#big-caption').textContent=rest?'放松一下，小鱼也在陪你。':running?'慢慢来，你已经在向前。':'按下开始，把这一刻留给自己。';
  $$('.focus-toggle').forEach(b=>{b.innerHTML=icon(running?'pause':'play')+`<span>${running?'暂停'+(rest?'休息':'专注'):rest?'继续休息':s&&remaining(state)<state.focus.focusMinutes*60000?'继续专注':'开始专注'}</span>`;b.setAttribute('aria-label',b.textContent);});
  $$('.break-button,#big-break').forEach(b=>b.textContent=rest?'结束休息，准备专注':'先休息一下');
  $('#fullscreen-label').textContent=document.fullscreenElement||document.webkitFullscreenElement?'退出全屏':'电脑全屏';
  if (page==='goals'&&selectedGoal&&$('#goal-focus-duration')) $('#goal-focus-duration').textContent=duration(goalEffort(state,selectedGoal,now).ms);
  const sec=Math.floor(now/1000); if(sec!==lastStatsSecond){lastStatsSecond=sec;renderStats();}
}
function petContext() {
  const s=state.focus.session;
  if(focusOpen)return s?.phase==='break'?'rest':s&&!s.running&&remaining(state)<state.focus.focusMinutes*60000?'paused':'focus';
  if(tab==='calendar')return 'calendar';
  if(page==='goals')return selectedGoal?'goal':'goals';
  if(tab==='companion')return 'casual';
  const tasks=todayTasks(),done=tasks.filter(t=>t.done).length;
  return tasks.length===0?'relaxed':done===tasks.length?'completed':'pending';
}
function updatePet(animate=false) {
  if(!lines.length)return;
  const tasks=todayTasks(), done=tasks.filter(t=>t.done).length, g=goalFor(selectedGoal), context=tasks.length===0?'今天没有任务，轻松惬意地过吧。':done===tasks.length?'今天的任务已全部完成，辛苦啦！':`今天还有 ${tasks.length-done} 件未完成，我们慢慢来。`;
  let group=petContext();
  if(animate&&group!=='completed'&&page==='today'&&!focusOpen&&tab==='focus') {if(petStreak>=4)group='petting';else if(petVariation>0&&petVariation%5===0)group='casual';}
  const line=petMessage(lines,group,petVariation++,{context,remaining:tasks.length-done,next:sortedTasks(tasks.filter(t=>!t.done))[0]?.title?.slice(0,26)||'眼前的一小步',goal:g?.title?.slice(0,22)||currentProject(state)?.name||'眼前的小目标',effort:g?duration(goalEffort(state,g.id).ms):duration(statistics(state).reduce((n,p)=>n+p.ms,0)),time:countdown(remaining(state))});
  $('#pet-speech').textContent=line.Text; $('#pet-speech').dataset.lineId=line.Id; $('#pet-speech').dataset.expression=line.Expression;
  express(line.Expression,animate); renderPetVisibility();
}
const mappedFrame = frame => frame===0?3:frame===1?27:frame===2?62:frame;
function drawPet(frame) {
  const image=images[mappedFrame(frame)]; if(!image?.complete||!image.naturalWidth)return;
  const canvas=$('#pet-canvas'), ctx=canvas.getContext('2d'); ctx.clearRect(0,0,512,512); ctx.drawImage(image,0,0,512,512); canvas.dataset.frame=String(mappedFrame(frame));
}
function express(expression,animate=false) {
  const start=petPosition, end=POSE_POSITIONS[expression]; petExpression=expression; cancelAnimationFrame(petRaf); const id=++petAnimationId;
  const finish=()=>{petPosition=end;drawPet(POSES[expression]);$('#pet-canvas').dataset.transitioning='false';};
  if(!animate||!imagesReady||!state.settings.petMotion||matchMedia('(prefers-reduced-motion: reduce)').matches||start===end){finish();return;}
  const began=performance.now(); $('#pet-canvas').dataset.transitioning='true';
  const advance=now=>{if(id!==petAnimationId)return;const t=Math.min(1,(now-began)/75);if(t>=1){finish();return;}const eased=t*t*(3-2*t);petPosition=Math.round(start+(end-start)*eased);drawPet(PET_CHAIN[petPosition]);petRaf=requestAnimationFrame(advance);};
  petRaf=requestAnimationFrame(advance);
  setTimeout(()=>{if(id===petAnimationId){cancelAnimationFrame(petRaf);finish();}},75);
}
function renderPetVisibility() {
  $('#pet-dock').hidden=!state.settings.petEnabled||petHidden;
  $('#pet-reopen').hidden=!state.settings.petEnabled||!petHidden;
  document.body.classList.toggle('no-pet',!state.settings.petEnabled);
}
async function loadPet() {
  try {
    const response=await fetch('./assets/pet-dialogue.json'); if(!response.ok)throw Error('台词下载失败'); lines=await response.json();
    for(const frame of [3,27,62]) {const img=new Image();img.src=`./assets/pet/cel-${String(frame).padStart(3,'0')}.png`;images[frame]=img;await img.decode();}
    express(petExpression,false);updatePet(false);
    const preload=Array.from({length:71},async(_,i)=>{if(images[i])return;const img=new Image();img.src=`./assets/pet/cel-${String(i).padStart(3,'0')}.png`;images[i]=img;await img.decode();});
    await Promise.all(preload);imagesReady=true;
  } catch(e){$('#pet-speech').textContent='小鱼还在赶来的路上……联网后重新打开试试。';toast('大肥鱼素材未完全加载：'+e.message);}
}
function interactPet(pointer) {
  const now=Date.now();petStreak=now-lastPetClick<1800?petStreak+1:1;lastPetClick=now;updatePet(pointer);unlockAudio();
}
function openSettings(backup=false) {
  $('#setting-pet').checked=state.settings.petEnabled;$('#setting-motion').checked=state.settings.petMotion;
  $('#recover-local').disabled=!localStorageAvailable(BACKUP);$('#settings-dialog').showModal();
  if(backup)$('#backup-section').scrollIntoView({block:'nearest'});
}
function localStorageAvailable(key){try{return !!localStorage.getItem(key);}catch{return false;}}
function goalOptions(selected='') {return `<option value="">不归类到长期任务</option>`+state.goals.map(g=>`<option value="${html(g.id)}" ${g.id===selected?'selected':''}>${html(g.title)}</option>`).join('');}
function field(label,content) {return `<label class="field"><span>${label}</span>${content}</label>`;}
function openEditor(mode,id='') {
  refreshFromDisk();editorMode=mode;editorId=id;$('#editor-error').textContent='';$('#editor-delete').hidden=!id;
  const fields=$('#editor-fields');
  if(mode==='task') {
    const t=state.tasks.find(t=>t.id===id)||newTask(selectedDate,selectedGoal);
    $('#editor-title').textContent=id?'编辑任务':'新建任务';$('#editor-kicker').textContent='A LITTLE PLAN';
    fields.innerHTML=field('想做的一件事',`<input name="title" value="${html(t.title)}" maxlength="120" required placeholder="给今天一个小小的方向" autocomplete="off">`)+`<div class="field-row">${field('日期',`<input type="date" name="date" value="${t.date}" min="0001-01-01" max="9999-12-31" required>`)}${field('时间（可选）',`<input type="time" name="time" value="${html(t.time)}">`)}</div>`+field('所属长期任务（可选）',`<select name="goalId">${goalOptions(t.goalId)}</select>`)+`<div class="field-row">${field('优先级',`<select name="priority">${['低 · 慢慢来','普通 · 按计划','高 · 重要事项'].map((x,i)=>`<option value="${i}" ${t.priority===i?'selected':''}>${x}</option>`).join('')}</select>`)}${field('重复',`<select name="repeat">${['不重复','每天','每周'].map(x=>`<option ${x===t.repeat?'selected':''}>${x}</option>`).join('')}</select>`)}</div>`+field('备注',`<textarea name="notes" maxlength="4000" placeholder="记下细节，也给自己留一点余地。">${html(t.notes)}</textarea>`)+`<label class="check-field"><input name="reminder" type="checkbox" ${t.reminder?'checked':''}>页面打开时，到点提醒我（需设置时间）</label>`;
  } else if(mode==='goal') {
    const g=goalFor(id)||{title:'',notes:'',color:COLORS[0]};$('#editor-title').textContent=id?'编辑远方计划':'写下一个远方';$('#editor-kicker').textContent='LITTLE BY LITTLE';
    fields.innerHTML=field('想慢慢抵达的地方',`<input name="title" value="${html(g.title)}" maxlength="120" required placeholder="例如：读完一本一直想读的书" autocomplete="off">`)+field('写给未来的自己',`<textarea name="notes" maxlength="4000" placeholder="为什么想做这件事？从哪一小步开始？">${html(g.notes)}</textarea>`)+field('计划颜色',`<input type="color" name="color" value="${g.color}">`)+`<p class="field-hint">长期计划不设日期。创建每日任务时，可将努力归到这里。</p>`;
  } else {
    $('#editor-delete').hidden=true;const f=state.focus,p=currentProject(state);$('#editor-title').textContent='专注与休息';$('#editor-kicker').textContent='A MOMENT FOR YOURSELF';
    fields.innerHTML=field('这段时间，想做什么',`<input name="name" value="${html(p.name)}" maxlength="120" required list="project-names"><datalist id="project-names">${f.projects.map(p=>`<option value="${html(p.name)}"></option>`).join('')}</datalist>`)+`<div class="field-row">${field('专注时长（分钟）',`<input type="number" name="focusMinutes" value="${f.focusMinutes}" min="1" max="360" step="1" required>`)}${field('休息时长（分钟）',`<input type="number" name="breakMinutes" value="${f.breakMinutes}" min="1" max="120" step="1" required>`)}</div>`+`<div class="field-row">${field('统计颜色',`<input type="color" name="color" value="${p.color}">`)}${field('所属长期任务',`<select name="goalId">${goalOptions(p.goalId)}</select>`)}</div><p class="field-hint">保存后重新准备本轮计时；已完成的专注片段会保留。完成专注后自动休息，休息结束等待你开始下一轮。</p>`;
  }
  $('#editor-dialog').showModal();requestAnimationFrame(()=>fields.querySelector('input')?.focus());
}
$('#editor-form').addEventListener('submit',e=>{
  e.preventDefault();const form=new FormData(e.currentTarget);
  const success=mutate(()=>{
    if(editorMode==='task') {
      const original=state.tasks.find(t=>t.id===editorId),value={...(original||newTask()),title:String(form.get('title')).trim(),notes:String(form.get('notes')),date:String(form.get('date')),time:String(form.get('time')),goalId:String(form.get('goalId')),priority:Number(form.get('priority')),repeat:String(form.get('repeat')),reminder:form.has('reminder'),example:false};
      if(!value.title)throw Error('先给这件小事取个名字吧。');if(value.reminder&&!value.time)throw Error('到点提醒需要先设置时间。');
      if(!original||original.date!==value.date||original.time!==value.time)value.reminded=false;
      if(original)Object.assign(original,value);else state.tasks.push(value);
    } else if(editorMode==='goal') {
      const original=goalFor(editorId),value={...(original||{id:uid(),createdAt:Date.now(),done:false}),title:String(form.get('title')).trim(),notes:String(form.get('notes')),color:String(form.get('color'))};
      if(!value.title)throw Error('给这个远方取个名字吧。');if(original)Object.assign(original,value);else state.goals.push(value);
    } else configureFocus(state,{name:String(form.get('name')),focusMinutes:Number(form.get('focusMinutes')),breakMinutes:Number(form.get('breakMinutes')),color:String(form.get('color')),goalId:String(form.get('goalId'))});
  },'已经记下了。',editorMode!=='focus',true);
  if(success)$('#editor-dialog').close();else $('#editor-error').textContent=$('#toast-message').textContent;
});
$('#editor-delete').onclick=async()=>{
  const mode=editorMode,id=editorId;
  if(!await confirmAction(mode==='task'?'删除这件事？':'删除这个远方？',mode==='task'?'这条日程会被移除。删除后可通过提示中的“撤销”恢复。':'关联日程与专注历史会保留，日程将解除长期归属。'))return;
  if(mutate(()=>{if(mode==='task')state.tasks=state.tasks.filter(t=>t.id!==id);else{state.goals=state.goals.filter(g=>g.id!==id);state.tasks.forEach(t=>{if(t.goalId===id)t.goalId='';});state.focus.projects.forEach(p=>{if(p.goalId===id)p.goalId='';});if(state.focus.session?.goalId===id)state.focus.session.goalId='';selectedGoal='';}},'已删除，可撤销。',true,true))$('#editor-dialog').close();
};
$('#setting-pet').onchange=e=>{const value=e.target.checked;mutate(()=>{state.settings.petEnabled=value;if(value)petHidden=false;},value?'大肥鱼回来啦。':'已关闭大肥鱼，可在设置中重新开启。');updatePet(false);};
$('#setting-motion').onchange=e=>{const value=e.target.checked;mutate(()=>state.settings.petMotion=value);express(petExpression,false);};
$('#toast-undo').onclick=()=>{
  refreshFromDisk();if(!undoValue)return;
  if(state.revision!==undoRevision){toast('数据已发生新变化，无法撤销上一步。');return;}
  const previous=undoValue;undoValue=null;
  mutate(()=>{state.tasks=previous.tasks;state.goals=previous.goals;for(const [id,goalId]of previous.projectGoals){const p=state.focus.projects.find(x=>x.id===id);if(p)p.goalId=goalId;}},'已撤销。',false,true);
};
async function exportBackup() {
  refreshFromDisk();capture(state,Date.now());if(!storageBlocked){try{persist();}catch{}}
  const backup=clone(state);backup.focus.session=null;backup.exportedAt=new Date().toISOString();
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`拾日-完整备份-${bjDate()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('已生成完整备份，请将文件保存在安全的位置。');
}
$('#import-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try {
    if(file.size>32*1024*1024)throw Error('文件超过 32 MB。');
    const imported=parseBackup(await file.text());
    if(!await confirmAction('合并这份备份？',imported.type==='focus'?`将合并 ${imported.state.focus.segments.length} 条专注时段；原有记录保留。`:`将合并 ${imported.state.tasks.length} 条日程、${imported.state.goals.length} 个远方计划${imported.type==='web'?'及专注记录':''}。同编号记录保留当前版本。`))return;
    if(storageBlocked){validate(imported.state);state=imported.state;storageBlocked=false;persist();render();updatePet(false);toast('已从备份恢复。');}
    else mutate(()=>{capture(state,Date.now());state=mergeBackup(state,imported);},'备份已合并，重复记录未再次添加。',false,true);
  } catch(err){toast('导入未完成：'+err.message);}
};
async function openFocus() {focusOpen=true;$('#focus-workspace').hidden=false;$('#app-shell').inert=true;document.body.style.overflow='hidden';renderFocusAgenda();tickView();updatePet(false);$('#focus-workspace [data-action="close-focus"]').focus();}
async function closeFocus() {
  if(document.fullscreenElement||document.webkitFullscreenElement){try{await(document.exitFullscreen?.()||document.webkitExitFullscreen?.());}catch{}}
  focusOpen=false;$('#focus-workspace').hidden=true;$('#app-shell').inert=false;document.body.style.overflow='';render();updatePet(false);$('[data-action="expand-focus"]').focus();
}
async function fullscreen() {
  const el=$('#focus-workspace');
  try {if(document.fullscreenElement||document.webkitFullscreenElement)await(document.exitFullscreen?.()||document.webkitExitFullscreen?.());else{
    // The pet is moved inside the fullscreen element, then restored on exit.
    el.append($('#pet-dock'),$('#pet-reopen'));
    if(el.requestFullscreen)await el.requestFullscreen();else if(el.webkitRequestFullscreen)await el.webkitRequestFullscreen();else throw Error('当前浏览器不支持此全屏方式，可添加到主屏幕后使用。');
  }}catch(e){document.body.append($('#pet-dock'),$('#pet-reopen'));toast(e.message||'全屏未开启，请使用窗口专注模式。');}
}
function fullscreenChanged(){if(!document.fullscreenElement&&!document.webkitFullscreenElement)document.body.append($('#pet-dock'),$('#pet-reopen'));tickView();}
document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('webkitfullscreenchange',fullscreenChanged);
function unlockAudio(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}catch{}}
function chime(){try{if(!audio||audio.state!=='running')return;for(const [i,freq]of [523.25,659.25,783.99].entries()){const o=audio.createOscillator(),g=audio.createGain(),at=audio.currentTime+i*.13;o.frequency.value=freq;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.08,at+.02);g.gain.exponentialRampToValueAtTime(.001,at+.22);o.connect(g).connect(audio.destination);o.start(at);o.stop(at+.25);}}catch{}}
function closeNav(){document.body.classList.remove('nav-open');$('#nav-scrim').hidden=true;}
$('#nav-scrim').onclick=closeNav;
const actions={
  'new-task':()=>openEditor('task'), 'new-goal':()=>openEditor('goal'), 'edit-goal':()=>openEditor('goal',selectedGoal),
  'back-goals':()=>switchPage('goals'), 'return-today':()=>{selectedDate=bjDate();petHidden=false;render();updatePet(false);},
  'sort':()=>{sort=sort==='time'?'priority':'time';renderTasks();},
  'settings':()=>openSettings(), 'backup':()=>openSettings(true),
  'close-dialog':e=>e.closest('dialog')?.close(),
  'toggle-sidebar':()=>mutate(()=>state.settings.sidebarOpen=!state.settings.sidebarOpen),
  'focus-settings':()=>openEditor('focus'),
  'toggle-focus':()=>{unlockAudio();mutate(()=>toggleFocus(state));updatePet(false);},
  'reset-focus':async()=>{if(state.focus.session?.running&&!await confirmAction('重新准备这一轮？','已专注的时间会保留，本轮倒计时回到起点。'))return;mutate(()=>resetFocus(state),'已保留专注记录，重新准备。');updatePet(false);},
  'start-break':()=>{unlockAudio();mutate(()=>{if(state.focus.session?.phase==='break')resetFocus(state);else startBreak(state);});updatePet(false);},
  'expand-focus':openFocus,'close-focus':closeFocus,'fullscreen':fullscreen,
  'prev-month':()=>{const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);month=d.toISOString().slice(0,7);year=d.getUTCFullYear();renderCalendar();updatePet(false);},
  'next-month':()=>{const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);month=d.toISOString().slice(0,7);year=d.getUTCFullYear();renderCalendar();updatePet(false);},
  'prev-year':()=>{year--;renderCalendar();updatePet(false);},'next-year':()=>{year++;renderCalendar();updatePet(false);},
  'pet-close':()=>{petHidden=true;renderPetVisibility();toast('大肥鱼先躲一会儿，返回“我的一天”会重新出现。');},
  'restore-pet':()=>{if(!state.settings.petEnabled){openSettings();toast('请在设置中开启“大肥鱼陪伴”。');return;}petHidden=false;renderPetVisibility();updatePet(false);},
  'pet-chat':(_,e)=>interactPet(e.detail>0),
  'pet-expressions':()=>$('#pet-expression-menu').hidden=!$('#pet-expression-menu').hidden,
  'export':exportBackup,'import':()=>$('#import-file').click(),
  'clear-example':()=>mutate(()=>state.tasks=state.tasks.filter(t=>!t.example),'示例已清除。',true,true),
  'recover-local':async()=>{try{const recovered=validate(JSON.parse(localStorage.getItem(BACKUP)));if(await confirmAction('恢复上一次本机保存？','将恢复上一份本机快照。建议先导出当前数据备份。')){state=recovered;storageBlocked=false;persist();render();updatePet(false);toast('已恢复上一次保存。');}}catch(e){toast('无法恢复：'+e.message);}},
  'goal-done':()=>mutate(()=>{const g=goalFor(selectedGoal);if(g)g.done=!g.done;},'远方计划已更新。',true,true),
  'goal-focus':()=>{const g=goalFor(selectedGoal);if(!g)return;mutate(()=>configureFocus(state,{name:g.title,color:g.color,goalId:g.id,focusMinutes:state.focus.focusMinutes,breakMinutes:state.focus.breakMinutes}));tab='focus';render();openFocus();},
  'menu':()=>{const opened=document.body.classList.toggle('nav-open');$('#nav-scrim').hidden=!opened;},
  'install':async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#install-button').hidden=true;}else toast('iPad：Safari 分享 → 添加到主屏幕。');}
};
document.addEventListener('click',async e=>{
  const target=e.target instanceof Element?e.target:null;if(!target)return;
  const a=target.closest('[data-action]');if(a){await actions[a.dataset.action]?.(a,e);return;}
  const view=target.closest('[data-view]');if(view){switchPage(view.dataset.view);return;}
  const t=target.closest('[data-tab]');if(t){tab=t.dataset.tab;if(!state.settings.sidebarOpen)mutate(()=>state.settings.sidebarOpen=true);render();updatePet(false);return;}
  const date=target.closest('[data-date]');if(date){chooseDate(date.dataset.date);return;}
  const week=target.closest('[data-week]');if(week){chooseDate(addDays(selectedDate,Number(week.dataset.week)));return;}
  const complete=target.closest('[data-complete]');if(complete){mutate(()=>toggleTask(state,complete.dataset.complete),'已经记下这一步。',true,true);return;}
  const edit=target.closest('[data-edit-task]');if(edit){openEditor('task',edit.dataset.editTask);return;}
  const star=target.closest('[data-star]');if(star){mutate(()=>{const t=state.tasks.find(x=>x.id===star.dataset.star);if(t)t.priority=t.priority===2?1:2;},'',true);return;}
  const goal=target.closest('[data-goal]');if(goal){selectedGoal=goal.dataset.goal;render();updatePet(false);return;}
  const expression=target.closest('[data-expression]');if(expression){const name=expression.dataset.expression;$('#pet-expression-menu').hidden=true;$('#pet-speech').textContent={Curious:'嗯……？让本鱼想一下，你是不是想到什么新点子啦？',Sulky:'唔，眉毛自己皱起来了……本鱼只是有一点点小委屈，摸摸就好。',Happy:'嘿嘿！>< 被你发现了，大肥鱼现在超级开心！'}[name];$('#pet-speech').dataset.expression=name;$('#pet-speech').dataset.lineId='preview-'+name;express(name,e.detail>0);return;}
  if(!target.closest('.pet-dock'))$('#pet-expression-menu').hidden=true;
});
$('#pet-portrait').onclick=e=>interactPet(e.detail>0);
$('#pet-portrait').oncontextmenu=e=>{e.preventDefault();$('#pet-expression-menu').hidden=false;};
$('#search').addEventListener('input',e=>{if(e.isComposing)return;query=e.target.value.trim().toLocaleLowerCase();render();});
$('#search').addEventListener('compositionend',e=>{query=e.target.value.trim().toLocaleLowerCase();render();});
document.addEventListener('keydown',async e=>{
  if(e.isComposing)return;
  const input=e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"]');
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&!$$('dialog[open]').length&&!focusOpen){e.preventDefault();$('#search').focus();$('#search').select();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'&&!$$('dialog[open]').length&&!focusOpen){e.preventDefault();openEditor('task');}
  if(e.code==='Space'&&focusOpen&&!input&&!$$('dialog[open]').length){e.preventDefault();if(!e.repeat)actions['toggle-focus']();}
  if(e.key==='Escape'&&!$$('dialog[open]').length){if(focusOpen){e.preventDefault();if(document.fullscreenElement||document.webkitFullscreenElement)await(document.exitFullscreen?.()||document.webkitExitFullscreen?.());else closeFocus();}else closeNav();}
});
window.addEventListener('hashchange',()=>switchPage(location.hash==='#goals'?'goals':'today'));
window.addEventListener('storage',e=>{if(e.key===KEY){refreshFromDisk();undoValue=null;render();updatePet(false);}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(petRaf);express(petExpression,false);refreshFromDisk();try{capture(state,Date.now());persist();}catch{}}
  else {refreshFromDisk();pulse(true);render();updatePet(false);}
});
window.addEventListener('pagehide',()=>{refreshFromDisk();try{capture(state,Date.now());persist();}catch{}});
window.addEventListener('online',()=>{setSaveStatus();});window.addEventListener('offline',()=>{setSaveStatus();toast('已离线，继续在这台设备上安排日程。');});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#install-button').hidden=false;});
function setSaveStatus(){const text=offlineReady?'本机保存 · 离线就绪':navigator.onLine?'本机保存 · 正在准备离线':'本机保存 · 当前离线';$('#save-status').innerHTML='<i></i>'+text;$('#offline-description').textContent=offlineReady?'离线文件已准备完成。下次没有网络时，也可以从主屏幕或原网址打开。':'首次请保持联网，直到左下角显示“离线就绪”。如长时间未就绪，请重新打开。';}
async function setupOffline() {
  if(!('serviceWorker'in navigator)||!window.isSecureContext){$('#offline-description').textContent='当前打开方式不支持离线安装。请通过 HTTPS 网站或本机 localhost 使用。';return;}
  try {
    const reg=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
    const report=()=>{const worker=reg.active||navigator.serviceWorker.controller;if(worker)worker.postMessage({type:'CHECK_READY'});};
    navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='OFFLINE_READY'){offlineReady=true;setSaveStatus();}});
    report();navigator.serviceWorker.addEventListener('controllerchange',report);
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='activated')report();});});
    navigator.storage?.persist?.().catch(()=>{});
  } catch(e){$('#offline-description').textContent='离线准备未完成，联网时仍可使用。请稍后重新打开。';$('#save-status').innerHTML='<i></i>本机保存 · 离线未就绪';}
}
function pulse(fromResume=false) {
  if(document.hidden&&!fromResume)return;
  const now=Date.now(), s=state.focus.session;
  if(s?.running&&(now>=s.deadline||now-lastCheckpoint>=15000)) {
    refreshFromDisk();const previous=clone(state);const signal=reconcile(state,now);capture(state,now);
    try{persist();lastCheckpoint=now;}catch(e){state=previous;toast(e.message);}
    if(signal){render();updatePet(false);chime();toast(signal==='focus-finished'?'专注完成啦！已经开始休息。':signal==='both-finished'?'专注与休息都结束了，准备好再开始下一轮。':'休息结束啦，准备好再开始下一轮。');}
  }
  if(bjDate(now)!==lastDay){if(selectedDate===lastDay)selectedDate=bjDate(now);lastDay=bjDate(now);render();updatePet(false);}
  const due=state.tasks.filter(t=>!t.done&&t.reminder&&!t.reminded&&t.date===bjDate(now)&&t.time&&t.time<=bjTime(now).slice(0,5));
  if(due.length){const ids=new Set(due.map(t=>t.id));mutate(()=>state.tasks.forEach(t=>{if(ids.has(t.id))t.reminded=true;}));chime();toast('日程提醒：'+due.slice(0,3).map(t=>t.title).join('；'));updatePet(false);}
  tickView();
}
if(location.hash==='#goals')page='goals';
if(!storageBlocked){try{const signal=reconcile(state);if(signal)toast('已按实际时间恢复计时；完成的专注已记录。');if(!initialRaw||signal)persist();}catch(e){toast(e.message);}}
render();loadPet();setupOffline();setInterval(pulse,250);
