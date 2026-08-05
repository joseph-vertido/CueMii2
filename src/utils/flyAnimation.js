/**
 * Tier 2 motion: a "ghost" card that flies from where a player was to where
 * they land.
 *
 * Elements opt in by tagging themselves with data attributes rather than
 * passing refs around:
 *   data-player-card="<playerId>"   a player's card in the pool
 *   data-slot-player="<playerId>"   the match-queue slot holding that player
 *   data-court-player="<playerId>"  the court slot holding that player
 *   data-match-card="<matchId>"     a match card in the queue
 *   data-court-card="<courtId>"     a court card
 *
 * The ghost is appended to <body>, so it isn't clipped by the panels — they use
 * backdrop-filter with hidden overflow, which traps and crops absolutely
 * positioned children.
 */

const DURATION = 620;

/**
 * Players currently in flight are hidden at their destination until they land.
 *
 * This is done with a live stylesheet rather than by setting a style on the
 * destination element, because the destination doesn't exist yet: React renders
 * it as soon as the state updates, which is *before* any animation frame we
 * could hook. A rule keyed on the player's id applies the moment the element
 * appears, so it never flashes into view at the start of the trip.
 */
const hiddenPlayerIds = new Set();
let hideStyleEl = null;

const syncHideStyle = () => {
  if (typeof document === 'undefined') return;
  if (!hideStyleEl) {
    hideStyleEl = document.createElement('style');
    hideStyleEl.id = 'cuemii-flight-hide';
    document.head.appendChild(hideStyleEl);
  }
  if (hiddenPlayerIds.size === 0) {
    hideStyleEl.textContent = '';
    return;
  }
  const selectors = [];
  hiddenPlayerIds.forEach(id => {
    selectors.push(`[data-slot-player="${id}"]`);
    selectors.push(`[data-court-player="${id}"]`);
    selectors.push(`[data-player-card="${id}"]`);
  });
  hideStyleEl.textContent = `${selectors.join(',')} { opacity: 0 !important; }`;
};

/** Clear every hold — a backstop so nobody can be left invisible. */
export const revealAllInFlight = () => {
  hiddenPlayerIds.clear();
  syncHideStyle();
};

/** Hide these players wherever they render, until their flight lands. */
export const hidePlayersInFlight = (ids = []) => {
  ids.filter(Boolean).forEach(id => hiddenPlayerIds.add(String(id)));
  syncHideStyle();
  // If anything goes wrong mid-flight, don't leave a player invisible.
  ids.filter(Boolean).forEach(id => {
    setTimeout(() => revealPlayerInFlight(id), 2500);
  });
};

