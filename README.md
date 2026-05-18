# Telecom Churn Prediction App

A full-stack web app that predicts which telecom customers are likely to cancel, explains why, and generates retention campaign payloads — built without any external ML libraries.

## What it does

- Upload any telecom customer CSV (auto-detects column names)
- Validates data quality and flags missing or mismatched fields
- Trains a logistic regression model from scratch on your data
- Scores every customer with a risk level: Critical / High / Medium / Low
- Shows the top 3 churn reasons per customer and suggests a retention offer
- Exports high-risk customers as a CSV
- Generates a webhook payload for n8n automation (WhatsApp, SMS, email, or customer-care call)

## Tech stack

| Layer    | Details                                          |
| -------- | ------------------------------------------------ |
| Backend  | Python 3 — standard library only, no pip install |
| ML       | Logistic regression implemented from scratch     |
| Frontend | Vanilla HTML + CSS + JavaScript                  |
| Server   | Node.js static server (optional, `server.js`)    |

## Setup

### With Python backend (recommended — model trains server-side)

```bash
cd telecom-churn-retention-app
python backend.py
```

Open [http://localhost:4173](http://localhost:4173)

You can also set a custom port:

```bash
PORT=8080 python backend.py
```

### With Node.js (frontend demo only)

```bash
cd telecom-churn-retention-app
node server.js
```

When the Python backend is not running, the app falls back to training the model in the browser using the same logistic regression logic ported to JavaScript.

## Demo walkthrough

1. Click **Load Indian demo data** to load the included sample dataset
2. Review the auto-detected column mappings and click **Apply Mapping**
3. Click **Train & Score** — trains the model and scores all customers
4. View risk scores, top drivers, and suggested offers in the Danger Zone table
5. Go to the **Automation** tab to preview or send an n8n webhook payload

## Project structure

```
backend.py          Python HTTP server + ML training API (/api/train)
app.js              Frontend: CSV parsing, encoding, fallback model, rendering
index.html          App layout
styles.css          Styles
server.js           Static file server (Node.js, no ML API)
data/               Sample Indian telecom CSV (500 synthetic customers)
templates/          Upload format templates (basic and advanced)
docs/               Schema reference and n8n workflow notes
```

## How the model works

The logistic regression is built without any ML library:

- Numeric features are z-score normalized (mean 0, std 1)
- Categorical features are one-hot encoded (top 6 categories per column)
- Trained with batch gradient descent — 850 epochs, L2 regularization
- Feature weights are used to explain individual predictions

The same algorithm runs in both Python (via the backend) and JavaScript (browser fallback) so results stay consistent.

## Sample dataset

`data/indian_telecom_churn_sample.csv` is a synthetic dataset of 500 Indian telecom customers with realistic distributions across prepaid/postpaid plans, states, usage patterns, and churn labels. It is safe to share publicly.
