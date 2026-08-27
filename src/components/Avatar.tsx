import { colour, initials, playerIdx, type Player } from '../data/trip';
import type { ReactNode } from 'react';

export function Avatar({ p, size, badge }: { p: Player; size?: 'sm'; badge?: ReactNode }) {
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} style={{ background: colour(playerIdx(p.id)) }}>
      {initials(p)}
      {badge}
    </span>
  );
}
