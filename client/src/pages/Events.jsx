import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import dayjs from 'dayjs';

const EVENT_TYPES = [
  { value: '暴雨', label: '暴雨', icon: '🌧️', color: 'bg-blue-500' },
  { value: '大风', label: '大风', icon: '💨', color: 'bg-cyan-500' },
  { value: '冰雹', label: '冰雹', icon: '🧊', color: 'bg-slate-500' },
  { value: '高温', label: '高温', icon: '🔥', color: 'bg-red-500' },
  { value: '低温', label: '低温', icon: '❄️', color: 'bg-indigo-500' },
  { value: '雷电', label: '雷电', icon: '⚡', color: 'bg-yellow-500' },
  { value: '暴雪', label: '暴雪', icon: '🌨️', color: 'bg-sky-400' },
  { value: '大雾', label: '大雾', icon: '🌫️', color: 'bg-gray-400' },
];

const getEventTypeInfo = (type) => {
  return EVENT_TYPES.find(t => t.value === type) || { label: type, icon: '📌', color: 'bg-gray-500' };
};

export default function Events() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [devices, setDevices] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [riskLevel, setRiskLevel] = useState(null);
  const [formData, setFormData] = useState({
    event_type: '暴雨',
    start_time: '',
    end_time: '',
    device_id: '',
    temp_extreme: '',
    wind_extreme: '',
    precipitation_total: '',
    description: '',
    impact_description: '',
  });

  const fetchData = async () => {
    const [eventsData, devicesData, riskData] = await Promise.all([
      api.events.list({ event_type: filterType === 'all' ? undefined : filterType }),
      api.devices.list(),
      api.alerts.riskLevel().catch(() => null),
    ]);
    setEvents(eventsData);
    setDevices(devicesData);
    setRiskLevel(riskData);
  };

  useEffect(() => {
    fetchData();
  }, [filterType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.temp_extreme !== '') payload.temp_extreme = Number(payload.temp_extreme);
    if (payload.wind_extreme !== '') payload.wind_extreme = Number(payload.wind_extreme);
    if (payload.precipitation_total !== '') payload.precipitation_total = Number(payload.precipitation_total);

    if (editingEvent) {
      await api.events.update(editingEvent.id, payload);
    } else {
      await api.events.create(payload);
    }
    setShowModal(false);
    setEditingEvent(null);
    resetForm();
    fetchData();
  };

  const handleEdit = (ev) => {
    setEditingEvent(ev);
    setFormData({
      event_type: ev.event_type || 'rainstorm',
      start_time: ev.start_time ? dayjs(ev.start_time).format('YYYY-MM-DDTHH:mm') : '',
      end_time: ev.end_time ? dayjs(ev.end_time).format('YYYY-MM-DDTHH:mm') : '',
      device_id: ev.device_id || '',
      temp_extreme: ev.temp_extreme ?? '',
      wind_extreme: ev.wind_extreme ?? '',
      precipitation_total: ev.precipitation_total ?? '',
      description: ev.description || '',
      impact_description: ev.impact_description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除该事件？')) return;
    await api.events.remove(id);
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      event_type: '暴雨',
      start_time: '',
      end_time: '',
      device_id: '',
      temp_extreme: '',
      wind_extreme: '',
      precipitation_total: '',
      description: '',
      impact_description: '',
    });
  };

  const openCreate = () => {
    setEditingEvent(null);
    resetForm();
    setShowModal(true);
  };

  const getRiskLevelInfo = (level) => {
    const info = {
      low: { label: '低风险', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700', icon: '✅' },
      medium: { label: '中风险', color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', icon: '⚠️' },
      high: { label: '高风险', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', icon: '🔶' },
      extreme: { label: '极端风险', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', icon: '🚨' },
    };
    return info[level] || info.low;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span>⛈️</span>极端天气事件管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">记录和管理历史极端天气事件</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md flex items-center gap-2 font-medium"
        >
          <span>➕</span>添加事件
        </button>
      </div>

      {riskLevel && (
        <div className={`${getRiskLevelInfo(riskLevel.level).bgColor} border rounded-xl p-5 mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`${getRiskLevelInfo(riskLevel.level).color} w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-md`}>
                {getRiskLevelInfo(riskLevel.level).icon}
              </div>
              <div>
                <div className={`text-lg font-bold ${getRiskLevelInfo(riskLevel.level).textColor}`}>
                  当前风险等级：{getRiskLevelInfo(riskLevel.level).label}
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  风险评分：{riskLevel.overall_score}/100
                  {riskLevel.triggered_alerts && riskLevel.triggered_alerts.length > 0 && (
                    <span className="ml-3">触发预警：{riskLevel.triggered_alerts.length} 条</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/candidates')}
              className="px-4 py-2 bg-white/80 hover:bg-white rounded-lg transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
            >
              <span>🔍</span>查看候选事件
            </button>
          </div>
          {riskLevel.triggered_alerts && riskLevel.triggered_alerts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {riskLevel.triggered_alerts.map((alert, idx) => (
                <span key={idx} className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskLevelInfo(riskLevel.level).bgColor} ${getRiskLevelInfo(riskLevel.level).textColor} border`}>
                  {alert.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filterType === 'all'
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            全部
          </button>
          {EVENT_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                filterType === type.value
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{type.icon}</span>{type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">🌤️</div>
            <p className="text-slate-500">暂无事件记录</p>
          </div>
        )}
        {events.map(ev => {
          const typeInfo = getEventTypeInfo(ev.event_type);
          const device = devices.find(d => d.id === ev.device_id);
          return (
            <div
              key={ev.id}
              onClick={() => navigate(`/events/${ev.id}`)}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100 overflow-hidden"
            >
              <div className={`${typeInfo.color} h-2`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{typeInfo.label}</h3>
                      <p className="text-xs text-slate-500">
                        {device ? device.model : '未关联设备'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(ev)}
                      className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">🕐</span>
                    <span>
                      {dayjs(ev.start_time).format('YYYY-MM-DD HH:mm')} ~ {dayjs(ev.end_time).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </div>
                  {(ev.temp_extreme !== null && ev.temp_extreme !== undefined) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">🌡️</span>
                      <span>温度极值: <strong>{ev.temp_extreme}°C</strong></span>
                    </div>
                  )}
                  {(ev.wind_extreme !== null && ev.wind_extreme !== undefined) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">💨</span>
                      <span>风速极值: <strong>{ev.wind_extreme} m/s</strong></span>
                    </div>
                  )}
                  {(ev.precipitation_total !== null && ev.precipitation_total !== undefined) && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">💧</span>
                      <span>累计降水: <strong>{ev.precipitation_total} mm</strong></span>
                    </div>
                  )}
                </div>

                {ev.description && (
                  <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 line-clamp-2">
                    {ev.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editingEvent ? '编辑事件' : '添加事件'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingEvent(null); }}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">事件类型 <span className="text-red-500">*</span></label>
                  <select
                    value={formData.event_type}
                    onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    required
                  >
                    {EVENT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">关联设备</label>
                  <select
                    value={formData.device_id}
                    onChange={e => setFormData({ ...formData, device_id: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  >
                    <option value="">选择设备...</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.model}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">开始时间 <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">结束时间 <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">温度极值 (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temp_extreme}
                    onChange={e => setFormData({ ...formData, temp_extreme: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    placeholder="例如: 38.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">风速极值 (m/s)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.wind_extreme}
                    onChange={e => setFormData({ ...formData, wind_extreme: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    placeholder="例如: 25.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">累计降水 (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.precipitation_total}
                    onChange={e => setFormData({ ...formData, precipitation_total: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    placeholder="例如: 120.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">事件描述</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                  placeholder="描述事件过程..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">影响描述</label>
                <textarea
                  rows="3"
                  value={formData.impact_description}
                  onChange={e => setFormData({ ...formData, impact_description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                  placeholder="描述事件造成的影响..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingEvent(null); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-md"
                >
                  {editingEvent ? '保存修改' : '添加事件'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
