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

module.exports = router;
