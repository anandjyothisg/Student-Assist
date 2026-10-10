import axios from 'axios';

// Load base URL from environment config.
// In development: set VITE_API_URL=http://localhost:8000 in client/.env
// In production (Cloudflare Pages): set VITE_API_URL in the dashboard env vars.
// Falls back to localhost:8000 ONLY in dev mode so production builds never
// silently target the visitor's own machine.
const API_BASE = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:8000' : '');

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 120000, // 120s — LLM inference can take 30-60+ seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT Access Token into request headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-refresh on 401. Every client (this one, rootApi and streamChat) shares
// one in-flight refresh: refresh tokens rotate and the old one is blacklisted,
// so two parallel refreshes would sign a valid session out.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes('/auth/token/refresh/');
    if (error.response?.status === 401 && original && !original._retry && !isRefreshCall) {
      if (!localStorage.getItem('refreshToken')) {
        if (localStorage.getItem('accessToken')) {
          localStorage.removeItem('accessToken');
          window.dispatchEvent(new Event('auth-expired'));
        }
        return Promise.reject(error);
      }
      original._retry = true;
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
    return Promise.reject(error);
  }
);

// Turn any API failure into one plain sentence a student can act on.
// Field errors use readable labels ("Email: …") instead of raw field names,
// and server-side crashes never show internal text.
const FIELD_LABELS = {
  email: 'Email',
  password: 'Password',
  confirm_password: 'Confirm password',
  new_password: 'New password',
  old_password: 'Current password',
  current_password: 'Current password',
  first_name: 'First name',
  last_name: 'Last name',
  full_name: 'Name',
  otp: 'Code',
  code: 'Code',
  student_number: 'Student number',
  year_of_study: 'Year',
  file: 'File',
  title: 'Title',
  name: 'Name',
  role: 'Role',
};
const fieldLabel = (f) => FIELD_LABELS[f] || f.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const firstMsg = (v) => (Array.isArray(v) ? v.map(String).join(' ') : typeof v === 'object' && v ? Object.values(v).map(firstMsg).join(' ') : String(v));
const TECHNICAL = /token|traceback|exception|errno|stack|sql|null value|integrity|<html/i;

export const NETWORK_ERROR = 'Can’t reach the server. Check your connection and try again.';
export const SERVER_ERROR = 'Something went wrong on our side. Try again in a moment.';
export const RATE_LIMIT_ERROR = 'Too many requests. Wait a moment and try again.';

export const extractErrorMessage = (err) => {
  if (!err?.response) {
    if (err?.message && !/network|failed to fetch|timeout/i.test(err.message)) return err.message;
    return NETWORK_ERROR;
  }
  const { status, data } = err.response;
  if (status === 429) return RATE_LIMIT_ERROR;
  if (status === 500 || status === 502 || status === 504) return SERVER_ERROR;

  let message = '';
  if (data && typeof data === 'object') {
    // Our API: { success: false, error: { message, details } }; plain DRF otherwise.
    const details = data.error?.details ?? (data.error ? null : data);
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      message = Object.entries(details)
        .filter(([k]) => k !== 'success' && k !== 'code')
        .map(([k, v]) => (k === 'detail' || k === 'non_field_errors' ? firstMsg(v) : `${fieldLabel(k)}: ${firstMsg(v)}`))
        .join(' ');
    }
    if (!message) message = data.error?.message || data.detail || '';
  } else if (typeof data === 'string' && data.length < 200 && !/<html/i.test(data)) {
    message = data;
  }

  if (!message || TECHNICAL.test(message)) {
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return 'You don’t have access to that.';
    if (status === 404) return 'We couldn’t find that. It may have been moved or deleted.';
    if (status >= 500) return SERVER_ERROR;
    return 'That didn’t work. Check the details and try again.';
  }
  if (status === 403 && /permission to perform this action/i.test(message)) return 'You don’t have access to that.';
  return message;
};

