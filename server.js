import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);
const host = "127.0.0.1";

const planSchema = {
  name: "knee_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
      },
      todays_focus: {
        type: "string",
      },
      daily_angle_goal: {
        type: "string",
      },
      recommended_activities: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
      recovery_summary: {
        type: "string",
      },
      caution_note: {
        type: "string",
      },
    },
    required: [
      "summary",
      "todays_focus",
      "daily_angle_goal",
      "recommended_activities",
      "recovery_summary",
      "caution_note",
    ],
  },
};

const sleeveSchema = {
  name: "sleeve_risk_read",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      angle_degrees: {
        type: "integer",
        minimum: 0,
        maximum: 140,
      },
      angle_note: {
        type: "string",
      },
      movement_score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
      },
      movement_note: {
        type: "string",
      },
      risk_level: {
        type: "string",
        enum: ["low", "moderate", "high"],
      },
      risk_note: {
        type: "string",
      },
      feedback: {
        type: "string",
      },
    },
    required: [
      "angle_degrees",
      "angle_note",
      "movement_score",
      "movement_note",
      "risk_level",
      "risk_note",
      "feedback",
    ],
  },
};

function parseDotEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    values[key] = value;
  }
  return values;
}

async function loadEnvFile() {
  try {
    const envText = await readFile(path.join(__dirname, ".env"), "utf8");
    const parsed = parseDotEnv(envText);
    Object.entries(parsed).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // Ignore missing .env files and use process env only.
  }
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  const firstMessage = Array.isArray(data.output) ? data.output[0] : null;
  const firstContent = firstMessage?.content?.find((item) => item.type === "output_text");
  if (typeof firstContent?.text === "string" && firstContent.text.length > 0) {
    return firstContent.text;
  }

  return null;
}

function mapOpenAiErrorMessage(statusCode, errorText) {
  if (errorText.includes("insufficient_quota")) {
    return {
      statusCode,
      error:
        "AI is connected, but this OpenAI account needs API credits or billing enabled before plans can be generated.",
    };
  }

  if (errorText.includes("invalid_api_key")) {
    return {
      statusCode,
      error: "The OpenAI API key is invalid. Replace it in your local .env file and try again.",
    };
  }

  return {
    statusCode,
    error: "The AI service could not generate a plan right now. Please try again in a moment.",
  };
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };
  return types[ext] || "application/octet-stream";
}

