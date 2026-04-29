import './style.css'

// Initial State
let state = {
  currentView: 'dashboard', 
  lastBite: new Date(localStorage.getItem('lastBite') || (Date.now() - 3 * 24 * 60 * 60 * 1000)),
  photos: JSON.parse(localStorage.getItem('photos') || '[]'),
  streakDays: 0,
  streakHours: 0,
  activePhotoIndex: null
};

const PAL_CONFIG = [
  { minDays: 0, icon: '🌱', status: 'Frisch gekeimt', quote: 'Jeder große Baum war einmal ein kleiner Samen. Fang heute an!' },
  { minDays: 1, icon: '🌿', status: 'Kleiner Sprössling', quote: 'Du machst das toll! Der erste Schritt ist der wichtigste.' },
  { minDays: 3, icon: '🪴', status: 'Wachsende Pflanze', quote: 'Schau mal, wie ich wachse! Genau wie deine Willenskraft.' },
  { minDays: 7, icon: '🌳', status: 'Starker Baum', quote: 'Eine Woche! Du bist eine Inspiration für mich.' },
  { minDays: 14, icon: '🌸', status: 'Blühende Pracht', quote: 'Wunderschön! Deine Nägel (und ich) erstrahlen in neuem Glanz.' }
];

function calculateStreak() {
  const now = new Date();
  const diff = now - new Date(state.lastBite);
  state.streakDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  state.streakHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
}

function getPalState() {
  calculateStreak();
  return PAL_CONFIG.slice().reverse().find(stage => state.streakDays >= stage.minDays);
}

