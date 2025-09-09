// News Modal Functions
function openNewsModal(news) {
    const modal = document.getElementById('news-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalImage = document.getElementById('modal-image');
    const modalDescription = document.getElementById('modal-description');
        
    if (!modal || !modalTitle || !modalImage || !modalDescription) {
      return;
    }
    
    // Populate modal content
    modalTitle.textContent = news.title;
    modalImage.src = news.img;
    modalImage.alt = news.title;
    modalDescription.textContent = news.description;
    
    // Show modal
    modal.hidden = false;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    
    // Focus management for accessibility
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.focus();
  }
  
  function closeNewsModal() {
    const modal = document.getElementById('news-modal');
    if (!modal) return;
    
    modal.hidden = true;
    document.body.style.overflow = ''; // Restore scrolling
  }
  
  function initNewsModal() {
    const modal = document.getElementById('news-modal');
    const closeBtn = document.getElementById('modal-close');
    
    if (!modal || !closeBtn) {
      return;
    }
    
    // Close button click
    closeBtn.addEventListener('click', closeNewsModal);
    
    // Click outside modal to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeNewsModal();
      }
    });
    
    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) {
        closeNewsModal();
      }
    });
    
  }  