async function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/KneedThat.html" : req.url;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, safePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(file);
  } catch {
    json(res, 404, { error: "File not found." });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleAiPlan(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(res, 500, {
        error: "Missing OPENAI_API_KEY. Add it to a local .env file or your server environment.",
      });
    }

    const rawBody = await readBody(req);
    const body = JSON.parse(rawBody || "{}");
    const {
      postOpWeek,
      postOpDay,
      painLevel,
      sorenessLevel,
      swellingToday,
      confidenceLevel,
      goal,
    } = body;

    if (
      typeof postOpWeek !== "number" ||
      typeof postOpDay !== "number" ||
      typeof painLevel !== "number" ||
      typeof sorenessLevel !== "number" ||
      typeof swellingToday !== "boolean" ||
      typeof confidenceLevel !== "number" ||
      typeof goal !== "string"
    ) {
      return json(res, 400, {
        error: "Invalid input payload for AI plan generation.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a supportive ACL recovery companion for a post-op ACL patient recovering at home. Do not diagnose, do not claim certainty, and do not replace a clinician. Build concise, practical guidance that feels medically adjacent, supportive, and easy to scan on a mobile screen.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `App inputs:
- Post-op week: ${postOpWeek}
- Post-op day: ${postOpDay}
- Pain level: ${painLevel}/10
- Soreness level: ${sorenessLevel}/10
- Swelling today: ${swellingToday ? "yes" : "no"}
- Confidence moving: ${confidenceLevel}/10
- Goal: ${goal}

Rules:
- Use only the provided inputs.
- Keep responses supportive, cautious, and low risk.
- Do not diagnose.
- Focus on recovery habits, controlled movement, mobility, and simple activation.
- Use these bend milestones:
  Week 1: 90 degrees for this demo
  Week 2: 90-100 degrees
  Week 3: 100-110 degrees
  Weeks 4-6: 120-135+ degrees
- Make the plan specific to the exact post-op week and post-op day provided.
- The recommendations should change across weeks as recovery progresses.
- daily_angle_goal should be concise and suitable for a mobile card.
- If confidence is low, lower movement intensity and simplify the session.
- If pain or soreness is high, favor lighter rehab habits and recovery.
- If swelling is present, recommend a calmer day and lighter loading.
- Return these keys only:
  summary
  todays_focus
  daily_angle_goal
  recommended_activities
  recovery_summary
  caution_note
- summary must be 1 short sentence under 20 words.
- todays_focus must be 1 short sentence under 10 words.
- daily_angle_goal must be 1 short sentence under 12 words.
- recommended_activities must contain exactly 3 believable rehab activities for that specific stage.
- Week 1 activities should sound like heel slides, quad sets, assisted knee bends, gentle mobility work.
- Later weeks can sound slightly more progressive, but still recovery-focused and believable.
- recovery_summary must be 1 short sentence under 18 words.
- caution_note must be 1 short sentence under 16 words.
- Avoid long explanations, stacked clauses, and medical language.
- Return concise JSON only with the requested keys.`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            ...planSchema,
          },
        },
        max_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const mapped = mapOpenAiErrorMessage(response.status, errorText);
      return json(res, mapped.statusCode, {
        error: mapped.error,
      });
    }

    const data = await response.json();
    const outputText = extractResponseText(data);

    if (!outputText) {
      return json(res, 500, {
        error: "The AI service returned an unexpected response format.",
      });
    }

    return json(res, 200, JSON.parse(outputText));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate plan.";
    return json(res, 500, { error: message });
  }
}

async function handleSleeveRisk(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(res, 500, {
        error: "Missing OPENAI_API_KEY. Add it to a local .env file or your server environment.",
      });
    }

    const rawBody = await readBody(req);
    const body = JSON.parse(rawBody || "{}");
    const angle = body?.angle;

    if (typeof angle !== "number" || Number.isNaN(angle) || angle < 0 || angle > 140) {
      return json(res, 400, {
        error: "Invalid sleeve angle. Use a number between 0 and 140.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You are a cautious knee recovery assistant reading a live brace angle. Do not diagnose. Interpret the angle conservatively for a recovering knee and return short mobile-friendly JSON only.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Sleeve input:
- Knee angle: ${angle} degrees

Return JSON only with the requested keys.

Rules:
- Use the angle input only.
- Assume the user is in week 1 recovery and wants low-risk guidance.
- angle_note must be 1 short phrase.
- movement_note must be 1 short phrase.
- risk_note must be 1 short phrase.
- feedback must be 1 short sentence under 18 words.
- movement_score should be a cautious 0-100 estimate of how demanding this angle is for a recovering knee.
- risk_level should be low, moderate, or high.
- Do not diagnose or claim certainty.`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            ...sleeveSchema,
          },
        },
        max_output_tokens: 250,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const mapped = mapOpenAiErrorMessage(response.status, errorText);
      return json(res, mapped.statusCode, {
        error: mapped.error,
      });
    }

    const data = await response.json();
    const outputText = extractResponseText(data);

    if (!outputText) {
      return json(res, 500, {
        error: "The AI service returned an unexpected response format.",
      });
    }

    return json(res, 200, JSON.parse(outputText));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to interpret sleeve data.";
    return json(res, 500, { error: message });
  }
}

await loadEnvFile();

const server = createServer(async (req, res) => {
  if (!req.url) {
    return json(res, 400, { error: "Missing request URL." });
  }

  if (req.method === "POST" && req.url === "/api/ai-plan") {
    return handleAiPlan(req, res);
  }

  if (req.method === "POST" && req.url === "/api/sleeve-risk") {
    return handleSleeveRisk(req, res);
  }

  if (req.method === "GET") {
    return serveStatic(req, res);
  }

  return json(res, 405, { error: "Method not allowed." });
});

server.listen(port, host, () => {
  console.log(`KneedThat app running at http://${host}:${port}`);
});
