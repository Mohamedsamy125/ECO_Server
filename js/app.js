import { config, services } from './config.js';
import { icon } from './icons.js';
import { createSession, loadSessions, saveSessions } from './storage.js';
import { sendToWorkflow } from './workflow.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main = $('#main');
const dialog = $('#dialog');
let sessions = loadSessions();
let currentSession = null;
let selectedFiles = [];
let busy = false;
let toastTimer;
let user = null;
const drafts = new Map();
const dateFormat = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
const byId = id => services.find(service => service.id === id);
const ordered = () => [...sessions].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
const safeDate = value => { try { return dateFormat.format(new Date(value)); } catch { return ''; } };

$('#local-icon').innerHTML = icon('shield');
$('#profile-icon').innerHTML = icon('user');
$('#menu-button').innerHTML = icon('menu');
$('#help-button').innerHTML = icon('info') + 'عن مساحة العمل';
$('#navigation').innerHTML = `<a class="nav-item" data-nav="home" href="#home">${icon('home')}الرئيسية</a><a class="nav-item" data-nav="history" href="#history">${icon('history')}المحادثات السابقة</a>`;
$('#service-navigation').innerHTML = services.map(service => `<a class="nav-item" data-nav="${escape(service.id)}" href="#service/${encodeURIComponent(service.id)}">${icon(service.icon)}<span>${escape(service.short)}</span></a>`).join('');

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6000);
}
function persist() {
  const saved = saveSessions(sessions);
  if (!saved) toast('تعذر الحفظ في المتصفح. صدّر المحادثة للاحتفاظ بنسخة منها.');
  return saved;
}
function setMenu(open) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar').inert = window.matchMedia('(max-width:900px)').matches && !open;
  $('#sidebar-overlay').hidden = !open;
  $('#menu-button').setAttribute('aria-expanded', String(open));
}
window.matchMedia('(max-width:900px)').addEventListener('change', () => setMenu(false));
$('#menu-button').addEventListener('click', () => setMenu(!$('#sidebar').classList.contains('open')));
$('#sidebar-overlay').addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });

