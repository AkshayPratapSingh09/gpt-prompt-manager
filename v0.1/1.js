// content.js — full working version (instant insert/clear + variable substitution)
// Last updated: 2025‑05‑13
/* ---------------------------------------------------------------------
 * 0. CONSTANTS & GLOBALS
 * ------------------------------------------------------------------ */
const COMPOSER_P_SELECTOR = 'p[data-placeholder="Ask anything"]';
let activeCardId = null; // prompt‑card that currently owns the composer

/* ---------------------------------------------------------------------
 * 1. CHATGPT COMPOSER HELPERS
 * ------------------------------------------------------------------ */
/** Wait until ChatGPT's unified composer <form> mounts (SPA‑safe). */
const waitForComposerForm = () =>
  new Promise((resolve) => {
    const id = setInterval(() => {
      const form = document.querySelector('form[data-type="unified-composer"]');
      if (form) {
        clearInterval(id);
        resolve(form);
      }
    }, 250);
  });

/** Get the <p> element we type into. */
const getComposerParagraph = () => document.querySelector(COMPOSER_P_SELECTOR);

/** Fire an *input* event so ProseMirror / React updates internal state. */
const fireInput = (el) => el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));

/** Instantly set composer text and notify ProseMirror. */
function setComposerText(text) {
  const p = getComposerParagraph();
  if (!p) return;
  p.textContent = text;
  fireInput(p);
}

/** Clear composer content and notify ProseMirror. */
function clearComposer() {
  const p = getComposerParagraph();
  if (!p) return;
  p.innerHTML = '';
  const br = document.createElement('br');
  br.className = 'ProseMirror-trailingBreak';
  p.appendChild(br);
  fireInput(p);
}

/* ---------------------------------------------------------------------
 * 2. VARIABLE UTILITIES
 * ------------------------------------------------------------------ */

/** Extract placeholders of the form {{%VAR%}} from text. */
const extractVariables = (text) => {
  return [...new Set([...text.matchAll(/{{%([a-zA-Z0-9_]+)%}}/g)].map((m) => m[1]))];
};

/** Replace placeholders with values from corresponding variable rows. */
function resolveVariables(template) {
  return template.replace(/{{%([a-zA-Z0-9_]+)%}}/g, (match, varName) => {
    const row = document.querySelector(`.variable-row[data-var="${varName}"]`);
    if (!row) return match; // row not present => leave placeholder

    const enabled = row.querySelector('input[type="checkbox"]')?.checked;
    const valueInput = row.querySelector('input:nth-of-type(2)');
    const val = valueInput ? valueInput.value.trim() : '';

    if (!enabled || !val || val.toLowerCase() === 'null') return match;
    return val;
  });
}

/** HTML for one variable row inside the editor tab. */
const getVariableRowHTML = (name) => `
  <div class="variable-row" data-var="${name}">
    <input type="text" value="${name}" readonly>
    <input type="text" placeholder="Type the value here" value="null">
    <label class="switch"><input type="checkbox" checked><span class="slider round"></span></label>
    <button class="delete-var-btn">✕</button>
  </div>`;

/* ---------------------------------------------------------------------
 * 3. PROMPT‑MANAGER MARKUP FACTORIES
 * ------------------------------------------------------------------ */
const createPromptCard = (title, body, variableCount, id) => `
  <div class="prompt-card" data-card-id="${id}">
    <div class="prompt-card-header">
      <strong>${title}</strong>
      <label class="switch">
        <input type="checkbox">
        <span class="slider round"></span>
      </label>
    </div>
    <div class="prompt-card-body">${body}</div>
    <div class="prompt-card-footer">
      ${variableCount} variables
      <button class="edit-btn" data-title="${encodeURIComponent(title)}" data-body="${encodeURIComponent(body)}" data-id="${id}">Edit</button>
    </div>
  </div>`;

const createPromptManager = () => `
  <div class="prompt-manager-container">
    <div class="prompt-manager">
      <span class="prompt-info">Prompt Manager</span>
      <button class="expand-toggle" id="expand-toggle">▼</button>
    </div>
    <div class="prompt-manager-content" id="prompt-manager-content">
      <div class="tabs-container">
        <div class="tabs-header" id="tabs-header">
          <div class="tab active" data-tab="tab-home">Prompt Manager</div>
        </div>
        <div class="tab-content active" id="tab-home">
          <div class="prompt-cards" id="prompt-cards">
            ${createPromptCard('Professional Email',
              'Write a professional email to {{%RECIPIENT%}} regarding {{%SUBJECT%}}.', 2, 'card-1')}
            ${createPromptCard('Code Review',
              'Review the following {{%LANGUAGE%}} code for quality and performance.', 1, 'card-2')}
          </div>
          <button class="add-prompt-btn" id="add-prompt-btn">Add New Prompt</button>
        </div>
      </div>
    </div>
  </div>`;

/* ---------------------------------------------------------------------
 * 4. TAB & EDITOR MANAGEMENT
 * ------------------------------------------------------------------ */

/** Activate a <div.tab>. */
const activateTab = (tabEl) => {
  if (!tabEl) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  tabEl.classList.add('active');
  document.getElementById(tabEl.dataset.tab)?.classList.add('active');
};

/** Generic tab‑header click handler. */
const handleTabClick = (e) => {
  if (e.target.classList.contains('close-tab')) return; // ignore close X click
  const tab = e.target.closest('.tab');
  if (tab) activateTab(tab);
};

/** Add click listeners to current tabs. */
const setupTabSwitching = () => {
  document.getElementById('tabs-header')?.querySelectorAll('.tab').forEach((tab) => {
    tab.removeEventListener('click', handleTabClick);
    tab.addEventListener('click', handleTabClick);
  });
};

/** Create / open an edit tab for a prompt. */
function createEditTab(tabId = `edit-${Date.now()}`, title = 'New Prompt', body = '', cardId = null) {
  const tabsHeader = document.getElementById('tabs-header');
  const tabsContainer = document.querySelector('.tabs-container');

  // Header
  const header = document.createElement('div');
  header.className = 'tab';
  header.dataset.tab = tabId;
  header.innerHTML = `${title} <span class="close-tab">×</span>`;
  tabsHeader.appendChild(header);

  // Content
  const content = document.createElement('div');
  content.className = 'tab-content';
  content.id = tabId;

  const vars = extractVariables(body);
  const varRows = vars.map(getVariableRowHTML).join('');

  content.innerHTML = `
    <div class="section">
      <label class="section-title">Prompt Title</label>
      <input class="prompt-title-input" type="text" value="${title}">
    </div>
    <div class="section">
      <label class="section-title">Prompt Body</label>
      <textarea class="prompt-input" rows="6">${body}</textarea>
    </div>
    <div class="section">
      <label class="section-title">Variables</label>
      <div class="variable-container" id="var-container-${tabId}">${varRows}</div>
      <button class="submit-btn" data-editing-id="${cardId || ''}">Submit</button>
    </div>`;
  tabsContainer.appendChild(content);

  /* VARIABLE SYNC (add/remove when editing body) */
  const textarea = content.querySelector('.prompt-input');
  const varContainer = content.querySelector('.variable-container');
  textarea.addEventListener('input', () => {
    const currentVars = extractVariables(textarea.value);
    const existing = [...varContainer.querySelectorAll('.variable-row')].map((r) => r.dataset.var);

    // add new vars
    currentVars.forEach((v) => {
w
