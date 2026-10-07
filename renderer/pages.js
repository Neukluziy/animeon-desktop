export function initPageLibrary({ native, cfg, toast, askConfirmation, store, tabTitle, samePageUrl, isAnimeOnUrl, tabs }) {
  const btnPageFavorite = document.getElementById('btn-page-favorite');
  const btnPages = document.getElementById('btn-pages');
  const btnPageFavorites = document.getElementById('btn-page-favorites');
  const pagesModal = document.getElementById('pages-modal');
  const btnClosePages = document.getElementById('btn-close-pages');
  const recentPagesList = document.getElementById('recent-pages-list');
  const favoritesModal = document.getElementById('favorites-modal');
  const btnCloseFavorites = document.getElementById('btn-close-favorites');
  const favoritePagesList = document.getElementById('favorite-pages-list');
  async function syncFavoriteButton(){try{const url=tabs.activeWebview?.getURL?.()||'';if(!url)return;const r=await native.pageFavorites();const found=(r?.items||[]).some(x=>samePageUrl(typeof x==='string'?x:x?.url, url));const icon=btnPageFavorite?.querySelector('.page-action-icon');if(icon) icon.innerHTML=found?'★':'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z\"/></svg>';}catch{}}
let recentPagesCache=[]; let favoritePagesCache=[];
const pagesSearch=document.getElementById('pages-search');
const favoritesSearch=document.getElementById('favorites-search');
function filterPages(items, query){
  if(!query) return items;
  const q=String(query).toLowerCase();
  return items.filter(it=>{
    const d=typeof it==='string'?{url:it,title:it}:it;
    return String(d.title||'').toLowerCase().includes(q) || String(d.url||'').toLowerCase().includes(q);
  });
}
async function openPages(){
  pagesModal?.classList.add('show');
  if(pagesSearch){ pagesSearch.value=''; }
  try {
    const r=await native.recentPages();
    recentPagesCache=r?.items||[];
    renderPageList(recentPagesList,recentPagesCache);
  } catch { recentPagesCache=[]; renderPageList(recentPagesList,[]); }
}
async function openFavorites(){
  favoritesModal?.classList.add('show');
  if(favoritesSearch){ favoritesSearch.value=''; }
  try {
    const f=await native.pageFavorites();
    favoritePagesCache=f?.items||[];
    renderPageList(favoritePagesList,favoritePagesCache);
    const url=tabs.activeWebview?.getURL?.()||'';
    const found=(favoritePagesCache||[]).some(x=>samePageUrl(typeof x==='string'?x:x?.url,url));
    const icon=btnPageFavorite?.querySelector('.page-action-icon');
    if(icon) icon.innerHTML=found?'★':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/></svg>';
  } catch { favoritePagesCache=[]; renderPageList(favoritePagesList,[]); }
}
function renderPageList(root,items){
  if(!root) return;
  root.innerHTML='';
  const list=Array.isArray(items)?items:[];
  if(!list.length){ root.innerHTML='<div class="st-hint pages-empty">Пока пусто</div>'; return; }
  const isRecent = root===recentPagesList;
  const isFav = root===favoritePagesList;
  const selectMode = isRecent ? pagesSelectMode : (isFav ? favSelectMode : false);
  const selectedSet = isRecent ? pagesSelected : (isFav ? favSelected : new Set());
  const toShow=list.slice(0,80);
  toShow.forEach(item=>{
    const data=typeof item==='string'?{url:item,title:item}:item;
    const urlKey=String(data.url||'');
    const b=document.createElement('div');
    b.className='page-list-item'+(selectMode?' select-mode':'');
    const check=document.createElement('input');
    check.type='checkbox';
    check.className='page-list-check';
    check.checked=selectedSet.has(urlKey);
    check.addEventListener('click', (e)=>{ e.stopPropagation(); if(check.checked) selectedSet.add(urlKey); else selectedSet.delete(urlKey); if(isRecent) updatePagesSelectUI(); else updateFavSelectUI(); });
    b.appendChild(check);
    const main=document.createElement('button');
    main.className='page-list-main';
    main.style.cssText='flex:1; background:transparent; border:0; text-align:left; cursor:pointer;';
    const title=document.createElement('strong'); title.className='page-list-title'; title.textContent=tabTitle(data);
    const urlEl=document.createElement('small'); urlEl.className='page-list-url'; urlEl.textContent=urlKey;
    main.append(title,urlEl);
    main.addEventListener('click',()=>{
      if(selectMode){
        if(selectedSet.has(urlKey)) selectedSet.delete(urlKey); else selectedSet.add(urlKey);
        check.checked=selectedSet.has(urlKey);
        if(isRecent) updatePagesSelectUI(); else updateFavSelectUI();
        return;
      }
      if(!tabs.pageTabs.length) tabs.pageTabs=[{url:data.url,title:data.title||data.url}];
      tabs.pageTabs[tabs.activeTab]={url:data.url,title:data.title||tabTitle(data)};
      if(!tabs.tabWebviews[tabs.activeTab]) tabs.createTabWebview(tabs.activeTab);
      tabs.showTabWebview(tabs.activeTab);
      tabs.loadTabUrl(tabs.activeWebview,data.url);
      tabs.renderTabs(); tabs.saveTabs(); syncFavoriteButton();
      pagesModal?.classList.remove('show'); favoritesModal?.classList.remove('show');
    });
    b.appendChild(main);
    const del=document.createElement('button');
    del.className='page-list-delete';
    del.title='Удалить';
    del.textContent='×';
    del.addEventListener('click', async (e)=>{
      e.stopPropagation();
      if(!await askConfirmation(`Удалить «${tabTitle(data)}»?`, 'Удалить')) return;
      const targetUrl=urlKey;
      try{
        if(isRecent){
          try{ await native.recentPagesRemove?.(targetUrl); }catch{}
          recentPagesCache=recentPagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; return u!==targetUrl && !samePageUrl(u,targetUrl); });
          renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||''));
        } else {
          try{ await native.togglePageFavorite({url:targetUrl}); }catch{}
          try{ await native.pageFavoriteRemove?.(targetUrl); }catch{}
          favoritePagesCache=favoritePagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; return u!==targetUrl && !samePageUrl(u,targetUrl); });
          renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||''));
          syncFavoriteButton();
        }
        toast('Удалено');
      }catch{ toast('Не удалось удалить','error'); }
    });
    b.appendChild(del);
    const arrow=document.createElement('span'); arrow.className='page-list-arrow'; arrow.textContent='›';
    arrow.style.cursor='pointer';
    arrow.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(selectMode) return;
      if(!tabs.pageTabs.length) tabs.pageTabs=[{url:data.url,title:data.title||data.url}];
      tabs.pageTabs[tabs.activeTab]={url:data.url,title:data.title||tabTitle(data)};
      if(!tabs.tabWebviews[tabs.activeTab]) tabs.createTabWebview(tabs.activeTab);
      tabs.showTabWebview(tabs.activeTab);
      tabs.loadTabUrl(tabs.activeWebview,data.url);
      tabs.renderTabs(); tabs.saveTabs(); syncFavoriteButton();
      pagesModal?.classList.remove('show'); favoritesModal?.classList.remove('show');
    });
    b.appendChild(arrow);
    root.appendChild(b);
  });
}
pagesSearch?.addEventListener('input',()=>{ renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch.value)); if(pagesSelectMode) updatePagesSelectUI(); });
favoritesSearch?.addEventListener('input',()=>{ renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch.value)); if(favSelectMode) updateFavSelectUI(); });

