export const STORAGE_KEY = 'eco.sessions.v1';
export function loadSessions(storage) {
  try {
    storage ??= globalThis.localStorage;
    const data = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(s => s && typeof s.id === 'string' && typeof s.serviceId === 'string' &&
      typeof s.title === 'string' && typeof s.updatedAt === 'string' && Array.isArray(s.messages))
      .map(s => ({ ...s, messages: s.messages.filter(m => m &&
        ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string') }));
  } catch { return []; }
}
export function saveSessions(sessions, storage) {
  try { (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(sessions)); return true; }
  catch { return false; }
}
export function createSession(serviceId) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), serviceId, title: 'محادثة جديدة', createdAt: now, updatedAt: now, messages: [] };
}
