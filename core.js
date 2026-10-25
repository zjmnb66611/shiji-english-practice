(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PracticeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = { single: '单选题', multiple: '多选题', blank: '填空题', essay: '翻译 / 写作' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const norm = value => String(value ?? '').normalize('NFKC').trim().toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').replace(/[.!?。！？]+$/, '');
  function text(value, name, max = 20000) {
    if (typeof value !== 'string' || !value.trim()) throw Error(`${name}不能为空`);
    if (value.length > max) throw Error(`${name}超过${max}个字符`);
    return value.trim();
  }
  function normalizeQuestion(raw, origin = 'user') {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('题目必须是对象');
    const type = raw.type || 'single';
    if (!TYPES[type]) throw Error('不支持的题型');
    const q = {
      id: text(raw.id, '题目ID', 100), origin, type,
      section: text(raw.section || '未分类', '章节', 100),
      tag: text(raw.tag || '综合', '知识点', 100),
      level: [1, 2, 3].includes(Number(raw.level)) ? Number(raw.level) : 2,
      stem: text(raw.stem, '题干'), passage: String(raw.passage || '').slice(0, 30000),
      explanation: text(raw.explanation, '解析'),
      source: String(raw.source || '用户导入').slice(0, 500),
      page: String(raw.page || '').slice(0, 40), number: String(raw.number || '').slice(0, 60),
      ready: raw.ready === true, options: []
    };
    if (Object.prototype.hasOwnProperty.call(Object.prototype, q.id) || q.id === 'prototype') throw Error('题目ID使用了保留名称，请换一个ID');
    if (/^(original-|sys-)/i.test(q.id) && origin === 'user') throw Error('用户题目ID请勿以 original- 或 sys- 开头');
    if (type === 'single' || type === 'multiple') {
      if (!Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 6) throw Error('选择题需提供2至6个选项');
      q.options = raw.options.map((op, i) => ({ label: String.fromCharCode(65 + i), text: text(typeof op === 'string' ? op : op.text, '选项') }));
      let answers = Array.isArray(raw.answer) ? raw.answer : String(raw.answer || '').toUpperCase().split(/[\s,，|;；]+/).filter(Boolean);
      answers = [...new Set(answers.map(a => String(a).trim().toUpperCase()))].sort();
      if (!answers.length || answers.some(a => !q.options.some(op => op.label === a))) throw Error('答案必须是有效选项字母');
      if (type === 'single' && answers.length !== 1) throw Error('单选题只能有一个正确选项');
      q.answer = answers;
    } else if (type === 'blank') {
      const answers = Array.isArray(raw.answer) ? raw.answer : [raw.answer];
      if (!answers.length || answers.length > 30) throw Error('填空题需提供1至30个可接受答案');
      q.answer = answers.map(a => text(a, '填空答案', 5000));
    } else q.answer = text(Array.isArray(raw.answer) ? raw.answer.join('\n') : raw.answer, '参考答案');
    return q;
  }
  function grade(q, answer, selfScore) {
    const filled = Array.isArray(answer) ? answer.length > 0 : String(answer ?? '').trim().length > 0;
    if (q.type === 'essay') {
      if (!filled) return { correct: false, score: 0, max: 5, pending: false, self: false };
      if (selfScore === undefined || selfScore === null) return { correct: null, score: null, max: 5, pending: true, self: true };
      const score = Number(selfScore);
      if (!Number.isInteger(score) || score < 0 || score > 5) throw Error('自评分数须为0至5的整数');
      return { correct: score >= 3, score, max: 5, pending: false, self: true };
    }
    let correct = false;
    if (q.type === 'blank') correct = filled && q.answer.some(a => norm(a) === norm(answer));
    else {
      const a = [...new Set(Array.isArray(answer) ? answer : (filled ? [answer] : []))].sort();
      correct = JSON.stringify(a) === JSON.stringify([...q.answer].sort());
    }
    return { correct, score: correct ? 1 : 0, max: 1, pending: false, self: false };
  }
  function mastery(attempts, origin) {
    const map = Object.create(null);
    for (const a of attempts) {
      if (origin && a.q.origin !== origin) continue;
      if (a.pending) continue;
      const m = map[a.q.id] || { tries: 0, correct: 0, errors: 0, streak: 0, lastAt: 0, q: a.q };
      m.tries++; m.correct += a.correct === true ? 1 : 0;
      if (a.correct === false) { m.errors++; m.streak = 0; }
      else m.streak++;
      m.lastAt = a.at; m.q = a.q;
      m.activeWrong = m.errors > 0 && m.streak < 2;
      m.dueAt = m.lastAt + (m.streak === 0 ? 0 : m.streak === 1 ? 86400000 : 259200000);
      map[a.q.id] = m;
    }
    return map;
  }
  function metrics(questions, attempts, origin) {
    const qs = questions.filter(q => q.origin === origin && q.ready);
    const history = attempts.filter(a => a.q.origin === origin);
    const objective = history.filter(a => a.q.type !== 'essay');
    const correct = objective.filter(a => a.correct === true).length;
    const m = mastery(history);
    return { total: qs.length, tried: qs.filter(q => m[q.id]).length,
      objective: objective.length, correct, accuracy: objective.length ? Math.round(correct / objective.length * 100) : null,
      wrong: Object.values(m).filter(x => x.activeWrong).length,
      due: Object.values(m).filter(x => x.activeWrong && x.dueAt <= Date.now()).length,
      attempts: history.length, pending: history.filter(a => a.pending).length,
      seconds: history.reduce((n, a) => n + (a.seconds || 0), 0), mastery: m };
  }
  function resultSummary(attempts) {
    const pending = attempts.filter(a => a.pending).length;
    const score = attempts.reduce((n, a) => n + (a.score || 0), 0);
    const max = attempts.reduce((n, a) => n + a.max, 0);
    const objective = attempts.filter(a => a.q.type !== 'essay');
    return { pending, score, max, percent: pending ? null : max ? Math.round(score / max * 100) : 0,
      correct: objective.filter(a => a.correct).length, objective: objective.length,
      unanswered: attempts.filter(a => Array.isArray(a.answer) ? !a.answer.length : !String(a.answer || '').trim()).length };
  }
  function shuffle(list, rng = Math.random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function parseCSV(input) {
    const rows = []; let row = [], field = '', quoted = false;
    const str = String(input).replace(/^\uFEFF/, '');
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '"') {
        if (quoted && str[i + 1] === '"') { field += '"'; i++; }
        else if (quoted) quoted = false;
        else if (!field.length) quoted = true;
        else throw Error('CSV引号格式错误');
      } else if (c === ',' && !quoted) { row.push(field); field = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && str[i + 1] === '\n') i++;
        row.push(field); if (row.some(x => x.trim())) rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (quoted) throw Error('CSV包含未闭合的引号');
    row.push(field); if (row.some(x => x.trim())) rows.push(row);
    if (rows.length < 2) throw Error('CSV需要表头及至少一行数据');
    const headers = rows.shift().map(x => x.trim());
    if (new Set(headers).size !== headers.length) throw Error('CSV存在重复表头');
    return rows.map((values, index) => {
      if (values.length !== headers.length) throw Error(`CSV第${index + 2}行列数与表头不一致`);
      const r = Object.fromEntries(headers.map((h, i) => [h, values[i]]));
      r.options = ['A', 'B', 'C', 'D', 'E', 'F'].map(k => r[k]).filter(Boolean);
      if (r.type === 'blank') r.answer = String(r.answer || '').split('|');
      r.ready = false;
      return r;
    });
  }
  function prepareImport(raw, existing) {
    const rows = Array.isArray(raw) ? raw : raw && raw.questions;
    if (!Array.isArray(rows) || !rows.length || rows.length > 10000) throw Error('请提供1至10000道题目的数组，或含questions数组的对象');
    const ids = new Set(existing.map(q => q.id));
    const signatures = new Set(existing.map(q => norm(q.stem) + '|' + q.options.map(o => norm(o.text)).join('|')));
    const questions = [], errors = [];
    rows.forEach((r, i) => {
      try {
        const q = normalizeQuestion({ ...r, ready: false }, 'user');
        const signature = norm(q.stem) + '|' + q.options.map(o => norm(o.text)).join('|');
        if (ids.has(q.id)) throw Error(`ID重复：${q.id}`);
        if (signatures.has(signature)) throw Error('题干与选项和已有题目重复');
        ids.add(q.id); signatures.add(signature); questions.push(q);
      } catch (e) { errors.push(`第${i + 1}题：${e.message}`); }
    });
    return { questions, errors };
  }
  return { TYPES, clone, norm, normalizeQuestion, grade, mastery, metrics, resultSummary, shuffle, parseCSV, prepareImport };
});
