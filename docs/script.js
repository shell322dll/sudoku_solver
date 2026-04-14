const STORAGE_KEY = "sudoku-solver-grid-v1";
const SIZE = 9;
const CELL_COUNT = SIZE * SIZE;

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const numberPad = document.getElementById("number-pad");
const solveButton = document.getElementById("solve-button");
const checkButton = document.getElementById("check-button");
const resetButton = document.getElementById("reset-button");
const eraseButton = document.getElementById("erase-button");
const clearCellButton = document.getElementById("clear-cell-button");

const grid = loadGrid();
let selectedIndex = 0;

renderBoard();
selectCell(0);
updateBoardState();
registerServiceWorker();

numberPad.addEventListener("click", (event) => {
  const button = event.target.closest("[data-value]");
  if (!button) {
    return;
  }

  setCellValue(selectedIndex, Number(button.dataset.value));
});

solveButton.addEventListener("click", () => {
  const validation = findConflicts(grid);
  if (validation.invalidIndexes.size > 0) {
    statusElement.textContent = "Сначала исправьте конфликтующие цифры.";
    updateBoardState(validation.invalidIndexes);
    return;
  }

  const solved = solveSudoku([...grid]);
  if (!solved) {
    statusElement.textContent = "Для этих данных решение не найдено.";
    return;
  }

  for (let index = 0; index < CELL_COUNT; index += 1) {
    grid[index] = solved[index];
  }

  saveGrid();
  updateBoardState();
  statusElement.textContent = "Готово: судоку решено.";
});

checkButton.addEventListener("click", () => {
  const { invalidIndexes } = findConflicts(grid);
  updateBoardState(invalidIndexes);

  if (invalidIndexes.size > 0) {
    statusElement.textContent = "Есть конфликтующие клетки. Они подсвечены.";
    return;
  }

  statusElement.textContent = grid.every(Boolean)
    ? "Ошибок не найдено. Сетка заполнена."
    : "Ошибок не найдено. Можно решать дальше.";
});

resetButton.addEventListener("click", () => {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    grid[index] = 0;
  }

  saveGrid();
  updateBoardState();
  statusElement.textContent = "Поле очищено.";
});

eraseButton.addEventListener("click", () => {
  setCellValue(selectedIndex, 0);
});

clearCellButton.addEventListener("click", () => {
  setCellValue(selectedIndex, 0);
});

document.addEventListener("keydown", (event) => {
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

  grid[index] = value;
  saveGrid();
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

    cell.textContent = value === 0 ? "" : String(value);
    cell.classList.toggle("selected", index === selectedIndex);
    cell.classList.toggle("related", row === selectedRow || col === selectedCol || box === selectedBox);
    cell.classList.toggle("invalid", invalidIndexes.has(index));
    cell.setAttribute("aria-label", `Строка ${row + 1}, столбец ${col + 1}, значение ${value || "пусто"}`);
  }
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

function loadGrid() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return new Array(CELL_COUNT).fill(0);
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length !== CELL_COUNT) {
      return new Array(CELL_COUNT).fill(0);
    }

    return parsed.map((value) => (Number.isInteger(value) && value >= 0 && value <= 9 ? value : 0));
  } catch {
    return new Array(CELL_COUNT).fill(0);
  }
}

function saveGrid() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(grid));
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
