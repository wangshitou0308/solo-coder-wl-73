import { BrowserRouter, Routes, Route, NavLink, useParams, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Devices from './pages/Devices.jsx';
import DeviceDetail from './pages/DeviceDetail.jsx';
import Observations from './pages/Observations.jsx';
import Forecasts from './pages/Forecasts.jsx';
import Events from './pages/Events.jsx';
import EventDetail from './pages/EventDetail.jsx';
import Statistics from './pages/Statistics.jsx';

function Sidebar() {
  const navItems = [
    { path: '/', label: '数据看板', icon: '📊' },
    { path: '/devices', label: '设备管理', icon: '📡' },
    { path: '/observations', label: '观测数据', icon: '🌡️' },
    { path: '/forecasts', label: '预报验证', icon: '🌤️' },
    { path: '/events', label: '极端事件', icon: '⛈️' },
    { path: '/statistics', label: '统计分析', icon: '📈' },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-primary-700 to-primary-900 text-white min-h-screen flex flex-col shadow-xl">
      <div className="p-5 border-b border-primary-600">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🌦️</span>
          <span>气象站验证系统</span>
        </h1>
        <p className="text-xs text-primary-200 mt-1">个人气象数据平台</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-white/20 text-white font-medium shadow-md'
                  : 'text-primary-100 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-primary-600 text-xs text-primary-200">
        <p>© 2025 Weather Validator</p>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/devices/:id" element={<DeviceDetail />} />
            <Route path="/observations" element={<Observations />} />
            <Route path="/forecasts" element={<Forecasts />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/statistics" element={<Statistics />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
