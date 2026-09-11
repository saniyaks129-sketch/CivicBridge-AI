const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(express.json({ limit: "15mb" }));

app.use(express.static(path.join(__dirname, "public")));


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


const MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
];


const schema = {
    type: "object",
    properties: {

        intent: {
            type: "string"
        },

        summary: {
            type: "string"
        },

        priority: {
            type: "string"
        },

        facts: {
            type: "array",
            items: {
                type: "string"
            }
        },

        missing_information: {
            type: "array",
            items: {
                type: "string"
            }
        },

        actions: {
            type: "array",
            items: {
                type: "string"
            }
        },

        checklist: {
            type: "array",
            items: {
                type: "string"
            }
        },

        verification_needed: {
            type: "array",
            items: {
                type: "string"
            }
        },

        warning: {
            type: "string"
        }

    },

    required: [
        "intent",
        "summary",
        "priority",
        "facts",
        "missing_information",
        "actions",
        "checklist",
        "verification_needed",
        "warning"
    ]
};


function buildPrompt(userText) {

    return `
You are CivicBridge AI.

CivicBridge is NOT a generic chatbot.

It is a UNIVERSAL ACTION NAVIGATOR that converts messy human intent
into structured, prioritized and verifiable next steps.

The user may describe a scholarship, government notice,
travel problem, appointment, bill, service issue, administrative problem,
or another real-world situation.

Your job:

1. Understand what the person is actually trying to accomplish.
2. Separate confirmed facts from assumptions.
3. Identify missing information.
4. Assign urgency.
5. Give practical next actions in the correct order.
6. Create a simple checklist.
7. Clearly identify information that must be verified.
8. Never invent names, dates, deadlines, laws, policies or numbers.
9. Never pretend to have contacted an organization.
10. For medical, legal, financial or emergency matters,
    recommend appropriate official/professional help.
11. Keep the language simple enough for a normal person.

PRIORITY:
LOW = no immediate concern
MEDIUM = should be handled soon
HIGH = important deadline/risk
URGENT = immediate safety or serious time-sensitive issue

IMPORTANT:
Facts must come ONLY from the user's input or uploaded document.
Interpretation belongs in summary/actions.
Unknown details belong in missing_information.
Anything uncertain belongs in verification_needed.

USER SITUATION:

${userText || "The user uploaded a document. Analyze the document carefully."}

Return ONLY JSON matching the requested schema.
`;
}


app.post("/api/analyze", async (req, res) => {

    try {

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {

            return res.status(500).json({
                error: "GEMINI_API_KEY is missing in .env"
            });
        }


        const userText = req.body.text || "";
        const file = req.body.file || null;


        if (!userText && !file) {

            return res.status(400).json({
                error: "Please enter a situation or upload a document."
            });
        }


        const parts = [];


        parts.push({
            text: buildPrompt(userText)
        });


        if (file && file.data) {

            parts.push({
                inline_data: {
                    mime_type: file.mimeType,
                    data: file.data
                }
            });

        }


        let lastError = null;


        for (const model of MODELS) {

            try {

                console.log("Trying Gemini model:", model);


                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": apiKey
                        },

                        body: JSON.stringify({

                            contents: [
                                {
                                    role: "user",
                                    parts: parts
                                }
                            ],

                            generationConfig: {

                                responseMimeType: "application/json",

                                responseSchema: schema,

                                temperature: 0.2
                            }

                        })
                    }
                );


                const body = await response.json();


                if (!response.ok) {

                    lastError = body?.error?.message || `Gemini HTTP ${response.status}`;

                    console.log(model, "failed:", lastError);

                    continue;
                }


                const text =
                    body?.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || "")
                        .join("");


                if (!text) {

                    lastError = "Gemini returned an empty response.";

                    continue;
                }


                const result = JSON.parse(text);


                console.log("SUCCESS:", model);


                return res.json(result);

            } catch (error) {

                lastError = error.message;

                console.log(model, "error:", error.message);
            }
        }


        return res.status(503).json({

            error:
                "Gemini is temporarily unavailable. Please try again. " +
                (lastError || "")

        });


    } catch (error) {

        console.error("SERVER ERROR:", error);

        res.status(500).json({
            error: "Server error. Check the terminal."
        });
    }

});


const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log("   CIVICBRIDGE AI IS RUNNING");
    console.log("   http://localhost:" + PORT);
    console.log("=================================");
    console.log("");

});