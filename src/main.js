import './style.css'
import { supabase } from './supabase.js'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Camera, CameraResultType } from '@capacitor/camera'

window.onerror = function(msg, url, lineNo, columnNo, error) {
  alert('Fehler: ' + msg + '\nZeile: ' + lineNo);
  return false;
};

// Register Service Worker for PWA/Push
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('Service Worker registered', reg))
    .catch(err => console.log('Service Worker not registered', err));
}

// Initial State
let state = {
  currentView: 'dashboard', 
  lastBite: new Date(localStorage.getItem('lastBite') || (Date.now() - 3 * 24 * 60 * 60 * 1000)),
  photos: JSON.parse(localStorage.getItem('photos') || '[]'),
  streakDays: 0,
  streakHours: 0,
  activePhotoIndex: null,
  targetReward: localStorage.getItem('targetReward') || null,
  targetDays: parseInt(localStorage.getItem('targetDays')) || 0,
  palDrops: parseInt(localStorage.getItem('palDrops')) || 0,
  lastWatered: localStorage.getItem('lastWatered') || null,
  palInventory: JSON.parse(localStorage.getItem('palInventory') || '[]'),
  activeAccessory: localStorage.getItem('activeAccessory') || null,
  relapseLog: JSON.parse(localStorage.getItem('relapseLog') || '[]'),
  unlockedBadges: JSON.parse(localStorage.getItem('unlockedBadges') || '[]'),
  urgeCountSinceRelapse: parseInt(localStorage.getItem('urgeCountSinceRelapse')) || 0,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isPremium: localStorage.getItem('isPremium') === 'true',
  theme: localStorage.getItem('theme') || 'default',
  activeAvatar: localStorage.getItem('activeAvatar') || 'plant',
  userAvatar: localStorage.getItem('userAvatar') || '👤',
  moodHistory: JSON.parse(localStorage.getItem('moodHistory') || '[]'),
  urgeLog: JSON.parse(localStorage.getItem('urgeLog') || '[]'),
  showOnboarding: !localStorage.getItem('onboardingDone'),
  onboardingStep: 0
};

const ONBOARDING_SLIDES = [
  { 
    title: "Willkommen bei Nobite", 
    desc: "Der Weg zu gesunden Nägeln beginnt heute. Wir begleiten dich Schritt für Schritt auf deiner Reise.", 
    icon: "✨",
    color: "#10b981"
  },
  { 
    title: "Dein Nail Pal", 
    desc: "Du hast einen virtuellen Begleiter. Er wächst und gedeiht, wenn du nicht kaust. Pflege ihn gut!", 
    icon: "🪴",
    color: "#3b82f6"
  },
  { 
    title: "Soforthilfe", 
    desc: "Wenn der Drang kommt, klicke auf 'Ich habe Drang...'. Wir haben sofortige Übungen für dich bereit.", 
    icon: "🆘",
    color: "#ef4444"
  },
  { 
    title: "KI-Analyse", 
    desc: "Verstehe deine Muster. Wir zeigen dir (als Premium-Nutzer), wann du am gefährdetsten bist.", 
    icon: "🧠",
    color: "#8b5cf6"
  }
];

window.nextOnboarding = function() {
  state.onboardingStep++;
  if (state.onboardingStep >= ONBOARDING_SLIDES.length) {
    state.showOnboarding = false;
    localStorage.setItem('onboardingDone', 'true');
  }
  renderApp();
};

window.skipOnboarding = function() {
  state.showOnboarding = false;
  localStorage.setItem('onboardingDone', 'true');
  renderApp();
};

// --- Supabase Backend Sync ---
async function saveUserData() {
  if (!state.user) return;
  
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: state.user.id,
      email: state.user.email,
      streak_days: state.streakDays,
      pal_drops: state.palDrops,
      pal_inventory: state.palInventory,
      relapse_log: state.relapseLog,
      is_premium: state.isPremium,
      theme: state.theme,
      active_avatar: state.activeAvatar,
      user_avatar: state.userAvatar,
      target_reward: state.targetReward,
      target_days: state.targetDays,
      last_bite: state.lastBite.toISOString(),
      urge_log: state.urgeLog
    });

  if (error) console.error('Fehler beim Speichern:', error);
}

async function loadUserData() {
  if (!state.user) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Fehler beim Laden:', error);
    return;
  }

  if (data) {
    state.streakDays = data.streak_days;
    state.palDrops = data.pal_drops;
    state.palInventory = data.pal_inventory || [];
    state.relapseLog = data.relapse_log || [];
    state.isPremium = data.is_premium;
    state.theme = data.theme || 'default';
    state.activeAvatar = data.active_avatar || 'plant';
    state.userAvatar = data.user_avatar || '👤';
    state.targetReward = data.target_reward;
    state.targetDays = data.target_days;
    state.last_bite = new Date(data.last_bite);
    state.urgeLog = data.urge_log || [];
    
    // Update LocalStorage as backup
    localStorage.setItem('palDrops', state.palDrops);
    localStorage.setItem('palInventory', JSON.stringify(state.palInventory));
    localStorage.setItem('urgeLog', JSON.stringify(state.urgeLog));
    localStorage.setItem('isPremium', state.isPremium);

    localStorage.setItem('theme', state.theme);
    
    applyTheme();
    renderApp();
  }
}

// Check for existing session on startup
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    state.user = session.user;
    localStorage.setItem('user', JSON.stringify(session.user));
    loadUserData();
  } else {
    state.user = null;
    localStorage.removeItem('user');
  }
  renderApp();
});

const BADGES = [
  { id: 'first_day', icon: '🌱', title: 'Erster Schritt', desc: '24 Stunden geschafft!', criteria: (s) => s.streakDays >= 1 },
  { id: 'streak_3', icon: '🥉', title: 'Drei-Tage-Bart', desc: '3 Tage ohne Kauen!', criteria: (s) => s.streakDays >= 3 },
  { id: 'week_warrior', icon: '⚔️', title: 'Wochen-Held', desc: '7 Tage am Stück clean!', criteria: (s) => s.streakDays >= 7 },
  { id: 'fortnight', icon: '🥈', title: 'Zwei Wochen!', desc: '14 Tage Disziplin.', criteria: (s) => s.streakDays >= 14 },
  { id: 'month_master', icon: '👑', title: 'Monats-Meister', desc: '30 Tage am Stück!', criteria: (s) => s.streakDays >= 30 },
  { id: 'urge_slayer', icon: '🛡️', title: 'Drang-Bändiger', desc: '5x Soforthilfe genutzt.', criteria: (s) => s.urgeCountSinceRelapse >= 5 },
  { id: 'bubble_fun', icon: '🫧', title: 'Seifenblasen-Pro', desc: 'Das Bubble-Spiel gespielt.', criteria: (s) => localStorage.getItem('playedBubbleGame') === 'true' },
  { id: 'pal_lover', icon: '❤️', title: 'Pflanzen-Freund', desc: 'Nail Pal gut gepflegt.', criteria: (s) => s.palDrops >= 50 },
  { id: 'fashionista', icon: '🕶️', title: 'Fashionista', desc: 'Ein Accessoire getragen.', criteria: (s) => s.activeAccessory !== null },
  { id: 'paparazzi', icon: '📸', title: 'Dokumentar', desc: '3 Fotos im Tagebuch.', criteria: (s) => s.photos.length >= 3 },
  { id: 'shopaholic', icon: '🛍️', title: 'Shopping-Tour', desc: '2 Items im Shop gekauft.', criteria: (s) => s.palInventory.length >= 2 },
  { id: 'night_owl', icon: '🦉', title: 'Nachteule', desc: 'Die App nach 22 Uhr genutzt.', criteria: (s) => new Date().getHours() >= 22 }
];

