'use strict';

function setupNewsReadingState({ key, dialog, search, getStories, openStory }) {
  const storageKey = key + ':reading-state';
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey));
  } catch {}

  let articleIndex = -1;
  let timer;
  let ready = false;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (typeof saved?.query === 'string') search.value = saved.query;

  function save() {
    clearTimeout(timer);
    if (!ready) return;

    const story = dialog.open ? getStories()[articleIndex] : undefined;
    const article = story ? { title: story.title, index: articleIndex, top: dialog.scrollTop } : null;
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        query: search.value,
        top: window.scrollY,
        article
      }));
    } catch {}
  }

  function scheduleSave() {
    clearTimeout(timer);
    timer = setTimeout(save, 150);
  }

  dialog.addEventListener('scroll', scheduleSave, { passive: true });
  dialog.addEventListener('close', save);
  search.addEventListener('input', scheduleSave);
  window.addEventListener('scroll', scheduleSave, { passive: true });
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });

  return {
    opened(index) {
      articleIndex = index;
      dialog.scrollTop = 0;
      save();
    },

    restore() {
      if (ready) return;

      const article = saved?.article;
      if (article && typeof article.title === 'string') {
        const stories = getStories();
        const index = stories[article.index]?.title === article.title
          ? article.index
          : stories.findIndex(story => story.title === article.title);
        if (index >= 0) {
          openStory(index);
          if (Number.isFinite(article.top)) dialog.scrollTop = article.top;
        }
      }

      if (Number.isFinite(saved?.top)) window.scrollTo(0, saved.top);
      ready = true;
    }
  };
}
