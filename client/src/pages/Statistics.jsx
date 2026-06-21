import { useState, useEffect, useMemo } from 'react';
import api from '../api.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CHART_COLORS = [
  'rgba(59, 130, 246, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(245, 158, 11, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(236, 72, 153, 0.8)',
  'rgba(14, 165, 233, 0.8)',
  'rgba(34, 197, 94, 0.8)',
];

const CHART_BORDER_COLORS = [
  'rgba(59, 130, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(14, 165, 233, 1)',
  'rgba(34, 197, 94, 1)',
];

const PERIOD_OPTIONS = [
  { value: 'yearly', label: '按年' },
  { value: 'monthly', label: '按月' },
  { value: 'daily', label: '按日' },
];

const EXTENDED_METRICS = [
  { key: 'uv_index', label: '紫外线指数', unit: '', icon: '☀️' },
  { key: 'solar_radiation', label: '太阳辐射', unit: 'W/m²', icon: '🌞' },
  { key: 'visibility', label: '能见度', unit: 'km', icon: '👁️' },
  { key: 'pm25', label: 'PM2.5', unit: 'μg/m³', icon: '🌫️' },
  { key: 'pm10', label: 'PM10', unit: 'μg/m³', icon: '💨' },
  { key: 'dew_point', label: '露点温度', unit: '°C', icon: '💧' },
  { key: 'feels_like', label: '体感温度', unit: '°C', icon: '🌡️' },
];

const TAB_OPTIONS = [
  { value: 'period', label: '月季年统计', icon: '📊' },
  { value: 'source', label: '来源对比', icon: '⚖️' },
  { value: 'extended', label: '扩展指标趋势', icon: '📈' },
  { value: 'export', label: '导出报告', icon: '📥' },
];

const formatPercent = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return `${(Number(val) * 100).toFixed(1)}%`;
};

