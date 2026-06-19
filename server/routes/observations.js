const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function recalcDailyAggregate(deviceId, date) {
  const data = db.getData();
  const hourly = data.observations.filter(o =>
    o.device_id === Number(deviceId) && o.frequency === 'hourly' && (o.record_time || '').startsWith(date)
  );
  
  if (hourly.length === 0) {
    const existingIdx = data.daily_aggregates.findIndex(a => a.device_id === Number(deviceId) && a.date === date);
    if (existingIdx >= 0) {
      const d = data.daily_aggregates[existingIdx];
      if (!d.temp_avg) {
        data.daily_aggregates.splice(existingIdx, 1);
        db.save();
      }
    }
    return;
  }
  
  const temps = hourly.map(o => o.temperature).filter(t => t != null);
  const humids = hourly.map(o => o.humidity).filter(h => h != null);
  const pressures = hourly.map(o => o.pressure).filter(p => p != null);
  const winds = hourly.map(o => o.wind_speed).filter(w => w != null);
  const precips = hourly.map(o => o.precipitation || 0);
  
  const agg = {
    device_id: Number(deviceId),
    date,
    temp_avg: temps.length ? db.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null,
    temp_max: temps.length ? Math.max(...temps) : null,
    temp_min: temps.length ? Math.min(...temps) : null,
    humidity_avg: humids.length ? db.round(humids.reduce((a, b) => a + b, 0) / humids.length) : null,
    pressure_avg: pressures.length ? db.round(pressures.reduce((a, b) => a + b, 0) / pressures.length) : null,
    wind_speed_avg: winds.length ? db.round(winds.reduce((a, b) => a + b, 0) / winds.length) : null,
    wind_speed_max: winds.length ? Math.max(...winds) : null,
    precipitation_total: precips.length ? db.round(precips.reduce((a, b) => a + b, 0), 1) : 0
  };
  
  const existingIdx = data.daily_aggregates.findIndex(a => a.device_id === Number(deviceId) && a.date === date);
  if (existingIdx >= 0) {
    data.daily_aggregates[existingIdx] = { ...data.daily_aggregates[existingIdx], ...agg, updated_at: db.localNow() };
  } else {
    agg.id = db.nextId('daily_aggregates');
    agg.created_at = agg.updated_at = db.localNow();
    data.daily_aggregates.push(agg);
  }
  db.save();
}

router.get('/', (req, res) => {
  const data = db.getData();
  const { device_id, start_date, end_date, frequency } = req.query;
  
  let rows = [...data.observations];
  if (device_id) rows = rows.filter(o => o.device_id === Number(device_id));
  if (start_date) rows = rows.filter(o => (o.record_time || '') >= start_date);
  if (end_date) rows = rows.filter(o => (o.record_time || '') <= end_date + ' 23:59:59');
  if (frequency) rows = rows.filter(o => o.frequency === frequency);
  
  rows.sort((a, b) => (b.record_time || '').localeCompare(a.record_time || ''));
  rows = rows.slice(0, 5000);
  res.json(rows);
});

router.get('/daily', (req, res) => {
  const data = db.getData();
  const { device_id, start_date, end_date } = req.query;
  
  let rows = [...data.daily_aggregates];
  if (device_id) rows = rows.filter(o => o.device_id === Number(device_id));
  if (start_date) rows = rows.filter(o => (o.date || '') >= start_date);
  if (end_date) rows = rows.filter(o => (o.date || '') <= end_date);
  
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  res.json(rows);
});

router.post('/', (req, res) => {
  const data = db.getData();
  const { device_id, record_time, frequency, temperature, humidity, pressure, wind_speed, wind_direction, precipitation } = req.body;
  
  if (!device_id || !record_time || !frequency) {
    return res.status(400).json({ error: '设备ID、记录时间和频率为必填项' });
  }
  
  const devId = Number(device_id);
  const dup = data.observations.find(o =>
    o.device_id === devId && o.record_time === record_time && o.frequency === frequency);
  if (dup) return res.status(409).json({ error: '该时间点已有记录' });
  
  const r = db.insert('observations', {
    device_id: devId, record_time, frequency,
    temperature: temperature != null ? Number(temperature) : null,
    humidity: humidity != null ? Number(humidity) : null,
    pressure: pressure != null ? Number(pressure) : null,
    wind_speed: wind_speed != null ? Number(wind_speed) : null,
    wind_direction: wind_direction != null ? Number(wind_direction) : null,
    precipitation: precipitation != null ? Number(precipitation) : 0
  });
  
  if (frequency === 'hourly') {
    recalcDailyAggregate(devId, record_time.substring(0, 10));
  }
  res.status(201).json({ id: r.id });
});

