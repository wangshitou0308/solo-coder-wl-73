const express = require('express');
const db = require('../db');

const router = express.Router();

function groupByPeriod(rows, getPeriod) {
  const groups = {};
  rows.forEach(r => {
    const p = getPeriod(r);
    if (!groups[p]) groups[p] = [];
    groups[p].push(r);
  });
  return groups;
}

router.get('/overview', (req, res) => {
  const data = db.getData();
  const { device_id } = req.query;
  const devId = device_id ? Number(device_id) : null;
  
  const obsFilter = devId ? data.observations.filter(o => o.device_id === devId) : data.observations;
  const deviceCount = data.devices.length;
  const obsCount = obsFilter.length;
  const forecastCount = data.forecasts.length;
  const eventCount = data.extreme_events.length;
  
  const times = obsFilter.map(o => o.record_time).filter(Boolean);
  let min_date = null, max_date = null;
  if (times.length) {
    times.sort();
    min_date = times[0];
    max_date = times[times.length - 1];
  }
  
  res.json({
    device_count: deviceCount,
    observation_count: obsCount,
    forecast_count: forecastCount,
    event_count: eventCount,
    date_range: { min_date, max_date }
  });
});

function buildAccuracyData(devId, startDate, endDate, sourceId, period) {
  const data = db.getData();
  const sourceMap = {};
  data.forecast_sources.forEach(s => { sourceMap[s.id] = s.name; });
  
  const forecasts = data.forecasts.filter(f => {
    if (f.forecast_range !== '1d') return false;
    if (startDate && f.target_date < startDate) return false;
    if (endDate && f.target_date > endDate) return false;
    if (sourceId && f.source_id !== Number(sourceId)) return false;
    return true;
  });
  
  const aggMap = {};
  data.daily_aggregates.filter(a => a.device_id === devId).forEach(a => { aggMap[a.date] = a; });
  
  const pairData = forecasts
    .filter(f => aggMap[f.target_date])
    .map(f => {
      const a = aggMap[f.target_date];
      const fTempAvg = (f.temp_high != null && f.temp_low != null) ? (f.temp_high + f.temp_low) / 2 : null;
      const aTempAvg = (a.temp_max != null && a.temp_min != null) ? (a.temp_max + a.temp_min) / 2 : null;
      
      const tempBias = (fTempAvg != null && aTempAvg != null) ? Math.abs(fTempAvg - aTempAvg) : null;
      const tempHighBias = (f.temp_high != null && a.temp_max != null) ? Math.abs(f.temp_high - a.temp_max) : null;
      const tempLowBias = (f.temp_low != null && a.temp_min != null) ? Math.abs(f.temp_low - a.temp_min) : null;
      const tempCorrect = tempBias != null && tempBias <= 2;
      
      const fPrecip = ((f.precipitation_amount || 0) > 0.5) || ((f.precipitation_prob || 0) > 50);
      const aPrecip = (a.precipitation_total || 0) > 0.5;
      const precipCorrect = fPrecip === aPrecip;
      const precipBias = (f.precipitation_amount != null && a.precipitation_total != null)
        ? Math.abs(f.precipitation_amount - a.precipitation_total) : null;
      
      const windBias = (f.wind_speed != null && a.wind_speed_avg != null)
        ? Math.abs(f.wind_speed - a.wind_speed_avg) : null;
      const windCorrect = windBias != null && windBias <= 3;
      
      let periodKey;
      if (period === 'yearly') periodKey = f.target_date.substring(0, 4);
      else if (period === 'monthly') periodKey = f.target_date.substring(0, 7);
      else periodKey = f.target_date;
      
      return {
        period: periodKey,
        source_id: f.source_id,
        source_name: sourceMap[f.source_id] || '',
        tempBias, tempHighBias, tempLowBias, tempCorrect,
        precipCorrect, precipBias, windBias, windCorrect
      };
    });
  
  const grouped = {};
  pairData.forEach(p => {
    const key = `${p.period}|${p.source_id}`;
    if (!grouped[key]) grouped[key] = { ...p, items: [] };
    grouped[key].items.push(p);
  });
  
  return Object.values(grouped).map(g => {
    const vals = g.items;
    const total = vals.length;
    return {
      period: g.period,
      source_id: g.source_id,
      source_name: g.source_name,
      total_days: total,
      avg_temp_bias: db.round(db.avg(vals.map(v => v.tempBias))),
      avg_temp_high_bias: db.round(db.avg(vals.map(v => v.tempHighBias))),
      avg_temp_low_bias: db.round(db.avg(vals.map(v => v.tempLowBias))),
      temp_accuracy: total > 0 ? db.round(vals.filter(v => v.tempCorrect).length / total, 4) : null,
      precip_accuracy: total > 0 ? db.round(vals.filter(v => v.precipCorrect).length / total, 4) : null,
      avg_precip_bias: db.round(db.avg(vals.map(v => v.precipBias)), 1),
      wind_accuracy: total > 0 ? db.round(vals.filter(v => v.windCorrect).length / total, 4) : null,
      avg_wind_bias: db.round(db.avg(vals.map(v => v.windBias))),
      overall_accuracy: total > 0 ? db.round((
        vals.filter(v => v.tempCorrect).length / total +
        vals.filter(v => v.precipCorrect).length / total +
        vals.filter(v => v.windCorrect).length / total
      ) / 3, 4) : null
    };
  }).sort((a, b) => {
    const d = a.period.localeCompare(b.period);
    if (d !== 0) return d;
    return a.source_name.localeCompare(b.source_name, 'zh');
  });
}

