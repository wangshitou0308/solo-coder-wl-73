const { initDB, getData, insert, findBy, round } = require('./db');
const { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } = require('date-fns');

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
      
      insert('observations', {
        device_id: deviceId, record_time: format(day, 'yyyy-MM-dd'), frequency: 'daily',
        temperature: dayTempAvg, humidity: dayHumid, pressure: dayPressure,
        wind_speed: dayWindAvg, wind_direction: Math.floor(Math.random() * 360),
        precipitation: dayPrecip
      });
      obsCount++;
      
      insert('daily_aggregates', {
        device_id: deviceId, date: format(day, 'yyyy-MM-dd'),
        temp_avg: dayTempAvg, temp_max: dayTempHigh, temp_min: dayTempLow,
        humidity_avg: dayHumid, pressure_avg: dayPressure,
        wind_speed_avg: dayWindAvg, wind_speed_max: dayWindMax,
        precipitation_total: dayPrecip
      });
      
      for (let h = 0; h < 24; h += 3) {
        const hourProgress = (h - 6) / 12;
        const hourTemp = +(dayTempAvg + (-hourProgress * ((dayTempHigh - dayTempLow) / 4)) + (Math.random() - 0.5)).toFixed(1);
        const hourHumid = +Math.max(20, Math.min(98, dayHumid + (-hourProgress * 15) + (Math.random() * 8 - 4))).toFixed(0);
        const dateStr = format(day, 'yyyy-MM-dd');
        const timeStr = String(h).padStart(2, '0') + ':00:00';
        const hourPrecip = (h >= 8 && h <= 20 && dayPrecip > 0) ? +(dayPrecip * (0.05 + Math.random() * 0.1)).toFixed(1) : 0;
        insert('observations', {
          device_id: deviceId, record_time: dateStr + ' ' + timeStr, frequency: 'hourly',
          temperature: hourTemp, humidity: hourHumid,
          pressure: +(dayPressure + Math.random() * 2 - 1).toFixed(1),
          wind_speed: +Math.max(0, dayWindAvg + Math.random() * 3 - 1.5).toFixed(1),
          wind_direction: Math.floor(Math.random() * 360),
          precipitation: hourPrecip
        });
        obsCount++;
      }
    }
  }
  console.log('  - 生成观测记录: ' + obsCount + ' 条');

  const data = getData();
  const sources = data.forecast_sources.map(s => s.id);
  let fcCount = 0;

  for (const deviceId of deviceIds) {
    for (const sourceId of sources) {
      const sBias = (sourceId - 1) * 0.8 - 1.2;
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const agg = data.daily_aggregates.find(a => a.device_id === deviceId && a.date === dateStr);
        if (!agg) continue;
        const precip = agg.precipitation_total || 0;
        const prob = precip > 0.5 ? Math.min(100, Math.round(55 + Math.random() * 40)) : Math.round(Math.random() * 25);
        insert('forecasts', {
          source_id: sourceId, forecast_date: dateStr, target_date: dateStr, forecast_range: '1d',
          temp_high: round(agg.temp_max + 1.8 + sBias + (Math.random() * 3 - 1.5)),
          temp_low: round(agg.temp_min - 0.8 - sBias + (Math.random() * 2 - 1)),
          precipitation_prob: prob,
          precipitation_amount: Math.max(0, round(precip * (0.7 + Math.random() * 0.6))),
          wind_speed: round(agg.wind_speed_avg * (0.85 + Math.random() * 0.45)),
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
