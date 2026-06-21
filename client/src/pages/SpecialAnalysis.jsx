import { useState, useEffect } from 'react';
import api from '../api.js';

export default function SpecialAnalysis() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('weather');

  const weatherIcons = {
    '晴天': '☀️',
    '雨天': '🌧️',
    '大风': '💨',
    '高温': '🔥',
    '低温': '❄️',
    '暴雨': '⛈️',
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadAnalysis();
    }
  }, [selectedDevice]);

  async function loadInitial() {
    const devs = await api.devices.list();
    setDevices(devs);
    if (devs.length > 0) setSelectedDevice(devs[0].id);
  }

  async function loadAnalysis() {
    setLoading(true);
    try {
      const data = await api.forecasts.specialAnalysis({ device_id: selectedDevice });
      setAnalysisData(data);
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

  const getScoreColor = (val) => {
    if (val == null || isNaN(val)) return 'text-slate-400';
    const v = Number(val);
    if (v >= 80) return 'text-green-600';
    if (v >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (val) => {
    if (val == null || isNaN(val)) return 'bg-slate-100';
    const v = Number(val);
    if (v >= 80) return 'bg-green-50';
    if (v >= 60) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const tabs = [
    { key: 'weather', label: '天气条件分析', icon: '🌤️' },
    { key: 'events', label: '极端事件分析', icon: '⛈️' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>📊</span>预报表现专项分析
        </h1>
        <p className="text-sm text-slate-500 mt-1">不同天气条件下的预报表现深度分析</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
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
          <button
            onClick={loadAnalysis}
            disabled={loading || !selectedDevice}
            className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center gap-2"
          >
            {loading ? (
              <><span className="animate-spin">⏳</span> 加载中...</>
            ) : (
              <><span>🔄</span> 刷新分析</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-500">加载中...</div>
          ) : !analysisData ? (
            <div className="py-16 text-center text-slate-400">
              <div className="text-5xl mb-3">📊</div>
              <p>请选择设备以查看专项分析</p>
            </div>
          ) : activeTab === 'weather' ? (
            <div className="space-y-6">
              {Object.entries(analysisData.weather_conditions || {}).map(([weather, data]) => (
                <div key={weather} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{weatherIcons[weather] || '🌡️'}</span>
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg">{weather}天气</h3>
                          <p className="text-sm text-slate-500">样本数：{data.sample_count} 天</p>
                        </div>
                      </div>
                      {data.sources.length > 0 && (
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-1">表现最佳</div>
                          <div className="font-bold text-primary-600">{data.sources[0].source}</div>
                          <div className={`text-sm font-semibold ${getScoreColor(data.sources[0].composite_score)}`}>
                            {formatScore(data.sources[0].composite_score)} 分
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {data.sources.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      暂无该天气条件下的预报数据
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-5 py-3 font-semibold text-slate-600">预报来源</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">样本数</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">🌡️ 温度准确率</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">💧 降水准确率</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">💨 风速准确率</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">⭐ 综合评分</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.sources.map((src, idx) => (
                            <tr key={idx} className={`hover:bg-slate-50 ${idx === 0 ? 'bg-yellow-50/50' : ''}`}>
                              <td className="px-5 py-3 font-medium text-slate-800">
                                {idx === 0 && <span className="mr-2">🥇</span>}
                                {src.source}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">{src.sample_count}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${getScoreBg(src.temp_accuracy)} ${getScoreColor(src.temp_accuracy)}`}>
                                  {formatScore(src.temp_accuracy)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${getScoreBg(src.precip_accuracy)} ${getScoreColor(src.precip_accuracy)}`}>
                                  {formatScore(src.precip_accuracy)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${getScoreBg(src.wind_accuracy)} ${getScoreColor(src.wind_accuracy)}`}>
                                  {formatScore(src.wind_accuracy)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-3 py-1 rounded text-sm font-bold ${getScoreBg(src.composite_score)} ${getScoreColor(src.composite_score)}`}>
                                  {formatScore(src.composite_score)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {analysisData.extreme_events?.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="text-5xl mb-3">⛈️</div>
                  <p>暂无极端事件期间的预报数据</p>
                </div>
              ) : (
                analysisData.extreme_events?.map((event, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 border-b border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">⚠️</span>
                          <div>
                            <h3 className="font-bold text-slate-800 text-lg">{event.event_type}</h3>
                            <p className="text-sm text-slate-500">
                              {event.start_time} ~ {event.end_time} · 样本数：{event.sample_count} 天
                            </p>
                          </div>
                        </div>
                        {event.sources.length > 0 && (
                          <div className="text-right">
                            <div className="text-xs text-slate-500 mb-1">表现最佳</div>
                            <div className="font-bold text-primary-600">{event.sources[0].source}</div>
                            <div className={`text-sm font-semibold ${getScoreColor(event.sources[0].composite_score)}`}>
                              {formatScore(event.sources[0].composite_score)} 分
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-5 py-3 font-semibold text-slate-600">预报来源</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">样本数</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">🌡️ 温度准确率</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">💧 降水准确率</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">💨 风速准确率</th>
                            <th className="text-center px-4 py-3 font-semibold text-slate-600">⭐ 综合评分</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {event.sources.map((src, sIdx) => (
                            <tr key={sIdx} className={`hover:bg-slate-50 ${sIdx === 0 ? 'bg-yellow-50/50' : ''}`}>
                              <td className="px-5 py-3 font-medium text-slate-800">
                                {sIdx === 0 && <span className="mr-2">🥇</span>}
                                {src.source}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600">{src.sample_count}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${getScoreBg(src.temp_accuracy)} ${getScoreColor(src.temp_accuracy)}`}>
                                  {formatScore(src.temp_accuracy)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${getScoreBg(src.precip_accuracy)} ${getScoreColor(src.precip_accuracy)}`}>
                                  {formatScore(src.precip_accuracy)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${getScoreBg(src.wind_accuracy)} ${getScoreColor(src.wind_accuracy)}`}>
                                  {formatScore(src.wind_accuracy)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-3 py-1 rounded text-sm font-bold ${getScoreBg(src.composite_score)} ${getScoreColor(src.composite_score)}`}>
                                  {formatScore(src.composite_score)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
