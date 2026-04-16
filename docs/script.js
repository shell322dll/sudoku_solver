const STORAGE_KEY = "sudoku-solver-state-v4";
const SIZE = 9;
const CELL_COUNT = SIZE * SIZE;
const EXPERT_CLUES = 17;
const EXPERT_PUZZLES = [
  {
    grid: "000000010400000000020000000000050407008000300001090000300400200050100000000806000",
    solution: "693784512487512936125963874932651487568247391741398625319475268856129743274836159",
  },
];

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const numberPad = document.getElementById("number-pad");
const solveButton = document.getElementById("solve-button");
const checkButton = document.getElementById("check-button");
const resetButton = document.getElementById("reset-button");
const eraseButton = document.getElementById("erase-button");
const newPuzzleButton = document.getElementById("new-puzzle-button");
const hintButton = document.getElementById("hint-button");

const state = loadState();
const grid = state.grid;
const cellSources = state.cellSources;
let puzzleSolution = state.puzzleSolution;
let selectedIndex = 0;
let isGenerating = false;

renderBoard();
selectCell(0);
updateBoardState();
registerServiceWorker();

numberPad.addEventListener("click", (event) => {
  const button = event.target.closest("[data-value]");
  if (!button || isGenerating) {
    return;
  }

  setCellValue(selectedIndex, Number(button.dataset.value));
});

newPuzzleButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  setGenerating(true);
  const startedAt = performance.now();
  statusElement.textContent = "Готовлю экспертную задачу с 17 известными цифрами...";

  generateExpertPuzzleAsync(() => {
    statusElement.textContent = `Генерирую задачу с 17 известными цифрами. Прошло: ${formatDuration(performance.now() - startedAt)}.`;
  }).then((puzzle) => {
    applyPuzzle(puzzle.grid, puzzle.solution);
    setGenerating(false);
    statusElement.textContent = `Задача готова: 17 известных цифр, одно решение. Время генерации: ${formatDuration(performance.now() - startedAt)}.`;
  });
});

hintButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  if (!puzzleSolution) {
    statusElement.textContent = "Сначала создайте новую задачу.";
    return;
  }

  const hiddenIndexes = grid
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value === 0)
    .map(({ index }) => index);

  if (hiddenIndexes.length === 0) {
    statusElement.textContent = "Все клетки уже открыты.";
    return;
  }

  const hintedIndex = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
  grid[hintedIndex] = puzzleSolution[hintedIndex];
  cellSources[hintedIndex] = "hint";
  selectedIndex = hintedIndex;
  saveState();
  updateBoardState();
  statusElement.textContent = "Подсказка открыла одну клетку.";
});

solveButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  const validation = findConflicts(grid);
  if (validation.invalidIndexes.size > 0) {
    statusElement.textContent = "Сначала исправьте конфликтующие цифры.";
    updateBoardState(validation.invalidIndexes);
    return;
  }

  const solved = puzzleSolution ? [...puzzleSolution] : solveSudoku([...grid]);
  if (!solved) {
    statusElement.textContent = "Для этих данных решение не найдено.";
    return;
  }

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (cellSources[index] !== "given") {
      cellSources[index] = "solved";
    }
    grid[index] = solved[index];
  }

  saveState();
  updateBoardState();
  statusElement.textContent = "Готово: судоку решено.";
});

checkButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  const { invalidIndexes } = findConflicts(grid);
  updateBoardState(invalidIndexes);

  if (invalidIndexes.size > 0) {
    statusElement.textContent = "Есть конфликтующие клетки. Они подсвечены.";
    return;
  }

  if (puzzleSolution && grid.some((value, index) => value !== 0 && value !== puzzleSolution[index])) {
    statusElement.textContent = "Есть цифры, которые не совпадают с решением.";
    return;
  }

  statusElement.textContent = grid.every(Boolean)
    ? "Ошибок не найдено. Сетка заполнена."
    : "Ошибок не найдено. Можно решать дальше.";
});

