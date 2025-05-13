// content.js – full file with:
// • variable persistence & substitution
// • conditional expand/collapse
// • prompt & var counters
// • delete-card button
// • counters auto‐updated on add/delete/toggle

/* ---------------------------------------------------------------------
 * 0. CONSTANTS & GLOBALS
 * ------------------------------------------------------------------ */
const COMPOSER_P_SELECTOR = 'p[data-placeholder="Ask anything"]';
let activeCardId = null; // which prompt-card currently owns the composer

/* ---------------------------------------------------------------------
 * 0.5 COUNTER HELPERS
 * ------------------------------------------------------------------ */
function updatePromptCount() {
  const badge = document.getElementById('prompt-count');
  badge.textContent = document.querySelectorAll('.prompt-card').length;
}
function updateVarCount() {
  const badge = document.getElementById('var-count');
  if (!activeCardId) {
    badge.textContent = 0;
    return;
  }
  const card = document.querySelector(`.prompt-card[data-card-id="${activeCardId}"]`);
  if (!card) {
    badge.textContent = 0;
    return;
  }
  const vars = extractVariables(card.querySelector('.prompt-card-body').textContent);
  badge.textContent = vars.length;
}

/* ---------------------------------------------------------------------
 * 1. CHATGPT COMPOSER HELPERS
 * ------------------------------------------------------------------ */
function waitForComposerForm() {
  return new Promise(resolve => {
    const iv = setInterval(() => {
      const form = document.querySelector('form[data-type="unified-composer"]');
      if (form) {
        clearInterval(iv);
        resolve(form);
      }
    }, 300);
  });
}
function getComposerParagraph() {
  const form = document.querySelector('form[data-type="unified-composer"]');
  if (form) {
    const p = form.querySelector('[contenteditable="true"] p');
    if (p) return p;
  }
  return document.querySelector(COMPOSER_P_SELECTOR);
}
function setComposerText(text) {
  const p = getComposerParagraph();
  if (!p) return;
  p.innerText = text;
  p.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
}
function clearComposer() {
  setComposerText('');
}

/* ---------------------------------------------------------------------
 * 2. MARKUP FACTORIES
 * ------------------------------------------------------------------ */
function createPromptManager() {
  return `
<div class="prompt-manager-container">
  <div class="prompt-manager">
    <label class="toggle-switch">
      <input type="checkbox" id="main-toggle" checked>
      <span class="slider"></span>
    </label>
    <span class="prompt-info">Prompt: <span class="count-badge" id="prompt-count">0</span></span>
    <span class="var-info">Var: <span class="count-badge" id="var-count">0</span></span>
    <button class="expand-toggle" id="expand-toggle">▼</button>
  </div>
  <div class="prompt-manager-content" id="prompt-manager-content">
    <div class="tabs-container">
      <div class="tabs-header" id="tabs-header">
        <div class="tab active" data-tab="tab-home">Prompt Manager</div>
      </div>
      <div class="tab-content active" id="tab-home">
        <div class="tab-title">Prompt Manager</div>
        <div class="prompt-cards scrollable-cards" id="prompt-cards">
          ${createPromptCard('Professional Email','Write a professional email to {{%RECIPIENT%}} regarding {{%SUBJECT%}}. The tone should be {{%TONE%}}...',3,'card-1',{})}
          ${createPromptCard('Code Review','Review the following {{%LANGUAGE%}} code for: 1. Code quality 2. Performance 3. Security issues.',1,'card-2',{})}
          ${createPromptCard('Blog Post','Write a blog post about {{%TOPIC%}} with {{%STYLE%}} style for {{%AUDIENCE%}}.',3,'card-3',{})}
        </div>
        <button class="add-prompt-btn" id="add-prompt-btn">Add New Prompt</button>
      </div>
    </div>
  </div>
</div>`;
}

function createPromptCard(title, body, variableCount, id, varMap = {}) {
  const dataVars = JSON.stringify(varMap);
  const length = body.length;
  return `
<div class="prompt-card" data-card-id="${id}" data-variables='${dataVars}'>
  <div class="prompt-card-header">
    <strong>${title}</strong>
    <label class="switch">
      <input type="checkbox">
      <span class="slider round"></span>
    </label>
  </div>
  <div class="prompt-card-body">${body}</div>
  <div class="prompt-card-footer">
    ${variableCount} variables | ${length} chars
    <button class="edit-btn" data-title="${encodeURIComponent(title)}" data-body="${encodeURIComponent(body)}" data-id="${id}">Edit</button>
    <button class="edit-btn delete-btn" data-id="${id}">Delete</button>
  </div>
</div>`;
}

