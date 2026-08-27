import { Link } from 'react-router-dom';

export function BackButton({ to, label }: { to: string; label: string }) {
  return (
    <Link className="back" to={to}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {label}
    </Link>
  );
}
