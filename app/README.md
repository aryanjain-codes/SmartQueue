# SmartQueue

**SmartQueue — Smart Hospital Queue Management System**

SmartQueue is a hospital queue management solution designed to streamline patient registration, reduce waiting times, and help hospital staff manage queues efficiently.

## Features

- Patient registration and queue management
- Digital patient passes with QR codes
- QR-based gate verification
- Live queue status and updates
- Queue analytics and dashboard
- Token expiry and revocation checks
- Gate scan logging and duplicate-scan protection

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express
- **Data Processing:** JavaScript / TypeScript
- **Storage:** Local JSON data
- **QR Codes:** Dynamic QR generation

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
git clone https://github.com/aryanjain-codes/SmartQueue.git
cd SmartQueue/app
npm install
```

### Run Locally

```bash
npm run dev
```

Open the local URL shown in your terminal.

## Security Notes

This project is a prototype. Before deploying it publicly, configure proper authentication and role-based authorization, protect patient information, secure secrets using environment variables, and validate all server-side requests.

Do not use real patient data or hardcoded access tokens in a public deployment.

## Team

Built for hackathon prototyping by Team JANSEE.

## Project Status

Prototype under development.

---

*SmartQueue — Making hospital queues smarter and more efficient.*