resetButton.addEventListener("click", () => {
  if (isGenerating) {
    return;
  }

  for (let index = 0; index < CELL_COUNT; index += 1) {
    grid[index] = 0;
    cellSources[index] = "empty";
  }

  puzzleSolution = null;
  saveState();
  updateBoardState();
  statusElement.textContent = "Поле очищено.";
});

eraseButton.addEventListener("click", () => {
  if (!isGenerating) {
    setCellValue(selectedIndex, 0);
  }
});

document.addEventListener("keydown", (event) => {
  if (isGenerating) {
    return;
  }

  if (event.key >= "1" && event.key <= "9") {
    setCellValue(selectedIndex, Number(event.key));
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
    setCellValue(selectedIndex, 0);
    return;
  }

  const movement = {
    ArrowUp: -SIZE,
    ArrowDown: SIZE,
    ArrowLeft: -1,
    ArrowRight: 1,
  }[event.key];

  if (movement === undefined) {
    return;
  }

  event.preventDefault();
  moveSelection(movement, event.key);
});

function renderBoard() {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.index = String(index);
    button.dataset.row = String(Math.floor(index / SIZE));
    button.dataset.col = String(index % SIZE);
    button.setAttribute("role", "gridcell");
    button.addEventListener("click", () => selectCell(index));
    fragment.appendChild(button);
  }

  boardElement.replaceChildren(fragment);
}

function selectCell(index) {
  selectedIndex = index;
  updateBoardState();
}

function moveSelection(step, key) {
  const row = Math.floor(selectedIndex / SIZE);
  const col = selectedIndex % SIZE;
  let nextIndex = selectedIndex + step;

  if (key === "ArrowLeft" && col === 0) {
    nextIndex = selectedIndex + (SIZE - 1);
  } else if (key === "ArrowRight" && col === SIZE - 1) {
    nextIndex = selectedIndex - (SIZE - 1);
  } else if (key === "ArrowUp" && row === 0) {
    nextIndex = selectedIndex + SIZE * (SIZE - 1);
  } else if (key === "ArrowDown" && row === SIZE - 1) {
    nextIndex = selectedIndex % SIZE;
  }

  selectCell(nextIndex);
}

function setCellValue(index, value) {
  if (value < 0 || value > 9) {
    return;
  }

  if (cellSources[index] === "given" || cellSources[index] === "hint") {
    statusElement.textContent = "Исходные цифры и подсказки нельзя менять.";
    return;
  }

  grid[index] = value;
  cellSources[index] = value === 0 ? "empty" : "user";
  saveState();
  updateBoardState();

  if (value === 0) {
    statusElement.textContent = "Клетка очищена.";
    return;
  }

  statusElement.textContent = `Установлено число ${value}.`;
  selectCell((index + 1) % CELL_COUNT);
}

function updateBoardState(invalidIndexes = findConflicts(grid).invalidIndexes) {
  const selectedRow = Math.floor(selectedIndex / SIZE);
  const selectedCol = selectedIndex % SIZE;
  const selectedBox = getBoxIndex(selectedRow, selectedCol);
  const cells = boardElement.children;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const cell = cells[index];
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const box = getBoxIndex(row, col);
    const value = grid[index];
    const source = cellSources[index];

    cell.textContent = value === 0 ? "" : String(value);
    cell.classList.toggle("selected", index === selectedIndex);
    cell.classList.toggle("related", row === selectedRow || col === selectedCol || box === selectedBox);
    cell.classList.toggle("invalid", invalidIndexes.has(index));
    cell.classList.toggle("given-value", source === "given" && value !== 0);
    cell.classList.toggle("user-value", source === "user" && value !== 0);
    cell.classList.toggle("solved-value", (source === "solved" || source === "hint") && value !== 0);
    cell.setAttribute("aria-label", `Строка ${row + 1}, столбец ${col + 1}, значение ${value || "пусто"}`);
  }
}

