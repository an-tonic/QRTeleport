document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sendButton').addEventListener('click', sendFile);
    document.getElementById('fileInput').addEventListener('change', function () {

        const fileName = this.files.length > 0 ? this.files[0].name : 'Choose File';
        document.querySelector('.file-name').textContent = fileName;
        document.getElementById('sendButton').disabled = !(connectedToPeer && this.files.length > 0);
    });
});


let myClientID;
let connectedToPeer = false;
let chunkSize = 16 * 1024; //256KB
let peerBufferSize = 13000000;

//If the chunkSize was previously changes or stored on this device, use it.
if(localStorage.getItem('teleporterChunkSize') === null){
    localStorage.setItem('teleporterChunkSize', chunkSize);
} else {
    chunkSize = parseInt(localStorage.getItem('teleporterChunkSize'));
}

if(localStorage.getItem('teleporterBufferSize') === null){
    localStorage.setItem('teleporterBufferSize', peerBufferSize);
} else {
    chunkSize = parseInt(localStorage.getItem('teleporterBufferSize'));
}

var p = null;
var socket = null;


//Functions
function createPeer() {
    p = new SimplePeer({
        initiator: Initiator,
        trickle: false
    })

    p.on('error', (err) => {
        console.log(err);
        console.log(err.code);

        if(err.message === 'Failure to send data'){
            writeToConsole('Error occurred! The chunk size was too big - try again.', 'red');
            chunkSize = chunkSize * 0.5;
            //Reducing chunkSize
            localStorage.setItem('teleporterChunkSize', chunkSize);
            p.destroy();
            createPeer();
            createSocket();//Feature needed: reconnect to the same peer again?
        }
    })

    p.on('connect', () => {
        writeToConsole('Connected to peer.', 'green');
        connectedToPeer = true;
        socket.disconnect();
        document.getElementById('qrcode').innerHTML = '';
        document.getElementById("link").innerHTML = '';
        document.getElementById("welcomeInstruction").style.display = "none";
    })

    p.on('close', () => {

        writeToConsole('Disconnected from the peer!', 'red');
        createPeer();
        if(!Initiator){
           createSocket();
        }

        connectedToPeer = false;
        document.getElementById('sendButton').disabled = true;
    })

    let receivedChunks = [];
    let expectedChunkCount = 0;
    let filename = '';
    let metadataReceived = false;
    let link;
    let linkProgres;

    p.on('data', (data) => {

        if(metadataReceived){
            receivedChunks.push(data);
            linkProgres.innerText = (receivedChunks.length / expectedChunkCount * 100).toFixed(2) + " %";
            if(receivedChunks.length === expectedChunkCount){
                writeToConsole('Received file: "' + filename + '"', 'green');
                const file = new Blob(receivedChunks);
                link.href = URL.createObjectURL(file);
                link.download = filename;
                link = null;
                receivedChunks = [];
                expectedChunkCount = 0;
                metadataReceived = false;
            }
        } else if(!metadataReceived){
            const jsonData = JSON.parse(data);
            if(jsonData.name && jsonData.chunks){
                writeToConsole('Starting download of file: "' + jsonData.name + '"', 'green');
                filename = jsonData.name;
                expectedChunkCount = jsonData.chunks;
                link = document.createElement('a');
                linkProgres = document.createElement('div');
                const downloadLinkDiv = document.getElementById('downloadLinkDiv');
                downloadLinkDiv.appendChild(link);
                downloadLinkDiv.appendChild(linkProgres);
                link.innerText = filename;
                metadataReceived = true;
            }
        }

    });

}


