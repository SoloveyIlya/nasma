async function include(selector, url) {
  const container = document.querySelector(selector);
  if (!container) return null;
  const res = await fetch(url);
  const html = await res.text();
  container.innerHTML = html;
  return container;
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

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  const note = document.getElementById('login-note');
  const submitBtn = document.getElementById('login-submit');
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
      if (note) {
        note.hidden = false;
        note.textContent = 'Login failed. Please check your credentials.';
        setTimeout(() => { 
          console.log('Login data:', Object.fromEntries(new FormData(form).entries()));
        }, 2000);
      }
    } catch (err) {
      if (note) {
        note.hidden = false;
        note.textContent = 'Login failed. Please check your credentials.';
        setTimeout(() => { note.hidden = true; }, 3000);
      }
    } finally {
      submitBtn?.classList.remove('loading');
      submitBtn?.removeAttribute('disabled');
    }
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
      // Обрезаем описание до одной строки (максимум 100 символов, без переноса)
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
    
    if (currentScrollY > 100) { // Показывать/скрывать только после 100px
      if (currentScrollY > lastScrollY) {
        // Скролл вниз - скрыть хедер
        header.style.transform = 'translateY(-100%)';
      } else {
        // Скролл вверх - показать хедер
        header.style.transform = 'translateY(0)';
      }
    } else {
      // В начале страницы всегда показывать
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
  
  // Initialize header scroll behavior
  initHeaderScroll();
  
  // Initialize login form
  initLoginForm();
  
  // Initialize register form
  initRegisterForm();
  
  // Initialize news slider
  initNewsSlider();
  
  // Initialize news modal
  if (document.getElementById('news-modal')) {
    initNewsModal();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await include('header[data-include]', './components/header.html');
  await include('footer[data-include]', './components/footer.html');
  initUI();
  initForm();
});