const SHOP_ITEMS = [
  { id: 'bow', icon: '🎀', name: 'Schleife', price: 10, premium: false },
  { id: 'glasses', icon: '🕶️', name: 'Sonnenbrille', price: 30, premium: true },
  { id: 'hat', icon: '🎩', name: 'Zylinder', price: 50, premium: true },
  { id: 'party', icon: '🎉', name: 'Partyhut', price: 100, premium: true }
];

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
  
  if (state.showOnboarding) {
    app.innerHTML = renderOnboarding();
    return;
  }

  app.innerHTML = `
    <header class="header">
      <div class="logo">
        <div class="logo-icon">🌿</div>
        Nobite
      </div>
    </header>

    <main id="mainContent"></main>

    <nav class="nav-bar">
      <div class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" onclick="switchView('dashboard')">
        <div class="nav-icon">📊</div>
        <span>Dashboard</span>
      </div>
      <div class="nav-item ${state.currentView === 'gallery' ? 'active' : ''}" onclick="switchView('gallery')">
        <div class="nav-icon">📸</div>
        <span>Galerie</span>
      </div>
      <div class="nav-item ${state.currentView === 'nailpal' ? 'active' : ''}" onclick="switchView('nailpal')">
        <div class="nav-icon">🪴</div>
        <span>Nail Pal</span>
      </div>
      <div class="nav-item ${state.currentView === 'achievements' ? 'active' : ''}" onclick="switchView('achievements')">
        <div class="nav-icon">🏆</div>
        <span>Erfolge</span>
      </div>
      <div class="nav-item ${state.currentView === 'profile' ? 'active' : ''}" onclick="switchView('profile')">
        <div class="nav-icon">👤</div>
        <span>Profil</span>
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
      </div>
    </div>

    <!-- Comparison Modal -->
    <div class="comparison-overlay" id="comparisonModal">
      <div class="comparison-card" id="comparisonCard">
        <div class="comparison-header">
          <div class="comparison-title">Mein Fortschritt</div>
          <div class="comparison-subtitle" id="comparisonSubtitle">Tag 0 bis Tag X</div>
        </div>
        <div class="comparison-images" id="comparisonImages">
          <!-- Images injected here -->
        </div>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button class="share-btn-large" onclick="window.shareComparison()" style="flex: 2;">
            ✨ Teilen
          </button>
          <button class="finish-btn" onclick="document.getElementById('comparisonModal').classList.remove('active')" style="flex: 1;">
            Schließen
          </button>
        </div>
      </div>
    </div>
  `;


  renderContent();
  
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

function renderOnboarding() {
  const slide = ONBOARDING_SLIDES[state.onboardingStep];
  const isLast = state.onboardingStep === ONBOARDING_SLIDES.length - 1;

  return `
    <div class="onboarding-view" style="background: var(--color-bg); height: 100vh; display: flex; flex-direction: column; padding: 40px 20px; text-align: center; justify-content: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: -100px; left: -100px; width: 300px; height: 300px; background: ${slide.color}; filter: blur(120px); opacity: 0.2; border-radius: 50%;"></div>
      
      <div class="onboarding-content" style="z-index: 10; animation: slideIn 0.5s ease-out;">
        <div style="font-size: 80px; margin-bottom: 30px;">${slide.icon}</div>
        <h1 style="font-size: 32px; font-weight: 800; margin-bottom: 16px; color: white;">${slide.title}</h1>
        <p style="font-size: 16px; color: var(--color-text-dim); line-height: 1.6; max-width: 300px; margin: 0 auto 40px;">${slide.desc}</p>
      </div>

      <div class="onboarding-dots" style="display: flex; justify-content: center; gap: 8px; margin-bottom: 40px; z-index: 10;">
        ${ONBOARDING_SLIDES.map((_, i) => `
          <div style="width: ${i === state.onboardingStep ? '24px' : '8px'}; height: 8px; background: ${i === state.onboardingStep ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)'}; border-radius: 4px; transition: 0.3s;"></div>
        `).join('')}
      </div>

      <div style="z-index: 10; display: flex; flex-direction: column; gap: 12px;">
        <button class="finish-btn" style="width: 100%; height: 56px; font-size: 18px;" onclick="window.nextOnboarding()">
          ${isLast ? 'Jetzt starten' : 'Weiter'}
        </button>
        ${!isLast ? `<button style="background: none; border: none; color: var(--color-text-dim); padding: 10px; cursor: pointer;" onclick="window.skipOnboarding()">Überspringen</button>` : ''}
      </div>
    </div>
  `;
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

function applyTheme() {
  const root = document.documentElement;
  const themes = {
    default: { primary: '#10b981', secondary: '#34d399', bg: '#064e3b' },
    ocean: { primary: '#0ea5e9', secondary: '#38bdf8', bg: '#0c4a6e' },
    sunset: { primary: '#f43f5e', secondary: '#fb7185', bg: '#881337' },
    forest: { primary: '#65a30d', secondary: '#a3e635', bg: '#14532d' }
  };
  
  const t = themes[state.theme] || themes.default;
  root.style.setProperty('--color-primary', t.primary);
  root.style.setProperty('--color-secondary', t.secondary);
  root.style.setProperty('--color-bg', t.bg);
}

window.switchView = function(view) {
  if (!view) return;
  state.currentView = view;
  renderApp();
};

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
        
        <div id="goalContainer">
          ${renderMoodTracker()}
          ${renderGoalCard()}
          ${renderMoodChart()}
          ${state.isPremium ? renderTriggerCard() : `
            <div class="goal-card" style="opacity: 0.7; border-style: dashed; cursor: pointer;" onclick="switchView('profile')">
              <div style="font-size: 14px; text-align: center;">💎 Schalte <b>Intelligente Analyse</b> mit Premium frei!</div>
            </div>
          `}
        </div>
        
        <button class="reset-btn" onclick="showMoodPicker()">Ich habe gekaut (Tracker & Ziel zurücksetzen)</button>
      </div>

      <!-- Mood Picker Modal -->
      <div class="modal-overlay" id="moodModal">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Wie hast du dich gefühlt?</h3>
          </div>
          <p style="font-size: 14px; color: var(--color-text-dim); margin-bottom: 20px;">Stress ist oft ein Auslöser. Dein ehrliches Feedback hilft der Analyse.</p>
          <div class="mood-selector" style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 24px;">
            <button class="mood-btn" onclick="window.selectRelapseMood(1, this)">😌<br><span style="font-size: 10px;">Ruhig</span></button>
            <button class="mood-btn" onclick="window.selectRelapseMood(2, this)">😐<br><span style="font-size: 10px;">Ok</span></button>
            <button class="mood-btn" onclick="window.selectRelapseMood(3, this)">😟<br><span style="font-size: 10px;">Angst</span></button>
            <button class="mood-btn" onclick="window.selectRelapseMood(4, this)">😫<br><span style="font-size: 10px;">Stress</span></button>
            <button class="mood-btn" onclick="window.selectRelapseMood(5, this)">😡<br><span style="font-size: 10px;">Wut</span></button>
          </div>

          <p style="font-size: 14px; font-weight: bold; margin-bottom: 12px;">Was war der Auslöser? (Trigger)</p>
          <div class="trigger-checkboxes" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px;">
            ${['😴 Langeweile', '😫 Stress', '🚗 Autofahren', '📺 Fernsehen', '💻 Arbeit/Lernen', '🍔 Nach dem Essen', '❓ Sonstiges'].map(t => `
              <label style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 10px; font-size: 12px; cursor: pointer;">
                <input type="checkbox" name="relapseTrigger" value="${t}" style="accent-color: var(--color-primary);">
                ${t}
              </label>
            `).join('')}
          </div>

          <button class="urge-btn" style="width: 100%; justify-content: center; margin-bottom: 12px;" onclick="window.submitRelapse()">Rückfall bestätigen</button>

          <button class="close-btn" style="position: static; width: 100%; font-size: 14px;" onclick="document.getElementById('moodModal').classList.remove('active')">Abbrechen</button>
        </div>
      </div>
    `;
    document.querySelector('#urgeBtn').addEventListener('click', () => {
      // Log the urge
      state.urgeLog.push({ timestamp: new Date().toISOString() });
      localStorage.setItem('urgeLog', JSON.stringify(state.urgeLog));
      saveUserData();

      showRandomUrgeMethod();
      document.getElementById('urgeModal').classList.add('active');
    });
  } else if (state.currentView === 'gallery') {
    container.innerHTML = `
      <div class="gallery">
        <div class="gallery-header">
          <h2 class="gallery-title">Foto-Tagebuch</h2>
          <div style="display: flex; gap: 12px; align-items: center;">
            ${state.photos.length >= 2 ? `
              <button onclick="window.showComparison()" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer;">
                ✨ Vergleich
              </button>
            ` : ''}
            <div class="add-photo-label" onclick="window.takeNativePhoto()" style="cursor: pointer;">+</div>
          </div>
          <input type="file" id="photoInput" accept="image/*" capture="camera" style="display: none;">
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
    container.innerHTML = renderNailPalView();
  } else if (state.currentView === 'achievements') {
    container.innerHTML = renderAchievementsView();
  } else if (state.currentView === 'profile') {
    container.innerHTML = renderProfileView();
  } else if (state.currentView === 'tips') {
    container.innerHTML = renderTipsView();
  } else if (state.currentView === 'legal') {
    container.innerHTML = renderLegalView(state.legalType);
  }
}

