import { useState, useEffect, useRef, useCallback } from "react";
const SYSTEM_PROMPT_NORMAL = `You are an expert English communication coach for students. You help students improve their English.

HINDI SUPPORT: If the student writes or speaks in Hindi (or Hinglish), you must:
1. Translate what they said to English — say "You said: [English translation]"
2. Teach them the correct English phrase they should use
3. Then answer their question/continue the conversation in English
4. Encourage them to try saying it in English next time

ENGLISH MISTAKES: If the student speaks in English with mistakes, correct them gently.

Always analyze for: grammar errors, wrong word choice, missing articles, incorrect tense, awkward phrasing.

Respond ONLY with a valid JSON object — no text before or after, no markdown, no explanation:
{
  "reply": "Your spoken reply. If Hindi input: first translate and teach English, then answer. If English: correct mistakes then answer. End with a follow-up question.",
  "feedback": [
    {
      "type": "error",
      "wrong": "what the student said wrongly",
      "correct": "the correct English version",
      "explanation": "brief reason"
    }
  ],
  "hindi_input": "if student spoke Hindi, write the English translation here, else empty string",
  "praise": "one specific encouragement, empty string if none",
  "scores": { "grammar": 0-100, "vocab": 0-100, "fluency": 0-100 }
}
Rules: feedback 0-3 items. Only real mistakes. scores reflect THIS message only.`;

const SYSTEM_PROMPT_CORRECTION = `You are an expert English communication coach. The student is in CORRECTION MODE.

HINDI SUPPORT: If the student writes or speaks in Hindi (or Hinglish), you must:
1. Say "You said in Hindi: [English translation of what they said]"
2. Teach them exactly how to say it in English
3. Then answer their question in English
4. Encourage them to repeat it in English

CORRECTION MODE: If student speaks English with mistakes, FIRST correct them out loud before answering.
Use phrases like: "Just a small correction — instead of saying X, say Y because Z. Now to answer..."

Respond ONLY with a valid JSON object — no text before or after, no markdown:
{
  "reply": "Spoken reply. For Hindi: translate + teach English phrase + answer. For English mistakes: correct first then answer. End with follow-up question.",
  "feedback": [
    {
      "type": "error",
      "wrong": "what student said wrongly",
      "correct": "correct English version",
      "explanation": "brief reason"
    }
  ],
  "hindi_input": "English translation if student spoke Hindi, else empty string",
  "praise": "specific praise if no mistakes, else empty string",
  "scores": { "grammar": 0-100, "vocab": 0-100, "fluency": 0-100 }
}
Rules: If mistakes exist reply MUST verbally correct first. Keep tone warm and encouraging.`;


async function callGroq(messages, correctionMode = false) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1200,
      system: correctionMode ? SYSTEM_PROMPT_CORRECTION : SYSTEM_PROMPT_NORMAL,
      messages,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const raw = data.content?.map((b) => b.text || "").join("") || "";
  console.log("RAW:", raw.slice(0, 300));
  try {
    // Strip any text before/after the JSON object
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON braces found");
    const clean = raw.slice(start, end + 1);
    const parsed = JSON.parse(clean);
    // Ensure required fields exist
    return {
      reply:       parsed.reply       || "Let's keep practising!",
      feedback:    Array.isArray(parsed.feedback) ? parsed.feedback : [],
      praise:      parsed.praise      || "",
      hindi_input: parsed.hindi_input || "",
      scores:      parsed.scores      || { grammar: 75, vocab: 75, fluency: 75 },
    };
  } catch(e) {
    console.error("JSON parse error:", e.message, "raw:", raw.slice(0,200));
    // If raw looks like a plain reply (no JSON at all), use it directly
    const plainText = raw.replace(/```json|```|\{|\}/g,"").trim();
    return {
      reply: plainText || "Could you try that again?",
      feedback: [], praise: "", hindi_input: "",
      scores: { grammar: 75, vocab: 75, fluency: 75 }
    };
  }
}

const MOUTH_SEQUENCE = ["rest","small","medium","oh","wide","ee","medium","small","oh","medium","rest","small","wide","ee","medium"];
const MOUTH_SHAPES = {
  rest:   "M38 62 Q50 64 62 62",
  small:  "M40 61 Q50 66 60 61",
  medium: "M38 60 Q50 70 62 60",
  wide:   "M36 59 Q50 72 64 59",
  oh:     "M43 58 Q50 74 57 58",
  ee:     "M36 61 Q50 65 64 61",
};
const MOUTH_OPEN = { rest: 0, small: 4, medium: 8, wide: 12, oh: 14, ee: 6 };

// ── Avatar definitions ──────────────────────────────────────────────────────
const AVATARS = [
  { id:"aria",    name:"Ms. Aria",   role:"English Coach",    bg:"linear-gradient(145deg,#2a2d50,#1a1d38)", border:"#6c63ff" },
  { id:"james",   name:"Mr. James",  role:"Conversation Pro",  bg:"linear-gradient(145deg,#1a3040,#0d1e2a)", border:"#00b4d8" },
  { id:"priya",   name:"Ms. Priya",  role:"Grammar Expert",   bg:"linear-gradient(145deg,#3a1a40,#251030)", border:"#e040fb" },
  { id:"tom",     name:"Mr. Tom",    role:"Fluency Coach",    bg:"linear-gradient(145deg,#1a3020,#0d2015)", border:"#00e5c3" },
  { id:"sara",    name:"Ms. Sara",   role:"Accent Trainer",   bg:"linear-gradient(145deg,#402a1a,#2a1a0d)", border:"#ffd166" },
];

function AvatarFace({ isSpeaking, mouthIdx, avatarId }) {
  const [blink, setBlink] = useState(false);
  const [eyebrowRaise, setEyebrowRaise] = useState(false);
  const [headTilt, setHeadTilt] = useState(0);

  useEffect(() => {
    const schedBlink = () => {
      const t = 2000 + Math.random() * 3000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); schedBlink(); }, 150);
      }, t);
    };
    const id = schedBlink();
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!isSpeaking) { setEyebrowRaise(false); setHeadTilt(0); return; }
    const iv = setInterval(() => {
      setEyebrowRaise(Math.random() > 0.6);
      setHeadTilt((Math.random() - 0.5) * 4);
    }, 400);
    return () => clearInterval(iv);
  }, [isSpeaking]);

  const shapeName = MOUTH_SEQUENCE[mouthIdx % MOUTH_SEQUENCE.length];
  const mouthD    = MOUTH_SHAPES[shapeName];
  const mouthOpen = MOUTH_OPEN[shapeName];
  const eyeRy     = blink ? 0.08 : 1;
  const lBrow = eyebrowRaise ? "M30 32 Q40 27 50 30" : "M30 34 Q40 30 50 33";
  const rBrow = eyebrowRaise ? "M50 30 Q60 27 70 32" : "M50 33 Q60 30 70 34";

  if (avatarId === "james") return <JamesFace mouthD={mouthD} mouthOpen={mouthOpen} eyeRy={eyeRy} lBrow={lBrow} rBrow={rBrow} headTilt={headTilt}/>;
  if (avatarId === "priya") return <PriyaFace mouthD={mouthD} mouthOpen={mouthOpen} eyeRy={eyeRy} lBrow={lBrow} rBrow={rBrow} headTilt={headTilt}/>;
  if (avatarId === "tom")   return <TomFace   mouthD={mouthD} mouthOpen={mouthOpen} eyeRy={eyeRy} lBrow={lBrow} rBrow={rBrow} headTilt={headTilt}/>;
  if (avatarId === "sara")  return <SaraFace  mouthD={mouthD} mouthOpen={mouthOpen} eyeRy={eyeRy} lBrow={lBrow} rBrow={rBrow} headTilt={headTilt}/>;
  return <AriaFace mouthD={mouthD} mouthOpen={mouthOpen} eyeRy={eyeRy} lBrow={lBrow} rBrow={rBrow} headTilt={headTilt}/>;
}

