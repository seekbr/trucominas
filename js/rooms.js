// ═══════════════════════════════════════════════════════
//  ROOMS MODULE — Create, list, join, leave rooms
// ═══════════════════════════════════════════════════════

const Rooms = (() => {
  let currentRoom = null;
  let roomRef = null;
  let roomListener = null;
  let chatListener = null;
  let mySlot = -1; // index in players array

  // ─── Room List ──────────────────────────────────────

  function listenToRoomsList() {
    const listEl = document.getElementById('rooms-list');
    db.ref('rooms').on('value', (snap) => {
      const rooms = snap.val() || {};
      renderRoomsList(rooms, listEl);
    });
  }

  function renderRoomsList(rooms, container) {
    const keys = Object.keys(rooms);
    if (!keys.length) {
      container.innerHTML = `<div class="rooms-empty">
        <div class="empty-icon">🃏</div>
        <p>Nenhuma sala encontrada</p>
        <span>Crie uma sala ou atualize a lista</span>
      </div>`;
      return;
    }

    container.innerHTML = '';
    keys.forEach(id => {
      const room = rooms[id];
      if (!room || room.deleted) return;
      const players = Object.values(room.players || {});
      const max = room.mode === 4 ? 4 : 2;
      const count = players.length;
      const status = room.status || 'waiting';

      let badge = '';
      if (status === 'playing') badge = `<span class="room-item-badge badge-playing">Jogando</span>`;
      else if (count >= max) badge = `<span class="room-item-badge badge-full">Lotada</span>`;
      else badge = `<span class="room-item-badge badge-waiting">${count}/${max}</span>`;

      const item = document.createElement('div');
      item.className = 'room-item';
      item.innerHTML = `
        <div class="room-item-info">
          <div class="room-item-name">${escHtml(room.name)}</div>
          <div class="room-item-meta">Criada por ${escHtml(room.hostName || '?')} • ${count}/${max} jogadores</div>
        </div>
        ${badge}
      `;
      if (status !== 'playing' && count < max) {
        item.addEventListener('click', () => joinRoom(id));
      }
      container.appendChild(item);
    });
  }

  // ─── Create Room ────────────────────────────────────

  function showCreateModal() {
    const profile = Profile.get();
    if (!profile.name) { Toast.show('Salve seu perfil antes!', 'error'); return; }

    const name = prompt('Nome da sala:', `Sala de ${profile.name}`);
    if (!name || !name.trim()) return;
    createRoom(name.trim());
  }

  async function createRoom(name) {
    const profile = Profile.getForPlayer();

    const ref = db.ref('rooms').push(); // 🔥 chave única do Firebase
    const roomId = ref.key;

    const room = {
      id: roomId,
      name,
      hostId: profile.id,
      hostName: profile.name,
      status: 'waiting',
      mode: 2,
      createdAt: Date.now(),
      players: {
        [profile.id]: { ...profile, slot: 0, ready: false }
      },
      chat: {},
      game: null,
    };

    await ref.set(room);

    mySlot = 0;
    enterRoom(roomId, room);
  }

  // ─── Join Room ──────────────────────────────────────

  async function joinRoom(roomId) {
    const profile = Profile.getForPlayer();
    if (!profile.name) { Toast.show('Salve seu perfil antes!', 'error'); return; }

    const snap = await db.ref(`rooms/${roomId}`).get();
    const room = snap.val();
    if (!room) { Toast.show('Sala não encontrada!', 'error'); return; }

    const players = room.players || {};
    const playerIds = Object.keys(players);

    // Already in room?
    if (players[profile.id]) {
      mySlot = players[profile.id].slot;
      enterRoom(roomId, room);
      return;
    }

    const max = room.mode === 4 ? 4 : 2;
    if (playerIds.length >= max) { Toast.show('Sala lotada!', 'error'); return; }
    if (room.status === 'playing') { Toast.show('Jogo já iniciado!', 'error'); return; }

    const slot = playerIds.length;
    await db.ref(`rooms/${roomId}/players/${profile.id}`).set({
      ...profile, slot, ready: false
    });
    mySlot = slot;
    const updatedSnap = await db.ref(`rooms/${roomId}`).get();
    enterRoom(roomId, updatedSnap.val());
  }

  // ─── Enter Room (set up listeners) ──────────────────

  function enterRoom(roomId, initialData) {
    currentRoom = roomId;

    // Detach old
    if (roomRef && roomListener) roomRef.off('value', roomListener);

    roomRef = db.ref(`rooms/${roomId}`);
    roomListener = roomRef.on('value', (snap) => {
      const room = snap.val();
      if (!room) { leaveRoom(); return; }
      currentRoomData = room;
      renderWaitingRoom(room);

      // Detect game start
      if (room.status === 'playing' && room.game) {
        Game.startFromRoom(room, mySlot);
      }
    });

    // Chat listener
    chatListener = db.ref(`rooms/${roomId}/chat`).on('value', (snap) => {
      renderChat(snap.val() || {});
    });

    // Show waiting screen
    Screen.show('waiting');
    document.getElementById('room-name-display').textContent = initialData.name;
    document.getElementById('room-code-display').textContent = roomId;
  }

  let currentRoomData = null;

  // ─── Render Waiting Room ─────────────────────────────

  function renderWaitingRoom(room) {
    const mode = room.mode || 2;
    const players = room.players || {};
    const playerList = Object.values(players).sort((a, b) => a.slot - b.slot);
    const myId = Profile.get().id;
    const isHost = room.hostId === myId;

    // Player grid
    const grid = document.getElementById('players-grid');
    grid.innerHTML = '';
    for (let i = 0; i < mode; i++) {
      const p = playerList[i];
      const div = document.createElement('div');
      div.className = `player-slot ${p ? 'filled' : 'empty'}`;

      if (p) {
        const teamLabel = mode === 4
          ? `<span class="slot-team ${i % 2 === 0 ? 'team-a' : 'team-b'}">${i % 2 === 0 ? 'Time A' : 'Time B'}</span>`
          : '';
        const hostBadge = p.id === room.hostId ? `<span class="slot-host-badge">👑 Host</span>` : '';
        const avatarHtml = p.avatarType === 'image' && p.avatarData
          ? `<img src="${p.avatarData}" style="width:100%;height:100%;object-fit:cover" />`
          : `<span style="font-size:1.4rem">${p.avatar || '🤠'}</span>`;
        div.innerHTML = `
          <div class="slot-avatar">${avatarHtml}</div>
          <div class="slot-name">${escHtml(p.name)}</div>
          ${hostBadge}${teamLabel}
        `;
      } else {
        div.innerHTML = `
          <div class="slot-avatar" style="opacity:0.3">👤</div>
          <div class="slot-empty-text">Aguardando...</div>
        `;
      }
      grid.appendChild(div);
    }

    // Mode selector (host only)
    const modeSelector = document.getElementById('mode-selector');
    modeSelector.style.display = isHost ? 'flex' : 'none';
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.mode) === mode);
    });

    // Status
    const needed = mode - playerList.length;
    const statusEl = document.getElementById('waiting-status');
    statusEl.textContent = needed > 0
      ? `Aguardando ${needed} jogador${needed > 1 ? 'es' : ''}...`
      : 'Todos os jogadores estão na sala! 🎉';

    // Start button (host only, enough players)
    const startBtn = document.getElementById('start-game-btn');
    startBtn.style.display = isHost ? '' : 'none';
    startBtn.disabled = playerList.length < mode;
    if (playerList.length >= mode) {
      startBtn.textContent = '▶ Iniciar Jogo!';
    } else {
      startBtn.textContent = `Aguardando jogadores (${playerList.length}/${mode})`;
    }
  }

  function renderChat(chatObj) {
    const msgs = Object.values(chatObj).sort((a, b) => a.ts - b.ts);
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    msgs.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-msg';
      div.innerHTML = `<span class="msg-user">${escHtml(m.user)}:</span> ${escHtml(m.text)}`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  function sendChat(text) {
    if (!text.trim() || !currentRoom) return;
    const profile = Profile.get();
    const msgId = Date.now().toString();
    db.ref(`rooms/${currentRoom}/chat/${msgId}`).set({
      user: profile.name || 'Jogador',
      text: text.trim().substring(0, 100),
      ts: Date.now()
    });
  }

  // ─── Leave Room ──────────────────────────────────────

  async function leaveRoom() {
    if (!currentRoom) return;
    const profile = Profile.get();
    await db.ref(`rooms/${currentRoom}/players/${profile.id}`).remove();

    // If host leaves, delete room
    const snap = await db.ref(`rooms/${currentRoom}`).get();
    const room = snap.val();
    if (room && room.hostId === profile.id) {
      await db.ref(`rooms/${currentRoom}`).remove();
    }

    if (roomRef && roomListener) roomRef.off('value', roomListener);
    if (chatListener) db.ref(`rooms/${currentRoom}/chat`).off('value', chatListener);

    currentRoom = null;
    currentRoomData = null;
    mySlot = -1;
    Screen.show('lobby');
  }

  // ─── Start Game (host) ───────────────────────────────

  async function hostStartGame() {
    if (!currentRoom || !currentRoomData) return;
    const profile = Profile.get();
    if (currentRoomData.hostId !== profile.id) return;

    const players = Object.values(currentRoomData.players || {}).sort((a,b) => a.slot - b.slot).map(p => ({...p,avatarData: p.avatarData || null}));
    const gameState = TrucoEngine.createInitialState(players, currentRoomData.mode || 2);

    await db.ref(`rooms/${currentRoom}`).update({
      status: 'playing',
      game: gameState,
    });
  }

  // ─── Update game state (from game module) ────────────

  function updateGameState(gameState) {
    if (!currentRoom) return;
    return db.ref(`rooms/${currentRoom}/game`).set(gameState);
  }

  function getRoomId() { return currentRoom; }
  function getMySlot() { return mySlot; }
  function getCurrentData() { return currentRoomData; }

  // ─── Init UI ─────────────────────────────────────────

  function initUI() {
    document.getElementById('create-room-btn')?.addEventListener('click', showCreateModal);
    document.getElementById('refresh-rooms-btn')?.addEventListener('click', () => {
      Toast.show('Lista atualizada');
    });
    document.getElementById('leave-room-btn')?.addEventListener('click', leaveRoom);
    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(document.getElementById('room-code-display')?.textContent || '');
      Toast.show('Código copiado!');
    });
    document.getElementById('start-game-btn')?.addEventListener('click', hostStartGame);

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentRoom) return;
        const mode = parseInt(btn.dataset.mode);
        db.ref(`rooms/${currentRoom}`).update({ mode });
      });
    });

    // Chat
    document.getElementById('chat-send-btn')?.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      sendChat(input.value);
      input.value = '';
    });
    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendChat(e.target.value);
        e.target.value = '';
      }
    });

    listenToRoomsList();
  }

  return { initUI, leaveRoom, updateGameState, getRoomId, getMySlot, getCurrentData };
})();
