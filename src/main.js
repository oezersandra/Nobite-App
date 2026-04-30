import './style.css'

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
  theme: localStorage.getItem('theme') || 'default'
};

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
        <!-- Image and info injected here -->
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
          ${renderGoalCard()}
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
          <div class="mood-selector" style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 24px;">
            <button class="mood-btn" onclick="handleRelapse(1)">😌<br><span style="font-size: 10px;">Ruhig</span></button>
            <button class="mood-btn" onclick="handleRelapse(2)">😐<br><span style="font-size: 10px;">Ok</span></button>
            <button class="mood-btn" onclick="handleRelapse(3)">😟<br><span style="font-size: 10px;">Angst</span></button>
            <button class="mood-btn" onclick="handleRelapse(4)">😫<br><span style="font-size: 10px;">Stress</span></button>
            <button class="mood-btn" onclick="handleRelapse(5)">😡<br><span style="font-size: 10px;">Wut</span></button>
          </div>
          <button class="close-btn" style="position: static; width: 100%; font-size: 14px;" onclick="document.getElementById('moodModal').classList.remove('active')">Abbrechen</button>
        </div>
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
    container.innerHTML = renderNailPalView();
  } else if (state.currentView === 'achievements') {
    container.innerHTML = renderAchievementsView();
  } else if (state.currentView === 'profile') {
    container.innerHTML = renderProfileView();
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
      <h2 class="tips-title">Hilfreiche Tipps & Tricks</h2>
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
  const pal = getPalState();
  const today = new Date().toLocaleDateString('de-DE');
  const canWater = state.lastWatered !== today;
  
  let accessoryHTML = '';
  if (state.activeAccessory) {
    const item = SHOP_ITEMS.find(i => i.id === state.activeAccessory);
    if (item) accessoryHTML = `<div class="pal-accessory">${item.icon}</div>`;
  }

  let quote = pal.quote;
  if (canWater) {
    quote = "Ich habe Durst... 💧";
  }

  return `
    <div class="nail-pal-container">
      <div class="pal-header">
        <div class="pal-drops">💧 ${state.palDrops} Tropfen</div>
      </div>
      
      <div class="pal-character-wrapper" onclick="interactWithPal(this)">
        <div class="pal-character pulse">${pal.icon}</div>
        ${accessoryHTML}
      </div>
      
      <div class="message-bubble" id="palBubble">
        <div class="pal-status">${pal.status}</div>
        <div class="pal-quote">"${quote}"</div>
      </div>
      
      <button class="water-btn ${canWater ? '' : 'disabled'}" onclick="waterPal()" ${canWater ? '' : 'disabled'}>
        ${canWater ? '💦 Pflanze gießen (+10 Tropfen)' : '✅ Für heute gegossen!'}
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

window.waterPal = function() {
  const today = new Date().toLocaleDateString('de-DE');
  if (state.lastWatered !== today) {
    state.palDrops += 10;
    state.lastWatered = today;
    localStorage.setItem('palDrops', state.palDrops);
    localStorage.setItem('lastWatered', state.lastWatered);
    showFloatingHearts();
    checkAchievements();
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
    checkAchievements();
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
  if (state.relapseLog.length === 0) return null;
  
  const hourCounts = Array(24).fill(0);
  state.relapseLog.forEach(log => {
    const hour = new Date(log.timestamp).getHours();
    hourCounts[hour]++;
  });
  
  let maxHour = 0;
  let maxCount = 0;
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > maxCount) {
      maxCount = hourCounts[h];
      maxHour = h;
    }
  }
  
  let timeLabel = "";
  if (maxHour >= 5 && maxHour < 12) timeLabel = "Vormittag";
  else if (maxHour >= 12 && maxHour < 14) timeLabel = "Mittag";
  else if (maxHour >= 14 && maxHour < 18) timeLabel = "Nachmittag";
  else if (maxHour >= 18 && maxHour < 22) timeLabel = "Abend";
  else timeLabel = "Nacht";
  
  return { label: timeLabel, hour: maxHour, count: maxCount };
}

function renderTriggerCard() {
  const analysis = analyzeTriggers();
  if (!analysis || analysis.count < 1) return "";
  
  const avgMood = state.relapseLog.reduce((acc, log) => acc + (log.mood || 3), 0) / state.relapseLog.length;
  const moodTexts = ["Ruhig", "Entspannt", "Neutral", "Angespannt", "Sehr gestresst"];
  const moodDesc = moodTexts[Math.round(avgMood) - 1] || "Neutral";

  return `
    <div class="goal-card trigger-card">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-primary); font-weight: bold; margin-bottom: 8px;">
        KI-Analyse (Premium)
      </div>
      <div style="font-size: 14px; margin-bottom: 12px;">
        Deine kritischste Zeit ist gegen <b>${analysis.hour}:00 Uhr</b>.
      </div>
      <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px;">
        <div style="font-size: 24px;">🧠</div>
        <div style="text-align: left;">
          <div style="font-size: 11px; color: var(--color-text-dim);">Hauptauslöser (Stimmung)</div>
          <div style="font-size: 14px; font-weight: bold;">${moodDesc}</div>
        </div>
      </div>
    </div>
  `;
}

window.resetTriggers = function() {
  if (confirm("Möchtest du die Trigger-Analyse wirklich zurücksetzen? Deine bisherigen Rückfall-Daten werden gelöscht.")) {
    state.relapseLog = [];
    localStorage.setItem('relapseLog', JSON.stringify([]));
    renderApp();
  }
};

window.requestNotificationPermission = function() {
  if (!("Notification" in window)) {
    alert("Dein Browser unterstützt leider keine Benachrichtigungen. (Auf dem iPhone musst du die App zum Homescreen hinzufügen)");
    return;
  }
  
  if (Notification.permission === "denied") {
    alert("Du hast Benachrichtigungen für diese Seite blockiert. Bitte aktiviere sie in den Einstellungen deines Browsers/iPhones.");
    return;
  }

  if (Notification.permission === "granted") {
    alert("Benachrichtigungen sind bereits aktiviert! Du wirst gewarnt, sobald eine kritische Phase bevorsteht.");
    return;
  }
  
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      new Notification("Nobite", {
        body: "Super! Ich werde dich vor deinen kritischen Zeiten warnen.",
        icon: "/vite.svg"
      });
    } else {
      alert("Benachrichtigungen wurden nicht erlaubt.");
    }
  });
};

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

function checkTriggerNotifications() {
  const analysis = analyzeTriggers();
  if (!analysis || Notification.permission !== "granted") return;
  
  const currentHour = new Date().getHours();
  // Notify 1 hour before the critical hour
  if (currentHour === (analysis.hour - 1)) {
    const lastNotified = localStorage.getItem('lastTriggerNotify');
    const today = new Date().toLocaleDateString();
    
    if (lastNotified !== today) {
      new Notification("Achtung: Gefahrenzeit!", {
        body: `Deine kritische Zeit (${analysis.label}) beginnt bald. Sei wachsam! 🧘`,
        icon: "/vite.svg"
      });
      localStorage.setItem('lastTriggerNotify', today);
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
      </div>
    </div>
  `;
}

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