/* ---------------------------------------------------------------------
 * 3. VARIABLE UTILITIES
 * ------------------------------------------------------------------ */
function extractVariables(text) {
  return [...new Set([...text.matchAll(/{{%([a-zA-Z0-9_]+)%}}/g)].map(m => m[1]))];
}
function getVariableRowHTML(name, value = '', checked = false) {
  return `
  <div class="variable-row" data-var="${name}">
    <input type="text" value="${name}" readonly>
    <input type="text" placeholder="Type the value here" value="${value}">
    <label class="switch">
      <input type="checkbox"${checked ? ' checked' : ''}>
      <span class="slider round"></span>
    </label>
    <button class="delete-var-btn">✕</button>
  </div>`;
}

/* ---------------------------------------------------------------------
 * 4. TAB MANAGEMENT
 * ------------------------------------------------------------------ */
function activateTab(tab) {
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  tab.classList.add('active');
  const content = document.getElementById(tab.dataset.tab);
  if (content) content.classList.add('active');
}
function handleTabClick(e) {
  if (e.target.classList.contains('close-tab')) return;
  const tab = e.target.closest('.tab');
  if (tab) activateTab(tab);
}
function setupTabSwitching() {
  const header = document.getElementById('tabs-header');
  if (!header) return;
  header.querySelectorAll('.tab').forEach(t => {
    t.removeEventListener('click', handleTabClick);
    t.addEventListener('click', handleTabClick);
  });
}

function createEditTab(tabId = `edit-${Date.now()}`, title = 'New Prompt', body = '', cardId = null, varMap = {}) {
  const tabHeader = document.createElement('div');
  tabHeader.className = 'tab';
  tabHeader.dataset.tab = tabId;
  tabHeader.innerHTML = `${title} <span class="close-tab">×</span>`;

  const tabContent = document.createElement('div');
  tabContent.className = 'tab-content';
  tabContent.id = tabId;

  const vars = extractVariables(body);
  const varRows = vars.map(name => {
    const val = varMap[name] || '';
    const isChecked = name in varMap;
    return getVariableRowHTML(name, val, isChecked);
  }).join('');

  tabContent.innerHTML = `
    <div class="section">
      <label class="section-title">Prompt Title</label>
      <input class="prompt-title-input" type="text" value="${title}">
    </div>
    <div class="section">
      <label class="section-title">PROMPT</label>
      <textarea class="prompt-input" placeholder="Type Your Prompt Here">${body}</textarea>
    </div>
    <div class="section">
      <label class="section-title">VARIABLES</label>
      <div id="variable-container-${tabId}" class="variable-container">${varRows}</div>
      <button class="submit-btn" data-editing-id="${cardId || ''}">Submit</button>
    </div>`;

  document.getElementById('tabs-header').appendChild(tabHeader);
  document.querySelector('.tabs-container').appendChild(tabContent);
  setupTabSwitching();
  activateTab(tabHeader);

  // variable sync
  tabContent.querySelector('.prompt-input').addEventListener('input', () => {
    const now = extractVariables(tabContent.querySelector('.prompt-input').value);
    const existing = [...tabContent.querySelectorAll('.variable-row')].map(r => r.dataset.var);
    now.forEach(v => {
      if (!existing.includes(v)) {
        tabContent.querySelector('.variable-container')
          .insertAdjacentHTML('beforeend', getVariableRowHTML(v));
      }
    });
    existing.forEach(v => {
      if (!now.includes(v)) {
        tabContent.querySelector(`[data-var="${v}"]`)?.remove();
      }
    });
  });

  // submit changes
  tabContent.querySelector('.submit-btn').addEventListener('click', () => {
    const newTitle = tabContent.querySelector('.prompt-title-input').value.trim();
    const newBody  = tabContent.querySelector('.prompt-input').value.trim();
    const newVars  = extractVariables(newBody);

    const updatedMap = {};
    tabContent.querySelectorAll('.variable-row').forEach(row => {
      const key    = row.dataset.var;
      const val    = row.querySelector('input[type="text"]:nth-child(2)').value.trim();
      const en     = row.querySelector('input[type="checkbox"]').checked;
      if (en && val && val.toLowerCase() !== 'null') updatedMap[key] = val;
    });

    const cards = document.getElementById('prompt-cards');
    if (cardId) {
      const card = cards.querySelector(`[data-card-id="${cardId}"]`);
      if (card) card.outerHTML = createPromptCard(newTitle, newBody, newVars.length, cardId, updatedMap);
    } else {
      const newId = `card-${Date.now()}`;
      cards.insertAdjacentHTML('beforeend',
        createPromptCard(newTitle, newBody, newVars.length, newId, updatedMap));
    }

    document.querySelector(`.tab[data-tab="${tabId}"]`).remove();
    tabContent.remove();
    activateTab(document.querySelector('.tab[data-tab="tab-home"]'));
    updatePromptCount();
    updateVarCount();
  });
}

