const express = require('express');
const router = express.Router();
const db = require('../db.js');
const dayjs = require('dayjs');

const EVENT_TYPE_MAP = {
  temperature: {
    '>=': '高温',
    '<=': '低温',
  },
  precipitation: {
    '>=': '强降水',
  },
  wind_speed: {
    '>=': '大风',
  },
  pressure: {
    'drop': '气压骤降',
    '>=': '高压',
    '<=': '低压',
  },
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'danger': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'info': return '#3b82f6';
    default: return '#6b7280';
  }
};

const evaluateThreshold = (value, threshold) => {
  if (value == null) return false;
  const { operator, value: thresholdValue } = threshold;
  
  switch (operator) {
    case '>=': return value >= thresholdValue;
    case '<=': return value <= thresholdValue;
    case '>': return value > thresholdValue;
    case '<': return value < thresholdValue;
    case '==': return value === thresholdValue;
    default: return false;
  }
};

const evaluateChange = (observations, threshold) => {
  const { metric, operator, value: thresholdValue, time_window_hours } = threshold;
  
  if (
    observations.length < 2 ||
    !time_window_hours ||
    (operator !== 'change' && operator !== 'drop' && operator !== 'increase')
  ) {
    return { triggered: false, details: null };
  }

  const now = dayjs();
  const windowStart = now.subtract(time_window_hours, 'hour');
  
  const windowObs = observations.filter(o =>
    dayjs(o.record_time).isAfter(windowStart)
  );

  if (windowObs.length < 2) {
    return { triggered: false, details: null };
  }

  windowObs.sort((a, b) => dayjs(a.record_time).valueOf() - dayjs(b.record_time).valueOf());

  const first = windowObs[0][metric];
  const last = windowObs[windowObs.length - 1][metric];

  if (first == null || last == null) {
    return { triggered: false, details: null };
  }

  const change = last - first;
  const absChange = Math.abs(change);

  let triggered = false;
  if (operator === 'change') {
    triggered = absChange >= thresholdValue;
  } else if (operator === 'drop') {
    triggered = change <= -thresholdValue;
  } else if (operator === 'increase') {
    triggered = change >= thresholdValue;
  }

  return {
    triggered,
    details: {
      start_value: first,
      end_value: last,
      change,
      abs_change: absChange,
      window_hours: time_window_hours,
      observation_count: windowObs.length,
    },
  };
};

const evaluateTimeWindowThreshold = (observations, threshold) => {
  const { metric, operator, value: thresholdValue, time_window_hours } = threshold;
  
  if (!time_window_hours || operator !== '>=') {
    return { triggered: false, details: null };
  }

  const now = dayjs();
  const windowStart = now.subtract(time_window_hours, 'hour');
  
  const windowObs = observations.filter(o =>
    dayjs(o.record_time).isAfter(windowStart) &&
    o[metric] != null
  );

  if (windowObs.length === 0) {
    return { triggered: false, details: null };
  }

  const total = windowObs.reduce((sum, o) => sum + (o[metric] || 0), 0);

  return {
    triggered: total >= thresholdValue,
    details: {
      total,
      threshold: thresholdValue,
      window_hours: time_window_hours,
      observation_count: windowObs.length,
    },
  };
};

router.get('/thresholds', (req, res) => {
  const data = db.getData();
  res.json(data.alert_thresholds || []);
});

router.post('/thresholds', (req, res) => {
  const { name, metric, operator, value, severity, enabled, time_window_hours } = req.body;
  
  if (!name || !metric || !operator || value == null) {
    return res.status(400).json({ error: '名称、指标、操作符和阈值为必填项' });
  }

  const threshold = {
    name,
    metric,
    operator,
    value: Number(value),
    severity: severity || 'warning',
    enabled: enabled !== false,
    time_window_hours: time_window_hours ? Number(time_window_hours) : null,
  };

  const r = db.insert('alert_thresholds', threshold);
  res.status(201).json(r);
});

router.put('/thresholds/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = db.getData();
  const existing = (data.alert_thresholds || []).find(t => t.id === id);
  
  if (!existing) {
    return res.status(404).json({ error: '阈值配置不存在' });
  }

  const { name, metric, operator, value, severity, enabled, time_window_hours } = req.body;

  const updated = {};
  if (name !== undefined) updated.name = name;
  if (metric !== undefined) updated.metric = metric;
  if (operator !== undefined) updated.operator = operator;
  if (value !== undefined) updated.value = Number(value);
  if (severity !== undefined) updated.severity = severity;
  if (enabled !== undefined) updated.enabled = enabled;
  if (time_window_hours !== undefined) {
    updated.time_window_hours = time_window_hours ? Number(time_window_hours) : null;
  }

  db.update('alert_thresholds', id, updated);
  res.json({ success: true });
});

