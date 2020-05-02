import { Machine, interpret, assign } from 'https://unpkg.com/xstate@4/dist/xstate.web.js';

const EVENT_KEYS = {
  KeyQ: { type: 'FORFIT' },
  KeyR: { type: 'RESTART' },
  Digit1: { type: 'PLAY', position: 0 },
  Digit2: { type: 'PLAY', position: 1 },
  Digit3: { type: 'PLAY', position: 2 },
  Digit4: { type: 'PLAY', position: 3 },
  Digit5: { type: 'PLAY', position: 4 },
  Digit6: { type: 'PLAY', position: 5 },
  Digit7: { type: 'PLAY', position: 6 },
  Digit8: { type: 'PLAY', position: 7 },
  Digit9: { type: 'PLAY', position: 8 }
};

const animationStates = {
  initial: 'idle',
  states: {
    idle: {
      on: {
        PLAY: {
          target: 'animating',
          cond: 'isLegalMove',
          actions: ['updateBoard', 'updateWinner']
        }
      },
    },
    animating: {
      invoke: { src: 'animation', onDone: 'done' }
    },
    done: { type: 'final' }
  },
};

const gameMachine = Machine({
  id: 'tic-tac-toe',
  initial: 'newGame',
  context: {
    gameMode: 'pvp',
    board: [],
    lastPlay: null,
    winningMove: []
  },
  on: {
    FORFIT: 'newGame',
    RESTART: 'setup',
    SET_GAME_MODE: {
      actions: assign({ gameMode: (_, { mode }) => mode })
    }
  },
  states: {
    newGame: {},
    ohWon: { entry: 'setWinningMove' },
    exWon: { entry: 'setWinningMove' },
    draw: {},
    setup: {
      entry: assign({
        lastPlay: null,
        board: () => Array(9).fill(' '),
        winningMove: () => []
      }),
      on: { '': 'ohsTurn' }
    },
    ohsTurn: {
      ...animationStates,
      invoke: { src: 'playOhsTurn' },
      onDone: [
        { target: 'exWon', cond: 'hasExWon' },
        { target: 'ohWon', cond: 'hasOhWon' },
        { target: 'draw', cond: 'isADraw' },
        { target: 'exsTurn' }
      ]
    },
    exsTurn: {
      ...animationStates,
      invoke: { src: 'playExsTurn' },
      onDone: [
        { target: 'exWon', cond: 'hasExWon' },
        { target: 'ohWon', cond: 'hasOhWon' },
        { target: 'draw', cond: 'isADraw' },
        { target: 'ohsTurn' }
      ]
    },
  }
}, {
  guards: {
    hasOhWon: ({ board }) => !!findThreeInARow('O', board),
    hasExWon: ({ board }) => !!findThreeInARow('X', board),
    isADraw: ({ board }) => board.every(tile => tile !== ' '),
    isLegalMove: ({ board }, { position }) => board[position] === ' '
  },
  actions: {
    updateBoard: assign({
      lastPlay: (_, { position }) => position,
      board: ({ board }, { position }, { state }) => {
        let newBoard = [].concat(board);
        newBoard[position] = state.matches('ohsTurn') ? 'O' : 'X';
        return newBoard;
      }
    }),
    updateWinner: assign({
      winningMove: ({ board }) => {
        return findThreeInARow('O', board) || findThreeInARow('X', board) || [];
      },
    })
  },
  services: {
    animation: () => new Promise(resolve => {
      let el = document.querySelector('#game-board');
      function handler() {
        el.removeEventListener('animationend', handler);
        resolve();
      }
      el.addEventListener('animationend', handler);
    }),
    playOhsTurn: ({ board, gameMode }) => callback => {
      if (gameMode !== 'cvc') { return; }
      let position = findBestMove('O', board);
      callback({ type: 'PLAY', position });
    },
    playExsTurn: ({ board, gameMode }) => callback => {
      if (gameMode === 'pvp') { return; }
      let position = findBestMove('X', board);
      callback({ type: 'PLAY', position });
    }
  }
});

function findThreeInARow(player, board) {
  return [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ].find(winningRow => winningRow.every(pos => board[pos] === player));
}

function findBestMove(player, board) {
  return findWinningMove(player, board)
    || findWinningMove(player === 'O' ? 'X' : 'O', board)
    || findRandomMove(player, board);
}

function findWinningMove(player, board) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== ' ') { continue; }
    let newBoard = [].concat(board);
    newBoard[i] = player;
    if (findThreeInARow(player, newBoard)) { return i; }
  }
}

function findRandomMove(player, board) {
  const { floor, random } = Math;
  let availablePositions = [...Array(board.length).keys()]
    .filter(v => board[v] === ' ');
  return availablePositions[floor(random() * availablePositions.length)];
}

function updatePage(state) {
  let { gameMode, lastPlay, board, winningMove } = state.context;
  let stateList = [`mode:${gameMode}`, ...state.toStrings()]
  let gameBoard = document.querySelector('#game-board');
  gameBoard.dataset.lastPlay = lastPlay;
  for (let i = 0; i < board.length; i++) {
    gameBoard.children[i].textContent = board[i];
    gameBoard.children[i].dataset.value = board[i];
    gameBoard.children[i].dataset.winningTile = winningMove.includes(i);
  }
  document.querySelector('#app').dataset.state = stateList.join(' ');
  document.querySelector('#debugInfo').value = stateList.join(', ');
}

const game = interpret(gameMachine).onTransition(updatePage).start();

document.querySelector('#gameControl')
  .addEventListener('submit', function(event) {
    let mode = new FormData(event.target).get('gameMode');
    event.preventDefault();
    game.send([
      { type: 'SET_GAME_MODE', mode },
      { type: 'RESTART' }
    ]);
  });

document.querySelector('#forfitBtn')
  .addEventListener('click', function(event) {
    event.preventDefault();
    game.send('FORFIT');
  });

document.querySelector('#game-board')
  .addEventListener('click', function({ target }) {
    let position = parseInt(target.dataset.position);
    game.send({ type: 'PLAY', position });
  });

document.querySelector('body')
  .addEventListener('keyup', function(event) {
    let sendEvent = EVENT_KEYS[event.code];
    if (!sendEvent) { return; }
    event.preventDefault();
    game.send(sendEvent);
  });