/* ---------------------------------------------------------------------
 * 5. EVENT LISTENERS
 * ------------------------------------------------------------------ */
function setupEventListeners() {
  const mainToggle  = document.getElementById('main-toggle');
  const expandBtn   = document.getElementById('expand-toggle');
  const contentPane = document.getElementById('prompt-manager-content');

  // conditional expand/collapse
  expandBtn.addEventListener('click', e => {
    if (!mainToggle.checked) return;
    contentPane.classList.toggle('expanded');
    e.target.textContent = contentPane.classList.contains('expanded') ? '▲' : '▼';
  });
  mainToggle.addEventListener('change', e => {
    if (!e.target.checked) {
      contentPane.classList.remove('expanded');
      expandBtn.textContent = '▼';
    }
  });

  // add new prompt
  document.getElementById('add-prompt-btn').addEventListener('click', () => {
    createEditTab();
  });

  // delegated click: edit, delete-var, delete-card, close-tab
  document.addEventListener('click', e => {
    if (e.target.classList.contains('edit-btn') && !e.target.classList.contains('delete-btn')) {
      const btn    = e.target;
      const card   = btn.closest('.prompt-card');
      const varMap = JSON.parse(card.getAttribute('data-variables')||'{}');
      createEditTab(undefined,
        decodeURIComponent(btn.dataset.title),
        decodeURIComponent(btn.dataset.body),
        btn.dataset.id,
        varMap);
    }
    if (e.target.classList.contains('delete-var-btn')) {
      e.target.closest('.variable-row')?.remove();
    }
    if (e.target.classList.contains('delete-btn')) {
      const card = e.target.closest('.prompt-card');
      const id   = card.dataset.cardId;
      card.remove();
      if (activeCardId===id) {
        clearComposer();
        activeCardId=null;
      }
      updatePromptCount();
      updateVarCount();
    }
    if (e.target.classList.contains('close-tab')) {
      e.stopPropagation();
      const tab = e.target.closest('.tab');
      document.getElementById(tab.dataset.tab)?.remove();
      tab.remove();
      activateTab(document.querySelector('.tab[data-tab="tab-home"]'));
    }
  });

  // prompt toggle with substitution
  document.addEventListener('change', async e => {
    if (!e.target.matches('.prompt-card-header input[type="checkbox"]')) return;
    const cb   = e.target;
    const card = cb.closest('.prompt-card');
    const id   = card.dataset.cardId;
    let text   = card.querySelector('.prompt-card-body').textContent.trim();
    const varMap = JSON.parse(card.getAttribute('data-variables')||'{}');
    Object.keys(varMap).forEach(k => {
      text = text.split(`{{%${k}%}}`).join(varMap[k]);
    });

    await waitForComposerForm();

    if (cb.checked) {
      if (activeCardId && activeCardId!==id) {
        const prev = document.querySelector(`.prompt-card[data-card-id="${activeCardId}"] input[type="checkbox"]`);
        if (prev) prev.checked=false;
        clearComposer();
      }
      activeCardId=id;
      setComposerText(text);
    } else {
      clearComposer();
      activeCardId=null;
    }
    updateVarCount();
  });
}

/* ---------------------------------------------------------------------
 * 6. BOOTSTRAP
 * ------------------------------------------------------------------ */
async function insertPromptManager() {
  const form = await waitForComposerForm();
  if (!form||document.querySelector('.prompt-manager-container')) return;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=createPromptManager();
  form.parentElement.insertBefore(wrapper,form);

  setupEventListeners();
  setupTabSwitching();
  updatePromptCount();
  updateVarCount();
}

document.addEventListener('DOMContentLoaded',insertPromptManager);
new MutationObserver(insertPromptManager).observe(document.body,{childList:true,subtree:true});