// ── Ms. Aria — Light skin, dark hair, blue shirt ─────────────────────────────
function AriaFace({ mouthD, mouthOpen, eyeRy, lBrow, rBrow, headTilt }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", height:"100%", transition:"transform 0.3s ease", transform:`rotate(${headTilt}deg)` }}>
      <rect x="42" y="88" width="16" height="12" rx="4" fill="#e8b88a"/>
      <path d="M10 110 Q25 90 42 88 L50 95 L58 88 Q75 90 90 110 Z" fill="#4a5aaa"/>
      <path d="M50 95 L44 108 L50 104 L56 108 Z" fill="white"/>
      <ellipse cx="50" cy="50" rx="36" ry="40" fill="#f0c090"/>
      <ellipse cx="50" cy="16" rx="36" ry="16" fill="#3a2510"/>
      <rect x="14" y="16" width="72" height="18" rx="2" fill="#3a2510"/>
      <ellipse cx="16" cy="45" rx="6" ry="18" fill="#3a2510"/>
      <ellipse cx="84" cy="45" rx="6" ry="18" fill="#3a2510"/>
      <ellipse cx="50" cy="52" rx="30" ry="34" fill="#f0c090"/>
      <ellipse cx="20" cy="52" rx="6" ry="8" fill="#e8a870"/>
      <ellipse cx="80" cy="52" rx="6" ry="8" fill="#e8a870"/>
      <path d={lBrow} stroke="#3a2510" strokeWidth="2.5" strokeLinecap="round"/>
      <path d={rBrow} stroke="#3a2510" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="37" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="63" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="37" cy="46" rx="4.5" ry={6*eyeRy} fill="#5a3a1a"/>
      <ellipse cx="63" cy="46" rx="4.5" ry={6*eyeRy} fill="#5a3a1a"/>
      <ellipse cx="37.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#111"/>
      <ellipse cx="63.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#111"/>
      <circle cx="39" cy="44" r="1.2" fill="white"/>
      <circle cx="65" cy="44" r="1.2" fill="white"/>
      <path d="M50 52 Q47 58 46 60 Q50 62 54 60 Q53 58 50 52" fill="#d8a070"/>
      <ellipse cx="47" cy="60" rx="2" ry="1.2" fill="#c89060"/>
      <ellipse cx="53" cy="60" rx="2" ry="1.2" fill="#c89060"/>
      <ellipse cx="28" cy="58" rx="7" ry="4" fill="rgba(255,150,120,0.2)"/>
      <ellipse cx="72" cy="58" rx="7" ry="4" fill="rgba(255,150,120,0.2)"/>
      {mouthOpen > 0 && <path d={mouthD} fill="#2a0a0a"/>}
      {mouthOpen > 6 && <path d={`M41 ${62-mouthOpen*0.3} Q50 ${62-mouthOpen*0.2} 59 ${62-mouthOpen*0.3}`} fill="white"/>}
      <path d={mouthD} stroke="#c07050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ── Mr. James — Dark skin, short hair, suit ──────────────────────────────────
function JamesFace({ mouthD, mouthOpen, eyeRy, lBrow, rBrow, headTilt }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", height:"100%", transition:"transform 0.3s ease", transform:`rotate(${headTilt}deg)` }}>
      <rect x="42" y="88" width="16" height="12" rx="4" fill="#8B6040"/>
      <path d="M10 110 Q25 90 42 88 L50 95 L58 88 Q75 90 90 110 Z" fill="#1a1a2e"/>
      <path d="M42 88 L50 95 L58 88 L56 88 L50 91 L44 88 Z" fill="white"/>
      {/* Tie */}
      <path d="M50 91 L47 110 L50 107 L53 110 Z" fill="#c0392b"/>
      <ellipse cx="50" cy="50" rx="36" ry="40" fill="#8B6040"/>
      {/* Short hair */}
      <ellipse cx="50" cy="14" rx="32" ry="12" fill="#1a0a00"/>
      <rect x="18" y="14" width="64" height="10" rx="2" fill="#1a0a00"/>
      <ellipse cx="50" cy="52" rx="30" ry="34" fill="#8B6040"/>
      <ellipse cx="20" cy="52" rx="6" ry="8" fill="#7a5030"/>
      <ellipse cx="80" cy="52" rx="6" ry="8" fill="#7a5030"/>
      <path d={lBrow} stroke="#1a0a00" strokeWidth="2.5" strokeLinecap="round"/>
      <path d={rBrow} stroke="#1a0a00" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="37" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="63" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="37" cy="46" rx="4.5" ry={6*eyeRy} fill="#2a1a0a"/>
      <ellipse cx="63" cy="46" rx="4.5" ry={6*eyeRy} fill="#2a1a0a"/>
      <ellipse cx="37.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <ellipse cx="63.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <circle cx="39" cy="44" r="1.2" fill="white"/>
      <circle cx="65" cy="44" r="1.2" fill="white"/>
      <path d="M50 52 Q47 58 46 60 Q50 61 54 60 Q53 58 50 52" fill="#6a4020"/>
      {/* Beard stubble */}
      <ellipse cx="40" cy="68" rx="6" ry="3" fill="rgba(26,10,0,0.15)"/>
      <ellipse cx="60" cy="68" rx="6" ry="3" fill="rgba(26,10,0,0.15)"/>
      <ellipse cx="50" cy="72" rx="8" ry="3" fill="rgba(26,10,0,0.15)"/>
      {mouthOpen > 0 && <path d={mouthD} fill="#1a0505"/>}
      {mouthOpen > 6 && <path d={`M41 ${62-mouthOpen*0.3} Q50 ${62-mouthOpen*0.2} 59 ${62-mouthOpen*0.3}`} fill="#f0d0b0"/>}
      <path d={mouthD} stroke="#6a3020" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ── Ms. Priya — South Asian, long dark hair, earrings ────────────────────────
function PriyaFace({ mouthD, mouthOpen, eyeRy, lBrow, rBrow, headTilt }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", height:"100%", transition:"transform 0.3s ease", transform:`rotate(${headTilt}deg)` }}>
      <rect x="42" y="88" width="16" height="12" rx="4" fill="#c8905a"/>
      <path d="M10 110 Q25 90 42 88 L50 95 L58 88 Q75 90 90 110 Z" fill="#8B1a4a"/>
      <path d="M50 95 L44 108 L50 104 L56 108 Z" fill="#ffd700"/>
      {/* Long hair sides */}
      <ellipse cx="14" cy="60" rx="8" ry="28" fill="#1a0a05"/>
      <ellipse cx="86" cy="60" rx="8" ry="28" fill="#1a0a05"/>
      <ellipse cx="50" cy="50" rx="36" ry="40" fill="#c8905a"/>
      {/* Hair top */}
      <ellipse cx="50" cy="14" rx="34" ry="14" fill="#1a0a05"/>
      <rect x="16" y="14" width="68" height="16" rx="2" fill="#1a0a05"/>
      {/* Bindi */}
      <circle cx="50" cy="30" r="2.5" fill="#c0392b"/>
      <ellipse cx="50" cy="52" rx="30" ry="34" fill="#c8905a"/>
      <ellipse cx="20" cy="52" rx="5" ry="7" fill="#b87848"/>
      <ellipse cx="80" cy="52" rx="5" ry="7" fill="#b87848"/>
      {/* Earrings */}
      <circle cx="16" cy="56" r="3" fill="#ffd700" stroke="#b8860b" strokeWidth="0.5"/>
      <circle cx="84" cy="56" r="3" fill="#ffd700" stroke="#b8860b" strokeWidth="0.5"/>
      <path d={lBrow} stroke="#1a0a05" strokeWidth="2.5" strokeLinecap="round"/>
      <path d={rBrow} stroke="#1a0a05" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="37" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="63" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="37" cy="46" rx="4.5" ry={6*eyeRy} fill="#2a1505"/>
      <ellipse cx="63" cy="46" rx="4.5" ry={6*eyeRy} fill="#2a1505"/>
      <ellipse cx="37.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <ellipse cx="63.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <circle cx="39" cy="44" r="1.2" fill="white"/>
      <circle cx="65" cy="44" r="1.2" fill="white"/>
      {/* Eyeliner */}
      <path d="M30 45 Q37 42 44 45" stroke="#1a0a05" strokeWidth="1" fill="none"/>
      <path d="M56 45 Q63 42 70 45" stroke="#1a0a05" strokeWidth="1" fill="none"/>
      <path d="M50 52 Q47 58 46 60 Q50 62 54 60 Q53 58 50 52" fill="#a87040"/>
      <ellipse cx="35" cy="57" rx="5" ry="3" fill="rgba(220,80,100,0.2)"/>
      <ellipse cx="65" cy="57" rx="5" ry="3" fill="rgba(220,80,100,0.2)"/>
      {mouthOpen > 0 && <path d={mouthD} fill="#2a0505"/>}
      {mouthOpen > 6 && <path d={`M41 ${62-mouthOpen*0.3} Q50 ${62-mouthOpen*0.2} 59 ${62-mouthOpen*0.3}`} fill="white"/>}
      <path d={mouthD} stroke="#c06070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ── Mr. Tom — Blonde, casual, friendly ───────────────────────────────────────
function TomFace({ mouthD, mouthOpen, eyeRy, lBrow, rBrow, headTilt }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", height:"100%", transition:"transform 0.3s ease", transform:`rotate(${headTilt}deg)` }}>
      <rect x="42" y="88" width="16" height="12" rx="4" fill="#f5d5a0"/>
      <path d="M10 110 Q25 90 42 88 L50 95 L58 88 Q75 90 90 110 Z" fill="#2ecc71"/>
      <path d="M50 95 L44 108 L50 104 L56 108 Z" fill="white"/>
      <ellipse cx="50" cy="50" rx="36" ry="40" fill="#f5d5a0"/>
      {/* Blonde wavy hair */}
      <ellipse cx="50" cy="14" rx="34" ry="14" fill="#d4a017"/>
      <rect x="16" y="14" width="68" height="16" rx="8" fill="#d4a017"/>
      <path d="M16 22 Q20 30 16 38" stroke="#d4a017" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M84 22 Q80 30 84 38" stroke="#d4a017" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <ellipse cx="50" cy="52" rx="30" ry="34" fill="#f5d5a0"/>
      <ellipse cx="20" cy="52" rx="6" ry="8" fill="#e8c080"/>
      <ellipse cx="80" cy="52" rx="6" ry="8" fill="#e8c080"/>
      {/* Blonde brows */}
      <path d={lBrow} stroke="#c8900a" strokeWidth="2" strokeLinecap="round"/>
      <path d={rBrow} stroke="#c8900a" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="37" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="63" cy="45" rx="7" ry="6" fill="white"/>
      {/* Blue eyes */}
      <ellipse cx="37" cy="46" rx="4.5" ry={6*eyeRy} fill="#1a6aaa"/>
      <ellipse cx="63" cy="46" rx="4.5" ry={6*eyeRy} fill="#1a6aaa"/>
      <ellipse cx="37.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <ellipse cx="63.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <circle cx="39" cy="44" r="1.2" fill="white"/>
      <circle cx="65" cy="44" r="1.2" fill="white"/>
      <path d="M50 52 Q47 58 46 60 Q50 62 54 60 Q53 58 50 52" fill="#d8b080"/>
      {/* Freckles */}
      {[32,36,40,60,64,68].map((x,i)=><circle key={i} cx={x} cy={i<3?57:57} r="0.8" fill="rgba(180,100,50,0.4)"/>)}
      <ellipse cx="30" cy="58" rx="6" ry="3" fill="rgba(255,160,120,0.25)"/>
      <ellipse cx="70" cy="58" rx="6" ry="3" fill="rgba(255,160,120,0.25)"/>
      {mouthOpen > 0 && <path d={mouthD} fill="#2a0a0a"/>}
      {mouthOpen > 6 && <path d={`M41 ${62-mouthOpen*0.3} Q50 ${62-mouthOpen*0.2} 59 ${62-mouthOpen*0.3}`} fill="white"/>}
      <path d={mouthD} stroke="#c08060" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

// ── Ms. Sara — East Asian, straight black hair, glasses ──────────────────────
function SaraFace({ mouthD, mouthOpen, eyeRy, lBrow, rBrow, headTilt }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", height:"100%", transition:"transform 0.3s ease", transform:`rotate(${headTilt}deg)` }}>
      <rect x="42" y="88" width="16" height="12" rx="4" fill="#f0d0a0"/>
      <path d="M10 110 Q25 90 42 88 L50 95 L58 88 Q75 90 90 110 Z" fill="#e74c3c"/>
      <path d="M50 95 L44 108 L50 104 L56 108 Z" fill="white"/>
      <ellipse cx="50" cy="50" rx="36" ry="40" fill="#f0d0a0"/>
      {/* Straight black hair with bangs */}
      <ellipse cx="50" cy="13" rx="34" ry="12" fill="#0a0a0a"/>
      <rect x="16" y="13" width="68" height="22" rx="2" fill="#0a0a0a"/>
      {/* Bangs */}
      <rect x="20" y="22" width="60" height="12" rx="4" fill="#0a0a0a"/>
      <ellipse cx="14" cy="58" rx="6" ry="25" fill="#0a0a0a"/>
      <ellipse cx="86" cy="58" rx="6" ry="25" fill="#0a0a0a"/>
      <ellipse cx="50" cy="52" rx="30" ry="34" fill="#f0d0a0"/>
      <ellipse cx="20" cy="52" rx="5" ry="7" fill="#dcc090"/>
      <ellipse cx="80" cy="52" rx="5" ry="7" fill="#dcc090"/>
      <path d={lBrow} stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
      <path d={rBrow} stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="37" cy="45" rx="7" ry="6" fill="white"/>
      <ellipse cx="63" cy="45" rx="7" ry="6" fill="white"/>
      {/* Dark brown eyes */}
      <ellipse cx="37" cy="46" rx="4.5" ry={6*eyeRy} fill="#1a0a00"/>
      <ellipse cx="63" cy="46" rx="4.5" ry={6*eyeRy} fill="#1a0a00"/>
      <ellipse cx="37.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <ellipse cx="63.5" cy="46" rx="2.5" ry={3.5*eyeRy} fill="#000"/>
      <circle cx="39" cy="44" r="1.2" fill="white"/>
      <circle cx="65" cy="44" r="1.2" fill="white"/>
      {/* Glasses */}
      <rect x="28" y="40" width="18" height="13" rx="4" stroke="#333" strokeWidth="1.5" fill="rgba(200,230,255,0.15)"/>
      <rect x="54" y="40" width="18" height="13" rx="4" stroke="#333" strokeWidth="1.5" fill="rgba(200,230,255,0.15)"/>
      <path d="M46 46 L54 46" stroke="#333" strokeWidth="1.5"/>
      <path d="M14 43 L28 44" stroke="#333" strokeWidth="1.5"/>
      <path d="M72 44 L86 43" stroke="#333" strokeWidth="1.5"/>
      <path d="M50 52 Q47 57 46 59 Q50 61 54 59 Q53 57 50 52" fill="#d0a070"/>
      <ellipse cx="33" cy="57" rx="5" ry="3" fill="rgba(255,140,120,0.2)"/>
      <ellipse cx="67" cy="57" rx="5" ry="3" fill="rgba(255,140,120,0.2)"/>
      {mouthOpen > 0 && <path d={mouthD} fill="#2a0505"/>}
      {mouthOpen > 6 && <path d={`M41 ${62-mouthOpen*0.3} Q50 ${62-mouthOpen*0.2} 59 ${62-mouthOpen*0.3}`} fill="white"/>}
      <path d={mouthD} stroke="#c07060" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}


function SoundRings({ active }) {
  return (
    <>
      {[1,2,3].map(i => (
        <div key={i} style={{
          position: "absolute", borderRadius: "50%",
          width: `min(${180 + i*50}px, ${18 + i*5}vh)`, height: `min(${180 + i*50}px, ${18 + i*5}vh)`,
          border: `2px solid rgba(108,99,255,${0.5 - i*0.12})`,
          animation: active
            ? `ringExpand 1.2s ${i*0.35}s ease-out infinite`
            : `ringPulse 3s ${i*0.5}s ease-in-out infinite`,
        }}/>
      ))}
      <style>{`
        @keyframes ringExpand{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(1.2);opacity:0}}
        @keyframes ringPulse{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(1.06);opacity:0.1}}
      `}</style>
    </>
  );
}

function WaveForm({ active }) {
  const bars = [5,12,18,26,16,22,10,20,14,7,20,16,12,24,9];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:3, height:36 }}>
      {bars.map((h,i) => (
        <div key={i} style={{
          width:3, borderRadius:3,
          background: active ? `rgba(0,229,195,${0.5+(i%3)*0.15})` : "rgba(107,112,153,0.25)",
          height: active ? h : 3,
          transition: "height 0.12s ease, background 0.3s",
          animation: active ? `waveBar 0.${4+(i%4)}s ${i*0.05}s ease-in-out infinite alternate` : "none",
        }}/>
      ))}
      <style>{`@keyframes waveBar{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}`}</style>
    </div>
  );
}

function ScorePill({ label, value }) {
  const color = value===null ? "#6b7099" : value>=80 ? "#06d6a0" : value>=60 ? "#ffd166" : "#ff6b6b";
  return (
    <div style={{ flex:1, background:"#111422", border:"1px solid #242840", borderRadius:10, padding:"10px 6px", textAlign:"center" }}>
      <div style={{ fontFamily:"Georgia,serif", fontSize:"1.5rem", color, lineHeight:1, fontWeight:700 }}>
        {value===null ? "—" : `${value}%`}
      </div>
      <div style={{ fontSize:"0.62rem", color:"#6b7099", marginTop:3, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages]       = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [feedback, setFeedback]       = useState([]);
  const [praise, setPraise]           = useState("");
  const [scores, setScores]           = useState({ grammar:null, vocab:null, fluency:null });
  const [input, setInput]             = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [countdown, setCountdown] = useState(null); // null = not counting, 0-3 = counting
  const [pendingText, setPendingText] = useState("");
  const countdownTimer = useRef(null);
  const [selectedAvatar, setSelectedAvatar] = useState("aria");
  const [showSetup, setShowSetup] = useState(true);
  const [showAvatarPanel, setShowAvatarPanel] = useState(false);
  const [avatarNames, setAvatarNames] = useState({ aria:"Ms. Aria", james:"Mr. James", priya:"Ms. Priya", tom:"Mr. Tom", sara:"Ms. Sara" });
  const [editingName, setEditingName] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [subtitle, setSubtitle]       = useState("");
  const [mouthIdx, setMouthIdx]       = useState(0);
  const [started, setStarted]         = useState(false);
  const transcriptRef = useRef(null);
  const recogRef      = useRef(null);
  const mouthTimer    = useRef(null);
  const pauseTimer    = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages]);

  // Preload voices (browser loads them async)
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const startLipSync = useCallback(() => {
    let idx = 0;
    mouthTimer.current = setInterval(() => {
      idx = (idx + 1) % MOUTH_SEQUENCE.length;
      setMouthIdx(idx);
    }, 110);
  }, []);

  const stopLipSync = useCallback(() => {
    clearInterval(mouthTimer.current);
    setMouthIdx(0);
  }, []);

  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);

      // Each avatar gets a distinct voice profile
      const voiceProfiles = {
        aria:  { rate: 0.92, pitch: 1.2,  lang: "en-US", keywords: /samantha|zira|female|karen|victoria/i },
        james: { rate: 0.85, pitch: 0.85, lang: "en-GB", keywords: /george|daniel|male|guy|david|james/i },
        priya: { rate: 0.95, pitch: 1.15, lang: "en-IN", keywords: /rishi|veena|india|heera/i },
        tom:   { rate: 1.0,  pitch: 1.0,  lang: "en-AU", keywords: /karen|catherine|australia/i },
        sara:  { rate: 0.9,  pitch: 1.25, lang: "en-US", keywords: /siri|susan|allison|ava/i },
      };

      const profile = voiceProfiles[selectedAvatar] || voiceProfiles.aria;
      utt.rate  = profile.rate;
      utt.pitch = profile.pitch;
      utt.lang  = profile.lang;

      const voices = window.speechSynthesis.getVoices();

      // Try to find a voice matching this avatar's keywords and preferred lang
      let voice =
        voices.find(v => v.lang.startsWith(profile.lang.split("-")[0]) && profile.keywords.test(v.name)) ||
        voices.find(v => v.lang === profile.lang) ||
        voices.find(v => v.lang.startsWith(profile.lang.split("-")[0]));

      // Fallback: for male avatars pick any male-sounding voice, females pick female
      if (!voice) {
        const isMale = selectedAvatar === "james" || selectedAvatar === "tom";
        voice = isMale
          ? voices.find(v => v.lang.startsWith("en") && /male|guy|man|george|daniel|david/i.test(v.name))
          : voices.find(v => v.lang.startsWith("en") && /female|woman|girl|samantha|karen|victoria|zira/i.test(v.name));
      }

      // Last fallback
      if (!voice) voice = voices.find(v => v.lang.startsWith("en"));
      if (voice) utt.voice = voice;

      console.log("Voice for", selectedAvatar, ":", voice?.name, voice?.lang);

      utt.onstart = () => { setIsSpeaking(true); setSubtitle(text); startLipSync(); };
      utt.onend   = () => { setIsSpeaking(false); setSubtitle(""); stopLipSync(); resolve(); };
      utt.onerror = () => { setIsSpeaking(false); setSubtitle(""); stopLipSync(); resolve(); };
      window.speechSynthesis.speak(utt);
    });
  }, [startLipSync, stopLipSync, selectedAvatar]);

  const sendTurn = useCallback(async (userText, newApiMsgs) => {
    setIsLoading(true);
    try {
      const result = await callGroq(newApiMsgs, correctionMode);
      const coachText = result.reply || "Let's keep practising!";
      setApiMessages(prev => [...prev, { role:"assistant", content:coachText }]);
      // If Hindi was detected, add a translation note message before coach reply
      if (result.hindi_input) {
        setMessages(prev => [...prev,
          { role:"translation", text: result.hindi_input }
        ]);
      }
      setMessages(prev => [...prev, { role:"coach", text:coachText }]);
      if (result.feedback?.length) setFeedback(result.feedback); else setFeedback([]);
      if (result.praise) setPraise(result.praise);
      if (result.scores) setScores(result.scores);
      setIsLoading(false);
      await speak(coachText);
    } catch(err) {
      setIsLoading(false);
      setMessages(prev => [...prev, { role:"coach", text:`⚠️ ${err.message}` }]);
    }
  }, [speak, correctionMode, selectedAvatar]);

  const startSession = useCallback(() => {
    setShowSetup(false);
    if (started) return;
    setStarted(true);
    const name = avatarNames[selectedAvatar];
    const welcome = `Hello! I'm ${name}, your personal English coach. I'm so excited to practise with you today! Let's start simple — can you tell me a little bit about yourself? What do you like to do in your free time?`;
    setMessages([{ role:"coach", text:welcome }]);
    setApiMessages([{ role:"assistant", content:welcome }]);
    setTimeout(() => speak(welcome), 700);
  }, [avatarNames, selectedAvatar, started, speak]);

  const handleSubmit = useCallback(async (text) => {
    if (!text.trim() || isLoading || isSpeaking) return;
    setInput("");
    const newApiMsgs = [...apiMessages, { role:"user", content:text }];
    setApiMessages(newApiMsgs);
    setMessages(prev => [...prev, { role:"student", text }]);
    await sendTurn(text, newApiMsgs);
  }, [isLoading, isSpeaking, apiMessages, sendTurn]);

  const startCountdown = useCallback((text) => {
    setPendingText(text);
    setInput(text);
    setCountdown(3);
    let secs = 3;
    countdownTimer.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(countdownTimer.current);
        setCountdown(null);
        setPendingText("");
        handleSubmit(text);
      }
    }, 1000);
  }, [handleSubmit]);

  const cancelCountdown = useCallback(() => {
    clearInterval(countdownTimer.current);
    setCountdown(null);
    setPendingText("");
  }, []);

  const sendNow = useCallback(() => {
    clearInterval(countdownTimer.current);
    const text = pendingText;
    setCountdown(null);
    setPendingText("");
    handleSubmit(text);
  }, [pendingText, handleSubmit]);

  const toggleMic = useCallback(() => {
    if (isSpeaking || isLoading) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome or Edge for mic support, or type below."); return; }

    if (isRecording) {
      // Manual stop
      recogRef.current?.stop();
      setIsRecording(false);
      clearTimeout(pauseTimer.current);
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;       // Keep recording continuously
    rec.interimResults = true;
    recogRef.current = rec;

    let fullTranscript = "";
    let lastSpeechTime = Date.now();
    const PAUSE_THRESHOLD = 2500; // 2.5 seconds of silence = done

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          fullTranscript += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setInput(fullTranscript + interim);
      lastSpeechTime = Date.now();

      // Reset pause timer every time speech is detected
      clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => {
        // User paused for PAUSE_THRESHOLD ms — stop and send
        if (fullTranscript.trim()) {
          rec.stop();
          setIsRecording(false);
          const text = fullTranscript.trim();
          if (autoSend) {
            handleSubmit(text);
          } else {
            startCountdown(text);
          }
        }
      }, PAUSE_THRESHOLD);
    };

    rec.onend = () => {
      // Only handle if not already handled by pause timer
      setIsRecording(false);
      clearTimeout(pauseTimer.current);
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech") {
        // Restart on no-speech to keep listening
        if (isRecording) rec.start();
        return;
      }
      setIsRecording(false);
      clearTimeout(pauseTimer.current);
      console.warn("Mic:", e.error);
    };

    rec.start();
    setIsRecording(true);
  }, [isRecording, isSpeaking, isLoading, handleSubmit, autoSend, startCountdown]);
  const card = { background:"#161929", border:"1px solid #242840", borderRadius:16 };


  // Reusable avatar picker grid
  const AvatarPickerGrid = () => (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
      {AVATARS.map(av => (
        <div key={av.id} onClick={() => setSelectedAvatar(av.id)}
          style={{ cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8,
            padding:"16px 12px", borderRadius:16, transition:"all 0.2s", minWidth:90,
            background: selectedAvatar===av.id ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.04)",
            border: selectedAvatar===av.id ? `2px solid ${av.border}` : "2px solid rgba(255,255,255,0.06)",
            boxShadow: selectedAvatar===av.id ? `0 0 20px ${av.border}40` : "none",
            transform: selectedAvatar===av.id ? "scale(1.06)" : "scale(1)" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:av.bg,
            border:`3px solid ${av.border}${selectedAvatar===av.id?"cc":"60"}`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2rem",
            boxShadow: selectedAvatar===av.id ? `0 0 16px ${av.border}50` : "none" }}>
            {av.id==="aria"?"👩": av.id==="james"?"👨🏿": av.id==="priya"?"👩🏽": av.id==="tom"?"👱":"👩🏻"}
          </div>
          {/* Editable name */}
          {editingName===av.id ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }} onClick={e=>e.stopPropagation()}>
              <input autoFocus value={nameInput} onChange={e=>setNameInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"){setAvatarNames(p=>({...p,[av.id]:nameInput||av.name}));setEditingName(null);} if(e.key==="Escape")setEditingName(null); }}
                style={{ width:80, background:"#0d0f1c", border:"1px solid #6c63ff", borderRadius:6,
                  padding:"4px 6px", color:"#e8eaf0", fontSize:"0.72rem", textAlign:"center", outline:"none" }}/>
              <div style={{ display:"flex", gap:4 }}>
                <button onClick={()=>{setAvatarNames(p=>({...p,[av.id]:nameInput||av.name}));setEditingName(null);}}
                  style={{ background:"#06d6a0", border:"none", borderRadius:4, color:"#000", fontSize:"0.65rem", padding:"2px 8px", cursor:"pointer", fontWeight:700 }}>✓</button>
                <button onClick={()=>setEditingName(null)}
                  style={{ background:"#ff6b6b", border:"none", borderRadius:4, color:"#fff", fontSize:"0.65rem", padding:"2px 8px", cursor:"pointer", fontWeight:700 }}>✗</button>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ fontSize:"0.72rem", fontWeight: selectedAvatar===av.id?700:400,
                color: selectedAvatar===av.id?"#e8eaf0":"#6b7099", textAlign:"center" }}>
                {avatarNames[av.id]}
              </div>
              <span onClick={e=>{e.stopPropagation();setEditingName(av.id);setNameInput(avatarNames[av.id]);}}
                style={{ cursor:"pointer", fontSize:"0.7rem", opacity:0.5, transition:"opacity 0.2s" }}
                onMouseEnter={e=>e.target.style.opacity=1} onMouseLeave={e=>e.target.style.opacity=0.5}>✏️</span>
            </div>
          )}
          <div style={{ fontSize:"0.6rem", color:"#6b7099", textAlign:"center" }}>{av.role}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ height:"100vh", maxHeight:"100vh", overflow:"hidden", background:"linear-gradient(135deg,#080a12 0%,#0d0f1c 100%)", fontFamily:"'Segoe UI',sans-serif", color:"#e8eaf0", display:"flex", flexDirection:"column" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        background:"radial-gradient(ellipse 70% 60% at 30% 20%,rgba(108,99,255,0.12) 0%,transparent 70%),radial-gradient(ellipse 60% 50% at 75% 80%,rgba(0,229,195,0.08) 0%,transparent 70%)" }}/>

      {/* Global mobile CSS */}
      <style>{`
        @media (max-width: 768px) {
          .main-grid { grid-template-columns: 1fr !important; overflow-y: auto !important; height: auto !important; }
          .left-col { min-height: 0 !important; }
          .avatar-panel { min-height: 240px !important; aspect-ratio: 16/10; }
          .avatar-circle { width: min(160px, 35vw) !important; height: min(160px, 35vw) !important; }
          .right-col { min-height: 0; }
          .transcript-box { height: 200px !important; min-height: 200px; }
          .header-toggles { gap: 6px !important; }
          .toggle-label { display: none; }
        }
        @media (max-width: 480px) {
          .avatar-panel { min-height: 200px !important; }
        }
      `}</style>

      {/* SETUP SCREEN */}
      {showSetup && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(5,7,14,0.97)", backdropFilter:"blur(12px)" }}>
          <div style={{ background:"#111422", border:"1px solid #242840", borderRadius:24, padding:"40px 36px",
            maxWidth:620, width:"90%", boxShadow:"0 24px 80px rgba(0,0,0,0.7)", textAlign:"center" }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"2.4rem", background:"linear-gradient(135deg,#fff 30%,#00e5c3)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:4 }}>
              Speak<em>Up</em>
            </div>
            <div style={{ color:"#6b7099", fontSize:"0.88rem", marginBottom:28 }}>
              Choose your English coach to get started
            </div>
            <AvatarPickerGrid/>
            <button onClick={startSession}
              style={{ marginTop:28, width:"100%", padding:"14px",
                background:"linear-gradient(135deg,#6c63ff,#9c97ff)",
                border:"none", borderRadius:12, color:"#fff", fontFamily:"inherit",
                fontSize:"1rem", fontWeight:700, cursor:"pointer",
                boxShadow:"0 4px 24px rgba(108,99,255,0.4)" }}>
              Start Practising with {avatarNames[selectedAvatar]} →
            </button>
          </div>
        </div>
      )}

      {/* CHANGE COACH MODAL */}
      {showAvatarPanel && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center",
          background:"rgba(5,7,14,0.85)", backdropFilter:"blur(8px)" }}
          onClick={()=>setShowAvatarPanel(false)}>
          <div style={{ background:"#111422", border:"1px solid #242840", borderRadius:20, padding:"28px",
            maxWidth:580, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:"0.8rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#6b7099" }}>
                Change Coach
              </div>
              <button onClick={()=>setShowAvatarPanel(false)}
                style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8,
                  color:"#6b7099", cursor:"pointer", padding:"4px 10px", fontSize:"1rem" }}>✕</button>
            </div>
            <AvatarPickerGrid/>
            <button onClick={()=>{ setShowAvatarPanel(false); setStarted(false); setMessages([]); setApiMessages([]); setFeedback([]); setPraise(""); setScores({grammar:null,vocab:null,fluency:null}); setTimeout(()=>startSession(),100); }}
              style={{ marginTop:20, width:"100%", padding:"12px",
                background:"linear-gradient(135deg,#6c63ff,#9c97ff)",
                border:"none", borderRadius:10, color:"#fff", fontFamily:"inherit",
                fontSize:"0.9rem", fontWeight:700, cursor:"pointer",
                boxShadow:"0 4px 20px rgba(108,99,255,0.4)" }}>
              Switch to {avatarNames[selectedAvatar]} →
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px 10px", borderBottom:"1px solid #1e2135", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontFamily:"Georgia,serif", fontSize:"1.7rem", background:"linear-gradient(135deg,#fff 30%,#00e5c3)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          Speak<em>Up</em>
        </div>
        <div className="header-toggles" style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {isSpeaking  && <div style={{ fontSize:"0.72rem", color:"#00e5c3", animation:"blinkA 1s infinite" }}>● SPEAKING</div>}
          {isRecording && <div style={{ fontSize:"0.72rem", color:"#ff6b6b", animation:"blinkA 0.7s infinite" }}>● LISTENING</div>}
          <style>{`@keyframes blinkA{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
          {/* Auto Send Toggle */}
          <div
            onClick={() => { setAutoSend(v => !v); cancelCountdown(); }}
            title="Auto Send: send immediately vs wait 3 seconds"
            style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
              background: autoSend ? "rgba(0,229,195,0.1)" : "rgba(108,99,255,0.08)",
              border: `1px solid ${autoSend ? "rgba(0,229,195,0.3)" : "rgba(108,99,255,0.2)"}`,
              borderRadius:20, padding:"5px 14px", transition:"all 0.25s", userSelect:"none" }}>
            <div style={{
              width:32, height:18, borderRadius:9, position:"relative", transition:"background 0.25s",
              background: autoSend ? "#00e5c3" : "#242840" }}>
              <div style={{
                position:"absolute", top:2, left: autoSend ? 16 : 2,
                width:14, height:14, borderRadius:"50%", background:"white",
                transition:"left 0.25s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
            </div>
            <span className="toggle-label" style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
              color: autoSend ? "#00e5c3" : "#6b7099", transition:"color 0.25s" }}>
              {autoSend ? "⚡ Auto" : "⏱ Wait"}
            </span>
          </div>

          {/* Correction Mode Toggle */}
          <div
            onClick={() => setCorrectionMode(v => !v)}
            title="Correction Mode: Avatar speaks corrections out loud before answering"
            style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
              background: correctionMode ? "rgba(255,209,102,0.12)" : "rgba(108,99,255,0.08)",
              border: `1px solid ${correctionMode ? "rgba(255,209,102,0.4)" : "rgba(108,99,255,0.2)"}`,
              borderRadius:20, padding:"5px 14px", transition:"all 0.25s", userSelect:"none" }}>
            <div style={{
              width:32, height:18, borderRadius:9, position:"relative", transition:"background 0.25s",
              background: correctionMode ? "#ffd166" : "#242840" }}>
              <div style={{
                position:"absolute", top:2, left: correctionMode ? 16 : 2,
                width:14, height:14, borderRadius:"50%", background:"white",
                transition:"left 0.25s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
            </div>
            <span className="toggle-label" style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
              color: correctionMode ? "#ffd166" : "#6b7099", transition:"color 0.25s" }}>
              {correctionMode ? "✏️ Fix" : "Fix"}
            </span>
          </div>
          <button onClick={()=>setShowAvatarPanel(true)}
            style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.05)",
              border:"1px solid #242840", borderRadius:20, padding:"5px 14px", cursor:"pointer",
              color:"#a5a0ff", fontSize:"0.68rem", fontWeight:600, fontFamily:"inherit",
              transition:"all 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(108,99,255,0.15)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}>
            <span style={{ fontSize:"1rem" }}>
              {selectedAvatar==="aria"?"👩": selectedAvatar==="james"?"👨🏿": selectedAvatar==="priya"?"👩🏽": selectedAvatar==="tom"?"👱":"👩🏻"}
            </span>
            {avatarNames[selectedAvatar]} ⇄
          </button>
          <div style={{ background:"rgba(108,99,255,0.15)", border:"1px solid rgba(108,99,255,0.3)", color:"#a5a0ff", fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", padding:"4px 12px", borderRadius:20 }}>
            AI English Coach
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="main-grid" style={{ position:"relative", zIndex:1, flex:1, display:"grid",
          gridTemplateColumns: typeof window !== "undefined" && window.innerWidth < 768 ? "1fr" : "1fr 340px",
          gap:16, padding:"16px 20px 0 20px", minHeight:0, overflow:"hidden" }}>

        {/* LEFT */}
        <div style={{ display:"grid", gridTemplateRows:"1fr auto", gap:12, minHeight:0, overflow:"hidden" }}>
          <div style={{ ...card, position:"relative", display:"flex", alignItems:"center", justifyContent:"center",
            background:"radial-gradient(ellipse at 50% 35%,#1c2040 0%,#090b16 100%)", overflow:"hidden", minHeight:0, flex:1 }}>

            {/* Grid bg */}
            <div style={{ position:"absolute", inset:0, opacity:0.04,
              backgroundImage:"linear-gradient(#6c63ff 1px,transparent 1px),linear-gradient(90deg,#6c63ff 1px,transparent 1px)",
              backgroundSize:"40px 40px" }}/>

            {/* Rings */}
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <SoundRings active={isSpeaking}/>
            </div>

            {/* Avatar circle */}
            <div className="avatar-circle" style={{ position:"relative", zIndex:2,
              width:"min(260px, 28vh)", height:"min(260px, 28vh)", borderRadius:"50%",
              background: AVATARS.find(a=>a.id===selectedAvatar)?.bg || "linear-gradient(145deg,#2a2d50,#1a1d38)",
              border: isSpeaking ? `3px solid ${AVATARS.find(a=>a.id===selectedAvatar)?.border || "#00e5c3"}cc` : `3px solid ${AVATARS.find(a=>a.id===selectedAvatar)?.border || "#6c63ff"}80`,
              boxShadow: isSpeaking
                ? `0 0 70px ${AVATARS.find(a=>a.id===selectedAvatar)?.border || "#00e5c3"}60,inset 0 0 50px rgba(0,0,0,0.5)`
                : `0 0 50px ${AVATARS.find(a=>a.id===selectedAvatar)?.border || "#6c63ff"}40,inset 0 0 50px rgba(0,0,0,0.5)`,
              transition:"border-color 0.3s,box-shadow 0.3s",
              display:"flex", alignItems:"center", justifyContent:"center",
              overflow:"hidden", padding:10 }}>
              <AvatarFace isSpeaking={isSpeaking} mouthIdx={mouthIdx} avatarId={selectedAvatar}/>
            </div>

            {/* Waveform */}
            <div style={{ position:"absolute", bottom:"6%", left:"50%", transform:"translateX(-50%)" }}>
              <WaveForm active={isSpeaking}/>
            </div>

            {/* Subtitle */}
            {subtitle && (
              <div style={{ position:"absolute", bottom:0, left:8, right:8,
                background:"rgba(8,10,18,0.88)", backdropFilter:"blur(10px)",
                borderRadius:10, padding:"9px 16px", fontSize:"0.84rem",
                textAlign:"center", border:"1px solid rgba(255,255,255,0.06)",
                lineHeight:1.45, color:"#e8eaf0" }}>
                "{subtitle}"
              </div>
            )}

            {/* Name tag */}
            <div style={{ position:"absolute", top:14, left:14,
              background:"rgba(8,10,18,0.75)", border:"1px solid #1e2135",
              borderRadius:8, padding:"6px 12px", fontSize:"0.74rem",
              backdropFilter:"blur(8px)", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:"#06d6a0", display:"inline-block", animation:"blinkA 1.5s infinite" }}/>
              {avatarNames[selectedAvatar]} · {AVATARS.find(a=>a.id===selectedAvatar)?.role || 'English Coach'}
            </div>

            {/* Status */}
            <div style={{ position:"absolute", top:14, right:14,
              background: isSpeaking ? "rgba(0,229,195,0.1)" : "rgba(108,99,255,0.1)",
              border:`1px solid ${isSpeaking?"rgba(0,229,195,0.3)":"rgba(108,99,255,0.2)"}`,
              borderRadius:8, padding:"5px 10px", fontSize:"0.7rem",
              color: isSpeaking ? "#00e5c3" : "#a5a0ff", backdropFilter:"blur(8px)" }}>
              {isLoading ? "⏳ Thinking…" : isSpeaking ? "🔊 Speaking" : "💬 Ready"}
            </div>

            {/* Correction mode badge on avatar */}
            {correctionMode && (
              <div style={{ position:"absolute", bottom:56, right:12,
                background:"rgba(255,209,102,0.15)", border:"1px solid rgba(255,209,102,0.4)",
                borderRadius:8, padding:"4px 10px", fontSize:"0.68rem",
                color:"#ffd166", backdropFilter:"blur(8px)", fontWeight:600,
                animation:"blinkA 2s infinite" }}>
                ✏️ Correction Mode ON
              </div>
            )}
          </div>

          {/* Scores */}
          <div style={{ ...card, padding:14, flexShrink:0 }}>
            <div style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#6b7099", marginBottom:10 }}>Session Score</div>
            <div style={{ display:"flex", gap:10 }}>
              <ScorePill label="Grammar"    value={scores.grammar}/>
              <ScorePill label="Vocabulary" value={scores.vocab}/>
              <ScorePill label="Fluency"    value={scores.fluency}/>
            </div>
          </div>

        </div>

        {/* RIGHT */}
        <div style={{ display:"grid", gridTemplateRows:"1fr auto", gap:12, minHeight:0, overflow:"hidden" }}>
          <div style={{ ...card, padding:14, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
            <div style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#6b7099", marginBottom:10 }}>Conversation</div>
            <div className="transcript-box" ref={transcriptRef} style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, scrollbarWidth:"thin", scrollbarColor:"#242840 transparent" }}>
              {messages.length===0 && <div style={{ color:"#6b7099", fontSize:"0.8rem", textAlign:"center", padding:"20px 0", fontStyle:"italic" }}>Your conversation will appear here…</div>}
              {messages.map((m,i) => (
                <div key={i} style={{ display:"flex", gap:8, animation:"fadeUp 0.3s ease",
                  flexDirection: m.role==="translation" ? "column" : "row" }}>
                  <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>

                  {/* Hindi Translation banner */}
                  {m.role==="translation" ? (
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8,
                      background:"rgba(255,209,102,0.08)", border:"1px solid rgba(255,209,102,0.25)",
                      borderRadius:10, padding:"8px 12px" }}>
                      <span style={{ fontSize:"1rem", flexShrink:0 }}>🇮🇳</span>
                      <div>
                        <div style={{ fontSize:"0.62rem", color:"#ffd166", fontWeight:700,
                          textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>
                          Hindi → English Translation
                        </div>
                        <div style={{ fontSize:"0.8rem", color:"#e8eaf0", lineHeight:1.4 }}>{m.text}</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"0.68rem", fontWeight:700,
                        background: m.role==="coach" ? "linear-gradient(135deg,#6c63ff,#9c97ff)" : "linear-gradient(135deg,#1e2840,#2a3a50)",
                        border: m.role==="student" ? "1px solid #2a3a50" : "none" }}>
                        {m.role==="coach" ? "AI" : "Me"}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:"0.65rem", color:"#6b7099", marginBottom:2 }}>{m.role==="coach" ? avatarNames[selectedAvatar] : "You"}</div>
                        <div style={{ fontSize:"0.8rem", lineHeight:1.55, padding:"8px 10px",
                          borderRadius: m.role==="coach" ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                          background: m.role==="coach" ? "#111422" : "rgba(108,99,255,0.1)",
                          border: m.role==="student" ? "1px solid rgba(108,99,255,0.15)" : "none" }}>
                          {m.text}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {isLoading && (
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#6c63ff,#9c97ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.68rem", fontWeight:700 }}>AI</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.65rem", color:"#6b7099", marginBottom:2 }}>{avatarNames[selectedAvatar]}</div>
                    <div style={{ display:"flex", gap:4, padding:"10px", background:"#111422", borderRadius:"4px 12px 12px 12px", width:"fit-content" }}>
                      {[0,1,2].map(j=><div key={j} style={{ width:6, height:6, borderRadius:"50%", background:"#6b7099", animation:`dotB 1s ${j*0.15}s infinite` }}/>)}
                      <style>{`@keyframes dotB{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ ...card, padding:14, flexShrink:0 }}>
            <div style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#6b7099", marginBottom:10 }}>Live Feedback</div>
            {feedback.length===0 && !praise
              ? <div style={{ color:"#6b7099", fontSize:"0.78rem", fontStyle:"italic" }}>Speak and get instant corrections!</div>
              : <>
                  {praise && (
                    <div style={{ display:"flex", gap:8, padding:"7px 10px", borderRadius:8, background:"rgba(6,214,160,0.08)", borderLeft:"3px solid #06d6a0", marginBottom:7, fontSize:"0.78rem", animation:"fadeUp 0.3s ease" }}>
                      <span style={{ color:"#06d6a0" }}>✓</span>
                      <span style={{ color:"#e8eaf0" }}>{praise}</span>
                    </div>
                  )}
                  {feedback.map((f,i) => (
                    <div key={i} style={{ display:"flex", gap:8, padding:"7px 10px", borderRadius:8, marginBottom:6,
                      background:"rgba(255,107,107,0.08)", borderLeft:"3px solid #ff6b6b", fontSize:"0.78rem", lineHeight:1.5, animation:"fadeUp 0.3s ease" }}>
                      <span style={{ color:"#ff6b6b", flexShrink:0 }}>✗</span>
                      <span>
                        <span style={{ color:"#ff9999", textDecoration:"line-through" }}>{f.wrong}</span>
                        <span style={{ color:"#6b7099" }}> → </span>
                        <span style={{ color:"#06d6a0", fontWeight:600 }}>{f.correct}</span>
                        {f.explanation && <div style={{ color:"#6b7099", fontSize:"0.72rem", marginTop:2 }}>{f.explanation}</div>}
                      </span>
                    </div>
                  ))}
                </>
            }
          </div>
        </div>
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{ position:"relative", zIndex:1, background:"rgba(108,99,255,0.08)",
          borderTop:"1px solid rgba(108,99,255,0.2)", padding:"10px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Countdown circle */}
            <div style={{ position:"relative", width:40, height:40, flexShrink:0 }}>
              <svg width="40" height="40" style={{ transform:"rotate(-90deg)" }}>
                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
                <circle cx="20" cy="20" r="16" fill="none" stroke="#6c63ff" strokeWidth="3"
                  strokeDasharray={`${(countdown/3)*100} 100`}
                  strokeLinecap="round"/>
              </svg>
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:"1rem", fontWeight:800, color:"#a5a0ff" }}>
                {countdown}
              </div>
            </div>
            <div>
              <div style={{ fontSize:"0.75rem", fontWeight:600, color:"#e8eaf0" }}>Sending in {countdown}s...</div>
              <div style={{ fontSize:"0.68rem", color:"#6b7099", marginTop:1, maxWidth:200,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                "{pendingText}"
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={cancelCountdown}
              style={{ background:"rgba(255,107,107,0.15)", border:"1px solid rgba(255,107,107,0.3)",
                color:"#ff6b6b", borderRadius:20, padding:"6px 14px", cursor:"pointer",
                fontFamily:"inherit", fontSize:"0.75rem", fontWeight:700 }}>
              ✕ Cancel
            </button>
            <button onClick={sendNow}
              style={{ background:"linear-gradient(135deg,#6c63ff,#9c97ff)", border:"none",
                color:"#fff", borderRadius:20, padding:"6px 14px", cursor:"pointer",
                fontFamily:"inherit", fontSize:"0.75rem", fontWeight:700 }}>
              ➤ Send Now
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center", gap:12, padding:"12px 20px 18px", borderTop:"1px solid #1e2135" }}>
        <button onClick={toggleMic} disabled={isLoading||isSpeaking}
          style={{ width:54, height:54, borderRadius:"50%", border:"none",
            cursor: isLoading||isSpeaking ? "not-allowed" : "pointer",
            flexShrink:0, fontSize:"1.4rem", transition:"all 0.2s",
            background: isRecording ? "linear-gradient(135deg,#ff6b6b,#ff9999)" : "linear-gradient(135deg,#6c63ff,#9c97ff)",
            boxShadow: isRecording ? "0 4px 24px rgba(255,107,107,0.5)" : "0 4px 24px rgba(108,99,255,0.4)",
            animation: isRecording ? "micPulse 0.8s ease-in-out infinite" : "none",
            opacity: isLoading||isSpeaking ? 0.4 : 1 }}>
          {isRecording ? "⏹" : "🎤"}
          <style>{`@keyframes micPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}`}</style>
        </button>
        <div style={{ flex:1, position:"relative" }}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit(input)}
            placeholder={isRecording ? "🎤 Listening…" : "Or type your English here and press Enter…"}
            disabled={isLoading||isSpeaking}
            style={{ width:"100%", background:"#161929", border:"1px solid #242840", borderRadius:28,
              padding:"14px 52px 14px 20px", color:"#e8eaf0", fontFamily:"inherit", fontSize:"0.88rem", outline:"none" }}/>
          <button onClick={()=>handleSubmit(input)} disabled={isLoading||isSpeaking||!input.trim()}
            style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
              width:36, height:36, borderRadius:"50%", border:"none",
              background: input.trim() ? "#6c63ff" : "#242840",
              color:"#fff", cursor: input.trim() ? "pointer" : "not-allowed", fontSize:"1rem", transition:"background 0.2s" }}>
            ➤
          </button>
        </div>
      </div>
      {/* Hindi tip */}
      <div style={{ textAlign:"center", fontSize:"0.68rem", color:"#6b7099", paddingBottom:6 }}>
        🇮🇳 Hindi supported — type in Hindi and the coach will translate it to English for you
      </div>
    </div>
  );
}
