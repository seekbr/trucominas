// ═══════════════════════════════════════════════════════
//  MAIN — App init, Screen manager, Toast, Game controller
// ═══════════════════════════════════════════════════════

// ─── Utilities ───────────────────────────────────────

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ─── Screen Manager ──────────────────────────────────

const Screen = {
  show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');
  }
};

// ─── Toast ───────────────────────────────────────────

const Toast = {
  show(msg, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }
};

// ═══════════════════════════════════════════════════════
//  GAME MODULE
// ═══════════════════════════════════════════════════════

const Game = (() => {
  let gameState = null;
  let myPlayerId = null;
  let mySlot = 0;
  let gameListener = null;
  let roomId = null;
  let lastStateTs = 0;

  // ─── Start from room ─────────────────────────────────

  function startFromRoom(room, slot) {
    if (gameListener) {
      db.ref(`rooms/${room.id || roomId}/game`).off('value', gameListener);
    }

    myPlayerId = Profile.get().id;
    mySlot = slot;
    roomId = room.id || Rooms.getRoomId();

    Screen.show('game');
    document.getElementById('log-content').innerHTML = '';

    // Setup 4-player zones
    const mode = room.mode || 2;
    Renderer.setup4PlayerZones(mode === 4);

    // Listen for game state changes
    gameListener = db.ref(`rooms/${roomId}/game`).on('value', (snap) => {
      const state = snap.val();
      if (!state) return;
      if (state.updatedAt === lastStateTs) return;
      lastStateTs = state.updatedAt;

      gameState = state;
      render(state);
      handleStateTransition(state);
    });
  }

  // ─── Render current state ─────────────────────────────

  function render(state) {
    if (!state) return;
    const myPlayer = state.players.find(p => p.id === myPlayerId);
    if (!myPlayer) return;

    const isMyTurn = state.currentPlayer === mySlot && state.status === 'playing';

    // Vira
    if (state.vira) Renderer.renderVira(state.vira);

    // Player info bubbles
    Renderer.renderPlayerInfos(state.players, mySlot, state.currentPlayer, state.mode);

    // My hand
    const myCards = state.hands[myPlayerId] || [];
    Renderer.renderPlayerHand(myCards, state.vira?.rank, onPlayCard, isMyTurn);

    // Opponents' hands
    Renderer.renderAllHands(state, myPlayerId, mySlot);

    // Played cards
    const lastRound = state.allPlayed?.slice(-1)[0];
    const winners = lastRound && !lastRound.tie && lastRound.winner
      ? [lastRound.winner.id] : [];
    Renderer.renderPlayedArea(state.played || [], state.players, state.vira?.rank, winners);

    // Scores
    Renderer.renderScores(state.scores, state.players, state.mode);

    // Round indicator
    const ri = document.getElementById('round-indicator');
    if (ri) ri.textContent = `Rodada ${state.round || 1} — Mão ${state.hand || 1}`;

    if (state.status !== 'truco_called') {
      Renderer.hideTrucoBanner();
    }

    // Turn text
    if (state.status === 'playing') {
      if (isMyTurn) {
        Renderer.setTurnText('Sua vez! Jogue uma carta.');
      } else {
        const cp = state.players.find(p => p.slot === state.currentPlayer);
        Renderer.setTurnText(`Vez de ${cp?.name || '?'}...`);
      }
    }

    // Action buttons
    renderActionButtons(state, myPlayer, isMyTurn);

    // Manilha info in log on new hand
    if (state.vira && state.round === 1 && state.played?.length === 0) {
      const mRank = TrucoEngine.getManilhaRank(state.vira.rank);
      Renderer.addLog(`Vira: ${state.vira.rank}${TrucoEngine.SUIT_SYMBOLS[state.vira.suit]} → Manilha: ${mRank}`, 'system');
    }
  }

  function renderActionButtons(state, myPlayer, isMyTurn) {
    const btnTruco = document.getElementById('btn-truco');
    const btnFold = document.getElementById('btn-fold');
    const btnAccept = document.getElementById('btn-accept');
    const btnRaise = document.getElementById('btn-raise');
    const btnDeny = document.getElementById('btn-deny');

    // Hide all first
    [btnAccept, btnRaise, btnDeny].forEach(b => { if (b) b.style.display = 'none'; });

    if (state.status === 'playing') {
      if (btnTruco) btnTruco.style.display = '';
      if (btnFold) btnFold.style.display = '';

      // Can truco?
      const currentLevel = state.trucoStatus?.level;
      const canTruco = !currentLevel || (state.trucoStatus.accepted && state.trucoStatus.callerTeam !== myPlayer.team);
      if (btnTruco) {
        const nextLevel = canTruco ? (currentLevel
          ? TrucoEngine.TRUCO_LEVELS[TrucoEngine.TRUCO_LEVELS.indexOf(currentLevel) + 1]
          : 4) : null;
        btnTruco.textContent = nextLevel ? `⚔️ ${TrucoEngine.TRUCO_NAMES[nextLevel]}` : '⚔️ Truco!';
        btnTruco.style.display = nextLevel && isMyTurn ? '' : 'none';
      }
      if (btnFold) btnFold.style.display = isMyTurn ? '' : 'none';

    } else if (state.status === 'truco_called') {
      if (btnTruco) btnTruco.style.display = 'none';
      if (btnFold) btnFold.style.display = 'none';

      const isOpponent = state.trucoStatus.callerTeam !== myPlayer.team;
      if (isOpponent) {
        if (btnAccept) btnAccept.style.display = '';
        if (btnDeny) btnDeny.style.display = '';

        const canRaise = TrucoEngine.TRUCO_LEVELS.indexOf(state.trucoStatus.level) < TrucoEngine.TRUCO_LEVELS.length - 1;
        if (btnRaise && canRaise) btnRaise.style.display = '';

        // Show truco banner for opponents
        Renderer.showTrucoBanner(
          state.players.find(p => p.id === state.trucoStatus.callerId)?.name || '?',
          state.trucoStatus.level,
          true,
          () => doRespondTruco('accept'),
          () => doRespondTruco('raise'),
          () => doRespondTruco('fold')
        );
      } else {
        // Show info banner for caller (waiting)
        Renderer.showTrucoBanner(
          'Você pediu...',
          state.trucoStatus.level,
          false
        );
      }
    }
  }

  // ─── State transitions ───────────────────────────────

  function handleStateTransition(state) {
    if (state.status === 'hand_over') {
      const winTeam = state.handWinner;
      const winnerNames = state.players
        .filter(p => p.team === winTeam)
        .map(p => p.name).join(' & ');
      Renderer.showRoundBanner(`🏆 ${winnerNames} venceu a mão!`);
      Renderer.hideTrucoBanner();

      // Auto-start next hand after delay (host only)
      setTimeout(() => {
        if (Profile.get().id === getCurrentHostId()) {
          const next = TrucoEngine.nextHand(state);
          Rooms.updateGameState(next);
        }
      }, 3000);
    }

    if (state.status === 'game_over') {
      const winTeam = state.winner;
      const winnerNames = state.players
        .filter(p => p.team === winTeam)
        .map(p => p.name).join(' & ');

      setTimeout(() => {
        Renderer.showRoundBanner(`🎉 ${winnerNames} VENCEU O JOGO!`);
      }, 500);

      // Show exit option
      Renderer.addLog(`🎉 ${winnerNames} venceu! Parabéns!`, 'important');
    }

    // Round result feedback
    if (state.allPlayed && state.allPlayed.length > 0) {
      const lastRound = state.allPlayed[state.allPlayed.length - 1];
      const prevLen = (gameState?.allPlayed?.length || 0);

      if (state.allPlayed.length > prevLen - 1 && lastRound.played?.length === state.players.length) {
        if (lastRound.tie) {
          Renderer.addLog('Empate na rodada!');
        } else if (lastRound.winner) {
          const w = state.players.find(p => p.id === lastRound.winner.id);
          Renderer.addLog(`${w?.name} venceu a rodada!`, 'important');
        }
      }
    }
  }

  function getCurrentHostId() {
    const data = Rooms.getCurrentData();
    return data?.hostId;
  }

  // ─── Actions ─────────────────────────────────────────

  async function onPlayCard(index) {
    if (!gameState || gameState.status !== 'playing') return;
    const newState = TrucoEngine.playCard(gameState, myPlayerId, index);
    if (newState.error) { Toast.show(newState.error, 'error'); return; }

    Renderer.addLog(`Você jogou ${TrucoEngine.cardDisplayName(newState.allPlayed.slice(-1)[0]?.played?.find(p=>p.playerId===myPlayerId)?.card || {rank:'?',suit:'paus'})}`);
    await Rooms.updateGameState(newState);
  }

  async function doCallTruco() {
    if (!gameState) return;
    const newState = TrucoEngine.callTruco(gameState, myPlayerId);
    if (newState.error) { Toast.show(newState.error, 'error'); return; }
    Renderer.addLog(`Você pediu ${TrucoEngine.trucoLevelName(newState.trucoStatus.level)}!`, 'important');
    await Rooms.updateGameState(newState);
  }

  async function doRespondTruco(response) {
    if (!gameState) return;
    const newState = TrucoEngine.respondTruco(gameState, myPlayerId, response);
    if (newState.error) { Toast.show(newState.error, 'error'); return; }

    const msgs = { accept: 'Aceitou o truco!', fold: 'Correu!', raise: 'Aumentou!' };
    Renderer.addLog(msgs[response] || response, 'important');
    Renderer.hideTrucoBanner();
    await Rooms.updateGameState(newState);
  }

  async function doFold() {
    if (!gameState) return;
    const newState = TrucoEngine.foldHand(gameState, myPlayerId);
    if (newState.error) { Toast.show(newState.error, 'error'); return; }
    Renderer.addLog('Você correu da mão!');
    await Rooms.updateGameState(newState);
  }

  function initUI() {
    document.getElementById('btn-truco')?.addEventListener('click', doCallTruco);
    document.getElementById('btn-fold')?.addEventListener('click', doFold);
    document.getElementById('btn-accept')?.addEventListener('click', () => doRespondTruco('accept'));
    document.getElementById('btn-raise')?.addEventListener('click', () => doRespondTruco('raise'));
    document.getElementById('btn-deny')?.addEventListener('click', () => doRespondTruco('fold'));

    document.getElementById('exit-game-btn')?.addEventListener('click', () => {
      if (confirm('Sair do jogo?')) {
        if (gameListener && roomId) {
          db.ref(`rooms/${roomId}/game`).off('value', gameListener);
        }
        Rooms.leaveRoom();
      }
    });
  }

  return { startFromRoom, initUI };
})();

// ═══════════════════════════════════════════════════════
//  APP INIT
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  Profile.initUI();
  Rooms.initUI();
  Game.initUI();

  // Start on lobby
  Screen.show('lobby');

  // Welcome log
  console.log('%cTruco Mineiro Online 🃏', 'color:#c9a84c;font-size:1.2rem;font-weight:bold');
  console.log('Para jogar: configure o Firebase em js/firebase-config.js');
});
