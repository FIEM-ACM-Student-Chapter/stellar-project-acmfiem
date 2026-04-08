# Stellar Soroban Smart Contract Projects

A collection of 60 Soroban smart contract project folders with React frontends. Each project folder contains a ready-to-use contract, stellar.js helper, and React UI.

## Repository Ownership Update

This project was originally published under a personal GitHub account and has now been transferred to an organization account for long-term maintenance and collaboration.

If you are following older links, use the current organization repository URL instead.

## Prerequisites

- Node.js 18+
- npm 9+
- Google Chrome browser
- A GitHub account

---

## Step-by-Step Setup Guide

### Step 1 -- Clone the repo and set up a fresh project

```bash
git clone https://github.com/FIEM-ACM-Student-Chapter/base-stellar-project-acmfiem.git
cd base-stellar-project-acmfiem
```

Remove the existing git history and start fresh using the command for your terminal:

**Command Prompt (cmd)**

```bat
rmdir /s /q .git
git init
git add .
git commit -m "Initial commit"
```

**PowerShell**

```powershell
Remove-Item -Recurse -Force .git
git init
git add .
git commit -m "Initial commit"
```

**macOS**

```bash
rm -rf .git
git init
git add .
git commit -m "Initial commit"
```

**Linux**

```bash
rm -rf .git
git init
git add .
git commit -m "Initial commit"
```

This base project already includes the starter setup, so there is no separate dependency-install step in this guide.

### Step 2 -- Pick a project and copy the code

Open this repository in your browser to browse the numbered project folders (currently 01 through 63, with some numbers intentionally unused). Pick the project you want to build.

Each project folder has this structure:

```
XX-project-name/
  contract/contract.rs     <-- Smart contract code
  frontend/app.jsx         <-- React component
  frontend/app.css         <-- Styles
  lib.js/stellar.js        <-- Stellar SDK helper
```

Copy the contents of each file into your Vite project:

1. Copy the content from `frontend/app.jsx` and paste it into `src/App.jsx` in your project
2. Copy the content from `frontend/app.css` and paste it into `src/App.css` in your project
3. Create a folder `src/lib/` and copy the content from `lib.js/stellar.js` into `src/lib/stellar.js`

### Step 3 -- Fix the imports in App.jsx

Open `src/App.jsx` and make these two changes at the top of the file:

1. Change the stellar.js import path from `"../lib.js/stellar.js"` to `"../lib/stellar.js"`
2. Add this CSS import line at the top: `import "./App.css";`

### Step 4 -- Install the Freighter wallet

1. Open this link in Chrome: https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk?hl=en-GB&utm_source=ext_sidebar
2. Click **Add to Chrome** and install the extension
3. Open the Freighter extension and click **Create New Wallet**
4. Enter a password and remember it
5. On the next page about the seed phrase, click **Do this later**

### Step 5 -- Switch to Testnet and fund your wallet

1. Click the Freighter extension icon to open it
2. Click the **globe icon** in the top-left corner
3. Select **Testnet**
4. Click **Fund with Friendbot** -- this gives you free test XLM

### Step 6 -- Deploy your smart contract

1. Open https://app.stacyide.xyz/ in your browser
2. Click **Connect** in the top right
3. Click **Connect Wallet** -- a Freighter popup will appear, click **Connect / Approve**
4. Click **Continue with Google** and sign in with your Google account
5. Reload the page
6. Click **Generate** -- you will see a code editor with a sample hello world contract
7. Select all the sample code and **delete it**
8. Open the `contract/contract.rs` file from your chosen project folder
9. Copy that contract code and **paste it** into the Stady editor
10. Click **Build Contract** and wait for it to finish
11. Click **Deploy to Testnet**
12. A modal will appear -- click **Confirm**
13. Enter your Freighter password if asked
14. Another modal will appear -- click **Confirm** again
15. You will get a **Contract ID** -- copy it

### Step 7 -- Configure your project with the Contract ID and wallet address

1. Open `src/lib/stellar.js` in VS Code
2. Find the line `export const CONTRACT_ID = "";` and paste your Contract ID between the quotes
3. Find the line `export const DEMO_ADDR = "";` -- you need your wallet address for this:
   - Open the Freighter extension
   - Click on **Account 1**
   - Click the **three dots** on the right
   - Click **Copy Address**
4. Paste your wallet address between the quotes for `DEMO_ADDR`

### Step 8 -- Run your app

```bash
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173). Your app is now running and connected to your deployed smart contract on the Stellar testnet.

### Step 9 -- Polish your project for submission

1. **Improve the UI** -- Style your app, add a landing page / hero section that explains what the project does
2. **Create a README.md** -- Add a `README.md` file in your project root with:
   - Project title and description
   - Screenshots of your running app (save them in a `screenshots/` folder and embed them in the README using `![screenshot](screenshots/home.png)`)
   - The deployed contract ID and a link to it on Stellar Expert, e.g. `https://stellar.expert/explorer/testnet/contract/YOUR_CONTRACT_ID`
   - Setup instructions so others can run your project