function createSocket(){
// Establish socket connection
    socket = io.connect();

    socket.on('client_id', function (id) {
        writeToConsole('Received a unique ID from server: ' + id, 'green');
        myClientID = id;
        let qrText = "https://" + window.location.host + '/c?id=' + myClientID;
        //Displaying qr code
        if (!Initiator){
            document.getElementById("welcomeInstruction").style.display = "block";
            var qrCodeDiv = document.getElementById('qrcode');
            var qrCode = new QRCode(qrCodeDiv, {text: qrText});
            document.getElementById('link').innerHTML = '<a target=_blank href="' + qrText + '">link if you cannot scan</a>'
        }
        //Sending offer otherwise
        if (Initiator){
    //        p._createOffer()
            p.on('signal', data => {
                console.log('SIGNAL', JSON.stringify(data));

                var signalingData = {
                    client_id: myClientID, // The client identifier of this client
                    target_client_id: getParameterByName('id'), // The client identifier of the target client
                    signal_data: JSON.stringify(data) // The signaling data generated by simple-peer
                };
                writeToConsole('Connecting to peer... (' +  signalingData.target_client_id + ')', 'green');
                socket.emit("message", signalingData);
            })
        }

    });

    socket.on('webrtc', function(data) {
        console.log(data);
        const [offer, initiator_id] = data;

        p.signal(JSON.parse(offer))

        p.on('signal', data => {
            console.log('SIGNAL', JSON.stringify(data));
            var signalingData = {
                client_id: myClientID, // The client identifier of this client
                target_client_id: initiator_id, // The client identifier of the target client
                signal_data: JSON.stringify(data) // The signaling data generated by simple-peer
            };

            socket.emit("message", signalingData);
        })
    });

}


function writeToConsole(message, color) {
    const consoleWindowText = document.getElementById('consoleText');
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    const content = `<span class="${color}">${timestamp} ${message}</span><br>`;

    consoleWindowText.innerHTML += content;
    consoleWindowText.scrollTop = consoleWindow.scrollHeight; // Auto-scroll to the bottom
}


//Gets client id from GET parameters in URL
function getParameterByName(name) {
  const urlSearchParams = new URLSearchParams(window.location.search);
  return urlSearchParams.get(name);
}

let offsetCount = 0;
let chunks = [];
async function sendChunksAsync(chunks) {
    for (const chunk of chunks) {
        while (p._channel.bufferedAmount >= peerBufferSize) {
            // Wait for a brief interval if the buffer is full
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        try{
            p.send(chunk);
            offsetCount++;
        }catch (error) {
            document.dispatchEvent(new CustomEvent('sendChunksError', { detail: error }));
            throw error;
        }

    }
};

document.addEventListener('sendChunksError', (event) => {

    if(event.detail.message === "Failed to execute 'send' on 'RTCDataChannel': RTCDataChannel send queue is full"){
        peerBufferSize = peerBufferSize / 2;
        localStorage.setItem('teleporterBufferSize', peerBufferSize);
        writeToConsole('Error occurred! The buffer overflown - trying again.', 'red');
        sendChunksAsync(chunks.slice(offsetCount)).then(() => {
            writeToConsole('Finished sending file: "' + file.name + '"', 'green');
            document.getElementById('sendButton').disabled = false;
            offsetCount = 0;
            chunks = [];
        });
    } else {
        writeToConsole('Unknown error occurred during file transfer: ' + error, 'red');
    }

});

let file = null;
// Function to handle file sending
function sendFile() {
    metadataReceived = false;
    document.getElementById('sendButton').disabled = true;
    const fileInput = document.getElementById('fileInput');
    file = fileInput.files[0];

    const fileReader = new FileReader();
    fileReader.onload = () => {
        const fileData = fileReader.result;
        const totalChunks = Math.ceil(fileData.byteLength / chunkSize);

        // Create an object with file name and data
        const fileInfo = {
            name: file.name,
            chunks: totalChunks,
        };
        writeToConsole('Started file upload: "' + file.name + '" (' + Math.floor(fileData.byteLength / 1024) + ' Kb)', 'green');

        p.send(JSON.stringify(fileInfo));

        // Split the file into chunks
        let offset = 0;
        for (let i = 0; i < totalChunks; i++) {
            const chunk = fileData.slice(offset, offset + chunkSize);
            chunks.push(chunk);
            offset += chunkSize;
        }
        //and send them sequentially
        sendChunksAsync(chunks)
        .then(() => {
            writeToConsole('Finished sending file: "' + file.name + '"', 'green');
            document.getElementById('sendButton').disabled = false;
            offsetCount = 0;
            chunks = [];
        })
    };

   fileReader.readAsArrayBuffer(file);
}


createPeer();
createSocket();



