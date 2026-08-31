// App flow: welcome → trip → round info → scoring, with the real router.
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import App from '../App';
import { reloadFromStorage, setMe } from '../lib/store';

function mount(path = '/trip') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  reloadFromStorage();
  setMe(null);
});

describe('app flow', () => {
  it('shows the welcome screen until a name is picked', () => {
    mount();
    expect(screen.getByText("Who's this?")).toBeTruthy();
    fireEvent.click(screen.getByText('Rob Ellis'));
    expect(screen.queryByText("Who's this?")).toBeNull();
    expect(localStorage.getItem('yorkshire-golf-2026-me')).toBe('p6');
  });

  it('trip page lists all five rounds', () => {
    setMe('p1');
    mount();
    for (const club of ['Elsham Golf Club', 'Ganton Golf Club', 'Cave Castle Golf Club', 'Beverley & East Riding Golf Club', 'York Golf Club']) {
      expect(screen.getByText(club)).toBeTruthy();
    }
  });

  it('player page shows their index and a row per round', () => {
    setMe('p1');
    localStorage.setItem('yorkshire-golf-2026', JSON.stringify({
      v: 3, scores: {}, pairs: {}, scramble: {},
      groups: { d3: [['p1', 'p3'], ['p5', 'p7'], ['p2', 'p4'], ['p6', 'p8']] },
    }));
    reloadFromStorage();
    mount('/player/p6');
    expect(screen.getByText('Rob Ellis')).toBeTruthy();
    expect(screen.getByText('The week')).toBeTruthy();
    for (const short of ['Elsham', 'Ganton', 'Cave Castle', 'Beverley', 'York']) {
      expect(screen.getByText(short)).toBeTruthy();
    }
    // Rob is in Team D for the scramble
    expect(screen.getByText(/Team D/)).toBeTruthy();
  });

  it('round info page shows course facts, map link and my course handicap — but no steppers', () => {
    setMe('p1');
    mount('/round/d2');
    expect(screen.getByText('Slope')).toBeTruthy();
    expect(screen.getByText('Your course handicap here')).toBeTruthy();
    const map = screen.getByText('Map ↗').closest('a')!;
    expect(map.href).toContain('google.com/maps');
    expect(screen.queryByLabelText('One stroke more')).toBeNull();
    expect(screen.getByText('Enter scores')).toBeTruthy();
    // real Ganton yardage on the course card
    expect(screen.getByText('6,440 yds')).toBeTruthy();
  });

  it('scoring page: 18 slides, + from empty records par, − records birdie', () => {
    setMe('p6'); // Rob, group 2 of d1
    const { container } = mount('/round/d1/score/1');
    expect(container.querySelectorAll('.swipe .slide')).toHaveLength(18);
    // group defaulted to mine (Group 2 seg active)
    expect(container.querySelector('.seg button.on')!.textContent).toBe('Group 2');
    const slide1 = container.querySelector('.slide[data-slide="1"]')!;
    const robRow = [...slide1.querySelectorAll('.score-row')].find((r) => within(r as HTMLElement).queryByText('Rob'))! as HTMLElement;
    fireEvent.click(within(robRow).getByLabelText('One stroke more'));
    expect((within(robRow).getByPlaceholderText('4') as HTMLInputElement).value).toBe('4'); // hole 1 par 4 → par
    const slide2 = container.querySelector('.slide[data-slide="2"]')!;
    const robRow2 = [...slide2.querySelectorAll('.score-row')].find((r) => within(r as HTMLElement).queryByText('Rob'))! as HTMLElement;
    fireEvent.click(within(robRow2).getByLabelText('One stroke fewer'));
    expect((within(robRow2).getByPlaceholderText('4') as HTMLInputElement).value).toBe('3'); // birdie
    const saved = JSON.parse(localStorage.getItem('yorkshire-golf-2026')!);
    expect(saved.scores.d1.p6[0]).toBe(4);
    expect(saved.scores.d1.p6[1]).toBe(3);
    expect(within(robRow2).getByText('birdie')).toBeTruthy();
  });

  it('scoring deep link with no hole lands on first unfinished hole for my group', () => {
    setMe('p1');
    // ragged 3-entry arrays on purpose: migrate() must pad them to 18
    localStorage.setItem('yorkshire-golf-2026', JSON.stringify({
      v: 3,
      scores: { d1: { p1: [4, 4, 4], p2: [4, 4, 4], p3: [4, 4, 4], p4: [4, 4, 4] } },
      pairs: {}, scramble: {},
    }));
    reloadFromStorage();
    const { container } = mount('/round/d1/score');
    expect(container.querySelector('.hole-chip.on')!.textContent).toBe('4');
  });

  it('standings tags my row with a you chip', () => {
    setMe('p1');
    const { container } = mount('/standings');
    expect(container.querySelector('.lb-row .chip.you')).toBeTruthy();
  });
});
