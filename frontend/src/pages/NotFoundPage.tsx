import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>404</h1>
      <p>
        页面不存在。<Link to="/dashboard">返回 Dashboard</Link>
      </p>
    </section>
  );
}
