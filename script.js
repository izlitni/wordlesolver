
const MISS = 0;
const MISPLACED = 1;
const EXACT = 2;

const STATE_CLASSES = {
    [MISS]: 'absent',
    [MISPLACED]: 'present',
    [EXACT]: 'correct',
    'empty': 'empty',
    'filled': 'filled'
};

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

// State
let currentGuessIndex = 0;
let currentGuessChars = [];
let gridState = []; // Array of rows, each row is array of {char, status}
let possibleWords = []; // Filtered list
let secretWord = null; // For simulation mode (optional, currently we rely on manual input or finding best guess)

// DOM Elements
const gridContainer = document.getElementById('grid-container');
const messageDisplay = document.querySelector('.stats-card'); 
const topPicksList = document.getElementById('top-picks-list');
const chartContainer = document.getElementById('distribution-chart');
const possibilitiesCount = document.getElementById('possibilities-count');
const uncertaintyBits = document.getElementById('uncertainty-bits');
const guessInput = document.getElementById('guess-input');

// Initialize
function init() {
    possibleWords = [...POSSIBLE_WORDS]; // Copy from data.js
    createGrid();
    setupEventListeners();
    updateStats();
    
    // Initial calculation for "Top Picks" (Start with optimal openers if empty)
    // For performance, we might just hardcode the first one or ask user to click calculate
    topPicksList.innerHTML = '<div class="loading-state">Type a word or click Calculate to see suggestions.</div>';
    
    // Show welcome modal ONLY if not seen before
    const hasSeenWelcome = localStorage.getItem('wordleAnalyzerCompletedWelcome');
    if (!hasSeenWelcome) {
        showWelcomeModal();
        localStorage.setItem('wordleAnalyzerCompletedWelcome', 'true');
    }
    
    updateProgressBar();
}

function updateProgressBar() {
    const total = POSSIBLE_WORDS.length;
    const current = possibleWords.length;
    
    // Calculate percentage eliminated
    // If current == total, 0% complete
    // If current == 1, 100% complete
    
    let percentage = 0;
    if (current === 1) {
        percentage = 100;
    } else {
        percentage = ((total - current) / (total - 1)) * 100;
    }
    
    // Clamp
    percentage = Math.max(0, Math.min(100, percentage));
    
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    
    bar.style.width = `${percentage}%`;
    
    if (current === 1) {
        text.textContent = `100%`;
        bar.style.background = 'var(--green)';
    } else {
        text.textContent = `${percentage.toFixed(0)}%`;
        bar.style.background = ''; // Reset to default gradient
    }
}

// Modal System
function showModal(title, body, okText = 'Got it!') {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalOk = document.getElementById('modal-ok');
    
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalOk.textContent = okText;
    modal.classList.add('show');
}

function hideModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
}

function showWelcomeModal() {
    const body = `
        <strong>🎯 Welcome to the Wordle Analyzer!</strong>
        <p>This tool uses information theory to help you solve Wordle puzzles optimally.</p>
        <ul>
            <li><strong>Step 1:</strong> Play Wordle on the official site</li>
            <li><strong>Step 2:</strong> Type your guess here</li>
            <li><strong>Step 3:</strong> Click tiles to match the colors (Grey → Yellow → Green)</li>
            <li><strong>Step 4:</strong> Press Enter to filter possibilities</li>
            <li><strong>Bonus:</strong> Use "Calculate Best Guesses" to find optimal moves!</li>
        </ul>
        <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">💡 Open browser console (F12) for detailed debugging</p>
    `;
    showModal('How to Use', body, 'Let\'s Go!');
}

function showRemainingWords() {
    const count = possibleWords.length;
    
    if (count === 0) {
        showModal('📭 No Remaining Words', '<p>There are no possible words that match your current guesses.</p>', 'OK');
        return;
    }
    
    let body = `<p>Currently <strong>${count}</strong> possible word${count !== 1 ? 's' : ''} remaining:</p>`;
    
    if (count <= 100) {
        // Show all words in a grid
        const wordsGrid = possibleWords
            .map(word => `<span class="word-chip">${word.toUpperCase()}</span>`)
            .join('');
        body += `<div class="words-grid">${wordsGrid}</div>`;
    } else {
        // Show first 50 and indicate there are more
        const wordsGrid = possibleWords.slice(0, 50)
            .map(word => `<span class="word-chip">${word.toUpperCase()}</span>`)
            .join('');
        body += `<div class="words-grid">${wordsGrid}</div>`;
        body += `<p style="margin-top: 10px; font-size: 0.9em; opacity: 0.7;">...and ${count - 50} more. Keep filtering to narrow down!</p>`;
    }
    
    showModal(`📝 Remaining Words (${count})`, body, 'Close');
}


