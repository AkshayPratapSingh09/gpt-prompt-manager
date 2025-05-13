const insertRedBox = () => {
    const target = document.querySelector("#thread-bottom");
    if (!target || document.getElementById("my-static-red-box")) return;
  
    const box = document.createElement("div");
    box.id = "my-static-red-box";
    box.innerHTML = `
      <div class="container">
        <div class="prompt-manager">
          <div class="prompt-manager-header">
            <label class="toggle-switch">
              <input type="checkbox" id="main-toggle">
              <span class="toggle-slider"></span>
            </label>
            <div class="prompt-count">Prompt: <span class="count-badge" id="prompt-count">0</span></div>
            <div class="var-count">Var: <span class="count-badge" id="var-count">0</span></div>
          </div>
          <div class="arrow">&#x2303;</div>
        </div>
  
        <div class="prompt-manager-content">
          <div class="tabs-container">
            <div class="tabs-header" id="tabs-header">
              <div class="tab active" data-tab="tab-home">Prompt Manager</div>
            </div>
            <div class="tab-content active" id="tab-home">
              <div class="tab-title">Prompt Manager</div>
              <div class="prompt-cards" id="prompt-cards">
                <!-- Prompt cards will be added here dynamically -->
              </div>
              <button class="add-prompt-btn" id="add-prompt-btn">Add New Prompt</button>
            </div>
          </div>
        </div>

      <template id="prompt-edit-template">
        <div class="section">
          <div class="section-title">PROMPT</div>
          <div class="prompt-header">
            <input type="text" class="input-field prompt-title" placeholder="Prompt Title" value="">
            <label class="toggle-switch">
              <input type="checkbox" class="prompt-toggle">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <textarea class="prompt-textarea prompt-text" placeholder="Type Your Prompt Here"></textarea>
        </div>
  
        <div class="section">
          <div class="section-title">VARIABLES</div>
          <div class="variable-header">
            <div>NAME</div>
            <div>VALUE</div>
            <div></div>
            <div></div>
          </div>
          <div class="variables-container">
            <!-- Variables will be added here dynamically -->
          </div>
          <button class="submit-btn">Submit</button>
        </div>
      </template>
    `;
  
    target.parentNode.insertBefore(box, target);
  };
  
  const observer = new MutationObserver(() => {
    insertRedBox();
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  