let pagesSelectMode=false, pagesSelected=new Set();
let favSelectMode=false, favSelected=new Set();
const pagesSelectToggle=document.getElementById('pages-select-toggle');
const pagesSelectAllBtn=document.getElementById('pages-select-all');
const pagesDeleteBtn=document.getElementById('pages-delete-selected');
const pagesCancelBtn=document.getElementById('pages-cancel-select');
const pagesCountEl=document.getElementById('pages-selected-count');
const favSelectToggle=document.getElementById('favorites-select-toggle');
const favSelectAllBtn=document.getElementById('favorites-select-all');
const favDeleteBtn=document.getElementById('favorites-delete-selected');
const favCancelBtn=document.getElementById('favorites-cancel-select');
const favCountEl=document.getElementById('favorites-selected-count');
function selectionKeys(items, search) {
  return filterPages(items, search?.value || '').slice(0, 80).map((item) => String(typeof item === 'string' ? item : item?.url || '')).filter(Boolean);
}
function updatePagesSelectUI(){
  if(!pagesSelectToggle) return;
  pagesSelectToggle.textContent=pagesSelectMode?'Готово':'Выбрать';
  const hasSel=pagesSelectMode && pagesSelected.size>0;
  pagesSelectToggle.classList.toggle('hidden-btn',pagesSelectMode && hasSel);
  pagesSelectToggle.style.display=pagesSelectMode && hasSel?'none':'inline-flex';
  const visibleKeys=selectionKeys(recentPagesCache,pagesSearch);
  const allSelected=visibleKeys.length>0&&visibleKeys.every(key=>pagesSelected.has(key));
  if(pagesSelectAllBtn){pagesSelectAllBtn.textContent=allSelected?'Снять все':'Выбрать все';pagesSelectAllBtn.style.display=pagesSelectMode&&visibleKeys.length?'inline-flex':'none';}
  if(pagesDeleteBtn){pagesDeleteBtn.classList.toggle('hidden-btn',!hasSel);pagesDeleteBtn.style.display=hasSel?'inline-flex':'none';}
  if(pagesCancelBtn){pagesCancelBtn.classList.toggle('hidden-btn',!hasSel);pagesCancelBtn.style.display=hasSel?'inline-flex':'none';}
  if(pagesCountEl) pagesCountEl.textContent=String(pagesSelected.size);
  document.querySelectorAll('#recent-pages-list .page-list-item').forEach(el=>el.classList.toggle('select-mode', pagesSelectMode));
  document.querySelectorAll('#recent-pages-list .page-list-check').forEach((cb,i)=>{
    const item=filterPages(recentPagesCache, pagesSearch?.value||'')[i];
    const key=item? (typeof item==='string'?item:item.url):'';
    cb.checked=pagesSelected.has(key);
  });
}
function updateFavSelectUI(){
  if(!favSelectToggle) return;
  favSelectToggle.textContent=favSelectMode?'Готово':'Выбрать';
  const hasSel=favSelectMode && favSelected.size>0;
  favSelectToggle.classList.toggle('hidden-btn',favSelectMode && hasSel);
  favSelectToggle.style.display=favSelectMode && hasSel?'none':'inline-flex';
  const visibleKeys=selectionKeys(favoritePagesCache,favoritesSearch);
  const allSelected=visibleKeys.length>0&&visibleKeys.every(key=>favSelected.has(key));
  if(favSelectAllBtn){favSelectAllBtn.textContent=allSelected?'Снять все':'Выбрать все';favSelectAllBtn.style.display=favSelectMode&&visibleKeys.length?'inline-flex':'none';}
  if(favDeleteBtn){favDeleteBtn.classList.toggle('hidden-btn',!hasSel);favDeleteBtn.style.display=hasSel?'inline-flex':'none';}
  if(favCancelBtn){favCancelBtn.classList.toggle('hidden-btn',!hasSel);favCancelBtn.style.display=hasSel?'inline-flex':'none';}
  if(favCountEl) favCountEl.textContent=String(favSelected.size);
  document.querySelectorAll('#favorite-pages-list .page-list-item').forEach(el=>el.classList.toggle('select-mode', favSelectMode));
  document.querySelectorAll('#favorite-pages-list .page-list-check').forEach((cb,i)=>{
    const item=filterPages(favoritePagesCache, favoritesSearch?.value||'')[i];
    const key=item? (typeof item==='string'?item:item.url):'';
    cb.checked=favSelected.has(key);
  });
}
pagesSelectToggle?.addEventListener('click',()=>{ pagesSelectMode=!pagesSelectMode; if(!pagesSelectMode) pagesSelected.clear(); updatePagesSelectUI(); renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||'')); });
pagesSelectAllBtn?.addEventListener('click',()=>{const keys=selectionKeys(recentPagesCache,pagesSearch);if(keys.length&&keys.every(key=>pagesSelected.has(key)))keys.forEach(key=>pagesSelected.delete(key));else keys.forEach(key=>pagesSelected.add(key));renderPageList(recentPagesList,filterPages(recentPagesCache,pagesSearch?.value||''));updatePagesSelectUI();});
pagesCancelBtn?.addEventListener('click',()=>{ pagesSelectMode=false; pagesSelected.clear(); updatePagesSelectUI(); renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||'')); });
favSelectToggle?.addEventListener('click',()=>{ favSelectMode=!favSelectMode; if(!favSelectMode) favSelected.clear(); updateFavSelectUI(); renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||'')); });
favSelectAllBtn?.addEventListener('click',()=>{const keys=selectionKeys(favoritePagesCache,favoritesSearch);if(keys.length&&keys.every(key=>favSelected.has(key)))keys.forEach(key=>favSelected.delete(key));else keys.forEach(key=>favSelected.add(key));renderPageList(favoritePagesList,filterPages(favoritePagesCache,favoritesSearch?.value||''));updateFavSelectUI();});
favCancelBtn?.addEventListener('click',()=>{ favSelectMode=false; favSelected.clear(); updateFavSelectUI(); renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||'')); });
pagesDeleteBtn?.addEventListener('click',async()=>{
  if(!pagesSelected.size) return;
  if(!await askConfirmation(`Удалить ${pagesSelected.size} страниц из истории?`, 'Удалить из истории')) return;
  const toDelete=new Set(pagesSelected);
  try{
    for(const url of toDelete){
      try{ await native.recentPagesRemove?.(url); }catch{}
      recentPagesCache=recentPagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; return !toDelete.has(u) && !samePageUrl(u, [...toDelete][0]); });
      recentPagesCache=recentPagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; for(const d of toDelete) if(d===u || samePageUrl(d,u)) return false; return true; });
    }
    pagesSelected.clear();
    pagesSelectMode=false;
    updatePagesSelectUI();
    renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||''));
    toast('Удалено');
  }catch(e){ toast('Не удалось удалить','error'); }
});
favDeleteBtn?.addEventListener('click',async()=>{
  if(!favSelected.size) return;
  if(!await askConfirmation(`Удалить ${favSelected.size} из избранного?`, 'Удалить из избранного')) return;
  const toDelete=new Set(favSelected);
  try{
    for(const url of toDelete){
      try{ await native.togglePageFavorite({url}); }catch{}
      try{ await native.pageFavoriteRemove?.(url); }catch{}
    }
    favoritePagesCache=favoritePagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; for(const d of toDelete) if(d===u || samePageUrl(d,u)) return false; return true; });
    favSelected.clear();
    favSelectMode=false;
    updateFavSelectUI();
    renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||''));
    syncFavoriteButton();
    toast('Удалено из избранного');
  }catch(e){ toast('Не удалось удалить','error'); }
});
btnPages?.addEventListener('click',openPages);
btnPageFavorites?.addEventListener('click',openFavorites);
btnClosePages?.addEventListener('click',()=>pagesModal?.classList.remove('show'));
btnCloseFavorites?.addEventListener('click',()=>favoritesModal?.classList.remove('show'));
pagesModal?.addEventListener('click',e=>{if(e.target===pagesModal)pagesModal.classList.remove('show')});
favoritesModal?.addEventListener('click',e=>{if(e.target===favoritesModal)favoritesModal.classList.remove('show')});
btnPageFavorite?.addEventListener('click',async()=>{
  let url='',title='';
  try{url=tabs.activeWebview?.getURL?.()||'';}catch{}
  if(!isAnimeOnUrl(url)) url=tabs.pageTabs[tabs.activeTab]?.url||'';
  try{title=await tabs.activeWebview?.getTitle?.()||'';}catch{}
  if(!isAnimeOnUrl(url)){toast('Открой страницу AnimeOn, чтобы добавить её в избранное','error');return;}
  try{
    const r=await native.togglePageFavorite({url,title});
    if(!r?.ok){toast('Не удалось изменить избранное','error');return;}
    syncFavoriteButton();
    toast(r.favorite?'Добавлено в избранное':'Удалено из избранного');
  }catch{toast('Не удалось изменить избранное','error');}
});
  return { openPages, openFavorites, syncFavoriteButton };
}