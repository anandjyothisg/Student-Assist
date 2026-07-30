import axios from 'axios';

// Load base URL from environment config (defaults to django port 8000)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 6000,
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

    // Check if error is 401 and request has not been retried yet
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
        // Request a new access token using simplejwt token-refresh
        const res = await axios.post(`${API_BASE}/api/v1/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const newAccess = res.data.access;
        localStorage.setItem('accessToken', newAccess);
        
        // If rotation is active, server might return a new refresh token
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
        
        // Refresh token is invalid/expired - force logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        // Fire custom window event to notify App layout to redirect to auth
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
    if (data.non_field_errors) return Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : data.non_field_errors;
    const fieldMsgs = Object.entries(data)
      .map(([field, msgs]) => {
        const fieldName = field.replace('_', ' ');
        const messageStr = Array.isArray(msgs) ? msgs.join(', ') : msgs;
        return `${fieldName}: ${messageStr}`;
      })
      .join(' | ');
    if (fieldMsgs) return fieldMsgs;
  }
  return err.message || 'Authentication error occurred.';
};

// Offline fallback checker helper
const handleApiError = (err, fallbackAction) => {
  const isNetworkError = err.message === 'Network Error' || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
  if (isNetworkError) {
    console.warn('[api.js] Backend server offline. Running local user authentication session.');
    return fallbackAction();
  }
  // Standard API error handling with formatted detail messages
  const friendlyError = new Error(extractErrorMessage(err));
  friendlyError.response = err.response;
  throw friendlyError;
};

// LIVE CONNECTED CONTROLLERS (WITH OFFLINE MOCK SIMULATIONS)
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
          role: user.role || 'student'
        }
      };
    } catch (err) {
      return handleApiError(err, async () => {
        await new Promise((res) => setTimeout(res, 400));
        const trimmedEmail = email.trim().toLowerCase();

        // Check dynamically registered local users first
        const localUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
        const found = localUsers.find(u => u.email.toLowerCase() === trimmedEmail && u.password === password);
        if (found) {
          const mockTokens = {
            accessToken: 'mock_jwt_access_' + Date.now(),
            refreshToken: 'mock_jwt_refresh_' + Date.now(),
            user: { username: found.username, email: found.email, role: found.role || 'student' }
          };
          localStorage.setItem('accessToken', mockTokens.accessToken);
          localStorage.setItem('refreshToken', mockTokens.refreshToken);
          return mockTokens;
        }

        // Demo accounts fallback
        if (trimmedEmail === 'admin@demo.com' && password === 'Password123') {
          const mockTokens = {
            accessToken: 'mock_jwt_access_token',
            refreshToken: 'mock_jwt_refresh_token',
            user: { username: 'DemoAdmin', email: 'admin@demo.com', role: 'admin' }
          };
          localStorage.setItem('accessToken', mockTokens.accessToken);
          localStorage.setItem('refreshToken', mockTokens.refreshToken);
          return mockTokens;
        }
        if (trimmedEmail === 'student@demo.com' && password === 'Password123') {
          const mockTokens = {
            accessToken: 'mock_jwt_access_token',
            refreshToken: 'mock_jwt_refresh_token',
            user: { username: 'DemoStudent', email: 'student@demo.com', role: 'student' }
          };
          localStorage.setItem('accessToken', mockTokens.accessToken);
          localStorage.setItem('refreshToken', mockTokens.refreshToken);
          return mockTokens;
        }
        if ((trimmedEmail === 'teacher@demo.com' && password === 'Password123') || (trimmedEmail === 'teacher_rag_test@test.com' && password === 'password123') || (trimmedEmail === 'analytics_teacher@test.com' && password === 'password123')) {
          const mockTokens = {
            accessToken: 'mock_jwt_access_token',
            refreshToken: 'mock_jwt_refresh_token',
            user: { username: 'DemoTeacher', email: email, role: 'teacher' }
          };
          localStorage.setItem('accessToken', mockTokens.accessToken);
          localStorage.setItem('refreshToken', mockTokens.refreshToken);
          return mockTokens;
        }
        throw new Error('Invalid email or password. You can register a new account or use student@demo.com / Password123');
      });
    }
  },

  register: async (username, email, password) => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const nameParts = trimmedUsername.split(' ');
    const firstName = nameParts[0] || 'Student';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    try {
      const res = await api.post('/auth/register/', {
        email: trimmedEmail,
        first_name: firstName,
        last_name: lastName,
        password,
        confirm_password: password
      });
      // Store tokens if backend returned them directly
      if (res.data.access) {
        localStorage.setItem('accessToken', res.data.access);
        localStorage.setItem('refreshToken', res.data.refresh);
      }
      return res.data;
    } catch (err) {
      return handleApiError(err, async () => {
        await new Promise((res) => setTimeout(res, 400));
        const localUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
        if (localUsers.some(u => u.email.toLowerCase() === trimmedEmail.toLowerCase())) {
          throw new Error('An account with this email address already exists.');
        }
        const newUser = { username: trimmedUsername, email: trimmedEmail, password, role: 'student' };
        localStorage.setItem('registered_users', JSON.stringify([...localUsers, newUser]));
        return { success: true, message: 'Account registered successfully.' };
      });
    }
  },

  forgotPassword: async (email) => {
    // Mock endpoints (does not exist in backend schema yet)
    await new Promise((res) => setTimeout(res, 600));
    if (email === 'unknown@demo.com') {
      throw new Error('No user account associated with this email address.');
    }
    return { success: true, message: 'OTP Code sent successfully. Hint: Code is 123456.' };
  },

  verifyOtp: async (email, otp) => {
    await new Promise((res) => setTimeout(res, 600));
    if (otp === '123456') {
      return { success: true, message: 'OTP verified.' };
    }
    throw new Error('Invalid OTP code. Enter 123456.');
  },

  resetPassword: async (email, password) => {
    await new Promise((res) => setTimeout(res, 600));
    return { success: true, message: 'Password reset successful.' };
  },

  updateProfile: async (firstName, lastName) => {
    try {
      const res = await api.patch('/auth/me/', { first_name: firstName, last_name: lastName });
      return res.data;
    } catch (err) {
      return handleApiError(err, async () => {
        await new Promise((res) => setTimeout(res, 600));
        return { first_name: firstName, last_name: lastName, email: 'student@demo.com', role: 'student' };
      });
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    try {
      const res = await api.post('/auth/password/change/', { old_password: oldPassword, new_password: newPassword, confirm_password: newPassword });
      return res.data;
    } catch (err) {
      return handleApiError(err, async () => {
        await new Promise((res) => setTimeout(res, 600));
        return { success: true, detail: 'Password changed successfully.' };
      });
    }
  },

  logout: async () => {
    const refresh = localStorage.getItem('refreshToken');
    try {
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch (err) {
      console.warn('[api.js] Logout network sync skipped.');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }
};

export default api;
