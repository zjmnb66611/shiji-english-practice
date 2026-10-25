'use strict';
window.ORIGINAL_QUESTIONS = (() => {
  let id = 0;
  const make = (type, section, tag, level, stem, options, answer, explanation, passage = '') => ({
    id: `original-${String(++id).padStart(3, '0')}`, origin: 'original', type, section, tag, level,
    stem, options: options.map((t, i) => ({ label: String.fromCharCode(65 + i), text: t })),
    answer, explanation, passage, source: '本站原创练习，非《必刷2000题》原题', page: '', number: '', ready: true
  });
  const q = [];
  const single = (section, tag, level, stem, options, answer, explanation, passage) => q.push(make('single', section, tag, level, stem, options, [answer], explanation, passage));
  [
    ['固定搭配',1,'The new library provides students ______ a quiet place to study.',['for','with','of','at'],'B','provide somebody with something 表示“为某人提供某物”。也可以说 provide something for somebody，但本题 students 位于空格之前，因此用 with。'],
    ['词义辨析',1,'Please read the instructions ______ before using the machine.',['careful','carefully','careless','care'],'B','空格修饰动词 read，应选副词 carefully，意为“仔细地”。careful 和 careless 是形容词；care 在这里不能充当修饰 read 的副词。'],
    ['固定搭配',1,'We look forward to ______ from you soon.',['hear','heard','hearing','be heard'],'C','look forward to 中的 to 是介词，后接名词或动名词，因此用 hearing。不能把这里的 to 当作不定式符号。'],
    ['词义辨析',2,'The bus was late, so we decided to walk ______ waiting.',['because of','instead of','according to','in front of'],'B','句意：公交车晚点了，所以我们决定步行，而不是继续等。instead of 表示“代替；而不是”。because of 表示原因，according to 表示依据，in front of 表示方位。'],
    ['固定搭配',1,'Could you give me some ______ on learning English?',['advices','suggestion','advice','informations'],'C','advice 是不可数名词，some advice 表示“一些建议”。suggestion 是可数名词，此处需用复数 suggestions；information 也是不可数名词，不能加 s。'],
    ['词义辨析',2,'The word “brief” in “a brief meeting” is closest in meaning to ______.',['short','expensive','private','difficult'],'A','brief 修饰 meeting 时，强调持续时间短，与 short 最接近。private 强调私密性，difficult 强调难度，expensive 强调费用。'],
    ['介词搭配',1,'Reading every day can have a positive effect ______ your vocabulary.',['in','at','on','by'],'C','have an effect on 是固定搭配，意为“对……产生影响”。positive effect 表示积极影响。'],
  ].forEach(x => single('词汇搭配', ...x));
  [
    ['完成时态',1,'I ______ in this city since 2022, and I still live here.',['lived','have lived','had lived','will live'],'B','since 2022 表示从过去某一时间持续到现在，且后半句说明现在仍住在这里，因此用现在完成时 have lived。过去完成时需要另一个过去时间点作为参照。'],
    ['过去进行时',1,'At eight last night, Lily ______ for her English test.',['studies','has studied','was studying','will study'],'C','at eight last night 指过去某一具体时刻，用过去进行时表示当时正在进行的动作：was studying。'],
    ['被动语态',1,'The bridge ______ in 2010 and is still in use.',['builds','built','was built','has built'],'C','bridge 与 build 之间是被动关系；in 2010 是过去时间，所以用一般过去时的被动语态 was built。'],
    ['定语从句',1,'The woman ______ teaches us English is from Shanghai.',['which','who','where','whose'],'B','先行词 the woman 指人，关系词在从句中作主语，选 who。whose 表所属关系，需要修饰后面的名词。'],
    ['非谓语动词',1,'The teacher asked us ______ our phones during the test.',['not use','not using','not to use','to not using'],'C','ask somebody not to do something 表示“要求某人不要做某事”。不定式的否定通常将 not 放在 to 前。'],
    ['主谓一致',2,'Neither the teacher nor the students ______ ready yet.',['is','are','was','has'],'B','neither…nor… 连接两个主语时，谓语通常与较近的主语保持一致。较近的 students 为复数，因此选 are。'],
    ['虚拟语气',2,'If I were you, I ______ the offer carefully before accepting it.',['consider','will consider','would consider','have considered'],'C','If I were you 表示与现在事实不符的假设，主句用 would + 动词原形。这里是建议对方认真考虑邀请。'],
    ['倒装结构',3,'Only after the exam ______ how much he had learned.',['he realized','did he realize','he had realized','does he realized'],'B','only + 状语置于句首时，主句通常部分倒装。语境为过去，因此把助动词 did 放在 he 前，实义动词用原形 realize。'],
    ['名词性从句',2,'______ surprised me was how calmly she handled the problem.',['That','What','Which','Whether'],'B','主语从句内部缺少主语，What 既引导从句又充当 surprised 的主语，意为“使我惊讶的事情”。That 引导名词性从句时不充当成分。'],
    ['状语从句',1,'I will call you as soon as I ______ at the station.',['arrive','will arrive','arrived','have been arriving'],'A','as soon as 引导时间状语从句，主句表将来时，从句通常用一般现在时表示将来，所以用 arrive。'],
    ['比较结构',2,'This exercise is ______ than the one we did yesterday.',['much easy','more easier','much easier','most easy'],'C','easy 的比较级是 easier，much 可以修饰比较级表示程度。more 与 easier 叠用属于比较级重复。'],
    ['非谓语动词',2,'______ by the news, the students immediately called their families.',['Encouraging','To encourage','Encouraged','Having encouraged'],'C','students 是受到鼓舞的人，与 encourage 构成被动关系。过去分词 Encouraged 在句中作原因状语。其余选项不能表达这里的被动关系。'],
  ].forEach(x => single('语法结构', ...x));
  const passage = 'A small community library introduced a “quiet morning” programme in March. From nine to eleven every Saturday, visitors were asked to put their phones away and read without interruption. At first, the librarian expected only a few retired residents to attend. Instead, students and office workers soon became regular visitors.\n\nAfter six weeks, the library asked participants about their experience. Many said that the programme helped them finish books they had previously abandoned. Some also reported feeling less distracted later in the day. However, the librarian pointed out that the survey included only volunteers who had chosen to attend. She did not claim that quiet reading would have the same effect on everyone. The library plans to continue the programme and collect more feedback.';
  single('阅读理解','细节理解',1,'When does the quiet morning programme take place?',['Every weekday morning.','On Saturday from nine to eleven.','On Sunday afternoon.','Every evening after work.'],'B','文章第一段明确给出时间：every Saturday，from nine to eleven。其余选项与原文的日期或时间不一致。',passage);
  single('阅读理解','细节理解',1,'Which groups unexpectedly became regular visitors?',['Students and office workers.','Only retired residents.','Tourists and shop owners.','Only librarians.'],'A','图书管理员起初预计只有少量退休居民参加，实际学生和上班族成为常客。注意区分“最初预期”和“实际发生”。',passage);
  single('阅读理解','推理判断',3,'Why did the librarian mention that the survey included only volunteers?',['To prove that everyone likes reading.','To explain why the library should close.','To acknowledge a limitation of the survey.','To say that the volunteers had no phones.'],'C','参加者是自愿报名者，其特征可能与其他人不同。指出这一点是在说明调查结论的适用范围，不能直接推广到所有人。',passage);
  single('阅读理解','主旨理解',2,'Which title best matches the passage?',['A Library Tests Quiet Reading Mornings','Why All Phones Should Be Banned','The End of Community Libraries','A Guide to Buying Books'],'A','全文围绕社区图书馆的安静阅读项目，介绍实施方式、反馈和结论局限。B过度概括，C与D不符合主要内容。',passage);
  q.push(make('multiple','语法结构','完成时态',2,'选择所有语法正确的句子。',[
    'She has lived here for five years.','I have seen him yesterday.','They have just finished the work.','He have already left.'
  ],['A','C'],'A 和 C 的主谓及现在完成时用法正确。B 的 yesterday 是明确过去时间，通常应改为 I saw him yesterday。D 的 He 为第三人称单数，应使用 has。多选题须完整选对全部正确选项。'));
  q.push(make('multiple','词汇搭配','介词搭配',2,'选择所有搭配正确的表达。',[
    'be interested in music','depend of the weather','be responsible for the project','listen to the radio'
  ],['A','C','D'],'正确搭配分别为 be interested in、be responsible for、listen to。B 应为 depend on，而不是 depend of。'));
  q.push(make('multiple','阅读理解','证据与推断',3,'根据上述图书馆短文，选择所有有原文支持的说法。',[
    'The programme began in March.','All participants became better students.','The survey was conducted after six weeks.','The library plans to continue the programme.'
  ],['A','C','D'],'原文分别明确了开始月份、六周后开展调查以及继续项目的计划。B 把有限的阅读反馈扩展成“所有参加者学业进步”，没有原文依据。',passage));
  q.push(make('blank','语法结构','完成时态',1,'用括号内单词的适当形式填空：\nShe has already ______ (finish) her homework.',[],['finished'],'现在完成时由 has/have + 过去分词构成。finish 为规则动词，过去分词是 finished。本题只需填写空格中的一个词。'));
  q.push(make('blank','词汇搭配','固定搭配',1,'填入一个合适的介词：\nHe is good ______ solving practical problems.',[],['at'],'be good at doing something 表示“擅长做某事”。at 是介词，后接 solving。'));
  q.push(make('blank','语法结构','非谓语动词',2,'用括号内单词的适当形式填空：\nWould you mind ______ (close) the window?',[],['closing'],'mind 后接动名词作宾语，因此使用 closing。Would you mind doing…? 是礼貌请求的常见表达。'));
  q.push(make('blank','词汇搭配','固定搭配',1,'补全短语（只填一个词）：\nPlease pay ______ to the spelling of this word.',[],['attention'],'pay attention to 意为“注意……”。此处要求填写名词 attention。填空判定会忽略首尾空格、大小写和句末标点，但不会按关键词猜测答案。'));
  q.push(make('essay','翻译写作','英译汉',2,'把下面的句子译成中文：\nRegular practice is more effective than studying everything the night before an exam.',[],
    '规律练习比在考试前一晚突击学习所有内容更有效。',
    '参考评分（满分5分）：准确译出 regular practice（1分）；准确表达 more effective than 的比较关系（2分）；完整译出考前一晚突击学习的时间和动作（2分）。中文表述可以灵活变化。此题采用参考答案对照自评，不进行机器语义打分。'));
  q.push(make('essay','翻译写作','应用写作',3,'写一封80—120词的英文邮件，邀请同学参加周六上午的英语学习小组。请包括时间、地点、活动内容和回复方式。',[],
    'Dear Alex,\nI would like to invite you to our English study group this Saturday. We will meet at nine in the morning in Room 203 of the school library. During the session, we will review useful expressions, discuss a short article and practise speaking in pairs. You do not need to prepare anything special, but please bring a notebook. I think it will be a good opportunity for us to learn from each other. Please reply to this email by Friday afternoon and let me know whether you can join us.\nBest wishes,\nLi Ming',
    '参考评分（满分5分）：时间地点清楚（1分），活动安排及回复方式完整（1分），语言准确且表达连贯（2分），邮件格式及字数符合要求（1分）。范文仅供参考；其他符合任务的表达同样可以得分。请对照标准自行评分。'));
  return q;
})();
