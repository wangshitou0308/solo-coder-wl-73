const express = require('express');
const router = express.Router();
const db = require('../db.js');
const dayjs = require('dayjs');

const getDefaultWeights = () => {
  const data = db.getData();
  const weights = data.scoring_weights || [];
  return weights.find(w => w.is_default) || weights[0] || {
    temp_weight: 0.4,
    precip_weight: 0.35,
    wind_weight: 0.25,
  };
};

const calcMetricAccuracy = (forecasted, actual, tolerance) => {
  if (forecasted == null || actual == null) return null;
  const error = Math.abs(forecasted - actual);
  return Math.max(0, 100 - (error / tolerance) * 100);
};

const calcTemperatureAccuracy = (forecasted, actual) => {
  return calcMetricAccuracy(forecasted, actual, 3);
};

const calcPrecipitationAccuracy = (forecasted, actual) => {
  if (forecasted == null || actual == null) return null;
  const maxVal = Math.max(Math.abs(forecasted), Math.abs(actual), 1);
  const error = Math.abs(forecasted - actual);
  return Math.max(0, 100 - (error / maxVal) * 50);
};

const calcWindSpeedAccuracy = (forecasted, actual) => {
  return calcMetricAccuracy(forecasted, actual, 5);
};

const buildAccuracyPairs = (deviceId, params) => {
  const data = db.getData();
  const pairs = [];

  const forecasts = data.forecasts.filter(f => f.device_id === deviceId);
  const observations = data.observations.filter(o => o.device_id === deviceId && o.frequency === 'daily');

  const obsMap = {};
  for (const obs of observations) {
    const date = obs.record_time.substring(0, 10);
    obsMap[date] = obs;
  }

  for (const forecast of forecasts) {
    const date = forecast.forecast_date.substring(0, 10);
    const obs = obsMap[date];
    if (!obs) continue;

    pairs.push({
      date,
      source: forecast.source,
      forecast,
      observation: obs,
      temp_accuracy: calcTemperatureAccuracy(forecast.temperature, obs.temperature),
      precip_accuracy: calcPrecipitationAccuracy(forecast.precipitation, obs.precipitation),
      wind_accuracy: calcWindSpeedAccuracy(forecast.wind_speed, obs.wind_speed),
    });
  }

  return pairs;
};

const classifyWeatherType = (obs) => {
  if (obs.precipitation >= 50) return '暴雨';
  if (obs.precipitation >= 10) return '雨天';
  if (obs.wind_speed >= 17) return '大风';
  if (obs.temperature >= 35) return '高温';
  if (obs.temperature <= -10) return '低温';
  return '晴天';
};

const getSeason = (dateStr) => {
  const month = parseInt(dateStr.substring(5, 7));
  if (month >= 3 && month <= 5) return '春季';
  if (month >= 6 && month <= 8) return '夏季';
  if (month >= 9 && month <= 11) return '秋季';
  return '冬季';
};

router.get('/weights', (req, res) => {
  const data = db.getData();
  res.json(data.scoring_weights || []);
});

router.post('/weights', (req, res) => {
  const { name, temp_weight, precip_weight, wind_weight, is_default } = req.body;

  if (temp_weight == null || precip_weight == null || wind_weight == null) {
    return res.status(400).json({ error: '温度、降水、风速权重为必填项' });
  }

  const total = Number(temp_weight) + Number(precip_weight) + Number(wind_weight);
  if (Math.abs(total - 1) > 0.001) {
    return res.status(400).json({ error: '权重之和必须等于1' });
  }

  if (is_default) {
    const data = db.getData();
    (data.scoring_weights || []).forEach(w => {
      w.is_default = false;
    });
  }

  const weight = {
    name: name || '自定义权重',
    temp_weight: Number(temp_weight),
    precip_weight: Number(precip_weight),
    wind_weight: Number(wind_weight),
    is_default: is_default || false,
  };

  const r = db.insert('scoring_weights', weight);
  res.status(201).json(r);
});

router.put('/weights/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = db.getData();
  const existing = (data.scoring_weights || []).find(w => w.id === id);

  if (!existing) {
    return res.status(404).json({ error: '权重配置不存在' });
  }

  const { name, temp_weight, precip_weight, wind_weight, is_default } = req.body;

  if (temp_weight != null || precip_weight != null || wind_weight != null) {
    const tw = temp_weight != null ? Number(temp_weight) : existing.temp_weight;
    const pw = precip_weight != null ? Number(precip_weight) : existing.precip_weight;
    const ww = wind_weight != null ? Number(wind_weight) : existing.wind_weight;
    const total = tw + pw + ww;
    if (Math.abs(total - 1) > 0.001) {
      return res.status(400).json({ error: '权重之和必须等于1' });
    }
  }

  if (is_default) {
    (data.scoring_weights || []).forEach(w => {
      if (w.id !== id) w.is_default = false;
    });
  }

  const updated = {};
  if (name !== undefined) updated.name = name;
  if (temp_weight !== undefined) updated.temp_weight = Number(temp_weight);
  if (precip_weight !== undefined) updated.precip_weight = Number(precip_weight);
  if (wind_weight !== undefined) updated.wind_weight = Number(wind_weight);
  if (is_default !== undefined) updated.is_default = is_default;

  db.update('scoring_weights', id, updated);
  res.json({ success: true });
});

