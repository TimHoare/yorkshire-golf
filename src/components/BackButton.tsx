import { Link, useNavigate } from 'react-router-dom';
import { backLabel, previousPath } from '../lib/nav';

// Goes back to the page you came from when there is one this session;
// otherwise to the page's natural parent (`to`), replacing this entry so a
// deep-linked page doesn't stay behind its own parent.
export function BackButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  const prev = previousPath();
  return (
    <Link className="back" to={prev ?? to} replace={!prev} onClick={(e) => { if (prev) { e.preventDefault(); navigate(-1); } }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      {prev ? backLabel(prev) : label}
    </Link>
  );
}
