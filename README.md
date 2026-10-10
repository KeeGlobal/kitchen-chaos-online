# Kitchen Chaos Online 🍳
A cooperative real-time two-player browser cooking game with room codes, five levels, shared scores, live countdowns, recipes, chopping, cooking, plating, serving, and passing ingredients.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder, run `npm install` then `npm start`.
3. Open `http://localhost:3000` in your browser.

## Play on different devices
Deploy the project to a Node.js hosting provider (such as Render or Railway). Configure the start command `npm start`. The server reads the `PORT` environment variable automatically. Open the deployed URL on one device, click **Create room**, then share **Copy invite** with the second player. The second player clicks **Join room**.

**Important:** Rooms are stored in server memory. Restarting the server resets rooms. Use one running server instance (no multi-instance scaling without a shared Socket.IO adapter). If the free hosting provider sleeps the server, players may disconnect. This prototype does not support reconnection to an abandoned player slot.