router.post('/weights/:id/default', (req, res) => {
  const id = Number(req.params.id);
  const data = db.getData();
  const existing = (data.scoring_weights || []).find(w => w.id === id);

  if (!existing) {
    return res.status(404).json({ error: '权重配置不存在' });
  }

  (data.scoring_weights || []).forEach(w => {
    w.is_default = w.id === id;
  });
  db.save();

  res.json({ success: true });
});

router.get('/ranking', (req, res) => {
  const { device_id, month, season, weather_type, weight_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const data = db.getData();
  const weights = weight_id
    ? (data.scoring_weights || []).find(w => w.id === Number(weight_id))
    : getDefaultWeights();

  let pairs = buildAccuracyPairs(Number(device_id), req.query);

  if (month) {
    pairs = pairs.filter(p => p.date.substring(5, 7) === month);
  }

  if (season) {
    pairs = pairs.filter(p => getSeason(p.date) === season);
  }

  if (weather_type) {
    pairs = pairs.filter(p => classifyWeatherType(p.observation) === weather_type);
  }

  const sourceScores = {};
  const sourceCounts = {};

  for (const pair of pairs) {
    const source = pair.source;
    if (!sourceScores[source]) {
      sourceScores[source] = {
        temp_sum: 0,
        precip_sum: 0,
        wind_sum: 0,
        temp_count: 0,
        precip_count: 0,
        wind_count: 0,
      };
      sourceCounts[source] = 0;
    }

    if (pair.temp_accuracy != null) {
      sourceScores[source].temp_sum += pair.temp_accuracy;
      sourceScores[source].temp_count++;
    }
    if (pair.precip_accuracy != null) {
      sourceScores[source].precip_sum += pair.precip_accuracy;
      sourceScores[source].precip_count++;
    }
    if (pair.wind_accuracy != null) {
      sourceScores[source].wind_sum += pair.wind_accuracy;
      sourceScores[source].wind_count++;
    }
    sourceCounts[source]++;
  }

  const ranking = Object.entries(sourceScores).map(([source, scores]) => {
    const temp_avg = scores.temp_count > 0 ? scores.temp_sum / scores.temp_count : 0;
    const precip_avg = scores.precip_count > 0 ? scores.precip_sum / scores.precip_count : 0;
    const wind_avg = scores.wind_count > 0 ? scores.wind_sum / scores.wind_count : 0;
    const composite = temp_avg * weights.temp_weight + precip_avg * weights.precip_weight + wind_avg * weights.wind_weight;

    return {
      source,
      sample_count: sourceCounts[source],
      temp_accuracy: temp_avg,
      precip_accuracy: precip_avg,
      wind_accuracy: wind_avg,
      composite_score: composite,
      weights: {
        temp: weights.temp_weight,
        precip: weights.precip_weight,
        wind: weights.wind_weight,
      },
    };
  });

  ranking.sort((a, b) => b.composite_score - a.composite_score);

  ranking.forEach((r, i) => {
    r.rank = i + 1;
  });

  res.json({
    ranking,
    weights,
    filters: {
      device_id,
      month,
      season,
      weather_type,
    },
  });
});

router.get('/recommendations', (req, res) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const devId = Number(device_id);
  const recommendations = {};

  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const seasons = ['春季', '夏季', '秋季', '冬季'];
  const weatherTypes = ['晴天', '雨天', '大风', '高温', '低温', '暴雨'];

  recommendations.by_month = {};
  for (const month of months) {
    const { ranking } = (() => {
      const req = { query: { device_id: devId, month } };
      return getRankingForFilter(devId, { month });
    })();
    if (ranking && ranking.length > 0) {
      recommendations.by_month[month] = ranking[0];
    }
  }

  recommendations.by_season = {};
  for (const season of seasons) {
    const { ranking } = getRankingForFilter(devId, { season });
    if (ranking && ranking.length > 0) {
      recommendations.by_season[season] = ranking[0];
    }
  }

  recommendations.by_weather = {};
  for (const weather of weatherTypes) {
    const { ranking } = getRankingForFilter(devId, { weather_type: weather });
    if (ranking && ranking.length > 0) {
      recommendations.by_weather[weather] = ranking[0];
    }
  }

  const { ranking: overallRanking } = getRankingForFilter(devId, {});
  recommendations.overall = overallRanking && overallRanking.length > 0 ? overallRanking[0] : null;

  res.json(recommendations);
});

