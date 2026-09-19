'use strict';

(() => {
  const telegram = window.Telegram?.WebApp;
  const form = document.getElementById('document-form');
  const container = document.getElementById('fields');
  const error = document.getElementById('error');
  const schemas = window.DocumentForms;
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
    const encoded = window.DocumentContext || new URLSearchParams(location.hash.slice(1).replace(/#/g,'&')).get('form');
    delete window.DocumentContext;
    if (encoded) {
      if (encoded.length > 150000) throw new Error();
      const bytes = Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if (parsed.v === 2 && schemas?.fields[parsed.kind]) {
        parsed.title=schemas.titles[parsed.kind];
        if(parsed.kind!=='nameplates') {
          if(!Array.isArray(parsed.values)||![schemas.fields[parsed.kind].length,({lease:schemas.fields.lease.length-3,'operating-costs':schemas.fields['operating-costs'].length-5})[parsed.kind]].includes(parsed.values.length)||parsed.values.some(value=>typeof value!=='string')) throw new Error();
          parsed.fields=schemas.fields[parsed.kind].slice(0,parsed.values.length).map((field,index)=>({...field,value:parsed.values[index],...(field.key==='variant'?{options:['variant1','variant2','variant3'].map((id,i)=>[id,parsed.variants?.[i]||('Variante '+(i+1))])}:{}),...(field.key==='rent_adjustment'?{options:[['fixed','Keine Vereinbarung'],['index','Indexmiete'],['graduated','Staffelmiete']]}:{})}));
          parsed.defaults=schemas.defaults;
        }
      }
      if (![1,2].includes(parsed.v) || typeof parsed.t !== 'string' || !/^[\w-]{32}$/.test(parsed.t) || typeof parsed.title !== 'string' || !['lease','residence','wifi','nameplates','operating-costs'].includes(parsed.kind)) throw new Error();
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
  submit.disabled = !ready;
  if (!ready) submit.textContent = 'Über Telegram öffnen';
  telegram?.ready();
  telegram?.expand();
  if(telegram?.isVersionAtLeast?.('6.1')) {telegram.setHeaderColor('#171719');telegram.setBackgroundColor('#171719');}
  if(telegram?.isVersionAtLeast?.('7.10')) telegram.setBottomBarColor('#171719');
  function groupTitle(key) {
    if (key === 'variant') return 'Variante';
    if (key === 'payment_qr_enabled') return 'Zahlung';
    if (key.startsWith('tenant_') || ['first_names','last_names','additional_residents','additional_tenants'].includes(key)) return 'Person';
    if (key.startsWith('landlord_') || key.startsWith('provider_') || key.startsWith('owner_')) return 'Vermieter / Wohnungsgeber';
    if (/^(rent|deposit)_(holder|bank|iban|reference|bic)$/.test(key)) return 'Konten';
    if (key.startsWith('signing_')) return context.kind==='operating-costs'?'Briefdatum':'Unterschrift';
    if(context.kind==='operating-costs') {
      if(/^(management|tax_|additional_costs)/.test(key)) return 'Betriebskosten';
      if(key.startsWith('prepayment_')) return 'Vorauszahlungen';
      if(/^(refund_|payment_)/.test(key)) return 'Zahlung';
      if(['salutation','notes','attachment_label'].includes(key)) return 'Brief und Anlage';
    }
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
    } else if (/(address|rooms|furnishings|shared_use|description|tenants|residents|agreements|reason|exception|graduated|notes)/.test(field.key)) {
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
      updateCostTotals();
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
  function updateCostTotals() {
    if(context.kind!=='operating-costs') return;
    const number=key=>{let value=controls.get(key)?.value||'0';if(value.includes(',')) value=value.replace(/\./g,'').replace(',','.');return Number(value.replace(/\s/g,''))||0;};
    const cents=key=>Math.round(number(key)*100);
    const costs=cents('management_cents')+cents('tax_installment_cents')*number('tax_installments')+cents('additional_costs_cents');
    const payments=cents('prepayment_cents')*number('prepayment_count');
    const balance=costs-payments;
    const summary=document.getElementById('cost-totals');
    if(summary) {summary.textContent=(balance<0?'Guthaben':balance>0?'Nachzahlung':'Saldo')+' · '+(balance<0?'+':'')+new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Math.abs(balance)/100);summary.classList.toggle('refund',balance<0);}
  }
  function visibility() {
    const variant = controls.get('variant')?.value;
    const areaLabel = controls.get('area_sqm')?.closest('.field').querySelector('label');
    if (areaLabel) areaLabel.textContent = variant === 'variant2' ? 'Wohnfläche m²' : 'Zimmerfläche m²';
    const apartment = ['floor','rooms_description','additional_space','keys_description','garage_cents','heating_cents','rent_adjustment','graduated_rents','rent_exception','term_end','term_reason'];
    const room = ['shared_rooms','furnishings','shared_use','key_count','key_description'];
    for (const [key,input] of controls) {
      let hidden = context.kind === 'lease' && ['variant','signing_city','signing_date'].includes(key) || Boolean(variant && (variant === 'variant2' ? room.includes(key) : apartment.includes(key)));
      if (['owner_first_names','owner_last_names'].includes(key)) hidden = controls.get('owner_is_provider')?.value !== 'Nein';
      if (key === 'graduated_rents') hidden ||= controls.get('rent_adjustment')?.value !== 'graduated';
      if (key === 'term_reason') hidden ||= !controls.get('term_end')?.value;
      input.closest('.field').hidden = hidden;
    }
    for (const section of container.querySelectorAll('details')) {
      section.hidden = ![...section.querySelectorAll('.field')].some(field => !field.hidden);
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
      const wrap=element('div',undefined,'field'), title=element('label','Namen auf dem Schild'), input=element('textarea');
      input.id='sign-'+index+'-names'; title.htmlFor=input.id; input.value=group.names.join('\n');input.maxLength=20000;
      input.addEventListener('input',()=>{group.names=[...new Set(input.value.split(/[\r\n;]+/).map(value=>value.trim()).filter(Boolean))];error.hidden=true;});
      wrap.append(title,input);card.append(wrap);
      group.phones.forEach((phone,phoneIndex)=>{
        const row=element('div',undefined,'phone-row'), field=element('div',undefined,'field'), label=element('label','Fundhinweis '+(phoneIndex+1)+' · Telefonnummer'), value=element('input');
        value.type='tel';value.maxLength=80;value.id='sign-'+index+'-phone-'+phoneIndex;label.htmlFor=value.id;value.value=phone;
        value.addEventListener('input',()=>{group.phones[phoneIndex]=value.value;error.hidden=true;});
        const remove=element('button','Entfernen','secondary');remove.type='button';remove.setAttribute('aria-label','Fundhinweis '+(phoneIndex+1)+' entfernen');
        remove.addEventListener('click',()=>{group.phones.splice(phoneIndex,1);renderGroups();});
        field.append(label,value);row.append(field,remove);card.append(row);
      });
      const addPhone=element('button','Fundhinweis hinzufügen','secondary');addPhone.type='button';
      addPhone.addEventListener('click',()=>{group.phones.push('');renderGroups();});card.append(addPhone);
      container.append(card);
    });
    const add = element('button','Schild hinzufügen','secondary');
    add.type = 'button';add.disabled = groups.length >= 100;
    add.addEventListener('click',() => {groups.push({names:[],phones:[]});renderGroups();});
    container.append(add);
  }
  if (context.kind === 'nameplates') {
    groups = context.groups.map(group => ({names:Array.isArray(group.names) ? group.names.filter(n => typeof n === 'string') : [],phones:Array.isArray(group.phones) ? group.phones.filter(phone=>typeof phone==='string') : group.phone ? [group.phone] : []}));
    renderGroups();
  } else {
    const sections = new Map();
    for (const field of context.fields) {
      const title = groupTitle(field.key);
      if (!sections.has(title)) {
        const details = element('details');
        details.open = true;
        const grid = element('div',undefined,'grid');
        details.append(element('summary',title),grid);
        container.append(details);
        sections.set(title,grid);
      }
      sections.get(title).append(inputFor(field));
    }
    visibility();
  }
  let removeAttachment=false;
  if(context.kind==='operating-costs') {
    const totals=element('div',undefined,'totals');totals.id='cost-totals';container.append(totals);updateCostTotals();
    if(context.attachment) {
      const label=element('label',undefined,'attachment-option'), checkbox=element('input');checkbox.type='checkbox';
      checkbox.addEventListener('change',()=>{removeAttachment=checkbox.checked;});label.append(checkbox,element('span','Bisherige Bildanlage entfernen'));container.append(label);
    }
    container.append(element('p','Eine Bildanlage kannst du nach dem Speichern als Foto oder Datei im Chat senden.','attachment-help'));
  }
  function send(action) {
    if (!ready) return;
    error.hidden = true;
    const payload = {v:1,t:context.t,action};
    if(removeAttachment) payload.remove_attachment=true;
    if (context.kind === 'nameplates') payload.groups = groups;
    else payload.changes = Object.fromEntries([...controls].filter(([key,input]) => input.value !== original.get(key) && !(context.kind === 'lease' && ['variant','signing_city','signing_date'].includes(key))).map(([key,input]) => [key,input.value]));
    const data = JSON.stringify(payload);
    if (new TextEncoder().encode(data).length > 4096) {fail('Zu viele Änderungen für eine Nachricht. Bitte zuerst einen Teil übernehmen und danach weiter bearbeiten.');return;}
    try {telegram.sendData(data);submit.disabled = true;}
    catch {fail('Senden fehlgeschlagen. Bitte erneut versuchen.');}
  }
  form.addEventListener('submit',event => {event.preventDefault();send('preview');});
})();
