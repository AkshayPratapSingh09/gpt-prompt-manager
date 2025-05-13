// content.js

const waitForComposerForm = () => {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const form = document.querySelector('form[data-type="unified-composer"]');
        if (form) {
          clearInterval(interval);
          resolve(form);
        }
      }, 300);
    });
  };
  
  const createPromptManager = () => {
    return `
      <div class="prompt-manager-container">
        <div class="prompt-manager">
          <label class="toggle-switch">
            <input type="checkbox" id="main-toggle" checked>
            <span class="slider"></span>
          </label>
          <span class="prompt-info">Prompt: <span class="count-badge" id="prompt-count">3</span></span>
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
                ${createPromptCard("Professional Email", "Write a professional email to {{%RECIPIENT%}} regarding {{%SUBJECT%}}. The tone should be {{%TONE%}}...", 3, "card-1")}
                ${createPromptCard("Code Review", "Review the following {{%LANGUAGE%}} code for: 1. Code quality 2. Performance 3. Security issues...", 1, "card-2")}
                ${createPromptCard("Blog Post", "Write a blog post about {{%TOPIC%}} with {{%STYLE%}} style for {{%AUDIENCE%}}...", 3, "card-3")}
              </div>
              <button class="add-prompt-btn" id="add-prompt-btn">Add New Prompt</button>
            </div>
          </div>
        </div>
      </div>
    `;
  };
  
  const createPromptCard = (title, body, variableCount, id) => {
    return `
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
      </div>
    `;
  };
  
  const extractVariables = (text) => {
    const matches = [...text.matchAll(/{{%([a-zA-Z0-9_]+)%}}/g)];
    return [...new Set(matches.map(m => m[1]))];
  };
  
  const createEditTab = (tabId = `edit-${Date.now()}`, title = "New Prompt", body = "", cardId = null) => {
    const tabHeader = document.createElement('div');
    tabHeader.className = 'tab';
    tabHeader.dataset.tab = tabId;
    tabHeader.innerHTML = `${title} <span class="close-tab">×</span>`;
  
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = tabId;
  
    const vars = extractVariables(body);
    const varRows = vars.map(name => getVariableRowHTML(name)).join('');
  
    tabContent.innerHTML = `
      <div class="section">
        <label class="section-title">Prompt Title</label>
        <input class="prompt-title-input" type="text" value="${title}">
      </div>
      <div class="section">
        <label class="section-title">PROMPT</label>
        <textarea class="prompt-input" placeholder="Type Your Prompt Here">${body}</textarea>
        <label class="switch"><input type="checkbox" checked><span class="slider round"></span></label>
      </div>
      <div class="section">
        <label class="section-title">VARIABLES</label>
        <div id="variable-container-${tabId}" class="variable-container">
          ${varRows}
        </div>
        <button class="submit-btn" data-editing-id="${cardId || ''}">Submit</button>
      </div>`;
  
    document.getElementById('tabs-header').appendChild(tabHeader);
    document.querySelector('.tabs-container').appendChild(tabContent);
    
    // Improved tab switching setup
    setupTabSwitching();
    activateTab(tabHeader);
  
    const textarea = tabContent.querySelector('.prompt-input');
    const varContainer = tabContent.querySelector('.variable-container');
    textarea.addEventListener('input', () => {
      const currentText = textarea.value;
      const newVars = extractVariables(currentText);
      const existing = [...varContainer.querySelectorAll('[data-var]')].map(e => e.dataset.var);
  
      newVars.forEach(v => {
        if (!existing.includes(v)) {
          const newRow = document.createElement('div');
          newRow.className = 'variable-row';
          newRow.dataset.var = v;
          newRow.innerHTML = getVariableRowHTML(v);
          varContainer.appendChild(newRow);
        }
      });
  
      existing.forEach(existingVar => {
        if (!newVars.includes(existingVar)) {
          const toRemove = varContainer.querySelector(`[data-var="${existingVar}"]`);
          if (toRemove) toRemove.remove();
        }
      });
    });
  
    tabContent.querySelector('.submit-btn').addEventListener('click', () => {
      const promptTitle = tabContent.querySelector('.prompt-title-input').value.trim();
      const promptBody = tabContent.querySelector('.prompt-input').value.trim();
      const variableCount = extractVariables(promptBody).length;
      const editingId = tabContent.querySelector('.submit-btn').dataset.editingId;
      const cardsContainer = document.getElementById('prompt-cards');
  
      if (editingId) {
        const card = cardsContainer.querySelector(`[data-card-id="${editingId}"]`);
        if (card) {
          card.outerHTML = createPromptCard(promptTitle, promptBody, variableCount, editingId);
        }
      } else {
        const newId = `card-${Date.now()}`;
        const newCardHTML = createPromptCard(promptTitle, promptBody, variableCount, newId);
        cardsContainer.insertAdjacentHTML('beforeend', newCardHTML);
      }
  
      tabHeader.remove();
      tabContent.remove();
      activateTab(document.querySelector('.tab[data-tab="tab-home"]'));
    });
  };
  
  const getVariableRowHTML = (name) => {
    return `
      <div class="variable-row" data-var="${name}">
        <input type="text" value="${name}" readonly>
        <input type="text" placeholder="Type the value here" value="null">
        <label class="switch"><input type="checkbox" checked><span class="slider round"></span></label>
        <button class="delete-var-btn">✕</button>
      </div>`;
  };
  
  const activateTab = (tab) => {
    if (!tab) return;
    
    const allTabs = document.querySelectorAll('.tab');
    const allContents = document.querySelectorAll('.tab-content');
  
    allTabs.forEach(t => t.classList.remove('active'));
    allContents.forEach(tc => tc.classList.remove('active'));
  
    tab.classList.add('active');
    const content = document.getElementById(tab.dataset.tab);
    if (content) content.classList.add('active');
  };
  
  const setupTabSwitching = () => {
    const tabsHeader = document.getElementById('tabs-header');
    if (!tabsHeader) return;
  
    // Remove existing listeners to prevent duplicates
    const existingTabs = tabsHeader.querySelectorAll('.tab');
    existingTabs.forEach(tab => {
      tab.removeEventListener('click', handleTabClick);
    });
  
    // Add new listeners
    existingTabs.forEach(tab => {
      tab.addEventListener('click', handleTabClick);
    });
  };
  
  const handleTabClick = (e) => {
    // Don't activate if clicking the close button
    if (e.target.classList.contains('close-tab')) return;
    
    const tab = e.target.closest('.tab');
    if (tab) {
      activateTab(tab);
    }
  };
  
  const setupEventListeners = () => {
    document.getElementById('expand-toggle').addEventListener('click', (event) => {
      const content = document.getElementById('prompt-manager-content');
      content.classList.toggle('expanded');
      event.target.textContent = content.classList.contains('expanded') ? '▲' : '▼';
    });
  
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-btn')) {
        const btn = e.target;
        const title = decodeURIComponent(btn.dataset.title);
        const body = decodeURIComponent(btn.dataset.body);
        const cardId = btn.dataset.id;
        createEditTab(undefined, title, body, cardId);
      }
  
      if (e.target.classList.contains('close-tab')) {
        e.stopPropagation();
        const tab = e.target.closest('.tab');
        const tabId = tab.dataset.tab;
        const tabContent = document.getElementById(tabId);
        if (tabContent) tabContent.remove();
        tab.remove();
        
        // Activate home tab if no tabs left
        const remainingTabs = document.querySelectorAll('.tab');
        if (remainingTabs.length === 0) {
          const homeTab = document.querySelector('.tab[data-tab="tab-home"]');
          if (homeTab) activateTab(homeTab);
        } else {
          // Activate the last tab
          activateTab(remainingTabs[remainingTabs.length - 1]);
        }
      }
  
      if (e.target.classList.contains('delete-var-btn')) {
        e.target.closest('.variable-row')?.remove();
      }
    });
  
    document.getElementById('add-prompt-btn').addEventListener('click', () => {
      createEditTab();
    });
  };
  
  const insertPromptManager = async () => {
    const form = await waitForComposerForm();
    if (!form || document.querySelector('.prompt-manager-container')) return;
  
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createPromptManager();
    form.parentNode.insertBefore(wrapper, form);
    setupEventListeners();
  };
  
  document.addEventListener('DOMContentLoaded', insertPromptManager);
  new MutationObserver(insertPromptManager).observe(document.body, {
    childList: true,
    subtree: true,
  });