router.post('/bulk', (req, res) => {
  const { observations } = req.body;
  const data = db.getData();
  if (!observations || !Array.isArray(observations) || observations.length === 0) {
    return res.status(400).json({ error: '请提供观测数据数组' });
  }
  
  const datesToRecalc = new Set();
  let count = 0;
  
  for (const o of observations) {
    const devId = Number(o.device_id);
    const existingIdx = data.observations.findIndex(x =>
      x.device_id === devId && x.record_time === o.record_time && x.frequency === o.frequency);
    
    const row = {
      device_id: devId, record_time: o.record_time, frequency: o.frequency,
      temperature: o.temperature != null ? Number(o.temperature) : null,
      humidity: o.humidity != null ? Number(o.humidity) : null,
      pressure: o.pressure != null ? Number(o.pressure) : null,
      wind_speed: o.wind_speed != null ? Number(o.wind_speed) : null,
      wind_direction: o.wind_direction != null ? Number(o.wind_direction) : null,
      precipitation: o.precipitation != null ? Number(o.precipitation) : 0
    };
    
    if (existingIdx >= 0) {
      data.observations[existingIdx] = { ...data.observations[existingIdx], ...row, updated_at: db.localNow() };
    } else {
      row.id = db.nextId('observations');
      row.created_at = row.updated_at = db.localNow();
      data.observations.push(row);
    }
    count++;
    
    if (o.frequency === 'hourly') {
      datesToRecalc.add(`${devId}|${o.record_time.substring(0, 10)}`);
    }
  }
  db.save();
  
  datesToRecalc.forEach(key => {
    const [did, date] = key.split('|');
    recalcDailyAggregate(Number(did), date);
  });
  
  res.json({ inserted: count });
});

router.post('/import-csv', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传CSV文件' });
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: '请指定设备ID' });
  const devId = Number(device_id);
  
  try {
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    
    const processed = records.map(r => {
      let record_time = r.record_time || r.time || r.datetime;
      if (!record_time && r.date) record_time = r.date + (r.time ? ' ' + r.time : ' 12:00:00');
      const frequency = (r.frequency || (record_time && record_time.includes(' ') && record_time.length > 11 ? 'hourly' : 'daily'));
      return {
        device_id: devId,
        record_time,
        frequency,
        temperature: r.temperature != null && r.temperature !== '' ? parseFloat(r.temperature) : null,
        humidity: r.humidity != null && r.humidity !== '' ? parseFloat(r.humidity) : null,
        pressure: r.pressure != null && r.pressure !== '' ? parseFloat(r.pressure) : null,
        wind_speed: r.wind_speed != null && r.wind_speed !== '' ? parseFloat(r.wind_speed) : null,
        wind_direction: r.wind_direction != null && r.wind_direction !== '' ? parseInt(r.wind_direction) : null,
        precipitation: r.precipitation != null && r.precipitation !== '' ? parseFloat(r.precipitation) : 0
      };
    }).filter(p => p.record_time);
    
    const data = db.getData();
    const datesToRecalc = new Set();
    let count = 0;
    
    for (const o of processed) {
      const existingIdx = data.observations.findIndex(x =>
        x.device_id === o.device_id && x.record_time === o.record_time && x.frequency === o.frequency);
      
      if (existingIdx >= 0) {
        data.observations[existingIdx] = { ...data.observations[existingIdx], ...o, updated_at: db.localNow() };
      } else {
        o.id = db.nextId('observations');
        o.created_at = o.updated_at = db.localNow();
        data.observations.push(o);
      }
      count++;
      
      if (o.frequency === 'hourly') {
        datesToRecalc.add(`${o.device_id}|${o.record_time.substring(0, 10)}`);
      }
    }
    db.save();
    
    datesToRecalc.forEach(key => {
      const [did, date] = key.split('|');
      recalcDailyAggregate(Number(did), date);
    });
    
    res.json({ imported: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const data = db.getData();
  const id = Number(req.params.id);
  const existing = data.observations.find(o => o.id === id);
  if (!existing) return res.status(404).json({ error: '记录不存在' });
  
  const { temperature, humidity, pressure, wind_speed, wind_direction, precipitation } = req.body;
  
  db.update('observations', id, {
    temperature: temperature != null ? Number(temperature) : null,
    humidity: humidity != null ? Number(humidity) : null,
    pressure: pressure != null ? Number(pressure) : null,
    wind_speed: wind_speed != null ? Number(wind_speed) : null,
    wind_direction: wind_direction != null ? Number(wind_direction) : null,
    precipitation: precipitation != null ? Number(precipitation) : 0
  });
  
  if (existing.frequency === 'hourly') {
    recalcDailyAggregate(existing.device_id, existing.record_time.substring(0, 10));
  }
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const data = db.getData();
  const id = Number(req.params.id);
  const obs = data.observations.find(o => o.id === id);
  db.remove('observations', id);
  
  if (obs && obs.frequency === 'hourly') {
    recalcDailyAggregate(obs.device_id, obs.record_time.substring(0, 10));
  }
  res.json({ success: true });
});

module.exports = router;
