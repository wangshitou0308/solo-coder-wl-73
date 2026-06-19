import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import api from '../api.js';

export default function Observations() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [frequency, setFrequency] = useState('hourly');
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [activeTab, setActiveTab] = useState('list');
  const [data, setData] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({});
  const [loading, setLoading] = useState(false);

  const [manualForm, setManualForm] = useState({
    record_time: dayjs().format('YYYY-MM-DDTHH:mm'),
    temperature: '',
    humidity: '',
    pressure: '',
    wind_speed: '',
    wind_direction: '',
    precipitation: '',
  });

  const [bulkData, setBulkData] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const csvInputRef = useRef(null);

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      loadData();
    }
  }, [selectedDevice, frequency, startDate, endDate]);

  async function loadDevices() {
    try {
      const list = await api.devices.list();
      setDevices(list);
      if (list.length > 0 && !selectedDevice) {
        setSelectedDevice(list[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadData() {
    if (!selectedDevice) return;
    setLoading(true);
    try {
      const params = {
        device_id: selectedDevice,
        start_date: startDate,
        end_date: endDate,
      };
      const list = frequency === 'daily'
        ? await api.observations.daily(params)
        : await api.observations.list({ ...params, frequency });
      setData(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function resetManualForm() {
    setManualForm({
      record_time: dayjs().format('YYYY-MM-DDTHH:mm'),
      temperature: '',
      humidity: '',
      pressure: '',
      wind_speed: '',
      wind_direction: '',
      precipitation: '',
    });
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    try {
      const payload = {
        device_id: selectedDevice,
        record_time: dayjs(manualForm.record_time).format('YYYY-MM-DD HH:mm:ss'),
        frequency,
        temperature: manualForm.temperature !== '' ? parseFloat(manualForm.temperature) : null,
        humidity: manualForm.humidity !== '' ? parseFloat(manualForm.humidity) : null,
        pressure: manualForm.pressure !== '' ? parseFloat(manualForm.pressure) : null,
        wind_speed: manualForm.wind_speed !== '' ? parseFloat(manualForm.wind_speed) : null,
        wind_direction: manualForm.wind_direction !== '' ? parseInt(manualForm.wind_direction) : null,
        precipitation: manualForm.precipitation !== '' ? parseFloat(manualForm.precipitation) : 0,
      };
      await api.observations.create(payload);
      alert('录入成功');
      resetManualForm();
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleBulkSubmit() {
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    if (!bulkData.trim()) {
      alert('请输入批量数据');
      return;
    }
    try {
      const lines = bulkData.trim().split('\n');
      const records = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        const [record_time, temperature, humidity, pressure, wind_speed, wind_direction, precipitation] = parts;
        return {
          device_id: selectedDevice,
          record_time,
          frequency,
          temperature: temperature ? parseFloat(temperature) : null,
          humidity: humidity ? parseFloat(humidity) : null,
          pressure: pressure ? parseFloat(pressure) : null,
          wind_speed: wind_speed ? parseFloat(wind_speed) : null,
          wind_direction: wind_direction ? parseInt(wind_direction) : null,
          precipitation: precipitation ? parseFloat(precipitation) : 0,
        };
      });
      const result = await api.observations.bulk(records);
      alert(`成功导入 ${result.inserted} 条记录`);
      setBulkData('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCsvUpload() {
    if (!selectedDevice) {
      alert('请先选择设备');
      return;
    }
    if (!csvFile) {
      alert('请选择CSV文件');
      return;
    }
    try {
      const result = await api.observations.importCsv(selectedDevice, csvFile);
      alert(`成功导入 ${result.imported} 条记录`);
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = '';
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditRow({ ...row });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRow({});
  }

  async function saveEdit() {
    try {
      const payload = {
        temperature: editRow.temperature != null ? parseFloat(editRow.temperature) : null,
        humidity: editRow.humidity != null ? parseFloat(editRow.humidity) : null,
        pressure: editRow.pressure != null ? parseFloat(editRow.pressure) : null,
        wind_speed: editRow.wind_speed != null ? parseFloat(editRow.wind_speed) : null,
        wind_direction: editRow.wind_direction != null ? parseInt(editRow.wind_direction) : null,
        precipitation: editRow.precipitation != null ? parseFloat(editRow.precipitation) : 0,
      };
      await api.observations.update(editingId, payload);
      setEditingId(null);
      setEditRow({});
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
      await api.observations.remove(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  }

  const tabs = [
    { key: 'manual', label: '手动录入', icon: '✏️' },
    { key: 'bulk', label: '批量导入', icon: '📥' },
    { key: 'list', label: '数据列表', icon: '📋' },
  ];

  const isDaily = frequency === 'daily';

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-3xl">🌡️</span>
          观测数据管理
        </h1>
        <p className="text-slate-500 mt-1">管理设备采集的气象观测数据</p>
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">数据频率</label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            >
              <option value="hourly">小时数据 (hourly)</option>
              <option value="daily">日汇总 (daily)</option>
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
        <div className="flex border-b border-slate-200">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition border-b-2 ${
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
          {activeTab === 'manual' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">手动录入观测数据</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      记录时间 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={manualForm.record_time}
                      onChange={e => setManualForm({ ...manualForm, record_time: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                      step="3600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">温度 (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={manualForm.temperature}
                      onChange={e => setManualForm({ ...manualForm, temperature: e.target.value })}
                      placeholder="例如：23.5"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">湿度 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={manualForm.humidity}
                      onChange={e => setManualForm({ ...manualForm, humidity: e.target.value })}
                      placeholder="例如：65"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">气压 (hPa)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={manualForm.pressure}
                      onChange={e => setManualForm({ ...manualForm, pressure: e.target.value })}
                      placeholder="例如：1013.2"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">风速 (m/s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={manualForm.wind_speed}
                      onChange={e => setManualForm({ ...manualForm, wind_speed: e.target.value })}
                      placeholder="例如：3.5"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">风向 (°)</label>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={manualForm.wind_direction}
                      onChange={e => setManualForm({ ...manualForm, wind_direction: e.target.value })}
                      placeholder="0-360，如：180"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">降水量 (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={manualForm.precipitation}
                      onChange={e => setManualForm({ ...manualForm, precipitation: e.target.value })}
                      placeholder="例如：2.5"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium shadow-sm"
                  >
                    提交录入
                  </button>
                  <button
                    type="button"
                    onClick={resetManualForm}
                    className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    重置表单
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'bulk' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
                  <span>📝</span> 数据格式说明
                </h4>
                <p className="text-sm text-amber-700 mb-2">每行一条记录，字段用英文逗号分隔，顺序如下：</p>
                <code className="block text-xs bg-amber-100 px-3 py-2 rounded text-amber-900 overflow-x-auto">
                  record_time, temperature, humidity, pressure, wind_speed, wind_direction, precipitation
                </code>
                <p className="text-xs text-amber-600 mt-2">
                  示例：2025-01-15 08:00:00, 23.5, 65, 1013.2, 3.5, 180, 2.5
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">方式一：粘贴批量数据</h3>
                <textarea
                  value={bulkData}
                  onChange={e => setBulkData(e.target.value)}
                  rows={10}
                  placeholder="请按格式粘贴数据，每行一条..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition font-mono text-sm"
                />
                <button
                  onClick={handleBulkSubmit}
                  className="mt-3 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium shadow-sm"
                >
                  批量导入
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">方式二：上传CSV文件</h3>
                <div className="p-5 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-2">选择CSV文件</label>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        onChange={e => setCsvFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-700 hover:file:bg-primary-200 file:cursor-pointer"
                      />
                      {csvFile && (
                        <p className="mt-2 text-sm text-slate-600">已选择：{csvFile.name}</p>
                      )}
                    </div>
                    <button
                      onClick={handleCsvUpload}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm whitespace-nowrap"
                    >
                      上传CSV
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  CSV文件应包含表头：record_time, temperature, humidity, pressure, wind_speed, wind_direction, precipitation
                </p>
              </div>
            </div>
          )}

          {activeTab === 'list' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  数据列表 <span className="text-sm font-normal text-slate-500">（共 {data.length} 条）</span>
                </h3>
                <button
                  onClick={loadData}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition flex items-center gap-2"
                >
                  <span>🔄</span> 刷新
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500">加载中...</div>
              ) : data.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="text-5xl mb-3">📭</div>
                  <p>暂无数据，请调整筛选条件或录入数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">
                          {isDaily ? '日期' : '记录时间'}
                        </th>
                        {isDaily ? (
                          <>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">平均温(°C)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">最高温(°C)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">最低温(°C)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">平均湿度(%)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">平均气压(hPa)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">平均风速(m/s)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">最大风速(m/s)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">降水总量(mm)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">操作</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">温度(°C)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">湿度(%)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">气压(hPa)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">风速(m/s)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">风向(°)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">降水量(mm)</th>
                            <th className="text-left px-4 py-3 font-medium text-slate-600">操作</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map(row => (
                        isDaily ? (
                          <DailyRow
                            key={row.id}
                            row={row}
                            editingId={editingId}
                            editRow={editRow}
                            setEditRow={setEditRow}
                            startEdit={startEdit}
                            cancelEdit={cancelEdit}
                            saveEdit={saveEdit}
                            handleDelete={handleDelete}
                          />
                        ) : (
                          <HourlyRow
                            key={row.id}
                            row={row}
                            editingId={editingId}
                            editRow={editRow}
                            setEditRow={setEditRow}
                            startEdit={startEdit}
                            cancelEdit={cancelEdit}
                            saveEdit={saveEdit}
                            handleDelete={handleDelete}
                          />
                        )
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

function HourlyRow({ row, editingId, editRow, setEditRow, startEdit, cancelEdit, saveEdit, handleDelete }) {
  const isEditing = editingId === row.id;
  const r = isEditing ? editRow : row;

  const field = (key, type = 'number', step = '0.1') => {
    if (!isEditing) return r[key] ?? '-';
    return (
      <input
        type={type}
        step={step}
        value={r[key] ?? ''}
        onChange={e => setEditRow({ ...editRow, [key]: e.target.value })}
        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
      />
    );
  };

  return (
    <tr className={isEditing ? 'bg-primary-50/50' : 'hover:bg-slate-50'}>
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">
        {dayjs(row.record_time).format('YYYY-MM-DD HH:mm')}
      </td>
      <td className="px-4 py-3 text-slate-700">{field('temperature')}</td>
      <td className="px-4 py-3 text-slate-700">{field('humidity')}</td>
      <td className="px-4 py-3 text-slate-700">{field('pressure')}</td>
      <td className="px-4 py-3 text-slate-700">{field('wind_speed')}</td>
      <td className="px-4 py-3 text-slate-700">{field('wind_direction', 'number', '1')}</td>
      <td className="px-4 py-3 text-slate-700">{field('precipitation')}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex gap-1">
            <button
              onClick={saveEdit}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              保存
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => startEdit(row)}
              className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition"
            >
              编辑
            </button>
            <button
              onClick={() => handleDelete(row.id)}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
            >
              删除
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function DailyRow({ row, editingId, editRow, setEditRow, startEdit, cancelEdit, saveEdit, handleDelete }) {
  const isEditing = editingId === row.id;
  const r = isEditing ? editRow : row;

  const field = (key, type = 'number', step = '0.1') => {
    if (!isEditing) return r[key] ?? '-';
    return (
      <input
        type={type}
        step={step}
        value={r[key] ?? ''}
        onChange={e => setEditRow({ ...editRow, [key]: e.target.value })}
        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
      />
    );
  };

  return (
    <tr className={isEditing ? 'bg-primary-50/50' : 'hover:bg-slate-50'}>
      <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono text-xs">{row.date}</td>
      <td className="px-4 py-3 text-slate-700">{field('temp_avg')}</td>
      <td className="px-4 py-3 text-orange-600 font-medium">{field('temp_max')}</td>
      <td className="px-4 py-3 text-blue-600 font-medium">{field('temp_min')}</td>
      <td className="px-4 py-3 text-slate-700">{field('humidity_avg')}</td>
      <td className="px-4 py-3 text-slate-700">{field('pressure_avg')}</td>
      <td className="px-4 py-3 text-slate-700">{field('wind_speed_avg')}</td>
      <td className="px-4 py-3 text-slate-700">{field('wind_speed_max')}</td>
      <td className="px-4 py-3 text-slate-700">{field('precipitation_total')}</td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex gap-1">
            <button
              onClick={saveEdit}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              保存
            </button>
            <button
              onClick={cancelEdit}
              className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => startEdit(row)}
              className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition"
            >
              编辑
            </button>
            <button
              onClick={() => handleDelete(row.id)}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
            >
              删除
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
