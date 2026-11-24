importScripts('../pwa-worker.js');

configureNewsWorker([
  '../pwa-install.js',
  'manifest-zh.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'chinese-dictionary.txt'
], 'zhongwen-news11-v1-random-20261124');
