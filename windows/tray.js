document.getElementById('tm-open').addEventListener('click',()=>window.native.trayAction('open'));
document.getElementById('tm-hide').addEventListener('click',()=>window.native.trayAction('hide'));
document.getElementById('tm-settings').addEventListener('click',()=>window.native.trayAction('settings'));
document.getElementById('tm-reload').addEventListener('click',()=>window.native.trayAction('menu-reload'));
document.getElementById('tm-quit').addEventListener('click',()=>window.native.trayAction('quit'));
window.addEventListener('keydown',e=>{if(e.key==='Escape')window.close()});