function getRankingForFilter(deviceId, filters) {
  const data = db.getData();
  const weights = getDefaultWeights();

  let pairs = buildAccuracyPairs(deviceId, {});

  if (filters.month) {
    pairs = pairs.filter(p => p.date.substring(5, 7) === filters.month);
  }
  if (filters.season) {
    pairs = pairs.filter(p => getSeason(p.date) === filters.season);
  }
  if (filters.weather_type) {
    pairs = pairs.filter(p => classifyWeatherType(p.observation) === filters.weather_type);
  }

  const sourceScores = {};
  const sourceCounts = {};

  for (const pair of pairs) {
    const source = pair.source;
    if (!sourceScores[source]) {
      sourceScores[source] = { temp_sum: 0, precip_sum: 0, wind_sum: 0, temp_count: 0, precip_count: 0, wind_count: 0 };
      sourceCounts[source] = 0;
    }
    if (pair.temp_accuracy != null) {
      sourceScores[source].temp_sum += pair.temp_accuracy;
      sourceScores[source].temp_count++;
    }
    if (pair.precip_accuracy != null) {
      sourceScores[source].precip_sum += pair.precip_accuracy;
      sourceScores[source].precip_count++;
    }
    if (pair.wind_accuracy != null) {
      sourceScores[source].wind_sum += pair.wind_accuracy;
      sourceScores[source].wind_count++;
    }
    sourceCounts[source]++;
  }

  const ranking = Object.entries(sourceScores).map(([source, scores]) => {
    const temp_avg = scores.temp_count > 0 ? scores.temp_sum / scores.temp_count : 0;
    const precip_avg = scores.precip_count > 0 ? scores.precip_sum / scores.precip_count : 0;
    const wind_avg = scores.wind_count > 0 ? scores.wind_sum / scores.wind_count : 0;
    const composite = temp_avg * weights.temp_weight + precip_avg * weights.precip_weight + wind_avg * weights.wind_weight;

    return {
      source,
      sample_count: sourceCounts[source],
      temp_accuracy: temp_avg,
      precip_accuracy: precip_avg,
      wind_accuracy: wind_avg,
      composite_score: composite,
    };
  });

  ranking.sort((a, b) => b.composite_score - a.composite_score);
  ranking.forEach((r, i) => r.rank = i + 1);

  return { ranking, weights };
}

router.get('/special-analysis', (req, res) => {
  const { device_id } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const devId = Number(device_id);
  const data = db.getData();
  const pairs = buildAccuracyPairs(devId, {});

  const weatherTypes = ['晴天', '雨天', '大风', '高温', '低温', '暴雨'];
  const analysis = {};

  const events = data.extreme_events.filter(e => e.device_id === devId);

  for (const weather of weatherTypes) {
    const weatherPairs = pairs.filter(p => classifyWeatherType(p.observation) === weather);
    
    if (weatherPairs.length === 0) {
      analysis[weather] = {
        sample_count: 0,
        sources: [],
      };
      continue;
    }

    const sourceScores = {};
    for (const pair of weatherPairs) {
      const source = pair.source;
      if (!sourceScores[source]) {
        sourceScores[source] = { temp_sum: 0, precip_sum: 0, wind_sum: 0, count: 0 };
      }
      if (pair.temp_accuracy != null) sourceScores[source].temp_sum += pair.temp_accuracy;
      if (pair.precip_accuracy != null) sourceScores[source].precip_sum += pair.precip_accuracy;
      if (pair.wind_accuracy != null) sourceScores[source].wind_sum += pair.wind_accuracy;
      sourceScores[source].count++;
    }

    analysis[weather] = {
      sample_count: weatherPairs.length,
      sources: Object.entries(sourceScores).map(([source, scores]) => ({
        source,
        sample_count: scores.count,
        temp_accuracy: scores.count > 0 ? scores.temp_sum / scores.count : 0,
        precip_accuracy: scores.count > 0 ? scores.precip_sum / scores.count : 0,
        wind_accuracy: scores.count > 0 ? scores.wind_sum / scores.count : 0,
        composite_score: scores.count > 0
          ? (scores.temp_sum + scores.precip_sum + scores.wind_sum) / (scores.count * 3)
          : 0,
      })).sort((a, b) => b.composite_score - a.composite_score),
    };
  }

  const eventAnalysis = [];
  for (const event of events) {
    const eventStart = dayjs(event.start_time);
    const eventEnd = dayjs(event.end_time);
    
    const eventPairs = pairs.filter(p => {
      const d = dayjs(p.date);
      return d.isAfter(eventStart.subtract(1, 'day')) && d.isBefore(eventEnd.add(1, 'day'));
    });

    if (eventPairs.length === 0) continue;

    const sourceScores = {};
    for (const pair of eventPairs) {
      const source = pair.source;
      if (!sourceScores[source]) {
        sourceScores[source] = { temp_sum: 0, precip_sum: 0, wind_sum: 0, count: 0 };
      }
      if (pair.temp_accuracy != null) sourceScores[source].temp_sum += pair.temp_accuracy;
      if (pair.precip_accuracy != null) sourceScores[source].precip_sum += pair.precip_accuracy;
      if (pair.wind_accuracy != null) sourceScores[source].wind_sum += pair.wind_accuracy;
      sourceScores[source].count++;
    }

    eventAnalysis.push({
      event_id: event.id,
      event_name: event.event_name,
      event_type: event.event_type,
      start_time: event.start_time,
      end_time: event.end_time,
      sample_count: eventPairs.length,
      sources: Object.entries(sourceScores).map(([source, scores]) => ({
        source,
        sample_count: scores.count,
        temp_accuracy: scores.count > 0 ? scores.temp_sum / scores.count : 0,
        precip_accuracy: scores.count > 0 ? scores.precip_sum / scores.count : 0,
        wind_accuracy: scores.count > 0 ? scores.wind_sum / scores.count : 0,
        composite_score: scores.count > 0
          ? (scores.temp_sum + scores.precip_sum + scores.wind_sum) / (scores.count * 3)
          : 0,
      })).sort((a, b) => b.composite_score - a.composite_score),
    });
  }

  res.json({
    weather_conditions: analysis,
    extreme_events: eventAnalysis,
  });
});

