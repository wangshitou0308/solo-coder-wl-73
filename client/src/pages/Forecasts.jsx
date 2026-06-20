import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import api from '../api.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
);

export default function Forecasts() {
  const [devices, setDevices] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [startDate, setStartDate] = useState(dayjs().subtract(180, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [activeTab, setActiveTab] = useState('comparison');

  const [forecastList, setForecastList] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [forecastForm, setForecastForm] = useState({
    source_id: '',
    forecast_date: dayjs().format('YYYY-MM-DD'),
    target_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    forecast_range: '1d',
    temp_high: '',
    temp_low: '',
    precipitation_prob: '',
    precipitation_amount: '',
    wind_speed: '',
    wind_direction: '',
    weather_condition: '',
  });

  const [simulateForm, setSimulateForm] = useState({
    source_id: '',
    start_date: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    end_date: dayjs().format('YYYY-MM-DD'),
  });

  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedDevice && activeTab === 'comparison') {
      loadComparison();
    }
    if (activeTab === 'list') {
      loadForecasts();
    }
  }, [selectedDevice, selectedSource, startDate, endDate, activeTab]);

  async function loadInitial() {
    try {
      const [devs, srcs] = await Promise.all([
        api.devices.list(),
        api.forecasts.sources(),
      ]);
      setDevices(devs);
      setSources(srcs);
      if (devs.length > 0) setSelectedDevice(devs[0].id);
      if (srcs.length > 0) {
        setSelectedSource(srcs[0].id);
        setForecastForm(f => ({ ...f, source_id: srcs[0].id }));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadForecasts() {
    setLoading(true);
    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
      };
      if (selectedSource && !isNaN(Number(selectedSource))) {
        params.source_id = selectedSource;
      }
      const list = await api.forecasts.list(params);
      setForecastList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadComparison() {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const params = {
        device_id: selectedDevice,
        start_date: startDate,
        end_date: endDate,
      };
      if (selectedSource) params.source_id = selectedSource;
      const data = await api.forecasts.comparison(params);
      setComparisonData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function resetForecastForm() {
    setForecastForm({
      source_id: sources[0]?.id || '',
      forecast_date: dayjs().format('YYYY-MM-DD'),
      target_date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      forecast_range: '1d',
      temp_high: '',
      temp_low: '',
      precipitation_prob: '',
      precipitation_amount: '',
      wind_speed: '',
      wind_direction: '',
      weather_condition: '',
    });
  }

  async function handleForecastSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        source_id: forecastForm.source_id,
        forecast_date: forecastForm.forecast_date,
        target_date: forecastForm.target_date,
        forecast_range: forecastForm.forecast_range,
        temp_high: forecastForm.temp_high !== '' ? parseFloat(forecastForm.temp_high) : null,
        temp_low: forecastForm.temp_low !== '' ? parseFloat(forecastForm.temp_low) : null,
        precipitation_prob: forecastForm.precipitation_prob !== '' ? parseFloat(forecastForm.precipitation_prob) : null,
        precipitation_amount: forecastForm.precipitation_amount !== '' ? parseFloat(forecastForm.precipitation_amount) : null,
        wind_speed: forecastForm.wind_speed !== '' ? parseFloat(forecastForm.wind_speed) : null,
        wind_direction: forecastForm.wind_direction !== '' ? parseInt(forecastForm.wind_direction) : null,
        weather_condition: forecastForm.weather_condition || null,
      };
      await api.forecasts.create(payload);
      alert('预报录入成功');
      resetForecastForm();
      loadComparison();
      if (activeTab === 'list') loadForecasts();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSimulate() {
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    setSimulating(true);
    try {
      const payload = {
        source_id: simulateForm.source_id || null,
        start_date: simulateForm.start_date,
        end_date: simulateForm.end_date,
        device_id: selectedDevice,
      };
      const result = await api.forecasts.simulate(payload);
      alert(`模拟完成，生成 ${result.inserted} 条预报，覆盖 ${result.dates_covered} 天`);
      loadComparison();
      if (activeTab === 'list') loadForecasts();
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  }

  async function handleDeleteForecast(id) {
    if (!confirm('确定要删除这条预报吗？')) return;
    try {
      await api.forecasts.remove(id);
      loadForecasts();
    } catch (e) {
      console.error(e);
    }
  }

  const tabs = [
    { key: 'entry', label: '录入预报', icon: '📝' },
    { key: 'simulate', label: '模拟预报', icon: '🤖' },
    { key: 'comparison', label: '对比验证', icon: '📊' },
    { key: 'list', label: '预报列表', icon: '📋' },
  ];

  const tempBiasChartData = buildTempBiasChart(comparisonData);
  const precipChartData = buildPrecipChart(comparisonData);

  const stats = buildStats(comparisonData);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-3xl">🌤️</span>
          预报验证
        </h1>
        <p className="text-slate-500 mt-1">录入、模拟和对比验证天气预报数据</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">预报来源</label>
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              <option value="">全部来源</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 flex-wrap">
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
          {activeTab === 'entry' && (
            <div className="max-w-3xl">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">录入预报数据</h3>
              <form onSubmit={handleForecastSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      预报来源 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={forecastForm.source_id}
                      onChange={e => setForecastForm({ ...forecastForm, source_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    >
                      <option value="">请选择来源</option>
                      {sources.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">预报范围</label>
                    <select
                      value={forecastForm.forecast_range}
                      onChange={e => setForecastForm({ ...forecastForm, forecast_range: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    >
                      <option value="1d">1天预报</option>
                      <option value="3d">3天预报</option>
                      <option value="7d">7天预报</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      预报日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={forecastForm.forecast_date}
                      onChange={e => setForecastForm({ ...forecastForm, forecast_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      目标日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={forecastForm.target_date}
                      onChange={e => setForecastForm({ ...forecastForm, target_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">预报最高温 (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={forecastForm.temp_high}
                      onChange={e => setForecastForm({ ...forecastForm, temp_high: e.target.value })}
                      placeholder="例如：28"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">预报最低温 (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={forecastForm.temp_low}
                      onChange={e => setForecastForm({ ...forecastForm, temp_low: e.target.value })}
                      placeholder="例如：18"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">降水概率 (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={forecastForm.precipitation_prob}
                      onChange={e => setForecastForm({ ...forecastForm, precipitation_prob: e.target.value })}
                      placeholder="0-100"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">降水量 (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={forecastForm.precipitation_amount}
                      onChange={e => setForecastForm({ ...forecastForm, precipitation_amount: e.target.value })}
                      placeholder="例如：5.0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">风速 (m/s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={forecastForm.wind_speed}
                      onChange={e => setForecastForm({ ...forecastForm, wind_speed: e.target.value })}
                      placeholder="例如：4.0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">风向 (°)</label>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={forecastForm.wind_direction}
                      onChange={e => setForecastForm({ ...forecastForm, wind_direction: e.target.value })}
                      placeholder="0-360"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">天气状况</label>
                    <input
                      type="text"
                      value={forecastForm.weather_condition}
                      onChange={e => setForecastForm({ ...forecastForm, weather_condition: e.target.value })}
                      placeholder="晴/多云/阴/小雨/中雨/大雨/雪 等"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium shadow-sm"
                  >
                    提交预报
                  </button>
                  <button
                    type="button"
                    onClick={resetForecastForm}
                    className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    重置表单
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'simulate' && (
            <div className="max-w-2xl">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <span>ℹ️</span> 模拟预报说明
                </h4>
                <p className="text-sm text-blue-700">
                  基于选定设备的实际观测数据（日汇总），为指定预报来源生成带有随机偏差的模拟预报数据。
                  可用于测试预报验证功能。
                </p>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mb-4">生成模拟预报</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">预报来源（可选，留空则全部来源）</label>
                  <select
                    value={simulateForm.source_id}
                    onChange={e => setSimulateForm({ ...simulateForm, source_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  >
                    <option value="">全部来源</option>
                    {sources.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      开始日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={simulateForm.start_date}
                      onChange={e => setSimulateForm({ ...simulateForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      结束日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={simulateForm.end_date}
                      onChange={e => setSimulateForm({ ...simulateForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">当前选择的设备</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                    {devices.find(d => String(d.id) === String(selectedDevice))?.model || '未选择（请在上方筛选区选择）'}
                  </div>
                </div>
                <button
                  onClick={handleSimulate}
                  disabled={simulating || !selectedDevice}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {simulating ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span> 生成中...
                    </>
                  ) : (
                    <>
                      <span>🤖</span> 生成模拟预报
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="space-y-6">
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="预报总数" value={stats.total} color="primary" />
                  <StatCard label="降水预测正确率" value={`${stats.precipAccuracy}%`} color="green" />
                  <StatCard label="平均温度偏差" value={stats.avgTempBias + '°C'} color="orange" />
                  <StatCard label="平均风速偏差" value={stats.avgWindBias + 'm/s'} color="purple" />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span>📊</span> 温度偏差分布 (°C)
                  </h4>
                  <div className="h-64">
                    {tempBiasChartData ? (
                      <Bar data={tempBiasChartData} options={barOptions} />
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span>🥧</span> 降水预测正确/错误分布
                  </h4>
                  <div className="h-64">
                    {precipChartData ? (
                      <Pie data={precipChartData} options={pieOptions} />
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">
                    对比验证表格
                    <span className="text-sm font-normal text-slate-500 ml-2">（共 {comparisonData.length} 条）</span>
                  </h3>
                  <button
                    onClick={loadComparison}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition flex items-center gap-2"
                  >
                    <span>🔄</span> 刷新
                  </button>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-slate-500">加载中...</div>
                ) : comparisonData.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <div className="text-5xl mb-3">📭</div>
                    <p>暂无对比数据，请先录入或生成预报</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-3 font-medium text-slate-600">日期</th>
                          <th className="text-left px-3 py-3 font-medium text-slate-600">来源</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">预报高温</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">实际高温</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">高温偏差</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">预报低温</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">实际低温</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">低温偏差</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">预报降水</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">实际降水</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">降水判断</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">预报风速</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">实际风速</th>
                          <th className="text-center px-3 py-3 font-medium text-slate-600">风速偏差</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparisonData.map(row => (
                          <tr key={row.forecast_id + '-' + row.source_id} className="hover:bg-slate-50">
                            <td className="px-3 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">{row.target_date}</td>
                            <td className="px-3 py-3 text-slate-700">{row.source_name}</td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.forecast_temp_high)}</td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.actual_temp_max)}</td>
                            <td className="px-3 py-3 text-center">
                              <BiasBadge value={row.temp_high_bias} />
                            </td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.forecast_temp_low)}</td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.actual_temp_min)}</td>
                            <td className="px-3 py-3 text-center">
                              <BiasBadge value={row.temp_low_bias} />
                            </td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.forecast_precipitation)}</td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.actual_precipitation)}</td>
                            <td className="px-3 py-3 text-center">
                              {row.precip_correct === true ? (
                                <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                                  ✓ 正确
                                </span>
                              ) : row.precip_correct === false ? (
                                <span className="inline-block px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">
                                  ✗ 错误
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.forecast_wind_speed)}</td>
                            <td className="px-3 py-3 text-center text-slate-700">{fmt(row.actual_wind_speed)}</td>
                            <td className="px-3 py-3 text-center">
                              <BiasBadge value={row.wind_bias} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'list' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  预报列表
                  <span className="text-sm font-normal text-slate-500 ml-2">（共 {forecastList.length} 条）</span>
                </h3>
                <button
                  onClick={loadForecasts}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition flex items-center gap-2"
                >
                  <span>🔄</span> 刷新
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500">加载中...</div>
              ) : forecastList.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="text-5xl mb-3">📭</div>
                  <p>暂无预报数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">来源</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">预报日期</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">目标日期</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">范围</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">高温</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">低温</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">降水概率</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">降水量</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">风速</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">天气</th>
                        <th className="text-center px-4 py-3 font-medium text-slate-600">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {forecastList.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{f.source_name}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">{f.forecast_date}</td>
                          <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">{f.target_date}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                              {f.forecast_range}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-orange-600 font-medium">{fmt(f.temp_high)}</td>
                          <td className="px-4 py-3 text-center text-blue-600 font-medium">{fmt(f.temp_low)}</td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {f.precipitation_prob != null ? f.precipitation_prob + '%' : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">{fmt(f.precipitation_amount)}</td>
                          <td className="px-4 py-3 text-center text-slate-700">{fmt(f.wind_speed)}</td>
                          <td className="px-4 py-3 text-slate-700">{f.weather_condition || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteForecast(f.id)}
                              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(v) {
  if (v == null || v === undefined || v === '') return '-';
  return v;
}

function BiasBadge({ value }) {
  if (value == null || value === '' || isNaN(value)) {
    return <span className="text-slate-400">-</span>;
  }
  const abs = Math.abs(value);
  const color = abs < 1 ? 'text-green-600 bg-green-50' : abs < 3 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  const sign = value > 0 ? '+' : '';
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${color}`}>
      {sign}{value}
    </span>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = {
    primary: 'from-primary-500 to-primary-700',
    green: 'from-green-500 to-green-700',
    orange: 'from-orange-500 to-orange-700',
    purple: 'from-purple-500 to-purple-700',
  };
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${colorMap[color]} text-white shadow-sm`}>
      <div className="text-sm text-white/80 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-slate-400 flex-col">
      <div className="text-4xl mb-2">📈</div>
      <p className="text-sm">暂无数据</p>
    </div>
  );
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#e2e8f0' },
      ticks: { color: '#64748b' },
    },
    x: {
      grid: { display: false },
      ticks: { color: '#64748b' },
    },
  },
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#475569', padding: 15 } },
  },
};

function buildStats(data) {
  if (!data || data.length === 0) return null;
  const total = data.length;
  const precipValid = data.filter(d => d.precip_correct === true || d.precip_correct === false);
  const precipCorrect = precipValid.filter(d => d.precip_correct).length;
  const precipAccuracy = precipValid.length ? Math.round((precipCorrect / precipValid.length) * 100) : 0;

  const tempBiases = data.map(d => d.temp_avg_bias).filter(v => v != null && !isNaN(v));
  const avgTempBias = tempBiases.length
    ? Math.round((tempBiases.reduce((a, b) => a + b, 0) / tempBiases.length) * 10) / 10
    : 0;

  const windBiases = data.map(d => d.wind_bias).filter(v => v != null && !isNaN(v));
  const avgWindBias = windBiases.length
    ? Math.round((windBiases.reduce((a, b) => a + b, 0) / windBiases.length) * 10) / 10
    : 0;

  return { total, precipAccuracy, avgTempBias, avgWindBias };
}

function buildTempBiasChart(data) {
  if (!data || data.length === 0) return null;

  const buckets = { '<-3': 0, '-3~-1': 0, '-1~1': 0, '1~3': 0, '>3': 0 };
  for (const row of data) {
    if (row.temp_avg_bias == null || isNaN(row.temp_avg_bias)) continue;
    const v = row.temp_avg_bias;
    if (v < -3) buckets['<-3']++;
    else if (v < -1) buckets['-3~-1']++;
    else if (v < 1) buckets['-1~1']++;
    else if (v < 3) buckets['1~3']++;
    else buckets['>3']++;
  }

  return {
    labels: Object.keys(buckets),
    datasets: [{
      label: '天数',
      data: Object.values(buckets),
      backgroundColor: [
        'rgba(239, 68, 68, 0.7)',
        'rgba(249, 115, 22, 0.7)',
        'rgba(34, 197, 94, 0.7)',
        'rgba(249, 115, 22, 0.7)',
        'rgba(239, 68, 68, 0.7)',
      ],
      borderColor: [
        'rgb(239, 68, 68)',
        'rgb(249, 115, 22)',
        'rgb(34, 197, 94)',
        'rgb(249, 115, 22)',
        'rgb(239, 68, 68)',
      ],
      borderWidth: 1,
      borderRadius: 6,
    }],
  };
}

function buildPrecipChart(data) {
  if (!data || data.length === 0) return null;
  const valid = data.filter(d => d.precip_correct === true || d.precip_correct === false);
  if (valid.length === 0) return null;

  const correct = valid.filter(d => d.precip_correct).length;
  const wrong = valid.length - correct;

  return {
    labels: ['预测正确', '预测错误'],
    datasets: [{
      data: [correct, wrong],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
      borderColor: [
        'rgb(34, 197, 94)',
        'rgb(239, 68, 68)',
      ],
      borderWidth: 1,
    }],
  };
}
