from flask import Flask, render_template, request, jsonify
from sudoku_solver import solve_sudoku, is_valid_sudoku

app = Flask(__name__)

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')

@app.route('/solve', methods=['POST'])
def solve():
    """Решает судоку"""
    try:
        data = request.json
        board = data['board']
        
        # Проверка корректности входных данных
        if not is_valid_sudoku(board):
            return jsonify({
                'success': False, 
                'message': 'Некорректное судоку!'
            })
        
        # Создаём копию для решения
        solution = [row[:] for row in board]
        
        if solve_sudoku(solution):
            return jsonify({
                'success': True, 
                'solution': solution
            })
        else:
            return jsonify({
                'success': False, 
                'message': 'Решения не существует!'
            })
    
    except Exception as e:
        return jsonify({
            'success': False, 
            'message': f'Ошибка: {str(e)}'
        })

if __name__ == '__main__':
    app.run(debug=True)