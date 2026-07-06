(() => {
  const button = document.getElementById('back-to-top');
  const sidebarTrigger = document.getElementById('sidebar-trigger');
  const searchTrigger = document.getElementById('search-trigger');
  const searchCancel = document.getElementById('search-cancel');
  const searchBox = document.getElementById('search');
  const searchInput = document.getElementById('search-input');
  const searchResultWrapper = document.getElementById('search-result-wrapper');
  const searchResults = document.getElementById('search-results');
  const searchHints = document.getElementById('search-hints');
  const topbarTitle = document.getElementById('topbar-title');
  const mask = document.getElementById('mask');
  const content = document.querySelector('main article .content');
  const contentRows = document.querySelectorAll('#main-wrapper > .container > .row');
  const tocLinks = [...document.querySelectorAll('#toc a')];
  const modeToggle = document.getElementById('mode-toggle');
  const tocBar = document.getElementById('toc-bar');
  const tocSoloTrigger = document.getElementById('toc-solo-trigger');
  const tocPopup = document.getElementById('toc-popup');
  const tocTriggers = [...document.querySelectorAll('.toc-trigger')];

  const installHeadingAnchors = () => {
    if (!content) {
      return;
    }

    content.querySelectorAll('h2[id], h3[id], h4[id], h5[id]').forEach((heading) => {
      if (heading.querySelector(':scope > .anchor')) {
        return;
      }

      const label = document.createElement('span');
      label.className = 'me-2';

      while (heading.firstChild) {
        label.appendChild(heading.firstChild);
      }

      const anchor = document.createElement('a');
      anchor.href = `#${encodeURIComponent(heading.id)}`;
      anchor.className = 'anchor text-muted';
      anchor.setAttribute('aria-label', 'Anchor link');

      const icon = document.createElement('i');
      icon.className = 'fas fa-hashtag';
      anchor.appendChild(icon);

      heading.append(label, anchor);
    });
  };

  const closeSidebar = () => {
    document.body.removeAttribute('sidebar-display');
    mask?.classList.add('d-none');
  };

  const openSidebar = () => {
    document.body.setAttribute('sidebar-display', '');
    mask?.classList.remove('d-none');
  };

  const MOBILE_SIDEBAR_BREAKPOINT = 850;
  const isMobileSidebarLayout = () => window.innerWidth < MOBILE_SIDEBAR_BREAKPOINT;

  const installSidebarSwipeGestures = () => {
    const SWIPE_THRESHOLD = 60;
    const EDGE_ZONE = 24;
    let startX = null;
    let startY = null;
    let tracking = false;

    document.addEventListener(
      'touchstart',
      (event) => {
        if (!isMobileSidebarLayout()) {
          tracking = false;
          return;
        }

        const touch = event.touches[0];
        const expanded = document.body.hasAttribute('sidebar-display');

        // Only start tracking an "open" swipe from near the left edge, so
        // swiping inside horizontally-scrollable content (tables, code
        // blocks) elsewhere on the page isn't hijacked.
        if (!expanded && touch.clientX > EDGE_ZONE) {
          tracking = false;
          return;
        }

        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      },
      { passive: true }
    );

    document.addEventListener(
      'touchend',
      (event) => {
        if (!tracking || startX === null) {
          return;
        }

        tracking = false;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        startX = null;
        startY = null;

        if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) {
          return;
        }

        const expanded = document.body.hasAttribute('sidebar-display');

        if (!expanded && deltaX > 0) {
          openSidebar();
        } else if (expanded && deltaX < 0) {
          closeSidebar();
        }
      },
      { passive: true }
    );
  };

  const wrapTables = () => {
    if (!content) {
      return;
    }

    content.querySelectorAll('table').forEach((table) => {
      if (table.parentElement?.classList.contains('table-wrapper')) {
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  };

  const installTocActiveState = () => {
    if (tocLinks.length === 0) {
      return;
    }

    const items = tocLinks
      .map((link) => {
        const id = decodeURIComponent((link.getAttribute('href') || '').replace(/^#/, ''));
        return { link, heading: document.getElementById(id) };
      })
      .filter(({ heading }) => heading);

    if (items.length === 0) {
      tocLinks[0].classList.add('active');
      return;
    }

    const setActive = (activeLink) => {
      tocLinks.forEach((link) => link.classList.toggle('active', link === activeLink));
    };

    const updateActive = () => {
      const active = items.reduce((current, item) => {
        return item.heading.getBoundingClientRect().top <= 120 ? item : current;
      }, items[0]);

      setActive(active.link);
    };

    tocLinks.forEach((link) => {
      link.addEventListener('click', () => setActive(link));
    });

    updateActive();
    window.addEventListener('scroll', updateActive, { passive: true });
  };

  const installThemeToggle = () => {
    if (!modeToggle) {
      return;
    }

    const modes = ['system', 'light', 'dark'];
    const root = document.documentElement;

    const getMode = () => {
      try {
        const stored = localStorage.getItem('theme');
        return modes.includes(stored) ? stored : 'system';
      } catch {
        return 'system';
      }
    };

    const applyMode = (mode) => {
      if (mode === 'light' || mode === 'dark') {
        root.setAttribute('data-bs-theme', mode);
        root.setAttribute('data-theme-persisted', '');
      } else {
        root.removeAttribute('data-bs-theme');
        root.removeAttribute('data-theme-persisted');
      }

      modeToggle.dataset.mode = mode;
      modeToggle.setAttribute('aria-label', `Switch theme. Current: ${mode}`);
      modeToggle.querySelectorAll('[data-theme-mode]').forEach((icon) => {
        icon.classList.toggle('d-none', icon.dataset.themeMode !== mode);
      });

      const giscusFrame = document.querySelector('iframe.giscus-frame');
      if (giscusFrame) {
        const resolved =
          mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
        giscusFrame.contentWindow?.postMessage(
          { giscus: { setConfig: { theme: resolved } } },
          'https://giscus.app'
        );
      }
    };

    const saveMode = (mode) => {
      try {
        if (mode === 'system') {
          localStorage.removeItem('theme');
        } else {
          localStorage.setItem('theme', mode);
        }
      } catch {}
    };

    applyMode(getMode());

    modeToggle.addEventListener('click', () => {
      const current = getMode();
      const next = modes[(modes.indexOf(current) + 1) % modes.length];
      saveMode(next);
      applyMode(next);
    });
  };

  const installMobileToc = () => {
    if (!tocPopup) {
      return;
    }

    const closeToc = () => {
      tocPopup.close();
    };

    tocTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        if (typeof tocPopup.showModal === 'function') {
          tocPopup.showModal();
        } else {
          tocPopup.setAttribute('open', '');
        }
      });
    });

    tocPopup.querySelector('[data-toc-close]')?.addEventListener('click', closeToc);
    tocPopup.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeToc));
    tocPopup.addEventListener('click', (event) => {
      if (event.target === tocPopup) {
        closeToc();
      }
    });

    if (!tocBar || !tocSoloTrigger) {
      return;
    }

    const setBarVisible = (visible) => {
      tocBar.classList.toggle('invisible', !visible);
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        ([entry]) => setBarVisible(!entry.isIntersecting),
        { rootMargin: '-64px 0px 0px 0px' }
      );
      observer.observe(tocSoloTrigger);
    } else {
      const update = () => setBarVisible(tocSoloTrigger.getBoundingClientRect().bottom < 0);
      update();
      window.addEventListener('scroll', update, { passive: true });
    }
  };

  const searchItems = (() => {
    const data = document.getElementById('search-data');

    if (!data?.textContent) {
      return [];
    }

    try {
      return JSON.parse(data.textContent);
    } catch {
      return [];
    }
  })();

  const normalize = (value) => (value || '').toString().toLocaleLowerCase();

  const openSearch = () => {
    searchResultWrapper?.classList.remove('d-none');
    contentRows.forEach((row) => row.classList.add('d-none'));
  };

  const closeSearch = () => {
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchHints?.classList.remove('d-none');
    searchResultWrapper?.classList.add('d-none');
    contentRows.forEach((row) => row.classList.remove('d-none'));
    searchBox?.classList.remove('d-flex', 'input-focus');
    searchCancel?.classList.remove('d-block');
    sidebarTrigger?.classList.remove('d-none');
    topbarTitle?.classList.remove('d-none');
    searchTrigger?.classList.remove('d-none');
  };

  const renderSearchResults = () => {
    if (!searchInput || !searchResults) {
      return;
    }

    const query = normalize(searchInput.value.trim());

    if (!query) {
      searchResults.innerHTML = '';
      searchHints?.classList.remove('d-none');
      return;
    }

    openSearch();
    searchHints?.classList.add('d-none');

    const matches = searchItems
      .map((item) => {
        const haystack = normalize(
          [item.title, item.summary, item.content, ...(item.categories || []), ...(item.tags || [])].join(' ')
        );
        const score = normalize(item.title).includes(query) ? 2 : haystack.includes(query) ? 1 : 0;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    if (matches.length === 0) {
      searchResults.innerHTML = '<p class="mt-5">검색 결과가 없습니다.</p>';
      return;
    }

    searchResults.innerHTML = matches
      .map(({ item }) => {
        const summary = (item.summary || item.content || '').replace(/\s+/g, ' ').trim();
        const categories = (item.categories || []).join(', ');
        const tags = (item.tags || []).slice(0, 3).join(', ');

        return `
          <article>
            <h2><a href="${item.url}">${item.title}</a></h2>
            <p>${summary}</p>
            <div class="post-meta">
              <i class="far fa-calendar fa-fw"></i>${item.date}
              ${categories ? `<i class="far fa-folder-open fa-fw ms-2"></i>${categories}` : ''}
              ${tags ? `<i class="fas fa-tags fa-fw ms-2"></i>${tags}` : ''}
            </div>
          </article>
        `;
      })
      .join('');
  };

  const openMobileSearch = () => {
    sidebarTrigger?.classList.add('d-none');
    topbarTitle?.classList.add('d-none');
    searchTrigger?.classList.add('d-none');
    searchBox?.classList.add('d-flex');
    searchCancel?.classList.add('d-block');
    openSearch();
    searchInput?.focus();
  };

  installHeadingAnchors();
  wrapTables();
  installTocActiveState();
  installThemeToggle();
  installMobileToc();
  installSidebarSwipeGestures();

  sidebarTrigger?.addEventListener('click', () => {
    const expanded = document.body.hasAttribute('sidebar-display');

    if (expanded) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  mask?.addEventListener('click', closeSidebar);

  searchTrigger?.addEventListener('click', openMobileSearch);
  searchCancel?.addEventListener('click', closeSearch);
  searchInput?.addEventListener('focus', () => searchBox?.classList.add('input-focus'));
  searchInput?.addEventListener('focusout', () => searchBox?.classList.remove('input-focus'));
  searchInput?.addEventListener('input', renderSearchResults);

  document.querySelectorAll('.copy-link').forEach((copyButton) => {
    copyButton.addEventListener('click', async () => {
      const url = copyButton.getAttribute('data-copy-url') || window.location.href;

      try {
        await navigator.clipboard.writeText(url);
        copyButton.classList.add('text-success');
        window.setTimeout(() => copyButton.classList.remove('text-success'), 1200);
      } catch {
        window.prompt('Copy link', url);
      }
    });
  });

  if (button) {
    const toggleBackToTop = () => {
      button.classList.toggle('show', window.scrollY > 320);
    };

    toggleBackToTop();
    window.addEventListener('scroll', toggleBackToTop, { passive: true });
    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
