const { initDB, getData, insert, findBy, round } = require('./db');
const { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } = require('date-fns');

function calcDewPoint(temp, humidity) {
  if (temp == null || humidity == null) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * temp) / (b + temp) + Math.log(humidity / 100);
  return round((b * alpha) / (a - alpha), 1);
}

function calcFeelsLike(temp, humidity, windSpeed) {
  if (temp == null) return null;
  if (windSpeed != null && temp <= 10 && windSpeed >= 4.8) {
    return round(13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16), 1);
  }
  if (humidity != null && temp >= 27) {
    const rh = humidity / 100;
    return round(temp + 0.5555 * (6.11 * Math.exp(5417.753 * (1/273.15 - 1/(273.15 + temp))) * rh - 10), 1);
  }
  return temp;
}

initDB();

function seed() {
  console.log('开始生成测试数据...');

  const d1 = insert('devices', { model: 'WS-2902C', manufacturer: 'Ambient Weather', sensor_types: '温度,湿度,气压,风速,风向,降水', location: '北京市朝阳区望京小区楼顶', latitude: 39.9842, longitude: 116.4074, installation_date: '2024-01-15' });
  const d2 = insert('devices', { model: 'Davis Vantage Pro2', manufacturer: 'Davis Instruments', sensor_types: '温度,湿度,气压,风速,风向,降水,紫外线', location: '上海市浦东新区张江高科技园区', latitude: 31.2048, longitude: 121.5777, installation_date: '2024-03-20' });
  const deviceIds = [d1.id, d2.id];
  console.log('  - 创建设备: ' + deviceIds.length + ' 台');

  insert('calibrations', { device_id: deviceIds[0], calibration_date: '2024-06-01', temperature_offset: 0.3, humidity_offset: -1.2, pressure_offset: 0.5, wind_speed_offset: 0.2, notes: '季度常规校准' });
  insert('calibrations', { device_id: deviceIds[0], calibration_date: '2024-09-15', temperature_offset: 0.1, humidity_offset: -0.8, pressure_offset: 0.3, wind_speed_offset: 0.1, notes: '精度复查' });
  insert('calibrations', { device_id: deviceIds[1], calibration_date: '2024-05-10', temperature_offset: -0.2, humidity_offset: 0.5, pressure_offset: -0.2, wind_speed_offset: 0.3, notes: '初次校准' });

  const now = new Date();
  const end = endOfMonth(subMonths(now, 1));
  const start = startOfMonth(subMonths(end, 5));
  const days = eachDayOfInterval({ start, end });

  let obsCount = 0;

  for (const deviceId of deviceIds) {
    const baseTemp = deviceId === deviceIds[0] ? 15 : 20;
    const humidBase = deviceId === deviceIds[0] ? 55 : 70;
    const isProDevice = deviceId === deviceIds[1];
    for (const day of days) {
      const dayOfYear = Math.floor((day - new Date(day.getFullYear(), 0, 0)) / 86400000);
      const seasonalTemp = Math.sin((dayOfYear / 365) * Math.PI * 2 - Math.PI / 2) * 15;
      const dayPrecip = Math.random() < 0.25 ? +(Math.random() * 15).toFixed(1) : 0;
      const dayTempHigh = +(baseTemp + seasonalTemp + Math.random() * 5).toFixed(1);
      const dayTempLow = +(dayTempHigh - (6 + Math.random() * 4)).toFixed(1);
      const dayTempAvg = +((dayTempHigh + dayTempLow) / 2).toFixed(1);
      const dayHumid = +(humidBase + Math.random() * 20 - 10).toFixed(0);
      const dayPressure = +(1013 + Math.random() * 10 - 5).toFixed(1);
      const dayWindAvg = +(2 + Math.random() * 5).toFixed(1);
      const dayWindMax = +(dayWindAvg + Math.random() * 4).toFixed(1);
      
      const dayUv = isProDevice ? round(Math.max(0, Math.min(12, 3 + Math.sin((dayOfYear / 365) * Math.PI * 2) * 4 + Math.random() * 2)), 1) : null;
      const daySolar = isProDevice ? round(Math.max(0, 100 + Math.sin((dayOfYear / 365) * Math.PI * 2) * 300 + Math.random() * 100), 0) : null;
      const dayVisibility = isProDevice ? round(Math.max(1, Math.min(30, 15 + (dayPrecip > 0 ? -8 : 0) + Math.random() * 5)), 1) : null;
      const dayPm25 = isProDevice ? round(Math.max(0, 35 + Math.random() * 50 - 25), 0) : null;
      const dayPm10 = isProDevice ? round(Math.max(0, 50 + Math.random() * 70 - 35), 0) : null;
      const dayDewPoint = calcDewPoint(dayTempAvg, dayHumid);
      const dayFeelsLike = calcFeelsLike(dayTempAvg, dayHumid, dayWindAvg);
      
      insert('observations', {
        device_id: deviceId, record_time: format(day, 'yyyy-MM-dd'), frequency: 'daily',
        temperature: dayTempAvg, humidity: dayHumid, pressure: dayPressure,
        wind_speed: dayWindAvg, wind_direction: Math.floor(Math.random() * 360),
        precipitation: dayPrecip,
        uv_index: dayUv, solar_radiation: daySolar, visibility: dayVisibility,
        pm25: dayPm25, pm10: dayPm10, dew_point: dayDewPoint, feels_like: dayFeelsLike
      });
      obsCount++;
      
      insert('daily_aggregates', {
        device_id: deviceId, date: format(day, 'yyyy-MM-dd'),
        temp_avg: dayTempAvg, temp_max: dayTempHigh, temp_min: dayTempLow,
        humidity_avg: dayHumid, pressure_avg: dayPressure,
        wind_speed_avg: dayWindAvg, wind_speed_max: dayWindMax,
        precipitation_total: dayPrecip,
        uv_index_avg: dayUv, uv_index_max: dayUv ? round(dayUv * 1.2, 1) : null, uv_index_min: dayUv ? round(dayUv * 0.6, 1) : null,
        solar_radiation_avg: daySolar, solar_radiation_max: daySolar ? round(daySolar * 1.3, 0) : null, solar_radiation_min: daySolar ? round(daySolar * 0.4, 0) : null,
        visibility_avg: dayVisibility, visibility_max: dayVisibility ? round(dayVisibility * 1.15, 1) : null, visibility_min: dayVisibility ? round(dayVisibility * 0.7, 1) : null,
        pm25_avg: dayPm25, pm25_max: dayPm25 ? round(dayPm25 * 1.4, 0) : null, pm25_min: dayPm25 ? round(dayPm25 * 0.6, 0) : null,
        pm10_avg: dayPm10, pm10_max: dayPm10 ? round(dayPm10 * 1.4, 0) : null, pm10_min: dayPm10 ? round(dayPm10 * 0.6, 0) : null,
        dew_point_avg: dayDewPoint, dew_point_max: dayDewPoint ? round(dayDewPoint + 2, 1) : null, dew_point_min: dayDewPoint ? round(dayDewPoint - 2, 1) : null,
        feels_like_avg: dayFeelsLike, feels_like_max: dayFeelsLike ? round(dayFeelsLike + 3, 1) : null, feels_like_min: dayFeelsLike ? round(dayFeelsLike - 3, 1) : null
      });
      
      for (let h = 0; h < 24; h += 3) {
        const hourProgress = (h - 6) / 12;
        const isDaytime = h >= 6 && h <= 18;
        const hourTemp = +(dayTempAvg + (-hourProgress * ((dayTempHigh - dayTempLow) / 4)) + (Math.random() - 0.5)).toFixed(1);
        const hourHumid = +Math.max(20, Math.min(98, dayHumid + (-hourProgress * 15) + (Math.random() * 8 - 4))).toFixed(0);
        const dateStr = format(day, 'yyyy-MM-dd');
        const timeStr = String(h).padStart(2, '0') + ':00:00';
        const hourPrecip = (h >= 8 && h <= 20 && dayPrecip > 0) ? +(dayPrecip * (0.05 + Math.random() * 0.1)).toFixed(1) : 0;
        const hourWind = +Math.max(0, dayWindAvg + Math.random() * 3 - 1.5).toFixed(1);
        
        const hourUv = isProDevice && isDaytime ? round(Math.max(0, (dayUv || 5) * (0.3 + Math.random() * 0.7)), 1) : (isProDevice ? 0 : null);
        const hourSolar = isProDevice && isDaytime ? round(Math.max(0, (daySolar || 200) * (0.1 + Math.random() * 0.9)), 0) : (isProDevice ? 0 : null);
        const hourVisibility = isProDevice ? round(Math.max(1, Math.min(30, (dayVisibility || 15) + (hourPrecip > 0 ? -5 : 0) + Math.random() * 3 - 1.5)), 1) : null;
        const hourPm25 = isProDevice ? round(Math.max(0, (dayPm25 || 35) + Math.random() * 20 - 10), 0) : null;
        const hourPm10 = isProDevice ? round(Math.max(0, (dayPm10 || 50) + Math.random() * 30 - 15), 0) : null;
        const hourDewPoint = calcDewPoint(hourTemp, hourHumid);
        const hourFeelsLike = calcFeelsLike(hourTemp, hourHumid, hourWind);
        
        insert('observations', {
          device_id: deviceId, record_time: dateStr + ' ' + timeStr, frequency: 'hourly',
          temperature: hourTemp, humidity: hourHumid,
          pressure: +(dayPressure + Math.random() * 2 - 1).toFixed(1),
          wind_speed: hourWind,
          wind_direction: Math.floor(Math.random() * 360),
          precipitation: hourPrecip,
          uv_index: hourUv, solar_radiation: hourSolar, visibility: hourVisibility,
          pm25: hourPm25, pm10: hourPm10, dew_point: hourDewPoint, feels_like: hourFeelsLike
        });
        obsCount++;
      }
    }
  }
  console.log('  - 生成观测记录: ' + obsCount + ' 条');

  const data = getData();
  const sources = data.forecast_sources.map(s => ({ id: s.id, name: s.name }));
  let fcCount = 0;

  for (const deviceId of deviceIds) {
    for (const sourceInfo of sources) {
      const sourceId = sourceInfo.id;
      const sBias = (sourceId - 1) * 0.8 - 1.2;
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const agg = data.daily_aggregates.find(a => a.device_id === deviceId && a.date === dateStr);
        if (!agg) continue;
        const precip = agg.precipitation_total || 0;
        const prob = precip > 0.5 ? Math.min(100, Math.round(55 + Math.random() * 40)) : Math.round(Math.random() * 25);
        const forecastTemp = round((agg.temp_max + agg.temp_min) / 2 + sBias + (Math.random() * 2 - 1));
        const forecastPrecip = Math.max(0, round(precip * (0.7 + Math.random() * 0.6)));
        const forecastWind = round(agg.wind_speed_avg * (0.85 + Math.random() * 0.45));
        insert('forecasts', {
          source_id: sourceId, source: sourceInfo.name, device_id: deviceId,
          forecast_date: dateStr, target_date: dateStr, forecast_range: '1d',
          temp_high: round(agg.temp_max + 1.8 + sBias + (Math.random() * 3 - 1.5)),
          temp_low: round(agg.temp_min - 0.8 - sBias + (Math.random() * 2 - 1)),
          temperature: forecastTemp,
          precipitation: forecastPrecip,
          precipitation_prob: prob,
          precipitation_amount: forecastPrecip,
          wind_speed: forecastWind,
          wind_direction: null, weather_condition: null
        });
        fcCount++;
      }
    }
  }
  console.log('  - 生成预报记录: ' + fcCount + ' 条');

  const someDays = [...days].sort(() => Math.random() - 0.5).slice(0, 8);
  const eventTypes = ['暴雨', '大风', '高温', '雷电', '低温'];

  eventTypes.forEach((type, i) => {
    const d = someDays[i] || days[i];
    const ds = format(d, 'yyyy-MM-dd');
    if (type === '高温') {
      insert('extreme_events', { event_type: type, start_time: ds + ' 10:00:00', end_time: ds + ' 18:00:00', device_id: deviceIds[0], temp_extreme: 38.5, wind_extreme: 8.2, precipitation_total: 0, description: '副热带高压控制下的持续高温', impact_description: '户外体感温度超过42度，注意防暑降温' });
    } else if (type === '暴雨') {
      insert('extreme_events', { event_type: type, start_time: ds + ' 06:00:00', end_time: ds + ' 20:00:00', device_id: deviceIds[0], temp_extreme: 24.3, wind_extreme: 12.5, precipitation_total: 86.2, description: '强对流天气引发的暴雨天气', impact_description: '部分路段积水，降水量达到暴雨级别' });
    } else if (type === '大风') {
      insert('extreme_events', { event_type: type, start_time: ds + ' 08:00:00', end_time: ds + ' 22:00:00', device_id: deviceIds[1], temp_extreme: 18.5, wind_extreme: 18.6, precipitation_total: 2.1, description: '冷空气南下带来的强风', impact_description: '瞬时风力达到8级，户外注意安全' });
    } else if (type === '雷电') {
      insert('extreme_events', { event_type: type, start_time: ds + ' 14:00:00', end_time: ds + ' 22:00:00', device_id: deviceIds[1], temp_extreme: 26.8, wind_extreme: 10.3, precipitation_total: 15.6, description: '午后强对流引发雷电活动', impact_description: '雷暴持续约3小时，伴有短时强降水' });
    } else if (type === '低温') {
      const nsd = format(new Date(d.getTime() + 86400000), 'yyyy-MM-dd');
      insert('extreme_events', { event_type: type, start_time: ds + ' 23:00:00', end_time: nsd + ' 08:00:00', device_id: deviceIds[0], temp_extreme: -8.5, wind_extreme: 5.4, precipitation_total: 0.8, description: '强冷空气寒潮影响', impact_description: '最低气温跌破零下，出现冻害风险' });
    }
  });

  console.log('  - 生成极端事件: 5 条');
  console.log('\n测试数据生成完成!');
  console.log('设备 ID: ' + deviceIds.join(', '));
}

try {
  seed();
} catch (e) {
  console.error('生成测试数据出错:', e.message);
  console.error(e.stack);
  process.exit(1);
}
