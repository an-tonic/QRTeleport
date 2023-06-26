document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sendButton').addEventListener('click', sendFile);
    document.getElementById('fileInput').addEventListener('change', function () {

        const fileName = this.files.length > 0 ? this.files[0].name : 'Choose File';
        document.querySelector('.file-name').textContent = fileName;
        document.getElementById('sendButton').disabled = !(connectedToPeer && this.files.length > 0);
    });
});

// Establish socket connection
let socket = io.connect();
let myClientID;


let connectedToPeer = false;
// Chunk size for splitting the file
let chunkSize = 16 * 1024; //16KB
var p = new SimplePeer({
    initiator: Initiator,
    trickle: false
})


//Functions

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


async function sendChunksAsync(chunks) {
  for (const chunk of chunks) {
    while (p._channel.bufferedAmount >= 13000000) {
      // Wait for a brief interval if the buffer is full
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    p.send(chunk);
  }
};

// Function to handle file sending
function sendFile() {

    const file = fileInput.files[0];
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

        // Split the file into chunks and send them sequentially
        let offset = 0;
        const chunks = [];
        for (let i = 0; i < totalChunks; i++) {
            const chunk = fileData.slice(offset, offset + chunkSize);
            chunks.push(chunk);
            offset += chunkSize;
        }

        sendChunksAsync(chunks)
        .then(() => {
            writeToConsole('Finished sending file: "' + file.name + '"', 'green');
        })
        .catch((error) => {

            writeToConsole('Unknown error occurred during file transfer: ' + error, 'red');
        });
    };

   fileReader.readAsArrayBuffer(file);
}

p.on('error', (err) => {
    console.log(err, err.code);
     writeToConsole('Unknown error occurred!', 'red');
//    if(err.code === "RTCError: Failure to send data"){
//        chunkSize = chunkSize / 2;
//        newPeer();
//        sendFile();
//    }
})

p.on('connect', () => {
    writeToConsole('Connected to peer.', 'green');
    //Enabling send button
    connectedToPeer = true;
    socket.disconnect();
    document.getElementById("qrcode").remove();
    document.getElementById("link").remove();
    document.getElementById("welcomeInstruction").remove();
})

p.on('close', () => {

    writeToConsole('Disconnected from the peer!', 'red');
    connectedToPeer = false;
    document.getElementById('sendButton').disabled = true;
})

let receivedChunks = [];
let expectedChunkCount = 0;
let filename = '';
let metadataReceived = false;
let link;
p.on('data', (data) => {

    if(metadataReceived){
        receivedChunks.push(data);
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
            const downloadLinkDiv = document.getElementById('downloadLinkDiv');
            downloadLinkDiv.appendChild(link);
            link.innerText = filename;
            metadataReceived = true;
        }
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

socket.on('client_id', function (id) {
    writeToConsole('Received a unique ID from server: ' + id, 'green');
    myClientID = id;
    let qrText = "https://" + window.location.host + '/connectTo?client_id=' + myClientID;
    //Displaying qr code
    if (!Initiator){
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
                target_client_id: getParameterByName('client_id'), // The client identifier of the target client
                signal_data: JSON.stringify(data) // The signaling data generated by simple-peer
            };
            writeToConsole('Connecting to peer... (' +  signalingData.target_client_id + ')', 'green');
            socket.emit("message", signalingData);
        })
    }

});