router.get('/radar-data', (req, res) => {
  const { device_id, source } = req.query;

  if (!device_id) {
    return res.status(400).json({ error: '请指定设备ID' });
  }

  const devId = Number(device_id);
  const pairs = buildAccuracyPairs(devId, {});

  const metrics = [
    { key: 'temp_accuracy', label: '温度准确率' },
    { key: 'precip_accuracy', label: '降水准确率' },
    { key: 'wind_accuracy', label: '风速准确率' },
    { key: 'composite_score', label: '综合评分' },
  ];

  const weatherTypes = ['晴天', '雨天', '大风', '高温'];

  const sources = source ? [source] : [...new Set(pairs.map(p => p.source))];
  const result = [];

  for (const s of sources) {
    const sourcePairs = pairs.filter(p => p.source === s);
    
    if (sourcePairs.length === 0) continue;

    const overallScores = {
      temp_accuracy: 0,
      precip_accuracy: 0,
      wind_accuracy: 0,
      count: 0,
    };

    for (const pair of sourcePairs) {
      if (pair.temp_accuracy != null) overallScores.temp_accuracy += pair.temp_accuracy;
      if (pair.precip_accuracy != null) overallScores.precip_accuracy += pair.precip_accuracy;
      if (pair.wind_accuracy != null) overallScores.wind_accuracy += pair.wind_accuracy;
      overallScores.count++;
    }

    const overall = {
      temp_accuracy: overallScores.count > 0 ? overallScores.temp_accuracy / overallScores.count : 0,
      precip_accuracy: overallScores.count > 0 ? overallScores.precip_accuracy / overallScores.count : 0,
      wind_accuracy: overallScores.count > 0 ? overallScores.wind_accuracy / overallScores.count : 0,
      composite_score: overallScores.count > 0
        ? (overallScores.temp_accuracy + overallScores.precip_accuracy + overallScores.wind_accuracy) / (overallScores.count * 3)
        : 0,
    };

    const weatherPerformance = {};
    for (const weather of weatherTypes) {
      const weatherPairs = sourcePairs.filter(p => classifyWeatherType(p.observation) === weather);
      if (weatherPairs.length === 0) {
        weatherPerformance[weather] = { composite_score: 0 };
        continue;
      }

      let total = 0, count = 0;
      for (const pair of weatherPairs) {
        const scores = [pair.temp_accuracy, pair.precip_accuracy, pair.wind_accuracy].filter(v => v != null);
        if (scores.length > 0) {
          total += scores.reduce((a, b) => a + b, 0) / scores.length;
          count++;
        }
      }
      weatherPerformance[weather] = {
        composite_score: count > 0 ? total / count : 0,
        sample_count: weatherPairs.length,
      };
    }

    result.push({
      source: s,
      sample_count: sourcePairs.length,
      overall,
      weather_performance: weatherPerformance,
      radar_labels: ['温度', '降水', '风速', '晴天', '雨天', '大风'],
      radar_values: [
        overall.temp_accuracy,
        overall.precip_accuracy,
        overall.wind_accuracy,
        weatherPerformance['晴天']?.composite_score || 0,
        weatherPerformance['雨天']?.composite_score || 0,
        weatherPerformance['大风']?.composite_score || 0,
      ],
    });
  }

  res.json(result);
});

module.exports = router;
