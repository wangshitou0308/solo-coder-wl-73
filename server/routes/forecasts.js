const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/sources', (req, res) => {
  const sources = [...db.getData().forecast_sources];
  sources.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  res.json(sources);
});

router.get('/', (req, res) => {
  const data = db.getData();
  const { source_id, start_date, end_date } = req.query;
  
  const sourceMap = {};
  data.forecast_sources.forEach(s => { sourceMap[s.id] = s.name; });
  
  let rows = data.forecasts.map(f => ({ ...f, source_name: sourceMap[f.source_id] || '' }));
  if (source_id) rows = rows.filter(f => f.source_id === Number(source_id));
  if (start_date) rows = rows.filter(f => (f.target_date || '') >= start_date);
  if (end_date) rows = rows.filter(f => (f.target_date || '') <= end_date);
  
  rows.sort((a, b) => {
    const d = (b.target_date || '').localeCompare(a.target_date || '');
    if (d !== 0) return d;
    return a.source_id - b.source_id;
  });
  rows = rows.slice(0, 2000);
  res.json(rows);
});

router.post('/', (req, res) => {
  const data = db.getData();
  const { source_id, forecast_date, target_date, forecast_range, temp_high, temp_low,
          precipitation_prob, precipitation_amount, wind_speed, wind_direction, weather_condition } = req.body;
  
  if (!source_id || !forecast_date || !target_date) {
    return res.status(400).json({ error: '预报来源、预报日期和目标日期为必填项' });
  }
  
  const srcId = Number(source_id);
  const range = forecast_range || '1d';
  const dup = data.forecasts.find(f =>
    f.source_id === srcId && f.forecast_date === forecast_date && f.target_date === target_date && f.forecast_range === range);
  if (dup) return res.status(409).json({ error: '该预报记录已存在' });
  
  const r = db.insert('forecasts', {
    source_id: srcId, forecast_date, target_date, forecast_range: range,
    temp_high: temp_high != null ? Number(temp_high) : null,
    temp_low: temp_low != null ? Number(temp_low) : null,
    precipitation_prob: precipitation_prob != null ? Number(precipitation_prob) : null,
    precipitation_amount: precipitation_amount != null ? Number(precipitation_amount) : null,
    wind_speed: wind_speed != null ? Number(wind_speed) : null,
    wind_direction: wind_direction != null ? Number(wind_direction) : null,
    weather_condition: weather_condition || null
  });
  res.status(201).json({ id: r.id });
});

router.post('/bulk', (req, res) => {
  const data = db.getData();
  const { forecasts } = req.body;
  if (!forecasts || !Array.isArray(forecasts)) {
    return res.status(400).json({ error: '请提供预报数据数组' });
  }
  
  let count = 0;
  for (const f of forecasts) {
    const srcId = Number(f.source_id);
    const range = f.forecast_range || '1d';
    const idx = data.forecasts.findIndex(x =>
      x.source_id === srcId && x.forecast_date === f.forecast_date && x.target_date === f.target_date && x.forecast_range === range);
    const row = {
      source_id: srcId, forecast_date: f.forecast_date, target_date: f.target_date, forecast_range: range,
      temp_high: f.temp_high != null ? Number(f.temp_high) : null,
      temp_low: f.temp_low != null ? Number(f.temp_low) : null,
      precipitation_prob: f.precipitation_prob != null ? Number(f.precipitation_prob) : null,
      precipitation_amount: f.precipitation_amount != null ? Number(f.precipitation_amount) : null,
      wind_speed: f.wind_speed != null ? Number(f.wind_speed) : null,
      wind_direction: f.wind_direction != null ? Number(f.wind_direction) : null,
      weather_condition: f.weather_condition || null
    };
    if (idx >= 0) {
      data.forecasts[idx] = { ...data.forecasts[idx], ...row, updated_at: db.localNow() };
    } else {
      row.id = db.nextId('forecasts');
      row.created_at = row.updated_at = db.localNow();
      data.forecasts.push(row);
    }
    count++;
  }
  db.save();
  res.json({ inserted: count });
});

