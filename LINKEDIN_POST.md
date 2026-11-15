# منشور LinkedIn — Git بالعربية

> أرفق مع المنشور: `social/screenshot-desktop.png` و`social/screenshot-mobile.png` (المنشورات ذات الصور تنتشر أكثر من الروابط وحدها)، وضع الرابط في المنشور أو في أول تعليق.
> استبدل [الرابط] و[رابط الكود] قبل النشر.

---

## النسخة العربية

كم مرة بحثت في Google: «كيف أتراجع عن آخر commit بدون ما أخسر شغلي؟» 🤔

بنيت أداة صغيرة اسمها **Git بالعربية** 👇

تكتب ما تريده بكلماتك — فصحى أو عامية — فتحصل على:
✅ الأمر الصحيح
✅ شرح عربي مختصر لما يفعله
⚠️ تحذير واضح إن كان الأمر خطيراً (مثل reset --hard أو push --force)

جرّب تكتب:
• «ابغى ارجع آخر كوميت بس خلي التعديلات»
• «عايز اعمل برانش جديد اسمه feature-login»
• «لا تحذف تعديلاتي بس الغي آخر كوميت»

بعض ما تعلمته أثناء بنائه:
🔹 العربية تحتاج «تطبيعاً» قبل أي مطابقة: إزالة التشكيل، وتوحيد الهمزات والتاء المربوطة، ونزع «ال» و«بال» و«لل».
🔹 النفي يقلب المعنى: «لا تحذف» عكس «احذف»، والخطأ هنا يعني أمراً يمسح شغل المستخدم.
🔹 عند الشك بين أمرين، الأداة تختار الأكثر أماناً دائماً.
🔹 قِس بصدق: اختبرت النظام على جمل لم يرها من قبل، فكانت دقته الأولى 77% لا 100%، وهذا ما وجّه التحسينات.

التقنية: HTML وCSS وJavaScript فقط، بلا أي مكتبات، و32 أمراً، و95 اختباراً.
الأداة تعرض الأوامر فقط ولا تنفّذ شيئاً.

🔗 جرّبها: [الرابط]
💻 الكود مفتوح: [رابط الكود]

ما الأمر الذي تتمنى أن تضيفه؟ اكتبه في التعليقات بالعربي، وسأرى إن كانت الأداة تفهمه 😄

#Git #البرمجة #JavaScript #المحتوى_العربي #تطوير_الويب #مشاريع_جانبية

---

## English version (optional)

How many times have you googled "how to undo the last commit without losing my changes"? 🤔

I built **Git بالعربية** (Git in Arabic): describe what you want in Arabic — formal or any dialect — and get:
✅ the right Git command
✅ a short Arabic explanation
⚠️ a clear warning for destructive commands (reset --hard, push --force…)

What I learned:
🔹 Arabic needs normalization before matching (diacritics, hamza forms, prefixes like ال/بال/لل).
🔹 Negation flips meaning: "don't delete my changes" must map to the *safe* command.
🔹 When in doubt, pick the safer command.
🔹 Measure honestly: on sentences it had never seen, first accuracy was 77%, not 100%.

Plain HTML/CSS/JS, zero dependencies, 32 commands, 95 tests. It only shows commands — never runs them.

🔗 Try it: [link]
💻 Code: [repo]

#Git #JavaScript #Arabic #WebDev #SideProject
