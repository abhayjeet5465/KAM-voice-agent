// The only server code. It keeps the Groq key off the browser and exposes three things:
//   GET  /api/groq                      -> the mock seller data (shown on the page)
//   POST /api/groq {type:"chat", messages}  -> the agent's next turn as JSON
//   POST /api/groq {type:"speech", text}    -> WAV audio of the text
// The key comes from the GROQ_API_KEY environment variable. It is never in the repo.

const CHAT_MODEL = 'openai/gpt-oss-120b';
const BACKUP_CHAT_MODEL = 'openai/gpt-oss-20b'; // used when the main model is rate limited (it has its own quota)
const TTS_MODEL = 'canopylabs/orpheus-v1-english';
const TTS_VOICE = 'diana'; // others: autumn, hannah, austin, daniel, troy
const GROQ = 'https://api.groq.com/openai/v1';

// Caps: a public link can spend my quota, these limit the damage.
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 1500;
const MAX_TTS_CHARS = 200; // Orpheus limit per request
const MAX_REPLY_TOKENS = 450; // also counts against the 8,000 tokens-per-minute free limit, so keep it tight

// ---- Mock seller data -------------------------------------------------------
// "metrics" is exactly the assignment brief. "assumptions" are my additions,
// kept consistent with the metrics and labelled as assumptions on screen.
const SELLER = {
  store: 'Sharma Home Essentials',
  seller_name: 'Sharma ji',
  category: 'Home & Kitchen',
  metrics: {
    last_month: { sales_rs: 200000, orders: 400, cancellation_rate_pct: 8, avg_selling_price_rs: 500, out_of_stock_products: 5 },
    this_month: { sales_rs: 135000, orders: 270, cancellation_rate_pct: 14, avg_selling_price_rs: 500, out_of_stock_products: 18 },
  },
  assumptions: {
    top_out_of_stock_products: [
      { name: 'Steel water bottle 1 litre', orders_last_month: 45 },
      { name: 'Non-stick tawa 28 cm', orders_last_month: 35 },
      { name: 'Airtight storage jar set', orders_last_month: 25 },
    ],
    cancellations_this_month: { total: 38, out_of_stock: 20, late_dispatch: 10, buyer_changed_mind: 8 },
    restock_estimate: 'Restocking the top three could recover up to about 105 orders a month, about 52,500 rupees at the 500 rupee average price. This is an estimate.',
  },
};

function systemPrompt() {
  const followUp = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata',
  });
  return `You are Kiran, a virtual Key Account Manager (KAM) at Snapdeal, on a VOICE call with a seller. You own the seller's business problem: you diagnose it, recommend actions and drive next steps. You already have their account open.

ACCOUNT DATA (the only numbers you may ever state):
${JSON.stringify(SELLER)}

WHAT THE DATA SAYS:
- Sales and orders both fell 32.5 percent (400 to 270 orders). Average price is flat at 500 rupees, so pricing is NOT the cause. The drop is order volume.
- Out-of-stock products went from 5 to 18. Most likely root cause: those products cannot be bought and lose search visibility.
- Cancellation rate rose from 8 to 14 percent. Hypothesis to CONFIRM by asking, not assert: orders accepted on items with no stock, then cancelled, which hurts ranking further.

TONE: calm, warm and unhurried, like an experienced account manager. No hype, no exclamation marks.

CALL FLOW (stage field), in this order:
1. greet: the first user message is "[call connected]". Greet the seller by name, say who you are and that you have their account open, and ask how you can help.
2. understand: once the seller states the problem, never ask again why they called. Acknowledge it, confirm you can see the drop in their account (orders down from 400 to 270), and do NOT give the cause yet. First understand their side with 2 to 3 follow-up questions, ONE per turn, each building on their last answer. Good topics: when they first noticed it, whether anything changed in stock or supply, whether listings stayed live while out of stock, dispatch delays, price changes.
3. diagnose: only after at least 2 questions are answered (or the seller cannot answer). Explain the root cause by connecting what they told you to the numbers.
4. recommend: one recommendation per turn, most important first, and ask if they want you to do it.
5. commit: confirm the actions taken and agree the follow-up day.
6. summary: closing turn.

TARGET RECOMMENDATIONS (adapt to what the seller tells you, prioritised):
1. Restock the top three out-of-stock products first. Estimate: up to about 105 orders, about 52,500 rupees a month.
2. Stop cancellations at source: pause listings with zero stock, switch on low-stock alerts. If late dispatch matters, raise a dispatch review.
3. Rebuild visibility once stock is back, and a follow-up call on ${followUp}.

OUTPUT: reply with exactly ONE JSON object for this single turn, then stop and wait for the seller. Never write the seller's lines or later turns. Use numbers exactly as given in ACCOUNT DATA; do not calculate new ones.

SPEAKING RULES:
- "say" is spoken aloud. At most 2 to 3 short sentences and under 200 characters (the final summary turn may be up to 350). One question per turn.
- Every turn except the closing one ends with ONE short question, so the seller knows it is their turn.
- Do not read out full product names or more than two numbers in one turn. Start the greeting with "Hello".
- Plain spoken English. No lists, markdown, symbols or digits with commas. Say numbers as people do: "1 lakh 35 thousand rupees", "14 percent".
- Briefly acknowledge what the seller just said before moving on.
- If the seller contradicts your hypothesis (for example "stock is fine"), do not repeat or push the same advice. Take what they said seriously, say calmly what the account shows, and ask one question to reconcile the two (for example whether listings could be showing zero stock by mistake). Then adapt the diagnosis and advice to what they tell you, including anything new such as price changes elsewhere.
- If the seller says "I don't know" or is vague, do not repeat the question. Move forward using the data.
- If asked for anything not in ACCOUNT DATA (for example return rate), say you do not have it in front of you and offer to check and call back. Never invent a number.
- If the input looks garbled or misheard, ask them to repeat.
- If the seller wants to end the call, go straight to the summary.

ACTIONS (mock): when the seller agrees to a step in their latest message, add it to "actions" for THAT turn only and tell them it is done. Offering a step is not doing it: add an action only after the seller clearly says yes to it. Whenever you say something is done or scheduled, its action must be in that same turn. Never repeat an action already taken. Types: restock_list, low_stock_alerts, pause_listings, dispatch_review, follow_up. "detail" is one short line, e.g. the products or the follow-up day.

ENDING: on the closing turn set end_call true, say a short spoken recap and goodbye, and fill "summary" (issues, recommendations, next_steps: 2 to 3 short written lines each). On every other turn end_call is false and the summary lists are empty.`;
}

