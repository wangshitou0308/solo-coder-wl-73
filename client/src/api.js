import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || '请求失败';
    alert(msg);
    return Promise.reject(err);
  }
);

export default {
  devices: {
    list: () => api.get('/devices'),
    get: id => api.get(`/devices/${id}`),
    create: data => api.post('/devices', data),
    update: (id, data) => api.put(`/devices/${id}`, data),
    remove: id => api.delete(`/devices/${id}`),
    addCalibration: (id, data) => api.post(`/devices/${id}/calibrations`, data),
    removeCalibration: id => api.delete(`/devices/calibrations/${id}`),
    sensorMatrix: id => api.get(`/devices/${id}/sensor-matrix`),
  },
  observations: {
    list: params => api.get('/observations', { params }),
    daily: params => api.get('/observations/daily', { params }),
    create: data => api.post('/observations', data),
    bulk: data => api.post('/observations/bulk', { observations: data }),
    importCsv: (deviceId, file) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('device_id', deviceId);
      return api.post('/observations/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    update: (id, data) => api.put(`/observations/${id}`, data),
    remove: id => api.delete(`/observations/${id}`),
    extendedTrend: params => api.get('/observations/extended-trend', { params }),
  },
  forecasts: {
    sources: () => api.get('/forecasts/sources'),
    list: params => api.get('/forecasts', { params }),
    create: data => api.post('/forecasts', data),
    bulk: data => api.post('/forecasts/bulk', { forecasts: data }),
    simulate: data => api.post('/forecasts/simulate', data),
    update: (id, data) => api.put(`/forecasts/${id}`, data),
    remove: id => api.delete(`/forecasts/${id}`),
    comparison: params => api.get('/forecasts/comparison', { params }),
    scoring: params => api.get('/scoring/ranking', { params }),
    ranking: params => api.get('/scoring/ranking', { params }),
    specialAnalysis: params => api.get('/scoring/special-analysis', { params }),
    radarData: params => api.get('/scoring/radar-data', { params }),
  },
  events: {
    list: params => api.get('/events', { params }),
    get: id => api.get(`/events/${id}`),
    create: data => api.post('/events', data),
    update: (id, data) => api.put(`/events/${id}`, data),
    remove: id => api.delete(`/events/${id}`),
  },
  alerts: {
    thresholds: () => api.get('/alerts/thresholds'),
    updateThreshold: (id, data) => api.put(`/alerts/thresholds/${id}`, data),
    createThreshold: data => api.post('/alerts/thresholds', data),
    deleteThreshold: id => api.delete(`/alerts/thresholds/${id}`),
    check: params => api.get('/alerts/check', { params }),
    riskLevel: params => api.get('/alerts/risk-level', { params }),
  },
  candidates: {
    list: params => api.get('/candidates', { params }),
    promote: id => api.post(`/candidates/${id}/promote`),
    dismiss: id => api.post(`/candidates/${id}/dismiss`),
    runDetection: params => api.post('/candidates/detect', params),
  },
  scoring: {
    weights: () => api.get('/scoring/weights'),
    updateWeights: (id, data) => api.put(`/scoring/weights/${id}`, data),
    createWeights: data => api.post('/scoring/weights', data),
    setDefault: id => api.post(`/scoring/weights/${id}/default`),
  },
  stats: {
    overview: params => api.get('/stats/overview', { params }),
    accuracy: (period, params) => api.get(`/stats/accuracy/${period}`, { params }),
    sourceComparison: params => api.get('/stats/source-comparison', { params }),
    trend: params => api.get('/stats/trend', { params }),
    dashboard: params => api.get('/stats/dashboard', { params }),
  },
  reports: {
    csv: params => {
      const qs = new URLSearchParams(params).toString();
      window.open(`/api/reports/yearly-csv?${qs}`, '_blank');
    },
    pdf: params => {
      const qs = new URLSearchParams(params).toString();
      window.open(`/api/reports/yearly-pdf?${qs}`, '_blank');
    },
  },
};
