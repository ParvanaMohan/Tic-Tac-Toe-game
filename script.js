
const cells = document.querySelectorAll(".cell");

const statusText = document.getElementById("status");
const modeSelect = document.getElementById("mode");
const difficultySelect = document.getElementById("difficulty");

const restartBtn = document.getElementById("restartBtn");
const newBtn = document.getElementById("newBtn");
const undoBtn = document.getElementById("undoBtn");
const themeBtn = document.getElementById("themeBtn");
const soundToggle = document.getElementById("soundToggle");
const soundIcon = document.getElementById("soundIcon");
const resetScoresBtn = document.getElementById("resetScoresBtn");

const WINNING_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

let board = Array(9).fill("");
let currentPlayer = "X";
let gameOver = false;
let moveHistory = [];
let roundNumber = 1;
let aiTimer = null;
let toastTimer = null;
let audioContext = null;

let scores = loadScores();

function loadScores() {
    try {
        const saved = JSON.parse(
            localStorage.getItem("tictacScores")
        );

        if (
            saved &&
            Number.isSafeInteger(saved.X) &&
            Number.isSafeInteger(saved.O) &&
            Number.isSafeInteger(saved.draws) &&
            saved.X >= 0 &&
            saved.O >= 0 &&
            saved.draws >= 0
        ) {
            return saved;
        }
    } catch (error) {
        // Start with zero scores if saved data is unavailable.
    }

    return { X: 0, O: 0, draws: 0 };
}

function saveScores() {
    try {
        localStorage.setItem(
            "tictacScores",
            JSON.stringify(scores)
        );
    } catch (error) {
        showToast("Scores cannot be saved in this browser.");
    }
}

function totalGames() {
    return scores.X + scores.O + scores.draws;
}

function isComputerMode() {
    return modeSelect.value === "computer";
}

function humanSymbol() {
    return "X";
}

function computerSymbol() {
    return "O";
}

function playerName(symbol) {
    if (!isComputerMode()) {
        return symbol === "X" ? "Player X" : "Player O";
    }

    return symbol === humanSymbol() ? "You" : "Computer";
}

function updateNames() {
    document.getElementById("nameX").textContent = playerName("X");
    document.getElementById("nameO").textContent = playerName("O");

    document.getElementById("scoreNameX").textContent = playerName("X");
    document.getElementById("scoreNameO").textContent = playerName("O");
}

function updateScores() {
    document.getElementById("totalX").textContent = scores.X;
    document.getElementById("totalO").textContent = scores.O;
    document.getElementById("totalDraws").textContent = scores.draws;
    document.getElementById("totalGames").textContent = totalGames();

    const completedGames = totalGames();

    const rate = completedGames === 0
        ? 0
        : Math.round((scores.X / completedGames) * 100);

    document.getElementById("winRate").textContent = rate + "%";
    document.getElementById("progressFill").style.width = rate + "%";
}

function updatePlayers() {
    document.getElementById("playerX").classList.toggle(
        "active",
        !gameOver && currentPlayer === "X"
    );

    document.getElementById("playerO").classList.toggle(
        "active",
        !gameOver && currentPlayer === "O"
    );
}

function updateStatus() {
    if (gameOver) return;

    if (
        isComputerMode() &&
        currentPlayer === computerSymbol()
    ) {
        statusText.textContent = "Computer is thinking...";
    } else {
        statusText.textContent =
            playerName(currentPlayer) + " — make your move!";
    }

    updatePlayers();
}

function getWinner(state) {
    for (const line of WINNING_LINES) {
        const [a, b, c] = line;

        if (
            state[a] !== "" &&
            state[a] === state[b] &&
            state[b] === state[c]
        ) {
            return {
                winner: state[a],
                line: line
            };
        }
    }

    return null;
}

function isDraw(state) {
    return state.every(value => value !== "") && !getWinner(state);
}

function availableMoves(state) {
    const moves = [];

    for (let i = 0; i < state.length; i++) {
        if (state[i] === "") {
            moves.push(i);
        }
    }

    return moves;
}