function renderApp() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <header class="header">
      <div class="logo">
        <div class="logo-icon">🌿</div>
        Nobite
      </div>
    </header>

    <main id="mainContent"></main>

    <nav class="nav-bar">
      <div class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
        <span class="nav-icon">📊</span>
        <span>Dashboard</span>
      </div>
      <div class="nav-item ${state.currentView === 'gallery' ? 'active' : ''}" data-view="gallery">
        <span class="nav-icon">📸</span>
        <span>Galerie</span>
      </div>
      <div class="nav-item ${state.currentView === 'nailpal' ? 'active' : ''}" data-view="nailpal">
        <span class="nav-icon">🪴</span>
        <span>Nail Pal</span>
      </div>
    </nav>

    <!-- Urge Modal -->
    <div class="modal-overlay" id="urgeModal">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Soforthilfe</h3>
          <button class="close-btn" id="closeModalBtn">&times;</button>
        </div>
        <div class="method-list" id="randomMethodContainer">
          <!-- Random method will be injected here -->
        </div>
        <button class="urge-btn" id="newRandomBtn" style="margin-top: 24px; width: 100%; justify-content: center; font-size: 16px; padding: 12px;">
          Andere Methode versuchen
        </button>
      </div>
    </div>

    <!-- Lightbox Overlay -->
    <div class="lightbox-overlay" id="lightboxModal">
      <button class="lightbox-close" id="lightboxCloseBtn">&times;</button>
      <button class="lightbox-nav prev" id="lightboxPrevBtn">&#10094;</button>
      <button class="lightbox-nav next" id="lightboxNextBtn">&#10095;</button>
      <div class="lightbox-content" id="lightboxContent">
        <!-- Image and info injected here -->
      </div>
    </div>
  `;

  renderContent();
  attachNavListeners();
  
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('urgeModal').classList.remove('active');
  });

  document.getElementById('newRandomBtn').addEventListener('click', () => {
    showRandomUrgeMethod();
  });

  document.getElementById('lightboxCloseBtn').addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrevBtn').addEventListener('click', prevPhoto);
  document.getElementById('lightboxNextBtn').addEventListener('click', nextPhoto);

  initSwipeGestures();
}

function initSwipeGestures() {
  const lightboxModal = document.getElementById('lightboxModal');
  let touchStartX = 0;
  let touchEndX = 0;

  lightboxModal.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  lightboxModal.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const swipeThreshold = 50; // Minimum distance to trigger swipe
    if (touchEndX < touchStartX - swipeThreshold) {
      nextPhoto(); // Swipe left
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      prevPhoto(); // Swipe right
    }
  }
}

function renderContent() {
  const container = document.querySelector('#mainContent');
  
  if (state.currentView === 'dashboard') {
    calculateStreak();
    container.innerHTML = `
      <div class="dashboard">
        <div class="tracker-ring">
          <svg class="tracker-svg" width="260" height="260">
            <circle class="tracker-bg" cx="130" cy="130" r="120" />
            <circle class="tracker-progress" cx="130" cy="130" r="120" />
          </svg>
          <div class="tracker-content">
            <div class="streak-value">${state.streakDays} Tage, ${state.streakHours} Std.</div>
            <div class="streak-label">Seit dem letzten Kauen</div>
          </div>
        </div>

        <button class="urge-btn" id="urgeBtn">
          <span class="icon">✨</span>
          Ich habe Drang...
        </button>
      </div>
    `;
    document.querySelector('#urgeBtn').addEventListener('click', () => {
      showRandomUrgeMethod();
      document.getElementById('urgeModal').classList.add('active');
    });
  } else if (state.currentView === 'gallery') {
    container.innerHTML = `
      <div class="gallery">
        <div class="gallery-header">
          <h2 class="gallery-title">Foto-Tagebuch</h2>
          <label class="add-photo-label" for="photoInput">+</label>
          <input type="file" id="photoInput" accept="image/*" capture="camera">
        </div>
        
        <div class="photo-grid" id="photoGrid">
          ${state.photos.length === 0 ? '<div class="empty-state">Noch keine Fotos. Fang heute an!</div>' : ''}
          ${state.photos.map((photo, index) => `
            <div class="photo-card" onclick="openLightbox(${index})">
              <img src="${photo.url}" class="photo-img">
              <div class="photo-info">
                <div class="photo-date">${new Date(photo.date).toLocaleDateString('de-DE')}</div>
                <div class="photo-tag">Tag ${photo.day}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.querySelector('#photoInput').addEventListener('change', handlePhotoUpload);
  } else if (state.currentView === 'nailpal') {
    const pal = getPalState();
    container.innerHTML = `
      <div class="nail-pal-container">
        <div class="pal-character pulse">${pal.icon}</div>
        <div class="message-bubble">
          <div class="pal-status">${pal.status}</div>
          <div class="pal-quote">"${pal.quote}"</div>
        </div>
        <div class="pal-info" style="color: var(--color-text-dim); font-size: 14px;">
          Dein Begleiter wächst mit jedem Tag, an dem du nicht kaust.
        </div>
      </div>
    `;
  }
}

function attachNavListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      state.currentView = item.dataset.view;
      renderApp();
    });
  });
}

const URGE_METHODS = [
  { icon: '🧘', title: 'Atemübung (4-4-6)', desc: 'Atme tief ein (4s), halte (4s), atme aus (6s). Beruhigt sofort.', action: 'Atemübung starten' },
  { icon: '💧', title: 'Wasser trinken', desc: 'Steh auf und hol dir ein frisches Glas Wasser. Physische Ablenkung.', action: 'Wasser getrunken' },
  { icon: '✨', title: 'Positiver Gedanke', desc: 'Du bist stark! Jeder Moment ohne Kauen ist ein Gewinn. Schau auf deinen Fortschritt!', action: 'Verstanden' },
  { icon: '🎮', title: 'Mini-Ablenkung', desc: 'Tippe 10 Mal schnell auf den Bildschirm! Beschäftige deine Hände.', action: 'Erledigt' }
];

const MOTIVATIONAL_QUOTES = [
  { icon: '🌟', quote: 'Großartig!', subtext: 'Jeder Moment ohne Kauen macht dich stärker.' },
  { icon: '💪', quote: 'Du schaffst das!', subtext: 'Deine Willenskraft wächst mit jedem Tag.' },
  { icon: '✨', quote: 'Schritt für Schritt.', subtext: 'Geduld zahlt sich aus. Bleib dran!' },
  { icon: '🏆', quote: 'Stolz auf dich!', subtext: 'Du hast den Drang erfolgreich besiegt.' }
];

let currentMethodIndex = -1;

window.showMotivationScreen = function() {
  const container = document.getElementById('randomMethodContainer');
  document.getElementById('newRandomBtn').style.display = 'none'; // Hide the random button
  
  const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  
  container.innerHTML = `
    <div class="motivation-screen">
      <div class="motivation-icon">${randomQuote.icon}</div>
      <div class="motivation-quote">${randomQuote.quote}</div>
      <div class="motivation-subtext">${randomQuote.subtext}</div>
      <button class="finish-btn" onclick="document.getElementById('urgeModal').classList.remove('active')">Fertig</button>
    </div>
  `;
};

function showRandomUrgeMethod() {
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * URGE_METHODS.length);
  } while (randomIndex === currentMethodIndex && URGE_METHODS.length > 1);
  
  currentMethodIndex = randomIndex;
  const method = URGE_METHODS[currentMethodIndex];
  
  document.getElementById('newRandomBtn').style.display = 'flex'; // Show random button
  
  const container = document.getElementById('randomMethodContainer');
  container.innerHTML = `
    <div class="method-item" style="flex-direction: column; text-align: center; gap: 20px; padding: 24px; cursor: default;">
      <div class="method-icon" style="width: 80px; height: 80px; font-size: 40px; margin: 0 auto;">${method.icon}</div>
      <div class="method-text" style="align-items: center;">
        <div class="method-title" style="font-size: 20px; margin-bottom: 8px;">${method.title}</div>
        <div class="method-desc" style="font-size: 14px; margin-bottom: 24px;">${method.desc}</div>
        <button class="urge-btn" style="width: 100%; justify-content: center;" onclick="showMotivationScreen()">${method.action}</button>
      </div>
    </div>
  `;
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const photo = {
      url: event.target.result,
      date: new Date().toISOString(),
      day: state.streakDays
    };
    state.photos.unshift(photo);
    localStorage.setItem('photos', JSON.stringify(state.photos));
    renderContent();
  };
  reader.readAsDataURL(file);
}

/* --- Lightbox Logic --- */
window.openLightbox = function(index) {
  state.activePhotoIndex = index;
  renderLightboxContent();
  document.getElementById('lightboxModal').classList.add('active');
};

function closeLightbox() {
  document.getElementById('lightboxModal').classList.remove('active');
  state.activePhotoIndex = null;
}

function nextPhoto() {
  if (state.activePhotoIndex === null) return;
  state.activePhotoIndex = (state.activePhotoIndex + 1) % state.photos.length;
  renderLightboxContent();
}

function prevPhoto() {
  if (state.activePhotoIndex === null) return;
  state.activePhotoIndex = (state.activePhotoIndex - 1 + state.photos.length) % state.photos.length;
  renderLightboxContent();
}

// Initial render
renderApp();

function renderLightboxContent() {
  if (state.activePhotoIndex === null) return;
  const photo = state.photos[state.activePhotoIndex];
  const container = document.getElementById('lightboxContent');
  
  container.innerHTML = `
    <div class="lightbox-img-container">
      <img src="${photo.url}" class="lightbox-img">
    </div>
    <div class="lightbox-info">
      <div class="lightbox-info-date">${new Date(photo.date).toLocaleDateString('de-DE')}</div>
      <div class="lightbox-info-tag">Tag ${photo.day}</div>
    </div>
  `;
}

// Update streak every minute
setInterval(() => {
  if (state.currentView === 'dashboard' || state.currentView === 'nailpal') {
    calculateStreak();
    if (state.currentView === 'dashboard') {
      const streakDisplay = document.querySelector('.streak-value');
      if (streakDisplay) {
        streakDisplay.innerText = `${state.streakDays} Tage, ${state.streakHours} Std.`;
      }
    }
  }
}, 60000);
