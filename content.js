// content.js – full file with:
// • variable persistence & substitution
// • conditional expand/collapse
// • prompt & var counters
// • delete-card button
// • counters auto‐updated on add/delete/toggle
// • local persistence via chrome.storage.local

/* ---------------------------------------------------------------------
 * 0. CONSTANTS & GLOBALS
 * ------------------------------------------------------------------ */
const COMPOSER_P_SELECTOR = 'p[data-placeholder="Ask anything"]';
let activeCardId = null;      // which prompt-card currently owns the composer
let promptsData = [];         // in-memory array of { id, title, body, varMap }

/** Default prompts on first install */
const defaultPrompts = [
  {
    id: 'card-1',
    title: 'Professional Email',
    body: 'Write a professional email to {{%RECIPIENT%}} regarding {{%SUBJECT%}}. The tone should be {{%TONE%}}...',
    varMap: {}
  },
  {
    id: 'card-2',
    title: 'Code Review',
    body: 'Review the following {{%LANGUAGE%}} code for: 1. Code quality 2. Performance 3. Security issues.',
    varMap: {}
  },
  {
    id: 'card-3',
    title: 'Blog Post',
    body: 'Write a blog post about {{%TOPIC%}} with {{%STYLE%}} style for {{%AUDIENCE%}}.',
    varMap: {}
  }
];

/* ---------------------------------------------------------------------
 * 0.5 STORAGE HELPERS
 * ------------------------------------------------------------------ */
/** Load prompts array from storage, fallback to defaults */
function loadPrompts() {
  return new Promise(resolve => {
    chrome.storage.local.get('prompts', data => {
      if (Array.isArray(data.prompts) && data.prompts.length) {
        resolve(data.prompts);
      } else {
        resolve(defaultPrompts);
      }
    });
  });
}
/** Persist current promptsData back to storage */
function savePrompts() {
  chrome.storage.local.set({ prompts: promptsData });
}

/* ---------------------------------------------------------------------
 * 0.6 COUNTER HELPERS
 * ------------------------------------------------------------------ */
function updatePromptCount() {
  const badge = document.getElementById('prompt-count');
  if (badge) badge.textContent = promptsData.length;
}
function updateVarCount() {
  const badge = document.getElementById('var-count');
  if (!badge) return;
  if (!activeCardId) {
    badge.textContent = 0;
    return;
  }
  const card = promptsData.find(p => p.id === activeCardId);
  badge.textContent = card ? extractVariables(card.body).length : 0;
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
        <div class="prompt-cards scrollable-cards" id="prompt-cards"></div>
        <button class="add-prompt-btn" id="add-prompt-btn">Add New Prompt</button>
      </div>
    </div>
  </div>
</div>`;
}

function createPromptCard(title, body, variableCount, id, varMap = {}) {
  const length = body.length;
  const dataVars = JSON.stringify(varMap);
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
    <button class="edit-btn" data-id="${id}">Edit</button>
    <button class="edit-btn delete-btn" data-id="${id}">Delete</button>
  </div>
</div>`;
}

function renderPromptCards() {
  const container = document.getElementById('prompt-cards');
  container.innerHTML = '';
  promptsData.forEach(p => {
    const varCount = extractVariables(p.body).length;
    container.insertAdjacentHTML('beforeend',
      createPromptCard(p.title, p.body, varCount, p.id, p.varMap));
  });
  updatePromptCount();
  updateVarCount();
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

  // sync variable rows
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

  // handle submit (add/edit)
  tabContent.querySelector('.submit-btn').addEventListener('click', () => {
    const newTitle = tabContent.querySelector('.prompt-title-input').value.trim();
    const newBody  = tabContent.querySelector('.prompt-input').value.trim();
    const newVars  = extractVariables(newBody);

    // build varMap
    const updatedMap = {};
    tabContent.querySelectorAll('.variable-row').forEach(row => {
      const key    = row.dataset.var;
      const val    = row.querySelector('input[type="text"]:nth-child(2)').value.trim();
      const en     = row.querySelector('input[type="checkbox"]').checked;
      if (en && val && val.toLowerCase() !== 'null') updatedMap[key] = val;
    });

    if (cardId) {
      // edit existing
      const idx = promptsData.findIndex(p => p.id === cardId);
      if (idx >= 0) {
        promptsData[idx] = { id: cardId, title: newTitle, body: newBody, varMap: updatedMap };
      }
    } else {
      // add new
      const newId = `card-${Date.now()}`;
      promptsData.push({ id: newId, title: newTitle, body: newBody, varMap: updatedMap });
    }

    // persist + rerender
    savePrompts();
    renderPromptCards();

    // close tab
    document.querySelector(`.tab[data-tab="${tabId}"]`).remove();
    tabContent.remove();
    activateTab(document.querySelector('.tab[data-tab="tab-home"]'));
  });
}

