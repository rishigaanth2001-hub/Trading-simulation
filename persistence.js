const SESSION_KEY = 'niftysim_session';
const HISTORY_KEY = 'niftysim_history';

export function saveSession(state) {
  try {
    const payload = JSON.stringify(state);
    localStorage.setItem(SESSION_KEY, payload);
  } catch (error) {
    console.warn('Failed to save session:', error);
  }
}

export function loadSession() {
  try {
    const payload = localStorage.getItem(SESSION_KEY);
    if (!payload) return null;
    return JSON.parse(payload);
  } catch (error) {
    console.warn('Failed to load session:', error);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('Failed to clear session:', error);
  }
}

export function saveDayHistory(dayResult) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    const cleaned = Array.isArray(history) ? history : [];
    const next = [dayResult, ...cleaned].slice(0, 30);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save day history:', error);
  }
}

export function loadDayHistory() {
  try {
    const payload = localStorage.getItem(HISTORY_KEY);
    if (!payload) return [];
    const history = JSON.parse(payload);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.warn('Failed to load day history:', error);
    return [];
  }
}
