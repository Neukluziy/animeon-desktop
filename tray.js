const send = action => window.native.trayAction(action);
document.getElementById('tm-open')?.addEventListener('click', () => send('open'));
document.getElementById('tm-hide')?.addEventListener('click', () => send('hide'));
document.getElementById('tm-reload')?.addEventListener('click', () => send('menu-reload'));
document.getElementById('tm-site')?.addEventListener('click', () => send('visit-site'));
document.getElementById('tm-quit')?.addEventListener('click', () => send('quit'));
window.addEventListener('keydown', e => { if (e.key === 'Escape') window.close(); });
