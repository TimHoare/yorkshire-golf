// A player's face in a circle. The photo sits over the coloured initials,
// which stay behind it as the fallback while it loads or if it fails.
import { colour, initials, playerIdx, type Player } from '../data/trip';
import type { ReactNode } from 'react';
import p1 from '../assets/avatars/p1.webp';
import p2 from '../assets/avatars/p2.webp';
import p3 from '../assets/avatars/p3.webp';
import p4 from '../assets/avatars/p4.webp';
import p5 from '../assets/avatars/p5.webp';
import p6 from '../assets/avatars/p6.webp';
import p7 from '../assets/avatars/p7.webp';
import p8 from '../assets/avatars/p8.webp';

const PHOTOS: Record<string, string> = { p1, p2, p3, p4, p5, p6, p7, p8 };

export function Avatar({ p, size, badge }: { p: Player; size?: 'sm'; badge?: ReactNode }) {
  const photo = PHOTOS[p.id];
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} style={{ background: colour(playerIdx(p.id)) }}>
      {initials(p)}
      {photo && <img src={photo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      {badge}
    </span>
  );
}
