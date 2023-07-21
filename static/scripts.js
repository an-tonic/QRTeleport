document.addEventListener('DOMContentLoaded', () => {
    let sendTextButton = document.getElementById('sendTextButton');
    document.getElementById('sendButton').addEventListener('click', sendFile);
    sendTextButton.addEventListener('click', sendText);

    document.getElementById('textInput').addEventListener('input', function () {
        sendTextButton.disabled = !(connectedToPeer && this.value !== '');
        if(!sendTextButton.disabled){
            sendTextButton.style.backgroundColor = 'green';
            sendTextButton.textContent = 'Send Text';
        } else {
            sendTextButton.style.backgroundColor = '#ccc';
        }

    });

    document.getElementById('fileInput').addEventListener('change', function () {

        document.querySelector('.file-name').textContent = this.files.length > 0 ? this.files[0].name : 'Choose File';
        document.getElementById('sendButton').disabled = !(connectedToPeer && this.files.length > 0);
        document.getElementById('sendButton').focus({focusVisible: true});
    });
});

let connectedToPeer = false;
let peer = null;
let myId = null;
let myPeerId = null;
let isInitiator = false;
let conn;
let metadataReceived = false;
let filename = '';
let link;

//Gets client id from GET parameters in URL
function getParameterByName(name) {
    const urlSearchParams = new URLSearchParams(window.location.search);
    myPeerId = urlSearchParams.get(name);
    isInitiator = myPeerId !== null;
}

function writeToConsole(message, data = " ", color="green", type = "default") {
    const consoleWindowText = document.getElementById('consoleText');
    const consoleWindow = document.getElementById('consoleWindow');

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

    let copyButton = '';
    if(type === "text"){
        const randomId = Math.floor(Math.random() * 10000);
        copyButton = `<button class="buttonClipboard" id="${randomId}" onClick="copyToClipboard('${data.replace('\n', ' ')}', '${randomId}')">Copy</button>`;
    }

    let content = `<span class="${color} console-message">${timestamp} ${message} ${data} ${copyButton}</span>`;
    consoleWindowText.innerHTML += content;
    consoleWindow.scrollTop = consoleWindow.scrollHeight; // Auto-scroll to the bottom
}

function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text).then(() => {

        document.getElementById(id).innerText = '';
        document.getElementById(id).classList.add('copied');
    }).catch(function (e) {
        alert(e);
        alert('Failure to copy. Check permissions for clipboard');
        console.error(e);
    });

}

function sendText() {
    if(conn) {
        const textInputValue = document.getElementById('textInput').value;
        document.getElementById('sendTextButton').textContent = 'Text Sent!';
        document.getElementById('sendTextButton').style.backgroundColor = 'blue';
        conn.send(JSON.stringify({type: 'text', data: textInputValue}));
    }
}

function sendFile() {

    document.getElementById('sendButton').disabled = true;
    const fileInput = document.getElementById('fileInput');
    file = fileInput.files[0];

    const fileReader = new FileReader();
    fileReader.onload = () => {
        const fileData = fileReader.result;

        writeToConsole('Started file upload:', file.name + '" (' + Math.floor(file.size / 1024) + ' Kb)');

        conn.send(JSON.stringify({type: 'file', name: file.name, size: file.size}));
        conn.send(fileData);

        writeToConsole('Finished file upload: ', file.name);
        document.querySelector('.file-name').textContent = "Choose File";
        fileInput.value = "";
    };

    fileReader.readAsArrayBuffer(file);
}


function connDataListener() {
    conn.on('open', function () {
        writeToConsole('Connected to peer:', conn.peer);
        connectedToPeer = true;
        document.getElementById("userInfo").style.display = "none";
        // Receive messages
        conn.on('data', function (data) {
            console.log(data);
            if (metadataReceived) {
                writeToConsole('Received file:', filename);
                const file = new Blob([data]);
                link.href = URL.createObjectURL(file);
                link.download = filename;
                filename = '';
                metadataReceived = false;
                link = null;
            } else if (!metadataReceived) {
                const jsonFileData = JSON.parse(data);
                if (jsonFileData.type) {
                    if (jsonFileData.type === 'text') {
                        writeToConsole('Received a message:', jsonFileData.data, 'green', jsonFileData.type);
                    } else if (jsonFileData.type === 'file' && jsonFileData.name && jsonFileData.size) {
                        writeToConsole('Downloading file:', jsonFileData.name);
                        filename = jsonFileData.name;
                        link = document.createElement('a');
                        const downloadLinkDiv = document.getElementById('downloadLinkDiv');
                        downloadLinkDiv.appendChild(link);
                        link.innerText = filename;
                        metadataReceived = true;
                    }
                }
            }
        });
    });
}


function createPeer() {
    getParameterByName('id');


    peer = new Peer();

    peer.on('error', function (err) {
        alert(err);
    });

    peer.on('open', function (id) {
        myId = id;
        console.log('My peer ID is: ' + myId);
        writeToConsole('Received an ID from server: ', myId);

        //Displaying qr code
        if (!isInitiator) {
            let qrText = "https://" + window.location.host + '/?id=' + myId;
            document.getElementById("userInfo").style.display = "block";
            var qrCodeDiv = document.getElementById('qrcode');
            var qrCode = new QRCode(qrCodeDiv, {text: qrText});
            document.getElementById('link').innerHTML = '<a target=_blank href="' + qrText + '">link if you cannot scan</a>';

            writeToConsole('Awaiting connection...');
        } else if (isInitiator) {
            writeToConsole('Connecting to peer:', myPeerId);
            conn = peer.connect(myPeerId);
            connDataListener();
        }


    });

    peer.on('connection', function (connection) {
        conn = connection;
        connDataListener();
    })


}


createPeer();

