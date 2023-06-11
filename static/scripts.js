

        // Establish socket connection
        var socket = io.connect();

        // Event handler for socket connection
        socket.on('connect', function() {
            console.log('Connected to server');
        });

	socket.on('client_id', function (client_id) {
  		console.log(client_id);
		// Store the client identifier
  		var myClientId = client_id;
		var qrCodeDiv = document.getElementById('qrcode');
		var qrCode = new QRCode(qrCodeDiv, {
            text: myClientId,
		    width: 128,
            height: 128,
		});
	});
