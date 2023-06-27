import uuid
from flask import Flask, render_template, request
from flask_socketio import SocketIO
from flask_talisman import Talisman

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ygjhblnaler734iubkjbaec'

csp = {
    'default-src': '\'self\'',
    'script-src': '\'self\'',
}

talisman = Talisman(app, force_https=True, content_security_policy=csp, content_security_policy_nonce_in=['script-src'])
socketio = SocketIO(app)


def csp_nonce():
    return str(uuid.uuid4().hex)

def int32_to_id(n):
    if n==0: return "0"
    chars="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    length=len(chars)
    result=""
    remain=n
    while remain>0:
        pos = remain % length
        remain = remain // length
        result = chars[pos] + result
    return result


connected_clients = {}


@app.route('/')
def index():
    return render_template('index.html', Initiator='false')


@app.route('/c')
def connect_to():
    client_id = request.args.get('id')

    return render_template('index.html', Initiator='true')


@socketio.on('connect')
def handle_connect():
    client_id = int32_to_id(uuid.uuid4().int)
    connected_clients[client_id] = request.sid
    print(connected_clients)
    socketio.emit('client_id', client_id, room=request.sid)


@socketio.on('disconnect')
def handle_disconnect():
    # Remove the client from the connected_clients dictionary upon disconnection
    for client_id, sid in connected_clients.items():
        if sid == request.sid:
            del connected_clients[client_id]
            break


@socketio.on('message')
def handle_message(message):
    socketio.emit('webrtc', [message['signal_data'], message['client_id']],
                  room=connected_clients[message['target_client_id']])


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=443, ssl_context=('certs/cert.pem', 'certs/key.pem'),
                 allow_unsafe_werkzeug=True)
