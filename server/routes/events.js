const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const data = db.getData();
  const { event_type, start_date, end_date } = req.query;
  
  const deviceMap = {};
  data.devices.forEach(d => { deviceMap[d.id] = { model: d.model, location: d.location }; });
  
  let rows = data.extreme_events.map(e => ({
    ...e,
    device_model: e.device_id ? (deviceMap[e.device_id]?.model || '') : '',
    device_location: e.device_id ? (deviceMap[e.device_id]?.location || '') : ''
  }));
  
  if (event_type) rows = rows.filter(e => e.event_type === event_type);
  if (start_date) rows = rows.filter(e => (e.start_time || '') >= start_date);
  if (end_date) rows = rows.filter(e => (e.start_time || '') <= end_date + ' 23:59:59');
  
  rows.sort((a, b) => (b.start_time || '').localeCompare(a.start_time || ''));
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const data = db.getData();
  const id = Number(req.params.id);
  const evt = data.extreme_events.find(e => e.id === id);
  if (!evt) return res.status(404).json({ error: '事件不存在' });
  
  const device = evt.device_id ? data.devices.find(d => d.id === evt.device_id) : null;
  const startDate = evt.start_time ? evt.start_time.substring(0, 10) : null;
  const endDate = evt.end_time ? evt.end_time.substring(0, 10) : null;
  
  const sourceMap = {};
  data.forecast_sources.forEach(s => { sourceMap[s.id] = s.name; });
  
  const forecasts = [];
  if (startDate && endDate && evt.device_id) {
    const aggMap = {};
    data.daily_aggregates.filter(a => a.device_id === evt.device_id).forEach(a => { aggMap[a.date] = a; });
    
    data.forecasts
      .filter(f => f.target_date >= startDate && f.target_date <= endDate && f.forecast_range === '1d')
      .forEach(f => {
        const a = aggMap[f.target_date] || {};
        forecasts.push({
          ...f,
          source_name: sourceMap[f.source_id] || '',
          actual_temp_max: a.temp_max,
          actual_temp_min: a.temp_min,
          actual_precipitation: a.precipitation_total,
          actual_wind_max: a.wind_speed_max
        });
      });
  }
  
  const stats = {};
  forecasts.forEach(f => {
    if (!stats[f.source_id]) {
      stats[f.source_id] = { source_name: f.source_name, total: 0, temp_correct: 0, precip_correct: 0, wind_correct: 0 };
    }
    stats[f.source_id].total++;
    if (f.temp_high != null && f.temp_low != null && f.actual_temp_max != null && f.actual_temp_min != null) {
      const fAvg = (f.temp_high + f.temp_low) / 2;
      const aAvg = (f.actual_temp_max + f.actual_temp_min) / 2;
      if (Math.abs(fAvg - aAvg) <= 3) stats[f.source_id].temp_correct++;
    }
    const fp = ((f.precipitation_amount || 0) > 0.5) || ((f.precipitation_prob || 0) > 60);
    const ap = (f.actual_precipitation || 0) > 0.5;
    if (fp === ap) stats[f.source_id].precip_correct++;
    if (f.wind_speed != null && f.actual_wind_max != null) {
      if (Math.abs(f.wind_speed - f.actual_wind_max) <= 5) stats[f.source_id].wind_correct++;
    }
  });
  
  const forecast_stats = Object.values(stats).map(s => ({
    ...s,
    temp_accuracy: s.total > 0 ? db.round(s.temp_correct / s.total, 4) : 0,
    precip_accuracy: s.total > 0 ? db.round(s.precip_correct / s.total, 4) : 0,
    wind_accuracy: s.total > 0 ? db.round(s.wind_correct / s.total, 4) : 0,
    overall_accuracy: s.total > 0 ? db.round((s.temp_correct + s.precip_correct + s.wind_correct) / (s.total * 3), 4) : 0
  }));
  
  const sortedForecasts = forecasts.sort((a, b) => {
    const d = a.target_date.localeCompare(b.target_date);
    if (d !== 0) return d;
    return a.source_id - b.source_id;
  });
  
  res.json({
    ...evt,
    device_model: device?.model || '',
    device_location: device?.location || '',
    forecasts: sortedForecasts,
    forecast_stats
  });
});

router.post('/', (req, res) => {
  const { event_type, start_time, end_time, device_id, temp_extreme, wind_extreme,
          precipitation_total, description, impact_description } = req.body;
  
  if (!event_type || !start_time || !end_time) {
    return res.status(400).json({ error: '事件类型、开始时间和结束时间为必填项' });
  }
  
  const r = db.insert('extreme_events', {
    event_type, start_time, end_time,
    device_id: device_id ? Number(device_id) : null,
    temp_extreme: temp_extreme != null ? Number(temp_extreme) : null,
    wind_extreme: wind_extreme != null ? Number(wind_extreme) : null,
    precipitation_total: precipitation_total != null ? Number(precipitation_total) : null,
    description: description || null,
    impact_description: impact_description || null
  });
  res.status(201).json({ id: r.id });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.findById('extreme_events', id)) return res.status(404).json({ error: '事件不存在' });
  
  const { event_type, start_time, end_time, device_id, temp_extreme, wind_extreme,
          precipitation_total, description, impact_description } = req.body;
  
  db.update('extreme_events', id, {
    event_type, start_time, end_time,
    device_id: device_id ? Number(device_id) : null,
    temp_extreme: temp_extreme != null ? Number(temp_extreme) : null,
    wind_extreme: wind_extreme != null ? Number(wind_extreme) : null,
    precipitation_total: precipitation_total != null ? Number(precipitation_total) : null,
    description: description || null,
    impact_description: impact_description || null
  });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.remove('extreme_events', Number(req.params.id));
  res.json({ success: true });
});

module.exports = router;