/* --- Tips Logic --- */
function renderTipsView() {
  const tips = [
    { icon: '💅', title: 'Nägel kurz halten & feilen', text: 'Halte deine Nägel möglichst kurz und feile raue Kanten sofort glatt. Je weniger Angriffsfläche, desto besser!' },
    { icon: '🧴', title: 'Handcreme & Nagelöl', text: 'Pflege deine Nagelhaut! Trockene Haut verleitet oft zum Knibbeln. Eine Handcreme in der Tasche wirkt Wunder.' },
    { icon: '🍬', title: 'Kaugummi kauen', text: 'Wenn der Drang groß ist, nimm einen Kaugummi. Das beschäftigt deinen Mund und lenkt ab.' },
    { icon: '🛡️', title: 'Bitterlack auftragen', text: 'Ein spezieller Lack mit bitterem Geschmack fungiert als "Stoppschild", falls du doch mal unbewusst den Finger zum Mund führst.' },
    { icon: '🎯', title: 'Trigger identifizieren', text: 'Achte darauf, WANN du kaust. Bei Stress? Aus Langeweile? Beim Fernsehen? Finde Alternativen für diese Situationen (z.B. einen Stressball).' }
  ];

  return `
    <div class="tips-container">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <button onclick="window.switchView('profile')" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 12px; border-radius: 12px; cursor: pointer;">←</button>
        <h2 class="tips-title" style="margin-bottom: 0;">Tipps & Tricks</h2>
      </div>
      <p class="tips-subtitle">Kleine Veränderungen im Alltag machen einen großen Unterschied.</p>
      
      <div class="tips-list">
        ${tips.map(tip => `
          <div class="tip-card">
            <div class="tip-icon">${tip.icon}</div>
            <div class="tip-content">
              <h3 class="tip-card-title">${tip.title}</h3>
              <p class="tip-card-text">${tip.text}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* --- Nail Pal Game Logic --- */
function renderNailPalView() {
  const isPlant = state.activeAvatar === 'plant';
  const today = new Date().toLocaleDateString('de-DE');
  const canWater = state.lastWatered !== today;
  
  return `
    <div class="pal-container">
      <div class="pal-header">
        <div class="pal-drops">💧 ${state.palDrops} Tropfen</div>
      </div>
      
      <div class="pal-card" style="position: relative;">
        ${isPlant ? renderPlantAvatar() : renderNailAvatar()}
      </div>
      
      <button class="water-btn ${canWater ? '' : 'disabled'}" onclick="window.waterPal()" ${canWater ? '' : 'disabled'}>
        ${canWater ? `💦 ${isPlant ? 'Pflanze gießen' : 'Nägel pflegen'} (+10 Tropfen)` : '✅ Für heute erledigt!'}
      </button>

      <div class="pal-shop">
        <h3 class="shop-title">Boutique</h3>
        <div class="shop-grid">
          ${SHOP_ITEMS.map(item => {
            const owned = state.palInventory.includes(item.id);
            const equipped = state.activeAccessory === item.id;
            
            let btnHTML = '';
            if (!owned) {
              if (item.premium && !state.isPremium) {
                btnHTML = `<button class="shop-btn disabled" onclick="switchView('profile')" style="background: #fbbf24; color: #000; font-size: 9px;">💎 Premium</button>`;
              } else {
                const canAfford = state.palDrops >= item.price;
                btnHTML = `<button class="shop-btn buy-btn" onclick="buyItem('${item.id}', ${item.price})" ${canAfford ? '' : 'disabled'}>${item.price} 💧</button>`;
              }
            } else if (equipped) {
              btnHTML = `<button class="shop-btn equip-btn active" onclick="equipItem('${item.id}')">Trägt es</button>`;
            } else {
              btnHTML = `<button class="shop-btn equip-btn" onclick="equipItem('${item.id}')">Anziehen</button>`;
            }
            
            return `
              <div class="shop-item">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                ${btnHTML}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderPlantAvatar() {
  const pal = PAL_CONFIG[state.palLevel] || PAL_CONFIG[0];
  const quote = PAL_QUOTES[Math.floor(Math.random() * PAL_QUOTES.length)];
  return `
    <div id="palBubble" onclick="window.interactWithPal(this)">
      <div class="pal-icon">${pal.icon}</div>
      <div class="pal-status">${pal.status}</div>
      <div class="pal-quote">"${quote}"</div>
    </div>
  `;
}

function renderNailAvatar() {
  const days = state.streakDays;
  let status = "Stark bleiben!";
  let nailClass = "bitten";
  
  if (days >= 1) { status = "Heilung beginnt..."; nailClass = "healing"; }
  if (days >= 3) { status = "Wächst stetig!"; nailClass = "short"; }
  if (days >= 7) { status = "Wunderschön!"; nailClass = "healthy"; }
  if (days >= 14) { status = "Wow! Echte Prachtstücke."; nailClass = "perfect"; }

  return `
    <div class="nail-avatar-view">
      <div class="hand-container ${nailClass}">
        <div class="finger thumb"><div class="nail"></div></div>
        <div class="finger"><div class="nail"></div></div>
        <div class="finger main-finger"><div class="nail"></div></div>
        <div class="finger"><div class="nail"></div></div>
        <div class="finger"><div class="nail"></div></div>
      </div>
      <div class="pal-status">${status}</div>
    </div>
  `;
}

window.waterPal = function() {
  const today = new Date().toLocaleDateString('de-DE');
  if (state.lastWatered !== today) {
    state.palDrops += 10;
    state.lastWatered = today;
    localStorage.setItem('palDrops', state.palDrops);
    localStorage.setItem('lastWatered', state.lastWatered);
    saveUserData();
    renderApp();
  }
};

window.interactWithPal = function(element) {
  element.classList.add('wobble');
  showFloatingHearts();
  
  const quotes = ["Ich hab dich lieb! 💚", "Du bist stark! ✨", "Gemeinsam wachsen wir! 🌱", "Heute ist ein toller Tag! ☀️"];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  
  const bubble = document.getElementById('palBubble');
  if (bubble) {
    bubble.querySelector('.pal-quote').innerText = '"' + randomQuote + '"';
  }
  
  setTimeout(() => element.classList.remove('wobble'), 500);
};

window.buyItem = function(id, price) {
  if (state.palDrops >= price) {
    state.palDrops -= price;
    state.palInventory.push(id);
    localStorage.setItem('palDrops', state.palDrops);
    localStorage.setItem('palInventory', JSON.stringify(state.palInventory));
    saveUserData();
    renderApp();
  }
};

window.equipItem = function(id) {
  if (state.activeAccessory === id) {
    state.activeAccessory = null; // Unequip
  } else {
    state.activeAccessory = id; // Equip
  }
  localStorage.setItem('activeAccessory', state.activeAccessory || '');
  checkAchievements();
  renderApp();
};

/* --- Trigger Analysis & Notifications --- */
function analyzeTriggers() {
  if (state.relapseLog.length === 0 && state.urgeLog.length === 0) return null;
  
  const hourCounts = Array(24).fill(0);
  const urgeHourCounts = Array(24).fill(0);

  state.relapseLog.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    hourCounts[hour]++;
  });

  state.urgeLog.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    urgeHourCounts[hour]++;
  });
  
  let maxRelapseHour = 0;
  let maxRelapseCount = 0;
  let maxUrgeHour = 0;
  let maxUrgeCount = 0;

  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > maxRelapseCount) {
      maxRelapseCount = hourCounts[h];
      maxRelapseHour = h;
    }
    if (urgeHourCounts[h] > maxUrgeCount) {
      maxUrgeCount = urgeHourCounts[h];
      maxUrgeHour = h;
    }
  }
  
  const getTimeLabel = (hour) => {
    if (hour >= 5 && hour < 12) return "Vormittag";
    if (hour >= 12 && hour < 14) return "Mittag";
    if (hour >= 14 && hour < 18) return "Nachmittag";
    if (hour >= 18 && hour < 22) return "Abend";
    return "Nacht";
  };
  
  return { 
    relapse: { hour: maxRelapseHour, count: maxRelapseCount, label: getTimeLabel(maxRelapseHour) },
    urge: { hour: maxUrgeHour, count: maxUrgeCount, label: getTimeLabel(maxUrgeHour) },
    topTrigger: getTopTrigger()
  };
}

