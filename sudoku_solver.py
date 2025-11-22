def is_valid_sudoku(board):
    """Проверяет корректность судоку"""
    if len(board) != 9:
        return False
    
    for row in board:
        if len(row) != 9:
            return False
        for num in row:
            if not isinstance(num, int) or num < 0 or num > 9:
                return False
    
    return True


def find_empty(board):
    """Находит пустую клетку (0)"""
    for i in range(9):
        for j in range(9):
            if board[i][j] == 0:
                return (i, j)
    return None


def is_valid(board, num, pos):
    """Проверяет можно ли поставить число"""
    row, col = pos
    
    # Проверка строки
    for j in range(9):
        if board[row][j] == num and col != j:
            return False
    
    # Проверка столбца
    for i in range(9):
        if board[i][col] == num and row != i:
            return False
    
    # Проверка квадрата 3x3
    box_row = (row // 3) * 3
    box_col = (col // 3) * 3
    
    for i in range(box_row, box_row + 3):
        for j in range(box_col, box_col + 3):
            if board[i][j] == num and (i, j) != pos:
                return False
    
    return True


def solve_sudoku(board):
    """Решает судоку методом backtracking"""
    empty = find_empty(board)
    
    if not empty:
        return True  # Решено!
    
    row, col = empty
    
    for num in range(1, 10):
        if is_valid(board, num, (row, col)):
            board[row][col] = num
            
            if solve_sudoku(board):
                return True
            
            board[row][col] = 0  # Откат
    
    return False