router.post('/simulate', (req, res) => {
  const data = db.getData();
  const { source_id, start_date, end_date, device_id } = req.body;
  if (!start_date || !end_date || !device_id) {
    return res.status(400).json({ error: '起止日期和设备ID为必填项' });
  }
  const devId = Number(device_id);
  
  const aggs = data.daily_aggregates.filter(a =>
    a.device_id === devId && a.date >= start_date && a.date <= end_date);
  
  if (aggs.length === 0) {
    return res.status(400).json({ error: '该时间段无观测数据' });
  }
  
  const sourceIds = source_id ? [Number(source_id)] : data.forecast_sources.map(s => s.id);
  const inserted = [];
  
  for (const s of sourceIds) {
    const sBias = (s - 1) * 0.8 - 1.2;
    for (const agg of aggs) {
      const precip = agg.precipitation_total || 0;
      inserted.push({
        source_id: s, forecast_date: agg.date, target_date: agg.date, forecast_range: '1d',
        temp_high: db.round(agg.temp_max + 1.8 + sBias + (Math.random() * 3 - 1.5)),
        temp_low: db.round(agg.temp_min - 0.8 - sBias + (Math.random() * 2 - 1)),
        precipitation_prob: precip > 0.5 ? Math.min(100, Math.round(55 + Math.random() * 40)) : Math.round(Math.random() * 25),
        precipitation_amount: Math.max(0, db.round(precip * (0.7 + Math.random() * 0.6))),
        wind_speed: db.round(agg.wind_speed_avg * (0.85 + Math.random() * 0.45))
      });
    }
  }
  
  for (const f of inserted) {
    const idx = data.forecasts.findIndex(x =>
      x.source_id === f.source_id && x.forecast_date === f.forecast_date && x.target_date === f.target_date && x.forecast_range === '1d');
    if (idx >= 0) {
      data.forecasts[idx] = { ...data.forecasts[idx], ...f, updated_at: db.localNow() };
    } else {
      const row = { ...f, id: db.nextId('forecasts'), created_at: db.localNow(), updated_at: db.localNow(), wind_direction: null, weather_condition: null };
      data.forecasts.push(row);
    }
  }
  db.save();
  res.json({ inserted: inserted.length, dates_covered: aggs.length });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.findById('forecasts', id)) return res.status(404).json({ error: '预报不存在' });
  
  const { temp_high, temp_low, precipitation_prob, precipitation_amount, wind_speed, wind_direction, weather_condition } = req.body;
  db.update('forecasts', id, {
    temp_high: temp_high != null ? Number(temp_high) : null,
    temp_low: temp_low != null ? Number(temp_low) : null,
    precipitation_prob: precipitation_prob != null ? Number(precipitation_prob) : null,
    precipitation_amount: precipitation_amount != null ? Number(precipitation_amount) : null,
    wind_speed: wind_speed != null ? Number(wind_speed) : null,
    wind_direction: wind_direction != null ? Number(wind_direction) : null,
    weather_condition: weather_condition || null
  });
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.remove('forecasts', Number(req.params.id));
  res.json({ success: true });
});

router.get('/comparison', (req, res) => {
  const data = db.getData();
  const { device_id, start_date, end_date, source_id } = req.query;
  
  if (!device_id || !start_date || !end_date) {
    return res.status(400).json({ error: '设备ID和日期范围为必填项' });
  }
  const devId = Number(device_id);
  
  const sourceMap = {};
  data.forecast_sources.forEach(s => { sourceMap[s.id] = s.name; });
  
  let forecasts = data.forecasts.filter(f =>
    f.target_date >= start_date && f.target_date <= end_date && f.forecast_range === '1d');
  if (source_id) forecasts = forecasts.filter(f => f.source_id === Number(source_id));
  
  const aggMap = {};
  data.daily_aggregates.filter(a => a.device_id === devId).forEach(a => { aggMap[a.date] = a; });
  
  const result = forecasts.map(f => {
    const a = aggMap[f.target_date] || {};
    
    const temp_high_bias = (f.temp_high != null && a.temp_max != null) ? db.round(f.temp_high - a.temp_max) : null;
    const temp_low_bias = (f.temp_low != null && a.temp_min != null) ? db.round(f.temp_low - a.temp_min) : null;
    const temp_avg_fc = (f.temp_high != null && f.temp_low != null) ? (f.temp_high + f.temp_low) / 2 : null;
    const temp_avg_bias = (temp_avg_fc != null && a.temp_avg != null) ? db.round(temp_avg_fc - a.temp_avg) : null;
    
    const precip_forecast = ((f.precipitation_amount || 0) > 0.1) || ((f.precipitation_prob || 0) > 50);
    const precip_actual = (a.precipitation_total || 0) > 0.1;
    const precip_correct = precip_forecast === precip_actual;
    
    const precip_amount_bias = (f.precipitation_amount != null && a.precipitation_total != null)
      ? db.round(f.precipitation_amount - a.precipitation_total) : null;
    
    const wind_bias = (f.wind_speed != null && a.wind_speed_avg != null)
      ? db.round(f.wind_speed - a.wind_speed_avg) : null;
    
    return {
      forecast_id: f.id,
      source_id: f.source_id,
      source_name: sourceMap[f.source_id] || '',
      target_date: f.target_date,
      forecast_temp_high: f.temp_high,
      forecast_temp_low: f.temp_low,
      forecast_precipitation: f.precipitation_amount,
      forecast_precip_prob: f.precipitation_prob,
      forecast_wind_speed: f.wind_speed,
      actual_temp_max: a.temp_max,
      actual_temp_min: a.temp_min,
      actual_temp_avg: a.temp_avg,
      actual_precipitation: a.precipitation_total,
      actual_wind_speed: a.wind_speed_avg,
      actual_wind_max: a.wind_speed_max,
      temp_high_bias, temp_low_bias, temp_avg_bias,
      precip_correct, precip_amount_bias, wind_bias
    };
  });
  
  result.sort((a, b) => {
    const d = a.target_date.localeCompare(b.target_date);
    if (d !== 0) return d;
    return a.source_id - b.source_id;
  });
  
  res.json(result);
});

module.exports = router;