function applyPuzzle(puzzleGrid, solution) {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    grid[index] = puzzleGrid[index];
    cellSources[index] = puzzleGrid[index] === 0 ? "empty" : "given";
  }

  puzzleSolution = [...solution];
  selectedIndex = puzzleGrid.findIndex((value) => value === 0);
  if (selectedIndex === -1) {
    selectedIndex = 0;
  }

  saveState();
  updateBoardState();
}

function setGenerating(value) {
  isGenerating = value;
  [newPuzzleButton, hintButton, solveButton, checkButton, resetButton, eraseButton].forEach((button) => {
    button.disabled = value;
  });
}

function generateExpertPuzzleAsync(onProgress) {
  return new Promise((resolve) => {
    setTimeout(() => {
      onProgress();
      resolve(createExpertPuzzleVariant());
    }, 40);
  });
}

function createExpertPuzzleVariant() {
  const source = EXPERT_PUZZLES[Math.floor(Math.random() * EXPERT_PUZZLES.length)];
  const grid = source.grid.split("").map(Number);
  const solution = source.solution.split("").map(Number);
  const digitMap = createDigitMap();
  const rowMap = createHouseMap();
  const colMap = createHouseMap();
  const transpose = Math.random() < 0.5;

  return {
    grid: transformSudoku(grid, digitMap, rowMap, colMap, transpose),
    solution: transformSudoku(solution, digitMap, rowMap, colMap, transpose),
  };
}

function transformSudoku(values, digitMap, rowMap, colMap, transpose) {
  const transformed = new Array(CELL_COUNT).fill(0);

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const sourceRow = transpose ? colMap[col] : rowMap[row];
      const sourceCol = transpose ? rowMap[row] : colMap[col];
      const value = values[sourceRow * SIZE + sourceCol];
      transformed[row * SIZE + col] = value === 0 ? 0 : digitMap[value];
    }
  }

  return transformed;
}

function createDigitMap() {
  const shuffledDigits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digitMap = new Array(10).fill(0);

  for (let index = 0; index < shuffledDigits.length; index += 1) {
    digitMap[index + 1] = shuffledDigits[index];
  }

  return digitMap;
}

function createHouseMap() {
  const bands = shuffle([0, 1, 2]);
  const map = [];

  for (const band of bands) {
    const rows = shuffle([0, 1, 2]);
    for (const row of rows) {
      map.push(band * 3 + row);
    }
  }

  return map;
}

function getCandidates(values, index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const candidates = [];

  for (let digit = 1; digit <= 9; digit += 1) {
    if (canPlace(values, row, col, digit)) {
      candidates.push(digit);
    }
  }

  return candidates;
}

function canPlace(values, row, col, digit) {
  for (let offset = 0; offset < SIZE; offset += 1) {
    if (values[row * SIZE + offset] === digit || values[offset * SIZE + col] === digit) {
      return false;
    }
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;

  for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
    for (let colOffset = 0; colOffset < 3; colOffset += 1) {
      if (values[(startRow + rowOffset) * SIZE + startCol + colOffset] === digit) {
        return false;
      }
    }
  }

  return true;
}

function solveSudoku(values) {
  const rows = new Uint16Array(SIZE);
  const cols = new Uint16Array(SIZE);
  const boxes = new Uint16Array(SIZE);

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = values[index];
    if (value === 0) {
      continue;
    }

    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const box = getBoxIndex(row, col);
    const mask = 1 << value;

    if ((rows[row] & mask) || (cols[col] & mask) || (boxes[box] & mask)) {
      return null;
    }

    rows[row] |= mask;
    cols[col] |= mask;
    boxes[box] |= mask;
  }

  const solved = search(values, rows, cols, boxes);
  return solved ? values : null;
}

