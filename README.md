# Real-Time Chat App

A minimal real-time chat application built with Express, Socket.IO, SQLite, and vanilla JavaScript. Users can register, log in, authenticate with a JWT, send private or group messages, and manage friend requests.

## Requirements

- Node.js 20.17 or newer
- npm

## Development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Use `/register.html` to create an account, then log in at `/login.html` to enter the chat.

To enable the administrator dashboard, set an administrator username and password before starting the server. The username is reserved from public registration, and a successful administrator login opens `/admin.html`.

For deployment, copy `.env.example` to `.env` or configure the same variables in your hosting provider. The application listens on `HOST` and `PORT`, requires `JWT_SECRET` when `NODE_ENV=production`, and supports `DATABASE_PATH` so SQLite can be placed on a persistent volume.

PowerShell:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="use-a-long-private-password"
$env:JWT_SECRET="use-a-long-random-secret"
npm start
```

Run the deployment checks with:

```bash
npm test
```

The dashboard can list and delete individual or all messages, delete individual users, and remove all non-admin users with their relationships and messages.

For a normal server start, run:

```bash
npm start
```

## Project Structure

- `public/` - browser pages, styles, and client-side JavaScript
- `server/server.js` - Express and Socket.IO server
- `server/database/` - SQLite connection and schema initialization
- `server/utils/` - user and message database helpers

The SQLite database is created at `server/database/chat_app.db` on first launch, or at `DATABASE_PATH` when configured. No separate database setup is required. Keep that location on persistent storage when deploying, because SQLite data is local to the server instance.

## API

- `POST /register` - create a user
- `POST /login` - authenticate a user and return a JWT
- Socket.IO - authentication, friend requests, and chat messages
