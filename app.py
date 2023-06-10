from flask import Flask, render_template, request
from flask_talisman import Talisman
from flask_socketio import SocketIO
import uuid

app = Flask(__name__)

Talisman(app, force_https=True)


app.config['SECRET_KEY'] = 'ygjhblnaler734iubkjbaec'
socketio = SocketIO(app)
connected_clients = {}



@app.route('/')
def index():
    return render_template('index.html')



@socketio.on('connect')
def handle_connect():
    client_id = uuid.uuid4().hex
    connected_clients[request.sid] = client_id
    print(connected_clients)
    socketio.emit('client_id', client_id, room=request.sid)


@socketio.on('disconnect')
def handle_disconnect():
    del connected_clients[request.sid]


@socketio.on('message')
def handle_message(message):
    print('Received message:', message)



if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=443, ssl_context=('certs/cert.pem', 'certs/key.pem'), allow_unsafe_werkzeug=True)
