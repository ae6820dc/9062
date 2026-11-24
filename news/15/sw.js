importScripts('../pwa-worker.js');

configureNewsWorker([
  "../pwa-install.js",
  "manifest-vi.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "news.js",
  "vietnamese-dictionary-01.txt",
  "vietnamese-dictionary-02.txt",
  "vietnamese-dictionary-03.txt",
  "vietnamese-dictionary-04.txt",
  "vietnamese-dictionary-05.txt"
]);