function getTopTrigger() {
  if (state.relapseLog.length === 0) return null;
  const triggerCounts = {};
  state.relapseLog.forEach(log => {
    if (log.triggers && Array.isArray(log.triggers)) {
      log.triggers.forEach(t => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    }
  });
  
  let top = null;
  let max = 0;
  for (const t in triggerCounts) {
    if (triggerCounts[t] > max) {
      max = triggerCounts[t];
      top = t;
    }
  }
  return top;
}



function renderMoodTracker() {
  const today = new Date().toLocaleDateString();
  const checkedIn = state.moodHistory.some(m => m.date === today);
  
  if (checkedIn) return ""; // Only show if not checked in yet today

  return `
    <div class="goal-card" style="background: rgba(255,255,255,0.03); text-align: center; border: 1px solid rgba(255,255,255,0.05);">
      <h3 style="font-size: 15px; margin-bottom: 12px; color: var(--color-text);">Wie fühlst du dich heute?</h3>
      <div style="display: flex; justify-content: space-between; gap: 8px;">
        ${[
          { emoji: '😌', level: 1 },
          { emoji: '😐', level: 2 },
          { emoji: '😟', level: 3 },
          { emoji: '😫', level: 4 },
          { emoji: '😡', level: 5 }
        ].map(m => `
          <button onclick="window.recordDailyMood(${m.level})" style="flex: 1; padding: 10px 0; border-radius: 12px; border: none; background: rgba(255,255,255,0.05); font-size: 20px; cursor: pointer; transition: 0.3s;">${m.emoji}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMoodChart() {
  if (state.moodHistory.length < 2) return ""; // Only show chart if we have at least 2 days

  const last7Days = state.moodHistory.slice(-7);
  const height = 60;
  const width = 280;
  const maxVal = 5;
  const stepX = width / (last7Days.length - 1 || 1);

  const points = last7Days.map((m, i) => {
    const x = i * stepX;
    const y = height - ((6 - m.mood) / maxVal * height);
    return `${x},${y}`;
  }).join(' ');

  return `
    <div class="goal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 14px; color: var(--color-text);">Stimmungs-Trend</h3>
        <span style="font-size: 10px; color: var(--color-text-dim);">Letzte ${last7Days.length} Tage</span>
      </div>
      <div style="height: 80px; width: 100%; position: relative;">
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="moodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color: var(--color-primary); stop-opacity: 0.2" />
              <stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
            </linearGradient>
          </defs>
          <path d="M 0 ${height} L ${points} L ${width} ${height} Z" fill="url(#moodGrad)" />
          <polyline points="${points}" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          ${last7Days.map((m, i) => `
            <circle cx="${i * stepX}" cy="${height - ((6 - m.mood) / maxVal * height)}" r="3" fill="white" stroke="var(--color-primary)" stroke-width="2" />
          `).join('')}
        </svg>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 9px; color: var(--color-text-dim);">
          <span>😌 Ruhig</span>
          <span>😡 Gestresst</span>
        </div>
      </div>
    </div>
  `;
}

function renderTriggerCard() {
  const analysis = analyzeTriggers();
  
  if (!analysis || (analysis.relapse.count === 0 && analysis.urge.count === 0)) {
    return `
      <div class="goal-card trigger-card" style="opacity: 0.8; border: 1px dashed var(--glass-border);">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-primary); font-weight: bold; margin-bottom: 8px;">
          KI-Analyse (Premium)
        </div>
        <div style="font-size: 14px; color: var(--color-text-dim); text-align: center; padding: 10px 0;">
          Noch nicht genügend Daten für eine Analyse. 📊 Nutze den "Ich habe Drang"-Button, um Muster zu erkennen.
        </div>
      </div>
    `;
  }
  
  const hasUrgeData = analysis.urge.count > 0;
  const hasRelapseData = analysis.relapse.count > 0;

  return `
    <div class="goal-card trigger-card">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-primary); font-weight: bold; margin-bottom: 12px;">
        KI-Analyse (Premium)
      </div>
      
      ${hasUrgeData ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; color: var(--color-text-dim); margin-bottom: 4px;">Häufigster Drang (${analysis.urge.label})</div>
          <div style="font-size: 16px; font-weight: bold; color: #fbbf24;">⚠️ gegen ${analysis.urge.hour}:00 Uhr</div>
        </div>
      ` : ''}

      ${hasRelapseData ? `
        <div style="margin-bottom: 16px;">
          <div style="font-size: 11px; color: var(--color-text-dim); margin-bottom: 4px;">Kritischste Rückfallzeit (${analysis.relapse.label})</div>
          <div style="font-size: 16px; font-weight: bold; color: #ef4444;">🚨 gegen ${analysis.relapse.hour}:00 Uhr</div>
          ${analysis.topTrigger ? `
            <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 4px;">Hauptauslöser: <b>${analysis.topTrigger}</b></div>
          ` : ''}
        </div>
      ` : ''}


      <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="font-size: 24px;">🧠</div>
        <div style="text-align: left;">
          <div style="font-size: 11px; color: var(--color-text-dim);">Tipp vom Nail Pal</div>
          <div style="font-size: 13px; font-style: italic;">"Sei heute besonders um ${hasUrgeData ? analysis.urge.hour : analysis.relapse.hour}:00 Uhr achtsam!"</div>
        </div>
      </div>
    </div>
  `;
}

window.resetTriggers = function() {
  if (confirm("Möchtest du die Trigger-Analyse wirklich zurücksetzen? Deine Daten werden gelöscht.")) {
    state.relapseLog = [];
    state.urgeLog = [];
    localStorage.setItem('relapseLog', JSON.stringify([]));
    localStorage.setItem('urgeLog', JSON.stringify([]));
    saveUserData();
    renderApp();
  }
};


window.requestNotificationPermission = async function() {
  // Check if we are running in a native environment
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

  if (isNative) {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      window.subscribeToPush();
      sendNotification("Nobite", "Super! Ich werde dich vor deinen kritischen Zeiten warnen.");
      const testBtn = document.getElementById('testNotifyBtn');
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.style.opacity = "1";
      }
    } else {
      alert("Benachrichtigungen wurden nicht erlaubt.");
    }
    return;
  }

  if (!window.Notification) {
    alert("Dein Browser unterstützt leider keine Benachrichtigungen. (Auf dem iPhone musst du die App zum Homescreen hinzufügen)");
    return;
  }
  
  if (Notification.permission === "denied") {
    alert("Du hast Benachrichtigungen für diese Seite blockiert. Bitte aktiviere sie in den Einstellungen deines Browsers/iPhones.");
    return;
  }

  if (Notification.permission === "granted") {
    window.subscribeToPush();
    return;
  }
  
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      window.subscribeToPush();
      sendNotification("Nobite", "Super! Ich werde dich vor deinen kritischen Zeiten warnen.");
    } else {
      alert("Benachrichtigungen wurden nicht erlaubt.");
    }
  });
}

// Debug connection
async function testConnection() {
  try {
    const { data, error } = await supabase.from('goals').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log("Supabase Verbindung steht! ✅");
    // Optional: alert("Verbindung erfolgreich!"); 
  } catch (err) {
    console.error("Supabase Verbindungsfehler:", err.message);
    alert("⚠️ Verbindung zu Supabase fehlgeschlagen: " + err.message + "\nBitte prüfe dein Internet und die Supabase-Keys.");
  }
}

function renderInAppWarning() {
  const analysis = analyzeTriggers();
  if (!analysis) return "";
  
  const currentHour = new Date().getHours();
  // Show warning if we are in or 1 hour before the critical hour
  if (currentHour === analysis.hour || currentHour === (analysis.hour - 1)) {
    return `
      <div class="goal-card" style="background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; animation: pulse 2s infinite;">
        <div style="display: flex; align-items: center; gap: 10px; color: #ef4444; font-weight: bold; font-size: 16px;">
          <span>⚠️</span> ACHTUNG: KRITISCHE PHASE
        </div>
        <div style="font-size: 14px; margin-top: 5px; color: var(--color-text);">
          Es ist gerade dein typischer Zeitpunkt für Rückfälle (${analysis.label}). Sei besonders wachsam!
        </div>
        <button class="urge-btn" style="margin-top: 10px; padding: 12px; background: #ef4444; color: white;" onclick="showRandomUrgeMethod(); document.getElementById('urgeModal').classList.add('active');">
          Drang jetzt bekämpfen!
        </button>
      </div>
    `;
  }
  return "";
}

async function sendNotification(title, body) {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

  if (isNative) {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 10000),
          schedule: { at: new Date(Date.now() + 1000) },
          sound: null,
          attachments: null,
          actionTypeId: "",
          extra: null
        }
      ]
    });
    return;
  }

  if (!window.Notification || Notification.permission !== "granted") return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body: body,
        icon: "./icon.png",
        badge: "./icon.png",
        vibrate: [100, 50, 100]
      });
    });
  } else {
    new Notification(title, { body, icon: "./icon.png" });
  }
}

function checkTriggerNotifications() {
  if (!window.Notification || Notification.permission !== "granted") return;

  const now = new Date();
  const currentHour = now.getHours();
  const today = now.toLocaleDateString();

  if (state.isPremium) {
    // Premium Logic: Multiple times a day based on analysis
    const analysis = analyzeTriggers();
    if (!analysis) return;

    // Check both urge and relapse hours
    const criticalHours = new Set();
    if (analysis.urge.count > 0) criticalHours.add(analysis.urge.hour);
    if (analysis.relapse.count > 0) criticalHours.add(analysis.relapse.hour);

    criticalHours.forEach(h => {
      // Notify 30-60 mins before each critical hour
      if (currentHour === (h - 1) || (h === 0 && currentHour === 23)) {
        const notifiedKey = `notified_${today}_${h}`;
        if (!localStorage.getItem(notifiedKey)) {
          sendNotification("Nobite Achtung!", `Deine kritische Phase (${h}:00 Uhr) naht. Bleib stark! 🧘`);
          localStorage.setItem(notifiedKey, 'true');
        }
      }
    });
  } else {
    // Non-Premium Logic: 1x daily (e.g., at 10 AM)
    const lastDaily = localStorage.getItem('lastDailyNotify');
    if (currentHour === 10 && lastDaily !== today) {
      sendNotification("Guten Morgen! ✨", "Ein neuer Tag ohne Kauen. Dein Nail Pal glaubt an dich!");
      localStorage.setItem('lastDailyNotify', today);
    }
  }
}

// Check every 15 minutes
setInterval(checkTriggerNotifications, 15 * 60 * 1000);
checkTriggerNotifications();

function showFloatingHearts() {
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.innerText = '💚';
    heart.style.left = (Math.random() * 40 + 30) + '%';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
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
  { id: 'breathe', icon: '🧘', title: 'Atemübung (4-4-6)', desc: 'Atme tief ein (4s), halte (4s), atme aus (6s). Beruhigt sofort.', action: 'Atemübung starten' },
  { id: 'water', icon: '💧', title: 'Wasser trinken', desc: 'Steh auf und hol dir ein frisches Glas Wasser. Physische Ablenkung.', action: 'Wasser getrunken' },
  { id: 'thought', icon: '✨', title: 'Positiver Gedanke', desc: 'Du bist stark! Jeder Moment ohne Kauen ist ein Gewinn. Schau auf deinen Fortschritt!', action: 'Verstanden' },
  { id: 'game', icon: '🎮', title: 'Mini-Ablenkung', desc: 'Zerplatze die Blasen auf dem Bildschirm! Beschäftige deine Hände.', action: 'Spiel starten' }
];

const DISGUST_FACTS = [
  { icon: '🦠', title: 'Bakterien-Zoo', text: 'Unter deinen Fingernägeln leben doppelt so viele Bakterien wie auf dem Rest deiner Hand – darunter oft E. coli und Salmonellen.' },
  { icon: '👄', title: 'Warzen-Express', text: 'Durch Kauen verbreitest du HPV-Viren von deinen Fingern auf deine Lippen und dein Zahnfleisch.' },
  { icon: '🐛', title: 'Madenwürmer', text: 'Fingernägel sind das perfekte Versteck für Parasiteneier (wie Madenwürmer), die du beim Kauen direkt verschluckst.' },
  { icon: '🦷', title: 'Zahnschäden', text: 'Kauen verursacht winzige Risse im Zahnschmelz und kann deine Zähne mit der Zeit verschieben.' },
  { icon: '⚠️', title: 'Eitrige Entzündungen', text: 'Winzige Wunden am Nagelbett sind Einfallstore für Bakterien, die schmerzhafte, eitrige Infektionen auslösen.' },
  { icon: '🤢', title: 'Mundgeruch', text: 'Die Bakterien von deinen Fingern siedeln sich in deinem Mund an und können chronischen Mundgeruch verursachen.' }
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

window.startUrgeAction = function(id) {
  if (id === 'breathe') startBreathingExercise();
  else if (id === 'game') startBubbleGame();
  else if (id === 'water') {
    showWaterConfetti();
    showMotivationScreen();
  } else {
    showMotivationScreen();
  }
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
        <button class="urge-btn" style="width: 100%; justify-content: center;" onclick="startUrgeAction('${method.id}')">${method.action}</button>
        <button class="schock-btn" style="width: 100%;" onclick="window.showDisgustFact()">
          <span>⚠️</span> Schock-Therapie (Harte Tour)
        </button>
      </div>
    </div>

  `;
}

window.showDisgustFact = function() {
  const container = document.getElementById('randomMethodContainer');
  document.getElementById('newRandomBtn').style.display = 'flex'; // Keep the random button to go back to methods
  document.getElementById('newRandomBtn').innerText = 'Andere Hilfe suchen';

  const fact = DISGUST_FACTS[Math.floor(Math.random() * DISGUST_FACTS.length)];
  
  container.innerHTML = `
    <div class="disgust-card">
      <div class="disgust-icon">${fact.icon}</div>
      <div class="disgust-title">${fact.title}</div>
      <div class="disgust-text">${fact.text}</div>
      <button class="finish-btn" style="margin-top: 10px;" onclick="document.getElementById('urgeModal').classList.remove('active')">Drang ist weg!</button>
    </div>
  `;
};


/* --- Interactive Actions --- */
function startBreathingExercise() {
  const container = document.getElementById('randomMethodContainer');
  document.getElementById('newRandomBtn').style.display = 'none';
  
  container.innerHTML = `
    <div class="breathing-container">
      <div class="breath-circle" id="breathCircle">Bereit?</div>
      <div class="breath-instruction" id="breathLabel">Gleich geht's los...</div>
    </div>
  `;
  
  const circle = document.getElementById('breathCircle');
  const label = document.getElementById('breathLabel');
  let cycle = 0;
  let timerInterval;

  const updateCircle = (seconds, text, scale) => {
    label.innerText = text;
    circle.style.transform = `scale(${scale})`;
    circle.innerText = seconds + "s";
    
    let currentSec = seconds;
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
      currentSec--;
      if (currentSec > 0) {
        circle.innerText = currentSec + "s";
      } else {
        clearInterval(timerInterval);
      }
    }, 1000);
  };
  
  const runCycle = () => {
    if (cycle >= 3) {
      clearInterval(mainInterval);
      if (timerInterval) clearInterval(timerInterval);
      showMotivationScreen();
      return;
    }
    
    // Einatmen (4s)
    updateCircle(4, "Einatmen...", 1.5);
    
    setTimeout(() => {
      // Halten (4s)
      updateCircle(4, "Halten...", 1.5);
      
      setTimeout(() => {
        // Ausatmen (6s)
        updateCircle(6, "Ausatmen...", 1.0);
        
        cycle++;
        // Update urge count
        state.urgeCountSinceRelapse++;
        localStorage.setItem('urgeCountSinceRelapse', state.urgeCountSinceRelapse);
        checkAchievements();
      }, 4000);
    }, 4000);
  };
  
  runCycle();
  const mainInterval = setInterval(runCycle, 14000);
}