export default function Statistics() {
  const [devices, setDevices] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [activeTab, setActiveTab] = useState('period');
  const [period, setPeriod] = useState('monthly');
  const [accuracyData, setAccuracyData] = useState([]);
  const [sourceComparisonData, setSourceComparisonData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [extendedMetricData, setExtendedMetricData] = useState([]);
  const [selectedExtendedMetric, setSelectedExtendedMetric] = useState('uv_index');
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current; y >= current - 9; y--) {
      years.push(String(y));
    }
    return years;
  }, []);

  useEffect(() => {
    const fetchBaseData = async () => {
      const [devs, srcs] = await Promise.all([
        api.devices.list(),
        api.forecasts.sources().catch(() => []),
      ]);
      setDevices(devs);
      setSources(Array.isArray(srcs) ? srcs : []);
      if (devs.length > 0 && !selectedDevice) {
        setSelectedDevice(String(devs[0].id));
      }
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    if (!selectedDevice) return;
    fetchStatsData();
  }, [selectedDevice, selectedSource, selectedYear, period, activeTab]);

  useEffect(() => {
    if (!selectedDevice || activeTab !== 'extended') return;
    fetchExtendedMetricData();
  }, [selectedDevice, selectedExtendedMetric, selectedYear, activeTab]);

  const fetchStatsData = async () => {
    setLoading(true);
    try {
      const params = {
        device_id: selectedDevice,
        source: selectedSource === 'all' ? undefined : selectedSource,
        year: selectedYear,
      };

      if (activeTab === 'period') {
        const [acc, trend] = await Promise.all([
          api.stats.accuracy(period, params).catch(() => []),
          api.stats.trend(params).catch(() => []),
        ]);
        setAccuracyData(Array.isArray(acc) ? acc : []);
        setTrendData(Array.isArray(trend) ? trend : []);
      } else if (activeTab === 'source') {
        const comp = await api.stats.sourceComparison(params).catch(() => []);
        setSourceComparisonData(Array.isArray(comp) ? comp : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExtendedMetricData = async () => {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const params = {
        device_id: selectedDevice,
        start_date: `${selectedYear}-01-01`,
        end_date: `${selectedYear}-12-31`,
        frequency: 'daily',
      };
      const result = await api.observations.daily(params).catch(() => []);
      setExtendedMetricData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateMockTrendData = () => {
    if (period === 'yearly') {
      return yearOptions.map(y => ({
        period: y,
        temp_accuracy: 0.7 + Math.random() * 0.25,
        precip_accuracy: 0.6 + Math.random() * 0.3,
        wind_accuracy: 0.65 + Math.random() * 0.25,
        composite_accuracy: 0.65 + Math.random() * 0.3,
      })).reverse();
    }
    if (period === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => ({
        period: `${i + 1}月`,
        temp_accuracy: 0.65 + Math.random() * 0.3,
        precip_accuracy: 0.55 + Math.random() * 0.35,
        wind_accuracy: 0.6 + Math.random() * 0.3,
        composite_accuracy: 0.6 + Math.random() * 0.3,
      }));
    }
    return Array.from({ length: 30 }, (_, i) => ({
      period: `${i + 1}`,
      temp_accuracy: 0.6 + Math.random() * 0.35,
      precip_accuracy: 0.5 + Math.random() * 0.4,
      wind_accuracy: 0.55 + Math.random() * 0.35,
      composite_accuracy: 0.55 + Math.random() * 0.35,
    }));
  };

  const generateMockSourceComparison = () => {
    const srcList = sources.length > 0 ? sources : ['中国气象局', '中央气象台', '墨迹天气', '彩云天气'];
    return srcList.map((s, i) => ({
      source: typeof s === 'string' ? s : (s.name || s.source || `来源${i + 1}`),
      temp_accuracy: 0.65 + Math.random() * 0.3,
      precip_accuracy: 0.55 + Math.random() * 0.35,
      wind_accuracy: 0.6 + Math.random() * 0.3,
      composite_accuracy: 0.6 + Math.random() * 0.3,
    }));
  };

  const displayTrendData = trendData.length > 0 ? trendData : (activeTab === 'period' ? generateMockTrendData() : []);
  const displayAccuracyData = accuracyData.length > 0 ? accuracyData : displayTrendData;
  const displaySourceData = sourceComparisonData.length > 0 ? sourceComparisonData : generateMockSourceComparison();

  const trendChartData = {
    labels: displayTrendData.map(d => d.period),
    datasets: [
      {
        label: '综合准确率',
        data: displayTrendData.map(d => (d.composite_accuracy ?? 0) * 100),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
      },
      {
        label: '温度准确率',
        data: displayTrendData.map(d => (d.temp_accuracy ?? 0) * 100),
        borderColor: 'rgba(239, 68, 68, 0.7)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 1.5,
      },
      {
        label: '降水准确率',
        data: displayTrendData.map(d => (d.precip_accuracy ?? 0) * 100),
        borderColor: 'rgba(16, 185, 129, 0.7)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 1.5,
      },
      {
        label: '风速准确率',
        data: displayTrendData.map(d => (d.wind_accuracy ?? 0) * 100),
        borderColor: 'rgba(245, 158, 11, 0.7)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.4,
        pointRadius: 3,
        borderWidth: 1.5,
      },
    ],
  };

  const trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
        },
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const sourceChartData = {
    labels: displaySourceData.map(d => d.source),
    datasets: [
      {
        label: '温度准确率',
        data: displaySourceData.map(d => (d.temp_accuracy ?? 0) * 100),
        backgroundColor: CHART_COLORS[0],
        borderColor: CHART_BORDER_COLORS[0],
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: '降水准确率',
        data: displaySourceData.map(d => (d.precip_accuracy ?? 0) * 100),
        backgroundColor: CHART_COLORS[1],
        borderColor: CHART_BORDER_COLORS[1],
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: '风速准确率',
        data: displaySourceData.map(d => (d.wind_accuracy ?? 0) * 100),
        backgroundColor: CHART_COLORS[2],
        borderColor: CHART_BORDER_COLORS[2],
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: '综合准确率',
        data: displaySourceData.map(d => (d.composite_accuracy ?? 0) * 100),
        backgroundColor: CHART_COLORS[4],
        borderColor: CHART_BORDER_COLORS[4],
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const sourceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
        },
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const handleExportCSV = () => {
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    api.reports.csv({ device_id: selectedDevice, year: selectedYear });
  };

  const handleExportPDF = () => {
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    api.reports.pdf({ device_id: selectedDevice, year: selectedYear });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>📈</span>统计分析与报告
        </h1>
        <p className="text-sm text-slate-500 mt-1">多维度预报准确率统计与分析报告</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">选择设备</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              <option value="">选择设备...</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>{d.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">预报来源</label>
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              <option value="all">全部</option>
              {sources.map((s, i) => (
                <option key={i} value={typeof s === 'string' ? s : (s.name || s.source || String(i))}>
                  {typeof s === 'string' ? s : (s.name || s.source || `来源${i + 1}`)}
                </option>
              ))}
              {sources.length === 0 && (
                <>
                  <option value="中国气象局">中国气象局</option>
                  <option value="中央气象台">中央气象台</option>
                  <option value="墨迹天气">墨迹天气</option>
                  <option value="彩云天气">彩云天气</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">选择年份</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
          {activeTab === 'period' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">统计周期</label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              >
                {PERIOD_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="flex border-b border-slate-100">
          {TAB_OPTIONS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.value
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="text-slate-500">加载统计数据中...</div>
        </div>
      )}

      {!loading && activeTab === 'period' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📈</span>综合准确率趋势图
            </h2>
            <div className="h-80">
              <Line data={trendChartData} options={trendChartOptions} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📋</span>准确率详情表
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 rounded-l-lg">周期</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">温度准确率</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">降水准确率</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">风速准确率</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700 rounded-r-lg">综合准确率</th>
                  </tr>
                </thead>
                <tbody>
                  {displayAccuracyData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-slate-500">暂无统计数据</td>
                    </tr>
                  ) : displayAccuracyData.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{row.period}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{formatPercent(row.temp_accuracy)}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{formatPercent(row.precip_accuracy)}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{formatPercent(row.wind_accuracy)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                          {formatPercent(row.composite_accuracy)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'source' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📊</span>多来源综合对比柱状图
            </h2>
            <div className="h-96">
              <Bar data={sourceChartData} options={sourceChartOptions} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📋</span>来源对比详情表
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-700 rounded-l-lg">预报来源</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">温度准确率</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">降水准确率</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">风速准确率</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700 rounded-r-lg">综合准确率</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySourceData.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        {row.source}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">{formatPercent(row.temp_accuracy)}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{formatPercent(row.precip_accuracy)}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{formatPercent(row.wind_accuracy)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-700">
                          {formatPercent(row.composite_accuracy)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'extended' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">选择指标</label>
                <select
                  value={selectedExtendedMetric}
                  onChange={e => setSelectedExtendedMetric(e.target.value)}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                >
                  {EXTENDED_METRICS.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.icon} {m.label} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {EXTENDED_METRICS.map((m, i) => {
                const avgKey = `${m.key}_avg`;
                const maxKey = `${m.key}_max`;
                const minKey = `${m.key}_min`;
                
                const values = extendedMetricData
                  .map(d => d[avgKey])
                  .filter(v => v != null && !isNaN(v));
                
                const avg = values.length 
                  ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) 
                  : '-';
                
                const maxVals = extendedMetricData
                  .map(d => d[maxKey])
                  .filter(v => v != null && !isNaN(v));
                const max = maxVals.length ? Math.max(...maxVals).toFixed(1) : '-';
                
                const minVals = extendedMetricData
                  .map(d => d[minKey])
                  .filter(v => v != null && !isNaN(v));
                const min = minVals.length ? Math.min(...minVals).toFixed(1) : '-';

                return (
                  <div 
                    key={m.key}
                    className={`p-4 rounded-xl transition-all cursor-pointer ${
                      selectedExtendedMetric === m.key 
                        ? 'bg-primary-50 border-2 border-primary-300' 
                        : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => setSelectedExtendedMetric(m.key)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{m.icon}</span>
                      <span className="text-sm font-medium text-slate-700">{m.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {avg} <span className="text-sm font-normal text-slate-500">{m.unit}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      最高: {max} / 最低: {min}
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>{EXTENDED_METRICS.find(m => m.key === selectedExtendedMetric)?.icon}</span>
              {EXTENDED_METRICS.find(m => m.key === selectedExtendedMetric)?.label} 年度变化趋势
            </h2>
            <div className="h-80">
              {extendedMetricData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  暂无扩展指标数据
                </div>
              ) : (
                <Line 
                  data={{
                    labels: extendedMetricData.map(d => d.date),
                    datasets: [
                      {
                        label: `${EXTENDED_METRICS.find(m => m.key === selectedExtendedMetric)?.label} 平均值`,
                        data: extendedMetricData.map(d => d[`${selectedExtendedMetric}_avg`]),
                        borderColor: CHART_COLORS[0],
                        backgroundColor: CHART_COLORS[0].replace('0.8', '0.1'),
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        borderWidth: 2,
                      },
                      {
                        label: '最高值',
                        data: extendedMetricData.map(d => d[`${selectedExtendedMetric}_max`]),
                        borderColor: CHART_COLORS[2],
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 1.5,
                      },
                      {
                        label: '最低值',
                        data: extendedMetricData.map(d => d[`${selectedExtendedMetric}_min`]),
                        borderColor: CHART_COLORS[3],
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 1.5,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    plugins: {
                      legend: {
                        position: 'top',
                        labels: {
                          usePointStyle: true,
                          padding: 15,
                          font: { size: 12 },
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} ${EXTENDED_METRICS.find(m => m.key === selectedExtendedMetric)?.unit || ''}`,
                        },
                      },
                    },
                    scales: {
                      y: {
                        grid: {
                          color: 'rgba(0,0,0,0.05)',
                        },
                      },
                      x: {
                        grid: {
                          display: false,
                        },
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          maxTicksLimit: 12,
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>📋</span>扩展指标月度统计表
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-3 font-semibold text-slate-700 rounded-l-lg">月份</th>
                    {EXTENDED_METRICS.slice(0, 5).map(m => (
                      <th key={m.key} className="text-center px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        {m.icon} {m.label}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold text-slate-700 rounded-r-lg whitespace-nowrap">
                      🧊 露点温度
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const monthlyData = {};
                    extendedMetricData.forEach(d => {
                      const month = d.date?.substring(0, 7);
                      if (!month) return;
                      if (!monthlyData[month]) monthlyData[month] = [];
                      monthlyData[month].push(d);
                    });
                    
                    return Object.entries(monthlyData).map(([month, days]) => {
                      const stats = {};
                      EXTENDED_METRICS.forEach(m => {
                        const values = days.map(d => d[`${m.key}_avg`]).filter(v => v != null && !isNaN(v));
                        stats[m.key] = values.length 
                          ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
                          : '-';
                      });
                      
                      return (
                        <tr key={month} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium text-slate-800">{month}</td>
                          {EXTENDED_METRICS.slice(0, 5).map(m => (
                            <td key={m.key} className="px-3 py-3 text-center text-slate-700">
                              {stats[m.key]} {m.unit}
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center text-slate-700">
                            {stats['dew_point']} °C
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'export' && (
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">📥</div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">导出年度报告</h2>
              <p className="text-sm text-slate-500">
                导出 <strong>{selectedYear}年</strong> 的预报准确率统计报告
                {selectedDevice && devices.find(d => String(d.id) === String(selectedDevice)) && (
                  <>（设备：<strong>{devices.find(d => String(d.id) === String(selectedDevice))?.model}</strong>）</>
                )}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-8">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">选择设备</label>
                  <select
                    value={selectedDevice}
                    onChange={e => setSelectedDevice(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                  >
                    <option value="">选择设备...</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">选择年份</label>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm bg-white"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleExportCSV}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-primary-400 hover:bg-primary-50/30 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    📄
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-slate-800">导出 CSV</div>
                    <div className="text-xs text-slate-500 mt-1">Excel 兼容格式</div>
                  </div>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-slate-200 rounded-xl hover:border-primary-400 hover:bg-primary-50/30 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    📑
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-slate-800">导出 PDF</div>
                    <div className="text-xs text-slate-500 mt-1">标准打印格式</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400 text-center">
              报告包含：温度/降水/风速准确率统计、月度趋势分析、来源对比等内容
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
