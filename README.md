# ShieldLedger 🛡️

**AI-Powered Fraud Prevention & Ledger Security**

The Indian market has a massive trust problem. Between rampant scams, fake transaction screenshots, and ledger fraud, businesses are bleeding money. ShieldLedger is a production-grade, Full-Stack AI application deployed on AWS, designed to actively intercept and kill fraudulent transactions before they settle. 

[👉 **Test the Live AWS Deployment Here**](http://43.205.230.62:8080)

## 🚀 Core Features (The Anomaly Engine)

1. **Fake Collect Request Blocking:** The AI parses text intent in real-time, catching scammers who use "Receive cash back prize" notes on DEBIT transactions.
2. **QR Hijack & Geo-Velocity Tracking:** Dynamic rotating QRs cross-reference the scanner's GPS coordinates against the merchant's physical terminal to kill remote scans.
3. **Deepfake Transfer & Mule Detection:** Analyzes vector distances on peer clusters to flag synthetic authorizations and shady P2P money movement.
4. **Remote Screen Injection Killswitch:** Instantly freezes the wallet and locks the account if an active AnyDesk or TeamViewer session is detected during a transaction.
5. **Agentic Anomaly Engine:** Uses Claude 3.5 and PGVector to score device fingerprints, spend patterns, and temporal entropy.

## 🛠️ Tech Stack Architecture

* **Frontend:** React, Vite, TypeScript, TailwindCSS
* **Backend Integration:** Node.js, PM2 Daemonization 
* **Database & Memory:** CockroachDB, PGVector (Agentic Memory Stream)
* **AI Agents:** Anthropic Claude 3.5 Sonnet
* **Infrastructure:** AWS EC2 (`t3.micro`), Nginx/Iptables routing

## ⚡ Run Locally

If you want to spin this up on your local machine:

\`\`\`bash
# Install dependencies
npm install

# Run the development server
npm run dev
\`\`\`
