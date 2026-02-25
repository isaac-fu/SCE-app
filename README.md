# Stock Monitoring Service

This is a Node.js backend service that retrieves and monitors stock data using the Finnhub API.

---

## Requirements

- Node.js v18 or higher (required for built-in `fetch`)
- A Finnhub API key

---

## Setup Instructions

### 1. Install Node.js

Download and install from:
https://nodejs.org/

Verify installation:

```bash
node -v
```

### 2. Run Server

Run the following command in terminal:

```bash
node server.js
```

## Testing API

### 1. Postman

- Can be used within VS Code as an extension

### 2. JavaScript fetch()

- Type the corresponding URL in a browser tab (ex: http://localhost:3000/start-monitoring)
- Send HTTP requests using fetch() in console (press F12)
