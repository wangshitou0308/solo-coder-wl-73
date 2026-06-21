const fs = require('fs');
const path = require('path');

let dbPath;
let data = {
  devices: [],
  calibrations: [],
  observations: [],
  daily_aggregates: [],
  forecast_sources: [],
  forecasts: [],
  extreme_events: [],
  alert_thresholds: [],
  candidate_events: [],
  scoring_weights: [],
  forecast_ratings: [],
  counters: {}
};

function nextId(table) {
  data.counters[table] = (data.counters[table] || 0) + 1;
  return data.counters[table];
}

let saveTimer = null;
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('保存数据库失败', e.message);
    }
  }, 100);
}

function localNow() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function initDB() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  dbPath = path.join(dataDir, 'weather.json');
  if (fs.existsSync(dbPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dbPath), 'utf-8');
      return;
    } catch (e) {
      console.warn('数据库文件损坏，重新初始化', e.message);
    }
  }

  data.forecast_sources = [
    { id: 1, name: '中国气象局', description: '国家气象部门官方预报', url: 'http://www.cma.gov.cn', created_at: localNow() },
    { id: 2, name: '中央气象台', description: '国家级天气预报发布机构', url: 'http://www.nmc.cn', created_at: localNow() },
    { id: 3, name: '彩云天气', description: '商业天气预报服务', url: 'https://caiyunapp.com', created_at: localNow() },
    { id: 4, name: '墨迹天气', description: '商业天气预报服务', url: 'https://www.moji.com', created_at: localNow() },
  ];
  data.counters.forecast_sources = 4;

  data.alert_thresholds = [
    { id: 1, name: '高温预警', metric: 'temperature', operator: '>=', value: 35, severity: 'warning', enabled: true, created_at: localNow() },
    { id: 2, name: '低温预警', metric: 'temperature', operator: '<=', value: -10, severity: 'warning', enabled: true, created_at: localNow() },
    { id: 3, name: '暴雨预警', metric: 'precipitation', operator: '>=', value: 50, severity: 'danger', enabled: true, created_at: localNow() },
    { id: 4, name: '大风预警', metric: 'wind_speed', operator: '>=', value: 17, severity: 'warning', enabled: true, created_at: localNow() },
    { id: 5, name: '强降水预警', metric: 'precipitation', operator: '>=', value: 10, severity: 'warning', time_window_hours: 1, enabled: true, created_at: localNow() },
    { id: 6, name: '气压骤降预警', metric: 'pressure', operator: 'drop', value: 5, severity: 'warning', time_window_hours: 3, enabled: true, created_at: localNow() },
    { id: 7, name: '温度突变', metric: 'temperature', operator: 'change', value: 8, severity: 'warning', time_window_hours: 3, enabled: true, created_at: localNow() },
    { id: 8, name: '降水突增', metric: 'precipitation', operator: 'increase', value: 5, severity: 'warning', time_window_hours: 1, enabled: true, created_at: localNow() },
  ];
  data.counters.alert_thresholds = 8;

  data.scoring_weights = [
    { id: 1, name: '默认权重配置', temp_weight: 0.4, precip_weight: 0.35, wind_weight: 0.25, is_default: true, created_at: localNow() },
  ];
  data.counters.scoring_weights = 1;

  save();
}

function insert(table, row) {
  const r = { id: nextId(table), ...row };
  const now = localNow();
  if (data[table].length > 0 && 'created_at' in data[table][0]) r.created_at = r.created_at || now;
  if (data[table].length > 0 && 'updated_at' in data[table][0]) r.updated_at = r.updated_at || now;
  data[table].push(r);
  save();
  return r;
}

function findById(table, id) {
  return data[table].find(r => r.id === Number(id));
}

function findBy(table, fn) {
  return data[table].filter(fn);
}

function findOne(table, fn) {
  return data[table].find(fn);
}

function update(table, id, changes) {
  const idx = data[table].findIndex(r => r.id === Number(id));
  if (idx < 0) return null;
  if ('updated_at' in data[table][idx]) changes.updated_at = localNow();
  data[table][idx] = { ...data[table][idx], ...changes };
  save();
  return data[table][idx];
}

function remove(table, id) {
  const before = data[table].length;
  data[table] = data[table].filter(r => r.id !== Number(id));
  save();
  return before - data[table].length;
}

function removeBy(table, fn) {
  const before = data[table].length;
  data[table] = data[table].filter(r => !fn(r));
  save();
  return before - data[table].length;
}

function round(n, d = 1) {
  if (n == null || isNaN(n)) return null;
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}

function avg(arr) {
  if (!arr || arr.length === 0) return null;
  const vals = arr.filter(v => v != null && !isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getData() { return data; }

module.exports = {
  initDB, getData, insert, findById, findBy, findOne, update, remove, removeBy, round, avg, localNow, nextId, save
};
