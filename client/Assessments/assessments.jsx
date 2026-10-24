/*API for Q1 + Q2: */ 
const questions = [
    {
        id: "startingLocation",
        questions: "Where are you starting from?",
        type: "text",
        answers: [
            { text: "Text entry" }
        ]
    },
    {
        id: "preferredCountries",
        questions: "What is one country you would like to visit: ",
        type: "text",
        answers: [
            { text: "Countries (or any)" }
        ]
    },
    {
        id: "preferredMonths",
        questions: "What months would you perfer traveling in? ",
        type: "select",
        answers: [
            { text: "Months (or any)" }
        ]
    },
    {
        id: "tripDuration",
        questions: "How many nights would you like this trip to last?",
        answers: [
            { text: "1 - 3 nights (Weekend Getaway)" },
            { text: "4 - 6 nights (Short Trip)" },
            { text: "7 - 9 nights (One Week)" },
            { text: "10 - 14 nights (Extended Stay)" },
            { text: "15+ nights (Long Vacation)" }
        ]
    },
    {
        id: "preferredWeather",
        questions: "What kind of weather do you prefer?",
        answers: [
            { text: "Warm" },
            { text: "Cool" },
            { text: "Chilly but not too cold" },
            { text: "Sunny" },
            { text: "Overcast" },
            { text: "Rainy" }
        ]
    },
    {
        id: "visaWillingness",
        questions: "Are you willing to get a visa for traveling?",
        answers: [
            { text: "Yes" },
            { text: "No" },
            { text: "Maybe. Not too sure."}
        ]
    },
    {
        id: "highRiskDestWillingness",
        questions: "How willing are you to go to high risk travel destinations?",
        answers: [
            { text: "Yes" },
            { text: "No" },
            { text: "Maybe. Not too sure."}
        ]
    },
    {
        id: "preferredAccomodation",
        questions: "What kind of accommodation would you find yourself in?",
        answers: [
            { text: "All inclusive resort" },
            { text: "5 star hotel" },
            { text: "3 star chain hotel" },
            { text: "Local rental" },
            { text: "Local boutique hotel" },
            { text: "Cabin in the woods" }
        ]
    },
    {
        id: "travelAlterEgo",
        questions: "What is your travel alter ego?",
        answers: [
            { text: "The Explorer" },
            { text: "The Historian" },
            { text: "The Foodie" },
            { text: "The Spa Lover" }
        ]
    },
    {
        id: "preferredViews",
        questions: "Which view would make you stop and take a picture?",
        answers: [
            { text: "Sunset by the beach" },
            { text: "City skyline at night" },
            { text: "Mountains above the clouds" }
        ]
    },
    {
        id: "photosToPost",
        questions: "What kind of trip pics would you post after you get back home?",
        answers: [
            { text: "Cool historical/cultural stuff" },
            { text: "Food" },
            { text: "The streets" },
            { text: "Good natural scenery/cityscapes" }
        ]
    },
    {
        id: "seeAllOrDeeply",
        questions: "Would you rather... See it all or see it deeply?",
        answers: [
            { text: "See it all" },
            { text: "See it deeply" }
        ]
    },
    {
        id: "sleepInOrEarly",
        questions: "Would you rather... Enjoy the nightlife and sleep in or sleep early but catch the sunrise?",
        type: "image-choice",
        answers: [
        { 
            text: "Enjoy the nightlife and sleep in", 
            image: "sydney.jpg", 
            caption: "Sydney Opera House" 
        },
        { 
            text: "Sleep early but catch the sunrise", 
            image: "barossa.jpg", 
            caption: "Barossa Valley" 
        }
    ]
    },
    {
        id: "visitFamousLocationOrHiddenGem",
        questions: "Would you rather... Visit a famous location or discover a hidden gem",
        type: "image-choice",
        answers: [
        { 
            text: "Visit a famous location", 
            image: "rome.jpg", 
            caption: "Rome, Italy" 
        },
        { 
            text: "Discover a hidden gem", 
            image: "Matera.jpg", 
            caption: "Matera, Italy" 
        }
    ]
    },
    {
        id: "enjoyCrowdsOrSpace",
        questions: "Would you rather... Enjoy the bustle of the locals, or enjoy space to yourself?",
        type: "image-choice",
        answers: [
        { 
            text: "Enjoy the bustle of the locals", 
            image: "Shibuya.jpg", 
            caption: "Shibuya Scramble Crossing" 
        },
        { 
            text: "Enjoy space to yourself" , 
            image: "Nachi.jpg", 
            caption: "Nachi Waterfall" 
        }
    ]
    },
    {
        id: "walkAmount",
        questions: "How much walking around would you like to do?",
        answers: [
            { text: "None" },
            { text: "A bit" },
            { text: "A lot" }
        ]
    },
    {
        id: "peopleOnTrip",
        questions: "How many people will be on this trip?",
        answers: [
            { text: "1" },
            { text: "2" },
            { text: "3-5" },
            { text: "6-9" },
            { text: "+10" }
        ]
    },
    {
        id: "budgetLevel",
        questions: "What is your budget per person, per day for food and activities?",
        answers: [
            { text: "$" },
            { text: "$$" }, { text: "$$$" }
        ]
    },
    {
        id: "dietaryRestrictions",
        questions: "Do you have any dietary restrictions?",
        type: "multiselect",
        answers: [
            { text: "Vegetarian" },
            { text: "Vegan" },
            { text: "Halal" },
            { text: "Kosher" },
            { text: "None / No restrictions" }
        ]
    }
];

