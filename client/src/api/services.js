import { api } from './client';

export const authService = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  loginMfa: (payload) => api.post('/auth/mfa/login', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  mfaSetup: () => api.post('/auth/mfa/setup'),
  mfaEnable: (payload) => api.post('/auth/mfa/enable', payload),
  mfaDisable: (payload) => api.post('/auth/mfa/disable', payload),
};

export const userService = {
  list: () => api.get('/users'),
};

export const taskService = {
  list: ({ status, q, page, limit } = {}) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return api.get(`/tasks${qs ? `?${qs}` : ''}`);
  },
  create: (payload) => api.post('/tasks', payload),
  replace: (id, payload) => api.put(`/tasks/${encodeURIComponent(id)}`, payload),
  patch: (id, payload) => api.patch(`/tasks/${encodeURIComponent(id)}`, payload),
  remove: (id) => api.delete(`/tasks/${encodeURIComponent(id)}`),
};
