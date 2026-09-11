const examples = {
    scholarship:
        "I received a scholarship message but I don't understand what I need to do next.",

    notice:
        "I received an official notice saying I need to submit some documents, but I don't understand which documents or the deadline.",

    travel:
        "My bus was cancelled and I have an important interview tomorrow morning. I don't know what I should do.",

    appointment:
        "I received an appointment message but I am confused about the date, documents required and what I need to do before going."
};


function useExample(type) {

    const input = document.getElementById("userInput");

    input.value = examples[type] || "";

    input.focus();

    analyzeProblem();
}


function showFileName() {

    const input = document.getElementById("fileInput");
    const name = document.getElementById("fileName");

    if (input.files.length > 0) {
        name.textContent = "📎 " + input.files[0].name;
    } else {
        name.textContent = "No document selected";
    }
}


function readFile(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => {

            resolve({
                name: file.name,
                mimeType: file.type,
                data: reader.result.split(",")[1]
            });

        };

        reader.onerror = () => {
            reject(new Error("Could not read the uploaded file."));
        };

        reader.readAsDataURL(file);
    });
}


async function analyzeProblem() {

    const input = document.getElementById("userInput");
    const fileInput = document.getElementById("fileInput");
    const result = document.getElementById("result");

    const text = input.value.trim();

    const file =
        fileInput && fileInput.files.length
            ? fileInput.files[0]
            : null;


    if (!text && !file) {

        alert("Please tell us what happened or upload a document.");

        return;
    }


    result.innerHTML = `
        <div class="empty-result">
            <div class="compass">🧠</div>
            <h2>CivicBridge is thinking...</h2>
            <p>Understanding your situation and building a practical action plan.</p>
        </div>
    `;


    try {

        let uploadedFile = null;

        if (file) {

            if (file.size > 8 * 1024 * 1024) {
                throw new Error("Please upload a file smaller than 8 MB.");
            }

            uploadedFile = await readFile(file);
        }


        const response = await fetch("/api/analyze", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                text: text,
                file: uploadedFile
            })

        });


        const data = await response.json();


        if (!response.ok) {
            throw new Error(data.error || "Unable to analyze the situation.");
        }


        displayResult(data);


    } catch (error) {

        console.error(error);

        result.innerHTML = `
            <div class="empty-result">
                <div class="compass">⚠️</div>
                <h2>We couldn't complete that</h2>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}


function escapeHtml(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function displayResult(data) {

    const result = document.getElementById("result");


    const facts = (data.facts || [])
        .map(x => `<li>🟢 ${escapeHtml(x)}</li>`)
        .join("");


    const missing = (data.missing_information || [])
        .map(x => `<li>❓ ${escapeHtml(x)}</li>`)
        .join("");


    const actions = (data.actions || [])
        .map(x => `<li>✅ ${escapeHtml(x)}</li>`)
        .join("");


    const checklist = (data.checklist || [])
        .map(x => `<li>☑️ ${escapeHtml(x)}</li>`)
        .join("");


    const verification = (data.verification_needed || [])
        .map(x => `<li>🔴 ${escapeHtml(x)}</li>`)
        .join("");


    result.innerHTML = `

        <div class="result-content">

            <h2>🧭 Your CivicBridge Action Plan</h2>

            <div class="priority">
                ${escapeHtml(data.priority || "MEDIUM")} PRIORITY
            </div>


            <h3>🎯 What I understood</h3>

            <p>
                ${escapeHtml(data.summary || "")}
            </p>


            <h3>📌 Important facts</h3>

            <ul>
                ${facts || "<li>No confirmed facts found.</li>"}
            </ul>


            <h3>❓ Missing information</h3>

            <ul>
                ${missing || "<li>No major missing information identified.</li>"}
            </ul>


            <h3>⚡ Next actions</h3>

            <ul>
                ${actions || "<li>No actions generated.</li>"}
            </ul>


            <h3>📋 Checklist</h3>

            <ul>
                ${checklist || "<li>No checklist required.</li>"}
            </ul>


            <h3>🔍 What needs verification</h3>

            <ul>
                ${verification || "<li>Nothing specific identified — still verify important details with the official source.</li>"}
            </ul>


            ${
                data.warning
                    ? `
                        <div class="warning">
                            ⚠️ ${escapeHtml(data.warning)}
                        </div>
                    `
                    : ""
            }

        </div>
    `;
}