const countryCodeLookup = {
    "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "andorra": "AD", "angola": "AO",
    "argentina": "AR", "armenia": "AM", "australia": "AU", "austria": "AT", "azerbaijan": "AZ",
    "bahamas": "BS", "bahrain": "BH", "bangladesh": "BD", "barbados": "BB", "belarus": "BY",
    "belgium": "BE", "belize": "BZ", "benin": "BJ", "bhutan": "BT", "bolivia": "BO",
    "brazil": "BR", "brunei": "BN", "bulgaria": "BG", "cambodia": "KH", "cameroon": "CM",
    "canada": "CA", "chile": "CL", "china": "CN", "colombia": "CO", "costa rica": "CR",
    "croatia": "HR", "cuba": "CU", "cyprus": "CY", "czech republic": "CZ", "czechia": "CZ",
    "denmark": "DK", "dominican republic": "DO", "ecuador": "EC", "egypt": "EG", "estonia": "EE",
    "fiji": "FJ", "finland": "FI", "france": "FR", "georgia": "GE", "germany": "DE",
    "ghana": "GH", "greece": "GR", "guatemala": "GT", "hong kong": "HK", "hungary": "HU",
    "iceland": "IS", "india": "IN", "indonesia": "ID", "iran": "IR", "iraq": "IQ",
    "ireland": "IE", "israel": "IL", "italy": "IT", "jamaica": "JM", "japan": "JP",
    "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE", "south korea": "KR", "korea": "KR",
    "kuwait": "KW", "laos": "LA", "latvia": "LV", "lebanon": "LB", "lithuania": "LT",
    "luxembourg": "LU", "malaysia": "MY", "maldives": "MV", "mexico": "MX", "monaco": "MC",
    "mongolia": "MN", "morocco": "MA", "myanmar": "MM", "nepal": "NP", "netherlands": "NL",
    "new zealand": "NZ", "norway": "NO", "oman": "OM", "pakistan": "PK", "panama": "PA",
    "peru": "PE", "philippines": "PH", "poland": "PL", "portugal": "PT", "qatar": "QA",
    "romania": "RO", "russia": "RU", "saudi arabia": "SA", "singapore": "SG", "slovakia": "SK",
    "slovenia": "SI", "south africa": "ZA", "spain": "ES", "sri lanka": "LK", "sweden": "SE",
    "switzerland": "CH", "taiwan": "TW", "thailand": "TH", "turkey": "TR", "turkiye": "TR",
    "ukraine": "UA", "united arab emirates": "AE", "uae": "AE", "united kingdom": "GB",
    "uk": "GB", "united states": "US", "usa": "US", "uruguay": "UY", "uzbekistan": "UZ",
    "vatican city": "VA", "venezuela": "VE", "vietnam": "VN"
};

