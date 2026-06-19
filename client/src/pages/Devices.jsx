import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const emptyForm = {
  model: '',
  manufacturer: '',
  sensor_types: '',
  location: '',
  latitude: '',
  longitude: '',
  installation_date: '',
};

export default function Devices() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const loadDevices = () => {
    api.devices.list().then(data => setDevices(data));
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = device => {
    setEditingId(device.id);
    setForm({
      model: device.model || '',
      manufacturer: device.manufacturer || '',
      sensor_types: device.sensor_types || '',
      location: device.location || '',
      latitude: device.latitude || '',
      longitude: device.longitude || '',
      installation_date: device.installation_date || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.model.trim()) e.model = '设备型号为必填项';
    if (!form.sensor_types.trim()) e.sensor_types = '传感器类型为必填项';
    if (!form.location.trim()) e.location = '安装位置为必填项';
    if (form.latitude !== '' && (isNaN(parseFloat(form.latitude)) || parseFloat(form.latitude) < -90 || parseFloat(form.latitude) > 90)) {
      e.latitude = '纬度应在 -90 到 90 之间';
    }
    if (form.longitude !== '' && (isNaN(parseFloat(form.longitude)) || parseFloat(form.longitude) < -180 || parseFloat(form.longitude) > 180)) {
      e.longitude = '经度应在 -180 到 180 之间';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      latitude: form.latitude === '' ? null : parseFloat(form.latitude),
      longitude: form.longitude === '' ? null : parseFloat(form.longitude),
      installation_date: form.installation_date || null,
    };
    try {
      if (editingId) {
        await api.devices.update(editingId, payload);
      } else {
        await api.devices.create(payload);
      }
      setShowModal(false);
      loadDevices();
    } catch {}
  };

  const handleDelete = async id => {
    if (!confirm('确定要删除该设备吗？相关的观测和校准数据可能会受影响。')) return;
    try {
      await api.devices.remove(id);
      loadDevices();
    } catch {}
  };

  const sensorBadge = sensors => {
    const list = (sensors || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (list.length === 0) return <span className="text-slate-400 text-sm">-</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {list.slice(0, 4).map((s, i) => (
          <span key={i} className="inline-block px-2 py-0.5 text-xs bg-primary-50 text-primary-700 rounded-full border border-primary-100">
            {s}
          </span>
        ))}
        {list.length > 4 && <span className="text-xs text-slate-500">+{list.length - 4}</span>}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">设备管理</h1>
          <p className="text-sm text-slate-500 mt-1">管理气象站设备及传感器配置</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          <span>添加设备</span>
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-16 text-center border border-slate-200">
          <span className="text-6xl">📡</span>
          <p className="mt-6 text-slate-600 text-lg">暂无设备记录</p>
          <p className="mt-2 text-slate-400 text-sm">点击右上角"添加设备"开始录入</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map(d => (
            <div
              key={d.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="h-2 bg-gradient-to-r from-primary-500 to-primary-600" />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/devices/${d.id}`)}>
                    <h3 className="text-lg font-semibold text-slate-800 truncate hover:text-primary-600 transition-colors">
                      {d.model}
                    </h3>
                    {d.manufacturer && <p className="text-sm text-slate-500 mt-0.5">{d.manufacturer}</p>}
                  </div>
                  <span className="ml-3 inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-50 text-primary-600 text-xl flex-shrink-0">
                    📡
                  </span>
                </div>

                <div className="space-y-2.5 mb-4">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-slate-400 mt-0.5">📍</span>
                    <span className="text-slate-700 flex-1">{d.location || '-'}</span>
                  </div>
                  {(d.latitude || d.longitude) && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-slate-400 mt-0.5">🌐</span>
                      <span className="text-slate-600 font-mono text-xs">
                        {d.latitude?.toFixed?.(4) ?? d.latitude}, {d.longitude?.toFixed?.(4) ?? d.longitude}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-slate-400 mt-0.5">🔧</span>
                    <div className="flex-1">{sensorBadge(d.sensor_types)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">校准次数</p>
                    <p className="text-lg font-semibold text-slate-800 mt-1">{d.calibration_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">观测次数</p>
                    <p className="text-lg font-semibold text-slate-800 mt-1">{(d.observation_count || 0).toLocaleString()}</p>
                  </div>
                </div>

                {d.last_calibration && (
                  <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    上次校准: <span className="text-slate-700">{d.last_calibration.slice(0, 10)}</span>
                  </p>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => navigate(`/devices/${d.id}`)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => openEditModal(d)}
                    className="flex-1 px-3 py-2 text-sm border border-primary-200 text-primary-700 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="px-3 py-2 text-sm border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingId ? '编辑设备' : '添加设备'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    设备型号 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    placeholder="如: WS-2000"
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.model ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                  {errors.model && <p className="mt-1 text-xs text-rose-500">{errors.model}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">生产商</label>
                  <input
                    type="text"
                    value={form.manufacturer}
                    onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                    placeholder="如: 某科技公司"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  传感器类型 <span className="text-rose-500">*</span>
                  <span className="ml-2 text-xs font-normal text-slate-400">逗号分隔，如: 温度,湿度,气压</span>
                </label>
                <input
                  type="text"
                  value={form.sensor_types}
                  onChange={e => setForm({ ...form, sensor_types: e.target.value })}
                  placeholder="温度,湿度,气压,风速,风向,降水"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.sensor_types ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {errors.sensor_types && <p className="mt-1 text-xs text-rose-500">{errors.sensor_types}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  安装位置 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="如: 北京朝阳区某小区楼顶"
                  className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                    errors.location ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {errors.location && <p className="mt-1 text-xs text-rose-500">{errors.location}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">纬度</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: e.target.value })}
                    placeholder="-90 ~ 90"
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.latitude ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                  {errors.latitude && <p className="mt-1 text-xs text-rose-500">{errors.latitude}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">经度</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: e.target.value })}
                    placeholder="-180 ~ 180"
                    className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.longitude ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                  {errors.longitude && <p className="mt-1 text-xs text-rose-500">{errors.longitude}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">安装日期</label>
                <input
                  type="date"
                  value={form.installation_date}
                  onChange={e => setForm({ ...form, installation_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none transition focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </form>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm transition-colors"
              >
                {editingId ? '保存修改' : '创建设备'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
