/*API for Q1 + Q2: */ 
const questions = [
    {
        questions: "Where are you starting from?",
        type: "text",
        answers: [
            { text: "Text entry" }
        ]
    },
    {
        questions: "What is one country you would like to visit: ",
        type: "text",
        answers: [
            { text: "Countries (or any)" }
        ]
    },
    {
        questions: "What months would you perfer traveling in? ",
        type: "select",
        answers: [
            { text: "Months (or any)" }
        ]
    },
    {
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
        questions: "Are you willing to get a visa for traveling?",
        answers: [
            { text: "Yes" },
            { text: "No" },
            { text: "Maybe. Not too sure."}
        ]
    },
    {
        questions: "How willing are you to go to high risk travel destinations?",
        answers: [
            { text: "Yes" },
            { text: "No" },
            { text: "Maybe. Not too sure."}
        ]
    },
    {
        questions: "What is your preferred mode of transportation?",
        answers: [
            { text: "Plane" },
            { text: "Car (road trip)" },
            { text: "Train" }
        ]
    },
    {
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
        questions: "What is your travel alter ego?",
        answers: [
            { text: "The Explorer" },
            { text: "The Historian" },
            { text: "The Foodie" },
            { text: "The Spa Lover" }
        ]
    },
    {
        questions: "Which view would make you stop and take a picture?",
        answers: [
            { text: "Sunset by the beach" },
            { text: "City skyline at night" },
            { text: "Mountains above the clouds" }
        ]
    },
    {
        questions: "What kind of trip pics would you post after you get back home?",
        answers: [
            { text: "Cool historical/cultural stuff" },
            { text: "Food" },
            { text: "The streets" },
            { text: "Good natural scenery/cityscapes" }
        ]
    },
    {
        questions: "Would you rather... See it all or see it deeply?",
        answers: [
            { text: "See it all" },
            { text: "See it deeply" }
        ]
    },
    {
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
        questions: "How much walking around would you like to do?",
        answers: [
            { text: "None" },
            { text: "A bit" },
            { text: "A lot" }
        ]
    },
    {
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
        questions: "What is your budget per person, per day for food and activities?",
        answers: [
            { text: "$" },
            { text: "$$" }, { text: "$$$" }
        ]
    },
    {
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
        if (selectedAnswers[currentQuestionIndex]) {
            const saved = selectedAnswers[currentQuestionIndex];
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
                            
                            selectedAnswers[currentQuestionIndex] = {
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

            selectedAnswers[currentQuestionIndex] = {
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

            if (selectedAnswers[currentQuestionIndex] === index) {
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
                selectedAnswers[currentQuestionIndex] = index;
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

        if (!selectedAnswers[currentQuestionIndex]) {
            selectedAnswers[currentQuestionIndex] = [];
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

            if (selectedAnswers[currentQuestionIndex].includes(month)) {
                button.classList.add("selected");
                nextButton.style.display = "block";
            }

            button.addEventListener("click", () => {
                const currentSelections = selectedAnswers[currentQuestionIndex];

                if (month === "Not sure / Any") {
                    selectedAnswers[currentQuestionIndex] = [month];
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

                if (selectedAnswers[currentQuestionIndex].length > 0) {
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

        if (!selectedAnswers[currentQuestionIndex]) {
            selectedAnswers[currentQuestionIndex] = [];
        }

        currentQuestion.answers.forEach((answer, index) => {
            const button = document.createElement("button");
            button.innerHTML = answer.text;
            button.classList.add("btn");

            if (answer.text === "None / No restrictions") {
                button.style.borderStyle = "dashed";
            }

            if (selectedAnswers[currentQuestionIndex].includes(index)) {
                button.classList.add("selected");
                nextButton.style.display = "block";
            }

            button.addEventListener("click", () => {
                const currentSelections = selectedAnswers[currentQuestionIndex];

                if (answer.text === "None / No restrictions") {
                    // Selecting "None" clears everything else
                    selectedAnswers[currentQuestionIndex] = [index];
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

                if (selectedAnswers[currentQuestionIndex].length > 0) {
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
            
            if (selectedAnswers[currentQuestionIndex] === index) {
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
    Array.from(answerButton.children).forEach(btn => btn.classList.remove("selected"));
    e.target.classList.add("selected");
    selectedAnswers[currentQuestionIndex] = index;
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

function showScore() {
    resetState();
    questionElement.innerHTML = "Assessment Complete!";
    answerButton.innerHTML = "<p style='font-size: 16px; color: #001e4d; margin-top: 10px;'>Thank you for sharing your preferences! We are building your customized travel plan.</p>";
    nextButton.innerHTML = "See my Recommendations!";
    nextButton.classList.add("recommendations-btn");
    nextButton.style.display = "block";
    nextButton.onclick = startQuiz;
}

startQuiz();