import { useState, useEffect } from 'react';
import api from '../api.js';

const METRIC_OPTIONS = [
  { value: 'temperature', label: '温度 (°C)' },
  { value: 'humidity', label: '湿度 (%)' },
  { value: 'pressure', label: '气压 (hPa)' },
  { value: 'wind_speed', label: '风速 (m/s)' },
  { value: 'precipitation', label: '降水 (mm)' },
];

const OPERATOR_OPTIONS = [
  { value: '>=', label: '大于等于 (>=)' },
  { value: '<=', label: '小于等于 (<=)' },
  { value: '>', label: '大于 (>)' },
  { value: '<', label: '小于 (<)' },
  { value: 'change', label: '变化量 (绝对值)' },
  { value: 'drop', label: '下降量' },
  { value: 'increase', label: '上升量' },
];

const SEVERITY_OPTIONS = [
  { value: 'info', label: '提示', color: '#3b82f6' },
  { value: 'warning', label: '预警', color: '#f59e0b' },
  { value: 'danger', label: '危险', color: '#ef4444' },
];

const EMPTY_THRESHOLD = {
  name: '',
  metric: 'temperature',
  operator: '>=',
  value: '',
  severity: 'warning',
  enabled: true,
  time_window_hours: '',
};

export default function AlertThresholds() {
  const [thresholds, setThresholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_THRESHOLD });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    setLoading(true);
    try {
      const data = await api.alerts.thresholds();
      setThresholds(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = '请输入规则名称';
    if (formData.value === '' || isNaN(parseFloat(formData.value))) e.value = '请输入有效阈值';
    if (
      (formData.operator === 'change' || formData.operator === 'drop' || formData.operator === 'increase') &&
      (!formData.time_window_hours || isNaN(parseInt(formData.time_window_hours)))
    ) {
      e.time_window_hours = '请输入时间窗口（小时）';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const payload = {
        ...formData,
        value: parseFloat(formData.value),
        time_window_hours: formData.time_window_hours ? parseInt(formData.time_window_hours) : null,
      };

      if (editingId) {
        await api.alerts.updateThreshold(editingId, payload);
      } else {
        await api.alerts.createThreshold(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ ...EMPTY_THRESHOLD });
      loadThresholds();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (threshold) => {
    setEditingId(threshold.id);
    setFormData({
      ...threshold,
      value: String(threshold.value),
      time_window_hours: threshold.time_window_hours ? String(threshold.time_window_hours) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条阈值规则吗？')) return;
    try {
      await api.alerts.deleteThreshold(id);
      loadThresholds();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleEnabled = async (threshold) => {
    try {
      await api.alerts.updateThreshold(threshold.id, { enabled: !threshold.enabled });
      loadThresholds();
    } catch (e) {
      console.error(e);
    }
  };

  const getSeverityBadge = (severity) => {
    const opt = SEVERITY_OPTIONS.find(o => o.value === severity);
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: `${opt?.color}20`, color: opt?.color }}
      >
        {opt?.label}
      </span>
    );
  };

  const getOperatorDesc = (operator) => {
    return OPERATOR_OPTIONS.find(o => o.value === operator)?.label || operator;
  };

  const getMetricDesc = (metric) => {
    return METRIC_OPTIONS.find(o => o.value === metric)?.label || metric;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-3xl">⚙️</span>
          预警阈值配置
        </h1>
        <p className="text-slate-500 mt-1">配置极端天气预警规则，系统将自动识别异常并触发预警</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="text-sm text-slate-600">危险: {thresholds.filter(t => t.severity === 'danger' && t.enabled).length} 条</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
              <span className="text-sm text-slate-600">预警: {thresholds.filter(t => t.severity === 'warning' && t.enabled).length} 条</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              <span className="text-sm text-slate-600">提示: {thresholds.filter(t => t.severity === 'info' && t.enabled).length} 条</span>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setFormData({ ...EMPTY_THRESHOLD }); }}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium flex items-center gap-2 shadow-sm"
          >
            <span>+</span> 新增阈值规则
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            {editingId ? '编辑阈值规则' : '新增阈值规则'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  规则名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：高温预警"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.name ? 'border-red-400' : 'border-slate-300'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  监测指标 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.metric}
                  onChange={e => setFormData({ ...formData, metric: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {METRIC_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  触发条件 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.operator}
                  onChange={e => setFormData({ ...formData, operator: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {OPERATOR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  阈值 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                  placeholder="例如：35"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.value ? 'border-red-400' : 'border-slate-300'
                  }`}
                />
                {errors.value && <p className="mt-1 text-xs text-red-500">{errors.value}</p>}
              </div>

              {(formData.operator === 'change' || formData.operator === 'drop' || formData.operator === 'increase') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    时间窗口（小时） <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.time_window_hours}
                    onChange={e => setFormData({ ...formData, time_window_hours: e.target.value })}
                    placeholder="例如：3"
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.time_window_hours ? 'border-red-400' : 'border-slate-300'
                    }`}
                  />
                  {errors.time_window_hours && (
                    <p className="mt-1 text-xs text-red-500">{errors.time_window_hours}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">在此时间范围内检测指标变化</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  预警等级
                </label>
                <select
                  value={formData.severity}
                  onChange={e => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {SEVERITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-700">启用此规则</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium shadow-sm"
              >
                {editingId ? '保存修改' : '创建规则'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...EMPTY_THRESHOLD }); }}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : thresholds.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <div className="text-5xl mb-3">⚙️</div>
            <p>暂无阈值规则，请点击上方按钮创建</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">规则名称</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">监测指标</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">触发条件</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">阈值</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">时间窗口</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600">等级</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">状态</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {thresholds.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-800">{t.name}</td>
                    <td className="px-5 py-4 text-slate-700">{getMetricDesc(t.metric)}</td>
                    <td className="px-5 py-4 text-slate-700 font-mono">{getOperatorDesc(t.operator)}</td>
                    <td className="px-5 py-4 text-slate-800 font-mono font-bold">{t.value}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {t.time_window_hours ? `${t.time_window_hours} 小时` : '-'}
                    </td>
                    <td className="px-5 py-4">{getSeverityBadge(t.severity)}</td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => toggleEnabled(t)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition ${
                          t.enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {t.enabled ? '✓ 已启用' : '✗ 已停用'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(t)}
                          className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