const revealPlayerInFlight = (id) => {
  if (id === undefined || id === null) return;
  hiddenPlayerIds.delete(String(id));
  syncHideStyle();
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Measure an element's *layout* position, ignoring any transform currently
 * applied to it.
 *
 * This matters when a destination is itself mid-animation. Assigning a match
 * reorders the courts, and the court being targeted is sliding to its new place
 * — getBoundingClientRect() includes that transform, so it reports where the
 * court is *coming from* rather than where it's going. Subtracting the
 * transform gives the settled position, so the ghost flies to where the court
 * will actually be.
 */
const elementOf = (selector) =>
  (typeof selector === 'string' ? document.querySelector(selector) : selector);

const rectOf = (selector) => {
  const el = elementOf(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;

  let dx = 0;
  let dy = 0;
  try {
    const t = window.getComputedStyle(el).transform;
    if (t && t !== 'none' && typeof DOMMatrixReadOnly !== 'undefined') {
      const m = new DOMMatrixReadOnly(t);
      dx = m.m41;
      dy = m.m42;
    }
  } catch (e) {
    /* fall back to the visual rect */
  }

  return {
    left: r.left - dx,
    top: r.top - dy,
    width: r.width,
    height: r.height,
  };
};

/**
 * Fly a labelled ghost from one element to another.
 * @param {Object} opts
 * @param {string|Element} opts.from - source selector/element
 * @param {string|Element} opts.to - destination selector/element (read after the DOM updates)
 * @param {string} opts.label - text shown on the ghost (usually the player's name)
 * @param {string} [opts.gender] - 'male' | 'female', tints the ghost
 * @param {boolean} [opts.isDarkMode]
 */
export const flyBetween = ({ from, to, fromRect, fallbackFrom, fallbackTo, label = '', gender, isDarkMode = true, duration = DURATION, playerId }) => {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;

  // A caller staggering several flights must measure the sources up front:
  // by the time the later ones start, the originals have already been removed.
  const start = fromRect || rectOf(from) || (fallbackFrom ? rectOf(fallbackFrom) : null);
  if (!start) {
    revealPlayerInFlight(playerId); // nothing to animate — don't leave them hidden
    return;
  }
  // Hide immediately, before React has a chance to render the destination.
  if (playerId !== undefined) hidePlayersInFlight([playerId]);

  // The destination usually doesn't exist until React has re-rendered, so wait
  // for the next frame before measuring it.
  requestAnimationFrame(() => {
    const end = rectOf(to) || (fallbackTo ? rectOf(fallbackTo) : null);
    if (!end) {
      revealPlayerInFlight(playerId);
      return;
    }

    // Reveal only as the card lands.
    const reveal = () => revealPlayerInFlight(playerId);
    const revealTimer = setTimeout(reveal, Math.max(0, duration * 0.82));

    const ghost = document.createElement('div');
    ghost.className = 'flight-ghost';
    ghost.textContent = label;

    const tint = gender === 'female'
      ? { fg: '#f9a8d4', bg: isDarkMode ? '#2a0f1e' : '#fce7f3', bd: '#f472b6' }
      : { fg: '#93c5fd', bg: isDarkMode ? '#0f1e33' : '#dbeafe', bd: '#60a5fa' };

    Object.assign(ghost.style, {
      left: `${start.left}px`,
      top: `${start.top}px`,
      width: `${start.width}px`,
      height: `${start.height}px`,
      color: tint.fg,
      background: tint.bg,
      border: `2px solid ${tint.bd}`,
      boxShadow: `0 10px 26px -8px rgba(0,0,0,.6), 0 0 0 3px ${tint.bd}22`,
    });
    document.body.appendChild(ghost);

    const dx = end.left + end.width / 2 - (start.left + start.width / 2);
    const dy = end.top + end.height / 2 - (start.top + start.height / 2);
    const scale = Math.max(0.4, Math.min(1, end.width / Math.max(start.width, 1)));

    const animation = ghost.animate(
      [
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1, offset: 0 },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 26}px) scale(${Math.max(1.06, (1 + scale) / 2)})`,
          opacity: 1,
          offset: 0.5,
        },
        {
          transform: `translate(${dx * 0.92}px, ${dy * 0.92}px) scale(${scale * 1.02})`,
          opacity: 1,
          offset: 0.82,
        },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0, offset: 1 },
      ],
      { duration, easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)', fill: 'forwards' }
    );

    const cleanup = () => {
      ghost.remove();
      clearTimeout(revealTimer);
      reveal(); // never leave a destination stuck invisible
    };
    animation.addEventListener('finish', cleanup);
    animation.addEventListener('cancel', cleanup);
    // Belt and braces in case the animation never settles
    setTimeout(cleanup, duration + 300);
  });
};

/**
 * Player card in the pool -> the exact slot they land in.
 *
 * The destination is resolved *after* the re-render by looking for the slot now
 * holding this player, so the ghost lands on the real slot rather than the
 * middle of the match card. Falls back to the match card if that slot can't be
 * found (e.g. the match was assigned in the same tick).
 */
export const flyPlayerToMatch = (player, matchId, isDarkMode) =>
  flyBetween({
    playerId: player?.id,
    duration: 780,
    // Measured before the re-render, so a player already in a match still has
    // their old slot — that's where they should fly from. Coming from the pool
    // there is no slot yet, so their pool card is used instead.
    from: `[data-slot-player="${player?.id}"]`,
    fallbackFrom: `[data-player-card="${player?.id}"]`,
    to: `[data-slot-player="${player?.id}"]`,
    fallbackTo: `[data-match-card="${matchId}"]`,
    label: player?.name,
    gender: player?.gender,
    isDarkMode,
  });

/**
 * A court's players heading back into the match queue (Return to Queue), or
 * back onto a court (undoing a finished match).
 *
 * @param {Array} players
 * @param {string} fromSelector - a selector for the group's origin
 * @param {Function} toSelector - given a player, the destination selector
 */
export const flyPlayerGroup = (players = [], fromSelector, toSelector, isDarkMode, startDelay = 0) => {
  // Hide and measure straight away, even when the flight is delayed: waiting
  // means the players are already visible at their destination and their
  // original positions are gone by the time we look.
  hidePlayersInFlight(players.map(p => p.id));
  const groupRect = rectOf(fromSelector);
  const starts = players.map(p => ({
    player: p,
    rect: rectOf(`[data-court-player="${p.id}"]`)
      || rectOf(`[data-slot-player="${p.id}"]`)
      || rectOf(`[data-player-card="${p.id}"]`)
      || groupRect,
  }));
  starts.forEach(({ player, rect }, i) => {
    if (!rect) { revealPlayerInFlight(player.id); return; }
    setTimeout(() => {
      flyBetween({
        fromRect: rect,
        to: toSelector(player),
        label: player.name,
        gender: player.gender,
        playerId: player.id,
        isDarkMode,
      });
    }, startDelay + i * 60);
  });
};

/**
 * Two cards trading places, using the real elements.
 *
 * The queue's up/down buttons swap the *contents* of two cards rather than
 * moving them, so nothing appears to happen. Rather than flying copies around,
 * this measures both cards before the swap and then, once the contents have
 * changed, starts each card at the other's old position and slides it home —
 * so the cards themselves are seen exchanging places.
 *
 * Call this *before* the state update; it picks the positions up first and
 * waits for the re-render.
 *
 * @param {string} selectorA
 * @param {string} selectorB
 * @param {number} [duration=380]
 */
export const animateCardSwap = (selectorA, selectorB, duration = 380) => {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;

  const before = { a: rectOf(selectorA), b: rectOf(selectorB) };
  if (!before.a || !before.b) return;

  requestAnimationFrame(() => {
    const elA = document.querySelector(selectorA);
    const elB = document.querySelector(selectorB);
    if (!elA || !elB) return;

    const slide = (el, from, to) => {
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, zIndex: 3 },
          { transform: 'translate(0px, 0px)', zIndex: 3 },
        ],
        { duration, easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)' }
      );
    };

    // Each card starts where the other one was, then slides into its own place.
    slide(elA, before.b, before.a);
    slide(elB, before.a, before.b);
  });
};

/**
 * A match's players moving onto the court it's been assigned to.
 *
 * One ghost per player rather than a single "Match #12" label, so the movement
 * reads as four people walking onto the court. Sources are measured up front,
 * since the match card is removed from the queue as soon as the state updates.
 */
export const flyPlayersToCourt = (players = [], matchId, courtId, isDarkMode) => {
  hidePlayersInFlight(players.map(p => p.id));
  const matchRect = rectOf(`[data-match-card="${matchId}"]`);
  const starts = players.map(p => ({
    player: p,
    rect: rectOf(`[data-slot-player="${p.id}"]`) || matchRect,
  }));
  starts.forEach(({ player, rect }, i) => {
    if (!rect) { revealPlayerInFlight(player.id); return; }
    setTimeout(() => {
      flyBetween({
        fromRect: rect,
        to: `[data-court-player="${player.id}"]`,
        fallbackTo: `[data-court-card="${courtId}"]`,
        label: player.name,
        gender: player.gender,
        playerId: player.id,
        isDarkMode,
        duration: 450,
      });
    }, i * 70);
  });
};

/** Several players heading into one match (Smart Match / Smart All). */
export const flyPlayersToMatch = (players = [], matchId, isDarkMode) => {
  hidePlayersInFlight(players.map(p => p.id));
  const starts = players.map(p => ({
    player: p,
    rect: rectOf(`[data-player-card="${p.id}"]`),
  }));
  starts.forEach(({ player, rect }, i) => {
    if (!rect) { revealPlayerInFlight(player.id); return; }
    setTimeout(() => {
      flyBetween({
        fromRect: rect,
        to: `[data-slot-player="${player.id}"]`,
        fallbackTo: `[data-match-card="${matchId}"]`,
        label: player.name,
        gender: player.gender,
        playerId: player.id,
        isDarkMode,
      });
    }, i * 70);
  });
};

/** A court's players heading back to the pool when a match is finished. */
export const flyPlayersToPool = (players = [], courtId, isDarkMode, startDelay = 0) => {
  hidePlayersInFlight(players.map(p => p.id));
  const courtRect = rectOf(`[data-court-card="${courtId}"]`);
  const starts = players.map(p => ({
    player: p,
    rect: rectOf(`[data-court-player="${p.id}"]`) || courtRect,
  }));
  starts.forEach(({ player, rect }, i) => {
    if (!rect) { revealPlayerInFlight(player.id); return; }
    setTimeout(() => {
      flyBetween({
        fromRect: rect,
        to: `[data-player-card="${player.id}"]`,
        label: player.name,
        gender: player.gender,
        playerId: player.id,
        isDarkMode,
      });
    }, startDelay + i * 60);
  });
};

/** Match card -> court card, when a match is assigned. */
export const flyMatchToCourt = (matchId, courtId, label, isDarkMode) =>
  flyBetween({
    from: `[data-match-card="${matchId}"]`,
    to: `[data-court-card="${courtId}"]`,
    label,
    isDarkMode,
  });

export default flyBetween;
