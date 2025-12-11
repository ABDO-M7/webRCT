# 2-Person WebRTC Video Call

Node.js + Express + Socket.IO signaling server with a React-based frontend (served via CDN) for a simple 2-person video call.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open http://localhost:3000 in **two different browsers/devices** or two windows.
4. Enter the same room ID on both and click **Join Room**.

## Notes on deployment (Vercel)

Vercel is great for hosting the static frontend. Persistent WebSocket-based Node servers (like this signaling server) are better hosted on a traditional Node host (e.g. Render/Railway/Heroku/etc.) or via Vercel's specialized WebSocket integrations.

A simple approach:

- Deploy this repo to a Node-friendly host to keep both frontend + signaling on the same origin **(easiest)**, or
- Deploy only the `public` folder as a static site on Vercel and deploy `server.js` to a separate Node host, then update the frontend to connect Socket.IO to that external URL.

If you want, I can next:

- Adjust the client to work with a remote signaling server URL, and
- Provide step-by-step instructions for a specific host + Vercel setup.
