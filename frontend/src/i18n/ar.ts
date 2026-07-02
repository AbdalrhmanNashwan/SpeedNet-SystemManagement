/**
 * Arabic (MSA) translations, keyed by the English source string used in the UI.
 * Edit any wording here — missing keys fall back to the English text.
 * Use {var} placeholders to match the t("…", { var }) call sites.
 */
export const ar: Record<string, string> = {
  // ---- Brand / generic ----
  "SPEEDNeT Console": "لوحة تحكم سبيدنت",
  "Network Management Console": "لوحة إدارة الشبكة",
  "Loading…": "جارٍ التحميل…",
  "Saving…": "جارٍ الحفظ…",
  "Cancel": "إلغاء",
  "Save": "حفظ",
  "Create": "إنشاء",
  "Edit": "تعديل",
  "Del": "حذف",
  "Delete": "حذف",
  "Clear": "مسح",
  "Assign": "تعيين",
  "Moving…": "جارٍ النقل…",
  "Sign out": "تسجيل الخروج",
  "Search anything…": "ابحث عن أي شيء…",
  "total": "الإجمالي",

  // ---- Nav ----
  "Towers": "الأبراج",
  "Links": "الوصلات",
  "Switches": "السويتشات",
  "Sectors": "القطاعات",
  "Sectors (APs)": "القطاعات (نقاط الوصول)",
  "Servers": "الخوادم",
  "Monitor": "المراقبة",
  "History": "السجل",
  "Users": "المستخدمون",
  "Backups": "النسخ الاحتياطية",
  "Menu": "القائمة",

  // ---- Login ----
  "Network": "الشبكة",
  "Management": "الإدارة",
  "Console": "لوحة التحكم",
  "Monitor and manage your tower network — switches, sectors, links and more — from a single interface.":
    "راقب وأدِر شبكة أبراجك — السويتشات والقطاعات والوصلات والمزيد — من واجهة واحدة.",
  "PTP Links": "وصلات نقطة لنقطة",
  "Sign in": "تسجيل الدخول",
  "Enter your credentials to continue": "أدخل بياناتك للمتابعة",
  "Email address": "البريد الإلكتروني",
  "Password": "كلمة المرور",
  "Signing in…": "جارٍ تسجيل الدخول…",
  "Invalid email or password.": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "Designed & developed by": "تصميم وتطوير",

  // ---- Home ----
  "Network Zones": "مناطق الشبكة",
  "Zones": "المناطق",
  "Select a zone to view its towers and backbone links.":
    "اختر منطقة لعرض أبراجها ووصلاتها الأساسية.",
  "+ Add Zone": "+ إضافة منطقة",
  "My Towers": "أبراجي",
  "All Towers": "كل الأبراج",
  "{n} total": "{n} إجمالاً",
  "Browse by Section": "التصفح حسب القسم",
  "All devices of a type across every tower.":
    "كل الأجهزة من نوع معيّن عبر جميع الأبراج.",
  "IP Allocations": "تخصيصات العناوين",
  "{n} tower": "{n} برج",
  "{n} towers": "{n} برج",
  'Delete zone "{name}"?': 'حذف المنطقة "{name}"؟',

  // ---- Zone page ----
  "Home": "الرئيسية",
  "Zone": "المنطقة",
  "No towers in this zone.": "لا توجد أبراج في هذه المنطقة.",

  // ---- Towers ----
  "Add Tower": "إضافة برج",
  "+ Add Tower": "+ إضافة برج",
  "Name *": "الاسم *",
  "Name": "الاسم",
  "Area": "المنطقة الجغرافية",
  "Agent": "الوكيل",
  "Status": "الحالة",
  "— none —": "— لا شيء —",
  "Filter by name or area…": "تصفية حسب الاسم أو المنطقة…",
  "All zones": "كل المناطق",
  "All statuses": "كل الحالات",
  "Tip: tick towers to move them into a zone.":
    "تلميح: حدّد الأبراج لنقلها إلى منطقة.",
  "Select all shown": "تحديد كل المعروض",
  "{n} selected": "{n} محدد",
  "Move to zone:": "النقل إلى منطقة:",
  "— choose zone —": "— اختر منطقة —",
  "No Zone (unassign)": "بلا منطقة (إلغاء التعيين)",
  "No Zone": "بلا منطقة",
  "Select": "تحديد",
  "Delete tower": "حذف البرج",
  'Delete tower "{name}"?': 'حذف البرج "{name}"؟',

  // ---- Device list ----
  "{n} across {t} tower": "{n} عبر {t} برج",
  "{n} across {t} towers": "{n} عبر {t} برج",
  "No {label} found.": "لا توجد {label}.",
  "Tower #{id}": "برج رقم {id}",

  // ---- Device table ----
  "Transfer": "نقل",
  "Transfer selected": "نقل المحدد",
  "Delete selected": "حذف المحدد",
  "Select all": "تحديد الكل",
  "Delete this row?": "حذف هذا الصف؟",
  "Delete {n} selected row(s)? This cannot be undone.":
    "حذف {n} صف محدد؟ لا يمكن التراجع عن هذا.",

  // ---- Tower detail ----
  "+ Add": "+ إضافة",
  "None": "لا شيء",
  "Tower not found.": "البرج غير موجود.",
  'Delete tower "{name}"? This cannot be undone.':
    'حذف البرج "{name}"؟ لا يمكن التراجع عن هذا.',
  "Tower Info": "معلومات البرج",
  "Agency ID": "معرّف الوكالة",
  "Reseller": "الموزّع",
  "Affiliate": "التابع",
  "Phone": "الهاتف",
  "Link type": "نوع الوصلة",
  "Switch type": "نوع السويتش",
  "VLAN": "VLAN",
  "Admin page": "صفحة الإدارة",
  "Admin password": "كلمة مرور الإدارة",
  "GPS lat": "خط العرض GPS",
  "GPS lng": "خط الطول GPS",
  "Height": "الارتفاع",
  "Notes": "ملاحظات",

  // ---- Device columns ----
  "SSID": "اسم الشبكة (SSID)",
  "Device": "الجهاز",
  "Type": "النوع",
  "Model": "الطراز",
  "IP": "العنوان",
  "Gateway": "البوابة",
  "MAC": "عنوان MAC",
  "Target": "الهدف",
  "Username": "اسم المستخدم",
  "Port": "المنفذ",
  "URL": "الرابط",

  // ---- Search ----
  "Search": "البحث",
  "Results for": "نتائج البحث عن",
  "— searched towers, devices, zones & IP allocations":
    "— تم البحث في الأبراج والأجهزة والمناطق وتخصيصات العناوين",
  "Enter a query in the search box.": "أدخل كلمة في صندوق البحث.",
  'Nothing found matching "{q}".': 'لا توجد نتائج مطابقة لـ "{q}".',
  "Devices": "الأجهزة",
  "{n} result": "{n} نتيجة",
  "{n} results": "{n} نتيجة",
  "no tower": "بلا برج",

  // ---- History ----
  "Every change — who did what, and when": "كل تغيير — من فعل ماذا، ومتى",
  " · refreshing…": " · جارٍ التحديث…",
  "All actions": "كل العمليات",
  "All types": "كل الأنواع",
  "Filter by user email…": "تصفية حسب بريد المستخدم…",
  "‹ Newer": "‹ الأحدث",
  "Older ›": "الأقدم ›",
  "page {n}": "صفحة {n}",
  "No history entries match.": "لا توجد إدخالات مطابقة في السجل.",
  "When": "الوقت",
  "User": "المستخدم",
  "Action": "العملية",
  "ID": "المعرّف",
  "Details": "التفاصيل",
  "create": "إنشاء",
  "update": "تحديث",
  "delete": "حذف",
  "transfer": "نقل",
  "recompute": "إعادة حساب",

  // ---- Monitor ----
  "Network Monitor": "مراقبة الشبكة",
  "Live ICMP ping of every IP in the database":
    "فحص مباشر (ICMP) لكل عنوان في قاعدة البيانات",
  "last sweep {ago}": "آخر فحص {ago}",
  "monitor not running": "المراقبة متوقفة",
  "Monitor error: {err}": "خطأ في المراقبة: {err}",
  "Total IPs": "إجمالي العناوين",
  "Online": "متصل",
  "Offline": "غير متصل",
  "Unknown": "غير معروف",
  "All {n}": "الكل {n}",
  "Online {n}": "متصل {n}",
  "Offline {n}": "غير متصل {n}",
  "Unknown {n}": "غير معروف {n}",
  "Filter by IP or source…": "تصفية حسب العنوان أو المصدر…",
  "Failed to load monitor status.": "تعذّر تحميل حالة المراقبة.",
  "No IPs match.": "لا توجد عناوين مطابقة.",
  "Latency": "زمن الاستجابة",
  "Loss": "نسبة الفقد",
  "Source": "المصدر",
  "Checked": "آخر فحص",

  // ---- Backups ----
  "Download a snapshot of all data, or restore the database from a backup archive. Archives are named by date & time":
    "نزّل نسخة من كل البيانات، أو استعد قاعدة البيانات من أرشيف نسخة احتياطية. تُسمّى الأرشيفات حسب التاريخ والوقت",
  "Create backup now": "إنشاء نسخة احتياطية الآن",
  "Creating…": "جارٍ الإنشاء…",
  "Restore from backup": "الاستعادة من نسخة احتياطية",
  "Destructive.": "إجراء مدمّر.",
  "This wipes and reloads every data table (towers, devices, IP allocations…) from the uploaded archive. User accounts are left untouched. This cannot be undone — take a fresh backup first if unsure.":
    "يقوم هذا بمسح وإعادة تحميل كل جداول البيانات (الأبراج، الأجهزة، تخصيصات العناوين…) من الأرشيف المرفوع. لا تتأثر حسابات المستخدمين. لا يمكن التراجع — خذ نسخة احتياطية جديدة أولًا إذا لم تكن متأكدًا.",
  "Restore database": "استعادة قاعدة البيانات",
  "Restoring…": "جارٍ الاستعادة…",
  "Selected: {name}": "المحدد: {name}",
  "Existing backups": "النسخ الاحتياطية الحالية",
  "No backups yet.": "لا توجد نسخ احتياطية بعد.",
  "Download": "تنزيل",
  "Backup created: {name}": "تم إنشاء نسخة احتياطية: {name}",
  "Backup failed": "فشل إنشاء النسخة الاحتياطية",
  "Restored {n} rows from backup": "تمت استعادة {n} سجل من النسخة الاحتياطية",
  "Restore failed": "فشلت الاستعادة",
  "Please choose a backup .zip file": "يرجى اختيار ملف نسخة احتياطية بصيغة .zip",
  "Download failed": "فشل التنزيل",
  'Replace ALL current data with "{name}"? This cannot be undone.':
    'استبدال كل البيانات الحالية بـ "{name}"؟ لا يمكن التراجع عن هذا.',

  // ---- IP Allocations ----
  "Upstream IP-block registry · {n} rows": "سجل كتل العناوين العلوية · {n} صف",
  "Filter…": "تصفية…",
  "+ Add row": "+ إضافة صف",
  "No allocations match.": "لا توجد تخصيصات مطابقة.",
  "Delete this allocation row?": "حذف صف التخصيص هذا؟",
  "Point": "النقطة",
  "Owner": "المالك",
  "Tower ref": "مرجع البرج",
  "Parent": "الأصل",
  "IP block": "كتلة العناوين",
  "IP master": "العنوان الرئيسي",
  "User master": "المستخدم الرئيسي",
  "Pass master": "كلمة المرور الرئيسية",
  "IP slave": "العنوان التابع",
  "User slave": "المستخدم التابع",
  "Pass slave": "كلمة المرور التابعة",
  "Switch IP": "عنوان السويتش",
  "Switch pass": "كلمة مرور السويتش",
  "RS pass": "كلمة مرور RS",
  "Note": "ملاحظة",

  // ---- Notifications ----
  "Notifications": "الإشعارات",
  "Alerts on": "التنبيهات مفعّلة",
  "Alerts off": "التنبيهات متوقفة",
  "No alerts yet. You'll see device down/recovery events here.":
    "لا توجد تنبيهات بعد. ستظهر هنا أحداث انقطاع/عودة الأجهزة.",
  "Triggers after {n} failed checks · {m}m cooldown":
    "يُطلق بعد {n} محاولات فاشلة · مهلة {m} دقيقة",
  "just now": "الآن",
  "{n}m ago": "قبل {n} دقيقة",
  "{n}h ago": "قبل {n} ساعة",
  "{n}d ago": "قبل {n} يوم",

  // ---- Time (Monitor "ago") ----
  "{n}s ago": "قبل {n} ثانية",

  // ---- EditableField ----
  "Copied": "تم النسخ",
  "Copy not supported here": "النسخ غير مدعوم هنا",
  "Copy failed": "فشل النسخ",
  "Click to copy": "انقر للنسخ",
  "Click to copy · double-click to edit": "انقر للنسخ · انقر نقرًا مزدوجًا للتعديل",
  "✎ custom…": "✎ مخصص…",

  // ---- TowerCard ----
  "{n} users": "{n} مستخدم",

  // ---- Transfer dialog ----
  "Transfer Device": "نقل الجهاز",
  "Transfer Devices": "نقل الأجهزة",
  "Device #{id}": "جهاز رقم {id}",
  "{n} devices": "{n} جهاز",
  "Target Section": "القسم الهدف",
  "Target Tower": "البرج الهدف",
  "Transferring…": "جارٍ النقل…",

  // ---- StatusDot ----
  "Pinging…": "جارٍ الفحص…",
  "click to re-ping": "انقر لإعادة الفحص",

  // ---- Zone dialog ----
  "Edit Zone": "تعديل المنطقة",
  "Add Zone": "إضافة منطقة",
  "Tag": "الوسم",
  "Icon (emoji)": "الأيقونة (إيموجي)",
  "Color": "اللون",
  "(optional — tints the bubble on Home)": "(اختياري — يلوّن بطاقة المنطقة في الرئيسية)",
  "No color": "بلا لون",
  "Rule field": "حقل القاعدة",
  "Rule value": "قيمة القاعدة",

  // ---- Users ----
  "User Management": "إدارة المستخدمين",
  "Add User": "إضافة مستخدم",
  "+ Add User": "+ إضافة مستخدم",
  "Email": "البريد الإلكتروني",
  "Role": "الدور",
  "Active": "مُفعّل",
  "Inactive": "معطّل",
  "Permissions": "الصلاحيات",
  "Full access": "صلاحية كاملة",
  "Add, edit & delete": "إضافة وتعديل وحذف",
  "View only": "عرض فقط",
  "Update": "تعديل",
  "Leave all off for view-only access.": "اترك الكل مُطفأً للوصول بالعرض فقط.",
  "Delete user {email}?": "حذف المستخدم {email}؟",
  "admin": "مدير",
  "editor": "محرّر",
  "viewer": "مشاهد",
  "agent": "وكيل",
  "Set what this user can do": "حدّد صلاحيات هذا المستخدم",
  "Admin — full access": "مدير — صلاحية كاملة",
  "Editor — add, edit & delete": "محرّر — إضافة وتعديل وحذف",
  "Viewer — watch only": "مشاهد — عرض فقط",
  "Agent — watch own zone": "وكيل — عرض منطقته فقط",

  // ---- Public corporate site (/site) ----
  "Coverage": "التغطية",
  "Contact": "تواصل معنا",
  "Customer Console": "بوابة العملاء",
  "Internet that just works": "إنترنت يعمل بلا عناء",
  "Connecting your world,": "نربط عالمك،",
  "at the speed of now.": "بسرعة اللحظة.",
  "SPEEDNeT delivers fast, reliable internet across the region — backed by a strong network and a support team that actually picks up.":
    "تقدّم سبيدنت إنترنت سريعًا وموثوقًا في عموم المنطقة — مدعومًا بشبكة قوية وفريق دعم يردّ فعلاً على اتصالك.",
  "View Plans": "عرض الباقات",
  "Talk to us": "تحدّث إلينا",
  "Uptime": "نسبة التشغيل",
  "Support": "الدعم",
  "Speed": "السرعة",
  "Reliability": "الموثوقية",
  "Your link": "وصلتك",
  "Get connected": "اتصل الآن",
  "Scroll down": "مرّر للأسفل",
  "Back to top": "العودة للأعلى",
  "How it works": "كيف يعمل",
  "Outdoor wireless internet": "إنترنت لاسلكي خارجي",
  "since 2010": "منذ 2010",
  "Serving the region since 2010": "نخدم المنطقة منذ عام 2010",

  // Human/local rewrite
  "Mosul & Nineveh": "الموصل ونينوى",
  "Your neighbors'": "شركة إنترنت",
  "internet company.": "من جيرانك.",
  "Since 2010 we've put antennas on rooftops across Mosul — our own wireless network, kept running by a local team you can actually reach by phone or WhatsApp.":
    "منذ عام 2010 ونحن نركّب الهوائيات على أسطح المنازل في عموم الموصل — شبكتنا اللاسلكية الخاصة، يديرها فريق محلي يمكنك الوصول إليه فعلاً عبر الهاتف أو واتساب.",
  "About": "من نحن",
  "About us": "من نحن",
  "A local network, built tower by tower": "شبكة محلية، بُنيت برجًا برجًا",
  "We started in Mosul in 2010 with a handful of rooftops. Today our own towers and antennas reach homes and businesses across the city and the Nineveh plains. We install it, we maintain it, and when something goes wrong you talk to people here — not a call center in another country.":
    "بدأنا في الموصل عام 2010 بعدد قليل من الأسطح. واليوم تصل أبراجنا وهوائياتنا إلى المنازل والأعمال في عموم المدينة وسهل نينوى. نحن نركّب ونصيّن، وعند حدوث أي خلل تتحدّث مع أشخاص هنا — لا مع مركز اتصال في بلد آخر.",
  "15+ yrs": "+15 سنة",
  "Serving Mosul": "في خدمة الموصل",
  "Towers & sites": "أبراج ومواقع",
  "Local": "محلي",
  "Support team": "فريق الدعم",
  "Towers across Mosul & Nineveh": "أبراج في عموم الموصل ونينوى",
  "Our own towers and sector antennas cover neighborhoods across the city and the plains — and we light up new areas as we grow. A few of the areas we serve:":
    "أبراجنا وهوائيات القطاعات الخاصة بنا تغطّي أحياء المدينة والسهل — ونضيء مناطق جديدة مع توسّعنا. بعض المناطق التي نخدمها:",
  "Call us — we're local": "اتصل بنا — نحن محليون",
  "Give us a call or a WhatsApp and we'll check coverage at your address, then mount and aim your antenna — usually within a day or two.":
    "اتصل بنا أو راسلنا على واتساب وسنتحقق من التغطية في عنوانك، ثم نركّب هوائيك ونوجّهه — عادةً خلال يوم أو يومين.",
  "From the antenna on your roof to our backbone towers — SPEEDNeT runs a wireless network built for speed, and a support team that actually picks up.":
    "من الهوائي على سطح منزلك إلى أبراجنا الأساسية — تدير سبيدنت شبكة لاسلكية مبنية للسرعة، وفريق دعم يردّ فعلاً.",

  "Point-to-point": "نقطة لنقطة",
  "Long-range speed, locked on": "سرعة بعيدة المدى، مثبّتة بدقة",
  "High-gain dish links carry fiber-grade throughput across kilometers — clear line-of-sight, low latency, rock-steady.":
    "وصلات الهوائيات الطبقية عالية الكسب تنقل سرعات بمستوى الألياف عبر الكيلومترات — برؤية مباشرة وزمن استجابة منخفض وثبات تام.",
  "Backbone": "الشبكة الأساسية",
  "Tower to tower, always on": "من برج إلى برج، متصل دائمًا",
  "A meshed backbone of towers and sector antennas reroutes around trouble, so your connection stays up day and night.":
    "شبكة أساسية متشابكة من الأبراج وهوائيات القطاعات تعيد التوجيه حول الأعطال، ليبقى اتصالك قائمًا ليل نهار.",
  "Your rooftop link": "وصلة سطحك",
  "The unit on your roof, dialed in": "الوحدة على سطح منزلك، مضبوطة بعناية",
  "We mount, aim and tune your outdoor receiver for the strongest signal, and we're one call away if it ever blinks.":
    "نقوم بتركيب وتوجيه وضبط جهاز الاستقبال الخارجي لديك للحصول على أقوى إشارة، ونحن على بعد مكالمة إن حدث أي خلل.",
  "Sectors that blanket your area": "قطاعات تغطّي منطقتك بالكامل",
  "Sector antennas on our towers beam wide across the region — and we add more every month.":
    "هوائيات القطاعات على أبراجنا تبثّ على نطاق واسع عبر المنطقة — ونضيف المزيد كل شهر.",
  "Reach out and we'll get the gear on your roof and you online — fast.":
    "تواصل معنا وسنركّب الأجهزة على سطحك ونوصلك بالإنترنت — بسرعة.",

  "Why SPEEDNeT": "لماذا سبيدنت",
  "Built for people who can't afford to be offline": "مصمّمة لمن لا يحتمل انقطاع الاتصال",
  "Every part of our network is designed around one goal: keeping you connected, fast.":
    "كل جزء من شبكتنا مصمّم لهدف واحد: إبقاؤك متصلًا وبسرعة.",
  "Blazing Speed": "سرعة فائقة",
  "Fiber-grade throughput with low latency — built for streaming, gaming and work.":
    "سرعات بمستوى الألياف وزمن استجابة منخفض — مهيّأة للبث والألعاب والعمل.",
  "Rock-Solid Reliability": "موثوقية راسخة",
  "Redundant backbone links and 24/7 monitoring keep you online around the clock.":
    "وصلات أساسية احتياطية ومراقبة على مدار الساعة تبقيك متصلًا طوال الوقت.",
  "Local Support": "دعم محلي",
  "A real team that knows your area, reachable by phone and WhatsApp when you need it.":
    "فريق حقيقي يعرف منطقتك، يمكن الوصول إليه عبر الهاتف وواتساب عند الحاجة.",
  "Wide Coverage": "تغطية واسعة",
  "Hundreds of towers across the region — and the network keeps growing.":
    "مئات الأبراج عبر المنطقة — والشبكة في توسّع مستمر.",

  "Plans": "الباقات",
  "Simple plans, no surprises": "باقات بسيطة بلا مفاجآت",
  "Pick a speed that fits. Prices shown are placeholders — contact us for current offers.":
    "اختر السرعة المناسبة. الأسعار المعروضة مؤقتة — تواصل معنا لمعرفة العروض الحالية.",
  "Home Basic": "منزلي أساسي",
  "Home Plus": "منزلي بلس",
  "Business": "أعمال",
  "Unlimited data": "بيانات غير محدودة",
  "Free installation": "تركيب مجاني",
  "Standard support": "دعم قياسي",
  "Priority support": "دعم ذو أولوية",
  "Wi-Fi router included": "يشمل راوتر واي فاي",
  "Static IP option": "خيار عنوان IP ثابت",
  "Dedicated support": "دعم مخصص",
  "SLA uptime": "ضمان نسبة تشغيل",
  "Most popular": "الأكثر طلبًا",
  "Mbps": "ميغابت/ث",
  "Get started": "ابدأ الآن",

  "Already in your neighborhood": "موجودون في حيّك بالفعل",
  "Our towers reach across the region — and we're expanding every month.":
    "تصل أبراجنا إلى عموم المنطقة — ونتوسّع كل شهر.",
  "Tel Kaif": "تلكيف",
  "Al-Jazair": "الجزائر",
  "Al-Qusayat": "القوسيات",
  "Al-Hawi": "الحاوي",
  "Don't see your area? Ask us — coverage is growing fast.":
    "لا ترى منطقتك؟ اسألنا — التغطية تتوسّع بسرعة.",

  "Ready to get connected?": "جاهز للاتصال؟",
  "Reach out and we'll find the right plan for your home or business.":
    "تواصل معنا وسنجد الباقة المناسبة لمنزلك أو عملك.",

  "We're here to help": "نحن هنا لمساعدتك",
  "Call, message, or visit us. Details below are placeholders — update them with your real info.":
    "اتصل أو راسلنا أو زرنا. التفاصيل أدناه مؤقتة — حدّثها ببياناتك الحقيقية.",
  "WhatsApp": "واتساب",
  "Telegram": "تيليغرام",
  "Office": "المكتب",
  "Main Street, City Center": "الشارع الرئيسي، مركز المدينة",
  "Support hours: every day, 9:00 — 21:00": "ساعات الدعم: يوميًا، 9:00 — 21:00",
  "All rights reserved.": "جميع الحقوق محفوظة.",
  "Developed by": "تطوير",
};
