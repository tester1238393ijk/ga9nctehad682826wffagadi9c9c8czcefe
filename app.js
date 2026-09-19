'use strict';

(() => {
  const telegram = window.Telegram?.WebApp;
  const form = document.getElementById('document-form');
  const container = document.getElementById('fields');
  const error = document.getElementById('error');
  const preview = document.getElementById('preview');
  const submit = document.getElementById('submit');
  const demo = {
    title: 'Formular', kind: 'lease', fields: [
      {key:'tenant_name',label:'Name',type:'text',value:''},
      {key:'tenant_address',label:'Anschrift',type:'text',value:''},
      {key:'tenant_phone',label:'Telefon',type:'text',value:''},
      {key:'tenant_email',label:'E-Mail',type:'text',value:''},
      {key:'property_address',label:'Anschrift der Wohnung',type:'text',value:''},
      {key:'start_date',label:'Beginn',type:'date',value:''},
      {key:'gross_cents',label:'Miete EUR',type:'money',value:''},
      {key:'deposit_cents',label:'Kaution EUR',type:'money',value:''},
      {key:'signing_city',label:'Unterzeichnungsort',type:'text',value:''},
      {key:'signing_date',label:'Datum',type:'date',value:''},
    ],
  };
  let context = demo;
  let ready = false;
  const controls = new Map();
  const original = new Map();
  let groups = [];
  function element(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  function fail(message) {
    error.textContent = message;
    error.hidden = false;
    error.scrollIntoView({block:'center',behavior:'smooth'});
  }
  try {
    const encoded = new URLSearchParams(location.hash.slice(1).replace(/#/g,'&')).get('form');
    if (encoded) {
      if (encoded.length > 150000) throw new Error();
      const bytes = Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if (parsed.v !== 1 || typeof parsed.t !== 'string' || !/^[\w-]{32}$/.test(parsed.t) || typeof parsed.title !== 'string' || !['lease','residence','wifi','nameplates'].includes(parsed.kind)) throw new Error();
      if (parsed.kind === 'nameplates') {
        if (!Array.isArray(parsed.groups) || parsed.groups.length > 100) throw new Error();
      } else if (!Array.isArray(parsed.fields) || parsed.fields.length > 100 || parsed.fields.some(f => !f || typeof f.key !== 'string' || !/^[a-z_]+$/.test(f.key) || typeof f.label !== 'string' || typeof f.value !== 'string')) throw new Error();
      context = parsed;
      ready = Boolean(telegram && telegram.platform !== 'unknown' && typeof telegram.sendData === 'function');
    }
  } catch { fail('Formular konnte nicht geladen werden. Bitte im Chat erneut öffnen.'); }
  history.replaceState(null,'',location.pathname);
  document.getElementById('title').textContent = context.title;
  document.getElementById('summary').textContent = context.kind === 'nameplates' ? '' : context.fields.find(f => f.key === 'tenant_name')?.value || '';
  preview.disabled = !ready;
  submit.disabled = !ready;
  if (!ready) submit.textContent = 'Über Telegram öffnen';
  telegram?.ready();
  telegram?.expand();
  function groupTitle(key) {
    if (key === 'variant') return 'Variante';
    if (key.startsWith('tenant_') || ['first_names','last_names','additional_residents','additional_tenants'].includes(key)) return 'Person';
    if (key.startsWith('landlord_') || key.startsWith('provider_') || key.startsWith('owner_')) return 'Vermieter / Wohnungsgeber';
    if (/^(rent|deposit)_(holder|bank|iban|reference)$/.test(key)) return 'Konten';
    if (key.startsWith('signing_')) return 'Unterschrift';
    return 'Wohnung und Vereinbarungen';
  }
  function inputFor(field) {
    const wrap = element('div',undefined,'field');
    const label = element('label',field.label);
    const id = 'field-' + field.key;
    label.htmlFor = id;
    let input;
    if (field.type === 'boolean' || Array.isArray(field.options)) {
      input = element('select');
      const options = field.type === 'boolean' ? [['Ja','Ja'],['Nein','Nein']] : field.options;
      for (const option of options) {
        if (!Array.isArray(option) || option.length !== 2 || option.some(value => typeof value !== 'string')) continue;
        const node = element('option',option[1]);
        node.value = option[0];
        input.append(node);
      }
    } else if (/(address|rooms|furnishings|shared_use|description|tenants|residents|agreements|reason|exception|graduated)/.test(field.key)) {
      input = element('textarea');
      input.rows = 3;
      wrap.classList.add('wide');
    } else {
      input = element('input');
      input.type = field.type === 'date' ? 'date' : field.key.endsWith('_email') ? 'email' : field.key.endsWith('_phone') ? 'tel' : 'text';
      if (['money','decimal','integer'].includes(field.type)) input.inputMode = 'decimal';
    }
    input.id = id;
    input.name = field.key;
    input.maxLength = field.key === 'additional_agreements' ? 4000 : 2000;
    input.autocomplete = 'off';
    let value = field.value;
    if (field.type === 'date' && /^\d{2}\.\d{2}\.\d{4}$/.test(value)) value = value.split('.').reverse().join('-');
    input.value = value;
    original.set(field.key,input.value);
    controls.set(field.key,input);
    input.addEventListener('input',() => {
      error.hidden = true;
      if (field.key === 'tenant_name') document.getElementById('summary').textContent = input.value;
    });
    if (field.key === 'variant') input.addEventListener('change',() => {
      for (const [key,value] of Object.entries(context.defaults?.[input.value] || {})) {
        if (controls.has(key) && typeof value === 'string') controls.get(key).value = value;
      }
      visibility();
    });
    if (['owner_is_provider','rent_adjustment','term_end'].includes(field.key)) input.addEventListener('change',visibility);
    wrap.append(label,input);
    return wrap;
  }
  function visibility() {
    const variant = controls.get('variant')?.value;
    const areaLabel = controls.get('area_sqm')?.closest('.field').querySelector('label');
    if (areaLabel) areaLabel.textContent = variant === 'variant2' ? 'Wohnfläche m²' : 'Zimmerfläche m²';
    const apartment = ['floor','rooms_description','additional_space','keys_description','additional_tenants','garage_cents','heating_cents','rent_adjustment','graduated_rents','rent_exception','term_end','term_reason'];
    const room = ['shared_rooms','furnishings','shared_use','key_count','key_description'];
    for (const [key,input] of controls) {
      let hidden = Boolean(variant && (variant === 'variant2' ? room.includes(key) : apartment.includes(key)));
      if (['owner_first_names','owner_last_names'].includes(key)) hidden = controls.get('owner_is_provider')?.value !== 'Nein';
      if (key === 'graduated_rents') hidden ||= controls.get('rent_adjustment')?.value !== 'graduated';
      if (key === 'term_reason') hidden ||= !controls.get('term_end')?.value;
      input.closest('.field').hidden = hidden;
    }
  }
  function renderGroups() {
    container.replaceChildren();
    groups.forEach((group,index) => {
      const card = element('section',undefined,'sign');
      const header = element('div',undefined,'sign-head');
      const remove = element('button','Entfernen','secondary');
      remove.type = 'button';
      remove.addEventListener('click',() => {groups.splice(index,1);renderGroups();});
      header.append(element('h2','Schild '+(index+1)),remove);
      card.append(header);
      for (const [key,label] of [['names','Namen auf dem Schild'],['phone','Telefonnummer für Fundhinweis']]) {
        const wrap = element('div',undefined,'field');
        const input = element(key === 'names' ? 'textarea' : 'input');
        const title = element('label',label);
        input.id = 'sign-'+index+'-'+key;
        title.htmlFor = input.id;
        input.value = key === 'names' ? group.names.join('\n') : group.phone;
        input.maxLength = key === 'names' ? 20000 : 80;
        if (key === 'phone') input.type = 'tel';
        input.addEventListener('input',() => {
          group[key] = key === 'names' ? [...new Set(input.value.split(/[\r\n;]+/).map(s=>s.trim()).filter(Boolean))] : input.value;
          error.hidden = true;
        });
        wrap.append(title,input);card.append(wrap);
      }
      container.append(card);
    });
    const add = element('button','Schild hinzufügen','secondary');
    add.type = 'button';add.disabled = groups.length >= 100;
    add.addEventListener('click',() => {groups.push({names:[],phone:''});renderGroups();});
    container.append(add);
  }
  if (context.kind === 'nameplates') {
    groups = context.groups.map(group => ({names:Array.isArray(group.names) ? group.names.filter(n => typeof n === 'string') : [],phone:typeof group.phone === 'string' ? group.phone : ''}));
    renderGroups();
  } else {
    const sections = new Map();
    for (const field of context.fields) {
      const title = groupTitle(field.key);
      if (!sections.has(title)) {
        const details = element('details');
        details.open = sections.size < 2;
        const grid = element('div',undefined,'grid');
        details.append(element('summary',title),grid);
        container.append(details);
        sections.set(title,grid);
      }
      sections.get(title).append(inputFor(field));
    }
    visibility();
  }
  function send(action) {
    if (!ready) return;
    error.hidden = true;
    const payload = {v:1,t:context.t,action};
    if (context.kind === 'nameplates') payload.groups = groups;
    else payload.changes = Object.fromEntries([...controls].filter(([key,input]) => input.value !== original.get(key)).map(([key,input]) => [key,input.value]));
    const data = JSON.stringify(payload);
    if (new TextEncoder().encode(data).length > 4096) {fail('Zu viele Änderungen für eine Nachricht. Bitte zuerst einen Teil mit „Vorschau aktualisieren“ übernehmen.');return;}
    try {telegram.sendData(data);preview.disabled = true;submit.disabled = true;}
    catch {fail('Senden fehlgeschlagen. Bitte erneut versuchen.');}
  }
  form.addEventListener('submit',event => {event.preventDefault();send('pdf');});
  preview.addEventListener('click',() => send('preview'));
})();
