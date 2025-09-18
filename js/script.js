async function include(selector, url) {
  const container = document.querySelector(selector);
  if (!container) return null;
  const res = await fetch(url);
  const html = await res.text();
  container.innerHTML = html;
  return container;
}

async function includeHTMLFragments() {
  const nodes = Array.from(document.querySelectorAll('[data-include-html]'));
  await Promise.all(nodes.map(async (el) => {
    const url = el.getAttribute('data-include-html');
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load component: ' + url);
      const html = await res.text();
      el.innerHTML = html;
    } catch (err) {
      console.error(err);
      el.innerHTML = '<p class="muted">Failed to load content.</p>';
    }
  }));
}

async function openLegalModal(url, title) {
  const overlay = document.getElementById('legal-modal');
  const headerEl = document.getElementById('legal-modal-header');
  const contentEl = document.getElementById('legal-modal-content');
  if (!overlay || !headerEl || !contentEl) return;
  try {
    headerEl.innerHTML = '';
    contentEl.innerHTML = '<p class="muted">Loading…</p>';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load: ' + url);
    const html = await res.text();
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const legalHeader = tmp.querySelector('.legal-header');
    const legalContent = tmp.querySelector('.legal-content');
    if (legalHeader) {
      headerEl.innerHTML = legalHeader.innerHTML;
    } else {
      headerEl.innerHTML = `<h2>${title || 'Legal'}</h2>`;
    }
    contentEl.innerHTML = legalContent ? legalContent.innerHTML : html;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error(err);
    if (headerEl && !headerEl.innerHTML) headerEl.innerHTML = `<h2>${title || 'Legal'}</h2>`;
    contentEl.innerHTML = '<p class="muted">Failed to load content.</p>';
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
}

function closeLegalModal() {
  const overlay = document.getElementById('legal-modal');
  const contentEl = document.getElementById('legal-modal-content');
  if (!overlay) return;
  overlay.hidden = true;
  const cookieModal = document.getElementById('cookie-consent-modal');
  if (!cookieModal || cookieModal.hidden) {
    document.body.style.overflow = '';
  }
  if (contentEl) contentEl.innerHTML = '';
}

function initLegalModalLinks() {
  const overlay = document.getElementById('legal-modal');
  const closeBtn = document.getElementById('legal-modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeLegalModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLegalModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLegalModal();
  });

  function attachHandlers(root = document) {
    root.querySelectorAll('[data-legal-url]').forEach((a) => {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        const url = a.getAttribute('data-legal-url');
        const title = a.getAttribute('data-legal-title') || a.textContent?.trim() || 'Legal';
        if (url) await openLegalModal(url, title);
      });
    });
  }

  attachHandlers(document);
}

function initForm() {
  const form = document.getElementById('feedback-form');
  if (!form) return;
  const note = document.getElementById('form-note');
  const submitBtn = document.getElementById('feedback-submit');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    try {
      submitBtn?.classList.add('loading');
      submitBtn?.setAttribute('disabled', 'true');
      await new Promise(r => setTimeout(r, 900));
      form.reset();
      if (note) {
        note.hidden = false;
        note.textContent = 'Thank you! Your request has been sent.';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
    } catch (err) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Error sending. Please try again later.';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
    } finally {
      submitBtn?.classList.remove('loading');
      submitBtn?.removeAttribute('disabled');
    }
  });
}

function initInquiryForm() {
  const form = document.getElementById('inquiry-form');
  if (!form) return;
  const note = document.getElementById('inquiry-success-note');
  const submitBtn = document.getElementById('submit-inquiry');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    try {
      submitBtn?.classList.add('loading');
      submitBtn?.setAttribute('disabled', 'true');
      await new Promise(r => setTimeout(r, 1200));
      form.reset(); 
      if (note) {
        note.hidden = false;
        note.textContent = 'Thank you. Your inquiry has been received and will be reviewed by our committee. Please note that a response is not guaranteed and may take several weeks. Direct follow-ups will not be acknowledged.';
       
      }
    } catch (err) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Error sending inquiry. Please try again later.';
        setTimeout(() => { note.hidden = true; }, 5000);
      }
    } finally {
      submitBtn?.classList.remove('loading');
      submitBtn?.removeAttribute('disabled');
    }
  });
}

function initEnglishOnlyForForms() {
  const forms = [
    document.getElementById('feedback-form'),
    document.getElementById('inquiry-form')
  ].filter(Boolean);

  if (!forms.length) return;

  const sanitizeToAscii = (value) => value.replace(/[^\x00-\x7E]/g, '');

  const eligibleSelector = 'input[type="text"], input[type="email"], input[type="tel"], textarea';

  forms.forEach((form) => {
    form.querySelectorAll(eligibleSelector).forEach((field) => {
      field.addEventListener('input', () => {
        const sanitized = sanitizeToAscii(field.value);
        if (sanitized !== field.value) {
          const pos = field.selectionStart;
          field.value = sanitized;
          if (typeof pos === 'number') {
            try { field.setSelectionRange(pos - 1, pos - 1); } catch {}
          }
        }
      });

      field.addEventListener('paste', (e) => {
        e.preventDefault();
        const clipboard = (e.clipboardData || window.clipboardData).getData('text');
        const sanitized = sanitizeToAscii(clipboard);
        const start = field.selectionStart || 0;
        const end = field.selectionEnd || 0;
        const before = field.value.slice(0, start);
        const after = field.value.slice(end);
        field.value = before + sanitized + after;
        const caret = before.length + sanitized.length;
        try { field.setSelectionRange(caret, caret); } catch {}
      });

      field.addEventListener('blur', () => {
        field.value = sanitizeToAscii(field.value).trim();
      });
    });
  });
}

