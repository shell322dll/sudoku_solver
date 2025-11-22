from flask import Flask, render_template, request

app = Flask(__name__)

# --- ЛОГИКА СУДОКУ ---
def find_empty(bo):
    for i in range(len(bo)):
        for j in range(len(bo[0])):
            if bo[i][j] == 0:
                return (i, j)
    return None

def valid(bo, num, pos):
    # Проверка строки
    for i in range(len(bo[0])):
        if bo[pos[0]][i] == num and pos[1] != i:
            return False
    # Проверка столбца
    for i in range(len(bo)):
        if bo[i][pos[1]] == num and pos[0] != i:
            return False
    # Проверка квадрата 3x3
    box_x = pos[1] // 3
    box_y = pos[0] // 3
    for i in range(box_y*3, box_y*3 + 3):
        for j in range(box_x*3, box_x*3 + 3):
            if bo[i][j] == num and (i,j) != pos:
                return False
    return True

def solve_sudoku(bo):
    find = find_empty(bo)
    if not find:
        return True
    else:
        row, col = find
    
    for i in range(1, 10):
        if valid(bo, i, (row, col)):
            bo[row][col] = i
            if solve_sudoku(bo):
                return True
            bo[row][col] = 0
    return False

# --- МАРШРУТЫ ---
@app.route('/', methods=['GET', 'POST'])
def index():
    # Создаем пустую доску по умолчанию
    board = [[0 for _ in range(9)] for _ in range(9)]
    message = ""

    if request.method == 'POST':
        try:
            # Считываем данные из формы
            for i in range(9):
                for j in range(9):
                    val = request.form.get(f'cell-{i}-{j}', '')
                    board[i][j] = int(val) if val and val.isdigit() else 0
            
            # Решаем судоку
            if solve_sudoku(board):
                message = "✅ Судоку решено!"
            else:
                message = "❌ Решения не существует. Проверьте введенные данные."
        except Exception as e:
            message = f"⚠️ Ошибка: {str(e)}"
            board = [[0 for _ in range(9)] for _ in range(9)]

    # ⚠️ ВАЖНО: Всегда передаем board и message в шаблон
    return render_template('index.html', board=board, message=message)

if __name__ == '__main__':
    app.run(debug=True)