function createGrid() {
    gridContainer.innerHTML = '';
    gridState = [];
    
    for (let r = 0; r < MAX_GUESSES; r++) {
        const rowData = [];
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';
        
        for (let c = 0; c < WORD_LENGTH; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.row = r;
            tile.dataset.col = c;
            tile.dataset.state = 'empty';
            
            // Allow clicking to toggle state only for current or past rows
            tile.addEventListener('click', () => toggleTileState(r, c));
            
            rowDiv.appendChild(tile);
            rowData.push({ char: '', status: MISS }); // Default to MISS (grey)
        }
        gridContainer.appendChild(rowDiv);
        gridState.push(rowData);
    }
}

function setupEventListeners() {
    // Modal listeners
    document.getElementById('modal-ok').addEventListener('click', hideModal);
    document.querySelector('.modal-close').addEventListener('click', hideModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') hideModal();
    });
    
    // Show remaining words button
    document.getElementById('show-words-btn').addEventListener('click', showRemainingWords);
    
    // Help button
    document.getElementById('help-btn').addEventListener('click', showWelcomeModal);
    
    // Progress Bar Toggles
    const progressContainer = document.getElementById('progress-container');
    const showProgressBtn = document.getElementById('show-progress-btn');
    
    document.getElementById('close-progress-btn').addEventListener('click', () => {
        progressContainer.classList.add('hidden');
        showProgressBtn.classList.remove('hidden');
    });
    
    document.getElementById('show-progress-btn').addEventListener('click', () => {
        progressContainer.classList.remove('hidden');
        showProgressBtn.classList.add('hidden');
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        currentGuessIndex = 0;
        currentGuessChars = [];
        possibleWords = [...POSSIBLE_WORDS];
        guessInput.value = '';
        guessInput.disabled = false;
        createGrid();
        updateStats();
        updateProgressBar();
        topPicksList.innerHTML = '<div class="loading-state">Click Calculate to see suggestions.</div>';
        document.getElementById('distribution-chart').innerHTML = '<div class="chart-placeholder">Select a word to see distribution</div>';
    });

    document.getElementById('submit-btn').addEventListener('click', handleSubmit);

    
    // Calculate button
    document.getElementById('calc-entropy-btn').addEventListener('click', () => {
        calculateBestGuesses();
    });

    // Input handling
    guessInput.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
        guessInput.value = val;
        updateCurrentRowInternal(val);
    });

    guessInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });

    // Global Key Listener for typing without focus
    document.addEventListener('keydown', (e) => {
        // If user is already focused on input or Ctrl/Alt/Meta is pressed, ignore
        if (document.activeElement === guessInput || e.ctrlKey || e.altKey || e.metaKey) return;

        // Enter key
        if (e.key === 'Enter') {
            handleSubmit();
            return;
        }

        // Backspace
        if (e.key === 'Backspace') {
            guessInput.value = guessInput.value.slice(0, -1);
            return;
        }

        // Letters A-Z
        if (/^[a-zA-Z]$/.test(e.key)) {
            if (guessInput.value.length < 5) {
                guessInput.value += e.key;
            }
            // Trigger input event manually to update grid
            guessInput.dispatchEvent(new Event('input'));
        }
    });
}

function updateCurrentRowInternal(text) {
    if (currentGuessIndex >= MAX_GUESSES) return;
    
    const row = gridContainer.children[currentGuessIndex];
    currentGuessChars = text.split('');
    
    for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = row.children[c];
        const char = currentGuessChars[c] || '';
        tile.textContent = char;
        
        // Update visual state
        if (char) {
            tile.dataset.state = 'filled';
            // If we are editing, reset the internal status to MISS if it was empty, 
            // but keep it if user already toggled it (complex interaction, let's simplify)
            // Simplify: Just set char. Status is controlled by click.
        } else {
            tile.dataset.state = 'empty';
        }
    }
}

function toggleTileState(r, c) {
    // Only allow toggling for active or past rows
    if (r > currentGuessIndex) return;
    // If r is current row, only if it has a char
    if (r === currentGuessIndex && !currentGuessChars[c]) return;

    const rowData = gridState[r];
    const item = rowData[c];
    
    // Cycle: MISS -> MISPLACED -> EXACT -> MISS
    item.status = (item.status + 1) % 3;
    
    // Update UI
    const tile = gridContainer.children[r].children[c];
    tile.dataset.state = STATE_CLASSES[item.status];
}