window.handleRelapse = function(moodLevel) {
  document.getElementById('moodModal').classList.remove('active');
  
  state.streakDays = 0;
  state.streakHours = 0;
  state.startTime = new Date().toISOString();
  state.urgeCountSinceRelapse = 0;
  
  const relapse = {
    timestamp: new Date().toISOString(),
    mood: moodLevel
  };
  state.relapseLog.push(relapse);
  
  localStorage.setItem('startTime', state.startTime);
  localStorage.setItem('relapseLog', JSON.stringify(state.relapseLog));
  localStorage.setItem('urgeCountSinceRelapse', '0');
  
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
        <div class="user-avatar" style="font-size: 40px; background: rgba(255,255,255,0.1); width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">👤</div>
        <div class="user-info" style="text-align: left;">
          <div class="user-email" style="font-weight: bold; font-size: 18px;">${state.user.email}</div>
          <div class="user-status" style="font-size: 12px; margin-top: 4px; color: ${state.isPremium ? '#fbbf24' : 'var(--color-text-dim)'}; font-weight: bold;">
            ${state.isPremium ? '💎 Premium Mitglied' : 'Kostenloser Account'}
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

      <div class="settings-list" style="display: flex; flex-direction: column; gap: 12px;">
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

        <div class="settings-item" onclick="window.logout()" style="padding: 16px; background: var(--color-surface); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-top: 12px;">
          <span style="color: #ef4444;">Abmelden</span>
          <span style="color: #ef4444; opacity: 0.5;">➜</span>
        </div>
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
  return `
    <div class="auth-form" style="display: flex; flex-direction: column; gap: 12px;">
      <input type="email" id="loginEmail" placeholder="E-Mail" class="goal-input" style="width: 100%;">
      <input type="password" id="loginPass" placeholder="Passwort" class="goal-input" style="width: 100%;">
      <button class="finish-btn" style="width: 100%; margin-top: 8px;" onclick="window.handleLogin()">Einloggen</button>
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

window.handleLogin = function() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  
  if (email && pass) {
    state.user = { email: email };
    localStorage.setItem('user', JSON.stringify(state.user));
    renderApp();
  } else {
    alert("Bitte fülle alle Felder aus.");
  }
};

window.handleRegister = function() {
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPass').value;
  
  if (email && pass) {
    state.user = { email: email };
    localStorage.setItem('user', JSON.stringify(state.user));
    renderApp();
  } else {
    alert("Bitte fülle alle Felder aus.");
  }
};

window.logout = function() {
  if (confirm("Möchtest du dich wirklich abmelden?")) {
    state.user = null;
    state.isPremium = false;
    localStorage.removeItem('user');
    localStorage.setItem('isPremium', 'false');
    renderApp();
  }
};

window.upgradeToPremium = function() {
  if (confirm("Möchtest du für 4,99€ auf Premium upgraden? (Simulation)")) {
    state.isPremium = true;
    localStorage.setItem('isPremium', 'true');
    applyTheme();
    renderApp();
    showConfetti();
  }
};

window.setTheme = function(t) {
  state.theme = t;
  localStorage.setItem('theme', t);
  applyTheme();
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
