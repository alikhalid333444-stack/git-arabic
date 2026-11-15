/*
 * اختبارات Git بالعربية — التشغيل: node tests.js
 * يعرض الجمل التي لم تُفهم أو فُهمت خطأً، ويخرج برمز 1 إن فشل أي اختبار.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { prepareDatabase, matchIntent, normalizeArabic, fillPlaceholders } = require('./app.js');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'commands.json'), 'utf8'));
const db = prepareDatabase(raw);

// ─── 1) المجموعة الأساسية: 30 جملة بصيغ مختلفة ───
const CORE = [
  ['أريد التراجع عن آخر commit مع الإبقاء على التغييرات', 'undo-commit-keep', 'فصحى'],
  ['ابغى ارجع آخر كوميت بس خلي التعديلات', 'undo-commit-keep', 'خليجي'],
  ['عايز الغي الكومت اللي فات من غير ما اخسر شغلي', 'undo-commit-keep', 'مصري'],
  ['تراجع عن آخر commit واحذف التغييرات نهائياً', 'undo-commit-discard', 'فصحى'],
  ['امسح آخر كوميت وكل اللي فيه', 'undo-commit-discard', 'عامية'],
  ['أريد حفظ التغييرات مؤقتاً', 'stash-save', 'فصحى'],
  ['خبي شغلي على جنب شوي', 'stash-save', 'عامية'],
  ['كيف أسترجع التغييرات المحفوظة مؤقتاً؟', 'stash-pop', 'فصحى'],
  ['رجعلي الستاش', 'stash-pop', 'عامية'],
  ['كيف أنشئ فرعاً جديداً؟', 'branch-create', 'فصحى'],
  ['بدي اعمل برانش جديد اسمه feature-login', 'branch-create', 'شامي'],
  ['انتقل إلى الفرع main', 'branch-switch', 'فصحى'],
  ['ودي اروح على برانش develop', 'branch-switch', 'خليجي'],
  ['ادمج فرع feature في الفرع الحالي', 'branch-merge', 'فصحى'],
  ['احذف الفرع المحلي old-ui', 'branch-delete', 'فصحى'],
  ['شيل البرانش هذا ما عاد احتاجه', 'branch-delete', 'عامية'],
  ['أضف الملف index.html للتتبع', 'file-add', 'فصحى'],
  ['ازالة ملف من التتبع مع الإبقاء عليه', 'file-untrack', 'فصحى'],
  ['وقف تتبع ملف .env بس خليه عندي', 'file-untrack', 'عامية'],
  ['ألغِ تغييرات الملف app.js', 'file-discard', 'فصحى'],
  ['رجع الملف زي ما كان', 'file-discard', 'عامية'],
  ['تراجع عن git add للملف', 'file-unstage', 'مختلط'],
  ['اعرض سجل الـ commits', 'log', 'فصحى'],
  ['وريني الكوميتات اللي صارت', 'log', 'عامية'],
  ['ماذا تغيّر في الملفات؟', 'diff', 'فصحى'],
  ['ايش اللي تغير في الكود', 'diff', 'عامية'],
  ['ما هي حالة المستودع', 'status', 'فصحى'],
  ['عدّل رسالة آخر commit', 'commit-amend', 'فصحى'],
  ['ابي ارفع غصب على السيرفر', 'push-force', 'عامية'],
  ['احذف الملفات غير المتتبعة', 'clean', 'فصحى'],
];

// ─── 2) المهام المضافة في الإصدار الثاني + صيغ النفي ───
const EXTENDED = [
  ['ابي احط كل الملفات في الستيج', 'file-add'],
  ['عايز اعمل commit برسالة "first version"', 'commit'],
  ['ابي اسحب التحديثات من السيرفر', 'pull'],
  ['حدّث الفرع من الريموت', 'pull'],
  ['كيف انزل مشروع من جيت هب', 'clone'],
  ['استنساخ مستودع', 'clone'],
  ['ابغى ابدا git في المجلد هذا', 'init'],
  ['إنشاء مستودع جديد', 'init'],
  ['وريني كل الحاجات اللي خبيتها', 'stash-list'],
  ['ابي اتراجع عن كوميت رفعته خلاص', 'revert'],
  ['نسيت اضيف ملف للكوميت الاخير', 'commit-amend-add'],
  ['اعرض كل الفروع', 'branch-list'],
  ['ايش البرانشات الموجودة', 'branch-list'],
  ['غير اسم الفرع الحالي', 'branch-rename'],
  ['طلع لي تعارض وابي الغي الدمج', 'merge-abort'],
  ['خلي مشروعي نفس اللي على السيرفر بالضبط', 'reset-to-remote'],
  ['اول مرة ارفع الفرع الجديد', 'push-upstream'],
  ['اربط المشروع بمستودع على github', 'remote-add'],
  ['لا تحذف تعديلاتي بس الغي آخر كوميت', 'undo-commit-keep'],
  ['مش عايز اخسر الشغل، رجع الكومت اللي فات', 'undo-commit-keep'],
  ['اشيل الكومت الاخير بدون ما يروح الكود', 'undo-commit-keep'],
  ['امسح كل تعديلاتي على ملف style.css', 'file-discard'],
  ['شيل index.html من الستيج', 'file-unstage'],
  ['نظف المجلد من الملفات الزايدة', 'clean'],
  ['ابي اشوف الفرق بين الملفات', 'diff'],
  ['ارفع الكوميتات', 'push'],
  ['ادمج develop', 'branch-merge'],
  ['روح على فرع main', 'branch-switch'],
  ['صحح رسالة الكوميت', 'commit-amend'],
  ['شو صار بالمشروع مؤخراً', 'log'],
  ['ايش حالة الملفات', 'status'],
  // لهجة عراقية
  ['اريد ارجع آخر كوميت بس خلي التعديلات', 'undo-commit-keep'],
  ['خبّي شغلي على صفحة شوية', 'stash-save'],
  ['سوي فرع جديد اسمه login', 'branch-create'],
  ['شلون امسح الفرع', 'branch-delete'],
  ['اريد اشوف شنو تغير', 'diff'],
  ['ما اريد يروح شغلي، الغي آخر كوميت', 'undo-commit-keep'],
  ['نقلني لفرع لاخ', 'branch-switch'],
  ['اكو تعديلات اريد اخليها على صفحة', 'stash-save'],
];

// ─── 3) المجموعة العمياء: كُتبت قبل ضبط الكلمات عليها (النتيجة الأولى: 23/30) ───
const BLIND = [
  ['كيف اسوي كوميت', 'commit'],
  ['أريد رفع التعديلات إلى GitHub', 'push'],
  ['جيب آخر تحديثات من الريبو', 'pull'],
  ['أبي أنسخ الريبو على جهازي', 'clone'],
  ['ابدأ مشروع git جديد', 'init'],
  ['ودي اعرف وش الفرع اللي انا فيه', 'status'],
  ['اعمل branch اسمه fix-header', 'branch-create'],
  ['حوّلني لفرع develop', 'branch-switch'],
  ['امسح فرع test', 'branch-delete'],
  ['اعرض لي قائمة البرانشات', 'branch-list'],
  ['بدي سمّي الفرع اسم تاني', 'branch-rename'],
  ['عندي conflict وأبي أوقف الميرج', 'merge-abort'],
  ['ضم الفرع feature للماستر', 'branch-merge'],
  ['احفظ شغلي مؤقتا قبل ما انتقل', 'stash-save'],
  ['رجّع اللي حفظته بالستاش', 'stash-pop'],
  ['عايز اشوف كل الستاشات', 'stash-list'],
  ['ألغِ آخر commit لكن احتفظ بالكود', 'undo-commit-keep'],
  ['احذف آخر commit مع كل تعديلاته', 'undo-commit-discard'],
  ['الكوميت انرفع وابغى الغيه بأمان', 'revert'],
  ['اكتبت رسالة الكوميت غلط', 'commit-amend'],
  ['نسيت ملف README في الكوميت', 'commit-amend-add'],
  ['رجّع ملف config.js لآخر نسخة', 'file-discard'],
  ['أخرج الملف من منطقة التجهيز', 'file-unstage'],
  ['خلّي git يتجاهل ملف .env ويوقف تتبعه', 'file-untrack'],
  ['ابي فرعي يصير نفس اللي على origin', 'reset-to-remote'],
  ['ارفع البرانش الجديد للسيرفر أول مرة', 'push-upstream'],
  ['اربط الفولدر بريبو على github', 'remote-add'],
  ['push --force', 'push-force'],
  ['شيل الملفات الجديدة اللي مو متتبعة', 'clean'],
  ['وش الفروقات في الكود', 'diff'],
];

// ─── 4) جمل لا علاقة لها بـ Git: يجب ألا تُطابق أي أمر ───
const NO_MATCH = [
  'كيف حالك اليوم',
  'ما هو أفضل مطعم في المدينة',
  'اكتب لي قصيدة عن البحر',
  'كم الساعة الآن',
];

// ─── التشغيل ───
const failures = [];

function runSet(name, cases) {
  let pass = 0;
  for (const [text, expected, kind] of cases) {
    const { match } = matchIntent(text, db);
    const got = match ? match.id : null;
    if (got === expected) pass++;
    else failures.push({ set: name, text, expected, got: got || '— لم تُفهم —', kind });
  }
  console.log(`  • ${name}: ${pass}/${cases.length}`);
  return pass;
}

console.log('\nفهم الجمل:');
let total = 0, passed = 0;
for (const [name, cases] of [['الأساسية', CORE], ['الموسّعة', EXTENDED], ['العمياء', BLIND]]) {
  passed += runSet(name, cases);
  total += cases.length;
}
let noMatchPass = 0;
for (const text of NO_MATCH) {
  const { match } = matchIntent(text, db);
  if (!match) noMatchPass++;
  else failures.push({ set: 'بلا تطابق', text, expected: '— لا شيء —', got: match.id });
}
console.log(`  • جمل خارج الموضوع: ${noMatchPass}/${NO_MATCH.length}`);
console.log(`  المجموع: ${passed + noMatchPass}/${total + NO_MATCH.length}`);

// فصحى/عامية في المجموعة الأساسية
const byKind = {};
for (const [text, expected, kind] of CORE) {
  byKind[kind] = byKind[kind] || [0, 0];
  byKind[kind][1]++;
  if ((matchIntent(text, db).match || {}).id === expected) byKind[kind][0]++;
}
console.log('  حسب اللهجة (الأساسية): ' + Object.entries(byKind).map(([k, [p, t]]) => `${k} ${p}/${t}`).join('، '));

if (failures.length) {
  console.log('\nالجمل التي لم تُفهم أو فُهمت خطأً:');
  for (const f of failures) {
    console.log(`  ✗ [${f.set}] "${f.text}"\n      المتوقع: ${f.expected} | الناتج: ${f.got}`);
  }
}

// ─── 5) سلامة commands.json ───
const schemaErrors = [];
const ids = new Set();
for (const c of raw.commands) {
  for (const field of ['id', 'category', 'title', 'keywords', 'command', 'explanation', 'danger']) {
    if (c[field] == null || c[field] === '') schemaErrors.push(`${c.id || '?'}: الحقل ${field} مفقود`);
  }
  if (ids.has(c.id)) schemaErrors.push(`${c.id}: معرّف مكرر`);
  ids.add(c.id);
  if (!['safe', 'warning', 'danger'].includes(c.danger)) schemaErrors.push(`${c.id}: danger غير صالح`);
  if (c.danger === 'danger' && !c.warning) schemaErrors.push(`${c.id}: أمر خطر بلا تحذير`);
  if (!raw.categories[c.category]) schemaErrors.push(`${c.id}: فئة غير معروفة ${c.category}`);
  if (!Array.isArray(c.keywords) || !c.keywords.length) schemaErrors.push(`${c.id}: لا كلمات مفتاحية`);
}
for (const t of [...CORE, ...EXTENDED, ...BLIND]) {
  if (!ids.has(t[1])) schemaErrors.push(`اختبار يشير إلى مهمة غير موجودة: ${t[1]}`);
}
// كل أمر خطير معروف يجب أن يكون "danger"
for (const pattern of ['reset --hard', '--force', 'clean -f']) {
  for (const c of raw.commands) {
    if (c.command.includes(pattern) && c.danger !== 'danger') schemaErrors.push(`${c.id}: يحوي ${pattern} ولم يُعلَّم كخطر`);
  }
}
console.log(`\nسلامة commands.json (${raw.commands.length} مهمة): ${schemaErrors.length ? 'أخطاء' : 'سليم'}`);
schemaErrors.forEach(e => console.log('  ✗ ' + e));

// ─── 6) الدوال المساعدة ───
const unit = [
  [normalizeArabic('أُريدُ إنشاءَ فرعٍ جديدةٍ'), 'اريد انشاء فرع جديده'],
  [normalizeArabic('مُؤقّتاً — آخِر'), 'موقتا اخر'],
  [fillPlaceholders('git switch -c <اسم-الفرع>', 'اعمل فرع اسمه feature-login'), 'git switch -c feature-login'],
  [fillPlaceholders('git commit -m "<الرسالة>"', 'اعمل كوميت برسالة "إصلاح الخطأ"'), 'git commit -m "إصلاح الخطأ"'],
  [fillPlaceholders('git clone <رابط-المستودع>', 'استنسخ https://github.com/user/repo.git'), 'git clone https://github.com/user/repo.git'],
  [matchIntent('كلام عشوائي لا علاقة له', db).suggestions.length, 3],
];
const unitFailures = unit.filter(([got, want]) => got !== want);
console.log(`\nالدوال المساعدة: ${unit.length - unitFailures.length}/${unit.length} ناجحة`);
for (const [got, want] of unitFailures) console.log(`  ✗ الناتج: ${JSON.stringify(got)} | المتوقع: ${JSON.stringify(want)}`);

process.exit(failures.length || unitFailures.length || schemaErrors.length ? 1 : 0);
