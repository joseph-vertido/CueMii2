import { useLayoutEffect, useRef } from 'react';

/**
 * Keys whose next move should be applied instantly instead of animated.
 * Used for reordering the user shouldn't watch — e.g. the reserved-match swap
 * that happens behind an assignment.
 */
const skipOnce = new Set();

export const skipNextFlip = (keys = []) => {
  keys.forEach(k => skipOnce.add(k));
};

/**
 * FLIP layout animation for a list.
 *
 * The rule that matters: **only a change in the list's order is animated.**
 *
 * An earlier version animated any position change, which meant every
 * content-driven layout shift became an animation — a match card grows a
 * "preferred courts" banner, its footer swaps between a message and buttons,
 * the queue gains or loses its scrollbar — and those landed on top of the real
 * reorder as a twitch. Cards that merely got pushed by a neighbour's resize now
 * settle silently; only cards that actually changed place animate.
 *
 * A short settle window after each animation absorbs the follow-up layout
 * changes that tend to arrive a frame or two behind the state change, so they
 * can't start a second, competing animation.
 *
 * Children opt in with a `data-flip-key` attribute holding a stable id.
 *
 * @param {React.RefObject} containerRef - element whose children animate
 * @param {Object} [options]
 * @param {number} [options.duration=320]
 * @param {'both'|'y'} [options.axis='both'] - 'y' for vertical lists, where
 *   sideways movement is never meaningful
 */
const useFlipList = (containerRef, options = {}) => {
  // `delay` holds each card at its old position before it travels. The courts
  // use it so a newly filled court is seen being populated *before* it slides
  // away to its new place, rather than both happening at once.
  const { duration = 320, axis = 'both', delay = 0 } = options;
  const positions = useRef(new Map());
  const order = useRef(null);
  const running = useRef(new Map());
  const settleUntil = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll('[data-flip-key]'));
    const keys = items.map(el => el.getAttribute('data-flip-key'));
    const signature = keys.join('|');

    // Measure first, so the map is always the freshly painted layout.
    const measured = new Map();
    items.forEach((el, i) => {
      measured.set(keys[i], { left: el.offsetLeft, top: el.offsetTop });
    });

    const reduce = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const first = order.current === null;
    const reordered = !first && signature !== order.current;
    const now = performance.now();

    if (reordered && !reduce && now >= settleUntil.current) {
      items.forEach((el, i) => {
        const key = keys[i];

        if (skipOnce.has(key)) {
          skipOnce.delete(key);
          return;
        }

        const before = positions.current.get(key);
        if (!before) return; // just added — its entrance animation covers it

        const dx = axis === 'y' ? 0 : before.left - measured.get(key).left;
        const dy = before.top - measured.get(key).top;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;

        const inFlight = running.current.get(key);
        if (inFlight) inFlight.cancel();

        const anim = el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0px, 0px)' },
          ],
          {
            duration,
            delay,
            // `backwards` holds the starting offset during the delay, so the
            // card stays put instead of jumping to its new spot and waiting.
            fill: 'backwards',
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          }
        );
        running.current.set(key, anim);
        anim.addEventListener('finish', () => running.current.delete(key));
      });

      // Ignore layout changes that arrive in the animation's wake.
      settleUntil.current = now + delay + duration + 150;
    }

    positions.current = measured;
    order.current = signature;
  });
};

export default useFlipList;