3. **Commit and push** your final changes

---

## Project Index

| # | Project | Description |
|---|---------|-------------|
| 01 | Record Management | Category-based records with archiving |
| 02 | Resource Availability | Time-slot reservations for resources |
| 03 | Notice Board | Public notices with pin/unpin and expiration |
| 04 | Booking Reservation | Service slot booking lifecycle |
| 05 | Complaint Reporting | Complaint filing with escalation workflow |
| 06 | Inventory Management | Stock tracking with low-stock alerts |
| 07 | Verification | Credential verification with expiry |
| 08 | Membership Management | Tiered memberships with renewal |
| 09 | Learning Platform | Courses with enrollment and ratings |
| 10 | Payment Tracking | Invoice lifecycle with payment tracking |
| 11 | Voting / Polling | Polls with per-voter tracking and tallying |
| 12 | Tracking | Shipment tracking with checkpoints |
| 13 | Dashboard Analytics | Metrics recording and category totals |
| 14 | Donation / Fundraising | Campaigns with donor tracking |
| 15 | Job Opportunity Portal | Job postings with applications |
| 16 | Directory Listing | Business directory with ratings |
| 17 | Service Request | Work order workflow with approval |
| 18 | Document Sharing | Document registry with access control |
| 19 | Ticketing | Support tickets with assignment |
| 20 | Community Platform | Posts with likes, comments, flagging |
| 21 | Queue / Token Management | Token dispensing and queue management |
| 22 | Audit Log Tracking | Action/access audit trail |
| 23 | Geo Alert | Location-based alerts with severity |
| 25 | Resource Sharing | Borrow/return with daily rates |
| 26 | Task Assignment | Task lifecycle with review/approval |
| 28 | Mentorship Platform | Mentor-mentee matching and sessions |
| 29 | Knowledge Base | Wiki articles with versioning and upvotes |
| 30 | Survey Builder | Surveys with response tracking |
| 32 | DAO Voting | Governance proposals with weighted votes |
| 33 | Pay-to-Unlock | Paid content with purchase tracking |
| 34 | Pay-to-Message | Paid messaging with per-recipient rates |
| 35 | Memo Chat | Channel-based messaging |
| 36 | Donation Tracker | Donation leaderboard with goal tracking |
| 37 | Learning Sessions | Pay-per-session tutoring |
| 38 | Prepaid Orders | Order flow with payment and shipping |
| 39 | Sponsored Posts | Ad campaigns with per-view billing |
| 40 | Attendance Tracker | Session check-in tracking with attendee counts |
| 41 | Loyalty Rewards | Points accrual, redemption, and tier updates |
| 42 | Event RSVP | Event registration with attendance confirmation |
| 43 | Lost and Found | Item reporting, claiming, and resolution workflow |
| 44 | Subscription Registry | Subscription lifecycle with renew, pause, cancel |
| 45 | Warranty Registry | Warranty registration, transfer, and claims |
| 46 | Bounty Board | Bounty posting, assignment, submission, approval |
| 47 | Referral Rewards | Referral campaign tracking with reward issuance |
| 48 | Shift Scheduling | Shift assignment and active shift tracking |
| 49 | Visitor Pass Management | Visitor access passes with check-in and check-out |
| 50 | Expense Splitter | Shared expense groups with contribution counts and settlement |
| 51 | Equipment Checkout | Equipment registry with checkout, return, and retirement |
| 52 | Volunteer Coordination | Volunteer drives with join and confirmation flow |
| 53 | Meeting Minutes | Meeting records with note capture and approval |
| 54 | License Renewal | License renewal requests with approval and revocation |
| 55 | Pledge Campaign | Pledge collection with supporter confirmations |
| 56 | Feedback Board | Feedback records with review and approval workflow |
| 57 | Internship Logbook | Internship progress logbooks with mentor approval |
| 58 | Asset Maintenance | Asset servicing records with maintenance approval |
| 59 | Grant Request | Grant request submissions with approval lifecycle |
| 60 | Voucher Claims | Voucher issuance with claim and approval flow |
| 61 | Checklist Review | Checklist submission and archive workflow |
| 62 | Scholarship Applications | Student scholarship applications with committee approvals |
| 63 | Carpool Board | Ride board with join, confirmation, and closing flow |

---

## Troubleshooting

- **Wallet not connecting** -- Make sure Freighter is installed, you are on Testnet, and you allowed site access
- **Read simulation fails** -- Check that `CONTRACT_ID` and `DEMO_ADDR` are filled in `stellar.js`
- **Transaction rejected** -- Make sure your wallet has test XLM (fund with Friendbot) and is on Testnet
- **Method not found** -- Make sure the function names in `stellar.js` match your deployed contract


