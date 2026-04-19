// ═══════════════════════════════════════════════════════
//  PROFILE MODULE — Avatar, username, local storage
// ═══════════════════════════════════════════════════════

const Profile = (() => {
  const STORAGE_KEY = 'truco_profile';

  let data = {
    id: generateId(),
    name: '',
    avatar: '🤠',
    avatarType: 'emoji', // 'emoji' | 'image'
    avatarData: null,    // base64 for image uploads
  };

  function generateId() {
    return 'p_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        data = { ...data, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load profile:', e);
    }
    apply();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const el = document.getElementById('profile-saved');
    if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
  }

  function apply() {
    const nameInput = document.getElementById('username-input');
    if (nameInput && data.name) nameInput.value = data.name;
    updateAvatarDisplay();
  }

  function updateAvatarDisplay() {
    const img = document.getElementById('avatar-img');
    const placeholder = document.getElementById('avatar-placeholder');
    if (!img || !placeholder) return;

    if (data.avatarType === 'image' && data.avatarData) {
      img.src = data.avatarData;
      img.style.display = '';
      placeholder.style.display = 'none';
    } else {
      placeholder.textContent = data.avatar;
      img.style.display = 'none';
      placeholder.style.display = '';
    }
  }

  function initUI() {
    // File upload
    document.getElementById('avatar-upload')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        data.avatarType = 'image';
        data.avatarData = ev.target.result;
        updateAvatarDisplay();
      };
      reader.readAsDataURL(file);
    });

    // Emoji picks
    document.querySelectorAll('.emoji-pick').forEach(el => {
      el.addEventListener('click', () => {
        data.avatarType = 'emoji';
        data.avatar = el.dataset.emoji;
        data.avatarData = null;
        updateAvatarDisplay();
      });
    });

    // Save profile
    document.getElementById('save-profile-btn')?.addEventListener('click', () => {
      const nameInput = document.getElementById('username-input');
      const name = nameInput?.value.trim();
      if (!name) { Toast.show('Digite um nome de usuário!', 'error'); return; }
      data.name = name;
      save();
      Toast.show('Perfil salvo!', 'success');
    });

    load();
  }

  function get() { return { ...data }; }

  function getAvatarHTML(size = 30) {
    if (data.avatarType === 'image' && data.avatarData) {
      return `<img src="${data.avatarData}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover" />`;
    }
    return `<span style="font-size:${size * 0.6}px">${data.avatar}</span>`;
  }

  function getForPlayer() {
    return {
      id: data.id,
      name: data.name || 'Jogador',
      avatarType: data.avatarType,
      avatar: data.avatar,
      avatarData: data.avatarData,
    };
  }

  return { load, save, initUI, get, getAvatarHTML, getForPlayer };
})();
