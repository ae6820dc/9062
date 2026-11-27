'use strict';

const storageKey = '9062000000000012';
const dictionarySize = 292698;
const batchSize = 12;
const categories = ['Ciência', 'Espaço', 'Cultura', 'Tempo', 'Mundo', 'Urgente'];
const symbols = ['☀️', '🌙', '🪐', '🚀', '🐔', '🌍', '👽', '🚌', '🥔', '🐧', '⏰', '☁️'];
const endings = ['.', '!', '?'];
const grid = document.querySelector('#grid');
const detail = document.querySelector('#detail');
const search = document.querySelector('#search');
const status = document.querySelector('#status');
const newButton = document.querySelector('#new');
const oneButton = document.querySelector('#one');
const pick = items => items[Math.floor(Math.random() * items.length)];

let words = [];
let stories = [];
const readingState = setupNewsReadingState({
  key: storageKey, dialog: detail, search, getStories: () => stories, openStory
});

function restoreStories() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.length && saved.length <= 24 &&
        saved.every(story => story && typeof story.title === 'string' &&
          typeof story.body === 'string' && categories.includes(story.category) && symbols.includes(story.symbol))) {
      return saved;
    }
  } catch {}
  return [];
}

function saveStories() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(stories));
  } catch {}
}

function randomText(length, addPunctuation = false) {
  const selected = Array.from({ length }, () => pick(words));
  if (addPunctuation && length >= 7) {
    const position = 1 + Math.floor(Math.random() * (length - 3));
    if (Math.random() < 0.5) selected[position] += ',';
    if (Math.random() < 0.16) selected[position + 1] = '“' + selected[position + 1] + '”';
  }
  const text = selected.join(' ');
  return text[0].toLocaleUpperCase('pt-BR') + text.slice(1) + pick(endings);
}

function generateStory() {
  const paragraphs = Array.from({ length: 5 }, () => {
    const firstLength = 5 + Math.floor(Math.random() * 11);
    return randomText(firstLength, true) + ' ' + randomText(20 - firstLength, true);
  });
  return {
    title: randomText(4 + Math.floor(Math.random() * 7)),
    body: paragraphs.join('\n\n'),
    category: pick(categories),
    symbol: pick(symbols)
  };
}

function generateBatch() {
  stories = Array.from({ length: batchSize }, generateStory);
  saveStories();
  render();
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function shareStory(story) {
  const text = '🤣 Sátira fictícia\n\n' + story.title + '\n\n' + story.body + '\n\n' + location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: story.title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    alert('Notícia copiada.');
  } catch (error) {
    if (error.name !== 'AbortError') prompt('Copie o texto', text);
  }
}

function normalizeSearch(text) {
  return text.normalize('NFC').toLocaleLowerCase('pt-BR');
}

function openStory(index) {
  const story = stories[index];
  document.querySelector('#detail-title').textContent = story.title;
  document.querySelector('#detail-body').textContent = story.body;
  detail.showModal();
  readingState.opened(index);
}

function render() {
  const query = normalizeSearch(search.value.trim());
  grid.replaceChildren();
  for (const [index, story] of stories.entries()) {
    const text = normalizeSearch([story.title, story.body, story.category].join(' '));
    if (!text.includes(query)) continue;

    const art = element('div', story.symbol, 'art');
    art.setAttribute('aria-hidden', 'true');
    const read = element('button', 'Ler');
    read.onclick = () => openStory(index);
    const share = element('button', 'Compartilhar');
    share.onclick = () => shareStory(story);
    const actions = element('div', '', 'actions');
    actions.append(read, share);
    const content = element('div', '', 'content');
    content.append(
      element('div', story.category + ' · Sátira', 'tag'),
      element('h2', story.title),
      element('p', story.body),
      actions
    );
    const article = document.createElement('article');
    article.append(art, content);
    grid.append(article);
  }
}

async function loadDictionary() {
  try {
    const files = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const suffix = String(index + 1).padStart(2, '0');
      const response = await fetch('./portuguese-br-dictionary-' + suffix + '.txt');
      if (!response.ok) throw new Error('Dictionary HTTP ' + response.status);
      return response.text();
    }));
    const entries = files.flatMap(file => file.trim().split(/\r?\n/));
    const unique = new Set(entries);
    if (unique.size !== dictionarySize || entries.length !== dictionarySize ||
        !entries.every(word => /^[a-záàâãéêíóôõúüç]+(?:-[a-záàâãéêíóôõúüç]+)*$/u.test(word))) {
      throw new Error('Dicionário de português brasileiro inválido');
    }
    words = entries;
    status.hidden = true;
    newButton.disabled = false;
    oneButton.disabled = false;
    if (!stories.length) generateBatch();
  } catch (error) {
    status.textContent = 'Não foi possível carregar o dicionário. Atualize a página.';
    console.error(error);
  }
}

newButton.onclick = generateBatch;
oneButton.onclick = () => {
  stories = [generateStory(), ...stories].slice(0, 24);
  saveStories();
  render();
};
search.oninput = render;
stories = restoreStories();
render();
readingState.restore();
loadDictionary();
