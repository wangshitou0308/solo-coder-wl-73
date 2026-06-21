const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const EXTENDED_FIELDS = ['uv_index', 'solar_radiation', 'visibility', 'pm25', 'pm10', 'dew_point', 'feels_like'];

function calcDewPoint(temp, humidity) {
  if (temp == null || humidity == null) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * temp) / (b + temp) + Math.log(humidity / 100);
  return db.round((b * alpha) / (a - alpha), 1);
}

function calcFeelsLike(temp, humidity, windSpeed) {
  if (temp == null) return null;
  if (windSpeed != null && temp <= 10 && windSpeed >= 4.8) {
    return db.round(13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16), 1);
  }
  if (humidity != null && temp >= 27) {
    const rh = humidity / 100;
    return db.round(temp + 0.5555 * (6.11 * Math.exp(5417.753 * (1/273.15 - 1/(273.15 + temp))) * rh - 10), 1);
  }
  return temp;
}

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
  const uvIndices = hourly.map(o => o.uv_index).filter(v => v != null);
  const solarRadiations = hourly.map(o => o.solar_radiation).filter(v => v != null);
  const visibilities = hourly.map(o => o.visibility).filter(v => v != null);
  const pm25s = hourly.map(o => o.pm25).filter(v => v != null);
  const pm10s = hourly.map(o => o.pm10).filter(v => v != null);
  const dewPoints = hourly.map(o => o.dew_point).filter(v => v != null);
  const feelsLikes = hourly.map(o => o.feels_like).filter(v => v != null);
  
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
    precipitation_total: precips.length ? db.round(precips.reduce((a, b) => a + b, 0), 1) : 0,
    uv_index_avg: uvIndices.length ? db.round(uvIndices.reduce((a, b) => a + b, 0) / uvIndices.length, 1) : null,
    uv_index_max: uvIndices.length ? Math.max(...uvIndices) : null,
    solar_radiation_avg: solarRadiations.length ? db.round(solarRadiations.reduce((a, b) => a + b, 0) / solarRadiations.length) : null,
    solar_radiation_max: solarRadiations.length ? Math.max(...solarRadiations) : null,
    visibility_avg: visibilities.length ? db.round(visibilities.reduce((a, b) => a + b, 0) / visibilities.length, 1) : null,
    visibility_min: visibilities.length ? Math.min(...visibilities) : null,
    pm25_avg: pm25s.length ? db.round(pm25s.reduce((a, b) => a + b, 0) / pm25s.length) : null,
    pm25_max: pm25s.length ? Math.max(...pm25s) : null,
    pm10_avg: pm10s.length ? db.round(pm10s.reduce((a, b) => a + b, 0) / pm10s.length) : null,
    pm10_max: pm10s.length ? Math.max(...pm10s) : null,
    dew_point_avg: dewPoints.length ? db.round(dewPoints.reduce((a, b) => a + b, 0) / dewPoints.length) : null,
    dew_point_min: dewPoints.length ? Math.min(...dewPoints) : null,
    dew_point_max: dewPoints.length ? Math.max(...dewPoints) : null,
    feels_like_avg: feelsLikes.length ? db.round(feelsLikes.reduce((a, b) => a + b, 0) / feelsLikes.length) : null,
    feels_like_max: feelsLikes.length ? Math.max(...feelsLikes) : null,
    feels_like_min: feelsLikes.length ? Math.min(...feelsLikes) : null
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

function buildObservationRow(o) {
  const temp = o.temperature != null ? Number(o.temperature) : null;
  const hum = o.humidity != null ? Number(o.humidity) : null;
  const ws = o.wind_speed != null ? Number(o.wind_speed) : null;
  
  const row = {
    device_id: Number(o.device_id),
    record_time: o.record_time,
    frequency: o.frequency,
    temperature: temp,
    humidity: hum,
    pressure: o.pressure != null ? Number(o.pressure) : null,
    wind_speed: ws,
    wind_direction: o.wind_direction != null ? Number(o.wind_direction) : null,
    precipitation: o.precipitation != null ? Number(o.precipitation) : 0,
    uv_index: o.uv_index != null ? Number(o.uv_index) : null,
    solar_radiation: o.solar_radiation != null ? Number(o.solar_radiation) : null,
    visibility: o.visibility != null ? Number(o.visibility) : null,
    pm25: o.pm25 != null ? Number(o.pm25) : null,
    pm10: o.pm10 != null ? Number(o.pm10) : null,
    dew_point: o.dew_point != null ? Number(o.dew_point) : calcDewPoint(temp, hum),
    feels_like: o.feels_like != null ? Number(o.feels_like) : calcFeelsLike(temp, hum, ws)
  };
  return row;
}