function handleSubmit() {
    const word = guessInput.value.toLowerCase();
    
    if (word.length !== 5) {
        showModal('⚠️ Invalid Length', '<p>Please enter a 5-letter word.</p>', 'OK');
        return;
    }
    
    if (!ALLOWED_WORDS.includes(word)) {
        showModal('❌ Invalid Word', '<p>This word is not in the Wordle word list.</p><p style="margin-top: 8px; opacity: 0.8;">Try a different word!</p>', 'OK');
        return;
    }

    // Lock in the word chars into gridState
    for(let i=0; i<5; i++) {
        gridState[currentGuessIndex][i].char = word[i];
    }
    
    // Update possible words based on the CURRENT row's pattern (set manually or by default)
    // NOTE: In this "Solver" mode, we assume the user sets the colors THEN hits enter to confirm "this is what happened".
    // OR: They type the word, hit Enter, then colors default to Grey, then they click to fix, then they hit "Update"?
    // Let's go with: Type -> Enter -> (Locks row, assumes Grey) -> User clicks to adjust -> User clicks "Apply/Next" button?
    
    // To make it smoother: 
    // Type -> Enter moves to next row ONLY, but doesn't filter yet.
    // We need an explicit "Filter/Apply" action, or we do it on Next Row.
    // Let's do: "Enter" submits the guess AND filters based on the CURRENT visible colors.
    // So user should set colors BEFORE hitting Enter? That's annoying because they can't see the letters on the board well until they type.
    
    // Better flow:
    // 1. Type word. (Visuals appear)
    // 2. Click colors to match reality.
    // 3. Hit "Enter" to Commit and Filter.
    
    const rowData = gridState[currentGuessIndex];
    
    // Read status from UI dataset if needed, but we updated gridState in toggleTile
    
    // Construct pattern
    // pattern is ternary converted to int? Or just array?
    // Let's use array for `getPossibleWords`
    const pattern = rowData.map(d => d.status);
    
    // Filter possibilities
    const beforeCount = possibleWords.length;
    possibleWords = getPossibleWords(word, pattern, possibleWords);
    
    console.log(`Guess "${word.toUpperCase()}" with pattern [${pattern.map(s => ['⬜', '🟨', '🟩'][s]).join('')}]`);
    console.log(`Filtered from ${beforeCount} to ${possibleWords.length} words`);
    if (possibleWords.length <= 10 && possibleWords.length > 0) {
        console.log(`Remaining words: ${possibleWords.join(', ')}`);
    }
    
    updateStats();
    updateProgressBar();
    
    // Move to next
    currentGuessIndex++;
    currentGuessChars = [];
    guessInput.value = '';
    
    if (possibleWords.length === 1) {
        showModal('🎉 Solution Found!', `<p style="text-align: center; font-size: 1.5rem; font-weight: bold; color: var(--accent-color);">${possibleWords[0].toUpperCase()}</p>`, 'Awesome!');
    } else if (possibleWords.length === 0) {
        showModal('❌ No Matches', `
            <p>This combination of guesses is impossible.</p>
            <p><strong>Check that:</strong></p>
            <ul>
                <li>Colors match your actual Wordle game</li>
                <li>You didn't make a mistake in previous guesses</li>
            </ul>
            <p style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">💡 Check the browser console (F12) for details</p>
        `, 'OK');
    } else if (possibleWords.length <= 10) {
        console.log(`💡 Only ${possibleWords.length} possibilities left: ${possibleWords.join(', ')}`);
    }
}

// Logic

function getPattern(guess, answer) {
    // 0: Grey, 1: Yellow, 2: Green
    const result = Array(5).fill(MISS);
    const answerArr = answer.split('');
    const guessArr = guess.split('');
    
    // Pass 1: Exact matches
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === answerArr[i]) {
            result[i] = EXACT;
            answerArr[i] = null; // Mark used
            guessArr[i] = null;
        }
    }
    
    // Pass 2: Misplaced
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] !== null) { // If not already matched
            const idx = answerArr.indexOf(guessArr[i]);
            if (idx !== -1) {
                result[i] = MISPLACED;
                answerArr[idx] = null; // Mark used
            }
        }
    }
    
    return result;
}

function getPossibleWords(guess, pattern, wordList) {
    return wordList.filter(word => {
        const p = getPattern(guess, word);
        // Compare p with pattern
        for(let i=0; i<5; i++) {
            if (p[i] !== pattern[i]) return false;
        }
        return true;
    });
}

function getEntropy(guess, wordList) {
    const buckets = {};
    const total = wordList.length;
    
    // Bucketize
    for (const answer of wordList) {
        const p = getPattern(guess, answer);
        const pStr = p.join(''); // Simple hash
        buckets[pStr] = (buckets[pStr] || 0) + 1;
    }
    
    // Calculate Entropy
    let entropy = 0;
    for (const key in buckets) {
        const count = buckets[key];
        const prob = count / total;
        entropy -= prob * Math.log2(prob);
    }
    
    return entropy;
}


