import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

const formatPercent = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return `${(Number(val) * 100).toFixed(1)}%`;
};

const getAccuracyBadgeClass = (val) => {
  if (val === null || val === undefined || isNaN(val)) return 'bg-slate-100 text-slate-500';
  const v = Number(val);
  if (v >= 0.85) return 'bg-green-100 text-green-700';
  if (v >= 0.7) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [device, setDevice] = useState(null);
  const [sourceStats, setSourceStats] = useState([]);
  const [dailyComparison, setDailyComparison] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ev = await api.events.get(id);
        setEvent(ev);

        if (ev.device_id) {
          const dev = await api.devices.get(ev.device_id);
          setDevice(dev);
        }

        const stats = (ev.forecast_stats || []).map(s => ({
          source: s.source_name,
          temp_accuracy: Number(s.temp_accuracy) || 0,
          precip_accuracy: Number(s.precip_accuracy) || 0,
          wind_accuracy: Number(s.wind_accuracy) || 0,
          overall_accuracy: Number(s.overall_accuracy) || 0,
          total: s.total || 0,
          temp_correct: s.temp_correct || 0,
          precip_correct: s.precip_correct || 0,
          wind_correct: s.wind_correct || 0
        }));
        setSourceStats(stats);

        const fcByDate = {};
        (ev.forecasts || []).forEach(f => {
          const d = f.target_date;
          if (!fcByDate[d]) {
            fcByDate[d] = {
              date: d,
              obs_temp_max: f.actual_temp_max,
              obs_temp_min: f.actual_temp_min,
              obs_precip: f.actual_precipitation,
              obs_wind: f.actual_wind_max,
              sources: []
            };
          }
          fcByDate[d].sources.push({
            source: f.source_name,
            fc_temp_high: f.temp_high,
            fc_temp_low: f.temp_low,
            fc_precip: f.precipitation_amount,
            fc_precip_prob: f.precipitation_prob,
            fc_wind: f.wind_speed
          });
        });
        const days = Object.values(fcByDate).sort((a, b) => a.date.localeCompare(b.date));
        setDailyComparison(days);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-500 text-lg">加载中...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-red-600 text-lg mb-4">未找到该事件记录</p>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            ← 返回事件列表
          </Link>
        </div>
      </div>
    );
  }

  const typeInfo = getEventTypeInfo(event.event_type);

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors mb-4"
        >
          <span>←</span>返回事件列表
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`${typeInfo.color} text-white w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-lg`}>
              {typeInfo.icon}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">{typeInfo.label}事件详情</h1>
              <p className="text-slate-500 mt-1 flex items-center gap-3">
                <span>📅 {dayjs(event.start_time).format('YYYY年MM月DD日 HH:mm')} ~ {dayjs(event.end_time).format('YYYY年MM月DD日 HH:mm')}</span>
                {device && <span>📍 {device.model}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>📋</span>基本信息
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">事件类型</span>
              <span className="font-medium text-slate-700">{typeInfo.icon} {typeInfo.label}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">关联设备</span>
              <span className="font-medium text-slate-700">{device ? device.model : '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">开始时间</span>
              <span className="font-medium text-slate-700">{dayjs(event.start_time).format('YYYY-MM-DD HH:mm')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">结束时间</span>
              <span className="font-medium text-slate-700">{dayjs(event.end_time).format('YYYY-MM-DD HH:mm')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">持续时长</span>
              <span className="font-medium text-slate-700">
                {dayjs(event.end_time).diff(dayjs(event.start_time), 'hour')} 小时
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>📊</span>极值数据
          </h2>
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">🌡️ 温度极值</div>
              <div className="text-3xl font-bold text-red-600">
                {event.temp_extreme !== null && event.temp_extreme !== undefined ? `${event.temp_extreme}°C` : '-'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">💨 风速极值</div>
              <div className="text-3xl font-bold text-cyan-600">
                {event.wind_extreme !== null && event.wind_extreme !== undefined ? `${event.wind_extreme} m/s` : '-'}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">💧 累计降水</div>
              <div className="text-3xl font-bold text-blue-600">
                {event.precipitation_total !== null && event.precipitation_total !== undefined ? `${event.precipitation_total} mm` : '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>📝</span>描述信息
          </h2>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-500 mb-2 font-medium">事件描述</div>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed">
                {event.description || '暂无描述'}
              </p>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-2 font-medium">影响描述</div>
              <p className="text-sm text-slate-700 bg-amber-50 rounded-lg p-3 leading-relaxed">
                {event.impact_description || '暂无影响描述'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>🎯</span>该时段预报表现统计
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700 rounded-l-lg">预报来源</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">温度准确率</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">降水准确率</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">风速准确率</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700 rounded-r-lg">综合评分</th>
              </tr>
            </thead>
            <tbody>
              {sourceStats.map((s, idx) => {
                const composite = (s.temp_accuracy + s.precip_accuracy + s.wind_accuracy) / 3;
                return (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.source}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getAccuracyBadgeClass(s.temp_accuracy)}`}>
                        {formatPercent(s.temp_accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getAccuracyBadgeClass(s.precip_accuracy)}`}>
                        {formatPercent(s.precip_accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getAccuracyBadgeClass(s.wind_accuracy)}`}>
                        {formatPercent(s.wind_accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getAccuracyBadgeClass(composite)}`}>
                        {formatPercent(composite)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>📅</span>该时段逐日预报 vs 实际对比
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th rowSpan="2" className="text-left px-4 py-3 font-semibold text-slate-700 rounded-tl-lg">日期</th>
                <th colSpan="2" className="text-center px-4 py-3 font-semibold text-slate-700 border-l border-slate-200">🌡️ 温度 (°C)</th>
                <th colSpan="2" className="text-center px-4 py-3 font-semibold text-slate-700 border-l border-slate-200">💧 降水 (mm)</th>
                <th colSpan="2" className="text-center px-4 py-3 font-semibold text-slate-700 border-l border-slate-200 rounded-tr-lg">💨 风速 (m/s)</th>
              </tr>
              <tr className="bg-slate-50 text-xs">
                <th className="text-center px-4 py-2 font-medium text-slate-600 border-l border-slate-200">实际</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600">预报</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600 border-l border-slate-200">实际</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600">预报</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600 border-l border-slate-200">实际</th>
                <th className="text-center px-4 py-2 font-medium text-slate-600">预报</th>
              </tr>
            </thead>
            <tbody>
              {dailyComparison.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">暂无对比数据</td>
                </tr>
              ) : dailyComparison.map((day, idx) => {
                const src = day.sources && day.sources[0];
                return (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{day.date}</td>
                    <td className="px-4 py-3 text-center text-slate-700 border-l border-slate-100">
                      {day.obs_temp_min != null ? `${day.obs_temp_min}~${day.obs_temp_max}` : (day.obs_temp_max ?? '-')}
                    </td>
                    <td className="px-4 py-3 text-center text-primary-600 font-medium">
                      {src ? (src.fc_temp_low != null ? `${src.fc_temp_low}~${src.fc_temp_high}` : (src.fc_temp_high ?? '-')) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 border-l border-slate-100">{day.obs_precip != null ? day.obs_precip : '-'}</td>
                    <td className="px-4 py-3 text-center text-primary-600 font-medium">{src ? (src.fc_precip != null ? src.fc_precip : '-') : '-'}</td>
                    <td className="px-4 py-3 text-center text-slate-700 border-l border-slate-100">{day.obs_wind != null ? day.obs_wind : '-'}</td>
                    <td className="px-4 py-3 text-center text-primary-600 font-medium">{src ? (src.fc_wind != null ? src.fc_wind : '-') : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
