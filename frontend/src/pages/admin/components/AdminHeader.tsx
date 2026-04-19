import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  title: string;
  tripId: string;
  stats: {
    days: number;
    spots: number;
    segments: number;
  };
}

export function AdminHeader({ title, tripId, stats }: AdminHeaderProps) {
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link className="admin-back" to="/dashboard">← 全部行程</Link>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ color: 'var(--admin-accent)', fontWeight: 700 }}>后台编辑</span>
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: '1.75rem' }}>{title || '未命名行程'}</h1>
          <p style={{ color: 'var(--admin-muted)', marginTop: '8px', maxWidth: '60ch' }}>
            在这里编辑行程的基础信息、景点和交通路线。保存后前台地图将同步更新。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            to={`/trip?id=${encodeURIComponent(tripId)}`}
            target="_blank"
            className="btn btn-ghost"
            style={{ textDecoration: 'none', color: 'var(--admin-accent-strong)', background: '#fff4ed' }}
          >
            打开前台地图
          </Link>
        </div>
      </header>

      <section className="topbar">
        <div className="summary-grid">
          <div className="summary-card">
            <span>{stats.days}</span>
            <small>天数</small>
          </div>
          <div className="summary-card">
            <span>{stats.spots}</span>
            <small>景点</small>
          </div>
          <div className="summary-card">
            <span>{stats.segments}</span>
            <small>路线</small>
          </div>
        </div>
      </section>
    </>
  );
}