router.post('/', (req, res) => {
  const data = db.getData();
  const { device_id, record_time, frequency } = req.body;
  
  if (!device_id || !record_time || !frequency) {
    return res.status(400).json({ error: '设备ID、记录时间和频率为必填项' });
  }
  
  const devId = Number(device_id);
  const dup = data.observations.find(o =>
    o.device_id === devId && o.record_time === record_time && o.frequency === frequency);
  if (dup) return res.status(409).json({ error: '该时间点已有记录' });
  
  const row = buildObservationRow(req.body);
  const r = db.insert('observations', row);
  
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
    
    const row = buildObservationRow(o);
    
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
      
      const obj = {
        device_id: devId,
        record_time,
        frequency,
        temperature: r.temperature != null && r.temperature !== '' ? parseFloat(r.temperature) : null,
        humidity: r.humidity != null && r.humidity !== '' ? parseFloat(r.humidity) : null,
        pressure: r.pressure != null && r.pressure !== '' ? parseFloat(r.pressure) : null,
        wind_speed: r.wind_speed != null && r.wind_speed !== '' ? parseFloat(r.wind_speed) : null,
        wind_direction: r.wind_direction != null && r.wind_direction !== '' ? parseInt(r.wind_direction) : null,
        precipitation: r.precipitation != null && r.precipitation !== '' ? parseFloat(r.precipitation) : 0,
        uv_index: r.uv_index != null && r.uv_index !== '' ? parseFloat(r.uv_index) : null,
        solar_radiation: r.solar_radiation != null && r.solar_radiation !== '' ? parseFloat(r.solar_radiation) : null,
        visibility: r.visibility != null && r.visibility !== '' ? parseFloat(r.visibility) : null,
        pm25: r.pm25 != null && r.pm25 !== '' ? parseFloat(r.pm25) : null,
        pm10: r.pm10 != null && r.pm10 !== '' ? parseFloat(r.pm10) : null,
        dew_point: r.dew_point != null && r.dew_point !== '' ? parseFloat(r.dew_point) : null,
        feels_like: r.feels_like != null && r.feels_like !== '' ? parseFloat(r.feels_like) : null
      };
      
      return buildObservationRow(obj);
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
  
  const updated = { ...existing, ...req.body };
  const row = buildObservationRow(updated);
  
  db.update('observations', id, row);
  
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

router.get('/extended-trend', (req, res) => {
  const { device_id, days = 30 } = req.query;
  
  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }
  
  const devId = Number(device_id);
  const data = db.getData();
  const dayCount = Math.min(Math.max(Number(days) || 30, 1), 365);
  
  const now = new Date();
  const startDate = new Date(now.getTime() - dayCount * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString().substring(0, 10);
  
  const observations = data.observations
    .filter(o => o.device_id === devId && o.frequency === 'hourly' && o.record_time >= startDateStr)
    .sort((a, b) => a.record_time.localeCompare(b.record_time));
  
  const extendedMetrics = [
    { key: 'uv_index', label: '紫外线指数' },
    { key: 'solar_radiation', label: '太阳辐射' },
    { key: 'visibility', label: '能见度' },
    { key: 'pm25', label: 'PM2.5' },
    { key: 'pm10', label: 'PM10' },
    { key: 'dew_point', label: '露点' },
    { key: 'feels_like', label: '体感温度' },
  ];
  
  const trend = extendedMetrics.map(metric => {
    const values = observations
      .filter(o => o[metric.key] != null)
      .map(o => ({ time: o.record_time, value: o[metric.key] }));
    
    const numericValues = values.map(v => v.value).filter(v => !isNaN(v));
    
    return {
      ...metric,
      data_points: values,
      count: values.length,
      min: numericValues.length > 0 ? Math.min(...numericValues) : null,
      max: numericValues.length > 0 ? Math.max(...numericValues) : null,
      avg: numericValues.length > 0 ? db.round(numericValues.reduce((a, b) => a + b, 0) / numericValues.length) : null,
    };
  });
  
  res.json({
    device_id: devId,
    days: dayCount,
    start_date: startDateStr,
    end_date: now.toISOString().substring(0, 10),
    total_observations: observations.length,
    trends: trend,
  });
});

module.exports = router;