function serviceCard(service) {
  return `<a class="service-card" href="#service/${encodeURIComponent(service.id)}"><span class="service-icon">${icon(service.icon)}</span><h3>${escape(service.title)}</h3><p>${escape(service.description)}</p><span class="service-card-bottom"><span>فتح</span>${icon('plus')}</span></a>`;
}
function sessionRows(list) {
  return `<div class="session-list">${list.map(session => {
    const service = byId(session.serviceId);
    return `<div class="session-row"><a class="session-open" href="#chat/${encodeURIComponent(session.id)}">${icon(service?.icon || 'file')}<span class="session-info"><strong>${escape(session.title)}</strong><small>${escape(service?.short || 'خدمة سابقة')} · ${safeDate(session.updatedAt)}</small></span></a><button class="icon-button" data-export="${escape(session.id)}" aria-label="تصدير المحادثة">${icon('download')}</button><button class="icon-button" data-delete="${escape(session.id)}" aria-label="حذف المحادثة">${icon('trash')}</button></div>`;
  }).join('')}</div>`;
}
function home() {
  $('#page-label').textContent = 'الرئيسية';
  const recent = ordered().filter(s => s.messages.length).slice(0, 3);
  main.innerHTML = `<div class="page-intro"><h1 id="services-title">الخدمات الهندسية</h1><span class="date-label">${dateFormat.format(new Date())}</span></div>
    <section aria-labelledby="services-title"><div class="services-grid compact-services">${services.map(serviceCard).join('')}</div></section>
    <section class="recent-section" aria-labelledby="recent-title"><div class="section-heading"><h2 id="recent-title">آخر المحادثات</h2><a class="text-button" href="#history">كل المحادثات</a></div>${recent.length ? sessionRows(recent) : `<div class="empty-recent">${icon('folder')}<p>لا توجد محادثات محفوظة.</p></div>`}</section>`;
}
function history() {
  $('#page-label').textContent = 'المحادثات السابقة';
  const list = ordered().filter(session => session.messages.length);
  main.innerHTML = `<div class="page-intro list-heading"><h1>المحادثات السابقة</h1><a class="primary-button" href="#home">${icon('plus')}محادثة جديدة</a></div>${list.length ? sessionRows(list) : `<div class="empty-history">${icon('history')}<h2>لا توجد محادثات محفوظة.</h2><a href="#home" class="primary-button">الخدمات</a></div>`}<p class="privacy-caption">${icon('shield')}المحادثات محفوظة في هذا المتصفح. مسح بياناته يحذف السجل.</p>`;
}
function newSession(service) {
  const session = createSession(service.id);
  sessions.push(session);
  return session;
}
function workspace(session) {
  const service = byId(session.serviceId);
  if (!service) { home(); toast('الخدمة غير متاحة حاليًا.'); return; }
  currentSession = session;
  $('#page-label').textContent = service.short;
  const connected = Boolean(config.workflows[service.id]?.url);
  main.innerHTML = `<div class="workspace-heading"><h1>${escape(service.title)}</h1><div class="workspace-actions"><button class="icon-button" data-export="${escape(session.id)}" aria-label="تصدير المحادثة">${icon('download')}</button><button class="secondary-button" id="new-chat">محادثة جديدة</button></div></div>
    <section class="workspace-panel" aria-label="مساحة المحادثة"><div class="workspace-status"><span>${icon(connected ? 'check' : 'info')}${connected ? 'الخدمة مُهيّأة للاتصال' : 'وضع التجهيز · المعالجة غير متصلة بعد'}</span><span id="save-status">${icon('lock')}حفظ محلي على المتصفح</span></div>
    <div class="chat-scroll" id="chat-scroll" role="log" aria-label="رسائل المحادثة" aria-live="polite"></div>
    <form class="composer" id="composer"><div class="composer-box"><div class="selected-files" id="selected-files"></div><textarea id="message-input" aria-label="رسالتك" placeholder="${escape(service.placeholder)}" rows="2" maxlength="20000" required></textarea><div class="composer-toolbar"><div class="attachment-control"><button class="icon-button" type="button" id="attach-button" aria-label="إرفاق ملفات">${icon('attach')}</button><small>${escape(service.formats)}</small><input type="file" id="file-input" accept="${escape(service.accept)}" multiple hidden></div><button type="submit" class="primary-button send-button" id="send-button"><span>إرسال</span>${icon('send')}</button></div></div><p class="composer-note">${connected ? 'عند الإرسال، تُرسل رسالتك والملفات المرفقة إلى خدمة المعالجة.' : 'يمكنك تجهيز طلبك الآن؛ التنفيذ متاح بعد توصيل خدمة المعالجة.'} خاصية Listen تُضاف لاحقًا.</p></form></section>`;
  $('#message-input').value = drafts.get(session.id) || '';
  renderMessages(service, session);
  $('#new-chat').addEventListener('click', () => {
    if (busy) { toast('انتظر انتهاء الطلب الحالي أولًا.'); return; }
    location.hash = `chat/${newSession(service).id}`;
  });
  $('#message-input').addEventListener('input', event => drafts.set(session.id, event.target.value));
  $('#message-input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#attach-button').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', event => {
    const extensions = service.accept.split(',');
    for (const file of event.target.files) {
      if (!extensions.some(extension => file.name.toLowerCase().endsWith(extension))) { toast(`نوع الملف غير مدعوم: ${file.name}`); continue; }
      if (file.size + selectedFiles.reduce((total, item) => total + item.size, 0) > 12 * 1024 * 1024) { toast('الحد الأقصى لإجمالي المرفقات 12 ميجابايت في الطلب.'); continue; }
      if (selectedFiles.length >= 5) { toast('يمكنك إرفاق 5 ملفات في الطلب الواحد.'); break; }
      if (!selectedFiles.some(existing => existing.name === file.name && existing.size === file.size)) selectedFiles.push(file);
    }
    event.target.value = '';
    renderFiles();
  });
  $('#composer').addEventListener('submit', sendMessage);
}
function renderMessages(service, session) {
  const scroll = $('#chat-scroll');
  if (!scroll || currentSession?.id !== session.id) return;
  if (!session.messages.length) {
    scroll.innerHTML = `<div class="chat-welcome"><span class="service-icon">${icon(service.icon)}</span><h2>تفاصيل الطلب</h2><p>${escape(service.prompt)}</p><div class="suggestions">${service.suggestions.map(text => `<button type="button" data-suggestion="${escape(text)}">${escape(text)}</button>`).join('')}</div></div>`;
  } else {
    scroll.innerHTML = session.messages.map(message => message.role === 'system'
      ? `<div class="message system ${message.error ? 'error' : ''}">${escape(message.content)}</div>`
      : `<article class="message ${escape(message.role)}"><span class="message-avatar">${icon(message.role === 'user' ? 'user' : service.icon)}</span><div class="message-body"><div class="message-label">${message.role === 'user' ? 'أنت' : 'ECO · ' + escape(service.short)}</div><div class="message-content">${escape(message.content)}</div>${message.files?.length ? `<div class="message-files">${message.files.map(file => `<span class="file-tag">${icon('file')}${escape(file.name)}</span>`).join('')}</div>` : ''}</div></article>`).join('');
  }
  if (busy) scroll.insertAdjacentHTML('beforeend', '<div class="busy-note">جارٍ انتظار رد الخدمة…</div>');
  scroll.scrollTop = scroll.scrollHeight;
}
function renderFiles() {
  $('#selected-files').innerHTML = selectedFiles.map((file,index) => `<span class="file-tag">${icon('file')}${escape(file.name)}<button type="button" data-remove-file="${index}" aria-label="إزالة ${escape(file.name)}">${icon('close')}</button></span>`).join('');
}
async function sendMessage(event) {
  event.preventDefault();
  if (busy) return;
  const input = $('#message-input');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const session = currentSession;
  const service = byId(session.serviceId);
  const files = [...selectedFiles];
  const now = new Date().toISOString();
  session.messages.push({ role:'user', content:text, createdAt:now, files:files.map(({name,size,type}) => ({name,size,type})) });
  if (session.messages.filter(m => m.role === 'user').length === 1) session.title = text.slice(0, 70);
  session.updatedAt = now;
  persist();
  input.value = '';
  drafts.delete(session.id);
  selectedFiles = [];
  renderFiles();
  // A stable session URL supports reload, bookmark, and separate service histories.
  window.history.replaceState(null, '', `#chat/${encodeURIComponent(session.id)}`);
  lastHash = location.hash;
  busy = true;
  $('#send-button').disabled = true;
  $('#attach-button').disabled = true;
  renderMessages(service, session);
  try {
    const result = await sendToWorkflow({ workflow:config.workflows[service.id], session, message:text, files });
    session.messages.push({ role:result.connected ? 'assistant' : 'system', content: result.connected ? result.reply :
      'تمت إضافة طلبك إلى سجل المحادثة على هذا الجهاز. خدمة المعالجة لم تُربط بعد، لذلك لم يُرسل الطلب ولم تُحلّل الملفات. يُحفظ اسم المرفق فقط؛ أعد إرفاق الملف عند إرسال طلب جديد بعد تفعيل الخدمة.', createdAt:new Date().toISOString() });
  } catch (error) {
    session.messages.push({ role:'system', error:true, content:`${error.message} احتفظنا برسالتك في المحادثة. لم تتم إعادة الإرسال تلقائيًا.`, createdAt:new Date().toISOString() });
  } finally {
    busy = false;
    session.updatedAt = new Date().toISOString();
    const saved = persist();
    renderMessages(service, session);
    if (currentSession?.id === session.id && $('#send-button')) {
      $('#send-button').disabled = false;
      $('#attach-button').disabled = false;
      $('#save-status').innerHTML = icon(saved ? 'check' : 'info') + (saved ? 'تم الحفظ محليًا' : 'تعذر الحفظ · صدّر المحادثة');
      $('#message-input').focus();
    }
  }
}
function showDialog(content, { required = false } = {}) {
  $('#dialog-content').innerHTML = content;
  dialog.oncancel = event => { if (required) event.preventDefault(); };
  if (!dialog.open) dialog.showModal();
}
function dialogHeader(title, closeable = true) {
  return `<div class="dialog-header"><h2>${escape(title)}</h2>${closeable ? `<button class="icon-button" data-close-dialog aria-label="إغلاق">${icon('close')}</button>` : ''}</div>`;
}
function showLogin() {
  if (!config.auth.enabled) {
    showDialog(`${dialogHeader('تسجيل الدخول')}<div class="dialog-copy"><p>الدخول مفتوح حاليًا بدون اسم مستخدم أو كلمة مرور.</p></div><div class="dialog-actions"><button class="primary-button" data-close-dialog>متابعة</button></div>`);
    return;
  }
  showDialog(`${dialogHeader('تسجيل الدخول', Boolean(user))}<img class="dialog-logo" src="./assets/logo.png" alt="شعار المنصة"><form class="login-form" id="login-form"><label for="username">اسم المستخدم</label><input id="username" name="username" autocomplete="username" required><label for="password">كلمة المرور</label><input id="password" type="password" name="password" autocomplete="current-password" required><p class="form-error" id="login-error" role="alert"></p><button type="submit" class="primary-button">دخول مساحة العمل</button></form><p class="login-note">حسابات الدخول تُضبط بواسطة مسؤول المنصة.</p>`, { required: !user });
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const username = $('#username').value.trim();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode($('#password').value));
    const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    const match = config.auth.users.find(account => account.username === username && account.passwordSha256 === hash);
    if (!match) { $('#login-error').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة.'; return; }
    user = username;
    $('#profile-name').textContent = username;
    $('#access-label').textContent = 'مساحة العمل';
    dialog.close();
    route();
  });
}
$('#profile-button').addEventListener('click', showLogin);
$('#help-button').addEventListener('click', () => showDialog(`${dialogHeader('عن مساحة العمل')}<div class="dialog-copy"><p>ECO يجمع المراجعات الهندسية والمالية، وحصر أعمال الأوتوكاد، وإعداد الرسومات في مساحة قابلة للتوسع.</p><p>كل خدمة لها محادثاتها المستقلة. في وضع التجهيز يمكنك كتابة طلبك وحفظه؛ تظهر حالة اتصال المعالجة داخل الخدمة.</p><p>يُحفظ نص المحادثات وأسماء المرفقات في المتصفح، دون محتوى الملفات. يمكنك تصدير سجل المحادثة بصيغة JSON. احتفظ بنسخة قبل مسح بيانات المتصفح.</p><p>خاصية Listen وإدارة الملفات الكاملة تأتيان في مرحلة لاحقة.</p></div><div class="dialog-actions"><button class="primary-button" data-close-dialog>حسنًا</button></div>`));

