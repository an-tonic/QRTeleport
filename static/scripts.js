document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sendButton').addEventListener('click', sendFile);
    document.getElementById('sendTextButton').addEventListener('click', sendText);

    document.getElementById('textInput').addEventListener('input', function () {
        document.getElementById('sendTextButton').disabled = !(connectedToPeer && this.value !== '');
        document.getElementById('sendTextButton').style.backgroundColor = 'green'; // Change background color to blue
        document.getElementById('sendTextButton').textContent = 'Send Text';
    });

    document.getElementById('fileInput').addEventListener('change', function () {

        document.querySelector('.file-name').textContent = this.files.length > 0 ? this.files[0].name : 'Choose File';
        document.getElementById('sendButton').disabled = !(connectedToPeer && this.files.length > 0);
        document.getElementById('sendButton').focus({ focusVisible: true });
    });
});

let connectedToPeer = false;
let p = null;
let myId = null;
let myPeerId = null;
let isInitiator = false;
let conn;
let metadataReceived = false;
let filename = '';

//Gets client id from GET parameters in URL
function getParameterByName(name) {
    const urlSearchParams = new URLSearchParams(window.location.search);
    myPeerId = urlSearchParams.get(name);
    isInitiator = myPeerId !== null;
}

function writeToConsole(message, color) {
    const consoleWindowText = document.getElementById('consoleText');
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const content = `<span class="${color}">${timestamp} ${message}</span><br>`;

    consoleWindowText.innerHTML += content;
    consoleWindowText.scrollTop = consoleWindow.scrollHeight; // Auto-scroll to the bottom
}

function sendText(){


    const textInputValue = document.getElementById('textInput').value;
    document.getElementById('sendTextButton').textContent = 'Text Sent!';
    document.getElementById('sendTextButton').

    conn.send(JSON.stringify({type: 'text', data: textInputValue}));
}

function sendFile() {

    document.getElementById('sendButton').disabled = true;
    const fileInput = document.getElementById('fileInput');
    file = fileInput.files[0];

    const fileReader = new FileReader();
    fileReader.onload = () => {
        const fileData = fileReader.result;

        writeToConsole('Started file upload: "' + file.name + '" (' + Math.floor(file.size / 1024) + ' Kb)', 'green');

        conn.send(JSON.stringify({type: 'file', name:file.name, size:file.size}));
        conn.send(fileData);

        writeToConsole('Finished file upload: "' + file.name + '"', 'green');
        document.querySelector('.file-name').textContent = "Choose File";
        fileInput.value = "";
    };

    fileReader.readAsArrayBuffer(file);
}


function connDataListener() {
    conn.on('open', function () {
        writeToConsole('Connected to peer... (' + conn.peer + ')', 'green');
        connectedToPeer = true;
        document.getElementById("userInfo").style.display = "none";
        // Receive messages
        conn.on('data', function (data) {
            console.log(data);
            if(metadataReceived){
                writeToConsole('Received file: "' + filename + '"', 'green');
                const file = new Blob([data]);
                link.href = URL.createObjectURL(file);
                link.download = filename;
                filename = '';
                metadataReceived = false;
                link = null;
            } else if(!metadataReceived){
                const jsonFileData = JSON.parse(data);
                if(jsonFileData.type){
                    if(jsonFileData.type === 'text'){
                        writeToConsole('Recieved a message: "' + jsonFileData.data + '"', 'green');
                    }else if(jsonFileData.type === 'file' && jsonFileData.name && jsonFileData.size){
                        writeToConsole('Downloading file: "' + jsonFileData.name + '"', 'green');
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
        writeToConsole('Received an ID from server: ' + myId, 'green');

        //Displaying qr code
        if (!isInitiator) {
            let qrText = "https://" + window.location.host + '/?id=' + myId;
            document.getElementById("userInfo").style.display = "block";
            var qrCodeDiv = document.getElementById('qrcode');
            var qrCode = new QRCode(qrCodeDiv, { text: qrText });
            document.getElementById('link').innerHTML = '<a target=_blank href="' + qrText + '">link if you cannot scan</a>';
            writeToConsole('Awaitng connection...', 'green');
        } else if (isInitiator) {
            writeToConsole('Connecting to peer... (' + myPeerId + ')', 'green');
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

