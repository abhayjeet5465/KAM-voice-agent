# Virtual KAM voice assistant

A voice assistant that plays a Snapdeal Key Account Manager for a seller whose sales dropped. Built for the Snapdeal AI First Intern assignment. All data is mock and all actions are simulated.

**Live demo:** https://kam-voice-agent.vercel.app

## Try it

1. Open the link in Chrome or Edge on a computer. Headphones are recommended.
2. Click **Start call** and allow the microphone.
3. Say: "My sales have dropped significantly this month. I don't understand why. Can you help me?"
4. Answer its questions, agree to its suggestions, and say "that's all" to get the summary.

You can interrupt the assistant by speaking or by clicking the orb. No key or account is needed.

## What is on the screen

- **Left: orb, label and transcript.** The orb and label show whether the assistant is listening, thinking or speaking; the live transcript sits underneath.
- **Right sidebar** (hide or show it with the button at the top right):
  - **Call tab:** what the assistant noted from your answers, the simulated actions it took or scheduled, and the call summary (key issues, recommendations, next steps).
  - **Account tab:** the figures from the assignment brief, plus the mock assumptions added on top.
  - **Add info tab:** optional extra facts (typed, pasted, or a text, CSV or JSON file) the assistant can use.

## How it works

See [NOTE.md](NOTE.md) for the models, speech pipeline and workflow, and [decisions.md](decisions.md) for each trade-off and why it was made.

- `index.html`: the page and the listen, think, speak loop. Plain JavaScript, no build step.
- `api/groq.js`: one serverless function. It holds the seller data, the prompt and the Groq API key, and proxies the chat and speech calls.

## Run it locally

1. Install Node.js, then run `npm i -g vercel`.
2. Create a file named `.env` containing `GROQ_API_KEY=` followed by a Groq key.
3. For the natural voice, accept the Orpheus model terms once in the Groq console. Without that, the browser voice is used.
4. Run `vercel dev` and open `http://localhost:3000` in Chrome.

## Known limits

- Chrome and Edge only.
- English only.
- Groq free-tier rate limits: two calls at the same time may fail with a "trouble connecting" message.
- On laptop speakers the assistant may hear itself; use headphones.
