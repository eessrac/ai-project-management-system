const OpenAI = require("openai");

/**
 * Bu servis, yapay zekâ servisleriyle iletişimi yönetir.
 * Öncelikli olarak Gemini modelini kullanır, hata durumunda ise
 * Qwen modeline geçerek yapay zekâ yanıtlarının üretilmesini sağlar.
 */

const gemini = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: process.env.GEMINI_BASE_URL,
  timeout: 30000,
});

const qwen = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: process.env.QWEN_BASE_URL,
  timeout: 30000,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTemporaryAiError(err) {
  const msg = String(err?.message || "").toLowerCase();
  const code = err?.cause?.code || err?.code;
  const status = err?.status;

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    code === "EAI_AGAIN" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection error") ||
    msg.includes("fetch failed")
  );
}

async function askGeminiWithRetry({ systemPrompt, userPrompt, maxTokens }) {
  let lastErr;

  for (let attempt = 1; attempt <= 2; attempt++) { // 3 yerine 2
    try {
      console.log(`AI: Gemini deneme ${attempt}/2`);

      const response = await gemini.chat.completions.create({
        model: process.env.GEMINI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: maxTokens,
      });

      return response.choices?.[0]?.message?.content || "";
    } catch (err) {
      lastErr = err;

      const temporary = isTemporaryAiError(err);

      console.error(
        `Gemini deneme ${attempt}/2 başarısız:`,
        err?.cause?.code || err?.code || err?.status || err?.message
      );

      // 2. denemede de başarısız olursa direkt askAI catch bloğuna düşecek
      if (!temporary || attempt === 2) {
        throw err;
      }

      await sleep(1500 * attempt);
    }
  }

  throw lastErr;
}

async function askQwen({ systemPrompt, userPrompt, maxTokens }) {
  console.log("AI: Qwen");

  const response = await qwen.chat.completions.create({
    model: process.env.QWEN_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
  });

  return response.choices?.[0]?.message?.content || "";
}

async function askAI({ systemPrompt, userPrompt, maxTokens = 450 }) {
  try {
    return await askGeminiWithRetry({
      systemPrompt,
      userPrompt,
      maxTokens,
    });
  } catch (err) {
    if (!isTemporaryAiError(err)) {
      throw err;
    }

    console.error("GEMINI ERROR:", err?.cause?.code || err?.code || err?.status || err?.message);
    console.log("Gemini başarısız → Qwen'e geçiliyor");

    return await askQwen({
      systemPrompt,
      userPrompt,
      maxTokens,
    });
  }
}

module.exports = { askAI };