function renderBoard(winningLine = []) {
    cells.forEach((cell, index) => {
        const symbol = board[index];

        cell.textContent = symbol;
        cell.classList.toggle("o", symbol === "O");
        cell.classList.toggle("win", winningLine.includes(index));

        const computerThinking =
            isComputerMode() &&
            currentPlayer === computerSymbol() &&
            !gameOver;

        cell.disabled =
            gameOver || symbol !== "" || computerThinking;

        cell.setAttribute(
            "aria-label",
            "Cell " + (index + 1) +
            (symbol ? ", " + symbol : ", empty")
        );
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}

function playSound(frequency = 440, duration = 0.09) {
    if (!soundToggle.checked) return;

    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(
            0.06, audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001, audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        // Sound is optional; gameplay continues without it.
    }
}

function cancelComputerTurn() {
    if (aiTimer !== null) {
        clearTimeout(aiTimer);
        aiTimer = null;
    }
}

function scheduleComputerTurn() {
    cancelComputerTurn();

    if (
        gameOver ||
        !isComputerMode() ||
        currentPlayer !== computerSymbol()
    ) {
        return;
    }

    renderBoard();
    updateStatus();

    aiTimer = setTimeout(() => {
        aiTimer = null;

        if (
            gameOver ||
            !isComputerMode() ||
            currentPlayer !== computerSymbol()
        ) {
            return;
        }

        const index = chooseComputerMove();

        if (index !== -1) {
            playMove(index);
        }
    }, 350);
}

function playMove(index) {
    if (gameOver || board[index] !== "") return;

    if (
        isComputerMode() &&
        currentPlayer === computerSymbol()
    ) {
        // Only the scheduled AI turn can make a computer move.
        if (aiTimer !== null) return;
    }

    const symbol = currentPlayer;

    moveHistory.push({
        board: board.slice(),
        player: symbol,
        gameOver: gameOver
    });

    board[index] = symbol;

    renderBoard();
    cells[index].classList.add("pop");

    playSound(symbol === "X" ? 440 : 580);

    if (checkGameEnd()) return;

    currentPlayer = symbol === "X" ? "O" : "X";

    if (
        isComputerMode() &&
        currentPlayer === computerSymbol()
    ) {
        scheduleComputerTurn();
    } else {
        renderBoard();
        updateStatus();
    }
}

function checkGameEnd() {
    const result = getWinner(board);

    if (result) {
        gameOver = true;
        scores[result.winner]++;

        saveScores();
        updateScores();
        renderBoard(result.line);
        updatePlayers();

        statusText.textContent =
            playerName(result.winner) + " wins! ✦";

        playSound(760, 0.25);
        showToast(playerName(result.winner) + " wins the round!");
        return true;
    }

    if (isDraw(board)) {
        gameOver = true;
        scores.draws++;

        saveScores();
        updateScores();
        renderBoard();
        updatePlayers();

        statusText.textContent = "It's a draw! Good game.";
        playSound(330, 0.2);
        showToast("It's a draw! Try another round.");
        return true;
    }

    return false;
}

// EASY: choose a random empty cell.
function easyMove(state) {
    const moves = availableMoves(state);

    if (moves.length === 0) return -1;

    return moves[Math.floor(Math.random() * moves.length)];
}

// Return a move that wins immediately, if one exists.
function findWinningMove(state, symbol) {
    for (const index of availableMoves(state)) {
        state[index] = symbol;

        const result = getWinner(state);

        state[index] = "";

        if (result && result.winner === symbol) {
            return index;
        }
    }

    return -1;
}

// MEDIUM: win, block, then prefer center and corners.
function mediumMove(state) {
    let move = findWinningMove(state, computerSymbol());

    if (move !== -1) return move;

    move = findWinningMove(state, humanSymbol());

    if (move !== -1) return move;

    if (state[4] === "") return 4;

    const corners = [0, 2, 6, 8].filter(
        index => state[index] === ""
    );

    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }

    return easyMove(state);
}

// HARD: minimax searches all possible game outcomes.
function minimax(state, depth, maximizing) {
    const result = getWinner(state);

    if (result) {
        if (result.winner === computerSymbol()) {
            return 10 - depth;
        }

        return depth - 10;
    }

    if (isDraw(state)) return 0;

    if (maximizing) {
        let bestScore = -Infinity;

        for (const index of availableMoves(state)) {
            state[index] = computerSymbol();

            const score = minimax(state, depth + 1, false);

            state[index] = "";
            bestScore = Math.max(bestScore, score);
        }

        return bestScore;
    }

    let bestScore = Infinity;

    for (const index of availableMoves(state)) {
        state[index] = humanSymbol();

        const score = minimax(state, depth + 1, true);

        state[index] = "";
        bestScore = Math.min(bestScore, score);
    }

    return bestScore;
}

function hardMove(state) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const index of availableMoves(state)) {
        state[index] = computerSymbol();

        const score = minimax(state, 0, false);

        state[index] = "";

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [index];
        } else if (score === bestScore) {
            bestMoves.push(index);
        }
    }

    if (bestMoves.length === 0) return -1;

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function chooseComputerMove() {
    if (difficultySelect.value === "easy") {
        return easyMove(board);
    }

    if (difficultySelect.value === "medium") {
        return mediumMove(board);
    }

    return hardMove(board);
}

