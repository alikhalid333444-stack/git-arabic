/*
 * Git بالعربية — منطق الفهم والعرض.
 * يعمل في المتصفح (يقرأ commands.json) وفي Node (تستخدمه tests.js).
 * الأداة تعرض الأوامر فقط ولا تنفّذ أي شيء.
 */
(function () {
  'use strict';

  // ───────────────────────── التطبيع ─────────────────────────

  const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g; // الحركات والتنوين والشدة
  const TATWEEL = /ـ/g;

  /** يوحّد النص العربي: يزيل التشكيل والتطويل، ويوحّد الألف والياء والتاء المربوطة والهمزات. */
  function normalizeArabic(text) {
    return String(text || '')
      .replace(TASHKEEL, '')
      .replace(TATWEEL, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ة/g, 'ه')
      .toLowerCase()
      .replace(/[^ء-يa-z0-9\s]/g, ' ') // علامات الترقيم والرموز ← مسافة
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(text) {
    const n = normalizeArabic(text);
    return n ? n.split(' ') : [];
  }

  // السوابق الشائعة: "والفرع"، "بالملف"، "للكوميت"، "فالتغييرات"...
  const PREFIXES = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل'];

  /** كل الصيغ الممكنة للكلمة بعد نزع السوابق. */
  function tokenVariants(token) {
    const out = new Set([token]);
    for (const p of PREFIXES) {
      if (token.startsWith(p) && token.length - p.length >= 2) {
        const rest = token.slice(p.length);
        out.add(rest);
        if (rest.startsWith('ال') && rest.length > 3) out.add(rest.slice(2)); // "وبالفرع"
      }
    }
    return [...out];
  }

  /** هل تطابق كلمة المستخدم صيغة الكلمة المفتاحية؟ (مع تسامح بلاحقة قصيرة مثل ـات، ـه، ـها، ـي) */
  function wordMatches(token, form) {
    for (const v of tokenVariants(token)) {
      if (v === form) return true;
      if (form.length >= 3 && v.startsWith(form) && v.length - form.length <= 2) return true;
    }
    return false;
  }

  // ───────────────────────── النفي ─────────────────────────

  const NEGATIONS = new Set(['بدون', 'دون', 'لا', 'ما', 'مو', 'مش', 'مب', 'ليس', 'لم']);

  /**
   * "لا تحذف تعديلاتي" و"بدون ما يروح الكود" و"من غير ما اخسر شغلي" تعني الإبقاء لا الحذف.
   * نستبدل كلمة الحذف/الضياع المنفية بكلمة "خلي" حتى تُفهم كإبقاء.
   */
  function applyNegation(tokens, synonyms) {
    const lose = [...(synonyms['احذف'] || []), ...(synonyms['يضيع'] || [])];
    const out = tokens.slice();
    for (let i = 0; i < out.length; i++) {
      const isNeg = NEGATIONS.has(out[i]) || (out[i] === 'غير' && out[i - 1] === 'من');
      if (!isNeg) continue;
      for (let j = i + 1; j <= i + 2 && j < out.length; j++) {
        if (lose.some(f => wordMatches(out[j], f))) { out[j] = 'خلي'; break; }
      }
    }
    return out;
  }

  // ───────────────────────── قاعدة الأوامر ─────────────────────────

  /**
   * يحوّل commands.json إلى بنية جاهزة للمطابقة:
   * كل كلمة مفتاحية ← مصفوفة كلمات، وكل كلمة ← مجموعة صيغها (من قاموس المترادفات).
   */
  function prepareDatabase(raw) {
    const synonyms = {};
    for (const [key, forms] of Object.entries(raw.synonyms || {})) {
      const k = normalizeArabic(key);
      synonyms[k] = [...new Set([k, ...forms.map(normalizeArabic)])].filter(f => f && !f.includes(' '));
    }
    const commands = raw.commands.map(cmd => ({
      ...cmd,
      compiled: cmd.keywords
        .map(kw => tokenize(kw).map(word => synonyms[word] || [word]))
        .filter(words => words.length > 0),
    }));
    return { commands, synonyms, categories: raw.categories || {} };
  }

  const DANGER_RANK = { safe: 0, warning: 1, danger: 2 };

  /**
   * يقيّم أمراً واحداً مقابل كلمات المستخدم.
   * - score: عدد كلمات المستخدم التي غطّتها كلمات مفتاحية مطابقة بالكامل.
   * - partial: عدد كلمات المستخدم التي طابقت أي كلمة مفردة (للاقتراحات فقط).
   */
  function scoreCommand(tokens, cmd) {
    const covered = new Set();
    const partial = new Set();
    let longest = 0;
    for (const words of cmd.compiled) {
      const hits = [];
      let complete = true;
      for (const forms of words) {
        const idx = tokens.findIndex(t => forms.some(f => wordMatches(t, f)));
        if (idx === -1) { complete = false; continue; }
        hits.push(idx);
        partial.add(idx);
      }
      if (complete) {
        hits.forEach(i => covered.add(i));
        longest = Math.max(longest, words.length);
      }
    }
    return { cmd, score: covered.size, longest, partial: partial.size };
  }

  const DEFAULT_SUGGESTIONS = ['status', 'undo-commit-keep', 'log'];

  /**
   * يحدد المهمة الأقرب لما كتبه المستخدم.
   * يعيد { match, alternatives, suggestions } — match تساوي null إن لم يُفهم الطلب.
   */
  function matchIntent(text, db) {
    const tokens = applyNegation(tokenize(text), db.synonyms);
    const scored = db.commands.map(cmd => scoreCommand(tokens, cmd));

    const ranked = scored
      .filter(s => s.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        b.longest - a.longest ||
        DANGER_RANK[a.cmd.danger] - DANGER_RANK[b.cmd.danger] // عند التعادل: الأكثر أماناً أولاً
      );

    if (ranked.length) {
      return {
        match: ranked[0].cmd,
        score: ranked[0].score,
        alternatives: ranked.slice(1, 3).map(s => s.cmd),
        suggestions: [],
      };
    }

    const suggestions = scored
      .filter(s => s.partial > 0)
      .sort((a, b) => b.partial - a.partial || DANGER_RANK[a.cmd.danger] - DANGER_RANK[b.cmd.danger])
      .slice(0, 3)
      .map(s => s.cmd);
    for (const id of DEFAULT_SUGGESTIONS) {
      if (suggestions.length >= 3) break;
      const c = db.commands.find(x => x.id === id);
      if (c && !suggestions.includes(c)) suggestions.push(c);
    }
    return { match: null, score: 0, alternatives: [], suggestions };
  }

  // ───────────────────────── تعبئة القيم ─────────────────────────

  const GIT_WORDS = new Set(('git commit commits stash pop apply branch branches merge push pull force checkout switch add ' +
    'log diff status reset soft hard head clean amend rm cached restore staged stage unstage untracked revert ' +
    'clone init remote upstream fetch rename abort conflict list ' +
    'new delete remove undo keep track tracking show message msg file files changes change save last first ' +
    'github gitlab main master origin with lease repo project folder b c d m n u').split(' '));

  const URL_RE = /(https?:\/\/[^\s"'«»“”]+|git@[^\s"'«»“”]+)/;

  /**
   * يملأ <...> في الأمر من كلام المستخدم:
   * الرابط ← <رابط-المستودع>، النص بين علامات التنصيص ← <الرسالة>/<وصف>،
   * وأول اسم لاتيني (فرع/ملف) ← أول خانة متبقية.
   */
  function fillPlaceholders(command, rawText) {
    let text = String(rawText || '');
    let result = command;

    const url = text.match(URL_RE);
    if (url) {
      result = result.replace('<رابط-المستودع>', url[1]);
      text = text.replace(url[1], ' ');
    }

    const quoted = text.match(/["“”«»']([^"“”«»']+)["“”«»']/);
    if (quoted) {
      result = result.replace(/<(الرسالة|وصف)>/, quoted[1].trim().replace(/"/g, '\\"'));
      text = text.replace(quoted[0], ' ');
    }

    const names = (text.match(/[A-Za-z0-9_][\w.\-\/]*/g) || [])
      .filter(w => !GIT_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));
    if (names.length) {
      result = result.replace(/<(?!الرسالة>|وصف>|رابط-المستودع>)[^>]+>/, names[0]);
    }
    return result;
  }

  // ───────────────────────── العرض (المتصفح) ─────────────────────────

  const DANGER_LABEL = { safe: 'آمن', warning: 'تحذير', danger: 'خطر' };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(className, text, onClick) {
    const b = el('button', className, text);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  // أوامر git داخل النص العربي تُغلَّف بـ <code dir="ltr"> حتى لا ينقلب ترتيبها.
  // الخيارات المنفردة مثل --force-with-lease تُغلَّف أيضاً.
  const INLINE_GIT = /git(?: (?:[a-z][\w-]*|-{1,2}[\w-]+|<[^>]+>|HEAD~?\d*|stash@\{\d+\}|\.(?=\s|$)))+|(?<![\w-])--?[a-z][\w-]*/g;

  function withInlineCode(text) {
    const nodes = [];
    let last = 0;
    for (const m of text.matchAll(INLINE_GIT)) {
      if (m.index > last) nodes.push(document.createTextNode(text.slice(last, m.index)));
      const code = el('code', 'inline', m[0]);
      code.dir = 'ltr';
      nodes.push(code);
      last = m.index + m[0].length;
    }
    if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
    return nodes;
  }

  /**
   * يرسم بطاقة النتيجة (أو رسالة عدم الفهم مع الاقتراحات).
   * options: { rawText, onPick(cmd), shareUrl }
   */
  function renderResult(result, container, options = {}) {
    const { rawText = '', onPick, shareUrl } = options;
    container.replaceChildren();
    container.hidden = false;

    if (!result.match) {
      const card = el('div', 'card notfound');
      card.append(
        el('h2', null, 'لم أفهم طلبك تماماً 🤔'),
        el('p', 'muted', 'جرّب صياغة أخرى، أو اختر واحدة من هذه المهام القريبة:'),
        chipList(result.suggestions, onPick)
      );
      container.append(card);
      return;
    }

    const cmd = result.match;
    const finalCommand = fillPlaceholders(cmd.command, rawText);
    const card = el('article', 'card result danger-' + cmd.danger);

    const head = el('div', 'result-head');
    head.append(el('h2', null, cmd.title), el('span', 'badge badge-' + cmd.danger, DANGER_LABEL[cmd.danger]));
    card.append(head);

    const codeRow = el('div', 'code-row');
    const code = el('code', 'command', finalCommand);
    code.dir = 'ltr';
    const copyBtn = button('copy-btn', 'نسخ');
    copyBtn.addEventListener('click', () => copyText(finalCommand, copyBtn, 'تم النسخ ✓'));
    codeRow.append(code, copyBtn);
    card.append(codeRow);

    if (/<[^>]+>/.test(finalCommand)) {
      card.append(el('p', 'hint', 'استبدل ما بين < > بالقيمة المناسبة (اسم الفرع أو الملف أو الرسالة).'));
    }

    const explanation = el('p', 'explanation');
    explanation.append(...withInlineCode(cmd.explanation));
    card.append(explanation);

    if (cmd.warning) {
      const box = el('div', 'warning-box warning-' + cmd.danger);
      box.setAttribute('role', cmd.danger === 'danger' ? 'alert' : 'note');
      box.append(el('strong', null, cmd.danger === 'danger' ? '⚠️ أمر خطير: ' : 'انتبه: '), ...withInlineCode(cmd.warning));
      card.append(box);
    }

    const foot = el('div', 'result-foot');
    if (result.alternatives && result.alternatives.length) {
      const alt = el('div', 'alternatives');
      alt.append(el('span', 'muted', 'قد تقصد أيضاً:'), chipList(result.alternatives, onPick));
      foot.append(alt);
    }
    if (shareUrl) {
      const share = button('link-btn', '🔗 انسخ رابط هذه النتيجة');
      share.addEventListener('click', () => copyText(shareUrl, share, 'تم نسخ الرابط ✓'));
      foot.append(share);
    }
    card.append(foot);

    container.append(card);
  }

  function chipList(commands, onPick) {
    const list = el('div', 'chips');
    for (const c of commands) list.append(button('chip', c.title, () => onPick && onPick(c)));
    return list;
  }

  /** قائمة كل الأوامر مجمّعة حسب الفئة. */
  function renderCatalog(db, container, onPick) {
    container.replaceChildren();
    const groups = {};
    for (const c of db.commands) (groups[c.category] = groups[c.category] || []).push(c);
    for (const [key, items] of Object.entries(groups)) {
      const group = el('div', 'catalog-group');
      group.append(el('h3', null, db.categories[key] || key));
      const list = el('ul', 'catalog-list');
      for (const c of items) {
        const li = el('li');
        const row = button('catalog-item', null, () => onPick(c));
        const dot = el('span', 'dot dot-' + c.danger);
        dot.title = DANGER_LABEL[c.danger];
        const code = el('code', null, c.command.split('\n').pop());
        code.dir = 'ltr';
        row.append(dot, el('span', 'catalog-title', c.title), code);
        li.append(row);
        list.append(li);
      }
      group.append(list);
      container.append(group);
    }
  }

  async function copyText(text, btn, doneLabel) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // بديل للمتصفحات التي تمنع clipboard (مثلاً خارج https)
      const ta = el('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = doneLabel;
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1600);
  }

  function setQueryParam(key, value) {
    const url = new URL(location.href);
    url.search = '';
    if (key) url.searchParams.set(key, value);
    history.replaceState(null, '', url);
    return url.href;
  }

  async function init() {
    const form = document.getElementById('ask-form');
    const input = document.getElementById('query');
    const output = document.getElementById('output');
    const examples = document.getElementById('examples');
    const catalog = document.getElementById('catalog');
    const count = document.getElementById('command-count');

    let db;
    try {
      const res = await fetch('commands.json');
      if (!res.ok) throw new Error(res.status);
      db = prepareDatabase(await res.json());
    } catch (err) {
      output.hidden = false;
      const card = el('div', 'card notfound');
      const c = el('code', 'command', 'python -m http.server 8000');
      c.dir = 'ltr';
      card.append(
        el('h2', null, 'تعذّر تحميل قاعدة الأوامر'),
        el('p', 'muted', 'افتح الصفحة عبر خادم محلي بدلاً من فتح الملف مباشرة، مثلاً:'),
        c
      );
      output.replaceChildren(card);
      return;
    }

    const showCommand = cmd => {
      const shareUrl = setQueryParam('id', cmd.id);
      renderResult({ match: cmd, alternatives: [] }, output, { rawText: input.value, onPick: showCommand, shareUrl });
      output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const ask = text => {
      const shareUrl = setQueryParam('q', text);
      renderResult(matchIntent(text, db), output, { rawText: text, onPick: showCommand, shareUrl });
    };

    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      ask(text);
    });

    examples.addEventListener('click', e => {
      const btn = e.target.closest('button[data-example]');
      if (!btn) return;
      input.value = btn.dataset.example;
      ask(input.value);
    });

    // "/" ينقل التركيز إلى حقل السؤال
    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    });

    count.textContent = db.commands.length;
    renderCatalog(db, catalog, cmd => { input.value = ''; showCommand(cmd); });

    // روابط المشاركة: ?q=سؤال أو ?id=معرّف-المهمة
    const params = new URLSearchParams(location.search);
    if (params.get('q')) {
      input.value = params.get('q');
      ask(input.value);
    } else if (params.get('id')) {
      const cmd = db.commands.find(c => c.id === params.get('id'));
      if (cmd) showCommand(cmd);
    }
  }

  const api = {
    normalizeArabic, tokenize, tokenVariants, wordMatches, applyNegation,
    prepareDatabase, scoreCommand, matchIntent, fillPlaceholders, renderResult,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    window.GitAr = api;
    document.addEventListener('DOMContentLoaded', init);
  }
})();