function search(values, rows, cols, boxes) {
  let bestIndex = -1;
  let bestMask = 0;
  let bestCount = 10;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (values[index] !== 0) {
      continue;
    }

    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const box = getBoxIndex(row, col);
    const used = rows[row] | cols[col] | boxes[box];
    const candidateMask = (~used) & 0x3fe;
    const count = countBits(candidateMask);

    if (count === 0) {
      return false;
    }

    if (count < bestCount) {
      bestCount = count;
      bestMask = candidateMask;
      bestIndex = index;

      if (count === 1) {
        break;
      }
    }
  }

  if (bestIndex === -1) {
    return true;
  }

  const row = Math.floor(bestIndex / SIZE);
  const col = bestIndex % SIZE;
  const box = getBoxIndex(row, col);

  for (let digit = 1; digit <= 9; digit += 1) {
    const mask = 1 << digit;
    if ((bestMask & mask) === 0) {
      continue;
    }

    values[bestIndex] = digit;
    rows[row] |= mask;
    cols[col] |= mask;
    boxes[box] |= mask;

    if (search(values, rows, cols, boxes)) {
      return true;
    }

    values[bestIndex] = 0;
    rows[row] &= ~mask;
    cols[col] &= ~mask;
    boxes[box] &= ~mask;
  }

  return false;
}

function findConflicts(values) {
  const invalidIndexes = new Set();

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = values[index];
    if (value === 0) {
      continue;
    }

    const row = Math.floor(index / SIZE);
    const col = index % SIZE;

    for (let offset = 0; offset < SIZE; offset += 1) {
      const rowIndex = row * SIZE + offset;
      const colIndex = offset * SIZE + col;

      if (rowIndex !== index && values[rowIndex] === value) {
        invalidIndexes.add(index);
        invalidIndexes.add(rowIndex);
      }

      if (colIndex !== index && values[colIndex] === value) {
        invalidIndexes.add(index);
        invalidIndexes.add(colIndex);
      }
    }

    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;

    for (let rowOffset = 0; rowOffset < 3; rowOffset += 1) {
      for (let colOffset = 0; colOffset < 3; colOffset += 1) {
        const relatedIndex = (startRow + rowOffset) * SIZE + startCol + colOffset;
        if (relatedIndex !== index && values[relatedIndex] === value) {
          invalidIndexes.add(index);
          invalidIndexes.add(relatedIndex);
        }
      }
    }
  }

  return { invalidIndexes };
}

function shuffledIndexes() {
  return shuffle([...Array(CELL_COUNT).keys()]);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function countBits(mask) {
  let count = 0;
  let current = mask;

  while (current) {
    current &= current - 1;
    count += 1;
  }

  return count;
}

function getBoxIndex(row, col) {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return "меньше 1 сек.";
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} сек.`;
  }

  return `${minutes} мин. ${seconds} сек.`;
}

function loadState() {
  const emptyState = {
    grid: new Array(CELL_COUNT).fill(0),
    cellSources: new Array(CELL_COUNT).fill("empty"),
    puzzleSolution: null,
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return emptyState;
    }

    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.grid) || parsed.grid.length !== CELL_COUNT) {
      return emptyState;
    }

    const normalizedGrid = parsed.grid.map((value) =>
      Number.isInteger(value) && value >= 0 && value <= 9 ? value : 0
    );

    const normalizedSources = Array.isArray(parsed.cellSources) && parsed.cellSources.length === CELL_COUNT
      ? parsed.cellSources.map((source, index) => {
          if (normalizedGrid[index] === 0) {
            return "empty";
          }

          return ["given", "user", "hint", "solved"].includes(source) ? source : "user";
        })
      : normalizedGrid.map((value) => (value === 0 ? "empty" : "user"));

    const normalizedSolution = Array.isArray(parsed.puzzleSolution) && parsed.puzzleSolution.length === CELL_COUNT
      ? parsed.puzzleSolution.map((value) => (Number.isInteger(value) && value >= 1 && value <= 9 ? value : 0))
      : null;

    return {
      grid: normalizedGrid,
      cellSources: normalizedSources,
      puzzleSolution: normalizedSolution && normalizedSolution.every(Boolean) ? normalizedSolution : null,
    };
  } catch {
    return emptyState;
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      grid,
      cellSources,
      puzzleSolution,
    })
  );
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      statusElement.textContent = "Страница работает, но оффлайн-кэш пока не зарегистрирован.";
    });
  });
}
