const HYDRATED_EVENT_NAME = 'yulia-shell-hydrated';
const OVERLAY_ID = 'shell-boot-overlay';
const STAGE_SELECTOR = '.shellBootStage';
const HEADER_ID = 'shell-header';
const HEADER_ACTIONS_ID = 'shell-header-actions';
const FALLBACK_ACTIONS_HEIGHT_PX = 56;

export function computeBootHeaderSpacerHeight(input: {
  headerHeight: number;
  actionsHeight?: number | null;
}) {
  const resolvedHeaderHeight = Number.isFinite(input.headerHeight)
    ? Math.max(0, Math.ceil(input.headerHeight))
    : 0;
  const resolvedActionsHeight = Number.isFinite(input.actionsHeight ?? null)
    ? Math.max(0, Math.ceil(input.actionsHeight as number))
    : FALLBACK_ACTIONS_HEIGHT_PX;

  return Math.ceil(resolvedHeaderHeight + resolvedActionsHeight);
}

function resolveBootHeaderHeight() {
  const header = document.getElementById(HEADER_ID);
  if (!header) {
    return 0;
  }

  const actions = document.getElementById(HEADER_ACTIONS_ID);
  return computeBootHeaderSpacerHeight({
    headerHeight: header.getBoundingClientRect().height,
    actionsHeight: actions?.getBoundingClientRect().height
  });
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
