import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';

const emptyCalib = {
  calibration_date: dayjs().format('YYYY-MM-DD'),
  temperature_offset: '',
  humidity_offset: '',
  pressure_offset: '',
  wind_speed_offset: '',
  notes: '',
};

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calibForm, setCalibForm] = useState(emptyCalib);
  const [calibErrors, setCalibErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api.devices
      .get(id)
      .then(data => {
        setDevice(data);
        setCalibrations(data.calibrations || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const validateCalib = () => {
    const e = {};
    if (!calibForm.calibration_date) e.calibration_date = '校准日期为必填项';
    ['temperature_offset', 'humidity_offset', 'pressure_offset', 'wind_speed_offset'].forEach(k => {
      if (calibForm[k] !== '' && isNaN(parseFloat(calibForm[k]))) {
        e[k] = '请输入有效数字';
      }
    });
    setCalibErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAddCalibration = async e => {
    e.preventDefault();
    if (!validateCalib()) return;
    setSubmitting(true);
    try {
      await api.devices.addCalibration(id, {
        ...calibForm,
        temperature_offset: calibForm.temperature_offset === '' ? 0 : parseFloat(calibForm.temperature_offset),
        humidity_offset: calibForm.humidity_offset === '' ? 0 : parseFloat(calibForm.humidity_offset),
        pressure_offset: calibForm.pressure_offset === '' ? 0 : parseFloat(calibForm.pressure_offset),
        wind_speed_offset: calibForm.wind_speed_offset === '' ? 0 : parseFloat(calibForm.wind_speed_offset),
      });
      setCalibForm({ ...emptyCalib, calibration_date: dayjs().format('YYYY-MM-DD') });
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCalib = async cid => {
    if (!confirm('确定要删除该校准记录吗？')) return;
    try {
      await api.devices.removeCalibration(cid);
      load();
    } catch {}
  };

  const offsetCell = (val, unit) => {
    if (val == null) return <span className="text-slate-400">-</span>;
    const n = Number(val);
    const color = Math.abs(n) < 0.001 ? 'text-slate-600' : n > 0 ? 'text-rose-600' : 'text-blue-600';
    const sign = n > 0 ? '+' : '';
    return <span className={`font-mono ${color}`}>{sign}{n}{unit}</span>;
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="mt-3">加载中...</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="p-12 text-center">
        <span className="text-5xl">❓</span>
        <p className="mt-4 text-slate-600 text-lg">设备不存在</p>
        <button
          onClick={() => navigate('/devices')}
          className="mt-6 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
        >
          返回设备列表
        </button>
      </div>
    );
  }

  const infoRows = [
    { label: '设备型号', value: device.model, icon: '🏷️' },
    { label: '生产商', value: device.manufacturer || '-', icon: '🏭' },
    { label: '安装位置', value: device.location || '-', icon: '📍' },
    {
      label: '经纬度',
      value: device.latitude && device.longitude ? `${device.latitude}, ${device.longitude}` : '-',
      icon: '🌐',
      mono: true,
    },
    { label: '安装日期', value: device.installation_date ? device.installation_date.slice(0, 10) : '-', icon: '📅' },
    {
      label: '传感器类型', value: device.sensor_types || '-', icon: '🔧',
    },
    {
      label: '创建时间', value: device.created_at ? device.created_at.replace('T', ' ').slice(0, 19) : '-',
      icon: '🕐',
    },
    {
      label: '更新时间', value: device.updated_at ? device.updated_at.replace('T', ' ').slice(0, 19) : '-',
      icon: '✏️',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/devices')}
            className="inline-flex items-center gap-1 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span>←</span>
            <span>返回列表</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">设备详情</h1>
            <p className="text-sm text-slate-500 mt-1">
              {device.model} - {device.location}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 text-white flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl">📡</span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{device.model}</h2>
            <p className="text-primary-100 text-sm">{device.manufacturer || '未记录生产商'}</p>
          </div>
          <div className="text-right">
            <p className="text-primary-100 text-xs">校准记录</p>
            <p className="text-2xl font-bold">{calibrations.length}</p>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {infoRows.map((row, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <span>{row.icon}</span>
                <span>{row.label}</span>
              </p>
              <p className={`text-slate-800 ${row.mono ? 'font-mono text-sm' : ''}`}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>🔬</span>校准记录
            </h2>
            <span className="text-sm text-slate-500">共 {calibrations.length} 条</span>
          </div>
          <div className="overflow-x-auto">
            {calibrations.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl">📋</span>
                <p className="mt-3 text-slate-500">暂无校准记录</p>
                <p className="text-sm text-slate-400 mt-1">请在右侧表单添加校准记录</p>
              </div>
            ) : (
              <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 text-left font-medium">校准日期</th>
                  <th className="px-4 py-3 text-right font-medium">温度 (°C)</th>
                  <th className="px-4 py-3 text-right font-medium">湿度 (%)</th>
                  <th className="px-4 py-3 text-right font-medium">气压 (hPa)</th>
                  <th className="px-4 py-3 text-right font-medium">风速 (m/s)</th>
                  <th className="px-4 py-3 text-left font-medium">备注</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calibrations.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.calibration_date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right">{offsetCell(c.temperature_offset, '°C')}</td>
                    <td className="px-4 py-3 text-right">{offsetCell(c.humidity_offset, '%')}</td>
                    <td className="px-4 py-3 text-right">{offsetCell(c.pressure_offset, 'hPa')}</td>
                    <td className="px-4 py-3 text-right">{offsetCell(c.wind_speed_offset, 'm/s')}</td>
                    <td className="px-4 py-3 max-w-[200px] text-slate-600 truncate" title={c.notes || ''}>
                      {c.notes || <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteCalib(c.id)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>➕</span>添加校准记录
            </h2>
            <p className="text-xs text-slate-500 mt-1">记录传感器校准偏移量</p>
          </div>
          <form onSubmit={handleAddCalibration} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                校准日期 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={calibForm.calibration_date}
                onChange={e => setCalibForm({ ...calibForm, calibration_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  calibErrors.calibration_date ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              {calibErrors.calibration_date && (
                <p className="mt-1 text-xs text-rose-500">{calibErrors.calibration_date}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">温度偏移 (°C)</label>
                <input
                  type="number"
                  step="any"
                  value={calibForm.temperature_offset}
                  onChange={e => setCalibForm({ ...calibForm, temperature_offset: e.target.value })}
                  placeholder="如: -0.5"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    calibErrors.temperature_offset ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {calibErrors.temperature_offset && (
                  <p className="mt-1 text-xs text-rose-500">{calibErrors.temperature_offset}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">湿度偏移 (%)</label>
                <input
                  type="number"
                  step="any"
                  value={calibForm.humidity_offset}
                  onChange={e => setCalibForm({ ...calibForm, humidity_offset: e.target.value })}
                  placeholder="如: 2"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    calibErrors.humidity_offset ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {calibErrors.humidity_offset && (
                  <p className="mt-1 text-xs text-rose-500">{calibErrors.humidity_offset}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">气压偏移 (hPa)</label>
                <input
                  type="number"
                  step="any"
                  value={calibForm.pressure_offset}
                  onChange={e => setCalibForm({ ...calibForm, pressure_offset: e.target.value })}
                  placeholder="如: 1.2"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    calibErrors.pressure_offset ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {calibErrors.pressure_offset && (
                  <p className="mt-1 text-xs text-rose-500">{calibErrors.pressure_offset}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">风速偏移 (m/s)</label>
                <input
                  type="number"
                  step="any"
                  value={calibForm.wind_speed_offset}
                  onChange={e => setCalibForm({ ...calibForm, wind_speed_offset: e.target.value })}
                  placeholder="如: -0.3"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    calibErrors.wind_speed_offset ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {calibErrors.wind_speed_offset && (
                  <p className="mt-1 text-xs text-rose-500">{calibErrors.wind_speed_offset}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">备注</label>
              <textarea
                value={calibForm.notes}
                onChange={e => setCalibForm({ ...calibForm, notes: e.target.value })}
                rows="3"
                placeholder="校准说明、使用的标准仪器等..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>保存校准记录</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
