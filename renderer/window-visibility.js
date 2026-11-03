function initWindowVisibility({ native, updateHost }) {
  function setChromeHidden(hidden) {
    document.body.classList.toggle('chrome-hidden', hidden);
  }

  function setAppSuspended(suspended) {
    document.body.classList.toggle('app-suspended', !!suspended);
    updateHost.classList.toggle('app-suspended', !!suspended);
  }

  window.addEventListener('mousemove', (event) => {
    if (event.clientY <= 7) setChromeHidden(false);
  });
  document.addEventListener('visibilitychange', () => setAppSuspended(document.hidden));
  native.onWindowVisibility?.((state) => {
    setAppSuspended(!!state?.hidden || !!state?.minimized);
  });

  return { setChromeHidden };
}

export { initWindowVisibility };