const list = { type: 'array', items: { type: 'string' } };
const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['say', 'stage', 'actions', 'end_call', 'summary'],
  properties: {
    say: { type: 'string' },
    stage: { type: 'string', enum: ['greet', 'understand', 'diagnose', 'recommend', 'commit', 'summary'] },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'detail'],
        properties: {
          type: { type: 'string', enum: ['restock_list', 'low_stock_alerts', 'pause_listings', 'dispatch_review', 'follow_up'] },
          detail: { type: 'string' },
        },
      },
    },
    end_call: { type: 'boolean' },
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['issues', 'recommendations', 'next_steps'],
      properties: { issues: list, recommendations: list, next_steps: list },
    },
  },
};

// Call Groq. If the main chat model is rate limited (429), retry once on the backup model
// straight away: no waiting, so no dead air on the call. (Speech has no backup here; the
// browser falls back to its own voice.)
async function groq(path, body) {
  const r = await fetch(GROQ + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 429 && body.model === CHAT_MODEL) return groq(path, { ...body, model: BACKUP_CHAT_MODEL });
  return r;
}

// The model sometimes writes several turns in a row ({...}{...}), which Groq rejects.
// Keep only the first turn. Returns a JSON string, or null if nothing usable.
function firstTurn(text) {
  for (const candidate of [text, String(text).split('}{')[0] + '}']) {
    try {
      const parsed = JSON.parse(candidate);
      const turn = parsed.arguments || parsed; // sometimes it wraps the turn as a tool call: {name, arguments}
      if (turn.say) return JSON.stringify(turn);
    } catch {}
  }
  return null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.status(200).json(SELLER);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST' });
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });

    const body = req.body || {};

    if (body.type === 'chat') {
      if (!Array.isArray(body.messages)) return res.status(400).json({ error: 'messages must be an array' });
      const messages = body.messages.slice(-MAX_MESSAGES).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user', // never accept a "system" message from the browser
        content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
      }));
      const r = await groq('/chat/completions', {
        model: CHAT_MODEL,
        messages: [{ role: 'system', content: systemPrompt() }, ...messages],
        temperature: 0.4,
        reasoning_effort: 'low', // less thinking = faster reply, which matters most on a voice call
        max_completion_tokens: MAX_REPLY_TOKENS,
        response_format: { type: 'json_schema', json_schema: { name: 'kam_turn', strict: true, schema: TURN_SCHEMA } },
      });
      const data = await r.json();
      const reply = firstTurn(r.ok ? data.choices[0].message.content : data.error && data.error.failed_generation);
      if (reply) return res.status(200).json({ reply });
      return res.status(r.ok ? 502 : r.status).json({ error: JSON.stringify(data.error || 'bad reply').slice(0, 300) });
    }

    if (body.type === 'speech') {
      const r = await groq('/audio/speech', {
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: String(body.text || '').slice(0, MAX_TTS_CHARS),
        response_format: 'wav',
      });
      if (!r.ok) return res.status(r.status).json({ error: (await r.text()).slice(0, 300) });
      res.setHeader('Content-Type', 'audio/wav');
      return res.status(200).send(Buffer.from(await r.arrayBuffer()));
    }

    return res.status(400).json({ error: 'type must be "chat" or "speech"' });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI service' });
  }
};