function lookupCountryCode(input) {
    if (!input || typeof input !== "string") return null;
    const clean = input.trim();
    if (clean.length === 2) return clean.toUpperCase();
    const normalized = clean.toLowerCase().replace(/[^a-z]/g, "");
    for (const [name, code] of Object.entries(countryCodeLookup)) {
        if (name.replace(/[^a-z]/g, "") === normalized) {
            return code;
        }
    }
    return clean.toUpperCase().slice(0, 2);
}

const questionElement = document.getElementById("question");
const answerButton = document.getElementById("answer-buttons");
const nextButton = document.getElementById("next-btn");
const backButton = document.getElementById("back-btn");

let currentQuestionIndex = 0;
let selectedAnswers = {};

function startQuiz() {
    currentQuestionIndex = 0;
    selectedAnswers = {};
    nextButton.innerHTML = "Next";
    nextButton.classList.remove("recommendations-btn");
    showQuestion();
}

function showQuestion() {
    resetState();

    let currentQuestion = questions[currentQuestionIndex];
    const qId = currentQuestion.id || currentQuestionIndex;
    let questionNo = currentQuestionIndex + 1;
    questionElement.innerHTML = `QUESTION ${questionNo} OF ${questions.length}<br><span style="font-size: 22px; font-weight: 700;">${currentQuestion.questions}</span>`;

    // Show Back button if we are past the first question
    if (currentQuestionIndex > 0) {
        backButton.style.display = "block";
    }

    // Check if it's a text input question
    if (currentQuestion.type === "text") {
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "e.g., New York, NY or Paris, France";
        input.className = "text-input-field";

        const feedback = document.createElement("div");
        feedback.style.fontSize = "13px";
        feedback.style.marginTop = "2px";
        feedback.style.color = "#7a7265";

        const divider = document.createElement("div");
        divider.style.textAlign = "center";
        divider.style.fontSize = "13px";
        divider.style.color = "#7a7265";
        divider.style.margin = "8px 0";
        divider.innerHTML = "&mdash; or &mdash;";

        const notSureBtn = document.createElement("button");
        notSureBtn.className = "btn";
        notSureBtn.style.borderStyle = "dashed";
        notSureBtn.style.textAlign = "center";
        notSureBtn.innerHTML = "Not sure / Open to anything";

        container.appendChild(input);
        container.appendChild(feedback);
        container.appendChild(divider);
        container.appendChild(notSureBtn);
        answerButton.appendChild(container);

        let debounceTimer;

        // Restore previously selected text or "not sure" answer when going back/forth
        if (selectedAnswers[qId]) {
            const saved = selectedAnswers[qId];
            if (saved.isNotSure) {
                notSureBtn.classList.add("selected");
                nextButton.style.display = "block";
            } else if (saved.query) {
                input.value = saved.query;
                feedback.innerHTML = `Verified: ${saved.displayName}`;
                feedback.style.color = "#4a5d4e";
                nextButton.style.display = "block";
            }
        }

        // Search and validation on typing
        input.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            nextButton.style.display = "none";
            notSureBtn.classList.remove("selected");
            
            if (query.length < 3) {
                feedback.innerHTML = "Type at least 3 characters to search...";
                feedback.style.color = "#7a7265";
                return;
            }

            feedback.innerHTML = "Searching location...";
            feedback.style.color = "#7a7265";

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const validLocation = data[0];
                            feedback.innerHTML = `Found: ${validLocation.display_name}`;
                            feedback.style.color = "#4a5d4e";
                            
                            selectedAnswers[qId] = {
                                query: query,
                                displayName: validLocation.display_name,
                                lat: validLocation.lat,
                                lon: validLocation.lon,
                                isNotSure: false
                            };
                            nextButton.style.display = "block";
                        } else {
                            feedback.innerHTML = "Location not found. Please try a different place.";
                            feedback.style.color = "#b2533e";
                        }
                    })
                    .catch(err => {
                        feedback.innerHTML = "Could not verify location (network error).";
                        feedback.style.color = "#7a7265";
                    });
            }, 500);
        });

        // Click handler for "Not sure" button
        notSureBtn.addEventListener("click", () => {
            input.value = "";
            feedback.innerHTML = "";
            notSureBtn.classList.add("selected");

            selectedAnswers[qId] = {
                isNotSure: true,
                displayName: "Not sure / Any"
            };
            nextButton.style.display = "block";
        });

    } else if (currentQuestion.type === "image-choice") {
        const container = document.createElement("div");
        container.style.display = "grid";
        container.style.gridTemplateColumns = "repeat(2, 1fr)";
        container.style.gap = "20px";
        container.style.marginTop = "20px";

        currentQuestion.answers.forEach((answer, index) => {
            const card = document.createElement("div");
            card.classList.add("image-card");

            if (selectedAnswers[qId] === index) {
                card.classList.add("selected");
                nextButton.style.display = "block";
            }

            card.innerHTML = `
                <img src="${answer.image}" alt="${answer.text}">
                <div class="image-card-text">${answer.text}</div>
                <div class="image-card-caption">${answer.caption}</div>
            `;

            card.addEventListener("click", () => {
                Array.from(container.children).forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");
                selectedAnswers[qId] = index;
                nextButton.style.display = "block";
            });

            container.appendChild(card);
        });

        answerButton.appendChild(container);
        
    } else if (currentQuestion.type === "select") {
        // Multi-select month grid buttons
        const container = document.createElement("div");
        container.style.display = "grid";
        container.style.gridTemplateColumns = "repeat(3, 1fr)";
        container.style.gap = "10px";

        const months = [
            "January", "February", "March", 
            "April", "May", "June", 
            "July", "August", "September", 
            "October", "November", "December", 
            "Not sure / Any"
        ];

        if (!selectedAnswers[qId]) {
            selectedAnswers[qId] = [];
        }

        months.forEach(month => {
            const button = document.createElement("button");
            button.innerHTML = month;
            button.classList.add("btn");
            button.style.margin = "0";
            button.style.textAlign = "center";

            if (month === "Not sure / Any") {
                button.style.gridColumn = "span 3";
                button.style.borderStyle = "dashed";
            }

            if (selectedAnswers[qId].includes(month)) {
                button.classList.add("selected");
                nextButton.style.display = "block";
            }

            button.addEventListener("click", () => {
                const currentSelections = selectedAnswers[qId];

                if (month === "Not sure / Any") {
                    selectedAnswers[qId] = [month];
                    Array.from(container.children).forEach(btn => btn.classList.remove("selected"));
                    button.classList.add("selected");
                } else {
                    const notSureIndex = currentSelections.indexOf("Not sure / Any");
                    if (notSureIndex > -1) {
                        currentSelections.splice(notSureIndex, 1);
                        container.lastChild.classList.remove("selected");
                    }

                    const index = currentSelections.indexOf(month);
                    if (index > -1) {
                        currentSelections.splice(index, 1);
                        button.classList.remove("selected");
                    } else {
                        currentSelections.push(month);
                        button.classList.add("selected");
                    }
                }

                if (selectedAnswers[qId].length > 0) {
                    nextButton.style.display = "block";
                } else {
                    nextButton.style.display = "none";
                }
            });

            container.appendChild(button);
        });

        answerButton.appendChild(container);

    } else if (currentQuestion.type === "multiselect") {
        // Multi-select buttons for dietary restrictions
        const container = document.createElement("div");
        container.style.display = "grid";
        container.style.gap = "12px";

        if (!selectedAnswers[qId]) {
            selectedAnswers[qId] = [];
        }

        currentQuestion.answers.forEach((answer, index) => {
            const button = document.createElement("button");
            button.innerHTML = answer.text;
            button.classList.add("btn");

            if (answer.text === "None / No restrictions") {
                button.style.borderStyle = "dashed";
            }

            if (selectedAnswers[qId].includes(index)) {
                button.classList.add("selected");
                nextButton.style.display = "block";
            }

            button.addEventListener("click", () => {
                const currentSelections = selectedAnswers[qId];

                if (answer.text === "None / No restrictions") {
                    // Selecting "None" clears everything else
                    selectedAnswers[qId] = [index];
                    Array.from(container.children).forEach(btn => btn.classList.remove("selected"));
                    button.classList.add("selected");
                } else {
                    // If "None" was previously selected, remove it
                    const noneIndex = currentQuestion.answers.findIndex(a => a.text === "None / No restrictions");
                    const noneSelectedPos = currentSelections.indexOf(noneIndex);
                    if (noneSelectedPos > -1) {
                        currentSelections.splice(noneSelectedPos, 1);
                        container.children[noneIndex].classList.remove("selected");
                    }

                    const idx = currentSelections.indexOf(index);
                    if (idx > -1) {
                        currentSelections.splice(idx, 1);
                        button.classList.remove("selected");
                    } else {
                        currentSelections.push(index);
                        button.classList.add("selected");
                    }
                }

                if (selectedAnswers[qId].length > 0) {
                    nextButton.style.display = "block";
                } else {
                    nextButton.style.display = "none";
                }
            });

            container.appendChild(button);
        });

        answerButton.appendChild(container);

    } else {
        // Standard single-select buttons for regular questions
        currentQuestion.answers.forEach((answer, index) => {
            const button = document.createElement("button");
            button.innerHTML = answer.text;
            button.classList.add("btn");
            
            if (selectedAnswers[qId] === index) {
                button.classList.add("selected");
                nextButton.style.display = "block";
            }

            button.addEventListener("click", (e) => selectAnswer(e, index));
            answerButton.appendChild(button);
        });
    }
}

