'use strict';

const installButton = document.querySelector('#install');
const standalone = window.matchMedia('(display-mode: standalone)');
const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installPrompt;

function updateInstallButton() {
  const installed = standalone.matches || navigator.standalone === true;
  installButton.hidden = installed || (!installPrompt && !isAppleMobile);
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  installPrompt = undefined;
  installButton.hidden = true;
});

standalone.addEventListener('change', updateInstallButton);

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    if (isAppleMobile) window.alert(installButton.dataset.iosHelp);
    return;
  }

  const prompt = installPrompt;
  installPrompt = undefined;
  installButton.disabled = true;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } finally {
    installButton.disabled = false;
    updateInstallButton();
  }
});

updateInstallButton();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('News service worker registration failed', error);
  });
}
