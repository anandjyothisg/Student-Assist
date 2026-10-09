import axios from 'axios';

// Load base URL from environment config (defaults to django port 8000)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle auto token refresh on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        if (localStorage.getItem('accessToken')) {
          localStorage.removeItem('accessToken');
          window.dispatchEvent(new Event('auth-expired'));
        }
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_BASE}/api/v1/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccess = res.data.access;
        localStorage.setItem('accessToken', newAccess);

        if (res.data.refresh) {
          localStorage.setItem('refreshToken', res.data.refresh);
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;

        processQueue(null, newAccess);
        isRefreshing = false;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');

        // Fire custom event to notify App layout to redirect to auth
        window.dispatchEvent(new Event('auth-expired'));

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper to format backend REST validation errors into user-friendly strings
export const extractErrorMessage = (err) => {
  if (err.response?.data) {
    const data = err.response.data;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.error?.message) return data.error.message;
    if (data.non_field_errors) {
      return Array.isArray(data.non_field_errors)
        ? data.non_field_errors.join(' ')
        : String(data.non_field_errors);
    }
    const fieldMsgs = Object.entries(data)
      .filter(([k]) => k !== 'success')
      .map(([field, msgs]) => {
        const fieldName = field.replace(/_/g, ' ');
        const messageStr = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
        return `${fieldName}: ${messageStr}`;
      })
      .join(' | ');
    if (fieldMsgs) return fieldMsgs;
  }
  return err.message || 'An error occurred.';
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.dispatchEvent(new Event('auth-expired'));
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
    throw new Error('Can’t reach the server. Check that the backend is running and try again.');
  }

  if (!res.ok) {
    let detail = `The assistant returned an error (${res.status}).`;
    try {
      const data = await res.json();
      detail = extractErrorMessage({ response: { data } }) || detail;
    } catch { /* not JSON */ }
    if (res.status === 429) detail = 'You’re asking very quickly — wait a few seconds and try again.';
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final = null;
  for (;;) {
    const { value, done } = await reader.read();
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
      else if (event === 'error') throw new Error(data.detail || 'The assistant failed to answer.');
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
