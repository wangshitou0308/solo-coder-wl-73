import { useState, useEffect } from 'react';
import api from '../api.js';

export default function ScoringWeights() {
  const [weights, setWeights] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingWeight, setEditingWeight] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    temp_weight: 0.4,
    precip_weight: 0.35,
    wind_weight: 0.25,
    is_default: false,
  });

  const fetchData = async () => {
    const data = await api.scoring.weights();
    setWeights(data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const total = Number(formData.temp_weight) + Number(formData.precip_weight) + Number(formData.wind_weight);
    if (Math.abs(total - 1) > 0.001) {
      alert('权重之和必须等于1');
      return;
    }

    const payload = {
      name: formData.name,
      temp_weight: Number(formData.temp_weight),
      precip_weight: Number(formData.precip_weight),
      wind_weight: Number(formData.wind_weight),
      is_default: formData.is_default,
    };

    if (editingWeight) {
      await api.scoring.updateWeights(editingWeight.id, payload);
    } else {
      await api.scoring.createWeights(payload);
    }
    setShowModal(false);
    setEditingWeight(null);
    resetForm();
    fetchData();
  };

  const handleEdit = (w) => {
    setEditingWeight(w);
    setFormData({
      name: w.name,
      temp_weight: w.temp_weight,
      precip_weight: w.precip_weight,
      wind_weight: w.wind_weight,
      is_default: w.is_default,
    });
    setShowModal(true);
  };

  const handleSetDefault = async (id) => {
    if (!confirm('确定将此配置设为默认？')) return;
    await api.scoring.setDefault(id);
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      temp_weight: 0.4,
      precip_weight: 0.35,
      wind_weight: 0.25,
      is_default: false,
    });
  };

  const openCreate = () => {
    setEditingWeight(null);
    resetForm();
    setShowModal(true);
  };

  const totalWeight = Number(formData.temp_weight) + Number(formData.precip_weight) + Number(formData.wind_weight);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span>⚖️</span>评分权重配置
          </h1>
          <p className="text-sm text-slate-500 mt-1">自定义预报评分中温度、降水、风速的权重占比</p>
        </div>
        <button
          onClick={openCreate}
          className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md flex items-center gap-2 font-medium"
        >
          <span>➕</span>新建配置
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span>💡</span>权重说明
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="font-medium text-orange-700 mb-1">🌡️ 温度权重</div>
            <p>影响温度预报准确率的评分占比，适用于关注气温预报的场景</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="font-medium text-blue-700 mb-1">💧 降水权重</div>
            <p>影响降水预报准确率的评分占比，适用于关注降雨预报的场景</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-4">
            <div className="font-medium text-cyan-700 mb-1">💨 风速权重</div>
            <p>影响风速预报准确率的评分占比，适用于关注风力预报的场景</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weights.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">⚖️</div>
            <p className="text-slate-500">暂无权重配置</p>
          </div>
        )}
        {weights.map(w => (
          <div key={w.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-50 to-primary-100 p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <h3 className="font-bold text-slate-800">{w.name}</h3>
                </div>
                {w.is_default && (
                  <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-medium">
                    默认
                  </span>
                )}
              </div>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-600 flex items-center gap-1">🌡️ 温度权重</span>
                    <span className="font-semibold text-orange-600">{(w.temp_weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${w.temp_weight * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-600 flex items-center gap-1">💧 降水权重</span>
                    <span className="font-semibold text-blue-600">{(w.precip_weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${w.precip_weight * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-600 flex items-center gap-1">💨 风速权重</span>
                    <span className="font-semibold text-cyan-600">{(w.wind_weight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${w.wind_weight * 100}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(w)}
                  className="flex-1 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  ✏️ 编辑
                </button>
                {!w.is_default && (
                  <button
                    onClick={() => handleSetDefault(w.id)}
                    className="flex-1 px-3 py-2 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors font-medium"
                  >
                    ⭐ 设为默认
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                {editingWeight ? '编辑权重配置' : '新建权重配置'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingWeight(null); }}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">配置名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="例如：夏季降水优先"
                  required
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-medium text-slate-700">权重分配</span>
                  <span className={`text-sm font-semibold ${Math.abs(totalWeight - 1) < 0.001 ? 'text-green-600' : 'text-red-600'}`}>
                    合计：{(totalWeight * 100).toFixed(0)}%
                    {Math.abs(totalWeight - 1) < 0.001 ? ' ✓' : ' (需为100%)'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-700 flex items-center gap-1">🌡️ 温度权重</label>
                      <span className="font-semibold text-orange-600">{(formData.temp_weight * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.temp_weight}
                      onChange={e => setFormData({ ...formData, temp_weight: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-700 flex items-center gap-1">💧 降水权重</label>
                      <span className="font-semibold text-blue-600">{(formData.precip_weight * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.precip_weight}
                      onChange={e => setFormData({ ...formData, precip_weight: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <label className="text-slate-700 flex items-center gap-1">💨 风速权重</label>
                      <span className="font-semibold text-cyan-600">{(formData.wind_weight * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formData.wind_weight}
                      onChange={e => setFormData({ ...formData, wind_weight: Number(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={e => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="is_default" className="text-sm text-slate-700">设为默认权重配置</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingWeight(null); }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={Math.abs(totalWeight - 1) > 0.001}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingWeight ? '保存修改' : '创建配置'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