function startBubbleGame() {
  const container = document.getElementById('randomMethodContainer');
  document.getElementById('newRandomBtn').style.display = 'none';
  
  container.innerHTML = `
    <div class="bubble-game-view">
      <h3 style="margin-bottom: 5px;">Blasen zerplatzen!</h3>
      <div style="font-size: 14px; color: var(--color-text-dim); margin-bottom: 10px;">Beschäftige deine Finger für 10 Sekunden.</div>
      <div class="pop-counter" style="position: static; text-align: center; font-size: 24px; color: var(--color-primary); margin-bottom: 10px;">
        <span id="gameTimer">10</span>s
      </div>
      <div class="bubble-game-container" id="bubbleGameArea" style="height: 250px;"></div>
    </div>
  `;
  
  const area = document.getElementById('bubbleGameArea');
  const timerEl = document.getElementById('gameTimer');
  let timeLeft = 10;
  let gameActive = true;
  
  const spawnBubble = () => {
    if (!gameActive) return;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.left = Math.random() * 85 + 5 + '%';
    bubble.style.top = Math.random() * 85 + 5 + '%';
    
    bubble.addEventListener('click', () => {
      if (!bubble.classList.contains('popped')) {
        bubble.classList.add('popped');
        setTimeout(() => bubble.remove(), 200);
      }
    });
    
    area.appendChild(bubble);
    
    // Remove if not popped after 3s
    setTimeout(() => {
      if (bubble.parentNode === area) {
        bubble.style.opacity = '0';
        setTimeout(() => bubble.remove(), 200);
      }
    }, 3000);
  };
  
  // Initial bubbles
  for (let i = 0; i < 5; i++) spawnBubble();
  
  // Continuous spawning
  const spawnInterval = setInterval(spawnBubble, 600);
  
  const countdown = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;
    
    if (timeLeft <= 0) {
      gameActive = false;
      clearInterval(countdown);
      clearInterval(spawnInterval);
      localStorage.setItem('playedBubbleGame', 'true');
      checkAchievements();
      showMotivationScreen();
    }
  }, 1000);
}

function showWaterConfetti() {
  for (let i = 0; i < 15; i++) {
    const drop = document.createElement('div');
    drop.className = 'water-drop';
    drop.innerText = '💧';
    drop.style.left = Math.random() * 100 + '%';
    document.body.appendChild(drop);
    setTimeout(() => drop.remove(), 1000);
  }
}

/* --- Comparison Logic --- */
window.showComparison = function() {
  if (state.photos.length < 2) return;
  
  const first = state.photos[0];
  const last = state.photos[state.photos.length - 1];
  const diffDays = last.day - first.day;
  
  document.getElementById('comparisonSubtitle').innerText = `Fortschritt über ${diffDays} Tage`;
  
  const container = document.getElementById('comparisonImages');
  container.innerHTML = `
    <div class="comparison-image-wrapper">
      <img src="${first.url}">
      <div class="comparison-tag">Vorher (Tag ${first.day})</div>
    </div>
    <div class="comparison-image-wrapper">
      <img src="${last.url}">
      <div class="comparison-tag">Nachher (Tag ${last.day})</div>
    </div>
  `;
  
  document.getElementById('comparisonModal').classList.add('active');
};

