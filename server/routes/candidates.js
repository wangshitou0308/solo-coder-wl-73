const express = require('express');
const router = express.Router();
const db = require('../db.js');
const dayjs = require('dayjs');

const EVENT_TYPE_MAP = {
  high_temperature: { name: '高温', icon: '🔥', severity: 'warning' },
  low_temperature: { name: '低温', icon: '❄️', severity: 'warning' },
  heavy_rain: { name: '暴雨', icon: '🌧️', severity: 'danger' },
  strong_wind: { name: '大风', icon: '💨', severity: 'warning' },
  heavy_precipitation: { name: '强降水', icon: '🌊', severity: 'warning' },
  pressure_drop: { name: '气压骤降', icon: '📉', severity: 'warning' },
  temperature_surge: { name: '温度突变', icon: '⚡', severity: 'warning' },
  precipitation_surge: { name: '降水突增', icon: '🌊', severity: 'warning' },
};

const detectExtremeEvents = (deviceId) => {
  const data = db.getData();
  const candidates = [];
  const now = dayjs();

  const observations = data.observations
    .filter(o => o.device_id === deviceId && o.frequency === 'hourly')
    .sort((a, b) => dayjs(b.record_time).valueOf() - dayjs(a.record_time).valueOf());

  if (observations.length < 2) {
    return candidates;
  }

  const dailyAggregates = data.daily_aggregates
    .filter(d => d.device_id === deviceId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const thresholds = (data.alert_thresholds || []).filter(t => t.enabled);

  const existingCandidates = data.candidate_events || [];

  const isDuplicate = (type, startTime, endTime) => {
    return existingCandidates.some(c =>
      c.device_id === deviceId &&
      c.event_type === type &&
      c.status === 'pending' &&
      dayjs(c.start_time).isSame(startTime, 'hour')
    );
  };

  const addCandidate = (type, startTime, endTime, severity, details) => {
    if (isDuplicate(type, startTime, endTime)) return;

    const typeInfo = EVENT_TYPE_MAP[type] || { name: type, icon: '⚠️', severity };
    const candidate = {
      device_id: deviceId,
      event_type: type,
      event_name: typeInfo.name,
      icon: typeInfo.icon,
      severity: severity || typeInfo.severity,
      start_time: startTime.format('YYYY-MM-DD HH:mm:ss'),
      end_time: endTime.format('YYYY-MM-DD HH:mm:ss'),
      details,
      status: 'pending',
      confidence: calculateConfidence(type, details),
      triggered_rules: details?.triggered_rules || [],
      peak_values: details?.peak_values || {},
    };

    candidates.push(candidate);
  };

  for (const threshold of thresholds) {
    if (threshold.operator === 'change' || threshold.operator === 'drop' || threshold.operator === 'increase') {
      detectChangeEvent(observations, threshold, deviceId, addCandidate);
    } else if (threshold.time_window_hours && threshold.operator === '>=') {
      detectTimeWindowEvent(observations, threshold, deviceId, addCandidate);
    } else {
      detectSingleValueEvent(observations, threshold, deviceId, addCandidate, dailyAggregates);
    }
  }

  return candidates;
};

const detectSingleValueEvent = (observations, threshold, deviceId, addCandidate, dailyAggregates) => {
  const { metric, operator, value, severity, name } = threshold;

  let eventType;
  if (metric === 'temperature' && operator === '>=') eventType = 'high_temperature';
  else if (metric === 'temperature' && operator === '<=') eventType = 'low_temperature';
  else if (metric === 'precipitation' && operator === '>=') eventType = 'heavy_rain';
  else if (metric === 'wind_speed' && operator === '>=') eventType = 'strong_wind';

  if (!eventType) return;

  const triggerObs = observations.find(o => {
    const val = o[metric];
    if (val == null) return false;
    switch (operator) {
      case '>=': return val >= value;
      case '<=': return val <= value;
      default: return false;
    }
  });

  if (!triggerObs) return;

  const startTime = dayjs(triggerObs.record_time).subtract(1, 'hour');
  const endTime = dayjs(triggerObs.record_time).add(2, 'hour');

  const windowObs = observations.filter(o =>
    dayjs(o.record_time).isAfter(startTime) &&
    dayjs(o.record_time).isBefore(endTime)
  );

  const metricValues = windowObs.map(o => o[metric]).filter(v => v != null);
  const peakValue = metricValues.length ? Math[operator === '<=' ? 'min' : 'max'](...metricValues) : triggerObs[metric];

  addCandidate(eventType, startTime, endTime, severity, {
    triggered_rules: [{
      rule: name,
      metric,
      operator,
      threshold: value,
      actual_value: triggerObs[metric],
    }],
    peak_values: { [metric]: peakValue },
    observations_count: windowObs.length,
    trigger_observation: triggerObs,
  });
};

const detectTimeWindowEvent = (observations, threshold, deviceId, addCandidate) => {
  const { metric, operator, value, severity, name, time_window_hours } = threshold;

  if (operator !== '>=' || !time_window_hours) return;

  const now = dayjs();
  const windowStart = now.subtract(time_window_hours, 'hour');

  const windowObs = observations.filter(o =>
    dayjs(o.record_time).isAfter(windowStart) &&
    o[metric] != null
  );

  if (windowObs.length < 2) return;

  const total = windowObs.reduce((sum, o) => sum + (o[metric] || 0), 0);

  if (total >= value) {
    let eventType;
    if (metric === 'precipitation') eventType = 'heavy_precipitation';
    else return;

    const startTime = windowStart;
    const endTime = now;

    const metricValues = windowObs.map(o => o[metric]).filter(v => v != null);
    const peakValue = metricValues.length ? Math.max(...metricValues) : 0;

    addCandidate(eventType, startTime, endTime, severity, {
      triggered_rules: [{
        rule: name,
        metric,
        operator,
        threshold: value,
        actual_value: total,
        time_window_hours,
      }],
      peak_values: { [metric]: peakValue, [`${metric}_total`]: total },
      observations_count: windowObs.length,
    });
  }
};

const detectChangeEvent = (observations, threshold, deviceId, addCandidate) => {
  const { metric, operator, value, severity, name, time_window_hours } = threshold;

  if (!time_window_hours) return;

  const now = dayjs();
  const windowStart = now.subtract(time_window_hours, 'hour');

  const windowObs = observations.filter(o =>
    dayjs(o.record_time).isAfter(windowStart)
  );

  if (windowObs.length < 2) return;

  windowObs.sort((a, b) => dayjs(a.record_time).valueOf() - dayjs(b.record_time).valueOf());

  const first = windowObs[0][metric];
  const last = windowObs[windowObs.length - 1][metric];

  if (first == null || last == null) return;

  const change = last - first;
  const absChange = Math.abs(change);

  let triggered = false;
  if (operator === 'change' && absChange >= value) triggered = true;
  else if (operator === 'drop' && change <= -value) triggered = true;
  else if (operator === 'increase' && change >= value) triggered = true;

  if (!triggered) return;

  let eventType;
  if (metric === 'temperature' && operator === 'change') eventType = 'temperature_surge';
  else if (metric === 'pressure' && operator === 'drop') eventType = 'pressure_drop';
  else if (metric === 'precipitation' && operator === 'increase') eventType = 'precipitation_surge';
  else return;

  const startTime = dayjs(windowObs[0].record_time);
  const endTime = dayjs(windowObs[windowObs.length - 1].record_time);

  const metricValues = windowObs.map(o => o[metric]).filter(v => v != null);
  const peakValue = metricValues.length ? (change > 0 ? Math.max(...metricValues) : Math.min(...metricValues)) : last;

  addCandidate(eventType, startTime, endTime, severity, {
    triggered_rules: [{
      rule: name,
      metric,
      operator,
      threshold: value,
      actual_value: change,
      start_value: first,
      end_value: last,
      time_window_hours,
    }],
    peak_values: { [metric]: peakValue },
    observations_count: windowObs.length,
    first_observation: windowObs[0],
    last_observation: windowObs[windowObs.length - 1],
  });
};

const calculateConfidence = (type, details) => {
  if (!details) return 70;

  let confidence = 80;

  if (details.observations_count) {
    confidence += Math.min(10, details.observations_count * 2);
  }

  if (details.triggered_rules) {
    confidence += details.triggered_rules.length * 5;
  }

  return Math.min(95, Math.max(50, confidence));
};

router.get('/', (req, res) => {
  const { device_id, status } = req.query;
  const data = db.getData();
  let candidates = data.candidate_events || [];

  if (device_id) {
    candidates = candidates.filter(c => c.device_id === Number(device_id));
  }

  if (status) {
    candidates = candidates.filter(c => c.status === status);
  }

  candidates.sort((a, b) =>
    dayjs(b.created_at || b.start_time).valueOf() - dayjs(a.created_at || a.start_time).valueOf()
  );

  res.json(candidates);
});

router.post('/detect', (req, res) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const data = db.getData();
  const device = data.devices.find(d => d.id === Number(device_id));
  
  if (!device) {
    return res.status(404).json({ error: '设备不存在' });
  }

  const candidates = detectExtremeEvents(Number(device_id));
  const savedCandidates = [];

  for (const candidate of candidates) {
    const r = db.insert('candidate_events', candidate);
    savedCandidates.push(r);
  }

  res.json({
    detected: savedCandidates.length,
    candidates: savedCandidates,
  });
});

