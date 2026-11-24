'use strict';

const storageKey = '906200000000000F';
const dictionarySize = 71810;
const batchSize = 12;
const categories = ['Khoa học', 'Vũ trụ', 'Văn hóa', 'Thời tiết', 'Tin thế giới', 'Tin nóng'];
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

function randomText(min, range) {
  const length = min + Math.floor(Math.random() * range);
  return Array.from({ length }, () => pick(words)).join(' ') + pick(endings);
}

function generateStory() {
  const sentences = Array.from({ length: 22 }, () => randomText(5, 14));
  const paragraphs = [];
  for (let offset = 0; offset < sentences.length; offset += 5) {
    paragraphs.push(sentences.slice(offset, offset + 5).join(' '));
  }
  return {
    title: randomText(4, 7),
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
  const text = '🤣 Tin châm biếm hư cấu\n\n' + story.title + '\n\n' + story.body + '\n\n' + location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: story.title, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    alert('Đã sao chép tin.');
  } catch (error) {
    if (error.name !== 'AbortError') prompt('Sao chép nội dung tin', text);
  }
}

function normalizeSearch(text) {
  return text.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

function render() {
  const query = normalizeSearch(search.value.trim());
  grid.replaceChildren();
  for (const story of stories) {
    const text = normalizeSearch([story.title, story.body, story.category].join(' '));
    if (!text.includes(query)) continue;

    const art = element('div', story.symbol, 'art');
    art.setAttribute('aria-hidden', 'true');
    const read = element('button', 'Đọc tin');
    read.onclick = () => {
      document.querySelector('#detail-title').textContent = story.title;
      document.querySelector('#detail-body').textContent = story.body;
      detail.showModal();
    };
    const share = element('button', 'Chia sẻ');
    share.onclick = () => shareStory(story);
    const actions = element('div', '', 'actions');
    actions.append(read, share);
    const content = element('div', '', 'content');
    content.append(
      element('div', story.category + ' · Châm biếm', 'tag'),
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
    const files = await Promise.all(Array.from({ length: 5 }, async (_, index) => {
      const suffix = String(index + 1).padStart(2, '0');
      const response = await fetch('./vietnamese-dictionary-' + suffix + '.txt');
      if (!response.ok) throw new Error('Dictionary HTTP ' + response.status);
      return response.text();
    }));
    const entries = files.flatMap(file => file.trim().split(/\r?\n/));
    const unique = new Set(entries);
    if (unique.size !== dictionarySize || entries.length !== dictionarySize ||
        !entries.every(word => /^\p{Script=Latin}+(?:[ -]\p{Script=Latin}+)*$/u.test(word))) {
      throw new Error('Invalid Vietnamese dictionary');
    }
    words = entries;
    status.textContent = 'Danh sách từ: ' + words.length.toLocaleString('vi-VN') + ' từ và cụm từ';
    newButton.disabled = false;
    oneButton.disabled = false;
    if (!stories.length) generateBatch();
  } catch (error) {
    status.textContent = 'Không tải được danh sách từ. Hãy tải lại trang.';
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
loadDictionary();
