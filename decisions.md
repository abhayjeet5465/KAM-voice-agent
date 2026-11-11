# Decisions and trade-offs

Short log of what we chose, why, and what we gave up. Newest at the bottom.

| # | Decision | Why | Trade-off accepted |
|---|---|---|---|
| 1 | One static `index.html`, plain JavaScript, no build step | Fastest to build and easiest to explain; the rubric does not reward a framework | Less structure than React |
| 2 | Speech-to-text: Chrome's Web Speech API | Free, streams words live, detects pauses, adds no latency | Chrome and Edge only; other browsers get a "use Chrome" message |
| 3 | LLM: Groq `openai/gpt-oss-120b`, reasoning effort low | Free tier, fast, supports strict JSON output. `llama-3.3-70b-versatile` was shut down on 16 Aug 2026 | Free limits: 30 requests/min, 8K tokens/min, 1,000 requests/day. Prompt is kept compact |
| 4 | Voice: Groq Orpheus (`canopylabs/orpheus-v1-english`), automatic fallback to the browser voice | More natural voice on the same key | Preview model, about 100 requests a day on the free tier. Reviewers may hear the browser voice once quota is spent |
| 5 | Bot turns capped at about 200 characters | Orpheus takes 200 characters per request, so one turn is usually one request; also forces short spoken replies | The longer final summary is split into sentence groups |
| 6 | Strict JSON schema for the model's reply (say, stage, actions, end_call, summary) | The page can speak, log actions and show the summary reliably; no lenient parser needed | Slightly longer prompt. If parsing ever fails the raw text is spoken |
| 7 | One serverless function (`api/groq.js`) from day one, run locally with `vercel dev` | Same code locally and deployed; no throwaway "paste your key" field; key never reaches the browser | Vercel CLI needed for local runs |
| 8 | Proxy only chat and speech, with caps on message count, message length and reply tokens | A public link can spend my quota; caps limit the damage | No Whisper fallback unless Chrome recognition proves unusable |
| 9 | System prompt and seller data live in the server function; the page fetches the data to display it | Visitors cannot turn my key into a general chatbot; one copy of the data | One extra request when the page loads |
| 10 | Model name is one constant, not loaded from the model-list API | A retired model is a one-line change | Manual edit if Groq renames models |
| 11 | Barge-in: mic stays on while the bot speaks; it stops only when it hears 3 or more words the bot is not saying. Clicking the orb also interrupts | Lets the seller interrupt without the bot interrupting itself on its own echo | Needs tuning by ear; headphones recommended. Untested on speakers so far |
| 12 | End of turn: reply 0.7 s after Chrome marks speech final, 1.6 s after unfinished speech | Fast replies without cutting the seller off mid-sentence | Two numbers to tune |
| 13 | Mock details added (store, top three out-of-stock products, cancellation reasons, restock estimate) | Lets the bot be specific; the brief allows labelled assumptions | Shown on screen and in the note as assumptions, consistent with the brief's figures |
| 14 | Mock actions get a `MOCK-####` reference created in the browser | Shows ownership; clearly not a real system | References are random, nothing is stored |
| 16 | Ask first, diagnose second: the bot confirms it sees the drop, then asks 2 to 3 questions before naming the cause | Feels like a manager who listens; the diagnosis can use what the seller said | One or two extra turns before the answer |
| 17 | On a rate limit (429) the server retries at once on `openai/gpt-oss-20b` instead of waiting | A real call uses about 1,400 tokens a turn against an 8,000 per minute limit, so limits will be hit; the backup model has its own quota and avoids dead air | The backup model is smaller, so that turn may be slightly weaker |
| 18 | Server keeps only the first JSON object if the model writes several turns at once | Seen in testing: the model sometimes role-played the whole call and Groq rejected it. "Strict" mode on Groq validates, it does not prevent this | A few wasted tokens when it happens |
| 19 | History sent to the model is trimmed to say, stage and actions; reply capped at 450 tokens | Fewer tokens per turn, so more turns fit in the per-minute limit | None noticed |
| 20 | Browser fallback voice prefers "Natural" (Edge) then Google voices, at 0.95 speed | The default system voice sounds robotic | Voice differs between browsers |
| 15 | Hindi mode and typed-input fallback not built (P2) | Orpheus is English only; P0 and P1 come first | Revisit only if time remains |
