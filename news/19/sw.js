importScripts('../pwa-worker.js');

configureNewsWorker([
  "../reading-state.js",
  "../pwa-install.js",
  "manifest-ne.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "news.js",
  "nepali-dictionary-01.txt",
  "nepali-dictionary-02.txt",
  "nepali-dictionary-03.txt",
  "nepali-dictionary-04.txt",
  "nepali-dictionary-05.txt",
  "nepali-dictionary-06.txt",
  "nepali-dictionary-07.txt",
  "nepali-dictionary-08.txt"
], undefined, '4');
