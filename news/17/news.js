'use strict';

const storageKey = '9062000000000011';
const dictionarySize = 295903;
const batchSize = 12;
const categories = ['Nauka', 'Kosmos', 'Kultura', 'Pogoda', 'Świat', 'Pilne'];
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
    if (Math.random() < 0.16) selected[position + 1] = '„' + selected[position + 1] + '”';
  }
  const text = selected.join(' ');
  return text[0].toLocaleUpperCase('pl-PL') + text.slice(1) + pick(endings);
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
  const text = '🤣 Fikcyjna satyra\n\n' + story.title + '\n\n' + story.body + '\n\n' + location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: story.title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    alert('Artykuł został skopiowany.');
  } catch (error) {
    if (error.name !== 'AbortError') prompt('Skopiuj tekst', text);
  }
}

function normalizeSearch(text) {
  return text.normalize('NFC').toLocaleLowerCase('pl-PL');
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
    const read = element('button', 'Czytaj');
    read.onclick = () => openStory(index);
    const share = element('button', 'Udostępnij');
    share.onclick = () => shareStory(story);
    const actions = element('div', '', 'actions');
    actions.append(read, share);
    const content = element('div', '', 'content');
    content.append(
      element('div', story.category + ' · Satyra', 'tag'),
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
      const response = await fetch('./polish-dictionary-' + suffix + '.txt');
      if (!response.ok) throw new Error('Dictionary HTTP ' + response.status);
      return response.text();
    }));
    const entries = files.flatMap(file => file.trim().split(/\r?\n/));
    const unique = new Set(entries);
    if (unique.size !== dictionarySize || entries.length !== dictionarySize ||
        !entries.every(word => /^[a-ząćęłńóśźż]+(?:-[a-ząćęłńóśźż]+)*$/u.test(word))) {
      throw new Error('Invalid Polish dictionary');
    }
    words = entries;
    status.textContent = 'Liczba form wyrazowych w słowniku: ' + words.length.toLocaleString('pl-PL') + '.';
    newButton.disabled = false;
    oneButton.disabled = false;
    if (!stories.length) generateBatch();
  } catch (error) {
    status.textContent = 'Nie udało się wczytać słownika. Odśwież stronę.';
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