window.shareComparison = function() {
  if (navigator.share) {
    navigator.share({
      title: 'Mein Nobite Fortschritt',
      text: `Ich habe in ${state.photos[state.photos.length-1].day - state.photos[0].day} Tagen riesige Fortschritte gemacht! 🌿 #Nobite`,
      url: window.location.href
    }).catch(err => console.log('Error sharing', err));
  } else {
    alert("Mach einen Screenshot von deinem Vergleich, um ihn mit Freunden zu teilen! ✨");
  }
};

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
    checkAchievements();
    renderContent();
  };
  reader.readAsDataURL(file);
}

/* --- Goal & Reward Logic --- */
function renderGoalCard() {
  if (!state.targetReward || state.targetDays === 0) {
    return `
      <div class="goal-card">
        <div class="goal-card-title">🏆 Setze dir eine Belohnung!</div>
        <div class="goal-input-group">
          <input type="text" id="goalRewardInput" class="goal-input" placeholder="Was möchtest du dir gönnen? (z.B. Eis)">
          <input type="number" id="goalDaysInput" class="goal-input" placeholder="Nach wie vielen Tagen?" min="1">
        </div>
        <button class="finish-btn" onclick="saveGoal()">Ziel setzen</button>
      </div>
    `;
  }

  if (state.streakDays >= state.targetDays) {
    return `
      <div class="goal-card goal-success">
        <div class="goal-success-icon">🎉</div>
        <div class="goal-success-text">Ziel erreicht!</div>
        <div class="goal-success-subtext">Hol dir deine Belohnung: <b>${state.targetReward}</b></div>
        <button class="finish-btn" onclick="resetGoal()">Neues Ziel setzen</button>
      </div>
    `;
  }

  const progressPercent = Math.min((state.streakDays / state.targetDays) * 100, 100);
  return `
    <div class="goal-card">
      <div class="goal-card-title">🏆 Dein Ziel</div>
      <div class="goal-reward-text">${state.targetReward}</div>
      <div class="goal-progress-container">
        <div class="goal-progress-bar-bg">
          <div class="goal-progress-bar-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="goal-progress-text">${state.streakDays} / ${state.targetDays} Tagen geschafft</div>
      </div>
    </div>
  `;
}

window.saveGoal = function() {
  const rewardInput = document.getElementById('goalRewardInput').value.trim();
  const daysInput = parseInt(document.getElementById('goalDaysInput').value);

  if (rewardInput && daysInput > 0) {
    state.targetReward = rewardInput;
    state.targetDays = daysInput;
    localStorage.setItem('targetReward', rewardInput);
    localStorage.setItem('targetDays', daysInput);
    
    // Check immediately if goal is somehow already reached
    if (state.streakDays >= state.targetDays) {
      showConfetti();
    }
    
    renderApp();
  } else {
    alert("Bitte gib eine Belohnung und eine gültige Tagesanzahl ein.");
  }
};

window.resetGoal = function() {
  state.targetReward = null;
  state.targetDays = 0;
  localStorage.removeItem('targetReward');
  localStorage.removeItem('targetDays');
  renderApp();
};

window.showMoodPicker = function() {
  document.getElementById('moodModal').classList.add('active');
};