router.get('/accuracy/:period', (req, res) => {
  const { device_id, source_id, year, month } = req.query;
  const period = req.params.period;
  
  if (!device_id) return res.status(400).json({ error: '设备ID为必填项' });
  if (!['yearly', 'monthly', 'daily'].includes(period)) {
    return res.status(400).json({ error: '周期参数必须是 yearly, monthly 或 daily' });
  }
  
  let startDate, endDate;
  if (period === 'yearly' && year) { startDate = `${year}-01-01`; endDate = `${year}-12-31`; }
  else if (period === 'monthly' && year) { startDate = `${year}-01-01`; endDate = `${year}-12-31`; }
  else if (period === 'daily' && month) {
    const [y, m] = month.split('-');
    if (y && m) {
      const last = new Date(Number(y), Number(m), 0).getDate();
      startDate = `${month}-01`; endDate = `${month}-${last}`;
    }
  }
  
  const result = buildAccuracyData(Number(device_id), startDate, endDate, source_id, period);
  res.json(result);
});

router.get('/source-comparison', (req, res) => {
  const data = db.getData();
  const { device_id, start_date, end_date } = req.query;
  
  if (!device_id) return res.status(400).json({ error: '设备ID为必填项' });
  const devId = Number(device_id);
  
  const result = buildAccuracyData(devId, start_date, end_date, null, 'yearly');
  
  const bySource = {};
  result.forEach(r => {
    if (!bySource[r.source_id]) bySource[r.source_id] = { source_id: r.source_id, source_name: r.source_name, rows: [] };
    bySource[r.source_id].rows.push(r);
  });
  
  const comparison = Object.values(bySource).map(s => {
    const rows = s.rows;
    const totalDays = rows.reduce((a, b) => a + (b.total_days || 0), 0);
    return {
      source_id: s.source_id,
      source_name: s.source_name,
      total_days: totalDays,
      avg_temp_bias: db.round(db.avg(rows.map(r => r.avg_temp_bias)), 2),
      temp_accuracy: db.round(db.avg(rows.map(r => r.temp_accuracy)), 1),
      precip_accuracy: db.round(db.avg(rows.map(r => r.precip_accuracy)), 1),
      avg_precip_bias: db.round(db.avg(rows.map(r => r.avg_precip_bias)), 2),
      wind_accuracy: db.round(db.avg(rows.map(r => r.wind_accuracy)), 1),
      avg_wind_bias: db.round(db.avg(rows.map(r => r.avg_wind_bias)), 2),
      overall_accuracy: db.round(db.avg(rows.map(r => r.overall_accuracy)), 1)
    };
  });
  
  comparison.sort((a, b) => (b.overall_accuracy || 0) - (a.overall_accuracy || 0));
  res.json(comparison);
});