function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;
  const note = document.getElementById('register-note');
  const submitBtn = document.getElementById('register-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirm-password');
    const terms = formData.get('terms');

    // Custom validation
    if (password !== confirmPassword) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Passwords do not match.';
        note.style.color = '#e74c3c';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
      return;
    }

    if (password.length < 8) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Password must be at least 8 characters long.';
        note.style.color = '#e74c3c';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
      return;
    }

    if (!terms) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Please accept the Terms of Service and Privacy Policy.';
        note.style.color = '#e74c3c';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      submitBtn?.classList.add('loading');
      submitBtn?.setAttribute('disabled', 'true');
      await new Promise(r => setTimeout(r, 2000));
      if (note) {
        note.hidden = false;
        note.textContent = 'Account created successfully! Wait for mail.';
        note.style.color = '#27ae60';
      }
    } catch (err) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Registration failed. Please try again.';
        note.style.color = '#e74c3c';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
    } finally {
      submitBtn?.classList.remove('loading');
      submitBtn?.removeAttribute('disabled');
    }
  });
}

function initNewsSlider() {
  const newsTrack = document.getElementById('news-track');
  const newsDots = document.getElementById('news-dots');
  const prevBtn = document.getElementById('news-prev');
  const nextBtn = document.getElementById('news-next');

  if (!newsTrack || !newsDots || !prevBtn || !nextBtn) return;

  let currentSlide = 0;
  let newsData = [];
  let slidesPerView = 3;

  // Determine slides per view based on screen size
  function updateSlidesPerView() {
    if (window.innerWidth <= 480) {
      slidesPerView = 1;
    } else if (window.innerWidth <= 820) {
      slidesPerView = 2;
    } else {
      slidesPerView = 3;
    }
  }

  // Load news data from JSON
  async function loadNewsData() {
    try {
      console.log('Loading news data...');
      const response = await fetch('./data/news.json');
      if (!response.ok) throw new Error('Failed to load news data');
      newsData = await response.json();
      console.log('News data loaded:', newsData);
      renderNews();
      renderDots();
      updateSlider();
    } catch (error) {
      console.error('Error loading news data:', error);
      // Show fallback content
      newsTrack.innerHTML = '<div class="news-card"><div class="news-card-inner"><div class="news-card-content"><h3>News coming soon</h3><p>Stay tuned for the latest updates from NASMA INTERNATIONAL – FZCO.</p></div></div></div>';
    }
  }

  // Render news cards
  function renderNews() {
    console.log('Rendering news cards...');
    newsTrack.innerHTML = '';
    newsData.forEach((news, index) => {
      const newsCard = document.createElement('div');
      newsCard.className = 'news-card';
      
      let shortDesc = news.description;
      if (shortDesc.length > 50) {
        shortDesc = shortDesc.slice(0, 50).trim() + '…';
      }
      newsCard.innerHTML = `
        <div class="news-card-inner">
          <img src="${news.img}" alt="${news.title}" loading="lazy" />
          <div class="news-card-content">
            <h3>${news.title}</h3>
            <p>${shortDesc}</p>
          </div>
        </div>
      `;

      // Add click handler to open modal
      newsCard.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('News card clicked:', news);
        openNewsModal(news);
      });

      // Also add click handler to inner elements
      const innerCard = newsCard.querySelector('.news-card-inner');
      if (innerCard) {
        innerCard.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Inner card clicked:', news);
          openNewsModal(news);
        });
      }

      newsTrack.appendChild(newsCard);
      console.log('News card added:', news.title);
    });
    console.log('All news cards rendered');
  }

  // Render dots
  function renderDots() {
    newsDots.innerHTML = '';
    const totalSlides = Math.ceil(newsData.length / slidesPerView);

    for (let i = 0; i < totalSlides; i++) {
      const dot = document.createElement('div');
      dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => goToSlide(i));
      newsDots.appendChild(dot);
    }
  }

  // Update slider position
  function updateSlider() {
    const translateX = -currentSlide * (100 / slidesPerView);
    newsTrack.style.transform = `translateX(${translateX}%)`;

    // Update dots
    const dots = newsDots.querySelectorAll('.slider-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentSlide);
    });

    // Update button states
    const totalSlides = Math.ceil(newsData.length / slidesPerView);
    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide >= totalSlides - 1;
  }

  // Go to specific slide
  function goToSlide(slideIndex) {
    const totalSlides = Math.ceil(newsData.length / slidesPerView);
    currentSlide = Math.max(0, Math.min(slideIndex, totalSlides - 1));
    updateSlider();
  }

  // Next slide
  function nextSlide() {
    const totalSlides = Math.ceil(newsData.length / slidesPerView);
    if (currentSlide < totalSlides - 1) {
      currentSlide++;
      updateSlider();
    }
  }

  // Previous slide
  function prevSlide() {
    if (currentSlide > 0) {
      currentSlide--;
      updateSlider();
    }
  }

  // Event listeners
  nextBtn.addEventListener('click', nextSlide);
  prevBtn.addEventListener('click', prevSlide);

  // Handle window resize
  window.addEventListener('resize', () => {
    updateSlidesPerView();
    renderDots();
    currentSlide = 0;
    updateSlider();
  });

  // Auto-play (optional)
  let autoPlayInterval;
  function startAutoPlay() {
    autoPlayInterval = setInterval(() => {
      const totalSlides = Math.ceil(newsData.length / slidesPerView);
      if (currentSlide < totalSlides - 1) {
        nextSlide();
      } else {
        goToSlide(0);
      }
    }, 5000);
  }

  function stopAutoPlay() {
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
    }
  }

  // Pause auto-play on hover
  const newsSlider = document.querySelector('.news-slider');
  if (newsSlider) {
    newsSlider.addEventListener('mouseenter', stopAutoPlay);
    newsSlider.addEventListener('mouseleave', startAutoPlay);
  }

  // Initialize
  updateSlidesPerView();
  loadNewsData();
  startAutoPlay();
}

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeader() {
    const currentScrollY = window.scrollY;

    if (currentScrollY > 100) { 
      if (currentScrollY > lastScrollY) {
        
        header.style.transform = 'translateY(-100%)';
      } else {
        
        header.style.transform = 'translateY(0)';
      }
    } else {
      
      header.style.transform = 'translateY(0)';
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
}

function initUI() {
  const burger = document.querySelector('.burger');
  const drawer = document.getElementById('mobile-menu');

  if (burger && drawer) {
    const toggleMenu = () => {
      const isOpen = burger.classList.toggle('active');
      burger.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        drawer.hidden = false;
        requestAnimationFrame(() => drawer.classList.add('open'));
      } else {
        drawer.classList.remove('open');
        drawer.addEventListener('transitionend', () => {
          if (!drawer.classList.contains('open')) drawer.hidden = true;
        }, { once: true });
      }
    };
    burger.addEventListener('click', toggleMenu);
    drawer.addEventListener('click', (e) => {
      const target = e.target;
      if (target.tagName === 'A') toggleMenu();
    });
  }

  // Smooth scroll for anchors
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#' || href.length <= 1) return;
      const el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Reveal on scroll
  const revealItems = Array.from(document.querySelectorAll('.reveal-up'));
  const onIntersect = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  };
  const observer = new IntersectionObserver(onIntersect, { root: null, rootMargin: '0px', threshold: 0.16 });
  revealItems.forEach(item => observer.observe(item));

  // Year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Keep header static (no hide-on-scroll)

  // Initialize login form
  initInquiryForm();

  // Initialize register form
  initRegisterForm();

  // Enforce English-only input for key forms
  initEnglishOnlyForForms();

  // Initialize news slider
  initNewsSlider();

  // Initialize news modal
  // if (document.getElementById('news-modal')) {
  //   initNewsModal();
  // }

  // Initialize legal modal links
  initLegalModalLinks();
}

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function initCookieConsent() {
  const consentModal = document.getElementById('cookie-consent-modal');
  const acceptBtn = document.getElementById('accept-cookies');
  const declineBtn = document.getElementById('decline-cookies');
  const cookieName = 'cookie_consent';

  if (!consentModal || !acceptBtn || !declineBtn) return;

  const hasConsent = getCookie(cookieName);

  if (!hasConsent) {
    consentModal.hidden = false;
    document.body.style.overflow = 'hidden'; // Disable scroll

    acceptBtn.addEventListener('click', () => {
      setCookie(cookieName, 'accepted', 365);
      consentModal.hidden = true;
      document.body.style.overflow = ''; // Enable scroll
    });

    declineBtn.addEventListener('click', () => {
      window.location.href = './access-denied.html'; // Redirect to access denied page
    });
  } else if (hasConsent === 'declined') {
    // If user previously declined, redirect them immediately
    window.location.href = './access-denied.html';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await include('header[data-include]', './components/header.html');
  await include('footer[data-include]', './components/footer.html');
  await includeHTMLFragments();
  // Compute header height and set CSS var for global top padding
  const setHeaderHeightVar = () => {
    const header = document.querySelector('.site-header');
    const h = header ? header.getBoundingClientRect().height : 64;
    document.documentElement.style.setProperty('--header-height', `${Math.round(h)}px`);
  };
  setHeaderHeightVar();
  window.addEventListener('resize', setHeaderHeightVar);
  // Recalculate when images in header load (e.g., logo)
  const logoImg = document.querySelector('.site-header img');
  if (logoImg && !logoImg.complete) {
    logoImg.addEventListener('load', setHeaderHeightVar, { once: true });
  }
  initUI();
  initForm();
  initCookieConsent(); // Initialize cookie consent
});

