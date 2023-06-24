document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sendButton').addEventListener('click', sendFile);
    document.getElementById('fileInput').addEventListener('change', function () {

        document.getElementById('sendButton').disabled = !(fileInput.files.length !== 0 && connectedToPeer);
    });
});

// Establish socket connection
var socket = io.connect();
var myClientID;
var p = new SimplePeer({
    initiator: Initiator,
    trickle: false
})
var connectedToPeer = false;
// Chunk size for splitting the file
 const chunkSize = 16 * 1024; //16KB



const getParameterByName = name => new URLSearchParams(window.location.search).get(name);

const sendChunksAsync = async (chunks) => {
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
        console.log(fileInfo)
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
        console.log('File transfer complete');
      })
      .catch((error) => {
        console.error('Error occurred during file transfer:', error);
      });
    };

   fileReader.readAsArrayBuffer(file);
}



p.on('connect', () => {
    console.log('CONNECT')
    //Enabling send button
    connectedToPeer = true;
    socket.disconnect();
    document.getElementById("qrcode").remove();
    document.getElementById("link").remove();
})

p.on('close', () => {
    alert("You have been disconnected from your peer");
    connectedToPeer = false;
    document.getElementById('sendButton').disabled = true;
})

let receivedChunks = [];
let expectedChunkCount = 0;
let filename = '';
let metadataReceived = false;
p.on('data', (data) => {

    if(metadataReceived){
        receivedChunks.push(data);
        if(receivedChunks.length === expectedChunkCount){
            const file = new Blob(receivedChunks);
            const link = document.createElement('a');
            const downloadLinkDiv = document.getElementById('downloadLinkDiv');
            downloadLinkDiv.appendChild(link);
            link.innerText = filename;
            link.href = URL.createObjectURL(file);
            link.download = filename;
            receivedChunks = [];
            expectedChunkCount = 0;
            metadataReceived = false;
        }
    } else if(!metadataReceived){
        const jsonData = JSON.parse(data);
        if(jsonData.name && jsonData.chunks){
            filename = jsonData.name;
            expectedChunkCount = jsonData.chunks;
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
    myClientID = id;
    let qrText = "https://" + window.location.host + '/connectTo?client_id=' + myClientID;
    //Displaying qr code
    if (!Initiator){
        var qrCodeDiv = document.getElementById('qrcode');
        var qrCode = new QRCode(qrCodeDiv, {text: qrText});
        document.getElementById('link').innerHTML = '<a target=_blank href="' + qrText + '">link</a>'

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
            socket.emit("message", signalingData);
        })
    }

});


