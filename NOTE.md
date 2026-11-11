# Virtual KAM voice assistant: how it works

A browser voice assistant that acts as a Key Account Manager for a seller whose sales dropped. It asks questions first, diagnoses the drop from the account data, recommends actions, logs the ones the seller agrees to, and ends with a summary. All data is mock and all actions are simulated.

## Models and speech

| Part | What is used | Why |
|---|---|---|
| Speech-to-text | Chrome's built-in Web Speech API (`en-IN`) | Free, shows words live, detects pauses, adds no delay. Works in Chrome and Edge only |
| Language model | Groq `openai/gpt-oss-120b`, low reasoning effort | Fast replies (about 1 second in testing), which matters most on a call |
| Backup model | Groq `openai/gpt-oss-20b` | Used at once if the main model is rate limited, so the call does not stall |
| Text-to-speech | Groq Orpheus (`canopylabs/orpheus-v1-english`) | Natural voice. If it is unavailable or out of free quota, the page falls back to the browser's own voice |

## Workflow for one turn

1. **Listen.** The browser turns the seller's speech into text. A turn ends 0.7 seconds after Chrome marks the speech final, or 1.6 seconds after unfinished speech, so the seller is not cut off.
2. **Think.** The page sends the conversation to one small server function. The function holds the API key, the seller data and the instructions, and asks the model for one JSON object: what to say, the call stage, notes on what the seller said, actions taken, and the final summary.
3. **Speak.** The page plays the reply. The seller can interrupt by speaking or by clicking the orb.
4. **Show.** Notes, actions (with a reference number) and the summary appear on screen. Then it listens again.

The call follows six stages: greet, understand (2 to 3 questions, one per turn), diagnose, recommend, commit, summary.

## Business logic

- Sales and orders both fell 32.5% while the average price stayed at Rs 500, so the drop is order volume, not pricing.
- Out-of-stock products rose from 5 to 18. This is treated as the most likely cause.
- Cancellations rose from 8% to 14%. The bot treats the link to stock as a hypothesis and checks it by asking.
- If the seller contradicts the data, the bot asks a question to reconcile the two instead of repeating its advice.
- The bot may only state numbers that are in its data. For anything else it offers to check and call back.

## Assumptions I added (not in the brief)

- Store: Sharma Home Essentials, Home & Kitchen.
- Top three out-of-stock products had 45, 35 and 25 orders last month (105 of the 130 lost orders).
- 38 cancellations this month: 20 no stock, 10 late dispatch, 8 buyer changed mind.
- Restocking the top three could recover up to about 105 orders (about Rs 52,500) a month. This is an estimate.

## Safeguards and limits

- The API key stays on the server. The function caps message count, message length and reply length.
- Model errors, rate limits, a blocked microphone and silence each produce a spoken or on-screen recovery.
- The model sometimes logs an action while only offering it; the page ignores actions until the bot confirms them.
- Free-tier limits mean two simultaneous calls can hit the rate limit. Headphones are recommended, because on speakers the microphone can hear the bot.
- Hindi is not supported.
