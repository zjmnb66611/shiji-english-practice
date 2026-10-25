/* 拾级英语练习站：所有学习数据只保存在当前浏览器。 */
(() => {
  'use strict';
  const C = window.PracticeCore;
  const KEY = 'shiji-english-practice-v1';
  const originals = window.ORIGINAL_QUESTIONS.map(q => C.normalizeQuestion(q, 'original'));
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<i class="fa fa-${name}" aria-hidden="true"></i>`;
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const today = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fmtDate = at => new Date(at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const duration = n => `${String(Math.floor(Math.max(0, n) / 60)).padStart(2, '0')}:${String(Math.max(0, n) % 60).padStart(2, '0')}`;
  const optionTag = (v, label, selected) => `<option value="${h(v)}"${String(v) === String(selected) ? ' selected' : ''}>${h(label)}</option>`;
  const btn = (text, act, cls = '', attrs = '') => `<button class="btn ${cls}" data-act="${act}" ${attrs}>${text}</button>`;
  let brokenStorage = '', storageProblem = '';
  function emptyState() { return { version: 1, bank: 'original', questions: [], attempts: [], favorites: [], notes: {}, sets: [], results: [], session: null, settings: { name: '学习者', dailyGoal: 20 } }; }
  function validateState(input) {
    if (!input || input.version !== 1) throw Error('备份版本不支持');
    for (const name of ['questions', 'attempts', 'favorites', 'sets', 'results']) if (!Array.isArray(input[name])) throw Error(`备份缺少${name}`);
    if (input.questions.length > 10000 || input.attempts.length > 100000 || input.sets.length > 3000 || input.results.length > 3000) throw Error('备份数据量超过限制');
    const result = emptyState();
    result.bank = input.bank === 'user' ? 'user' : 'original';
    result.questions = input.questions.map(q => C.normalizeQuestion(q, 'user'));
    if (new Set(result.questions.map(q => q.id)).size !== result.questions.length) throw Error('备份题目ID重复');
    const qClean = q => C.normalizeQuestion(q, q.origin === 'original' ? 'original' : 'user');
    const answerClean = (q, value) => q.type === 'single' || q.type === 'multiple' ? (Array.isArray(value) ? value.map(String).filter(a => q.options.some(o => o.label === a)) : []) : String(value || '').slice(0, 30000);
    result.attempts = input.attempts.map(a => {
      if (typeof a.id !== 'string' || !Number.isFinite(a.at) || !a.q) throw Error('备份包含无效作答记录');
      const q = qClean(a.q), answer = answerClean(q, a.answer);
      const g = C.grade(q, answer, q.type === 'essay' && !a.pending && a.self ? a.score : undefined);
      return { id: a.id.slice(0, 100), q, answer, ...g, at: a.at, seconds: Math.max(0, Math.min(Number(a.seconds) || 0, 86400)), testId: String(a.testId || '').slice(0, 100) };
    });
    if (new Set(result.attempts.map(a => a.id)).size !== result.attempts.length) throw Error('备份作答ID重复');
    result.favorites = [...new Set(input.favorites.filter(x => typeof x === 'string').map(x => x.slice(0, 100)))];
    result.notes = Object.fromEntries(Object.entries(input.notes || {}).filter(([k, v]) => typeof v === 'string' && k.length < 110).map(([k, v]) => [k, v.slice(0, 10000)]));
    result.sets = input.sets.map(t => {
      if (!t || !Array.isArray(t.questions) || !t.questions.length || t.questions.length > 2000) throw Error('测试集合不完整');
      return { id: String(t.id).slice(0, 100), name: String(t.name).slice(0, 150), origin: t.origin === 'original' ? 'original' : 'user', minutes: Math.max(1, Math.min(300, Number(t.minutes) || 30)), questions: t.questions.map(qClean), createdAt: Number(t.createdAt) || Date.now() };
    });
    result.results = input.results.map(r => ({ id: String(r.id).slice(0, 100), name: String(r.name).slice(0, 150), origin: r.origin === 'original' ? 'original' : 'user', at: Number(r.at) || Date.now(), seconds: Math.max(0, Number(r.seconds) || 0), auto: !!r.auto }));
    if (input.session) {
      const t = input.session;
      if (!Array.isArray(t.questions) || !t.questions.length || t.questions.length > 2000 || !['practice', 'exam'].includes(t.mode)) throw Error('进行中的练习数据无效');
      const questions = t.questions.map(qClean);
      const answers = Object.fromEntries(questions.map(q => [q.id, answerClean(q, (t.answers || {})[q.id])]));
      const graded = Object.fromEntries(Object.entries(t.graded || {}).filter(([id, aid]) => questions.some(q => q.id === id) && result.attempts.some(a => a.id === aid)));
      result.session = { id: String(t.id).slice(0, 100), name: String(t.name).slice(0, 150), origin: t.origin === 'original' ? 'original' : 'user', mode: t.mode, questions, answers, graded,
        index: Math.max(0, Math.min(questions.length - 1, Number(t.index) || 0)), startedAt: Number(t.startedAt) || Date.now(), questionAt: Number(t.questionAt) || Date.now(), deadline: t.mode === 'exam' && Number.isFinite(t.deadline) ? t.deadline : null };
    }
    result.settings = { name: String(input.settings?.name || '学习者').slice(0, 30), dailyGoal: Math.max(1, Math.min(300, Number(input.settings?.dailyGoal) || 20)) };
    return result;
  }
  let state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? validateState(JSON.parse(raw)) : emptyState();
  } catch (e) {
    try { brokenStorage = localStorage.getItem(KEY) || ''; } catch (_) { /* 浏览器可能禁用存储。 */ }
    state = emptyState(); storageProblem = `本地记录未能读取：${e.message}。请先在设置中导出原始记录，再处理。`;
  }
  let view = state.session ? 'quiz' : 'home';
  let navOpen = false, resultId = '', wrongTab = 'active', historyTab = 'sets';
  let filters = { search: '', section: 'all', type: 'all', level: 'all', status: 'all', page: 1 };
  let imported = null, lastFocus = null;
  let database = null, writes = Promise.resolve(), pendingWrites = 0, saveError = '';
  const allQuestions = () => [...originals, ...state.questions];
  const bankQuestions = (ready = true) => allQuestions().filter(q => q.origin === state.bank && (!ready || q.ready));
  const bankAttempts = () => state.attempts.filter(a => a.q.origin === state.bank);
  const bankLabel = () => state.bank === 'original' ? '原创练习' : '我的题库';
  const metrics = () => C.metrics(allQuestions(), state.attempts, state.bank);
  function toast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('toast-show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('toast-show'), 3800); }
  function commit(fn) {
    if (brokenStorage) { toast('请先在设置中导出并重置损坏的记录。'); return false; }
    const next = C.clone(state);
    try {
      fn(next);
      if (database) {
        state = next; pendingWrites++; updateSaveStatus();
        writes = writes.catch(() => {}).then(() => new Promise((resolve, reject) => {
          const tx = database.transaction('records', 'readwrite');
          tx.objectStore('records').put(C.clone(next), 'state');
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || Error('浏览器存储写入失败')); tx.onabort = () => reject(tx.error || Error('存储事务被中断'));
        })).then(() => { saveError = ''; }).catch(e => { saveError = e.message; toast('浏览器未能保存最新修改，请立即导出完整备份。'); }).finally(() => { pendingWrites--; updateSaveStatus(); });
      } else { localStorage.setItem(KEY, JSON.stringify(next)); state = next; }
      return true;
    }
    catch (e) { toast(`未保存：${e.message}。空间不足时请先导出备份。`); return false; }
  }
  function navigate(next) { view = next; navOpen = false; filters.page = 1; filters.search = ''; closeModal(); render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function empty(title, description, action = '') { return `<div class="empty"><div class="empty-symbol">${icon('book')}</div><h3>${title}</h3><p>${description}</p>${action}</div>`; }
  function pageHead(title, subtitle, actions = '') { return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="head-actions no-print">${actions}</div></div>`; }
  function source(q) { return `<div class="source-line">${icon('file-text-o')} ${h(q.source)}${q.page ? ` · 第 ${h(q.page)} 页` : ''}${q.number ? ` · 原题号 ${h(q.number)}` : ''}</div>`; }
  function chips(q) { return `<span class="pill">${h(q.section)}</span> <span class="pill green">${h(q.tag)}</span> <span class="pill ${q.level === 3 ? 'orange' : ''}">${['', '基础', '进阶', '挑战'][q.level]}</span> <span class="pill">${C.TYPES[q.type]}</span>`; }
  function sessionBanner() {
    const t = state.session;
    if (!t || view === 'quiz') return '';
    return `<div class="session-banner"><span>${icon('clock-o')} 有一个${t.mode === 'exam' ? '限时测试' : '练习'}正在进行：${h(t.name)}${t.mode === 'exam' ? ' · 倒计时仍在继续' : ''}</span>${btn('继续作答 →', 'resume', 'small')}</div>`;
  }
  function sidebar(m) {
    const nav = [ ['home','学习概览','th-large'],['library','专项练习','pencil-square-o'],['wrong','我的错题','bookmark-o'],['tests','测试中心','files-o'],['favorites','收藏夹','star-o'],['report','学习报告','bar-chart'] ];
    return `<aside class="sidebar ${navOpen ? 'open' : ''}"><div class="brand"><div class="brand-icon">${icon('leaf')}</div><div><div class="brand-name">拾级</div><div class="brand-en">STEP BY STEP</div></div></div><div class="nav-label">我的学习 / LEARNING</div><nav class="nav">${nav.map(([id, label, ico]) => `<button data-act="nav" data-view="${id}" class="${view === id ? 'active' : ''}"${view === id ? ' aria-current="page"' : ''}>${icon(ico)}<span>${label}</span>${id === 'wrong' && m.wrong ? `<span class="badge">${m.wrong}</span>` : ''}</button>`).join('')}</nav><div class="nav-label">学习工具 / TOOLS</div><nav class="nav"><button data-act="nav" data-view="manage" class="${view === 'manage' ? 'active' : ''}">${icon('database')}题库管理</button><button data-act="nav" data-view="settings" class="${view === 'settings' ? 'active' : ''}">${icon('sliders')}设置与备份</button></nav><div class="side-book"><div class="row gap8"><span class="pill orange"><span class="dot"></span> 题库待补充</span></div><div style="font-size:12px;font-weight:650;margin-top:11px">《必刷2000题 · 英语》</div><p>当前尚未导入整本原书。可将核对后的题目添加到我的题库。</p><div class="book-progress"></div><button class="link-btn" data-act="nav" data-view="manage" style="margin-top:12px">管理题库与来源 →</button></div><div class="side-footer"><div class="avatar">${h(state.settings.name.slice(0,1))}</div><div><div style="font-size:12px;font-weight:650">${h(state.settings.name)}</div><small>本地学习空间</small></div><button class="spacer" data-act="nav" data-view="settings" aria-label="打开设置">${icon('angle-right')}</button></div></aside>`;
  }
  function render() {
    const m = metrics();
    const titles = { home: '学习概览', library: '专项练习', wrong: '我的错题', tests: '测试中心', favorites: '收藏夹', report: '学习报告', manage: '题库管理', settings: '设置与备份', quiz: '专注练习', result: '测试结果' };
    const pages = { home: dashboard, library: library, wrong: wrong, tests: tests, favorites: favorites, report: report, manage: manage, settings: settings, quiz: quiz, result: result };
    app.innerHTML = `${sidebar(m)}<div class="app-overlay ${navOpen ? 'visible' : ''}" data-act="menu"></div><main class="main"><header class="topbar"><div class="row"><button class="mobile-menu" data-act="menu" aria-label="展开学习导航">${icon('bars')}</button><div class="breadcrumb">学习空间 <span style="color:#b4bdb0">/</span> <span>${titles[view]}</span></div></div><div class="top-right"><div class="bank-switch" aria-label="切换题库"><button data-act="bank" data-bank="original" class="${state.bank === 'original' ? 'selected' : ''}">原创练习</button><button data-act="bank" data-bank="user" class="${state.bank === 'user' ? 'selected' : ''}">我的题库</button></div><span class="pill green"><span class="dot"></span> 本地保存</span><span class="date-label">${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'})}</span></div></header><div class="content">${storageProblem ? `<div class="alert red mb">${h(storageProblem)}</div>` : ''}${sessionBanner()}${(pages[view] || dashboard)()}<footer class="footer"><span>拾级 · 每一小步，都算进步。</span><span>当前：${bankLabel()} · 学习记录保存在此浏览器 · 建议定期备份</span></footer></div></main>`;
    updateTimer();
  }
  function dashboard() {
    const m = metrics(), history = bankAttempts(), doneToday = history.filter(a => today(new Date(a.at)) === today()).length;
    const sections = [...new Set(bankQuestions().map(q => q.section))];
    const daily = Array.from({length:7},(_,i)=>{ const d = new Date(); d.setDate(d.getDate() - 6 + i); return { label: ['日','一','二','三','四','五','六'][d.getDay()], value: history.filter(a => today(new Date(a.at)) === today(d)).length }; });
    const max = Math.max(5, ...daily.map(d => d.value));
    const metric = (label, value, unit, foot, ico) => `<div class="card metric"><div class="metric-top">${label}<span class="metric-icon">${icon(ico)}</span></div><div class="metric-value mono">${value}<span>${unit}</span></div><div class="metric-foot">${foot}</div></div>`;
    return `${pageHead(`你好，${h(state.settings.name)} <span style="font-size:23px">☀</span>`, '给今天留一点练习时间，让英语慢慢成为你的底气。', btn(`${icon('sliders')} 学习目标`,'goal'))}<div class="hero"><div class="hero-copy"><div class="eyebrow">A LITTLE PRACTICE, EVERY DAY</div><h2>把每一次练习，<br>变成看得见的进步。</h2><p>练习 · 复盘 · 再出发。按自己的节奏，拾级而上。</p><div class="row">${btn(`${icon('play')} 开始今日练习`,'quick','primary')}${btn('复习错题 →','review-due','',m.wrong ? '' : 'disabled')}</div></div><div class="hero-art" aria-hidden="true"><div class="art-ring"></div><div class="art-book"><span>ENGLISH NOTES</span><b>One step<br>at a time.</b><em>STUDY / GROW</em></div><div class="art-tag">日积月累<br>步步向前</div></div></div><div class="source-strip">${icon('info-circle')} ${state.bank === 'original' ? `当前可练习 ${originals.length} 道本站原创题，均附参考答案与解析。原书完整题库尚未导入。` : `我的题库：${m.total} 道已核对可练习，${state.questions.filter(q => !q.ready).length} 道待核对。`}</div><div class="grid4">${metric('已练习题目',m.tried,`/ ${m.total} 题`,'按已作答的不同题目计数','check-square-o')}${metric('客观题正确率',m.accuracy === null ? '—' : m.accuracy, m.accuracy === null ? '' : '%',m.objective ? `累计 ${m.objective} 次客观题作答` : '完成练习后开始统计','pie-chart')}${metric('待巩固错题',m.wrong,'题',m.due ? `其中 ${m.due} 题到期可复习` : '连续答对 2 次后标记巩固','bookmark-o')}${metric('作答耗时',Math.round(m.seconds/60),'分钟','按提交记录的停留耗时累计','clock-o')}</div><div class="dashboard-grid"><div class="stack"><section class="card"><div class="card-head"><div><h2>按章节，稳步推进</h2><small style="display:block;margin-top:7px">每次攻克一个小知识点</small></div><button class="link-btn" data-act="nav" data-view="library">全部练习 →</button></div>${sections.length ? sections.map((name,i)=>{const qs=bankQuestions().filter(q=>q.section===name),n=qs.filter(q=>m.mastery[q.id]).length;return `<div class="chapter-row"><div class="chapter-icon">${icon(['font','cubes','file-text-o','pencil'][i%4])}</div><div><div class="row between"><span class="chapter-name">${h(name)}</span><span class="muted" style="font-size:10px">${n} / ${qs.length}</span></div><div class="chapter-meta">${n ? `已练习 ${Math.round(n/qs.length*100)}%` : '从第一道题开始积累'}</div><div class="progress-track"><span style="width:${n/qs.length*100}%"></span></div></div><button class="btn icon small" data-act="chapter" data-section="${h(name)}" aria-label="练习${h(name)}">${icon('angle-right')}</button></div>`;}).join('') : empty('你的专属题库，等待填入','导入核对后的题目，就可以按章节练习。',btn('导入题目','import','primary'))}</section><section class="card"><div class="card-head"><h2>最近的测试</h2><button class="link-btn" data-act="nav" data-view="tests">前往测试中心 →</button></div>${historyRows(3)}</section></div><div class="dashboard-right"><section class="card"><div class="card-head"><h2>这周的脚印</h2><span class="pill">近 7 天</span></div><div class="week-bars">${daily.map((d,i)=>`<div class="day-bar ${i===6?'today':''}" style="--h:${d.value/max*100}%"><span style="height:${d.value/max*100}%"></span>${d.value ? `<b>${d.value}</b>` : ''}<small>${d.label}</small></div>`).join('')}</div><p class="week-caption">统计当前题库每天的提交次数，包含复习作答；没有记录的日期显示为 0。</p><div class="goal-card"><div class="row between"><h3 style="font-size:12px;color:#9f8354">今日小目标</h3><span class="pill orange">${doneToday>=state.settings.dailyGoal?'已完成':'进行中'}</span></div><div class="goal-number mono" style="margin-top:10px">${doneToday}<small style="font-size:12px;font-weight:400"> / ${state.settings.dailyGoal} 次</small></div><p>每天一点点，让坚持有迹可循。</p><div class="progress-track" style="background:#ebe3cf"><span style="width:${Math.min(100,doneToday/state.settings.dailyGoal*100)}%;background:#c1a66d"></span></div></div></section><section class="card resource-card"><div class="row gap8 mb"><span class="pill orange">${icon('book')} 原书资料</span></div><h3 style="font-size:14px;margin-bottom:10px">题目与来源，都要对得上</h3><p>已确认《必刷2000题 · 英语》的书目信息。整本正文和答案解析尚待补充，当前练习不计作原书收录进度。</p><button class="text-btn" data-act="sources" style="margin-top:15px;color:#9a7b40">查看来源核查 →</button></section></div></div>`;
  }
  function filterBar(manager = false) {
    return `<form id="filter-form" class="card filters no-print"><label class="field search"><span>搜索题干 / 知识点 / 原题号</span><input name="search" value="${h(filters.search)}" placeholder="输入关键词，找到想练的题目"></label><label class="field"><span>章节</span><select name="section">${optionTag('all','全部章节',filters.section)}${[...new Set((manager?state.questions:bankQuestions(false)).map(q=>q.section))].map(x=>optionTag(x,x,filters.section)).join('')}</select></label><label class="field"><span>题型</span><select name="type">${optionTag('all','全部题型',filters.type)}${Object.entries(C.TYPES).map(([v,l])=>optionTag(v,l,filters.type)).join('')}</select></label><label class="field"><span>${manager?'核对状态':'难度'}</span><select name="${manager?'status':'level'}">${manager ? [ ['all','全部状态'],['draft','待核对'],['ready','可练习'] ].map(([v,l])=>optionTag(v,l,filters.status)).join('') : [['all','全部难度'],['1','基础'],['2','进阶'],['3','挑战']].map(([v,l])=>optionTag(v,l,filters.level)).join('')}</select></label><button class="btn primary" type="submit">${icon('search')} 筛选</button>${btn('重置','reset-filters')}</form>`;
  }
  function filtered(list, manager = false) {
    return list.filter(q=>(filters.section==='all'||q.section===filters.section)&&(filters.type==='all'||q.type===filters.type)&&(manager || filters.level==='all'||q.level===Number(filters.level))&&(!manager||filters.status==='all'||q.ready===(filters.status==='ready'))&&(!filters.search||[q.stem,q.section,q.tag,q.number,q.source].some(x=>String(x).toLowerCase().includes(filters.search.toLowerCase()))));
  }
  function questionList(list, mode = 'practice') {
    const limit=12,pages=Math.max(1,Math.ceil(list.length/limit)); filters.page=Math.min(filters.page,pages);
    const m=metrics().mastery;
    if(!list.length) return `<div class="card">${empty('这里还没有题目','可以调整筛选条件，或前往题库管理添加你自己的题目。',btn('题库管理','nav','', 'data-view="manage"'))}</div>`;
    return `<div class="question-list">${list.slice((filters.page-1)*limit,filters.page*limit).map((q,i)=>`<article class="card q-item"><div class="q-index">${String((filters.page-1)*limit+i+1).padStart(2,'0')}</div><div class="q-body"><div class="row gap8 wrap">${chips(q)}${!q.ready?'<span class="pill orange">待核对</span>':''}</div><p class="q-snippet">${h(q.stem)}</p>${mode==='wrong'?`<small class="muted">累计答错 ${m[q.id]?.errors||0} 次 · 当前连续答对 ${m[q.id]?.streak||0} 次${m[q.id]?.activeWrong?' · 待巩固':' · 已巩固'}</small>`:''}${source(q)}<div class="q-actions">${q.ready?btn(mode==='wrong'?'重练这道题':'练习这道题','practice-one','small primary',`data-id="${h(q.id)}"`):''}${btn('查看题目与解析','inspect','small',`data-id="${h(q.id)}"`)}${mode==='manage'&&q.origin==='user'?`${!q.ready?btn('核对后启用','verify','small soft',`data-id="${h(q.id)}"`):btn('退回待核对','unverify','small',`data-id="${h(q.id)}"`)}${btn('编辑','edit-question','small',`data-id="${h(q.id)}"`)}${btn('删除','delete-question','small danger',`data-id="${h(q.id)}"`)}`:''}</div></div><div class="item-actions">${btn(icon(state.favorites.includes(q.id)?'star':'star-o'),'favorite',`icon ${state.favorites.includes(q.id)?'active-fav':''}`,`data-id="${h(q.id)}" aria-label="${state.favorites.includes(q.id)?'取消收藏':'收藏题目'}"`)}</div></article>`).join('')}</div><div class="list-footer"><span>共 ${list.length} 道题 · 第 ${filters.page} / ${pages} 页</span><div class="row gap8">${btn('上一页','page','small',`data-step="-1" ${filters.page===1?'disabled':''}`)}${btn('下一页','page','small',`data-step="1" ${filters.page===pages?'disabled':''}`)}</div></div>`;
  }
  function library() { const list=filtered(bankQuestions()); return `${pageHead('专项练习','选择一个知识点，认真做完，再回头看看。',btn(`${icon('random')} 随机练习`,'random-filter','primary'))}${filterBar()}<div class="row between mb"><span class="muted" style="font-size:12px">${bankLabel()} · ${list.length} 道可练习</span>${btn('按当前筛选顺序练习','practice-filter','small')}</div>${questionList(list)}`; }
  function wrong() { const m=metrics(); const list=filtered(Object.values(m.mastery).filter(x=>x.errors>0&&(wrongTab==='active'?x.activeWrong:!x.activeWrong)).map(x=>allQuestions().find(q=>q.id===x.q.id&&q.ready)||x.q)); return `${pageHead('把错题，变成得分点','答错后自动收录；连续答对 2 次后，移入已巩固。',btn('复习到期错题','review-due','primary',m.due?'':'disabled'))}<div class="tabs"><button data-act="wrong-tab" data-tab="active" class="${wrongTab==='active'?'active':''}">待巩固 · ${m.wrong}</button><button data-act="wrong-tab" data-tab="mastered" class="${wrongTab==='mastered'?'active':''}">已巩固 · ${Object.values(m.mastery).filter(x=>x.errors&&!x.activeWrong).length}</button></div><div class="alert mb">首次答错立即可复习。重练答对一次后，建议隔 1 天再练；连续答对两次即标记巩固。已删除或停用的题目保留历史，但不会出现在可开始的复习队列中。</div>${filterBar()}${list.length?questionList(list,'wrong'):`<div class="card">${empty(wrongTab==='active'?'还没有待巩固错题':'巩固需要一点时间',wrongTab==='active'?'完成练习后，答错的题目会自动出现在这里。':'对曾经的错题连续答对两次，就会记录在这里。',btn('去做练习','nav','primary','data-view="library"'))}</div>`}`; }
  function favorites() { const list=filtered(bankQuestions().filter(q=>state.favorites.includes(q.id))); return `${pageHead('值得再看一遍的题','收藏你想回顾的表达、题型和解题思路。',btn('练习当前收藏','practice-favorites','primary'))}${filterBar()}${questionList(list)}`; }
  function startPractice(list, name = '专项练习') {
    if (state.session) { view='quiz'; render(); toast('先继续或结束当前练习，再开始新的练习。'); return; }
    const questions=list.filter(q=>q.ready);
    if(!questions.length){toast('当前范围没有已核对可练习的题目。');return;}
    if(commit(s=>{s.session={id:uid('practice'),mode:'practice',origin:state.bank,name,questions:C.clone(questions),answers:{},graded:{},index:0,startedAt:Date.now(),questionAt:Date.now(),deadline:null};})){navigate('quiz');}
  }
  function startExam(set) {
    if(state.session){view='quiz';render();toast('当前已有进行中的练习，请先继续或结束。');return;}
    if(commit(s=>{s.session={id:uid('test'),mode:'exam',origin:set.origin,name:set.name,questions:C.clone(set.questions),answers:{},graded:{},index:0,startedAt:Date.now(),questionAt:Date.now(),deadline:Date.now()+set.minutes*60000};s.bank=set.origin;})){navigate('quiz');}
  }
  function answerText(q, answer, reference=false) {
    if(q.type==='single'||q.type==='multiple'){
      const a=Array.isArray(answer)?answer:[];
      return a.length?a.map(label=>`${label}. ${q.options.find(o=>o.label===label)?.text||''}`).join('\n'):'未作答';
    }
    if(reference&&q.type==='blank')return q.answer.join(' / ');
    return String(answer||'未作答');
  }
  function feedback(a, allowScore = true) {
    const q=a.q;
    return `<section class="explanation ${a.correct===false?'wrong':''}"><h3>${a.pending?`${icon('pencil')} 请对照参考答案自评`:a.self?`自评：${a.score} / ${a.max} 分${a.correct?' · 已达到本次练习标准':''}`:a.correct?`${icon('check-circle')} 回答正确`:`${icon('info-circle')} 再记牢这个知识点`}</h3><div class="answer-label">${q.type==='essay'?'参考答案 / 范文':'正确答案'}</div><div class="reference">${h(answerText(q,q.answer,true))}</div><div class="answer-label">解析与解题思路</div><p>${h(q.explanation)}</p>${a.pending&&allowScore?`<div class="answer-label">翻译写作由你对照标准自评（3分及以上记为本次通过）</div><div class="score-options">${[0,1,2,3,4,5].map(n=>`<button data-act="self-score" data-attempt="${h(a.id)}" data-score="${n}" aria-label="自评${n}分">${n}分</button>`).join('')}</div>`:''}</section>`;
  }
  function quiz() {
    const t=state.session;
    if(!t)return `<div class="card">${empty('当前没有进行中的练习','从章节练习或测试中心开始。',btn('去练习','nav','primary','data-view="library"'))}</div>`;
    const q=t.questions[t.index],answer=t.answers[q.id]||(q.options.length?[]:''),a=state.attempts.find(x=>x.id===t.graded[q.id]);
    const answered=Object.values(t.answers).filter(x=>Array.isArray(x)?x.length:String(x).trim()).length;
    return `${pageHead(h(t.name),`${t.mode==='exam'?'限时测试 · 交卷后显示解析':'练习模式 · 提交后显示答案与解析'} · ${t.origin==='original'?'本站原创题':'我的题库'} · 已作答 ${answered} / ${t.questions.length}`,btn(t.mode==='exam'?'交卷并查看结果':'结束本次练习',t.mode==='exam'?'submit-exam':'finish-practice',t.mode==='exam'?'primary':'danger'))}<div class="quiz-layout"><section class="card quiz-card"><div class="quiz-meta"><div class="row gap8 wrap">${chips(q)}</div><span class="muted mono" style="font-size:11px">${t.index+1} / ${t.questions.length}</span></div><h2 class="q-title">${h(q.stem)}</h2>${q.passage?`<details open><summary class="link-btn" style="margin-top:15px;cursor:pointer">阅读材料（可收起）</summary><div class="passage">${h(q.passage)}</div></details>`:''}${q.options.length?`<div class="options">${q.options.map(o=>`<button class="option ${answer.includes(o.label)?'selected':''} ${a?(q.answer.includes(o.label)?'correct':answer.includes(o.label)?'wrong':''):''}" data-act="choose" data-value="${o.label}" aria-pressed="${answer.includes(o.label)}" ${a?'disabled':''}><span class="option-key">${o.label}</span><span>${h(o.text)}</span></button>`).join('')}</div>${q.type==='multiple'?'<small class="muted">多选题：须完整选对全部正确选项，才计为正确。</small>':''}`:`<div class="question-input"><label class="field"><span>${q.type==='blank'?'填写空格中的答案':'写下你的翻译 / 作文'}</span>${q.type==='blank'?`<input id="quiz-answer" value="${h(answer)}" autocomplete="off" placeholder="输入答案" ${a?'disabled':''}>`:`<textarea id="quiz-answer" placeholder="在这里作答，提交后对照参考答案自评" ${a?'disabled':''}>${h(answer)}</textarea>`}</label>${q.type==='essay'?`<small class="muted" id="word-count" style="display:block;margin-top:8px">${String(answer).trim()?String(answer).trim().split(/\s+/).length:0} 个空格分隔词</small>`:''}</div>`}${source(q)}${a?feedback(a):''}<div class="quiz-bottom"><div class="row gap8">${btn('上一题','quiz-prev','',t.index===0?'disabled':'')}${btn(`${icon(state.favorites.includes(q.id)?'star':'star-o')} ${state.favorites.includes(q.id)?'已收藏':'收藏'}`,'favorite',state.favorites.includes(q.id)?'active-fav':'',`data-id="${h(q.id)}"`)}</div><div class="row gap8">${t.mode==='practice'&&!a?`${btn('不会，查看解析','skip')}${btn('提交答案','grade','primary')}`:t.index<t.questions.length-1?btn('下一题 →','quiz-next','primary'):t.mode==='exam'?btn('交卷并查看结果','submit-exam','primary'):btn('完成本次练习','finish-practice','primary')}</div></div></section><aside class="quiz-side"><section class="card"><div class="row between"><h3 style="font-size:13px">${t.mode==='exam'?'剩余时间':'练习进度'}</h3><span class="pill">${t.mode==='exam'?'限时':'自主节奏'}</span></div>${t.mode==='exam'?'<div class="timer" id="exam-timer">--:--</div>':`<div class="progress-track" style="margin-top:17px"><span style="width:${Object.keys(t.graded).length/t.questions.length*100}%"></span></div>`}<div class="question-map">${t.questions.map((item,i)=>{const g=state.attempts.find(x=>x.id===t.graded[item.id]);const filled=Array.isArray(t.answers[item.id])?t.answers[item.id].length:String(t.answers[item.id]||'').trim();return `<button data-act="quiz-jump" data-index="${i}" class="${i===t.index?'current':''} ${g?(g.pending?'pending':g.correct?'correct':'wrong'):filled?'answered':''}" aria-label="跳转到第${i+1}题">${i+1}</button>`;}).join('')}</div><div class="legend"><span>已作答 / 已提交</span></div><p class="keyboard-hint">快捷键：数字键选择选项，Enter 提交，← → 切换题目。输入答案时不触发快捷键。${t.mode==='exam'?'<br>离开页面后仍按截止时间计时；重新打开时到期自动交卷。':''}</p></section><section class="card mt"><h3 style="font-size:13px;margin-bottom:12px">${icon('sticky-note-o')} 我的笔记</h3><textarea id="question-note" class="input notes" placeholder="记下易错点或自己的理解…">${h(state.notes[q.id]||'')}</textarea><small class="muted" style="display:block;font-size:10px;margin-top:9px">随输入保存到当前题目</small></section></aside></div>`;
  }
  function gradeCurrent(skip=false) {
    const t=state.session;if(!t||t.mode!=='practice')return;
    const q=t.questions[t.index];if(t.graded[q.id])return;
    const answer=skip?(q.options.length?[]:''):(t.answers[q.id]||(q.options.length?[]:''));
    if(!skip&&(Array.isArray(answer)?!answer.length:!String(answer).trim())){toast('先填写或选择答案，也可以点击“不会，查看解析”。');return;}
    const a={id:uid('attempt'),q:C.clone(q),answer,...C.grade(q,answer),at:Date.now(),seconds:Math.max(1,Math.round((Date.now()-t.questionAt)/1000)),testId:''};
    if(commit(s=>{s.attempts.push(a);s.session.graded[q.id]=a.id;s.session.answers[q.id]=answer;})){render();document.querySelector('.explanation')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
  }
  function moveQuiz(index) { const t=state.session;if(!t)return;index=Math.max(0,Math.min(t.questions.length-1,index));if(commit(s=>{s.session.index=index;s.session.questionAt=Date.now();})){render();window.scrollTo({top:0,behavior:'instant'});} }
  function finishPractice() {
    if(!state.session||state.session.mode!=='practice')return;
    const graded=Object.keys(state.session.graded).length;
    if(graded<state.session.questions.length&&!confirm(`本次已提交 ${graded} / ${state.session.questions.length} 题。结束后，未提交的答案不会计入成绩。确定结束吗？`))return;
    if(commit(s=>{s.session=null;})){navigate('report');toast('已保存本次提交的练习记录。');}
  }
  function submitExam(auto=false) {
    const t=state.session;if(!t||t.mode!=='exam')return;
    const unfilled=t.questions.filter(q=>{const a=t.answers[q.id];return Array.isArray(a)?!a.length:!String(a||'').trim();}).length;
    if(!auto&&!confirm(unfilled?`还有 ${unfilled} 题未作答，将按0分计。现在交卷吗？`:'确认交卷并查看答案与解析吗？'))return;
    const seconds=Math.max(1,Math.round((Math.min(Date.now(),t.deadline)-t.startedAt)/1000));
    if(commit(s=>{
      for(const q of t.questions){const answer=t.answers[q.id]||(q.options.length?[]:'');s.attempts.push({id:uid('attempt'),q:C.clone(q),answer,...C.grade(q,answer),at:Date.now(),seconds:Math.round(seconds/t.questions.length),testId:t.id});}
      s.results.unshift({id:t.id,name:t.name,origin:t.origin,at:Date.now(),seconds,auto});s.session=null;
    })){resultId=t.id;navigate('result');if(auto)toast('测试时间已到，已自动交卷。');}
  }
  function result() {
    const r=state.results.find(x=>x.id===resultId);
    if(!r)return `<div class="card">${empty('请选择一次测试记录','在测试中心打开历史记录即可查看完整解析。',btn('测试中心','nav','primary','data-view="tests"'))}</div>`;
    const attempts=state.attempts.filter(a=>a.testId===r.id),summary=C.resultSummary(attempts);
    return `${pageHead('每一次测试，都是一次定位',`${h(r.name)} · ${fmtDate(r.at)} · ${r.origin==='original'?'本站原创题':'我的题库'}`,`${btn(`${icon('print')} 打印结果`,'print')}${btn('返回测试中心','nav','','data-view="tests"')}`)}<div class="card result-header"><span class="pill ${summary.pending?'orange':'green'}">${r.auto?'到时自动交卷':'测试已完成'}${summary.pending?' · 含待自评题':''}</span><div class="result-number mono">${summary.pending?'待自评':summary.percent}<small>${summary.pending?'':' / 100'}</small></div><p class="muted" style="font-size:12px">${summary.pending?`已确定得分 ${summary.score} 分，${summary.pending} 道主观题待自评`:`原始得分 ${summary.score} / ${summary.max} 分 · 按试卷总分折算`}</p><div class="result-meta"><span>客观题答对 ${summary.correct} / ${summary.objective}</span><span>未作答 ${summary.unanswered} 题</span><span>用时 ${duration(r.seconds)}</span></div>${btn('重练本次错题','retry-result','primary',`data-result="${h(r.id)}"`)}</div><div class="alert mt mb">客观题每题1分，翻译写作每题5分。多选须全部选对；未作答计0分。主观题自评完成前，不计算总百分制成绩。</div><div class="question-list">${attempts.map((a,i)=>`<article class="card paper-review"><div class="row between"><div class="row wrap gap8"><span class="pill">第 ${i+1} 题</span>${chips(a.q)}</div><span class="pill ${a.pending?'orange':a.correct?'green':'red'}">${a.pending?'待自评':a.self?`自评 ${a.score} 分`:a.correct?'正确':'错误 / 未答'}</span></div><div class="q-snippet">${h(a.q.stem)}</div>${a.q.passage?`<details><summary class="link-btn">查看阅读材料</summary><div class="passage">${h(a.q.passage)}</div></details>`:''}${a.q.options.length?`<div class="small-stack" style="font-size:12px;line-height:1.8;margin:15px 0">${a.q.options.map(o=>`<div>${o.label}. ${h(o.text)}</div>`).join('')}</div>`:''}<div class="answer-label">我的答案</div><div class="reference">${h(answerText(a.q,a.answer))}</div>${feedback(a)}${source(a.q)}<div class="q-actions">${btn('收藏 / 取消收藏','favorite','small',`data-id="${h(a.q.id)}"`)}</div></article>`).join('')}</div>`;
  }
  function historyRows(limit=100) {
    const rows=state.results.filter(r=>r.origin===state.bank).slice(0,limit);
    if(!rows.length)return empty('还没有测试记录','完成一场测试，就能在这里回顾成绩和解析。',btn('创建第一场测试','create-test','small'));
    return rows.map(r=>{const m=C.resultSummary(state.attempts.filter(a=>a.testId===r.id));return `<div class="history-row"><div class="history-icon">${icon('file-text-o')}</div><div class="spacer"><h3 style="font-size:12px">${h(r.name)}</h3><p>${fmtDate(r.at)} · 用时 ${duration(r.seconds)} · ${m.objective} 道客观题</p></div><span class="history-score mono">${m.pending?'待评':m.percent}<small style="font-size:10px;font-weight:400">${m.pending?'':'分'}</small></span>${btn('查看','open-result','small',`data-result="${h(r.id)}"`)}</div>`;}).join('');
  }
  function tests() {
    const sets=state.sets.filter(t=>t.origin===state.bank),count=state.results.filter(t=>t.origin===state.bank).length;
    return `${pageHead('测一测，找到下一步方向','自主组卷、限时作答、自动交卷，留住每次测试的完整记录。',btn(`${icon('plus')} 创建测试集合`,'create-test','primary'))}<div class="tabs"><button data-act="test-tab" data-tab="sets" class="${historyTab==='sets'?'active':''}">我的测试集合 · ${sets.length}</button><button data-act="test-tab" data-tab="history" class="${historyTab==='history'?'active':''}">历史成绩 · ${count}</button></div>${historyTab==='history'?`<section class="card">${historyRows()}</section>`:sets.length?`<div class="grid3">${sets.map(t=>`<article class="card test-card"><div class="row between"><div class="test-icon">${icon('files-o')}</div><span class="pill">${t.questions.length} 题 · ${t.minutes} 分钟</span></div><h3>${h(t.name)}</h3><p>${[...new Set(t.questions.map(q=>q.section))].map(h).join(' / ')}<br>创建于 ${fmtDate(t.createdAt)}<br>集合保存题目快照，重测使用相同题目。</p><div class="row between">${btn('开始测试 →','start-test','primary small',`data-id="${h(t.id)}"`)}${btn('删除集合','delete-test','small',`data-id="${h(t.id)}"`)}</div></article>`).join('')}</div>`:`<div class="card">${empty('给自己出一份小试卷','选择章节、题型、题量和时长，创建可反复使用的测试集合。',btn('创建测试集合','create-test','primary'))}</div>`}`;
  }
  function report() {
    const m=metrics(),attempts=bankAttempts(),objective=attempts.filter(a=>a.q.type!=='essay');
    const sections=[...new Set([...bankQuestions().map(q=>q.section),...objective.map(a=>a.q.section)])];
    const stats=sections.map(name=>{const a=objective.filter(a=>a.q.section===name);return {name,n:a.length,rate:a.length?Math.round(a.filter(a=>a.correct).length/a.length*100):null};});
    const weak=[...stats].filter(x=>x.n>=3).sort((a,b)=>a.rate-b.rate)[0];
    const recent=state.results.filter(r=>r.origin===state.bank).slice(0,6).reverse();
    const pending=attempts.filter(a=>a.pending);
    const assessment=!objective.length?'还没有客观题作答记录。完成一组练习后，这里会根据真实记录生成学习建议。':objective.length<10?`目前有 ${objective.length} 次客观题作答，样本较少，先继续练习以了解自己的表现。${m.wrong?`已有 ${m.wrong} 道错题待巩固，可以先回顾这些题。`:''}`:`累计客观题正确率为 ${m.accuracy}%。${weak?`在已有至少3次作答的章节中，「${weak.name}」正确率最低（${weak.rate}%，${weak.n}次作答），建议优先复习。`:''}${m.due?` 目前还有 ${m.due} 道到期错题，可安排一次短复习。`:' 可以继续练习未做过的题目，扩大覆盖范围。'}`;
    return `${pageHead('进步，有迹可循','用真实的练习记录，给下一次学习一点方向。',btn(`${icon('print')} 打印报告`,'print'))}<div class="grid4"><div class="count-block"><b>${m.accuracy===null?'—':m.accuracy+'%'}</b>累计客观题正确率</div><div class="count-block"><b>${m.total?Math.round(m.tried/m.total*100):0}%</b>当前可练习题目覆盖率</div><div class="count-block"><b>${Object.values(m.mastery).filter(x=>x.errors&&!x.activeWrong).length}</b>连续答对两次的历史错题</div><div class="count-block"><b>${state.results.filter(r=>r.origin===state.bank).length}</b>已完成测试次数</div></div><section class="card mt"><div class="card-head"><h2>当前学习评价</h2><span class="pill">${m.objective<10?'数据积累中':'基于作答记录'}</span></div><p class="review-text">${h(assessment)}</p><p class="report-method" style="margin-top:13px">这里评价当前题库中的练习表现，不预测真实考试成绩；反复练习同一题也计入累计正确率。翻译写作自评分开记录。</p></section><div class="grid2 mt"><section class="card"><div class="card-head"><h2>章节表现</h2><small>仅统计客观题</small></div>${stats.length?stats.map(x=>`<div class="skill-row"><span>${h(x.name)}</span><div class="progress-track"><span style="width:${x.rate||0}%"></span></div><span class="mono">${x.rate===null?'—':x.rate+'%'}</span></div><small class="muted" style="font-size:10px">${h(x.name)}：${x.n} 次作答</small>`).join(''):empty('等待第一份记录','开始练习后即可查看章节表现。')}</section><section class="card"><div class="card-head"><h2>最近测试成绩</h2><small>最近 6 次</small></div>${recent.length?`<div class="report-chart">${recent.map((r,i)=>{const t=C.resultSummary(state.attempts.filter(a=>a.testId===r.id));return `<div class="report-col" style="--h:${t.percent||0}%"><span></span><b>${t.pending?'待评':t.percent+'分'}</b><small>第${i+1}次</small></div>`;}).join('')}</div><p class="week-caption">不同测试的题目与难度可能不同，分数变化仅供本地学习回顾。</p>`:empty('还没有测试成绩','完成一场测试，查看你的成绩轨迹。',btn('去测试中心','nav','small','data-view="tests"'))}</section></div><section class="card mt"><div class="card-head"><h2>待自评的翻译 / 写作</h2><span class="pill orange">${pending.length} 题</span></div>${pending.length?pending.slice(-20).reverse().map(a=>`<div class="history-row"><div class="spacer"><p class="q-snippet">${h(a.q.stem.slice(0,120))}</p><small class="muted">${fmtDate(a.at)}</small></div>${btn('对照并评分','review-attempt','small',`data-attempt="${h(a.id)}"`)}</div>`).join(''):'<p class="muted" style="font-size:12px">当前没有待自评题目。</p>'}</section><section class="card mt"><div class="card-head"><h2>统计口径</h2></div><div class="report-method">客观题正确率 = 客观题答对次数 ÷ 客观题提交次数；包含练习、复习与测试，未作答交卷计错。覆盖率 = 当前可练习题库中至少有一次已评分作答的不同题目数 ÷ 当前可练习题目数。题目被删除或修改后，历史作答快照仍保留，历史正确率不回溯修改。作答耗时按提交前的停留时长记录，可能包含离开页面的时间。主观题由用户对照参考答案自行评分，3分及以上记为本次通过，参与错题复习记录；不参与客观题正确率。所有统计均按当前选中的题库分别计算。</div></section>`;
  }
  function manage() {
    const list=filtered(state.questions,true),ready=state.questions.filter(q=>q.ready).length;
    return `${pageHead('把你的练习册，装进题库','支持手动录入、JSON / CSV 批量导入；导入后逐题核对再启用。',`${btn(`${icon('plus')} 手动录题`,'new-question')}${btn(`${icon('upload')} 导入题库`,'import','primary')}`)}<div class="grid3 mb"><div class="count-block"><b>${state.questions.length}</b>我的题目总数</div><div class="count-block"><b>${ready}</b>已核对可练习</div><div class="count-block"><b>${state.questions.length-ready}</b>待核对题目</div></div><div class="alert orange mb">《必刷2000题 · 英语》整本题库尚未导入。这里管理的是你录入或导入的题目；请在“来源”中写清书名、页码及原题号。右上角切换到“我的题库”后即可练习已核对题目。</div><div class="row wrap mb no-print">${btn('下载 JSON 模板','template-json','small')}${btn('下载 CSV 模板','template-csv','small')}${btn('导出我的题库','export-bank','small',state.questions.length?'':'disabled')}${btn('查看已找到的资料','sources','small')}</div>${filterBar(true)}${questionList(list,'manage')}`;
  }
  function settings() {
    return `${pageHead('你的节奏，你来设置','保留学习习惯，也记得为自己的记录留一份备份。')}<div class="settings-grid"><section class="card settings-card"><h2>个人学习设置</h2><form id="settings-form"><label class="field"><span>显示名称</span><input name="name" maxlength="30" value="${h(state.settings.name)}" required></label><label class="field"><span>每日目标（提交次数）</span><input name="dailyGoal" type="number" min="1" max="300" value="${state.settings.dailyGoal}" required></label><p>每日目标是你自己制定的练习计划，包含复习提交；它不是能力评定标准。</p><button class="btn primary" type="submit">保存设置</button></form></section><section class="card settings-card"><h2>备份与恢复</h2><p style="margin-top:18px">题目、笔记、收藏、练习记录、试卷及进行中的作答保存在当前浏览器。更换设备、浏览器或清理站点数据前，请导出完整备份。</p><div class="row wrap gap8">${btn(`${icon('download')} 导出完整备份`,'backup','primary')}${btn(`${icon('upload')} 从备份恢复`,'restore')}</div><p style="margin-top:16px">备份恢复会替换此练习站当前数据，导入前会显示记录数量并再次确认。浏览器之间通过备份文件迁移；当前版本不提供账号云同步。</p>${brokenStorage?btn('导出无法读取的原始记录','export-broken','danger'):''}</section><section class="card settings-card"><h2>数据与评分说明</h2><p style="margin-top:17px">本地统计按“原创练习”和“我的题库”分别计算。客观题自动判分；多选题全部匹配才得分，填空题按预先给出的可接受答案匹配。翻译写作提供范文与评分标准，采用用户自评。</p><p style="margin-top:12px">没有接入外部埋点、远程AI评分或用户行为分析服务。页面仅会加载 Tailwind 与 Font Awesome 公共样式资源；学习记录不会通过这些资源发送。</p></section><section class="card settings-card"><h2>重新开始</h2><p style="margin-top:18px">清空将删除此练习站的全部本地题目、练习记录、试卷、收藏和笔记。内置原创题会重新出现。建议先导出备份。</p>${btn('清空此练习站的数据','reset','danger')}</section></div>`;
  }
  function modal(title, body, small=false) {
    lastFocus=document.activeElement;
    modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${small?'small-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="btn icon small" data-act="close-modal" aria-label="关闭窗口">${icon('times')}</button></div><div class="modal-body">${body}</div></section></div>`;
    document.body.style.overflow='hidden';modalRoot.querySelector('input:not([type=hidden]),textarea,select,button')?.focus();
  }
  function closeModal(){modalRoot.innerHTML='';document.body.style.overflow='';if(lastFocus&&document.contains(lastFocus))lastFocus.focus();}
  function inspectQuestion(q,verify=false) {
    if(!q)return;
    modal(verify?'核对题目后启用':'题目与参考解析',`<div class="row wrap gap8">${chips(q)}</div><div class="q-snippet">${h(q.stem)}</div>${q.passage?`<div class="passage">${h(q.passage)}</div>`:''}${q.options.map(o=>`<p style="font-size:13px;line-height:2">${o.label}. ${h(o.text)}</p>`).join('')}<div class="answer-label">参考答案</div><div class="reference">${h(answerText(q,q.answer,true))}</div><div class="answer-label">解析</div><div class="review-text" style="white-space:pre-line">${h(q.explanation)}</div>${source(q)}${verify?`<form id="verify-form" data-id="${h(q.id)}"><label class="check-label mt"><input type="checkbox" name="confirmed" required><span>我已对照来源核对题干、选项、答案和解析，确认可以用于练习。</span></label><div class="modal-footer"><button class="btn primary" type="submit">确认核对并启用</button></div></form>`:''}`);
  }
  function editor(id='') {
    const old=state.questions.find(q=>q.id===id),attempted=old&&state.attempts.some(a=>a.q.id===id);
    const q=old||{id:uid('q'),type:'single',section:'',tag:'',level:2,stem:'',passage:'',options:[],answer:[],explanation:'',source:'',page:'',number:''};
    modal(old?'编辑我的题目':'手动录入一道题',`<p class="report-method mb">保存后进入待核对区。${attempted?'这道题已有作答记录，修改将生成新题并停用旧题，历史快照保留。':'请保留书名、页码和原题号，方便回查。'}</p><form id="editor-form" data-edit="${h(id)}" data-attempted="${!!attempted}"><div class="form-grid"><label class="field"><span>题目 ID</span><input name="id" value="${h(attempted?uid('q'):q.id)}" maxlength="100" ${old?'readonly':''} required></label><label class="field"><span>题型</span><select name="type">${Object.entries(C.TYPES).map(([v,l])=>optionTag(v,l,q.type)).join('')}</select></label><label class="field"><span>章节</span><input name="section" value="${h(q.section)}" placeholder="如：词汇与语法" maxlength="100" required></label><label class="field"><span>知识点</span><input name="tag" value="${h(q.tag)}" placeholder="如：时态和语态" maxlength="100" required></label><label class="field"><span>难度</span><select name="level">${[1,2,3].map(n=>optionTag(n,['','基础','进阶','挑战'][n],q.level)).join('')}</select></label><label class="field"><span>来源 / 书名</span><input name="source" value="${h(q.source)}" maxlength="500" placeholder="如：我的英语练习册" required></label><label class="field"><span>原书页码（可选）</span><input name="page" value="${h(q.page)}" maxlength="40"></label><label class="field"><span>原书题号（可选）</span><input name="number" value="${h(q.number)}" maxlength="60"></label><label class="field full"><span>题干</span><textarea name="stem" maxlength="20000" required>${h(q.stem)}</textarea></label><label class="field full"><span>阅读 / 完形材料（可选，同组题请填写相同材料）</span><textarea name="passage" maxlength="30000">${h(q.passage)}</textarea></label><label class="field full"><span>选择题选项：每行一个选项，按 A / B / C… 顺序（填空、写作留空）</span><textarea name="options">${h(q.options.map(o=>o.text).join('\n'))}</textarea></label><label class="field full"><span>答案：选择题填 A 或 A,C；填空多个可接受答案用 | 分隔；写作填参考范文</span><textarea name="answer" maxlength="20000" required>${h(Array.isArray(q.answer)?q.answer.join(q.type==='blank'?'|':','):q.answer)}</textarea></label><label class="field full"><span>解析 / 主观题评分标准</span><textarea name="explanation" maxlength="20000" required>${h(q.explanation)}</textarea></label></div><div class="modal-footer">${btn('取消','close-modal')}<button class="btn primary" type="submit">保存为待核对题目</button></div></form>`);
  }
  function createTest() {
    const qs=bankQuestions();
    if(!qs.length){toast('当前题库还没有可练习题目，请先导入并核对。');return;}
    modal('创建测试集合',`<p class="report-method mb">从当前的「${bankLabel()}」随机抽题，保存后可以反复测试。阅读题会保留各自完整的材料。</p><form id="test-form"><div class="form-grid"><label class="field full"><span>测试名称</span><input name="name" maxlength="100" value="${h('英语小测 · '+new Date().toLocaleDateString('zh-CN'))}" required></label><label class="field"><span>章节范围</span><select name="section">${optionTag('all','全部章节','all')}${[...new Set(qs.map(q=>q.section))].map(x=>optionTag(x,x,'all')).join('')}</select></label><label class="field"><span>题型范围</span><select name="type">${optionTag('all','全部题型','all')}${Object.entries(C.TYPES).map(([v,l])=>optionTag(v,l,'all')).join('')}</select></label><label class="field"><span>题量（最多2000题）</span><input type="number" name="count" min="1" max="2000" value="${Math.min(10,qs.length)}" required></label><label class="field"><span>考试时长（分钟）</span><input type="number" name="minutes" min="1" max="300" value="20" required></label></div><div class="alert mt">试卷以已核对的题目为准。范围内题量不足时会提示，不会用重复题凑数。</div><div class="modal-footer">${btn('取消','close-modal')}<button class="btn primary" type="submit">保存测试集合</button></div></form>`,'small');
  }
  const templateQuestion=()=>({id:'my-book-001',type:'single',section:'词汇与语法',tag:'动词时态',level:1,stem:'My sister usually ______ to school by bus.',options:['go','goes','going','gone'],answer:['B'],explanation:'usually 提示一般现在时；主语为第三人称单数，谓语用 goes。此题为导入格式示例，请替换成你核对后的题目。',passage:'',source:'格式示例：请替换为实际书名',page:'',number:'1',ready:false});
  function importModal() {
    imported=null;
    modal('导入我的题库',`<p class="report-method mb">支持 JSON 和 UTF-8 CSV。每题需包含ID、题型、题干、答案、解析和来源。选择题选项为2至6个。最多10000题，单个文件上限12MB。</p><div class="row wrap mb">${btn('选择 JSON / CSV 文件','choose-bank-file')}${btn('JSON 模板','template-json','small')}${btn('CSV 模板','template-csv','small')}</div><label class="field"><span>也可以直接粘贴 JSON 题目数组</span><textarea id="import-text" class="code-area" placeholder='[{"id":"my-book-001","type":"single",…}]'></textarea></label><div id="import-preview"></div><div class="modal-footer">${btn('检查并预览','preview-import')}${btn('确认导入待核对区','confirm-import','primary','id="confirm-import" disabled')}</div>`);
  }
  function previewImport(raw) {
    try {
      const result=C.prepareImport(raw,allQuestions());
      if(result.errors.length){imported=null;document.getElementById('import-preview').innerHTML=`<div class="preview-box error-list">本批次未导入，请修正以下 ${result.errors.length} 个问题：\n${result.errors.slice(0,20).map(h).join('\n')}${result.errors.length>20?'\n…更多错误请分批检查。':''}</div>`;document.getElementById('confirm-import').disabled=true;return;}
      imported=result.questions;document.getElementById('import-preview').innerHTML=`<div class="preview-box">检查通过：${imported.length} 道题目，将全部进入待核对区。\n首题：${h(imported[0].stem.slice(0,160))}\n来源：${h(imported[0].source)}</div>`;document.getElementById('confirm-import').disabled=false;
    } catch(e){imported=null;document.getElementById('import-preview').innerHTML=`<div class="preview-box error-list">${h(e.message)}</div>`;document.getElementById('confirm-import').disabled=true;}
  }
  function download(name,content,type='application/json;charset=utf-8') { const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000); }
  function chooseFile(accept,onRead) {
    const input=document.createElement('input');input.type='file';input.accept=accept;
    input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;if(file.size>12*1024*1024){toast('文件超过12MB，请分批导入。');return;}try{await onRead(await file.text(),file.name);}catch(e){toast(`读取失败：${e.message}`);}});input.click();
  }
  function sourcesModal() {
    modal('原书资料与收录范围',`<div class="alert orange mb">当前内置 ${originals.length} 道本站原创练习题；已导入用户题目 ${state.questions.length} 道。整本原书尚未收录。</div><h3>已识别的书籍</h3><p class="report-method mt">《专升本必刷2000题 · 英语》，库课专升本系列，光明日报出版社，ISBN 9787519441845。封面照片不包含题目正文与答案页。</p><div class="small-stack mt"><a href="https://item.xhsd.com/items/110000104047278" target="_blank" rel="noopener noreferrer">新华书店同 ISBN 书目与公开样页 ↗</a><a href="https://book-uniapp-cli.kuke99.com/bookshelf/1202541597774327808?src=qr" target="_blank" rel="noopener noreferrer">照片二维码对应的库课配套书架 ↗</a><a href="https://kuke-production.oss-cn-beijing.aliyuncs.com/tempfile/template/pc/20260604/1780562063307_3804.pdf" target="_blank" rel="noopener noreferrer">官方教材同步训练解析 PDF（35页）↗</a></div><p class="report-method mt">已核查的35页PDF属于教材同步训练解析，目前不能与《必刷2000题》整本题库及答案册对应。书店样页也尚未核对到你手中实物的印次。后续导入请保存书名、页码、原题号，并逐题核对答案。</p><p class="report-method mt">题库导入支持已整理的 JSON / CSV 或手工录题。当前版本不包含自动识别整本PDF或照片的功能；可先在外部完成文字识别与校对，再导入。</p>`);
  }
  function updateSaveStatus() {
    const el=document.querySelector('.top-right > .pill');
    if(!el)return;
    el.className=`pill ${saveError?'red':pendingWrites?'orange':'green'}`;
    el.innerHTML=`<span class="dot"></span> ${saveError?'保存失败':pendingWrites?'保存中…':'本地保存'}`;
  }
  function updateTimer() {
    updateSaveStatus();
    const t=state.session;
    if(!t||t.mode!=='exam')return;
    const seconds=Math.max(0,Math.ceil((t.deadline-Date.now())/1000));
    const el=document.getElementById('exam-timer');if(el)el.textContent=duration(seconds);
    if(seconds===0)submitExam(true);
  }
  function toggleFavorite(id) { if(commit(s=>{s.favorites=s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id];})){render();} }
  function readyWrongQuestions(dueOnly=false) {
    const m=metrics().mastery,qs=bankQuestions();
    return Object.values(m).filter(x=>x.activeWrong&&(!dueOnly||x.dueAt<=Date.now())).sort((a,b)=>a.dueAt-b.dueAt).map(x=>qs.find(q=>q.id===x.q.id)).filter(Boolean);
  }
  function recordSelfScore(id,score) {
    if(commit(s=>{const a=s.attempts.find(a=>a.id===id);if(!a||!a.pending)throw Error('这道题已经评分或记录不存在');Object.assign(a,C.grade(a.q,a.answer,score));})){closeModal();render();toast('已记录本次自评。');}
  }
  function resetFilters(){filters={search:'',section:'all',type:'all',level:'all',status:'all',page:1};}
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-act]');if(!el||el.disabled)return;
    const a=el.dataset.act,id=el.dataset.id;
    if(a==='nav'){if(el.dataset.view==='manage')resetFilters();navigate(el.dataset.view);}
    else if(a==='menu'){navOpen=!navOpen;render();}
    else if(a==='close-modal')closeModal();
    else if(a==='bank'){
      if(state.session&&state.session.origin!==el.dataset.bank){toast('请先结束当前练习，再切换题库。');return;}
      if(commit(s=>{s.bank=el.dataset.bank==='user'?'user':'original';})){resetFilters();render();}
    }
    else if(a==='quick'){
      const qs=bankQuestions(),m=metrics().mastery;
      const list=[...C.shuffle(qs.filter(q=>!m[q.id])),...C.shuffle(qs.filter(q=>m[q.id]))].slice(0,Math.min(state.settings.dailyGoal,qs.length));
      startPractice(list,'今日练习');
    }
    else if(a==='chapter')startPractice(bankQuestions().filter(q=>q.section===el.dataset.section),el.dataset.section+' · 章节练习');
    else if(a==='practice-one'){const q=allQuestions().find(q=>q.id===id&&q.ready);if(q)startPractice([q],'单题练习');else toast('这道题已停用或不存在。');}
    else if(a==='practice-filter'||a==='random-filter')startPractice(a==='random-filter'?C.shuffle(filtered(bankQuestions())):filtered(bankQuestions()),a==='random-filter'?'随机练习':'按筛选顺序练习');
    else if(a==='practice-favorites')startPractice(filtered(bankQuestions().filter(q=>state.favorites.includes(q.id))),'收藏题目练习');
    else if(a==='review-due')startPractice(readyWrongQuestions(true),'到期错题复习');
    else if(a==='favorite')toggleFavorite(id);
    else if(a==='inspect')inspectQuestion(allQuestions().find(q=>q.id===id));
    else if(a==='verify')inspectQuestion(state.questions.find(q=>q.id===id),true);
    else if(a==='unverify'){if(commit(s=>{s.questions.find(q=>q.id===id).ready=false;})){render();toast('已退回待核对区，历史作答与试卷快照保留。');}}
    else if(a==='edit-question')editor(id);
    else if(a==='new-question')editor();
    else if(a==='delete-question'){
      if(confirm('删除这道题吗？历史作答与已保存的测试快照仍会保留。')&&commit(s=>{s.questions=s.questions.filter(q=>q.id!==id);s.favorites=s.favorites.filter(x=>x!==id);delete s.notes[id];})){render();toast('题目已删除。');}
    }
    else if(a==='page'){filters.page+=Number(el.dataset.step);render();window.scrollTo({top:0,behavior:'instant'});}
    else if(a==='reset-filters'){resetFilters();render();}
    else if(a==='wrong-tab'){wrongTab=el.dataset.tab;filters.page=1;render();}
    else if(a==='test-tab'){historyTab=el.dataset.tab;render();}
    else if(a==='resume')navigate('quiz');
    else if(a==='choose'){
      const t=state.session;if(!t)return;const q=t.questions[t.index];if(t.graded[q.id])return;
      let answer=t.answers[q.id]||[];const v=el.dataset.value;
      answer=q.type==='single'?[v]:answer.includes(v)?answer.filter(x=>x!==v):[...answer,v];
      if(commit(s=>{s.session.answers[q.id]=answer;}))render();
    }
    else if(a==='grade')gradeCurrent();
    else if(a==='skip')gradeCurrent(true);
    else if(a==='quiz-prev')moveQuiz(state.session.index-1);
    else if(a==='quiz-next')moveQuiz(state.session.index+1);
    else if(a==='quiz-jump')moveQuiz(Number(el.dataset.index));
    else if(a==='finish-practice')finishPractice();
    else if(a==='submit-exam')submitExam();
    else if(a==='self-score')recordSelfScore(el.dataset.attempt,Number(el.dataset.score));
    else if(a==='create-test')createTest();
    else if(a==='start-test'){const set=state.sets.find(t=>t.id===id);if(set)startExam(set);}
    else if(a==='delete-test'){if(confirm('删除这个测试集合吗？已完成的测试记录会保留。')&&commit(s=>{s.sets=s.sets.filter(t=>t.id!==id);})){render();}}
    else if(a==='open-result'){resultId=el.dataset.result;navigate('result');}
    else if(a==='retry-result'){
      const list=state.attempts.filter(x=>x.testId===el.dataset.result&&x.correct===false).map(a=>a.q);
      startPractice(list,'测试错题重练');
    }
    else if(a==='review-attempt'){
      const attempt=state.attempts.find(x=>x.id===el.dataset.attempt);if(!attempt)return;
      modal('对照参考答案自评',`<div class="q-snippet">${h(attempt.q.stem)}</div><div class="answer-label">我的答案</div><div class="reference">${h(answerText(attempt.q,attempt.answer))}</div>${feedback(attempt)}${source(attempt.q)}`);
    }
    else if(a==='print')window.print();
    else if(a==='sources')sourcesModal();
    else if(a==='goal'){navigate('settings');document.querySelector('[name=dailyGoal]')?.focus();}
    else if(a==='import')importModal();
    else if(a==='choose-bank-file')chooseFile('.json,.csv',async(raw,name)=>{if(!document.getElementById('import-text'))return;document.getElementById('import-text').value=raw;try{previewImport(/\.csv$/i.test(name)?C.parseCSV(raw):JSON.parse(raw));}catch(e){document.getElementById('import-preview').innerHTML=`<div class="preview-box error-list">${h(e.message)}</div>`;imported=null;document.getElementById('confirm-import').disabled=true;}});
    else if(a==='preview-import'){try{previewImport(JSON.parse(document.getElementById('import-text').value));}catch(e){toast(`JSON无法读取：${e.message}`);}}
    else if(a==='confirm-import'){
      if(!imported)return;
      const check=C.prepareImport(imported,allQuestions());if(check.errors.length){toast('题库发生变化，请重新检查导入。');return;}
      if(commit(s=>{s.questions.push(...check.questions);})){const n=check.questions.length;imported=null;closeModal();resetFilters();navigate('manage');toast(`已导入 ${n} 道题，逐题核对后即可练习。`);}
    }
    else if(a==='template-json')download('题库导入模板.json',JSON.stringify({questions:[templateQuestion()]},null,2));
    else if(a==='template-csv'){
      const q=templateQuestion(),cols=['id','type','section','tag','level','stem','A','B','C','D','answer','explanation','passage','source','page','number'];
      const row={...q,A:q.options[0],B:q.options[1],C:q.options[2],D:q.options[3],answer:'B'};
      const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
      download('题库导入模板.csv','\uFEFF'+cols.join(',')+'\r\n'+cols.map(k=>quote(row[k])).join(','),'text/csv;charset=utf-8');
    }
    else if(a==='export-bank')download('我的英语题库.json',JSON.stringify({questions:state.questions},null,2));
    else if(a==='backup')download(`拾级学习备份-${today()}.json`,JSON.stringify({app:'shiji-english-practice',exportedAt:new Date().toISOString(),data:state},null,2));
    else if(a==='export-broken')download('拾级无法读取的原始记录.txt',brokenStorage,'text/plain;charset=utf-8');
    else if(a==='restore')chooseFile('.json',async raw=>{
      const file=JSON.parse(raw);if(file.app!=='shiji-english-practice')throw Error('这不是拾级练习站的完整备份文件');
      const candidate=validateState(file.data);
      if(!confirm(`备份包含 ${candidate.questions.length} 道用户题、${candidate.attempts.length} 次作答、${candidate.results.length} 场测试。恢复会替换当前全部学习数据，是否继续？`))return;
      const previousBroken=brokenStorage;brokenStorage='';
      if(commit(s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,candidate);})){storageProblem='';resultId='';resetFilters();view=state.session?'quiz':'home';closeModal();render();toast('已恢复备份。');}else brokenStorage=previousBroken;
    });
    else if(a==='reset'){
      if(!confirm('确定清空此练习站的全部学习记录和用户题库吗？请先导出备份。'))return;
      if(prompt('请输入“清空”确认：')!=='清空'){toast('已取消清空。');return;}
      brokenStorage='';storageProblem='';
      if(commit(s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,emptyState());})){resetFilters();navigate('home');toast('已清空此练习站的数据。');}
    }
  });
  document.addEventListener('submit',e=>{
    const form=e.target,formId=form.getAttribute('id');if(!['filter-form','settings-form','editor-form','test-form','verify-form'].includes(formId))return;e.preventDefault();
    const data=Object.fromEntries(new FormData(form));
    if(formId==='filter-form'){filters={...filters,...data,page:1};render();}
    else if(formId==='settings-form'){
      const goal=Number(data.dailyGoal);if(!Number.isInteger(goal)||goal<1||goal>300||!data.name.trim()){toast('请填写名称，目标需为1至300的整数。');return;}
      if(commit(s=>{s.settings={name:data.name.trim().slice(0,30),dailyGoal:goal};})){render();toast('学习设置已保存。');}
    }
    else if(formId==='verify-form'){
      if(!data.confirmed)return;
      if(commit(s=>{const q=s.questions.find(q=>q.id===form.dataset.id);if(!q)throw Error('题目已不存在');q.ready=true;})){closeModal();render();toast('题目已启用，在“我的题库”中可以练习。');}
    }
    else if(formId==='editor-form'){
      try{
        const editId=form.dataset.edit,attempted=form.dataset.attempted==='true';
        const raw={...data,ready:false,options:data.options.split('\n').map(x=>x.trim()).filter(Boolean),answer:data.type==='blank'?data.answer.split('|'):data.answer};
        if(!data.source.trim())throw Error('请填写题目来源');
        const existing=allQuestions().filter(q=>q.id!==editId);
        const checked=C.prepareImport([raw],existing);if(checked.errors.length)throw Error(checked.errors[0]);
        const q=checked.questions[0];
        if(commit(s=>{if(editId&&!attempted)s.questions=s.questions.map(x=>x.id===editId?q:x);else{if(editId){const old=s.questions.find(x=>x.id===editId);if(old)old.ready=false;}s.questions.push(q);}})){closeModal();navigate('manage');toast('已保存到待核对区。');}
      }catch(err){toast(err.message);}
    }
    else if(formId==='test-form'){
      const count=Number(data.count),minutes=Number(data.minutes);
      if(!Number.isInteger(count)||count<1||count>2000||!Number.isInteger(minutes)||minutes<1||minutes>300||!data.name.trim()){toast('请填写有效的名称、题量和时长。');return;}
      const qs=bankQuestions().filter(q=>(data.section==='all'||q.section===data.section)&&(data.type==='all'||q.type===data.type));
      if(qs.length<count){toast(`当前范围只有 ${qs.length} 道题，请减少题量或扩大范围。`);return;}
      if(commit(s=>{s.sets.unshift({id:uid('set'),name:data.name.trim().slice(0,100),origin:state.bank,questions:C.clone(C.shuffle(qs).slice(0,count)),minutes,createdAt:Date.now()});})){closeModal();historyTab='sets';navigate('tests');toast('测试集合已保存。');}
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='import-text'){imported=null;const confirmBtn=document.getElementById('confirm-import');if(confirmBtn)confirmBtn.disabled=true;const preview=document.getElementById('import-preview');if(preview)preview.innerHTML='';}
    if(!state.session)return;
    const q=state.session.questions[state.session.index];
    if(e.target.id==='quiz-answer'&&!state.session.graded[q.id]){
      const value=e.target.value.slice(0,30000);
      commit(s=>{s.session.answers[q.id]=value;});
      const counter=document.getElementById('word-count');if(counter)counter.textContent=`${value.trim()?value.trim().split(/\s+/).length:0} 个空格分隔词`;
    }
    if(e.target.id==='question-note'){const value=e.target.value.slice(0,10000);commit(s=>{s.notes[q.id]=value;});}
  });
  document.addEventListener('keydown',e=>{
    if(modalRoot.firstChild){
      if(e.key==='Escape'){e.preventDefault();closeModal();return;}
      if(e.key==='Tab'){
        const focusables=[...modalRoot.querySelectorAll('button,input,textarea,select,a[href]')].filter(x=>!x.disabled&&x.offsetParent!==null);
        const first=focusables[0],last=focusables[focusables.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
      return;
    }
    if(view!=='quiz'||!state.session||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;
    const t=state.session,q=t.questions[t.index];
    if(/^[1-6]$/.test(e.key)&&q.options.length){const el=document.querySelector(`.option[data-value="${String.fromCharCode(64+Number(e.key))}"]`);if(el){e.preventDefault();el.click();}}
    else if(e.key==='Enter'&&t.mode==='practice'){e.preventDefault();gradeCurrent();}
    else if(e.key==='ArrowLeft'){e.preventDefault();moveQuiz(t.index-1);}
    else if(e.key==='ArrowRight'){e.preventDefault();moveQuiz(t.index+1);}
  });
  window.addEventListener('beforeunload',e=>{if(pendingWrites||saveError){e.preventDefault();e.returnValue='';}});
  window.addEventListener('pageshow',()=>{if(state.session?.mode==='exam')updateTimer();});
  async function boot(){
    app.innerHTML='<div class="empty" style="padding-top:20vh"><div class="empty-symbol">↗</div><h3>正在打开你的学习空间</h3><p>读取本地题库与练习记录…</p></div>';
    try{
      database=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('shiji-english-study',1);
        request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records');};
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('存储被其他页面占用'));
      });
      database.onversionchange=()=>database.close();
      const stored=await new Promise((resolve,reject)=>{const tx=database.transaction('records','readonly'),request=tx.objectStore('records').get('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      if(stored){try{state=validateState(stored);brokenStorage='';storageProblem='';}catch(e){brokenStorage=JSON.stringify(stored);storageProblem=`本地数据校验失败：${e.message}。请先导出原始记录。`;state=emptyState();}}
      view=state.session?'quiz':'home';
    }catch(e){database=null;toast('浏览器增强存储不可用，已改用容量较小的本地存储。请定期备份。');}
    render();setInterval(updateTimer,1000);
  }
  boot();
})();
