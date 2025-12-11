const { useState, useEffect, useRef } = React;

function App() {
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState("Enter a room ID and click Join");
  const [inRoom, setInRoom] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    const signalingUrl = window.SIGNALING_SERVER_URL || window.location.origin;
    const socket = io(signalingUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("created", room => {
      setIsInitiator(true);
      setStatus(`Room ${room} created. Waiting for someone to join...`);
      startLocalStream();
    });

    socket.on("joined", room => {
      setIsInitiator(false);
      setStatus(`Joined room ${room}. Connecting call...`);
      startLocalStream();
    });

    socket.on("full", room => {
      setStatus(`Room ${room} is full. Try a different ID.`);
      setInRoom(false);
    });

    socket.on("ready", () => {
      if (isInitiator && pcRef.current) {
        createOffer();
      }
    });

    socket.on("offer", async offer => {
      if (!pcRef.current) {
        await createPeerConnection();
      }
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("answer", roomId, answer);
      } catch (err) {
        console.error("Error handling offer", err);
      }
    });

    socket.on("answer", async answer => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setStatus("Connected! You should see each other now.");
      } catch (err) {
        console.error("Error handling answer", err);
      }
    });

    socket.on("ice-candidate", async candidate => {
      try {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error adding received ICE candidate", err);
      }
    });

    return () => {
      socket.disconnect();
      cleanupConnections();
    };
  }, [isInitiator, roomId]);

  const startLocalStream = async () => {
    if (localStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      await createPeerConnection();
      setInRoom(true);
      setStatus(prev => prev + " Media ready.");
    } catch (err) {
      console.error("Error getting user media", err);
      setStatus("Failed to access camera/mic. Check permissions.");
    }
  };

  const createPeerConnection = async () => {
    if (pcRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    pc.onicecandidate = event => {
      if (event.candidate && socketRef.current && roomId) {
        socketRef.current.emit("ice-candidate", roomId, event.candidate);
      }
    };

    pc.ontrack = event => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
      }
      event.streams[0].getTracks().forEach(track => {
        remoteStreamRef.current.addTrack(track);
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pcRef.current = pc;
  };

  const createOffer = async () => {
    if (!pcRef.current || !socketRef.current || !roomId) return;
    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socketRef.current.emit("offer", roomId, offer);
      setStatus("Sending offer to peer...");
    } catch (err) {
      console.error("Error creating offer", err);
    }
  };

  const handleJoin = () => {
    if (!roomId.trim()) {
      setStatus("Please enter a room ID.");
      return;
    }
    if (!socketRef.current) return;
    socketRef.current.emit("join", roomId.trim());
    setStatus(`Joining room ${roomId.trim()}...`);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(prev => !prev);
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setVideoEnabled(prev => !prev);
  };

  const hangUp = () => {
    cleanupConnections();
    setInRoom(false);
    setStatus("Call ended. You can join again with a room ID.");
  };

  const cleanupConnections = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(t => t.stop());
      remoteStreamRef.current = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    }
  };

  return (
    <>
      <div className="room-controls">
        <input
          value={roomId}
          placeholder="Room ID (e.g. my-room-123)"
          onChange={e => setRoomId(e.target.value)}
          disabled={inRoom}
        />
        <button className="btn btn-primary" onClick={handleJoin} disabled={inRoom}>
          Join Room
        </button>
        <span className="status">{status}</span>
      </div>

      <div className="videos">
        <div className="video-wrapper">
          <video ref={localVideoRef} autoPlay playsInline muted />
          <div className="video-label">You</div>
        </div>
        <div className="video-wrapper">
          <video ref={remoteVideoRef} autoPlay playsInline />
          <div className="video-label">Remote</div>
        </div>
      </div>

      <div className="controls-row">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={toggleMute} disabled={!inRoom}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button className="btn btn-secondary" onClick={toggleVideo} disabled={!inRoom}>
            {videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
          </button>
          <button className="btn btn-danger" onClick={hangUp} disabled={!inRoom}>
            End Call
          </button>
        </div>
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
