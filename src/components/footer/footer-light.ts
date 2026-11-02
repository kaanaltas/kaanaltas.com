// The footer's hairline carries a light. Each time the reader arrives at the
// end of the footer (its bottom in view, or the page's end), a short accent
// segment with a soft glow under it runs along the line once, left to right
// across the whole screen, slowing down, and fades out past the right edge,
// and `footer:light` tells the art to play its reveal. Then the line rests
// as the plain hairline. It re-arms (`footer:rearm`) once the reader has
// scrolled back up a third of a viewport, so it plays again on the next
// arrival and never loops while the reader stays. Transform and opacity only.

const DURATION = 1600;
const EASING = 'cubic-bezier(0.25, 0.6, 0.25, 1)';

export function mountFooterLight(footer: HTMLElement) {
  const beam = footer.querySelector<HTMLElement>('.beam');
  const run = () => {
    if (beam) {
      beam.getAnimations().forEach((a) => a.cancel());
      beam.classList.add('is-on');
      // Position decelerates the whole way; opacity is its own linear track,
      // so the fade-in is quick and the fade-out happens where it slows.
      beam.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(6%)' }], { duration: DURATION, easing: EASING });
      const fade = beam.animate(
        [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.12 },
          { opacity: 1, offset: 0.5 },
          { opacity: 0, offset: 1 },
        ],
        { duration: DURATION, easing: 'linear' },
      );
      fade.finished.then(() => beam.classList.remove('is-on')).catch(() => {});
    }
    footer.dispatchEvent(new Event('footer:light'));
  };

  // Arrival is read from the footer's rect on each scroll frame (not from
  // intersection thresholds, which a fast scroll can jump past), and only
  // while the footer is within a viewport of the screen.
  let armed = true;
  let near = false;
  let queued = false;
  const check = () => {
    queued = false;
    const r = footer.getBoundingClientRect();
    const vh = window.innerHeight;
    const end = window.scrollY + vh >= document.documentElement.scrollHeight - 2;
    const arrived = r.top < vh && (r.bottom <= vh + 1 || end);
    if (arrived && armed) {
      armed = false;
      run();
    } else if (!armed && r.bottom > vh * 1.33) {
      armed = true;
      footer.dispatchEvent(new Event('footer:rearm'));
    }
  };
  const onScroll = () => {
    if (!near || queued) return;
    queued = true;
    requestAnimationFrame(check);
  };
  new IntersectionObserver(
    ([e]) => {
      near = e.isIntersecting;
      if (near) onScroll();
    },
    { rootMargin: '100% 0px 100% 0px' },
  ).observe(footer);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
}