/* ---------------------------------------------------------------------
 * 5. EVENT LISTENERS
 * ------------------------------------------------------------------ */
function setupEventListeners() {
  const mainToggle  = document.getElementById('main-toggle');
  const expandBtn   = document.getElementById('expand-toggle');
  const contentPane = document.getElementById('prompt-manager-content');

  // expand/collapse only if mainToggle is on
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

  // Add new prompt
  document.getElementById('add-prompt-btn').addEventListener('click', () => createEditTab());

  // Delegated clicks: edit, delete-card, delete-var, close-tab
  document.addEventListener('click', async e => {
    const btn = e.target;

    if (btn.classList.contains('delete-btn')) {
      // delete card
      const id = btn.dataset.id;
      promptsData = promptsData.filter(p => p.id !== id);
      savePrompts();
      renderPromptCards();
      if (activeCardId === id) { clearComposer(); activeCardId = null; }
    }

    if (btn.classList.contains('edit-btn') && !btn.classList.contains('delete-btn')) {
      // edit card
      const id = btn.dataset.id;
      const p  = promptsData.find(x => x.id === id);
      createEditTab(undefined, p.title, p.body, id, p.varMap);
    }

    if (btn.classList.contains('delete-var-btn')) {
      btn.closest('.variable-row')?.remove();
    }

    if (btn.classList.contains('close-tab')) {
      e.stopPropagation();
      const tab = btn.closest('.tab');
      document.getElementById(tab.dataset.tab)?.remove();
      tab.remove();
      activateTab(document.querySelector('.tab[data-tab="tab-home"]'));
    }
  });

  // Prompt-card toggle substitution
  document.addEventListener('change', async e => {
    if (!e.target.matches('.prompt-card-header input[type="checkbox"]')) return;
    const cb   = e.target;
    const card = cb.closest('.prompt-card');
    const id   = card.dataset.cardId;
    let text   = card.querySelector('.prompt-card-body').textContent.trim();
    const varMap = promptsData.find(p => p.id === id)?.varMap || {};
    Object.keys(varMap).forEach(k => {
      text = text.split(`{{%${k}%}}`).join(varMap[k]);
    });

    await waitForComposerForm();

    if (cb.checked) {
      if (activeCardId && activeCardId !== id) {
        const prev = document.querySelector(`.prompt-card[data-card-id="${activeCardId}"] input[type="checkbox"]`);
        if (prev) prev.checked = false;
        clearComposer();
      }
      activeCardId = id;
      setComposerText(text);
    } else {
      clearComposer();
      activeCardId = null;
    }
    updateVarCount();
  });
}

/* ---------------------------------------------------------------------
 * 6. BOOTSTRAP
 * ------------------------------------------------------------------ */
async function insertPromptManager() {
  const form = await waitForComposerForm();
  if (!form || document.querySelector('.prompt-manager-container')) return;

  // load persisted prompts
  promptsData = await loadPrompts();

  // inject UI
  const wrapper = document.createElement('div');
  wrapper.innerHTML = createPromptManager();
  form.parentElement.insertBefore(wrapper, form);

  renderPromptCards();
  setupEventListeners();
  setupTabSwitching();
  updatePromptCount();
  updateVarCount();
}

document.addEventListener('DOMContentLoaded', insertPromptManager);
new MutationObserver(insertPromptManager).observe(document.body, {
  childList: true,
  subtree: true
});