// Auth API — all methods call the real backend
export const mockAuthApi = {
  login: async (email, password) => {
    try {
      const res = await api.post('/auth/login/', { email: email.trim(), password });
      const { access, refresh, user } = res.data;
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      return {
        accessToken: access,
        refreshToken: refresh,
        user: {
          username: user.full_name || user.username || email.split('@')[0],
          email: user.email,
          role: user.role || 'student',
        },
      };
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  register: async (username, email, password) => {
    const nameParts = username.trim().split(' ');
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || '';
    try {
      const res = await api.post('/auth/register/', {
        email: email.trim(),
        first_name: firstName,
        last_name: lastName,
        password,
        confirm_password: password,
      });
      if (res.data.access) {
        localStorage.setItem('accessToken', res.data.access);
        localStorage.setItem('refreshToken', res.data.refresh);
      }
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  requestPasswordReset: async (email) => {
    try {
      const res = await api.post('/auth/password/forgot/', { email: email.trim() });
      return res.data; // Always a generic message — never reveals whether the email exists.
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  verifyResetOtp: async (email, otp) => {
    try {
      const res = await api.post('/auth/password/verify-otp/', { email: email.trim(), otp });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  confirmPasswordReset: async (email, otp, newPassword) => {
    try {
      const res = await api.post('/auth/password/reset-confirm/', {
        email: email.trim(),
        otp,
        new_password: newPassword,
        confirm_password: newPassword,
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  updateProfile: async (firstName, lastName) => {
    try {
      const res = await api.patch('/auth/me/', { first_name: firstName, last_name: lastName });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  changePassword: async (oldPassword, newPassword, confirmPassword) => {
    try {
      const res = await api.post('/auth/password/change/', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword || newPassword,
      });
      return res.data;
    } catch (err) {
      throw new Error(extractErrorMessage(err));
    }
  },

  logout: async () => {
    const refresh = localStorage.getItem('refreshToken');
    try {
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch {
      // Best-effort server-side logout — always clear local state
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  },
};

/* ─── Shared helpers for non-/api/v1 endpoints and streaming ─────────────── */

export const API_ROOT = API_BASE;

/** Refresh the access token once; concurrent callers share the same request. */
let refreshPromise = null;
export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) return Promise.reject(new Error('Not signed in.'));
  refreshPromise = axios
    .post(`${API_BASE}/api/v1/auth/token/refresh/`, { refresh })
    .then((res) => {
      localStorage.setItem('accessToken', res.data.access);
      if (res.data.refresh) localStorage.setItem('refreshToken', res.data.refresh);
      return res.data.access;
    })
    .catch((err) => {
      // Only a rejected refresh token ends the session; a network blip must not.
      if (err.response && [400, 401, 403].includes(err.response.status)) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth-expired'));
        err.sessionExpired = true;
      }
      throw err;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

/** Axios instance for the /api/chat and /api/assistant routes (same auth + refresh). */
export const rootApi = axios.create({ baseURL: API_BASE, timeout: 200000, headers: { 'Content-Type': 'application/json' } });
rootApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
rootApi.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && localStorage.getItem('refreshToken')) {
      original._retry = true;
      const token = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${token}`;
      return rootApi(original);
    }
    return Promise.reject(error);
  },
);

/**
 * Stream an answer from POST /api/chat/ask/stream/ (server-sent events).
 * Handlers: onMeta({session_id, session_title, citations}), onToken(text), onDone(answer).
 * Resolves with the final answer; rejects with an Error whose message is user-presentable.
 */
export async function streamChat({ question, courseId, sessionId, signal }, { onMeta, onToken, onDone } = {}) {
  const send = (token) =>
    fetch(`${API_BASE}/api/chat/ask/stream/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ question, course_id: courseId || null, session_id: sessionId || null }),
      signal,
    });

  let res;
  try {
    res = await send(localStorage.getItem('accessToken'));
    if (res.status === 401 && localStorage.getItem('refreshToken')) {
      res = await send(await refreshAccessToken());
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.sessionExpired) throw new Error('Your session expired. Please sign in again.');
    throw new Error(NETWORK_ERROR);
  }

  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    const detail = res.status === 429
      ? 'You’re asking very quickly. Wait a few seconds and try again.'
      : extractErrorMessage({ response: { status: res.status, data } });
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final = null;
  // If the server goes silent mid-answer (no bytes for 90 s), stop waiting.
  const IDLE_MS = 90000;
  for (;;) {
    let idle;
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise((_, reject) => { idle = setTimeout(() => reject(new Error('The assistant stopped responding. Please try again.')), IDLE_MS); }),
    ]).finally(() => clearTimeout(idle)).catch((err) => { reader.cancel().catch(() => {}); throw err; });
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const dataLine = /^data: (.*)$/m.exec(raw)?.[1];
      if (!event || dataLine == null) continue;
      const data = JSON.parse(dataLine);
      if (event === 'meta') onMeta?.(data);
      else if (event === 'token') onToken?.(data.text);
      else if (event === 'done') { final = data; onDone?.(data); }
      else if (event === 'error') throw new Error(data.detail || 'The AI couldn’t finish this answer. Try again.');
    }
  }
  if (!final) throw new Error('The answer was interrupted. Please try again.');
  return final;
}

export const chatApi = {
  sessions: (params) => rootApi.get('/api/chat/', { params }).then((r) => r.data),
  session: (id) => rootApi.get(`/api/chat/${id}/`).then((r) => r.data),
  rename: (id, title) => rootApi.patch(`/api/chat/${id}/`, { title }).then((r) => r.data),
  remove: (id) => rootApi.delete(`/api/chat/${id}/`),
  saved: () => rootApi.get('/api/chat/saved/').then((r) => r.data),
  save: (messageId) => rootApi.post('/api/chat/saved/', { message: messageId }).then((r) => r.data),
  unsave: (id) => rootApi.delete(`/api/chat/saved/${id}/`),
};

export default api;