router.get('/trend', (req, res) => {
  const { device_id, source_id, months = 12 } = req.query;
  if (!device_id) return res.status(400).json({ error: '设备ID为必填项' });
  
  const now = new Date();
  const numMonths = parseInt(months) || 12;
  const start = new Date(now.getFullYear(), now.getMonth() - (numMonths - 1), 1);
  const pad = n => String(n).padStart(2, '0');
  const startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-01`;
  
  const data = buildAccuracyData(Number(device_id), startDate, null, source_id, 'monthly');
  res.json(data);
});

router.get('/dashboard', (req, res) => {
  const data = db.getData();
  const { device_id, start_date, end_date } = req.query;
  
  if (!device_id) return res.status(400).json({ error: '设备ID为必填项' });
  const devId = Number(device_id);
  
  const sourceMap = {};
  data.forecast_sources.forEach(s => { sourceMap[s.id] = s.name; });
  
  let aggs = data.daily_aggregates.filter(a => a.device_id === devId);
  if (start_date) aggs = aggs.filter(a => a.date >= start_date);
  if (end_date) aggs = aggs.filter(a => a.date <= end_date);
  aggs.sort((a, b) => a.date.localeCompare(b.date));
  
  let forecasts = data.forecasts.filter(f => {
    if (f.forecast_range !== '1d') return false;
    if (start_date && f.target_date < start_date) return false;
    if (end_date && f.target_date > end_date) return false;
    return true;
  });
  
  const aggMap = {};
  aggs.forEach(a => { aggMap[a.date] = a; });
  
  const dailyData = {};
  aggs.forEach(a => {
    dailyData[a.date] = {
      date: a.date,
      temp_max: a.temp_max,
      temp_min: a.temp_min,
      temp_avg: a.temp_avg,
      precip: a.precipitation_total,
      wind: a.wind_speed_avg,
      wind_max: a.wind_speed_max,
      sources: {}
    };
  });
  
  forecasts.forEach(f => {
    const d = f.target_date;
    if (!dailyData[d]) return;
    const src = sourceMap[f.source_id] || '未知';
    dailyData[d].sources[src] = {
      temp_high: f.temp_high,
      temp_low: f.temp_low,
      precip: f.precipitation_amount,
      precip_prob: f.precipitation_prob,
      wind: f.wind_speed
    };
  });
  
  let events = data.extreme_events.filter(e => !e.device_id || e.device_id === devId);
  if (start_date) events = events.filter(e => (e.start_time || '') >= start_date);
  if (end_date) events = events.filter(e => (e.start_time || '') <= end_date + ' 23:59:59');
  events.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  
  const sourceStats = {};
  forecasts.forEach(f => {
    const a = aggMap[f.target_date];
    if (!a) return;
    const src = sourceMap[f.source_id] || '未知';
    if (!sourceStats[src]) sourceStats[src] = { src, precipCorrect: 0, precipTotal: 0, windBiases: [] };
    
    sourceStats[src].precipTotal++;
    const fp = ((f.precipitation_amount || 0) > 0.5) || ((f.precipitation_prob || 0) > 50);
    const ap = (a.precipitation_total || 0) > 0.5;
    if (fp === ap) sourceStats[src].precipCorrect++;
    
    if (f.wind_speed != null && a.wind_speed_avg != null) {
      sourceStats[src].windBiases.push(Math.abs(f.wind_speed - a.wind_speed_avg));
    }
  });
  
  const sourceStatsArr = Object.values(sourceStats).map(s => ({
    source_name: s.src,
    precip_accuracy: s.precipTotal > 0 ? db.round(s.precipCorrect / s.precipTotal, 4) : null,
    avg_wind_bias: db.round(db.avg(s.windBiases), 2)
  }));
  
  res.json({
    daily_data: Object.values(dailyData),
    events,
    source_stats: sourceStatsArr
  });
});

module.exports = router;
