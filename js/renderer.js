// ═══════════════════════════════════════════════════════
//  RENDERER — 3D table rendering, card display, animations
// ═══════════════════════════════════════════════════════

const Renderer = (() => {

  // ─── Build a card element ────────────────────────────

  function buildCard(card, opts = {}) {
    // opts: { face: true/false, playable: bool, small: bool, index: number }
    const { face = true, playable = false, small = false, index = -1, viraRank = null } = opts;

    const el = document.createElement('div');
    el.className = 'card-3d' + (playable ? ' playable' : '') + (face ? '' : ' hidden-card');
    if (small) el.style.cssText = 'width:44px;height:66px;';
    if (index >= 0) el.dataset.index = index;

    const front = document.createElement('div');
    front.className = 'card-face card-front';

    if (face && card) {
      const isRed = TrucoEngine.isSuitRed(card.suit);
      const manilha = viraRank ? TrucoEngine.isManilha(card, viraRank) : false;

      front.classList.add(`suit-${card.suit}`);
      if (manilha) front.classList.add('is-manilha');
      if (isRed) { front.style.color = 'var(--red-card)'; }

      const sym = TrucoEngine.SUIT_SYMBOLS[card.suit];
      front.innerHTML = `
        <div class="card-rank-tl">${card.rank}<br/><small>${sym}</small></div>
        <div class="card-suit-center">${sym}</div>
        <div class="card-rank-br">${card.rank}<br/><small>${sym}</small></div>
      `;
    }

    const back = document.createElement('div');
    back.className = 'card-face card-back';

    el.appendChild(front);
    el.appendChild(back);

    if (!face) {
      el.style.transform = 'perspective(500px) rotateY(180deg)';
    }

    return el;
  }

  // ─── Render Vira ─────────────────────────────────────

  function renderVira(vira) {
    const frontEl = document.getElementById('vira-front');
    const cardEl = document.getElementById('vira-card');
    if (!frontEl || !cardEl || !vira) return;

    const isRed = TrucoEngine.isSuitRed(vira.suit);
    const sym = TrucoEngine.SUIT_SYMBOLS[vira.suit];

    frontEl.className = `card-face card-front suit-${vira.suit}`;
    frontEl.style.color = isRed ? 'var(--red-card)' : '#111';
    frontEl.innerHTML = `
      <div class="card-rank-tl">${vira.rank}<br/><small>${sym}</small></div>
      <div class="card-suit-center">${sym}</div>
      <div class="card-rank-br">${vira.rank}<br/><small>${sym}</small></div>
    `;

    // Animate flip in
    cardEl.style.animation = 'none';
    cardEl.offsetHeight; // reflow
    cardEl.style.cssText = `
      width: 54px; height: 80px;
      transform-style: preserve-3d;
      animation: viraFlip 0.6s ease forwards;
    `;
    if (!document.getElementById('vira-keyframes')) {
      const style = document.createElement('style');
      style.id = 'vira-keyframes';
      style.textContent = `
        @keyframes viraFlip {
          0% { transform: perspective(500px) rotateY(180deg); }
          100% { transform: perspective(500px) rotateY(0deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ─── Render Player Hand ──────────────────────────────

  function renderPlayerHand(cards, viraRank, onPlay, isMyTurn) {
    const container = document.getElementById('hand-bottom');
    if (!container) return;
    container.innerHTML = '';
    container.className = 'hand-area hand-fan';

    cards.forEach((card, i) => {
      const el = buildCard(card, {
        face: true,
        playable: isMyTurn,
        index: i,
        viraRank,
      });

      if (isMyTurn) {
        el.addEventListener('click', () => onPlay(i));
      }
      container.appendChild(el);
    });
  }

  // ─── Render Opponent Hand (face down) ────────────────

  function renderOpponentHand(count, zone, isTop = true) {
    const id = `hand-${zone}`;
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';

    const cls = isTop ? 'hand-top' : 'hand-side';
    container.className = `hand-area ${cls}`;

    for (let i = 0; i < count; i++) {
      const el = buildCard(null, { face: false, small: !isTop });
      container.appendChild(el);
    }
  }

  // ─── Render Played Cards ─────────────────────────────

  function renderPlayedArea(played, players, viraRank, roundWinners) {
    const area = document.getElementById('played-area');
    if (!area) return;

    // Keep round indicator
    const indicator = area.querySelector('.round-indicator');
    const cards = area.querySelectorAll('.played-card');
    cards.forEach(c => c.remove());

    played.forEach(({ playerId, card }) => {
      const player = players.find(p => p.id === playerId);
      const isWinner = roundWinners && roundWinners.includes(playerId);

      const div = document.createElement('div');
      div.className = `played-card${isWinner ? ' round-winner' : ''}`;

      const front = document.createElement('div');
      front.className = `card-front suit-${card.suit}`;
      front.style.cssText = `
        position:absolute;inset:0;border-radius:5px;
        background:#fdf8f0;border:2px solid rgba(0,0,0,0.1);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        padding:3px;color:${TrucoEngine.isSuitRed(card.suit) ? 'var(--red-card)' : '#111'};
        font-size:0.7rem;
      `;
      const sym = TrucoEngine.SUIT_SYMBOLS[card.suit];
      const isManilha = viraRank ? TrucoEngine.isManilha(card, viraRank) : false;

      front.innerHTML = `
        <span style="position:absolute;top:3px;left:4px;font-size:0.65rem;font-weight:700">${card.rank}<br/><small>${sym}</small></span>
        <span style="font-size:1.5rem">${sym}</span>
        <span style="position:absolute;bottom:3px;right:4px;font-size:0.65rem;font-weight:700;transform:rotate(180deg)">${card.rank}<br/><small>${sym}</small></span>
        ${isManilha ? '<span style="position:absolute;top:2px;right:3px;font-size:0.5rem;color:var(--gold)">★</span>' : ''}
      `;

      const tag = document.createElement('div');
      tag.className = 'owner-tag';
      tag.textContent = player ? player.name : '?';

      div.appendChild(front);
      div.appendChild(tag);
      area.appendChild(div);
    });
  }

  // ─── Render Scores ───────────────────────────────────

  function renderScores(scores, players, mode) {
    document.getElementById('team1-score').textContent = scores[0];
    document.getElementById('team2-score').textContent = scores[1];

    // Team labels
    if (mode === 2) {
      const p0 = players[0];
      const p1 = players[1];
      document.getElementById('team1-label').textContent = p0?.name?.split(' ')[0] || 'Time 1';
      document.getElementById('team2-label').textContent = p1?.name?.split(' ')[0] || 'Time 2';
    } else {
      document.getElementById('team1-label').textContent = 'Time A';
      document.getElementById('team2-label').textContent = 'Time B';
    }
  }

  // ─── Render Player Info Bubbles ───────────────────────

  function renderPlayerInfos(players, mySlot, currentPlayerSlot, mode) {
    const positions = getPositions(mySlot, mode);

    players.forEach(p => {
      const pos = positions[p.slot];
      if (!pos) return;

      const container = document.getElementById(`pinfo-${pos}`);
      if (!container) return;

      const zone = document.getElementById(`zone-${pos}`);
      if (zone) zone.style.display = '';

      // Avatar
      const avatarEl = container.querySelector('.player-avatar-3d');
      if (avatarEl) {
        if (p.avatarType === 'image' && p.avatarData) {
          avatarEl.innerHTML = `<img src="${p.avatarData}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />`;
        } else {
          avatarEl.textContent = p.avatar || '🤠';
        }
      }

      // Name
      const nameEl = container.querySelector('.player-name-3d');
      if (nameEl) nameEl.textContent = p.name;

      // Turn highlight
      container.classList.toggle('is-turn', p.slot === currentPlayerSlot);
    });
  }

  // ─── Render Opponent Hands ─────────────────────────────

  function renderAllHands(state, myPlayerId, mySlot) {
    const positions = getPositions(mySlot, state.mode);

    state.players.forEach(p => {
      if (p.id === myPlayerId) return;
      const pos = positions[p.slot];
      if (!pos) return;

      const cardCount = (state.hands[p.id] || []).length;
      renderOpponentHand(cardCount, pos, pos === 'top');
    });
  }

  // ─── Map slots to visual positions ───────────────────

  function getPositions(mySlot, mode) {
    // mySlot is always 'bottom'
    // Returns { slotIndex: 'bottom'|'top'|'left'|'right' }
    const positions = {};
    const count = mode === 4 ? 4 : 2;

    if (count === 2) {
      positions[mySlot] = 'bottom';
      positions[(mySlot + 1) % 2] = 'top';
    } else {
      positions[mySlot] = 'bottom';
      positions[(mySlot + 1) % 4] = 'right';
      positions[(mySlot + 2) % 4] = 'top';
      positions[(mySlot + 3) % 4] = 'left';
    }

    return positions;
  }

  // ─── Round result banner ─────────────────────────────

  function showRoundBanner(text, duration = 1800) {
    const banner = document.getElementById('round-banner');
    const textEl = document.getElementById('round-result-text');
    if (!banner || !textEl) return;

    textEl.textContent = text;
    banner.style.display = 'flex';
    setTimeout(() => { banner.style.display = 'none'; }, duration);
  }

  // ─── Turn indicator ───────────────────────────────────

  function setTurnText(text) {
    const el = document.getElementById('turn-text');
    if (el) el.textContent = text;
  }

  // ─── Show/hide 4-player zones ─────────────────────────

  function setup4PlayerZones(show) {
    ['zone-left', 'zone-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? '' : 'none';
    });
  }

  // ─── Truco banner ─────────────────────────────────────

  function showTrucoBanner(callerName, level, showButtons, onAccept, onRaise, onFold) {
    const banner = document.getElementById('truco-banner');
    const callerEl = document.getElementById('truco-caller');
    const valEl = document.getElementById('truco-value-display');
    if (!banner) return;

    callerEl.textContent = `${callerName} gritou...`;
    valEl.textContent = `Vale ${level} pontos`;
    banner.style.display = 'flex';

    // Remove old buttons
    banner.querySelectorAll('.truco-resp-btn').forEach(b => b.remove());

    if (showButtons) {
      const content = banner.querySelector('.truco-banner-content');
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;margin-top:20px;justify-content:center;flex-wrap:wrap';

      const canRaise = TrucoEngine.TRUCO_LEVELS.indexOf(level) < TrucoEngine.TRUCO_LEVELS.length - 1;

      const foldBtn = Object.assign(document.createElement('button'), {
        className: 'btn-action btn-fold truco-resp-btn',
        textContent: '🏳️ Correr',
      });
      foldBtn.addEventListener('click', () => { banner.style.display = 'none'; onFold(); });

      const acceptBtn = Object.assign(document.createElement('button'), {
        className: 'btn-action btn-accept truco-resp-btn',
        textContent: '✅ Aceitar',
      });
      acceptBtn.addEventListener('click', () => { banner.style.display = 'none'; onAccept(); });

      btnRow.appendChild(foldBtn);
      btnRow.appendChild(acceptBtn);

      if (canRaise) {
        const nextLevel = TrucoEngine.TRUCO_LEVELS[TrucoEngine.TRUCO_LEVELS.indexOf(level) + 1];
        const raiseBtn = Object.assign(document.createElement('button'), {
          className: 'btn-action btn-raise truco-resp-btn',
          textContent: `🔥 Pedir ${nextLevel}!`,
        });
        raiseBtn.addEventListener('click', () => { banner.style.display = 'none'; onRaise(); });
        btnRow.appendChild(raiseBtn);
      }

      btnRow.querySelectorAll('button').forEach(b => b.classList.add('truco-resp-btn'));
      content.appendChild(btnRow);
    }
  }

  function hideTrucoBanner() {
    const banner = document.getElementById('truco-banner');
    if (banner) banner.style.display = 'none';
  }

  // ─── Game log ─────────────────────────────────────────

  function addLog(text, type = '') {
    const container = document.getElementById('log-content');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Max 50 entries
    while (container.children.length > 50) {
      container.removeChild(container.firstChild);
    }
  }

  return {
    buildCard,
    renderVira,
    renderPlayerHand,
    renderOpponentHand,
    renderAllHands,
    renderPlayedArea,
    renderScores,
    renderPlayerInfos,
    showRoundBanner,
    hideTrucoBanner,
    showTrucoBanner,
    setTurnText,
    setup4PlayerZones,
    getPositions,
    addLog,
  };
})();
