function createVolumeControls({ native, controls }) {
  const {
    volumeSlider,
    volumeValue,
    buttonVolume,
    volumeMute,
    volumePanel,
    volumeWrap,
    volumeMinus,
    volumePlus,
  } = controls;

  function setVolumeUI(state) {
    if (!state) return;
    const volume = Math.max(0, Math.min(200, Number.isFinite(Number(state.volume)) ? Number(state.volume) : 100));
    if (volumeSlider) {
      volumeSlider.value = String(volume);
      volumeSlider.dataset.last = String(volume);
      volumeSlider.style.setProperty('--volume-fill', `${(volume / 200) * 100}%`);
    }
    if (volumeValue) volumeValue.textContent = `${volume}%`;
    if (buttonVolume) {
      buttonVolume.dataset.volume = `${volume}`;
      buttonVolume.classList.toggle('muted', !!state.muted);
      buttonVolume.title = state.muted ? 'Звук выключен' : `Громкость ${volume}%`;
    }
    if (volumeMute) volumeMute.textContent = state.muted ? 'Включить звук' : 'Без звука';
    buttonVolume?.classList.toggle('muted', !!state.muted);
  }

  async function refreshVolume() {
    try {
      setVolumeUI(await native.media.getVolumeState());
    } catch (error) {
      console.warn('[AnimeOn] Could not refresh playback volume:', error);
    }
  }

  function setVolumePanelOpen(open) {
    const show = Boolean(open);
    volumePanel?.classList.toggle('show', show);
    buttonVolume?.setAttribute('aria-expanded', String(show));
    if (show) refreshVolume();
  }

  setVolumeUI({ volume: 100, muted: false });
  buttonVolume?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!volumePanel) return;
    setVolumePanelOpen(!volumePanel.classList.contains('show'));
  });
  volumePanel?.addEventListener('pointerdown', (event) => event.stopPropagation());
  document.addEventListener('pointerdown', (event) => {
    if (!volumeWrap?.contains(event.target)) setVolumePanelOpen(false);
  });
  volumeSlider?.addEventListener('input', () => {
    const target = Number(volumeSlider.value);
    native.media.setVolume(target - Number(volumeSlider.dataset.last || 100));
    volumeSlider.dataset.last = String(target);
    setVolumeUI({ volume: target, muted: false });
  });
  volumeMinus?.addEventListener('click', () => {
    native.media.setVolume(-1);
    setTimeout(refreshVolume, 50);
  });
  volumePlus?.addEventListener('click', () => {
    native.media.setVolume(1);
    setTimeout(refreshVolume, 50);
  });
  volumeMute?.addEventListener('click', () => {
    native.media.toggleMute();
    setTimeout(refreshVolume, 50);
  });

  return { refreshVolume, setVolumePanelOpen };
}

export { createVolumeControls };
