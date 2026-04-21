import { jsx as _jsx } from "react/jsx-runtime";
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { TripPage } from './pages/trip';
import { AdminPage } from './pages/admin/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';
// 路由三条主线与旧 HTML 保持同名:/dashboard /trip /admin。
// 根路径默认跳 Dashboard。Phase 5 切到生产托管时,Express 需要把这三条路径
// 都 fallback 到 build 产物的 index.html(SPA fallback)。
export const router = createBrowserRouter([
    {
        path: '/',
        element: _jsx(App, {}),
        children: [
            { index: true, element: _jsx(Navigate, { to: "/dashboard", replace: true }) },
            { path: 'dashboard', element: _jsx(DashboardPage, {}) },
            { path: 'trip', element: _jsx(TripPage, {}) },
            { path: 'admin', element: _jsx(AdminPage, {}) },
            { path: '*', element: _jsx(NotFoundPage, {}) },
        ],
    },
]);