let selectedRelapseMood = 3;
window.selectRelapseMood = function(level, btn) {
  selectedRelapseMood = level;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.submitRelapse = function() {
  const triggers = Array.from(document.querySelectorAll('input[name="relapseTrigger"]:checked')).map(cb => cb.value);
  handleRelapse(selectedRelapseMood, triggers);
};

window.handleRelapse = function(moodLevel, triggers = []) {
  document.getElementById('moodModal').classList.remove('active');
  
  state.streakDays = 0;
  state.streakHours = 0;
  state.lastBite = new Date().toISOString();
  state.urgeCountSinceRelapse = 0;
  
  const relapse = {
    timestamp: new Date().toISOString(),
    mood: moodLevel,
    triggers: triggers
  };
  state.relapseLog.push(relapse);
  
  localStorage.setItem('lastBite', state.lastBite);
  localStorage.setItem('relapseLog', JSON.stringify(state.relapseLog));
  localStorage.setItem('urgeCountSinceRelapse', '0');
  
  saveUserData();
  calculateStreak();
  checkAchievements();
  renderApp();
};




/* --- Achievements Logic --- */
function checkAchievements() {
  let newlyUnlocked = [];
  BADGES.forEach(badge => {
    if (!state.unlockedBadges.includes(badge.id) && badge.criteria(state)) {
      state.unlockedBadges.push(badge.id);
      newlyUnlocked.push(badge);
    }
  });
  
  if (newlyUnlocked.length > 0) {
    localStorage.setItem('unlockedBadges', JSON.stringify(state.unlockedBadges));
    newlyUnlocked.forEach(badge => showAchievementPopup(badge));
    renderApp();
  }
}

function showAchievementPopup(badge) {
  const popup = document.createElement('div');
  popup.className = 'achievement-popup';
  popup.innerHTML = `
    <div class="achievement-card pulse">
      <div class="achievement-icon">${badge.icon}</div>
      <div class="achievement-title">Erfolg freigeschaltet!</div>
      <div class="achievement-name">${badge.title}</div>
      <div class="achievement-desc">${badge.desc}</div>
      <button class="finish-btn" onclick="this.parentElement.parentElement.remove()">Super!</button>
    </div>
  `;
  document.body.appendChild(popup);
  showConfetti();
}

function renderAchievementsView() {
  const unlockedCount = state.unlockedBadges.length;
  const totalCount = BADGES.length;
  
  return `
    <div class="achievements-container">
      <h2 class="tips-title">Deine Erfolge 🏆</h2>
      <p class="tips-subtitle">${unlockedCount} von ${totalCount} Medaillen gesammelt.</p>
      
      <div class="badge-grid">
        ${BADGES.map(badge => {
          const isUnlocked = state.unlockedBadges.includes(badge.id);
          return `
            <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}">
              <div class="badge-icon">${badge.icon}</div>
              <div class="badge-label">${badge.title}</div>
              <div style="font-size: 9px; margin-top: 4px; color: var(--color-text-dim); line-height: 1.2;">
                ${isUnlocked ? 'Freigeschaltet!' : badge.desc}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      ${unlockedCount === totalCount ? `
        <div class="goal-card goal-success" style="margin-top: 20px;">
          <div class="goal-success-text">Wahnsinn!</div>
          <div class="goal-success-subtext">Du hast alle Erfolge freigeschaltet. Du bist ein echter Profi!</div>
        </div>
      ` : ''}
    </div>
  `;
}

/* --- Profile & Auth Logic --- */
function renderProfileView() {
  if (!state.user) {
    return `
      <div class="profile-container">
        <div class="auth-card">
          <h2 style="margin-bottom: 10px;">Willkommen bei Nobite! 🌿</h2>
          <p style="font-size: 14px; color: var(--color-text-dim); margin-bottom: 24px;">Erstelle ein Konto, um deine Fortschritte zu sichern und Premium-Features freizuschalten.</p>
          
          <div class="auth-tabs" style="display: flex; gap: 8px; margin-bottom: 20px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 12px;">
            <button class="auth-tab-btn active" id="loginTabBtn" onclick="window.showAuthForm('login')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: transparent; color: white; cursor: pointer; transition: 0.3s;">Login</button>
            <button class="auth-tab-btn" id="registerTabBtn" onclick="window.showAuthForm('register')" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: transparent; color: var(--color-text-dim); cursor: pointer; transition: 0.3s;">Registrieren</button>
          </div>
          
          <div id="authFormContainer">
            ${renderLoginForm()}
          </div>
        </div>
        
        <div class="premium-teaser" style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05)); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 20px;">
          <h3 style="color: #fbbf24; margin-bottom: 10px;">💎 Warum Premium?</h3>
          <ul style="text-align: left; margin: 10px 0; font-size: 13px; color: var(--color-text-dim); list-style: none; padding: 0;">
            <li style="margin-bottom: 6px;">✨ Exklusive Nail Pal Accessoires</li>
            <li style="margin-bottom: 6px;">📊 Erweiterte Rückfall-Analysen</li>
            <li style="margin-bottom: 6px;">☁️ Cloud-Backup deiner Daten</li>
            <li>💖 Unterstütze die Weiterentwicklung</li>
          </ul>
        </div>
      </div>
    `;
  }

  return `
    <div class="profile-container">
      <div class="user-header" style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding: 20px; background: var(--color-surface); border-radius: 24px; border: 1px solid var(--glass-border);">
        <div class="user-avatar" onclick="window.openAvatarModal()" style="font-size: 40px; background: rgba(255,255,255,0.1); width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer; position: relative;">
          ${state.userAvatar}
          <div style="position: absolute; bottom: 0; right: 0; background: var(--color-primary); font-size: 10px; padding: 4px; border-radius: 50%;">✏️</div>
        </div>
        <div class="user-info" style="text-align: left;">
          <div class="user-email" style="font-weight: bold; font-size: 18px;">${state.user.email}</div>
          <div class="user-status" style="font-size: 12px; margin-top: 4px; color: ${state.isPremium ? '#fbbf24' : 'var(--color-text-dim)'}; font-weight: bold;">
            ${state.isPremium ? '💎 Premium Mitglied' : 'Kostenloser Account'}
          </div>
        </div>
      </div>

      <!-- Avatar Modal -->
      <div class="modal-overlay" id="avatarModal">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Wähle dein Profilbild</h3>
            <button class="close-btn" onclick="document.getElementById('avatarModal').classList.remove('active')">&times;</button>
          </div>
          <div class="avatar-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px;">
            ${['👤', '🦊', '🐱', '🐶', '🦄', '🦁', '🐼', '🐨', '🐸', '💅', '🪴', '✨', '🍀', '🍎', '🍓', '🥑'].map(icon => `
              <div onclick="window.setUserAvatar('${icon}')" style="font-size: 32px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 15px; cursor: pointer; text-align: center; border: 2px solid ${state.userAvatar === icon ? 'var(--color-primary)' : 'transparent'};">
                ${icon}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      ${!state.isPremium ? `
        <div class="premium-card" style="padding: 24px; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; border-radius: 24px; text-align: left; margin-bottom: 24px;">
          <h3 style="margin-bottom: 8px;">Hol dir Nobite Premium! 💎</h3>
          <p style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">Schalte alle Accessoires und Analysen frei und unterstütze uns.</p>
          <button class="finish-btn" style="width: 100%; background: #000; color: #fff; border: none;" onclick="window.upgradeToPremium()">Jetzt upgraden</button>
        </div>
      ` : ''}

        <div class="settings-item" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
          <div style="font-weight: bold; font-size: 14px;">🎭 Avatar wählen</div>
          <div style="display: flex; gap: 12px; width: 100%;">
            <button onclick="window.setAvatar('plant')" style="flex: 1; padding: 12px; border-radius: 12px; border: 2px solid ${state.activeAvatar === 'plant' ? 'var(--color-primary)' : 'transparent'}; background: rgba(255,255,255,0.05); color: white;">🪴 Pflanze</button>
            <button onclick="window.setAvatar('nail')" style="flex: 1; padding: 12px; border-radius: 12px; border: 2px solid ${state.activeAvatar === 'nail' ? 'var(--color-primary)' : 'transparent'}; background: rgba(255,255,255,0.05); color: white;">💅 Nägel</button>
          </div>
        </div>

        <div class="settings-item" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
          <div style="font-weight: bold; font-size: 14px;">🎨 App-Design ${!state.isPremium ? '💎' : ''}</div>
          <div class="theme-selector" style="display: flex; gap: 8px; width: 100%;">
            ${['default', 'ocean', 'sunset', 'forest'].map(t => `
              <div onclick="${state.isPremium ? `setTheme('${t}')` : `switchView('profile')`}" 
                   style="flex: 1; height: 32px; border-radius: 8px; cursor: pointer; border: 2px solid ${state.theme === t ? 'white' : 'transparent'}; 
                          background: ${t === 'default' ? '#10b981' : t === 'ocean' ? '#0ea5e9' : t === 'sunset' ? '#f43f5e' : '#65a30d'}">
              </div>
            `).join('')}
          </div>
          ${!state.isPremium ? '<div style="font-size: 10px; color: #fbbf24;">Nur für Premium-Mitglieder</div>' : ''}
        </div>

        <div class="settings-item" onclick="switchView('tips')" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
          <span>💡 Tipps & Tricks</span>
          <span style="opacity: 0.5;">➜</span>
        </div>

        <div class="settings-item" onclick="window.requestNotificationPermission()" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
          <span>🔔 Benachrichtigungen aktivieren</span>
          <span style="opacity: 0.5;">➜</span>
        </div>

        <div id="testNotifyBtn" class="settings-item" onclick="window.testNotification()" style="padding: 16px; background: rgba(16, 185, 129, 0.05); border: 1px dashed var(--color-primary); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-top: 8px;">
          <div style="text-align: left;">
            <div style="font-weight: bold; font-size: 14px; color: var(--color-primary);">🧪 Test-Benachrichtigung</div>
            <div style="font-size: 10px; color: var(--color-text-dim);">Sofort prüfen, ob Push funktioniert</div>
          </div>
          <span style="font-size: 18px;">📲</span>
        </div>

        <div class="leaderboard-section" style="margin-top: 20px; text-align: left;">
          <h3 style="font-size: 16px; margin-bottom: 12px;">🌍 Community Leaderboard</h3>
          <div style="background: var(--color-surface); border-radius: 20px; overflow: hidden; border: 1px solid var(--glass-border);">
            ${[
              { name: 'NailNinja', streak: '42 Tage', icon: '🏆' },
              { name: 'StopBiting99', streak: '18 Tage', icon: '🥈' },
              { name: 'Du (Gast)', streak: state.streakDays + ' Tage', icon: '🥉', current: true },
              { name: 'PeaceLover', streak: '5 Tage', icon: '🌱' }
            ].map(user => `
              <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background: ${user.current ? 'rgba(16, 185, 129, 0.1)' : 'transparent'}; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 18px;">${user.icon}</span>
                  <span style="${user.current ? 'font-weight: bold; color: var(--color-primary);' : ''}">${user.name}</span>
                </div>
                <div style="font-size: 13px; color: var(--color-text-dim);">${user.streak}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="settings-item" onclick="window.rateApp()" style="padding: 16px; background: linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03)); border: 1px solid rgba(251,191,36,0.15); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-top: 8px;">
          <div>
            <div style="font-weight: bold; font-size: 14px;">⭐ App bewerten</div>
            <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 2px;">Hilf uns zu wachsen!</div>
          </div>
          <span style="font-size: 20px;">🌟</span>
        </div>

        <div class="settings-item" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; margin-top: 20px;">
          <div style="font-weight: bold; font-size: 14px;">⚖️ Rechtliches</div>
          <div style="display: flex; gap: 12px; width: 100%;">
            <button onclick="window.openLegal('impressum')" style="flex: 1; padding: 12px; border-radius: 12px; border: none; background: rgba(255,255,255,0.05); color: var(--color-text-dim); font-size: 11px; cursor: pointer;">Impressum</button>
            <button onclick="window.openLegal('privacy')" style="flex: 1; padding: 12px; border-radius: 12px; border: none; background: rgba(255,255,255,0.05); color: var(--color-text-dim); font-size: 11px; cursor: pointer;">Datenschutz</button>
          </div>
        </div>

        <div class="settings-item" onclick="window.handleLogout()" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-top: 12px;">
          <span style="color: #ef4444;">Abmelden</span>
          <span style="color: #ef4444; opacity: 0.5;">➜</span>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; text-align: center;">
          <button onclick="window.handleDeleteAccount()" style="background: none; border: none; color: #ef4444; font-size: 11px; text-decoration: underline; cursor: pointer; opacity: 0.6;">
            Konto und alle Daten dauerhaft löschen
          </button>
        </div>
      </div>
    </div>
  `;
}

window.openLegal = function(type) {
  state.legalType = type;
  state.currentView = 'legal';
  renderApp();
};

window.rateApp = function() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  // Replace these with your real App Store / Play Store links once published!
  const APP_STORE_URL = 'https://apps.apple.com/app/idYOUR_APP_ID'; // TODO: deine Apple ID einsetzen
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME'; // TODO: dein Package Name

  if (isIOS) {
    window.open(APP_STORE_URL, '_blank');
  } else if (isAndroid) {
    window.open(PLAY_STORE_URL, '_blank');
  } else {
    // Desktop / Browser: zeige beide Optionen
    const choice = confirm('Möchtest du uns im App Store bewerten?\n\nOK = App Store (iOS)\nAbbrechen = Play Store (Android)');
    window.open(choice ? APP_STORE_URL : PLAY_STORE_URL, '_blank');
  }
};

function renderLegalView(type) {
  const isImpressum = type === 'impressum';
  
  return `
    <div class="legal-container" style="padding: 20px; text-align: left; line-height: 1.6;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
        <button onclick="window.switchView('profile')" style="background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px 12px; border-radius: 12px; cursor: pointer;">←</button>
        <h2 style="margin: 0; font-size: 20px;">${isImpressum ? 'Impressum' : 'Datenschutz'}</h2>
      </div>

      <div style="background: var(--color-surface); padding: 20px; border-radius: 20px; border: 1px solid var(--glass-border); font-size: 13px; color: var(--color-text-dim);">
        ${isImpressum ? `
          <h3 style="color: white; margin-top: 0; font-size: 16px;">Angaben gemäß § 5 TMG</h3>
          <p>[Dein Vorname Nachname]<br>
          [Deine Straße Hausnummer]<br>
          [PLZ Ort]</p>

          <h3 style="color: white; font-size: 16px;">Kontakt</h3>
          <p>Telefon: [Deine Telefonnummer]<br>
          E-Mail: [Deine E-Mail-Adresse]</p>

          <h3 style="color: white; font-size: 16px;">Verantwortlich für den Inhalt</h3>
          <p>[Dein Vorname Nachname]<br>
          [Deine Straße Hausnummer]<br>
          [PLZ Ort]</p>
        ` : `
          <h3 style="color: white; margin-top: 0; font-size: 16px;">1. Datenschutz auf einen Blick</h3>
          <p>Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Diese App speichert Daten (Fortschritt, Fotos, Stimmung) lokal auf Ihrem Gerät oder in Ihrem persönlichen Account.</p>
          
          <h3 style="color: white; font-size: 16px;">2. Datenerfassung</h3>
          <p>Die Datenverarbeitung erfolgt durch den App-Betreiber. Ihre Daten werden zur Bereitstellung der Funktionen (Tracker, Analyse) genutzt.</p>
          
          <h3 style="color: white; font-size: 16px;">3. Ihre Rechte</h3>
          <p>Sie haben jederzeit das Recht auf Auskunft, Berichtigung oder Löschung Ihrer Daten.</p>
          
          <h3 style="color: white; font-size: 16px;">4. Analyse-Tools</h3>
          <p>Diese App nutzt lokale Algorithmen zur Analyse Ihrer Rückfälle. Es erfolgt keine Weitergabe an Dritte zu Werbezwecken.</p>
        `}
        
        <p style="margin-top: 30px; font-style: italic; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
          Hinweis: Dies ist eine Vorlage. Bitte ersetzen Sie die Platzhalter durch Ihre echten Daten.
        </p>
      </div>
    </div>
  `;
}

window.showAuthForm = function(type) {
  const container = document.getElementById('authFormContainer');
  const loginBtn = document.getElementById('loginTabBtn');
  const registerBtn = document.getElementById('registerTabBtn');
  
  if (type === 'login') {
    container.innerHTML = renderLoginForm();
    loginBtn.style.background = 'rgba(255,255,255,0.1)';
    loginBtn.style.color = 'white';
    registerBtn.style.background = 'transparent';
    registerBtn.style.color = 'var(--color-text-dim)';
  } else {
    container.innerHTML = renderRegisterForm();
    registerBtn.style.background = 'rgba(255,255,255,0.1)';
    registerBtn.style.color = 'white';
    loginBtn.style.background = 'transparent';
    loginBtn.style.color = 'var(--color-text-dim)';
  }
};

function renderLoginForm() {
  setTimeout(() => {
    const btn = document.getElementById('loginSubmitBtn');
    if (btn) {
      btn.onclick = () => window.handleLogin();
    }
  }, 100);

  return `
    <div class="auth-form" style="display: flex; flex-direction: column; gap: 12px;">
      <input type="email" id="loginEmail" placeholder="E-Mail" class="goal-input" style="width: 100%;">
      <input type="password" id="loginPass" placeholder="Passwort" class="goal-input" style="width: 100%;">
      <button id="loginSubmitBtn" class="finish-btn" style="width: 100%; margin-top: 8px; position: relative; z-index: 999;">Einloggen</button>
    </div>
  `;
}

function renderRegisterForm() {
  return `
    <div class="auth-form" style="display: flex; flex-direction: column; gap: 12px;">
      <input type="email" id="regEmail" placeholder="E-Mail" class="goal-input" style="width: 100%;">
      <input type="password" id="regPass" placeholder="Passwort" class="goal-input" style="width: 100%;">
      <button class="finish-btn" style="width: 100%; margin-top: 8px;" onclick="window.handleRegister()">Konto erstellen</button>
    </div>
  `;
}

window.handleLogin = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;

  if (!email || !password) {
    alert("Bitte gib E-Mail und Passwort ein.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("Login fehlgeschlagen: " + error.message);
  } else {
    console.log("Eingeloggt:", data.user);
    renderApp();
  }
};

window.handleRegister = async function() {
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;

  if (!email || !password) {
    alert("Bitte gib E-Mail und Passwort ein.");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    alert("Registrierung fehlgeschlagen: " + error.message);
  } else {
    alert("Erfolg! Bitte überprüfe deine E-Mails, um dein Konto zu bestätigen.");
    console.log("Registriert:", data.user);
  }
};

window.handleLogout = async function() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert("Logout fehlgeschlagen: " + error.message);
  } else {
    state.user = null;
    localStorage.removeItem('user');
    renderApp();
  }
};

window.handleDeleteAccount = async function() {
  if (confirm("Möchtest du dein Konto und ALLE deine Daten wirklich unwiderruflich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.")) {
    try {
      // 1. Daten in der profiles-Tabelle löschen
      const { error: dbError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', state.user.id);
        
      if (dbError) throw dbError;

      // Hinweis: In der Client-SDK kann man den Auth-User nicht direkt löschen.
      // Wir loggen den User aus und löschen alle lokalen Daten.
      await supabase.auth.signOut();
      
      localStorage.clear();
      state.user = null;
      
      alert("Dein Konto und deine Daten wurden erfolgreich gelöscht.");
      window.location.reload();
    } catch (error) {
      alert("Fehler beim Löschen des Kontos: " + error.message);
    }
  }
};

window.upgradeToPremium = function() {
  if (confirm("Möchtest du für 4,99€ auf Premium upgraden? (Simulation)")) {
    state.isPremium = true;
    localStorage.setItem('isPremium', 'true');
    saveUserData(); // Sync mit Backend
    applyTheme();
    renderApp();
    showConfetti();
  }
};

window.recordDailyMood = function(moodLevel) {
  const today = new Date().toLocaleDateString();
  const existingIndex = state.moodHistory.findIndex(m => m.date === today);
  
  const entry = { date: today, mood: moodLevel };
  
  if (existingIndex > -1) {
    state.moodHistory[existingIndex] = entry;
  } else {
    state.moodHistory.push(entry);
  }
  
  // Keep only last 14 days
  if (state.moodHistory.length > 14) {
    state.moodHistory.shift();
  }
  
  localStorage.setItem('moodHistory', JSON.stringify(state.moodHistory));
  saveUserData();
  renderApp();
};

window.setTheme = function(t) {
  state.theme = t;
  localStorage.setItem('theme', t);
  saveUserData();
  applyTheme();
  renderApp();
};

window.setAvatar = function(a) {
  state.activeAvatar = a;
  localStorage.setItem('activeAvatar', a);
  saveUserData();
  renderApp();
};

window.openAvatarModal = function() {
  document.getElementById('avatarModal').classList.add('active');
};

window.setUserAvatar = function(icon) {
  state.userAvatar = icon;
  localStorage.setItem('userAvatar', icon);
  saveUserData();
  document.getElementById('avatarModal').classList.remove('active');
  renderApp();
};

function showConfetti() {
  const emojis = ['🎉', '✨', '🏆', '💎', '🌸'];
  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's'; // 2-4s
    confetti.style.fontSize = (Math.random() * 16 + 16) + 'px'; // 16-32px
    
    document.body.appendChild(confetti);
    
    // Clean up
    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
}

/* --- Lightbox Logic --- */
window.takeNativePhoto = async function() {
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
  
  if (isNative) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl
      });

      const photo = {
        id: Date.now(),
        url: image.dataUrl,
        date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      };

      state.photos.unshift(photo);
      localStorage.setItem('photos', JSON.stringify(state.photos));
      renderApp();
    } catch (err) {
      console.error('Kamera-Fehler:', err);
    }
  } else {
    document.getElementById('photoInput').click();
  }
};

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
calculateStreak();
checkAchievements();
applyTheme();
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

window.testNotification = function() {
  if (!window.Notification || Notification.permission !== "granted") {
    alert("Bitte aktiviere zuerst die Benachrichtigungen.");
    return;
  }
  sendNotification("Test Bestanden! ✅", "Deine Nobite-Benachrichtigungen funktionieren einwandfrei.");
};

window.subscribeToPush = async function() {
  if (!('serviceWorker' in navigator)) {
    console.error('Service Worker nicht unterstützt');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Echter VAPID Public Key für Apple/Google
    const VAPID_PUBLIC_KEY = 'BFtg423bs2IH-MAqzS42AAndmvqqkJL31kgPSP2-yqQdkLCmgzhwN0NgpaKXwnoTTiLXVqySXJ3W13Fpc461MiI'; 
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
    });

    console.log('Push-Abo erfolgreich:', subscription);

    if (state.user) {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: state.user.id,
          subscription: subscription
        });
      if (error) {
        console.error('Fehler beim Speichern in Supabase:', error);
        alert("Fehler beim Speichern der Benachrichtigungs-Daten.");
      } else {
        alert("Super! Benachrichtigungen sind jetzt für dieses Gerät aktiv. ✅");
      }
    }
  } catch (err) {
    console.error('Push-Abo fehlgeschlagen:', err);
    if (window.Notification && Notification.permission === 'denied') {
      alert("Benachrichtigungen wurden blockiert. Bitte aktiviere sie in den iPhone-Einstellungen für diese App.");
    } else {
      alert("Technischer Fehler beim Aktivieren: " + err.message);
    }
  }
};
