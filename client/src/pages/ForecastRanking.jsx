import { useState, useEffect } from 'react';
import api from '../api.js';

export default function ForecastRanking() {
  const [devices, setDevices] = useState([]);
  const [weights, setWeights] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedWeight, setSelectedWeight] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterWeather, setFilterWeather] = useState('');
  const [rankingData, setRankingData] = useState(null);
  const [loading, setLoading] = useState(false);

  const months = [
    { value: '', label: '全部月份' },
    { value: '01', label: '1月' }, { value: '02', label: '2月' }, { value: '03', label: '3月' },
    { value: '04', label: '4月' }, { value: '05', label: '5月' }, { value: '06', label: '6月' },
    { value: '07', label: '7月' }, { value: '08', label: '8月' }, { value: '09', label: '9月' },
    { value: '10', label: '10月' }, { value: '11', label: '11月' }, { value: '12', label: '12月' },
  ];

  const seasons = [
    { value: '', label: '全部季节' },
    { value: '春季', label: '春季（3-5月）' },
    { value: '夏季', label: '夏季（6-8月）' },
    { value: '秋季', label: '秋季（9-11月）' },
    { value: '冬季', label: '冬季（12-2月）' },
  ];

  const weatherTypes = [
    { value: '', label: '全部天气' },
    { value: '晴天', label: '晴天' },
    { value: '雨天', label: '雨天' },
    { value: '大风', label: '大风' },
    { value: '高温', label: '高温' },
    { value: '低温', label: '低温' },
    { value: '暴雨', label: '暴雨' },
  ];

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadRanking();
    }
  }, [selectedDevice, selectedWeight, filterMonth, filterSeason, filterWeather]);

  async function loadInitial() {
    const [devs, wts] = await Promise.all([
      api.devices.list(),
      api.scoring.weights(),
    ]);
    setDevices(devs);
    setWeights(wts);
    if (devs.length > 0) setSelectedDevice(devs[0].id);
    const defaultWeight = wts.find(w => w.is_default) || wts[0];
    if (defaultWeight) setSelectedWeight(defaultWeight.id);
  }

  async function loadRanking() {
    setLoading(true);
    try {
      const params = { device_id: selectedDevice };
      if (selectedWeight) params.weight_id = selectedWeight;
      if (filterMonth) params.month = filterMonth;
      if (filterSeason) params.season = filterSeason;
      if (filterWeather) params.weather_type = filterWeather;

      const data = await api.forecasts.ranking(params);
      setRankingData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const formatScore = (val) => {
    if (val == null || isNaN(val)) return '-';
    return Number(val).toFixed(1);
  };

  const getScoreBadgeClass = (val) => {
    if (val == null || isNaN(val)) return 'bg-slate-100 text-slate-500';
    const v = Number(val);
    if (v >= 80) return 'bg-green-100 text-green-700';
    if (v >= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return 'bg-yellow-500 text-white';
    if (rank === 2) return 'bg-slate-400 text-white';
    if (rank === 3) return 'bg-amber-600 text-white';
    return 'bg-slate-200 text-slate-600';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>🏆</span>预报源排行榜
        </h1>
        <p className="text-sm text-slate-500 mt-1">综合评分及各维度分项评分，按多维度推荐最佳预报源</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">设备选择</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              <option value="">请选择设备</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.model} - {d.location || '#'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">权重配置</label>
            <select
              value={selectedWeight}
              onChange={e => setSelectedWeight(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              {weights.map(w => (
                <option key={w.id} value={w.id}>{w.name}{w.is_default ? ' (默认)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">月份筛选</label>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">季节筛选</label>
            <select
              value={filterSeason}
              onChange={e => setFilterSeason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              {seasons.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">天气类型</label>
            <select
              value={filterWeather}
              onChange={e => setFilterWeather(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              {weatherTypes.map(w => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>

        {rankingData?.weights && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-slate-500">当前权重：</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded">
              🌡️ 温度 {(rankingData.weights.temp_weight * 100).toFixed(0)}%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
              💧 降水 {(rankingData.weights.precip_weight * 100).toFixed(0)}%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-50 text-cyan-700 rounded">
              💨 风速 {(rankingData.weights.wind_weight * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500">加载中...</div>
        ) : !rankingData || rankingData.ranking.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="text-5xl mb-3">📊</div>
            <p>暂无评分数据，请先录入预报和观测数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary-50 to-primary-100">
                  <th className="text-center px-4 py-4 font-semibold text-slate-700">排名</th>
                  <th className="text-left px-4 py-4 font-semibold text-slate-700">预报来源</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-700">样本数</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-700">🌡️ 温度准确率</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-700">💧 降水准确率</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-700">💨 风速准确率</th>
                  <th className="text-center px-4 py-4 font-semibold text-slate-700">⭐ 综合评分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankingData.ranking.map((item, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${idx < 3 ? 'bg-gradient-to-r from-yellow-50/50 to-transparent' : ''}`}>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${getRankBadge(item.rank)}`}>
                        {item.rank <= 3 ? ['🥇', '🥈', '🥉'][item.rank - 1] : item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {item.source}
                    </td>
                    <td className="px-4 py-4 text-center text-slate-600">
                      {item.sample_count}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getScoreBadgeClass(item.temp_accuracy)}`}>
                        {formatScore(item.temp_accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getScoreBadgeClass(item.precip_accuracy)}`}>
                        {formatScore(item.precip_accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getScoreBadgeClass(item.wind_accuracy)}`}>
                        {formatScore(item.wind_accuracy)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-4 py-1.5 rounded-full text-sm font-bold ${getScoreBadgeClass(item.composite_score)}`}>
                        {formatScore(item.composite_score)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rankingData?.filters && (
        <div className="mt-4 text-xs text-slate-400 flex flex-wrap gap-3">
          <span>筛选条件：</span>
          {rankingData.filters.month && <span>月份：{rankingData.filters.month}</span>}
          {rankingData.filters.season && <span>季节：{rankingData.filters.season}</span>}
          {rankingData.filters.weather_type && <span>天气：{rankingData.filters.weather_type}</span>}
        </div>
      )}
    </div>
  );
}