function resetBoard(incrementRound = false) {
    cancelComputerTurn();

    if (incrementRound) {
        roundNumber++;
    }

    board = Array(9).fill("");
    moveHistory = [];
    currentPlayer = "X";
    gameOver = false;

    document.getElementById("roundBadge").textContent =
        "ROUND " + String(roundNumber).padStart(2, "0");

    updateNames();
    renderBoard();
    updateStatus();

    if (isComputerMode() && currentPlayer === computerSymbol()) {
        scheduleComputerTurn();
    }
}

function undoMove() {
    if (moveHistory.length === 0) {
        showToast("There are no moves to undo.");
        return;
    }

    cancelComputerTurn();

    if (gameOver) {
        // Reverse the completed result as well as the last move.
        const result = getWinner(board);

        if (result) {
            scores[result.winner]--;
        } else if (isDraw(board)) {
            scores.draws--;
        }

        saveScores();
        updateScores();
    }

    let previous = moveHistory.pop();

    if (isComputerMode()) {
        // Undo the last move. If that was the AI, undo the
        // human move before it too, when available.
        if (
            previous.player === computerSymbol() &&
            moveHistory.length > 0
        ) {
            previous = moveHistory.pop();
        }
    }

    board = previous.board.slice();
    currentPlayer = previous.player;
    gameOver = false;

    renderBoard();
    updateStatus();

    showToast("Move undone.");
}

function changeMode() {
    difficultySelect.disabled = !isComputerMode();

    resetBoard();
}

function toggleTheme() {
    const isLight = document.body.classList.toggle("light");

    themeBtn.textContent = isLight ? "☾" : "☼";
    themeBtn.setAttribute(
        "aria-label",
        isLight ? "Switch to dark theme" : "Switch to light theme"
    );

    try {
        localStorage.setItem(
            "tictacTheme",
            isLight ? "light" : "dark"
        );
    } catch (error) {
        // Theme still works for this session.
    }
}

function initializeTheme() {
    let savedTheme = "dark";

    try {
        savedTheme = localStorage.getItem("tictacTheme") || "dark";
    } catch (error) {
        // Use dark mode by default.
    }

    document.body.classList.toggle("light", savedTheme === "light");

    themeBtn.textContent = savedTheme === "light" ? "☾" : "☼";
    themeBtn.setAttribute(
        "aria-label",
        savedTheme === "light" ? "Switch to dark theme" : "Switch to light theme"
    );
}

// Game events
cells.forEach(cell => {
    cell.addEventListener("click", () => {
        if (cell.disabled) return;

        if (
            isComputerMode() &&
            currentPlayer === computerSymbol()
        ) {
            return;
        }

        playMove(Number(cell.dataset.index));
    });
});

restartBtn.addEventListener("click", () => {
    resetBoard();
    showToast("Round restarted.");
});

newBtn.addEventListener("click", () => {
    resetBoard(true);
    showToast("A new round begins!");
});

undoBtn.addEventListener("click", undoMove);

modeSelect.addEventListener("change", changeMode);

difficultySelect.addEventListener("change", () => {
    resetBoard();
    showToast("Difficulty updated.");
});

themeBtn.addEventListener("click", toggleTheme);

soundToggle.addEventListener("change", () => {
    soundIcon.textContent = soundToggle.checked ? "♫" : "♪";

    if (soundToggle.checked) {
        playSound(520);
    }
});

resetScoresBtn.addEventListener("click", () => {
    if (!confirm("Reset all scores and match statistics?")) {
        return;
    }

    scores = { X: 0, O: 0, draws: 0 };

    saveScores();
    updateScores();
    showToast("All scores have been reset.");
});

// Initial setup
initializeTheme();
updateNames();
updateScores();
resetBoard();
