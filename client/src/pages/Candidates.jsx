import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api.js';

const STATUS_MAP = {
  pending: { label: '待处理', color: 'bg-amber-100 text-amber-700' },
  promoted: { label: '已转正', color: 'bg-green-100 text-green-700' },
  dismissed: { label: '已忽略', color: 'bg-slate-100 text-slate-500' },
};

const SEVERITY_MAP = {
  info: { label: '提示', color: '#3b82f6' },
  warning: { label: '预警', color: '#f59e0b' },
  danger: { label: '危险', color: '#ef4444' },
};

const EVENT_ICONS = {
  high_temperature: '🔥',
  low_temperature: '❄️',
  heavy_rain: '🌧️',
  strong_wind: '💨',
  heavy_precipitation: '🌊',
  pressure_drop: '📉',
  temperature_surge: '⚡',
  precipitation_surge: '🌊',
};

export default function Candidates() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadCandidates();
    }
  }, [selectedDevice, statusFilter]);

  const loadDevices = async () => {
    try {
      const list = await api.devices.list();
      setDevices(list);
      if (list.length > 0) {
        setSelectedDevice(String(list[0].id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = { device_id: selectedDevice };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const data = await api.candidates.list(params);
      setCandidates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDetect = async () => {
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    setDetecting(true);
    try {
      const result = await api.candidates.runDetection({ device_id: selectedDevice });
      alert(`检测完成，发现 ${result.detected} 个候选事件`);
      loadCandidates();
    } catch (e) {
      console.error(e);
    } finally {
      setDetecting(false);
    }
  };

  const handlePromote = async (candidate) => {
    if (!confirm(`确定要将"${candidate.event_name}"转为正式极端事件吗？`)) return;
    try {
      const result = await api.candidates.promote(candidate.id);
      alert(`已成功创建正式事件（ID: ${result.event_id}）`);
      navigate(`/events/${result.event_id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismiss = async (id) => {
    if (!confirm('确定要忽略此候选事件吗？')) return;
    try {
      await api.candidates.dismiss(id);
      loadCandidates();
    } catch (e) {
      console.error(e);
    }
  };

  const getSeverityBadge = (severity) => {
    const info = SEVERITY_MAP[severity] || SEVERITY_MAP.warning;
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: `${info.color}20`, color: info.color }}
      >
        {info.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const info = STATUS_MAP[status] || STATUS_MAP.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
        {info.label}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-3xl">🔍</span>
          候选事件管理
        </h1>
        <p className="text-slate-500 mt-1">系统自动识别的异常气象事件，可一键转为正式极端事件</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">选择设备</label>
              <select
                value={selectedDevice}
                onChange={e => setSelectedDevice(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.model} - {d.location}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">状态筛选</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                <option value="all">全部</option>
                <option value="pending">待处理</option>
                <option value="promoted">已转正</option>
                <option value="dismissed">已忽略</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleDetect}
            disabled={detecting || !selectedDevice}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {detecting ? (
              <>
                <span className="animate-spin">⏳</span> 检测中...
              </>
            ) : (
              <>
                <span>🔍</span> 运行自动检测
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : candidates.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <div className="text-5xl mb-3">🔍</div>
            <p>暂无候选事件</p>
            <p className="text-sm mt-1">点击"运行自动检测"扫描异常气象数据</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {candidates.map(c => (
              <div key={c.id} className="p-5 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{EVENT_ICONS[c.event_type] || '⚠️'}</span>
                      <div>
                        <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                          {c.event_name}
                          {getSeverityBadge(c.severity)}
                          {getStatusBadge(c.status)}
                        </h3>
                        <p className="text-sm text-slate-500">
                          置信度: <span className="font-semibold text-slate-700">{c.confidence}%</span>
                          {' · '}
                          {dayjs(c.start_time).format('YYYY-MM-DD HH:mm')} - {dayjs(c.end_time).format('YYYY-MM-DD HH:mm')}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 mb-2"
                    >
                      {expandedId === c.id ? '▲ 收起详情' : '▼ 展开详情'}
                    </button>

                    {expandedId === c.id && (
                      <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        {c.triggered_rules && c.triggered_rules.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">触发规则</h4>
                            <div className="space-y-2">
                              {c.triggered_rules.map((rule, i) => (
                                <div key={i} className="text-sm text-slate-600 bg-white px-3 py-2 rounded border border-slate-200">
                                  <span className="font-medium text-slate-800">{rule.rule}:</span>{' '}
                                  {rule.metric} {rule.operator} {rule.threshold}，
                                  当前值: <span className="font-semibold text-rose-600">{rule.actual_value}</span>
                                  {rule.time_window_hours && ` (${rule.time_window_hours}小时窗口)`}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {c.peak_values && Object.keys(c.peak_values).length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">峰值数据</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {Object.entries(c.peak_values).map(([key, value]) => (
                                <div key={key} className="bg-white px-3 py-2 rounded border border-slate-200">
                                  <div className="text-xs text-slate-500">{key}</div>
                                  <div className="font-semibold text-slate-800">{value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {c.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handlePromote(c)}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition font-medium"
                      >
                        ✓ 转为正式事件
                      </button>
                      <button
                        onClick={() => handleDismiss(c.id)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition font-medium"
                      >
                        忽略
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