router.delete('/thresholds/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = db.getData();
  const existing = (data.alert_thresholds || []).find(t => t.id === id);
  
  if (!existing) {
    return res.status(404).json({ error: '阈值配置不存在' });
  }

  db.remove('alert_thresholds', id);
  res.json({ success: true });
});

router.get('/check', (req, res) => {
  const { device_id } = req.query;
  const data = db.getData();
  
  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const devId = Number(device_id);
  const thresholds = (data.alert_thresholds || []).filter(t => t.enabled);
  const observations = data.observations
    .filter(o => o.device_id === devId && o.frequency === 'hourly')
    .sort((a, b) => dayjs(b.record_time).valueOf() - dayjs(a.record_time).valueOf());

  if (observations.length === 0) {
    return res.json([]);
  }

  const latest = observations[0];
  const results = [];

  for (const threshold of thresholds) {
    let result = {
      threshold_id: threshold.id,
      name: threshold.name,
      metric: threshold.metric,
      severity: threshold.severity,
      triggered: false,
      current_value: null,
      details: null,
      threshold: threshold.value,
      operator: threshold.operator,
      color: getSeverityColor(threshold.severity),
    };

    if (threshold.operator === 'change' || threshold.operator === 'drop' || threshold.operator === 'increase') {
      const evalResult = evaluateChange(observations, threshold);
      result.triggered = evalResult.triggered;
      result.details = evalResult.details;
      if (evalResult.details) {
        result.current_value = evalResult.details.end_value;
      }
    } else if (threshold.time_window_hours && threshold.operator === '>=') {
      const evalResult = evaluateTimeWindowThreshold(observations, threshold);
      result.triggered = evalResult.triggered;
      result.details = evalResult.details;
      if (evalResult.details) {
        result.current_value = evalResult.details.total;
      }
    } else {
      const value = latest[threshold.metric];
      result.current_value = value;
      result.triggered = evaluateThreshold(value, threshold);
    }

    results.push(result);
  }

  res.json(results);
});

router.get('/risk-level', (req, res) => {
  const { device_id } = req.query;
  
  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const data = db.getData();
  const devId = Number(device_id);
  const thresholds = (data.alert_thresholds || []).filter(t => t.enabled);
  const observations = data.observations
    .filter(o => o.device_id === devId && o.frequency === 'hourly')
    .sort((a, b) => dayjs(b.record_time).valueOf() - dayjs(a.record_time).valueOf());

  if (observations.length === 0) {
    return res.json({
      level: 'none',
      level_text: '无风险',
      color: '#10b981',
      triggered_alerts: [],
      overall_score: 0,
    });
  }

  const latest = observations[0];
  const triggeredAlerts = [];
  let maxSeverity = 'none';

  for (const threshold of thresholds) {
    let triggered = false;

    if (threshold.operator === 'change' || threshold.operator === 'drop' || threshold.operator === 'increase') {
      const evalResult = evaluateChange(observations, threshold);
      triggered = evalResult.triggered;
    } else if (threshold.time_window_hours && threshold.operator === '>=') {
      const evalResult = evaluateTimeWindowThreshold(observations, threshold);
      triggered = evalResult.triggered;
    } else {
      triggered = evaluateThreshold(latest[threshold.metric], threshold);
    }

    if (triggered) {
      triggeredAlerts.push({
        id: threshold.id,
        name: threshold.name,
        metric: threshold.metric,
        severity: threshold.severity,
        value: latest[threshold.metric],
        operator: threshold.operator,
        threshold: threshold.value,
      });

      if (threshold.severity === 'danger') {
        maxSeverity = 'danger';
      } else if (threshold.severity === 'warning' && maxSeverity !== 'danger') {
        maxSeverity = 'warning';
      } else if (maxSeverity === 'none') {
        maxSeverity = 'info';
      }
    }
  }

  const levelMap = {
    none: { text: '无风险', color: '#10b981', score: 0 },
    info: { text: '注意', color: '#3b82f6', score: 25 },
    warning: { text: '预警', color: '#f59e0b', score: 60 },
    danger: { text: '危险', color: '#ef4444', score: 90 },
  };

  const levelInfo = levelMap[maxSeverity];

  res.json({
    level: maxSeverity,
    level_text: levelInfo.text,
    color: levelInfo.color,
    triggered_alerts: triggeredAlerts,
    overall_score: Math.min(100, levelInfo.score + triggeredAlerts.length * 2),
    latest_observation: {
      record_time: latest.record_time,
      temperature: latest.temperature,
      humidity: latest.humidity,
      pressure: latest.pressure,
      wind_speed: latest.wind_speed,
      precipitation: latest.precipitation,
      feels_like: latest.feels_like,
    },
  });
});

module.exports = router;
