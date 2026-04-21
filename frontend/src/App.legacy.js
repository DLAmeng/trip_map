import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from 'react-router-dom';
/**
 * 迁移期的顶层外壳,仅提供最小导航条用于在三条路由之间切换。
 * 等 Phase 2 迁移 Dashboard 之后,这个 Nav 可能会被 Dashboard 的自有 header 取代,
 * 或被做成一个真正的 AppHeader 组件。
 */
export function App() {
    return (_jsxs("div", { className: "app-shell", children: [_jsxs("nav", { className: "app-nav", children: [_jsx(NavLink, { to: "/dashboard", className: ({ isActive }) => (isActive ? 'active' : ''), children: "Dashboard" }), _jsx(NavLink, { to: "/trip", className: ({ isActive }) => (isActive ? 'active' : ''), children: "Trip" }), _jsx(NavLink, { to: "/admin", className: ({ isActive }) => (isActive ? 'active' : ''), children: "Admin" }), _jsx("span", { className: "app-nav-hint", children: "React \u8FC1\u79FB\u9884\u89C8 \u00B7 Phase 1" })] }), _jsx("main", { className: "app-main", children: _jsx(Outlet, {}) })] }));
}
