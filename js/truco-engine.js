// ═══════════════════════════════════════════════════════
//  TRUCO ENGINE — Truco Mineiro completo
//  Regras: Manilhas, Truco vale 4, Seis, Nove, Doze
//  Baralho: 40 cartas (sem 8,9,10)
// ═══════════════════════════════════════════════════════

const TrucoEngine = (() => {

  // ─── Deck ────────────────────────────────────────────
  // Cartas do truco: A,2,3,4,5,6,7,J,Q,K
  // Naipes: paus(♣) copas(♥) espadas(♠) ouros(♦)
  const RANKS = ['A','2','3','4','5','6','7','J','Q','K'];
  const SUITS = ['paus','copas','espadas','ouros'];
  const SUIT_SYMBOLS = { paus:'♣', copas:'♥', espadas:'♠', ouros:'♦' };

  // Ordem base (sem manilha): 4<5<6<7<J<Q<K<A<2<3
  const BASE_ORDER = ['4','5','6','7','J','Q','K','A','2','3'];

  // Manilhas em ordem crescente de força:
  // 7♦ < 7♥ < A♠ < 7♠ (segundo naipe de paus)
  // Truco Mineiro: vira define manilha (carta seguinte)
  // Força das manilhas: ♦(ouros) < ♥(copas) < ♣(paus) < ♠(espadas)
  // Mais fraca → mais forte: ouros, copas, paus, espadas
  const MANILHA_SUIT_ORDER = ['ouros','copas','paus','espadas']; // índice = força

  function buildDeck() {
    const deck = [];
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        deck.push({ rank, suit });
      }
    }
    return deck;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ─── Manilha logic ───────────────────────────────────

  function getManilhaRank(viraRank) {
    const idx = BASE_ORDER.indexOf(viraRank);
    // Next card in base order is the manilha
    return BASE_ORDER[(idx + 1) % BASE_ORDER.length];
  }

  function isManilha(card, viraRank) {
    return card.rank === getManilhaRank(viraRank);
  }

  function cardStrength(card, viraRank) {
    if (isManilha(card, viraRank)) {
      // Manilha: base strength 100 + suit order
      return 100 + MANILHA_SUIT_ORDER.indexOf(card.suit);
    }
    return BASE_ORDER.indexOf(card.rank);
  }

  function compareCards(cardA, cardB, viraRank) {
    const sA = cardStrength(cardA, viraRank);
    const sB = cardStrength(cardB, viraRank);
    if (sA > sB) return 1;
    if (sA < sB) return -1;
    return 0; // empate
  }

  // ─── Initial State ───────────────────────────────────

  function createInitialState(players, mode) {
    const state = {
      mode,           // 2 or 4
      players: players.map((p, i) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        avatarType: p.avatarType,
        avatarData: p.avatarData,
        slot: p.slot,
        team: mode === 4 ? (p.slot % 2) : p.slot,
      })),
      scores: [0, 0],       // team scores (points towards winning)
      roundsWon: [0, 0],    // current hand rounds won per team
      hand: 1,              // hand number
      round: 1,             // round within hand (1-3)
      deck: [],
      vira: null,           // vira card
      hands: {},            // player id -> [cards]
      played: [],           // [{playerId, card, slot}] for current round
      allPlayed: [],        // history of all rounds in this hand
      currentPlayer: players[0].slot,
      firstOfHand: players[0].slot,
      firstOfRound: players[0].slot,
      status: 'playing',    // 'playing' | 'truco_called' | 'hand_over' | 'game_over'
      trucoStatus: null,    // null | {caller, level, responding}
      // level: 4(truco), 6(seis), 9(nove), 12(doze)
      pendingPoints: 1,     // points at stake if truco not called
      winner: null,
      lastAction: null,
      updatedAt: Date.now(),
    };

    return dealHand(state);
  }

  // ─── Deal ────────────────────────────────────────────

  function dealHand(state) {
    const deck = shuffle(buildDeck());
    const vira = deck.pop();
    const hands = {};

    state.players.forEach((p, i) => {
      hands[p.id] = [deck.pop(), deck.pop(), deck.pop()];
    });

    return {
      ...state,
      deck: deck.map(c => ({ rank: c.rank, suit: c.suit })), // remaining
      vira: { rank: vira.rank, suit: vira.suit },
      hands,
      played: [],
      allPlayed: [],
      roundsWon: [0, 0],
      round: 1,
      trucoStatus: null,
      pendingPoints: 1,
      status: 'playing',
      updatedAt: Date.now(),
    };
  }

  // ─── Play a card ─────────────────────────────────────

  function playCard(state, playerId, cardIndex) {
    // Validate
    if (state.status !== 'playing') return { error: 'Não é hora de jogar' };
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jogador não encontrado' };
    if (player.slot !== state.currentPlayer) return { error: 'Não é sua vez' };

    const hand = [...(state.hands[playerId] || [])];
    if (cardIndex < 0 || cardIndex >= hand.length) return { error: 'Carta inválida' };

    const card = hand[cardIndex];
    hand.splice(cardIndex, 1);

    const played = [...state.played, { playerId, card, slot: player.slot }];
    const hands = { ...state.hands, [playerId]: hand };

    let newState = { ...state, played, hands, updatedAt: Date.now() };

    // Check if all players played this round
    if (played.length === state.players.length) {
      newState = resolveRound(newState);
    } else {
      // Next player
      newState.currentPlayer = nextSlot(state.currentPlayer, state.players.length);
    }

    return newState;
  }

  function nextSlot(current, count) {
    return (current + 1) % count;
  }

  // ─── Resolve round ───────────────────────────────────

  function resolveRound(state) {
    const viraRank = state.vira.rank;
    const played = state.played;

    // Find winner of round
    let best = played[0];
    let tie = false;

    for (let i = 1; i < played.length; i++) {
      const cmp = compareCards(played[i].card, best.card, viraRank);
      if (cmp > 0) {
        best = played[i];
        tie = false;
      } else if (cmp === 0) {
        tie = true; // empate
      }
    }

    let roundWinner = null; // null = empate
    let winningTeam = null;

    if (!tie) {
      roundWinner = state.players.find(p => p.id === best.playerId);
      winningTeam = roundWinner.team;
    }

    const roundsWon = [...state.roundsWon];
    if (winningTeam !== null) {
      roundsWon[winningTeam]++;
    }

    const allPlayed = [...state.allPlayed, {
      round: state.round,
      played: [...played],
      winner: roundWinner ? { id: roundWinner.id, slot: roundWinner.slot, team: roundWinner.team } : null,
      tie,
    }];

    let newState = {
      ...state,
      roundsWon,
      allPlayed,
      played: [],
      round: state.round + 1,
    };

    // Determine next first player
    if (roundWinner) {
      newState.currentPlayer = roundWinner.slot;
      newState.firstOfRound = roundWinner.slot;
    } else {
      // Empate: whoever started this round starts next
      newState.currentPlayer = state.firstOfRound;
      newState.firstOfRound = state.firstOfRound;
    }

    // Check hand winner
    const handResult = checkHandWinner(newState, roundWinner, allPlayed);
    if (handResult) {
      return endHand(newState, handResult);
    }

    return { ...newState, lastRoundResult: { tie, winner: roundWinner } };
  }

  function checkHandWinner(state, lastRoundWinner, allPlayed) {
    const [w0, w1] = state.roundsWon;

    // A team wins 2 rounds → wins hand
    if (w0 >= 2) return { winningTeam: 0 };
    if (w1 >= 2) return { winningTeam: 1 };

    // 3 rounds played — check tiebreaker
    if (allPlayed.length >= 3) {
      // All 3 tied → first round winner (or further tie = first player)
      const firstRound = allPlayed[0];
      if (!firstRound.tie && firstRound.winner) {
        return { winningTeam: firstRound.winner.team };
      }
      // First round tied, second round winner
      const secondRound = allPlayed[1];
      if (!secondRound.tie && secondRound.winner) {
        return { winningTeam: secondRound.winner.team };
      }
      // All tied: empate → team 0 wins? No, in mineiro first player wins
      return { winningTeam: state.firstOfHand % 2 === 0 ? 0 : 1 };
    }

    // Empate in round 1: continue
    return null;
  }

  function endHand(state, { winningTeam }) {
    const points = state.trucoStatus ? state.trucoStatus.level : state.pendingPoints;
    const scores = [...state.scores];
    scores[winningTeam] += points;

    const gameOver = scores[0] >= 12 || scores[1] >= 12;
    const winner = gameOver ? winningTeam : null;

    let newState = {
      ...state,
      scores,
      status: gameOver ? 'game_over' : 'hand_over',
      winner,
      handWinner: winningTeam,
      updatedAt: Date.now(),
    };

    return newState;
  }

  // ─── Next hand ───────────────────────────────────────

  function nextHand(state) {
    if (state.status !== 'hand_over') return state;
    const nextFirst = nextSlot(state.firstOfHand, state.players.length);
    return dealHand({
      ...state,
      hand: state.hand + 1,
      firstOfHand: nextFirst,
      firstOfRound: nextFirst,
      currentPlayer: nextFirst,
    });
  }

  // ─── TRUCO calls ─────────────────────────────────────
  // Truco Mineiro: Truco(4) → Seis(6) → Nove(9) → Doze(12)

  const TRUCO_LEVELS = [4, 6, 9, 12];
  const TRUCO_NAMES = { 4: 'Truco!', 6: 'Seis!', 9: 'Nove!', 12: 'Doze!' };

  function callTruco(state, playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jogador não encontrado' };
    if (state.status !== 'playing') return { error: 'Não é possível pedir truco agora' };

    let level = 4;
    if (state.trucoStatus) {
      const currentLevel = state.trucoStatus.level;
      const nextIdx = TRUCO_LEVELS.indexOf(currentLevel) + 1;
      if (nextIdx >= TRUCO_LEVELS.length) return { error: 'Já está no máximo!' };
      // Can only raise if it's opponent's turn to respond — but opponent accepted
      if (!state.trucoStatus.accepted) return { error: 'Aguarde resposta do truco' };
      level = TRUCO_LEVELS[nextIdx];
    }

    // Cannot call truco if you called it last (unless partner called)
    if (state.trucoStatus && state.trucoStatus.callerTeam === player.team) {
      if (!state.trucoStatus.accepted) return { error: 'Aguarde resposta' };
    }

    return {
      ...state,
      status: 'truco_called',
      trucoStatus: {
        level,
        callerId: player.id,
        callerSlot: player.slot,
        callerTeam: player.team,
        accepted: false,
        responderId: null,
      },
      updatedAt: Date.now(),
    };
  }

  function respondTruco(state, playerId, response) {
    // response: 'accept' | 'raise' | 'fold'
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jogador não encontrado' };
    if (state.status !== 'truco_called') return { error: 'Não há truco para responder' };
    if (player.team === state.trucoStatus.callerTeam) return { error: 'Você não pode responder seu próprio truco' };

    if (response === 'fold') {
      // Caller's team wins with current level (one level below if first call)
      const foldPoints = state.trucoStatus.level === 4 ? 1 : TRUCO_LEVELS[TRUCO_LEVELS.indexOf(state.trucoStatus.level) - 1];
      // Actually: fold = give one less point to caller
      const callerTeam = state.trucoStatus.callerTeam;
      const pts = state.trucoStatus.level === 4 ? 1 : TRUCO_LEVELS[TRUCO_LEVELS.indexOf(state.trucoStatus.level) - 1];
      const scores = [...state.scores];
      scores[callerTeam] += pts;
      const gameOver = scores[0] >= 12 || scores[1] >= 12;
      return {
        ...state,
        scores,
        trucoStatus: { ...state.trucoStatus, accepted: false },
        status: gameOver ? 'game_over' : 'hand_over',
        winner: gameOver ? callerTeam : null,
        handWinner: callerTeam,
        updatedAt: Date.now(),
      };
    }

    if (response === 'accept') {
      return {
        ...state,
        status: 'playing',
        trucoStatus: { ...state.trucoStatus, accepted: true, responderId: player.id },
        pendingPoints: state.trucoStatus.level,
        updatedAt: Date.now(),
        currentPlayer: state.currentPlayer, // caller plays after truco accepted
      };
    }

    if (response === 'raise') {
      const currentLevel = state.trucoStatus.level;
      const nextIdx = TRUCO_LEVELS.indexOf(currentLevel) + 1;
      if (nextIdx >= TRUCO_LEVELS.length) return { error: 'Não pode aumentar mais' };
      const nextLevel = TRUCO_LEVELS[nextIdx];
      return {
        ...state,
        status: 'truco_called',
        trucoStatus: {
          level: nextLevel,
          callerId: player.id,
          callerSlot: player.slot,
          callerTeam: player.team,
          accepted: false,
          responderId: null,
        },
        updatedAt: Date.now(),
      };
    }

    return { error: 'Resposta inválida' };
  }

  // ─── Fold hand ───────────────────────────────────────

  function foldHand(state, playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'Jogador não encontrado' };
    if (state.status !== 'playing') return { error: 'Não é possível correr agora' };

    // Opponent team wins 1 point
    const loserTeam = player.team;
    const winnerTeam = 1 - loserTeam;
    const points = state.pendingPoints;
    const scores = [...state.scores];
    scores[winnerTeam] += points;
    const gameOver = scores[0] >= 12 || scores[1] >= 12;

    return {
      ...state,
      scores,
      status: gameOver ? 'game_over' : 'hand_over',
      winner: gameOver ? winnerTeam : null,
      handWinner: winnerTeam,
      updatedAt: Date.now(),
    };
  }

  // ─── Card display helpers ─────────────────────────────

  function cardDisplayName(card) {
    return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
  }

  function suitSymbol(suit) {
    return SUIT_SYMBOLS[suit] || suit;
  }

  function isSuitRed(suit) {
    return suit === 'copas' || suit === 'ouros';
  }

  function getManilhaName(level) {
    const names = { ouros: '7♦ (mais fraca)', copas: '7♥', paus: 'A♣', espadas: '7♠ (mais forte)' };
    return names;
  }

  function trucoLevelName(level) {
    return TRUCO_NAMES[level] || `${level} pontos`;
  }

  // ─── Exports ─────────────────────────────────────────

  return {
    createInitialState,
    dealHand,
    nextHand,
    playCard,
    callTruco,
    respondTruco,
    foldHand,
    isManilha,
    getManilhaRank,
    cardStrength,
    compareCards,
    cardDisplayName,
    suitSymbol,
    isSuitRed,
    trucoLevelName,
    SUIT_SYMBOLS,
    TRUCO_LEVELS,
    TRUCO_NAMES,
  };
})();