function resetState() {
    nextButton.style.display = "none";
    backButton.style.display = "none";
    answerButton.innerHTML = "";
}

function selectAnswer(e, index) {
    const qId = questions[currentQuestionIndex].id || currentQuestionIndex;
    Array.from(answerButton.children).forEach(btn => btn.classList.remove("selected"));
    e.target.classList.add("selected");
    selectedAnswers[qId] = index;
    nextButton.style.display = "block";
}

nextButton.addEventListener("click", () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showScore();
    }
});

backButton.addEventListener("click", () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
});

/**
 * Builds the exact 20-field JSON response requested by the user.
 * Decoupled by question id so questions can be reordered, added, or removed
 * without breaking the final payload.
 */
function formatFinalQuizPayload(answers) {
    const qMap = {};
    for (const q of questions) {
        if (q.id) {
            qMap[q.id] = q;
        }
    }

    // Question 1: startingLocation: [“Portland, OR”]
    let startingLocation = [];
    const q1Ans = answers["startingLocation"];
    if (q1Ans && !q1Ans.isNotSure) {
        const loc = q1Ans.query || q1Ans.displayName || "";
        if (loc.trim()) {
            startingLocation = [loc.trim()];
        }
    }
    if (startingLocation.length === 0) {
        startingLocation = ["Portland, OR"];
    }

    // Question 2: preferredCountries: [“MY”]
    let preferredCountries = [];
    const q2Ans = answers["preferredCountries"];
    if (q2Ans && !q2Ans.isNotSure) {
        const countryVal = q2Ans.query || q2Ans.displayName || "";
        const code = countryVal ? lookupCountryCode(countryVal) : null;
        if (code) {
            preferredCountries = [code];
        } else if (countryVal.trim()) {
            preferredCountries = [countryVal.trim().toUpperCase()];
        }
    }
    if (preferredCountries.length === 0) {
        preferredCountries = ["MY"];
    }

    // Question 3: preferredMonths: [“Jan”, “Feb”]
    let preferredMonths = [];
    const monthAbbrs = {
        "january": "Jan", "february": "Feb", "march": "Mar", "april": "Apr",
        "may": "May", "june": "Jun", "july": "Jul", "august": "Aug",
        "september": "Sep", "october": "Oct", "november": "Nov", "december": "Dec"
    };
    const q3Ans = answers["preferredMonths"];
    if (Array.isArray(q3Ans)) {
        preferredMonths = q3Ans
            .filter(m => m && m !== "Not sure / Any")
            .map(m => monthAbbrs[m.toLowerCase()] || m.slice(0, 3));
    }
    if (preferredMonths.length === 0) {
        preferredMonths = ["Jan", "Feb"];
    }

    // Question 4: minNights & maxNights
    let minNights = 1;
    let maxNights = 3;
    const q4Idx = answers["tripDuration"];
    if (q4Idx !== undefined) {
        const durationMap = {
            0: [1, 3],
            1: [4, 6],
            2: [7, 9],
            3: [10, 14],
            4: [15, 20]
        };
        if (durationMap[q4Idx]) {
            [minNights, maxNights] = durationMap[q4Idx];
        }
    }

    // Question 5: preferredWeather: “Sunny”
    let preferredWeather = "Sunny";
    const q5Idx = answers["preferredWeather"];
    if (q5Idx !== undefined && qMap["preferredWeather"]?.answers[q5Idx]) {
        preferredWeather = qMap["preferredWeather"].answers[q5Idx].text;
    }

    // Question 6: visaWillingness: false
    let visaWillingness = false;
    const q6Idx = answers["visaWillingness"];
    if (q6Idx !== undefined) {
        visaWillingness = q6Idx === 0; // 0: Yes, 1: No, 2: Maybe
    }

    // Question 7: highRiskDestWillingness: false
    let highRiskDestWillingness = false;
    const q7Idx = answers["highRiskDestWillingness"];
    if (q7Idx !== undefined) {
        highRiskDestWillingness = q7Idx === 0; // 0: Yes, 1: No, 2: Maybe
    }

    // Question 8: preferredAccomodation: “5 star hotel”
    let preferredAccomodation = "5 star hotel";
    const q8Idx = answers["preferredAccomodation"];
    if (q8Idx !== undefined && qMap["preferredAccomodation"]?.answers[q8Idx]) {
        preferredAccomodation = qMap["preferredAccomodation"].answers[q8Idx].text;
    }

    // Question 9: travelAlterEgo: “The Explorer”
    let travelAlterEgo = "The Explorer";
    const q9Idx = answers["travelAlterEgo"];
    if (q9Idx !== undefined && qMap["travelAlterEgo"]?.answers[q9Idx]) {
        travelAlterEgo = qMap["travelAlterEgo"].answers[q9Idx].text;
    }

    // Question 10: preferredViews: “Sunset by the beach”
    let preferredViews = "Sunset by the beach";
    const q10Idx = answers["preferredViews"];
    if (q10Idx !== undefined && qMap["preferredViews"]?.answers[q10Idx]) {
        preferredViews = qMap["preferredViews"].answers[q10Idx].text;
    }

    // Question 11: photosToPost: “Food”
    let photosToPost = "Food";
    const q11Idx = answers["photosToPost"];
    if (q11Idx !== undefined && qMap["photosToPost"]?.answers[q11Idx]) {
        photosToPost = qMap["photosToPost"].answers[q11Idx].text;
    }

    // Question 12: seeAllOrDeeply: “See it all”
    let seeAllOrDeeply = "See it all";
    const q12Idx = answers["seeAllOrDeeply"];
    if (q12Idx !== undefined && qMap["seeAllOrDeeply"]?.answers[q12Idx]) {
        seeAllOrDeeply = qMap["seeAllOrDeeply"].answers[q12Idx].text;
    }

    // Question 13: sleepInOrEarly: “Sleep in”
    let sleepInOrEarly = "Sleep in";
    const q13Idx = answers["sleepInOrEarly"];
    if (q13Idx !== undefined) {
        sleepInOrEarly = q13Idx === 0 ? "Sleep in" : "Sleep early";
    }

    // Question 14: visitFamousLocationOrHiddenGem: “Discover a hidden gem”
    let visitFamousLocationOrHiddenGem = "Discover a hidden gem";
    const q14Idx = answers["visitFamousLocationOrHiddenGem"];
    if (q14Idx !== undefined && qMap["visitFamousLocationOrHiddenGem"]?.answers[q14Idx]) {
        visitFamousLocationOrHiddenGem = qMap["visitFamousLocationOrHiddenGem"].answers[q14Idx].text;
    }

    // Question 15: enjoyCrowdsOrSpace: “Enjoy space to yourself”
    let enjoyCrowdsOrSpace = "Enjoy space to yourself";
    const q15Idx = answers["enjoyCrowdsOrSpace"];
    if (q15Idx !== undefined && qMap["enjoyCrowdsOrSpace"]?.answers[q15Idx]) {
        enjoyCrowdsOrSpace = qMap["enjoyCrowdsOrSpace"].answers[q15Idx].text;
    }

    // Question 16: walkAmount: “A bit”
    let walkAmount = "A bit";
    const q16Idx = answers["walkAmount"];
    if (q16Idx !== undefined && qMap["walkAmount"]?.answers[q16Idx]) {
        walkAmount = qMap["walkAmount"].answers[q16Idx].text;
    }

    // Question 17: peopleOnTrip: 1
    let peopleOnTrip = 1;
    const q17Idx = answers["peopleOnTrip"];
    if (q17Idx !== undefined && qMap["peopleOnTrip"]?.answers[q17Idx]) {
        const textVal = qMap["peopleOnTrip"].answers[q17Idx].text;
        peopleOnTrip = parseInt(textVal, 10) || 1;
    }

    // Question 18: budgetLevel: “$$”
    let budgetLevel = "$$";
    const q18Idx = answers["budgetLevel"];
    if (q18Idx !== undefined && qMap["budgetLevel"]?.answers[q18Idx]) {
        budgetLevel = qMap["budgetLevel"].answers[q18Idx].text;
    }

    // Question 19: dietaryRestrictions: “None”
    let dietaryRestrictions = "None";
    const q19Ans = answers["dietaryRestrictions"];
    if (Array.isArray(q19Ans) && q19Ans.length > 0) {
        const dietOptions = qMap["dietaryRestrictions"]?.answers || [];
        const selectedTexts = q19Ans.map(idx => dietOptions[idx]?.text).filter(Boolean);
        if (selectedTexts.some(t => t.toLowerCase().includes("none"))) {
            dietaryRestrictions = "None";
        } else if (selectedTexts.length === 1) {
            dietaryRestrictions = selectedTexts[0];
        } else if (selectedTexts.length > 1) {
            dietaryRestrictions = selectedTexts.join(", ");
        }
    }

    return {
        startingLocation,
        preferredCountries,
        preferredMonths,
        minNights,
        maxNights,
        preferredWeather,
        visaWillingness,
        highRiskDestWillingness,
        preferredAccomodation,
        travelAlterEgo,
        preferredViews,
        photosToPost,
        seeAllOrDeeply,
        sleepInOrEarly,
        visitFamousLocationOrHiddenGem,
        enjoyCrowdsOrSpace,
        walkAmount,
        peopleOnTrip,
        budgetLevel,
        dietaryRestrictions
    };
}

