importScripts('../pwa-worker.js');

configureNewsWorker([
  "../reading-state.js",
  "../pwa-install.js",
  "manifest-pt-br.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "news.js",
  "portuguese-br-dictionary-01.txt",
  "portuguese-br-dictionary-02.txt",
  "portuguese-br-dictionary-03.txt",
  "portuguese-br-dictionary-04.txt",
  "portuguese-br-dictionary-05.txt",
  "portuguese-br-dictionary-06.txt",
  "portuguese-br-dictionary-07.txt",
  "portuguese-br-dictionary-08.txt"
], undefined, '6');
