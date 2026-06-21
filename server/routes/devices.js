const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const data = db.getData();
  const devices = data.devices.map(d => ({
    ...d,
    calibration_count: data.calibrations.filter(c => c.device_id === d.id).length,
    observation_count: data.observations.filter(o => o.device_id === d.id).length,
    last_calibration: data.calibrations.filter(c => c.device_id === d.id).sort((a, b) => b.calibration_date.localeCompare(a.calibration_date))[0]?.calibration_date || null
  }));
  devices.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json(devices);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const device = db.findById('devices', id);
  if (!device) return res.status(404).json({ error: '设备不存在' });
  const calibrations = db.findBy('calibrations', c => c.device_id === id)
    .sort((a, b) => b.calibration_date.localeCompare(a.calibration_date));
  res.json({ ...device, calibrations });
});

router.post('/', (req, res) => {
  const { model, manufacturer, sensor_types, location, latitude, longitude, installation_date } = req.body;
  if (!model || !sensor_types || !location) {
    return res.status(400).json({ error: '设备型号、传感器类型和安装位置为必填项' });
  }
  const r = db.insert('devices', {
    model, manufacturer: manufacturer || null, sensor_types, location,
    latitude: latitude || null, longitude: longitude || null, installation_date: installation_date || null
  });
  res.status(201).json(r);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.findById('devices', id)) return res.status(404).json({ error: '设备不存在' });
  const { model, manufacturer, sensor_types, location, latitude, longitude, installation_date } = req.body;
  const r = db.update('devices', id, {
    model, manufacturer: manufacturer || null, sensor_types, location,
    latitude: latitude || null, longitude: longitude || null, installation_date: installation_date || null
  });
  res.json(r);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.remove('devices', id);
  db.removeBy('calibrations', c => c.device_id === id);
  db.removeBy('observations', o => o.device_id === id);
  db.removeBy('daily_aggregates', a => a.device_id === id);
  res.json({ success: true });
});

router.post('/:id/calibrations', (req, res) => {
  const device_id = Number(req.params.id);
  if (!db.findById('devices', device_id)) return res.status(404).json({ error: '设备不存在' });
  const { calibration_date, temperature_offset, humidity_offset, pressure_offset, wind_speed_offset, notes } = req.body;
  if (!calibration_date) return res.status(400).json({ error: '校准日期为必填项' });
  const r = db.insert('calibrations', {
    device_id, calibration_date,
    temperature_offset: temperature_offset || 0, humidity_offset: humidity_offset || 0,
    pressure_offset: pressure_offset || 0, wind_speed_offset: wind_speed_offset || 0,
    notes: notes || null
  });
  res.status(201).json({ id: r.id });
});

router.delete('/calibrations/:id', (req, res) => {
  db.remove('calibrations', Number(req.params.id));
  res.json({ success: true });
});

router.get('/:id/sensor-matrix', (req, res) => {
  const id = Number(req.params.id);
  const device = db.findById('devices', id);
  if (!device) return res.status(404).json({ error: '设备不存在' });

  const data = db.getData();
  const observations = data.observations.filter(o => o.device_id === id);

  const allMetrics = [
    { key: 'temperature', label: '温度', category: 'basic', unit: '°C' },
    { key: 'humidity', label: '湿度', category: 'basic', unit: '%' },
    { key: 'pressure', label: '气压', category: 'basic', unit: 'hPa' },
    { key: 'wind_speed', label: '风速', category: 'basic', unit: 'm/s' },
    { key: 'wind_direction', label: '风向', category: 'basic', unit: '°' },
    { key: 'precipitation', label: '降水', category: 'basic', unit: 'mm' },
    { key: 'uv_index', label: '紫外线指数', category: 'advanced', unit: '' },
    { key: 'solar_radiation', label: '太阳辐射', category: 'advanced', unit: 'W/m²' },
    { key: 'visibility', label: '能见度', category: 'advanced', unit: 'km' },
    { key: 'pm25', label: 'PM2.5', category: 'advanced', unit: 'μg/m³' },
    { key: 'pm10', label: 'PM10', category: 'advanced', unit: 'μg/m³' },
    { key: 'dew_point', label: '露点', category: 'advanced', unit: '°C' },
    { key: 'feels_like', label: '体感温度', category: 'advanced', unit: '°C' },
  ];

  const matrix = allMetrics.map(metric => {
    const hasData = observations.some(o => o[metric.key] != null);
    const nonNullValues = observations.filter(o => o[metric.key] != null).map(o => o[metric.key]);
    const count = nonNullValues.length;
    const latest = observations
      .sort((a, b) => b.record_time.localeCompare(a.record_time))
      .find(o => o[metric.key] != null);

    return {
      ...metric,
      supported: hasData,
      observation_count: count,
      latest_value: latest ? latest[metric.key] : null,
      latest_time: latest ? latest.record_time : null,
      min_value: count > 0 ? Math.min(...nonNullValues) : null,
      max_value: count > 0 ? Math.max(...nonNullValues) : null,
      avg_value: count > 0 ? db.round(nonNullValues.reduce((a, b) => a + b, 0) / count) : null,
    };
  });

  res.json({
    device_id: id,
    device_model: device.model,
    total_observations: observations.length,
    metrics: matrix,
    basic_metrics: matrix.filter(m => m.category === 'basic'),
    advanced_metrics: matrix.filter(m => m.category === 'advanced'),
  });
});

module.exports = router;
