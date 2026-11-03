export function initLocalTools({ native, cfg, toast }) {
  const noteInput = document.getElementById('watch-note-input');
  const noteContext = document.getElementById('watch-note-context');
  const notesList = document.getElementById('watch-notes-list');

  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor(value % 3600 / 60);
    const remainder = value % 60;
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const setMediaContext = (state) => {
    if (!noteContext) return;
    if (!state?.available) {
      noteContext.textContent = 'Запусти видео, чтобы сохранить заметку на текущей секунде.';
      return;
    }
    noteContext.textContent = [state.animeTitle || state.title || 'AnimeOn', state.episode ? `Серия ${state.episode}` : '', formatTime(state.currentTime)].filter(Boolean).join(' · ');
  };

  const seekToNote = async (note) => {
    const current = await native.media.getState();
    if (!note.url || current?.url === note.url) {
      await native.media.seekTo(note.seconds);
      return;
    }
    native.navigateSite(note.url);
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const state = await native.media.getState();
        if (state?.available && state.url === note.url) {
          clearInterval(timer);
          await native.media.seekTo(note.seconds);
        } else if (attempts >= 60) clearInterval(timer);
      } catch { if (attempts >= 60) clearInterval(timer); }
    }, 500);
  };

  async function refreshNotes() {
    if (!notesList) return;
    const result = await native.library.listNotes();
    if (!result?.ok) return;
    notesList.replaceChildren();
    if (!result.notes?.length) {
      const empty = document.createElement('p');
      empty.className = 'watch-tools-empty';
      empty.textContent = 'Заметок пока нет. Во время просмотра добавьте комментарий и сохраните момент — он запомнится с таймкодом.';
      notesList.appendChild(empty);
      return;
    }
    for (const note of result.notes.slice(0, 60)) {
      const row = document.createElement('article');
      row.className = 'watch-note-item';
      const content = document.createElement('div');
      content.className = 'watch-note-content';
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'watch-note-jump';
      jump.textContent = `${note.title || 'AnimeOn'}${note.episode ? ` · Серия ${note.episode}` : ''} · ${formatTime(note.seconds)}`;
      jump.addEventListener('click', () => seekToNote(note));
      const text = document.createElement('p');
      text.textContent = note.text || '';
      content.append(jump, text);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'watch-note-delete';
      remove.title = 'Удалить заметку';
      remove.setAttribute('aria-label', 'Удалить заметку');
      remove.textContent = '×';
      remove.addEventListener('click', async () => {
        await native.library.deleteNote(note.id);
        refreshNotes();
      });
      row.append(content, remove);
      notesList.appendChild(row);
    }
  }

  document.getElementById('watch-note-save')?.addEventListener('click', async () => {
    const result = await native.library.addNote(noteInput?.value || '');
    if (!result?.ok) { toast(result?.error || 'Не удалось сохранить момент', 'error'); return; }
    noteInput.value = '';
    await refreshNotes();
    toast(`Момент ${formatTime(result.note.seconds)} сохранён`);
  });
  noteInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') document.getElementById('watch-note-save')?.click();
  });

  native.media.onState?.(setMediaContext);
  native.media.getState().then(setMediaContext).catch(() => {});
  refreshNotes();
}