function calculateBestGuesses() {
    topPicksList.innerHTML = '<div class="loading-state">Calculating...</div>';
    
    // Start iterative calculation with chunking
    const candidates = ALLOWED_WORDS;
    const totalCandidates = candidates.length;
    const CHUNK_SIZE = 100; // Process 100 candidates per frame
    let index = 0;
    const results = [];
    const startTime = performance.now();

    function processChunk() {
        const end = Math.min(index + CHUNK_SIZE, totalCandidates);
        
        for (let i = index; i < end; i++) {
            const guess = candidates[i];
            const ent = getEntropy(guess, possibleWords);
            results.push({ word: guess, entropy: ent });
        }
        
        index = end;
        
        if (index < totalCandidates) {
            // Update progress occasionally
            if (index % 1000 === 0) {
                topPicksList.innerHTML = `<div class="loading-state">Calculated ${index} / ${totalCandidates}...</div>`;
            }
            // Schedule next chunk
            setTimeout(processChunk, 0);
        } else {
            // Done
            const duration = (performance.now() - startTime).toFixed(2);
            console.log(`Calculation took ${duration}ms`);
            
            results.sort((a, b) => b.entropy - a.entropy);
            renderTopPicks(results.slice(0, 20)); // Top 20
            
            if (results.length > 0) {
                renderDistribution(results[0].word); // Default to #1
            }
        }
    }

    processChunk();
}

function renderTopPicks(picks) {
    topPicksList.innerHTML = '';
    
    // Header
    const header = document.createElement('div');
    header.className = 'list-item';
    header.style.borderBottom = '1px solid #444';
    header.style.color = '#888';
    header.style.cursor = 'default';
    header.innerHTML = '<span>Word</span><span>Bits</span>';
    topPicksList.appendChild(header);
    
    picks.forEach(pick => {
        const div = document.createElement('div');
        div.className = 'list-item';
        
        const wordSpan = document.createElement('span');
        wordSpan.textContent = pick.word;
        
        const scoreSpan = document.createElement('span');
        scoreSpan.textContent = pick.entropy.toFixed(2);
        scoreSpan.className = 'highlight';
        
        div.appendChild(wordSpan);
        div.appendChild(scoreSpan);
        
        div.addEventListener('click', () => {
            renderDistribution(pick.word);
            // Highlight selected
            Array.from(topPicksList.children).forEach(c => c.style.background = '');
            div.style.background = '#333';
        });
        
        topPicksList.appendChild(div);
    });
}

function renderDistribution(guess) {
    chartContainer.innerHTML = '';
    
    // Calculate distribution for this specific guess
    const buckets = {};
    possibleWords.forEach(word => {
        const p = getPattern(guess, word);
        // Convert pattern array to integer for sorting: 0*3^0 + 1*3^1 ...
        // 3b1b uses base 3 representation
        // reverse pattern to match 3b1b? Usually [0] is first letter.
        // Let's just use string key for buckets, but int for sorting.
        let val = 0;
        for(let i=0; i<5; i++) val += p[i] * Math.pow(3, 4-i); // Base 3, big endian
        buckets[val] = (buckets[val] || 0) + 1;
    });
    
    const sortedVals = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    const maxCount = Math.max(...Object.values(buckets));
    const total = possibleWords.length;

    // Create a container for bars
    sortedVals.forEach(val => {
        const count = buckets[val];
        const heightPct = (count / maxCount) * 100;
        
        const barWrapper = document.createElement('div');
        barWrapper.style.flex = '1';
        barWrapper.style.display = 'flex';
        barWrapper.style.flexDirection = 'column';
        barWrapper.style.alignItems = 'center';
        barWrapper.style.justifyContent = 'flex-end';
        barWrapper.style.height = '100%';
        barWrapper.title = `Pattern ${val}: ${count} (${(count/total*100).toFixed(1)}%)`;
        
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.width = '80%';
        bar.style.height = `${heightPct}%`;
        
        barWrapper.appendChild(bar);
        chartContainer.appendChild(barWrapper);
    });
}

function updateStats() {
    possibilitiesCount.textContent = possibleWords.length;
    
    if (possibleWords.length > 0) {
        // Entropy of the uniform distribution over remaining words
        // H = - sum( 1/N * log2(1/N) ) = log2(N)
        const bits = Math.log2(possibleWords.length);
        uncertaintyBits.textContent = `${bits.toFixed(2)} bits`;
    } else {
        uncertaintyBits.textContent = "0 bits";
    }
}

// Start
init();
