function createSplashFallback() {
  const root = document.getElementById('splash');
  const fill = root?.querySelector('.s-bar i');
  const percent = root?.querySelector('.s-pct');
  if (!root || !fill || !percent) return null;
  let value = Number.parseFloat(fill.style.width) || 5;
  let target = value;
  let frame = 0;
  let takenOver = false;
  const paint = () => {
    if (takenOver) return;
    value += (target - value) * 0.075;
    if (Math.abs(target - value) < 0.08) value = target;
    fill.style.width = `${Math.round(value * 10) / 10}%`;
    percent.textContent = `${Math.round(value)}%`;
    frame = requestAnimationFrame(paint);
  };
  const set = (nextValue) => {
    if (Number.isFinite(nextValue)) target = Math.max(target, Math.min(94, nextValue));
  };
  set(8);
  setTimeout(() => set(18), 220);
  setTimeout(() => set(32), 520);
  setTimeout(() => set(48), 900);
  setTimeout(() => set(64), 1350);
  setTimeout(() => set(78), 1900);
  setTimeout(() => set(88), 2600);
  frame = requestAnimationFrame(paint);
  return {
    takeOver() {
      takenOver = true;
      cancelAnimationFrame(frame);
    },
  };
}

function initSplash({ splash, progressBar, percentLabel, fallback, state, showWelcomeScreen }) {
  let progressValue = 5;
  let progressTarget = 5;
  let progressFrame = 0;

  function setProgress(progress) {
    const value = Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(progress))) : progressValue;
    progressValue = value;
    if (progressBar) progressBar.style.width = `${value}%`;
    if (percentLabel) percentLabel.textContent = `${Math.round(value)}%`;
    splash?.style.setProperty('--p', (value / 100).toFixed(3));
  }

  function animateProgress(target) {
    const value = Number.isFinite(Number(target)) ? Math.max(0, Math.min(100, Number(target))) : progressTarget;
    progressTarget = Math.max(progressTarget, value);
    cancelAnimationFrame(progressFrame);
    const tick = () => {
      const difference = progressTarget - progressValue;
      if (difference <= 0.05) {
        setProgress(progressTarget);
        return;
      }
      setProgress(progressValue + Math.max(0.12, difference * 0.08));
      progressFrame = requestAnimationFrame(tick);
    };
    progressFrame = requestAnimationFrame(tick);
  }

  function startSplashProgress() {
    fallback?.takeOver();
    setProgress(5);
    animateProgress(12);
  }

  function finishSplashProgress() {
    progressTarget = 100;
    animateProgress(100);
  }

  function revealApp(delay = 220) {
    if (state.booted) return;
    finishSplashProgress();
    setTimeout(() => {
      state.booted = true;
      document.body.classList.add('loaded');
      splash?.classList.add('hide');
      showWelcomeScreen();
      setTimeout(() => splash?.remove(), 720);
    }, delay);
  }

  return { animateProgress, finishSplashProgress, revealApp, setProgress, startSplashProgress };
}

export { createSplashFallback, initSplash };