router.post('/:id/promote', (req, res) => {
  const id = Number(req.params.id);
  const data = db.getData();
  const candidate = (data.candidate_events || []).find(c => c.id === id);

  if (!candidate) {
    return res.status(404).json({ error: '候选事件不存在' });
  }

  if (candidate.status !== 'pending') {
    return res.status(400).json({ error: '该候选事件已处理' });
  }

  const eventData = {
    device_id: candidate.device_id,
    event_type: candidate.event_type,
    event_name: candidate.event_name || candidate.event_type,
    start_time: candidate.start_time,
    end_time: candidate.end_time,
    severity: candidate.severity,
    description: `自动识别：${candidate.event_name}事件（置信度 ${candidate.confidence}%）`,
    notes: JSON.stringify({
      source: 'auto_detection',
      candidate_id: id,
      confidence: candidate.confidence,
      triggered_rules: candidate.triggered_rules,
      peak_values: candidate.peak_values,
      details: candidate.details,
    }),
  };

  const event = db.insert('extreme_events', eventData);
  db.update('candidate_events', id, {
    status: 'promoted',
    promoted_to_event_id: event.id,
    processed_at: db.localNow(),
  });

  res.json({
    success: true,
    event_id: event.id,
    event,
  });
});

router.post('/:id/dismiss', (req, res) => {
  const id = Number(req.params.id);
  const data = db.getData();
  const candidate = (data.candidate_events || []).find(c => c.id === id);

  if (!candidate) {
    return res.status(404).json({ error: '候选事件不存在' });
  }

  db.update('candidate_events', id, {
    status: 'dismissed',
    processed_at: db.localNow(),
  });

  res.json({ success: true });
});

module.exports = router;
