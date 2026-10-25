import '@assets/favicon/site.webmanifest';
import '@assets/favicon/favicon-16x16.png';
import '@assets/favicon/favicon-32x32.png';
import '@assets/favicon/android-chrome-192x192.png';
import '@assets/favicon/android-chrome-512x512.png';
import '@assets/favicon/apple-touch-icon.png';
import '@assets/favicon/favicon.ico';

import '@css/nerd-fonts-generated.min.css';
import '@css/fontFallback.css';
import '@css/mainStyles.css';
import '@css/index/styles.css';

import '@js/m3ui.js';
import '@js/dialogs.js';
import '@js/dark.js';
import { flatPages } from '@data/pages.js';

const content = document.getElementById('content');
const mainContent = document.getElementById('main-content');
const toolbox = document.getElementById('toolbox');
const tabs = document.querySelector('md-tabs');
const toolButtons = document.querySelectorAll('.tool-button');
const toggleNavButton = document.getElementById('toggle-nav-button');
const titleH1 = document.getElementById('title-h1');

let contentAnimation = null;

function animateContent() {
  contentAnimation?.cancel();
  contentAnimation = null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Animate opacity only: a persistent transform on an iframe ancestor can
  // change its compositing context. WAAPI leaves no inline style behind.
  const animation = content.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 300, delay: 50, fill: 'backwards', easing: 'ease' }
  );
  contentAnimation = animation;
  animation.onfinish = () => {
    if (contentAnimation === animation) contentAnimation = null;
  };
}

function updateURLParams(newParams) {
  const url = new URL(window.location.href);

  Object.entries(newParams).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  window.history.pushState({}, '', url.toString());
}

function loadContent(url) {
  const regex = /\/pages\/([^/]+)\.html/;

  if (regex.test(url)) {
    const targetPage = url.match(regex)[1];
    mainContent.src = url;
    updateURLParams({ page: targetPage });
  } else if (url.includes('index.html')) {
    mainContent.src = url + window.location.search;
  }
}

const targetPage = new URLSearchParams(window.location.search).get('page');
if (Object.hasOwnProperty.call(flatPages, targetPage)) {
  loadContent(`./pages/${targetPage}.html`);
}

tabs.addEventListener('change', () => {
  const index = tabs.activeTabIndex;
  animateContent();
  setTimeout(() => {
    if (index === 0) {
      mainContent.style.display = 'block';
      toolbox.style.display = 'none';
    } else if (index === 1) {
      mainContent.style.display = 'none';
      toolbox.style.display = 'grid';
    }
  }, 50);
});

toolButtons.forEach(button => {
  if (button.classList.contains('online-tool')) {
    button.addEventListener('click', () => {
      window.open(button.dataset.url, '_blank');
    });
    return;
  }

  button.addEventListener('click', () => {
    animateContent();
    loadContent(button.dataset.url);

    setTimeout(() => {
      tabs.activeTabIndex = 0;
      mainContent.style.display = 'block';
      toolbox.style.display = 'none';
    }, 50);
  });
});

window.addEventListener('message', event => {
  switch (event.data.type) {
    case 'changeHeader':
      titleH1.innerHTML = event.data.text;
      break;
    case 'changeUrl':
      window.open(event.data.url, '_blank');
  }
});

toggleNavButton.addEventListener('click', () => {
  tabs.classList.toggle('tabs-hidden');
});
