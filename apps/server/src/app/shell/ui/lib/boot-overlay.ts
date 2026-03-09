const HYDRATED_EVENT_NAME = 'yulia-shell-hydrated';
const OVERLAY_ID = 'shell-boot-overlay';
const STAGE_SELECTOR = '.shellBootStage';
const HEADER_ID = 'shell-header';
const HEADER_ACTIONS_ID = 'shell-header-actions';
const FALLBACK_ACTIONS_HEIGHT_PX = 56;

function resolveBootHeaderHeight() {
  const header = document.getElementById(HEADER_ID);
  if (!header) {
    return 0;
  }

  const actions = document.getElementById(HEADER_ACTIONS_ID);
  const headerHeight = Math.ceil(header.getBoundingClientRect().height);
  const actionsHeight = actions
    ? Math.ceil(actions.getBoundingClientRect().height)
    : FALLBACK_ACTIONS_HEIGHT_PX;

  return Math.ceil(headerHeight + actionsHeight);
}

export function setupShellBootOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    return;
  }

  const stage = overlay.closest(STAGE_SELECTOR) as HTMLElement | null;
  if (!stage) {
    return;
  }

  let rafId = 0;

  const syncBootHeaderHeight = () => {
    const height = resolveBootHeaderHeight();
    if (height > 0) {
      stage.style.setProperty('--shell-boot-header-height', `${height}px`);
    }
  };

  const tick = () => {
    syncBootHeaderHeight();
    rafId = window.requestAnimationFrame(tick);
  };

  syncBootHeaderHeight();
  rafId = window.requestAnimationFrame(tick);
  window.addEventListener('resize', syncBootHeaderHeight);

  window.addEventListener(
    HYDRATED_EVENT_NAME,
    () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncBootHeaderHeight);
      overlay.classList.add('shellBootOverlayHidden');
      window.setTimeout(() => {
        overlay.remove();
      }, 260);
    },
    { once: true }
  );
}
