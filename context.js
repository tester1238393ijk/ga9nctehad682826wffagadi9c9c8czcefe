'use strict';
(() => {
  const params = new URLSearchParams(location.hash.slice(1).replace(/#/g,'&'));
  window.DocumentContext = params.get('form');
  params.delete('form');
  const remaining = params.toString();
  history.replaceState(null,'',location.pathname+location.search+(remaining?'#'+remaining:''));
  try {
    const key='__telegram__initParams', saved=JSON.parse(sessionStorage.getItem(key)||'null');
    if(saved&&Object.hasOwn(saved,'form')) {delete saved.form;sessionStorage.setItem(key,JSON.stringify(saved));}
  } catch {}
})();