function showScore() {
    resetState();
    questionElement.innerHTML = "Assessment Complete!";
    answerButton.innerHTML = `
        <p style='font-size: 16px; color: #001e4d; margin-top: 10px;'>
            Thank you for sharing your preferences! We are building your customized travel plan.
        </p>
        <div id='quiz-error-msg' style='color: #b2533e; margin-top: 15px; font-weight: bold;'></div>
    `;
    nextButton.innerHTML = "See my Recommendations!";
    nextButton.classList.add("recommendations-btn");
    nextButton.style.display = "block";

    nextButton.onclick = async () => {
        const errorContainer = document.getElementById("quiz-error-msg");
        if (errorContainer) errorContainer.innerHTML = "";

        const token = localStorage.getItem("token");
        const payload = formatFinalQuizPayload(selectedAnswers);

        nextButton.disabled = true;
        nextButton.innerHTML = "Saving your preferences...";

        try {
            const response = await fetch("http://localhost:8080/api/quiz", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || "Failed to save quiz responses");
            }

            // Successfully saved to DynamoDB! Redirect to loading/recommendations page
            window.location.href = "/?page=loading";
        } catch (err) {
            console.error("Error saving quiz responses:", err);
            nextButton.disabled = false;
            nextButton.innerHTML = "See my Recommendations!";
            if (errorContainer) {
                errorContainer.innerText = `Error: ${err.message || "Failed to save quiz"}. Please try again.`;
            }
        }
    };
}

startQuiz();