function exportSession(id) {
  const session = sessions.find(item => item.id === id);
  if (!session) return;
  const blob = new Blob([JSON.stringify({ app:'ECO', version:1, exportedAt:new Date().toISOString(), session }, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eco-${session.serviceId}-${session.id.slice(0,8)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('تم تجهيز نسخة المحادثة للتنزيل.');
}
document.addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.hasAttribute('data-close-dialog')) dialog.close();
  if (target.dataset.export) exportSession(target.dataset.export);
  if (target.dataset.delete) {
    const id = target.dataset.delete;
    if (busy) { toast('انتظر انتهاء الطلب الحالي قبل الحذف.'); return; }
    showDialog(`${dialogHeader('حذف المحادثة؟')}<p class="dialog-copy">ستُحذف هذه المحادثة من المتصفح. يمكنك تصدير نسخة قبل الحذف.</p><div class="dialog-actions"><button class="secondary-button" data-close-dialog>إلغاء</button><button class="primary-button" id="confirm-delete">حذف المحادثة</button></div>`);
    $('#confirm-delete').onclick = () => {
      sessions = sessions.filter(session => session.id !== id);
      drafts.delete(id);
      persist();
      dialog.close();
      route();
      toast('تم حذف المحادثة.');
    };
  }
  if (target.dataset.suggestion) {
    $('#message-input').value = target.dataset.suggestion;
    drafts.set(currentSession.id, target.dataset.suggestion);
    $('#message-input').focus();
  }
  if (target.hasAttribute('data-remove-file')) { selectedFiles.splice(Number(target.dataset.removeFile),1); renderFiles(); }
});

let lastHash = location.hash || '#home';
function route() {
  if (busy) {
    window.history.replaceState(null, '', lastHash);
    toast('جارٍ تنفيذ طلبك. انتظر انتهاءه قبل تغيير مساحة العمل.');
    return;
  }
  if (config.auth.enabled && !user) { showLogin(); return; }
  if (currentSession && $('#message-input')) drafts.set(currentSession.id, $('#message-input').value);
  currentSession = null;
  selectedFiles = [];
  setMenu(false);
  const [page, encodedId] = (location.hash.slice(1) || 'home').split('/');
  let id;
  try { id = decodeURIComponent(encodedId || ''); } catch { id = ''; }
  let active = page;
  if (page === 'history') history();
  else if (page === 'service' && byId(id)) {
    const service = byId(id);
    workspace(newSession(service));
    active = id;
  } else if (page === 'chat') {
    const session = sessions.find(item => item.id === id);
    if (session) { workspace(session); active = session.serviceId; }
    else { home(); active = 'home'; toast('المحادثة غير موجودة على هذا المتصفح.'); }
  } else { home(); active = 'home'; }
  main.classList.toggle('workspace-main', Boolean(currentSession));
  document.querySelectorAll('[data-nav]').forEach(link => {
    const selected = link.dataset.nav === active;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  lastHash = location.hash || '#home';
  document.title = `${$('#page-label').textContent} | ECO`;
  main.focus({ preventScroll:true });
}
window.addEventListener('hashchange', route);
route();
