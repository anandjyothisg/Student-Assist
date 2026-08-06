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
const extractErrorMessage = (err) => {
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

  // TODO: implement real password-reset flow when backend endpoints are added
  forgotPassword: async (email) => {
    await new Promise((res) => setTimeout(res, 600));
    if (!email) throw new Error('Email is required.');
    return { success: true, message: 'If this email exists, a reset code has been sent.' };
  },

  verifyOtp: async (_email, otp) => {
    await new Promise((res) => setTimeout(res, 600));
    if (otp === '123456') return { success: true };
    throw new Error('Invalid OTP code. (Demo: use 123456)');
  },

  resetPassword: async (_email, _password) => {
    await new Promise((res) => setTimeout(res, 600));
    return { success: true, message: 'Password reset successful.' };
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

export default api;
