import { clearPlanningSession, paths, safePlanningReturn, withPlanningReturn } from "../src/services/navigation.js";

const planningReturn = safePlanningReturn(new URLSearchParams(window.location.search).get("returnTo"));
if (!localStorage.getItem("token")) window.location.replace(withPlanningReturn(paths.login, planningReturn));

const assessmentImages = import.meta.glob('./*.{png,jpg,jpeg,webp}', {
    eager: true, query: '?url', import: 'default'
});

/*API for Q1 + Q2: */
const questions = [
    {
        id: "preferredCountries",
        questions: "What are some countries you would like to visit: ",
        type: "multiple-places",
        answers: []
    },
    {
        id: "preferredMonths",
        questions: "What months would you prefer traveling in? ",
        type: "dropdown",
        answers: [
            { text: "January" },
            { text: "February" },
            { text: "March" },
            { text: "April" },
            { text: "May" },
            { text: "June" },
            { text: "July" },
            { text: "August" },
            { text: "September" },
            { text: "October" },
            { text: "November" },
            { text: "December" },
        ]
    },
    {
        id: "tripDuration",
        questions: "How many nights would you like this trip to last?",
        type: "single-dropdown",
        answers: [
            { text: "0 nights (Day Trip)" },
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
        type: "single-dropdown",
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
        id: "preferredTemp",
        questions: "What kind of temperature do you prefer?",
        type: "single-dropdown",
        answers: [
            { text: "30C+ | 85F+" },
            { text: "20-29C | 68F-84F" },
            { text: "10C-19C | 50F-67F" },
            { text: "Under 10C | 50F" },
            { text: "No Preference | Any Weather" }
        ]
    },
    {
        id: "highRiskDestWillingness",
        questions: "Are you willing to go to a high risk travel destinations?",
        answers: [
            { text: "Yes" },
            { text: "No" },
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
        id: "visaWillingness",
        questions: "Are you willing to get a visa for traveling?",
        type: "image-choice",
        answers: [
        {
            text: "Yes",
            image: "visa.jpg",
            caption: "Yes! I'm willing to get a travel visa"
        },
        {
            text: "No",
            image: "noVisa.png",
            caption: "No! I'm not willing to get a travel visa"
        }
    ]
    },
    {
        id: "travelAlterEgo",
        questions: "What is your travel alter ego?",
        type: "image-choice",
        answers: [
        {
            text: "The Explorer",
            image: "theAdventurer.jpg",
            caption: "Always searching for an adventure"
        },
        {
            text: "The Historian",
            image: "theHistorian.jpg",
            caption: "Facinated by local culture museums"
        },
        {
            text: "The Foodie",
            image: "TheFoodie.png",
            caption: "Planning my trip around good food"
        },
        {
            text: "The Spa Lover",
            image: "spaLover.jpg",
            caption: "Prioritizing ultimate relaxation"
        }
    ]
    },
    {
        id: "preferredViews",
        questions: "Which view would make you stop and take a picture?",
        type: "image-choice",
        answers: [
        {
            text: "Sunset by the beach",
            image: "sunsetByBeach.jpg",
            caption: "Coastal golden hour"
        },
        {
            text: "City skyline at night",
            image: "citySkylineNight.jpg",
            caption: "Bright lights & high rises"
        },
        {
            text: "Mountains above the clouds",
            image: "mountainsAboveCloud.jpg",
            caption: "Top-of-the-world views"
        },
    ]
    },
    {
        id: "photosToPost",
        questions: "What kind of trip pics would you post after you get back home?",
        type: "image-choice",
        answers: [
        {
            text: "Unique historical and cultural experiences",
            image: "uniqueExperiences.jpg",
            caption: "Local heritage & hidden history"
        },
        {
            text: "Food dumps",
            image: "foodDumps.jpg",
            caption: "Mouthwatering meals & street eats"
        },
        {
            text: "The streets",
            image: "streetsInNY.jpg",
            caption: "City vibes & candid street shots"
        },
        {
            text: "Good natural scenery",
            image: "southAmericaNature.jpg",
            caption: "No filter needed"
        }
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
        type: "single-dropdown",
        answers: [
            { text: "1" },
            { text: "2" },
            { text: "3-5" },
            { text: "6-9" },
            { text: "10+" }
        ]
    },
    {
        id: "budgetLevel",
        questions: "What is your budget per person, per day for food and activities?",
        answers: [
            { text: "$" },
            { text: "$$" },
            { text: "$$$" }
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
const progressText = document.getElementById("progress-text");
const progressPercent = document.getElementById("progress-percent");
const progressFill = document.getElementById("progress-fill");
const progressPlane = document.getElementById("progress-plane");
const progressTrack = document.querySelector(".progress-track");

// =============================
// UPDATE ASSESSMENT PROGRESS
// =============================

function updateProgress() {

    let answeredQuestions = 0;

    questions.forEach(question => {

        const answer = selectedAnswers[question.id];

        if (answer === undefined || answer === null) {
            return;
        }

        // Check multiple selections
        if (Array.isArray(answer)) {

            if (answer.length > 0) {
                answeredQuestions++;
            }

        }

        // Check objects (e.g. countries)
        else if (typeof answer === "object") {

            if (Object.keys(answer).length > 0) {
                answeredQuestions++;
            }

        }

        // Check regular single answers
        else {

            answeredQuestions++;

        }

    });

    const totalQuestions = questions.length;

    const percentage = Math.round(
        (answeredQuestions / totalQuestions) * 100
    );


    progressText.textContent =
        `${answeredQuestions} of ${totalQuestions} questions answered`;

    progressPercent.textContent = `${percentage}%`;

    // Move the airplane
    progressPlane.style.left = `${percentage}%`;

    // Update completed flight path
    progressFill.style.width = `${percentage}%`;

    // Update accessibility information
    progressTrack.setAttribute("aria-valuenow", percentage);

    // Update milestone markers
    document.querySelectorAll(".route-marker").forEach(marker => {
        const milestone = parseInt(
            marker.classList[1].replace("marker-", ""),
            10
        );

        marker.classList.toggle(
            "completed",
            percentage >= milestone
        );
    });

    // Change airplane color based on progress
    progressPlane.classList.remove(
        "milestone-25",
        "milestone-50",
        "milestone-75",
        "milestone-100"
    );

    if (percentage >= 100) {
        progressPlane.classList.add("milestone-100");
    } else if (percentage >= 75) {
        progressPlane.classList.add("milestone-75");
    } else if (percentage >= 50) {
        progressPlane.classList.add("milestone-50");
    } else if (percentage >= 25) {
        progressPlane.classList.add("milestone-25");
    }

}

answerButton.addEventListener("click", updateProgress);
answerButton.addEventListener("change", updateProgress);

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
    questionElement.innerHTML = `<span style="font-size: 22px; font-weight: 700;">${currentQuestion.questions}</span>`;
    // Show Back button if we are past the first question
    if (currentQuestionIndex > 0) {
        backButton.style.display = "block";
    }

    // Check if it's a text input question

    if (currentQuestion.type === "multiple-places") {

        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "12px";

        // Country search input
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Search a country (e.g. Japan)";
        input.className = "text-input-field";

        // Feedback message
        const feedback = document.createElement("div");
        feedback.style.fontSize = "13px";
        feedback.style.color = "#7a7265";

        // Search result container
        const resultContainer = document.createElement("div");

        // Selected countries container
        const selectedContainer = document.createElement("div");
        selectedContainer.className = "selected-countries";

        // Not sure button
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

        // Restore previous selections
        if (!Array.isArray(selectedAnswers[qId]) && !selectedAnswers[qId]?.isNotSure) {
            selectedAnswers[qId] = [];
        }

        // Display selected countries
        function updateSelectedPlaces() {

            selectedContainer.innerHTML = "";

            const places = Array.isArray(selectedAnswers[qId]) ? selectedAnswers[qId] : [];
            places.forEach((place, index) => {

                const tag = document.createElement("button");

                tag.type = "button";
                tag.className = "country-tag";

                tag.textContent = place.name + " x";

                tag.addEventListener("click", () => {

                    selectedAnswers[qId].splice(index, 1);

                    updateSelectedPlaces();

                });

                selectedContainer.appendChild(tag);

            });

            nextButton.style.display =
                selectedAnswers[qId].length > 0 ||
                selectedAnswers[qId].isNotSure
                    ? "block"
                    : "none";
        }

        // Restore Not sure selection
        if (selectedAnswers[qId].isNotSure) {
            notSureBtn.classList.add("selected");
            input.disabled = true;
        }

        updateSelectedPlaces();

        let debounceTimer;

        // Search countries
        input.addEventListener("input", () => {

            const query = input.value.trim();

            clearTimeout(debounceTimer);
            resultContainer.innerHTML = "";

            if (query.length < 3) {

                feedback.textContent =
                    "Type at least 3 characters to search...";

                return;
            }

            feedback.textContent = "Searching country...";
            feedback.style.color = "#7a7265";

            debounceTimer = setTimeout(async () => {

                try {

                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&featuretype=country&limit=10&q=${encodeURIComponent(query)}`
                    );

                    const data = await response.json();

                    if (data && data.length > 0) {

                        const validLocation = data.find(item =>
                            item.type === "administrative" &&
                            item.addresstype === "country" &&
                            item.address?.country_code
                        );

                        if (!validLocation) {
                            feedback.textContent =
                                "Please enter a valid country name. Cities and addresses are not accepted.";

                            feedback.style.color = "#b2533e";
                            return;
                        }

                        const countryCode =
                            validLocation.address?.country_code?.toUpperCase();

                        feedback.textContent =
                            "Found: " + validLocation.display_name;

                        feedback.style.color = "#4a5d4e";

                        const addButton = document.createElement("button");

                        addButton.type = "button";
                        addButton.className = "btn";
                        addButton.textContent = "+ Add country";

                        addButton.addEventListener("click", () => {

                            if (!countryCode) {
                                feedback.textContent =
                                    "Could not identify country code.";
                                return;
                            }

                            const alreadyAdded =
                                selectedAnswers[qId].some(
                                    place => place.code === countryCode
                                );

                            if (!alreadyAdded) {

                                selectedAnswers[qId].push({
                                    name: validLocation.display_name,
                                    code: countryCode,
                                    lat: validLocation.lat,
                                    lon: validLocation.lon
                                });

                            }

                            input.value = "";
                            feedback.textContent = "";
                            resultContainer.innerHTML = "";

                            updateSelectedPlaces();

                        });

                        resultContainer.appendChild(addButton);

                    } else {

                        feedback.textContent =
                            "Country not found. Please try another.";

                        feedback.style.color = "#b2533e";

                    }

                } catch (error) {

                    feedback.textContent =
                        "Could not verify country (network error).";

                    feedback.style.color = "#7a7265";

                }

            }, 500);

            });

            // Not sure button
            notSureBtn.addEventListener("click", () => {

                const isSelected = selectedAnswers[qId].isNotSure;

                if (isSelected) {

                    selectedAnswers[qId] = [];
                    notSureBtn.classList.remove("selected");
                    input.disabled = false;

            } else {

                selectedAnswers[qId] = {
                    isNotSure: true
                };

                notSureBtn.classList.add("selected");
                input.value = "";
                input.disabled = true;

                feedback.textContent = "";
                resultContainer.innerHTML = "";
                selectedContainer.innerHTML = "";

            }

            updateSelectedPlaces();

        });

        // Add elements to page
        container.appendChild(input);
        container.appendChild(feedback);
        container.appendChild(resultContainer);
        container.appendChild(selectedContainer);
        container.appendChild(divider);
        container.appendChild(notSureBtn);

        answerButton.appendChild(container);



    } else if (currentQuestion.type === "image-choice") {
        const container = document.createElement("div");
        container.style.display = "grid";
        container.style.gridTemplateColumns =
            "repeat(2, minmax(0, 1fr))";
        container.style.gap = "14px";
        container.style.alignItems = "stretch";
        container.style.marginTop = "20px";

        currentQuestion.answers.forEach((answer, index) => {
            const card = document.createElement("div");
            card.classList.add("image-card");

            if (selectedAnswers[qId] === index) {
                card.classList.add("selected");
                nextButton.style.display = "block";
            }

            card.innerHTML = `
                <img src="${assessmentImages[`./${answer.image}`] || answer.image}" alt="${answer.text}">
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
    } else if (currentQuestion.type === "single-dropdown") {

    const container = document.createElement("div");
    container.className = "custom-dropdown";

    // Dropdown header
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "dropdown-trigger";

    // Dropdown text
    const dropdownText = document.createElement("span");

    // Dropdown arrow
    const arrow = document.createElement("span");
    arrow.textContent = "V";

    trigger.appendChild(dropdownText);
    trigger.appendChild(arrow);

    // Options container
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "dropdown-options";

    // Restore previous selection
    function updateDropdown() {

        if (selectedAnswers[qId] !== undefined) {

            dropdownText.textContent =
                currentQuestion.answers[selectedAnswers[qId]].text;

            nextButton.style.display = "block";

        } else {

            dropdownText.textContent = "Please select an option";

            nextButton.style.display = "none";
        }
    }

    // Open and close dropdown
    trigger.addEventListener("click", () => {

        const isOpen =
            optionsContainer.classList.toggle("open");

        arrow.textContent = isOpen ? "▲" : "▼";

    });

    // Generate options
    currentQuestion.answers.forEach((answer, index) => {

        const option = document.createElement("button");

        option.type = "button";
        option.className = "dropdown-option";

        option.textContent = answer.text;

        // Highlight previously selected option
        if (selectedAnswers[qId] === index) {
            option.classList.add("selected");
        }

        option.addEventListener("click", () => {

            selectedAnswers[qId] = index;

            // Update selected option
            Array.from(optionsContainer.children).forEach(btn => {
                btn.classList.remove("selected");
            });

            option.classList.add("selected");

            // Update dropdown header
            updateDropdown();

            // Close dropdown
            optionsContainer.classList.remove("open");
            arrow.textContent = "V";

        });

        optionsContainer.appendChild(option);

    });

    container.appendChild(trigger);
    container.appendChild(optionsContainer);

    answerButton.appendChild(container);

    updateDropdown();
        ///////

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
     /*===================================================================*/
      /*===================================================================*/
       /*===================================================================*/

    } else if (currentQuestion.type === "dropdown") {

        const container = document.createElement("div");
        container.className = "months-dropdown";

        // Store multiple selections
        if (!Array.isArray(selectedAnswers[qId])) {
            selectedAnswers[qId] = [];
        }

        // Dropdown header
        const dropdownHeader = document.createElement("button");
        dropdownHeader.type = "button";
        dropdownHeader.className = "months-dropdown-header";

        const dropdownText = document.createElement("span");

        const arrow = document.createElement("span");
        arrow.textContent = "▼";

        dropdownHeader.appendChild(dropdownText);
        dropdownHeader.appendChild(arrow);

        // Dropdown options container
        const optionsContainer = document.createElement("div");
        optionsContainer.className = "months-dropdown-options";

        // Update selected months
        function updateDropdown() {

            const selected = selectedAnswers[qId];

            dropdownText.textContent = selected.length > 0
                ? selected.join(", ")
                : "Select your preferred months";

            nextButton.style.display =
                selected.length > 0 ? "block" : "none";
        }

        // Generate month grid
        const monthsGrid = document.createElement("div");
        monthsGrid.className = "months-grid";

        currentQuestion.answers.forEach(answer => {

            const month = answer.text;

            const option = document.createElement("label");
            option.className = "month-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = month;

            checkbox.checked =
                selectedAnswers[qId].includes(month);

            const monthText = document.createElement("span");
            monthText.textContent = month;

            if (checkbox.checked) {
                option.classList.add("selected");
            }

            option.appendChild(checkbox);
            option.appendChild(monthText);

            checkbox.addEventListener("change", () => {

                if (checkbox.checked) {

                    if (!selectedAnswers[qId].includes(month)) {
                        selectedAnswers[qId].push(month);
                    }

                    option.classList.add("selected");

                } else {

                    selectedAnswers[qId] =
                        selectedAnswers[qId].filter(
                            selectedMonth => selectedMonth !== month
                        );

                    option.classList.remove("selected");
                }

                updateDropdown();
                updateProgress();
            });

            monthsGrid.appendChild(option);

        });

        optionsContainer.appendChild(monthsGrid);

        // Open and close dropdown
        dropdownHeader.addEventListener("click", () => {

            const isOpen =
                optionsContainer.classList.toggle("open");

            arrow.textContent = isOpen ? "▲" : "▼";

        });

        container.appendChild(dropdownHeader);
        container.appendChild(optionsContainer);

        answerButton.appendChild(container);

        updateDropdown();



        //////
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

    updateProgress();
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

    // Question 2: preferredCountries: [“MY”]
    let preferredCountries = [];

    const q2Ans = answers["preferredCountries"];

    if (Array.isArray(q2Ans) && q2Ans.length > 0) {

        preferredCountries = q2Ans
            .map(place => place.code)
            .filter(Boolean);

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
            0: [0, 0],
            1: [1, 3],
            2: [4, 6],
            3: [7, 9],
            4: [10, 14],
            5: [15, 20]
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
    //Temp Q
    let preferredTemp = "No Preference | Any Weather";
    const qTempIdx = answers["preferredTemp"];

    if (
        qTempIdx !== undefined &&
        qMap["preferredTemp"]?.answers[qTempIdx]
    ) {
        preferredTemp = qMap["preferredTemp"].answers[qTempIdx].text;
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
        preferredCountries,
        preferredMonths,
        minNights,
        maxNights,
        preferredWeather,
        preferredTemp,
        visaWillingness,
        highRiskDestWillingness,
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
            ${planningReturn ? "Your preferences are ready. Continue to finish planning your selected country." : "Thank you for sharing your preferences! We are building your customized travel plan."}
        </p>
        <div id='quiz-error-msg' style='color: #b2533e; margin-top: 15px; font-weight: bold;'></div>
    `;
    nextButton.innerHTML = planningReturn ? "Continue planning my trip" : "See my Recommendations!";
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
            const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
            const response = await fetch(`${apiBase}/quiz`, {
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

            // Successfully saved to DynamoDB! Cache locally and clear stale recommendations
            localStorage.setItem("quizResponse", JSON.stringify(payload));
            clearPlanningSession(sessionStorage);

            // Resume the selected country, or load recommendations for the usual assessment flow.
            window.location.href = planningReturn || "/?page=loading";
        } catch (err) {
            console.error("Error saving quiz responses:", err);
            nextButton.disabled = false;
            nextButton.innerHTML = planningReturn ? "Continue planning my trip" : "See my Recommendations!";
            if (errorContainer) {
                errorContainer.innerText = `Error: ${err.message || "Failed to save quiz"}. Please try again.`;
            }
        }
    };
}

startQuiz();
