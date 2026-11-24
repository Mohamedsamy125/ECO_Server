export class WorkflowError extends Error {}
export async function sendToWorkflow({ workflow, session, message, files = [], fetcher = fetch }) {
  if (!workflow?.url) return { connected: false };
  let url;
  try { url = new URL(workflow.url); }
  catch { throw new WorkflowError('رابط خدمة المعالجة غير صحيح.'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new WorkflowError('رابط الخدمة يجب أن يستخدم HTTPS.');
  }
  const body = new FormData();
  body.append('sessionId', session.id);
  body.append('serviceId', session.serviceId);
  body.append('message', message);
  body.append('history', JSON.stringify(session.messages.filter(m => m.role !== 'system').map(({role, content}) => ({role, content}))));
  files.forEach(file => body.append('files', file, file.name));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), workflow.timeoutMs || 120000);
  try {
    const response = await fetcher(url.href, { method: 'POST', body, signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new WorkflowError(`تعذر تنفيذ الطلب (HTTP ${response.status}).`);
    const contentType = response.headers.get('content-type') || '';
    let reply;
    if (contentType.includes('application/json')) {
      let data = await response.json();
      if (Array.isArray(data)) data = data[0];
      reply = data?.reply ?? data?.output ?? data?.text;
    } else reply = await response.text();
    if (typeof reply !== 'string' || !reply.trim()) throw new WorkflowError('الخدمة لم تُرجع ردًا نصيًا. راجع إعداد الاستجابة.');
    return { connected: true, reply };
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    if (controller.signal.aborted) throw new WorkflowError('انتهت مهلة الانتظار. راجع حالة الطلب قبل إعادة إرساله.');
    throw new WorkflowError('تعذر الاتصال بالخدمة. تحقق من الإنترنت وإعدادات الاتصال.');
  } finally { clearTimeout(timeout); }
}
