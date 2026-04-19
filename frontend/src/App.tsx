import { NavLink, Outlet } from 'react-router-dom';

/**
 * 迁移期的顶层外壳,仅提供最小导航条用于在三条路由之间切换。
 * 等 Phase 2 迁移 Dashboard 之后,这个 Nav 可能会被 Dashboard 的自有 header 取代,
 * 或被做成一个真正的 AppHeader 组件。
 */
export function App() {
  return (
    <div className="app-shell">
      <nav className="app-nav">
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/trip" className={({ isActive }) => (isActive ? 'active' : '')}>
          Trip
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
          Admin
        </NavLink>
        <span className="app-nav-hint">React 迁移预览 · Phase 1</span>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
