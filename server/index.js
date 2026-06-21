const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');
const devicesRouter = require('./routes/devices');
const observationsRouter = require('./routes/observations');
const forecastsRouter = require('./routes/forecasts');
const eventsRouter = require('./routes/events');
const statsRouter = require('./routes/stats');
const reportsRouter = require('./routes/reports');
const alertsRouter = require('./routes/alerts');
const candidatesRouter = require('./routes/candidates');
const scoringRouter = require('./routes/scoring');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

initDB();

app.use('/api/devices', devicesRouter);
app.use('/api/observations', observationsRouter);
app.use('/api/forecasts', forecastsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/scoring', scoringRouter);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'connected' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
