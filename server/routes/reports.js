const express = require('express');
const db = require('../db');

const router = express.Router();

let jsPDF;
let autoTable;
try {
  jsPDF = require('jspdf').jsPDF;
  autoTable = require('jspdf-autotable').default || require('jspdf-autotable');
} catch (e) {
  console.warn('PDF依赖加载失败:', e.message);
}

router.get('/yearly-csv', (req, res) => {
  const { device_id, year } = req.query;
  if (!device_id || !year) return res.status(400).json({ error: '设备ID和年份为必填项' });
  
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  const statsRouter = require('./stats');
  
  const { Router } = express;
  const testRouter = Router();
  
  const accuracyData = require('./stats');
  const buildAccuracy = require('./stats');
  
  const statsData = getAccuracyMonthly(Number(device_id), startDate, endDate, year);
  
  const eventStart = `${year}-01-01 00:00:00`;
  const eventEnd = `${year}-12-31 23:59:59`;
  const data = db.getData();
  const events = data.extreme_events.filter(e => {
    const matchDevice = !e.device_id || e.device_id === Number(device_id);
    const matchTime = (e.start_time || '') >= eventStart && (e.start_time || '') <= eventEnd;
    return matchDevice && matchTime;
  });
  events.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  
  const device = db.findById('devices', Number(device_id)) || {};
  
  const csvLines = [];
  csvLines.push(`个人气象站年度预报验证报告 - ${year}年`);
  csvLines.push(`设备: ${device.model || '未知'} - ${device.location || ''}`);
  csvLines.push('');
  csvLines.push('按月预报准确率统计:');
  csvLines.push(['月份', '预报来源', '验证天数', '平均温度偏差(°C)', '温度准确率(%)', '降水准确率(%)', '平均降水量偏差(mm)', '风速准确率(%)', '平均风速偏差(m/s)', '综合准确率(%)'].join(','));
  
  statsData.forEach(s => {
    csvLines.push([s.period, s.source_name, s.total_days, s.avg_temp_bias || '', s.temp_accuracy || '',
      s.precip_accuracy || '', s.avg_precip_bias || '', s.wind_accuracy || '', s.avg_wind_bias || '', s.overall_accuracy || ''].join(','));
  });
  
  csvLines.push('');
  csvLines.push('极端天气事件记录:');
  csvLines.push(['事件类型', '开始时间', '结束时间', '温度极值', '风速极值', '总降水量(mm)', '描述'].join(','));
  events.forEach(e => {
    csvLines.push([e.event_type, e.start_time || '', e.end_time || '',
      e.temp_extreme != null ? e.temp_extreme : '',
      e.wind_extreme != null ? e.wind_extreme : '',
      e.precipitation_total != null ? e.precipitation_total : '',
      ((e.description || '').replace(/[,\n]/g, ' '))].join(','));
  });
  
  const csv = '\ufeff' + csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="weather-report-${year}.csv"`);
  res.send(csv);
});

function getAccuracyMonthly(devId, startDate, endDate, year) {
  const data = db.getData();
  const sourceMap = {};
  data.forecast_sources.forEach(s => { sourceMap[s.id] = s.name; });
  
  const forecasts = data.forecasts.filter(f =>
    f.forecast_range === '1d' && f.target_date >= startDate && f.target_date <= endDate);
  
  const aggMap = {};
  data.daily_aggregates.filter(a => a.device_id === devId).forEach(a => { aggMap[a.date] = a; });
  
  const pairData = forecasts
    .filter(f => aggMap[f.target_date])
    .map(f => {
      const a = aggMap[f.target_date];
      const fTempAvg = (f.temp_high != null && f.temp_low != null) ? (f.temp_high + f.temp_low) / 2 : null;
      const aTempAvg = (a.temp_max != null && a.temp_min != null) ? (a.temp_max + a.temp_min) / 2 : null;
      
      const tempBias = (fTempAvg != null && aTempAvg != null) ? Math.abs(fTempAvg - aTempAvg) : null;
      const tempCorrect = tempBias != null && tempBias <= 2;
      
      const fPrecip = ((f.precipitation_amount || 0) > 0.5) || ((f.precipitation_prob || 0) > 50);
      const aPrecip = (a.precipitation_total || 0) > 0.5;
      const precipCorrect = fPrecip === aPrecip;
      const precipBias = (f.precipitation_amount != null && a.precipitation_total != null)
        ? Math.abs(f.precipitation_amount - a.precipitation_total) : null;
      
      const windBias = (f.wind_speed != null && a.wind_speed_avg != null)
        ? Math.abs(f.wind_speed - a.wind_speed_avg) : null;
      const windCorrect = windBias != null && windBias <= 3;
      
      return {
        period: f.target_date.substring(0, 7),
        source_id: f.source_id,
        source_name: sourceMap[f.source_id] || '',
        tempBias, tempCorrect, precipCorrect, precipBias, windBias, windCorrect
      };
    });
  
  const grouped = {};
  pairData.forEach(p => {
    const key = `${p.period}|${p.source_id}`;
    if (!grouped[key]) grouped[key] = { period: p.period, source_id: p.source_id, source_name: p.source_name, items: [] };
    grouped[key].items.push(p);
  });
  
  return Object.values(grouped).map(g => {
    const vals = g.items;
    const total = vals.length;
    return {
      period: g.period,
      source_name: g.source_name,
      total_days: total,
      avg_temp_bias: db.round(db.avg(vals.map(v => v.tempBias))),
      temp_accuracy: total > 0 ? db.round(vals.filter(v => v.tempCorrect).length * 100 / total, 1) : null,
      precip_accuracy: total > 0 ? db.round(vals.filter(v => v.precipCorrect).length * 100 / total, 1) : null,
      avg_precip_bias: db.round(db.avg(vals.map(v => v.precipBias)), 1),
      wind_accuracy: total > 0 ? db.round(vals.filter(v => v.windCorrect).length * 100 / total, 1) : null,
      avg_wind_bias: db.round(db.avg(vals.map(v => v.windBias))),
      overall_accuracy: total > 0 ? db.round((
        vals.filter(v => v.tempCorrect).length * 100 / total +
        vals.filter(v => v.precipCorrect).length * 100 / total +
        vals.filter(v => v.windCorrect).length * 100 / total
      ) / 3, 1) : null
    };
  }).sort((a, b) => {
    const d = a.period.localeCompare(b.period);
    if (d !== 0) return d;
    return a.source_name.localeCompare(b.source_name, 'zh');
  });
}

router.get('/yearly-pdf', async (req, res) => {
  try {
    if (!jsPDF || !autoTable) {
      return res.status(500).json({ error: 'PDF生成依赖未正确加载，请检查jspdf和jspdf-autotable是否已安装' });
    }
    
    const { device_id, year } = req.query;
    if (!device_id || !year) return res.status(400).json({ error: '设备ID和年份为必填项' });
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const devId = Number(device_id);
    
    const statsData = getAccuracyMonthly(devId, startDate, endDate, year);
    
    const data = db.getData();
    const events = data.extreme_events.filter(e => {
      const matchDevice = !e.device_id || e.device_id === devId;
      const matchTime = (e.start_time || '').startsWith(year);
      return matchDevice && matchTime;
    });
    
    const device = db.findById('devices', devId) || {};
    
    const bySource = {};
    statsData.forEach(s => {
      if (!bySource[s.source_name]) bySource[s.source_name] = [];
      bySource[s.source_name].push(s);
    });
    
    const overall = Object.keys(bySource).map(src => {
      const rows = bySource[src];
      const total = rows.reduce((a, b) => a + (b.total_days || 0), 0);
      return {
        src,
        avg_temp_bias: db.round(db.avg(rows.map(r => r.avg_temp_bias)), 1),
        temp_accuracy: db.round(db.avg(rows.map(r => r.temp_accuracy)), 1),
        precip_accuracy: db.round(db.avg(rows.map(r => r.precip_accuracy)), 1),
        wind_accuracy: db.round(db.avg(rows.map(r => r.wind_accuracy)), 1),
        overall_accuracy: db.round(db.avg(rows.map(r => r.overall_accuracy)), 1)
      };
    });
    
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text(`${year}年度个人气象站预报验证报告`, 148, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`设备: ${device.model || '未知'}    位置: ${device.location || '未知'}    安装日期: ${device.installation_date || '-'}`, 148, 24, { align: 'center' });
    doc.text(`报告生成时间: ${new Date().toLocaleString('zh-CN')}`, 148, 31, { align: 'center' });
    
    let yPos = 42;
    autoTable(doc, {
      head: [['预报来源', '年均温度偏差(°C)', '温度准确率(%)', '降水准确率(%)', '风速准确率(%)', '综合准确率(%)']],
      body: overall.map(o => [o.src, o.avg_temp_bias || '', o.temp_accuracy || '', o.precip_accuracy || '', o.wind_accuracy || '', o.overall_accuracy || '']),
      startY: yPos,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 153, 225] },
      theme: 'striped'
    });
    
    yPos = (doc.lastAutoTable.finalY || yPos) + 10;
    
    autoTable(doc, {
      head: [['月份', '来源', '验证天数', '温度偏差(°C)', '温度准(%)', '降水准(%)', '降水偏差(mm)', '风速准(%)', '风速偏差(m/s)', '综合(%)']],
      body: statsData.map(s => [s.period, s.source_name, s.total_days, s.avg_temp_bias || '', s.temp_accuracy || '', s.precip_accuracy || '', s.avg_precip_bias || '', s.wind_accuracy || '', s.avg_wind_bias || '', s.overall_accuracy || '']),
      startY: yPos,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [72, 187, 120] },
      theme: 'grid'
    });
    
    yPos = (doc.lastAutoTable.finalY || yPos) + 10;
    
    if (events.length > 0) {
      autoTable(doc, {
        head: [['类型', '开始时间', '结束时间', '温度极值', '风速极值', '降水量(mm)', '描述']],
        body: events.map(e => [e.event_type, e.start_time || '', e.end_time || '',
          e.temp_extreme != null ? e.temp_extreme : '-',
          e.wind_extreme != null ? e.wind_extreme : '-',
          e.precipitation_total != null ? e.precipitation_total : '-',
          ((e.description || '').slice(0, 30))]),
        startY: yPos,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [237, 100, 100] },
        theme: 'striped'
      });
    }
    
    const buffer = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weather-report-${year}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
