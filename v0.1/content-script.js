function waitForChatGPTInputAndInsertBox() {
    const observer = new MutationObserver(() => {
    //   const target = document.querySelector('#prompt-textarea')?.closest('div[class*="ProseMirror"]')?.parentElement?.parentElement;
    const target = document.querySelector('.relative.z-1.flex.max-w-full.flex-1.flex-col.h-full');
  
      if (target && target.parentNode && !document.getElementById('my-red-box')) {
        observer.disconnect();
  
        fetch(chrome.runtime.getURL('redbox.html'))
          .then(response => response.text())
          .then(html => {
            const boxWrapper = document.createElement('div');
            boxWrapper.innerHTML = html;
  
            // Insert above the input box
            target.parentElement.insertBefore(boxWrapper.firstElementChild, target);
          });
      }
    });
  
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  waitForChatGPTInputAndInsertBox();
  