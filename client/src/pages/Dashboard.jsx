import { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import dayjs from 'dayjs';
import api from '../api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartColors = [
  { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
  { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.1)' },
  { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' },
  { border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.1)' },
  { border: 'rgb(249, 115, 22)', bg: 'rgba(249, 115, 22, 0.1)' },
  { border: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.1)' },
];

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [startDate, setStartDate] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [overview, setOverview] = useState({
    device_count: 0,
    observation_count: 0,
    forecast_count: 0,
    event_count: 0,
  });
  const [dashboardData, setDashboardData] = useState({
    daily_data: [],
    events: [],
    source_stats: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.devices.list().then(data => {
      setDevices(data);
      if (data.length > 0 && !selectedDevice) {
        setSelectedDevice(String(data[0].id));
      }
    });
  }, []);

  useEffect(() => {
    api.stats.overview(selectedDevice ? { device_id: selectedDevice } : {}).then(data => {
      setOverview(data);
    });
  }, [selectedDevice]);

  useEffect(() => {
    if (!selectedDevice) return;
    setLoading(true);
    api.stats
      .dashboard({
        device_id: selectedDevice,
        start_date: startDate,
        end_date: endDate,
      })
      .then(data => {
        setDashboardData(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedDevice, startDate, endDate]);

  const sourceNames = useMemo(() => {
    const names = new Set();
    dashboardData.daily_data.forEach(d => {
      Object.keys(d.sources || {}).forEach(s => names.add(s));
    });
    return Array.from(names);
  }, [dashboardData.daily_data]);

  const temperatureChartData = useMemo(() => {
    const labels = dashboardData.daily_data.map(d => d.date.slice(5));
    const datasets = [
      {
        label: '实测最高温',
        data: dashboardData.daily_data.map(d => d.temp_max),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderDash: [5, 5],
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: '实测最低温',
        data: dashboardData.daily_data.map(d => d.temp_min),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderDash: [5, 5],
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: '实测平均温',
        data: dashboardData.daily_data.map(d => d.temp_avg),
        borderColor: 'rgb(107, 114, 128)',
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
        fill: false,
      },
    ];
    sourceNames.forEach((name, idx) => {
      const color = chartColors[idx % chartColors.length];
      datasets.push({
        label: `${name} - 最高`,
        data: dashboardData.daily_data.map(d => d.sources?.[name]?.temp_high ?? null),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 2,
      });
      datasets.push({
        label: `${name} - 最低`,
        data: dashboardData.daily_data.map(d => d.sources?.[name]?.temp_low ?? null),
        borderColor: color.border,
        backgroundColor: color.bg,
        borderWidth: 1.5,
        borderDash: [2, 2],
        tension: 0.3,
        pointRadius: 2,
      });
    });
    return { labels, datasets };
  }, [dashboardData.daily_data, sourceNames]);

  const precipChartData = useMemo(() => {
    const acc = dashboardData.source_stats.reduce((s, r) => s + (r.precip_accuracy || 0), 0);
    const avg = dashboardData.source_stats.length > 0 ? acc / dashboardData.source_stats.length : 0;
    return {
      labels: ['准确率', '误差率'],
      datasets: [
        {
          data: [avg, 100 - avg],
          backgroundColor: ['rgb(34, 197, 94)', 'rgb(229, 231, 235)'],
          borderWidth: 0,
          cutout: '65%',
        },
      ],
    };
  }, [dashboardData.source_stats]);

  const windChartData = useMemo(() => {
    return {
      labels: dashboardData.source_stats.map(s => s.source_name),
      datasets: [
        {
          label: '风速偏差 (m/s)',
          data: dashboardData.source_stats.map(s => s.avg_wind_bias || 0),
          backgroundColor: dashboardData.source_stats.map((_, i) => chartColors[i % chartColors.length].border),
          borderRadius: 6,
        },
      ],
    };
  }, [dashboardData.source_stats]);

  const monthlyTrendData = useMemo(() => {
    const monthMap = {};
    dashboardData.daily_data.forEach(d => {
      const month = d.date.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { total: 0, hit: 0 };
      const sources = Object.values(d.sources || {});
      if (sources.length === 0) return;
      monthMap[month].total += sources.length;
      sources.forEach(s => {
        const obsPrecip = d.precip || 0;
        const fPrecip = s.precip || 0;
        const hit =
          ((fPrecip > 0.5 || (s.precip_prob ?? 0) > 50) && obsPrecip > 0.5) ||
          ((fPrecip <= 0.5 && (s.precip_prob ?? 0) <= 50) && obsPrecip <= 0.5);
        if (hit) monthMap[month].hit += 1;
      });
    });
    const labels = Object.keys(monthMap).sort();
    return {
      labels,
      datasets: [
        {
          label: '月准确率 (%)',
          data: labels.map(m =>
            monthMap[m].total > 0 ? Math.round((monthMap[m].hit / monthMap[m].total) * 1000) / 10 : 0
          ),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
        },
      ],
    };
  }, [dashboardData.daily_data]);

  const statCards = [
    { label: '设备总数', value: overview.device_count, icon: '📡', color: 'from-blue-500 to-blue-600' },
    { label: '观测记录', value: overview.observation_count.toLocaleString(), icon: '📝', color: 'from-emerald-500 to-emerald-600' },
    { label: '预报数量', value: overview.forecast_count.toLocaleString(), icon: '🌤️', color: 'from-amber-500 to-amber-600' },
    { label: '极端事件', value: overview.event_count, icon: '⛈️', color: 'from-rose-500 to-rose-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">数据看板</h1>
          <p className="text-sm text-slate-500 mt-1">实时监控设备数据与预报准确率</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${card.color} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">{card.label}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
              </div>
              <span className="text-4xl opacity-80">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">选择设备</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              <option value="">-- 请选择设备 --</option>
              {devices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.model} - {d.location}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-3">数据加载中...</p>
        </div>
      )}

      {!loading && selectedDevice && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span>🌡️</span>温度实测与预报对比
            </h2>
            <div className="h-80">
              <Line
                data={temperatureChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { intersect: false, mode: 'index' },
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 12 },
                  },
                  scales: {
                    y: { title: { display: true, text: '温度 (°C)' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span>🌧️</span>降水预报准确率
              </h2>
              <div className="h-72 flex items-center justify-center">
                <Doughnut
                  data={precipChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { padding: 20 } },
                      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 12 },
                    },
                  }}
                />
              </div>
              <div className="text-center mt-2">
                <span className="text-3xl font-bold text-emerald-600">
                  {precipChartData.datasets[0].data[0].toFixed(1)}%
                </span>
                <p className="text-sm text-slate-500 mt-1">平均准确率</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span>💨</span>风速偏差对比
              </h2>
              <div className="h-80">
                <Bar
                  data={windChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 12 },
                    },
                    scales: {
                      y: { beginAtZero: true, title: { display: true, text: '偏差 (m/s)' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                      x: { grid: { display: false } },
                    },
                  }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span>📈</span>各月准确率趋势
            </h2>
            <div className="h-72">
              <Line
                data={monthlyTrendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 12 },
                  },
                  scales: {
                    y: { min: 0, max: 100, title: { display: true, text: '准确率 (%)' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!loading && !selectedDevice && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200">
          <span className="text-5xl">📡</span>
          <p className="mt-4 text-slate-600 text-lg">请先选择一个设备查看数据看板</p>
        </div>
      )}
    </div>
  );
}
