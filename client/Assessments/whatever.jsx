import React, { useState, useEffect } from 'react';
import './assessments.css';

const questions = [
    {
        questions: "Where are you starting from?",
        type: "text",
        answers: [{ text: "Text entry" }]
    },
    {
        questions: "What is one country you would like to visit: ",
        type: "text",
        answers: [{ text: "Countries (or any)" }]
    },
    {
        questions: "What months would you prefer traveling in? ",
        type: "select",
        answers: [{ text: "Months (or any)" }]
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
            { text: "Maybe. Not too sure." }
        ]
    },
    {
        questions: "How willing are you to go to high risk travel destinations?",
        answers: [
            { text: "Yes" },
            { text: "No" },
            { text: "Maybe. Not too sure." }
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
            { text: "Enjoy the nightlife and sleep in", image: "sydney.jpg", caption: "Sydney Opera House" },
            { text: "Sleep early but catch the sunrise", image: "barossa.jpg", caption: "Barossa Valley" }
        ]
    },
    {
        questions: "Would you rather... Visit a famous location or discover a hidden gem",
        type: "image-choice",
        answers: [
            { text: "Visit a famous location", image: "rome.jpg", caption: "Rome, Italy" },
            { text: "Discover a hidden gem", image: "Matera.jpg", caption: "Matera, Italy" }
        ]
    },
    {
        questions: "Would you rather... Enjoy the bustle of the locals, or enjoy space to yourself?",
        type: "image-choice",
        answers: [
            { text: "Enjoy the bustle of the locals", image: "Shibuya.jpg", caption: "Shibuya Scramble Crossing" },
            { text: "Enjoy space to yourself", image: "Nachi.jpg", caption: "Nachi Waterfall" }
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

function TravelQuiz() {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [isComplete, setIsComplete] = useState(false);

    // Text input states for current question
    const [textInputVal, setTextInputVal] = useState("");
    const [feedback, setFeedback] = useState("");
    const [feedbackColor, setFeedbackColor] = useState("#7a7265");

    const currentQuestion = questions[currentQuestionIndex];

    // Reset local text states when question changes
    useEffect(() => {
        if (currentQuestion.type === "text") {
            const saved = selectedAnswers[currentQuestionIndex];
            if (saved) {
                if (saved.isNotSure) {
                    setTextInputVal("");
                    setFeedback("");
                } else if (saved.query) {
                    setTextInputVal(saved.query);
                    setFeedback(`Verified: ${saved.displayName}`);
                    setFeedbackColor("#4a5d4e");
                }
            } else {
                setTextInputVal("");
                setFeedback("");
            }
        }
    }, [currentQuestionIndex]);

    // Handle typing search for text type questions
    useEffect(() => {
        if (currentQuestion.type !== "text") return;
        const query = textInputVal.trim();
        if (query.length < 3) {
            setFeedback("Type at least 3 characters to search...");
            setFeedbackColor("#7a7265");
            return;
        }

        setFeedback("Searching location...");
        setFeedbackColor("#7a7265");

        const timer = setTimeout(() => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const validLocation = data[0];
                        setFeedback(`Found: ${validLocation.display_name}`);
                        setFeedbackColor("#4a5d4e");
                        setSelectedAnswers(prev => ({
                            ...prev,
                            [currentQuestionIndex]: {
                                query,
                                displayName: validLocation.display_name,
                                lat: validLocation.lat,
                                lon: validLocation.lon,
                                isNotSure: false
                            }
                        }));
                    } else {
                        setFeedback("Location not found. Please try a different place.");
                        setFeedbackColor("#b2533e");
                    }
                })
                .catch(() => {
                    setFeedback("Could not verify location (network error).");
                    setFeedbackColor("#7a7265");
                });
        }, 500);

        return () => clearTimeout(timer);
    }, [textInputVal]);

    const handleNotSureText = () => {
        setTextInputVal("");
        setFeedback("");
        setSelectedAnswers(prev => ({
            ...prev,
            [currentQuestionIndex]: { isNotSure: true, displayName: "Not sure / Any" }
        }));
    };

    const handleSelectOption = (index) => {
        setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: index }));
    };

    const handleImageChoice = (index) => {
        setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: index }));
    };

    const handleMonthSelect = (month) => {
        const currentSelections = selectedAnswers[currentQuestionIndex] || [];
        if (month === "Not sure / Any") {
            setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: [month] }));
        } else {
            let updated = currentSelections.filter(m => m !== "Not sure / Any");
            if (updated.includes(month)) {
                updated = updated.filter(m => m !== month);
            } else {
                updated.push(month);
            }
            setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: updated }));
        }
    };

    const handleMultiSelect = (index, answerText) => {
        const currentSelections = selectedAnswers[currentQuestionIndex] || [];
        const noneIndex = currentQuestion.answers.findIndex(a => a.text === "None / No restrictions");

        if (answerText === "None / No restrictions") {
            setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: [index] }));
        } else {
            let updated = currentSelections.filter(i => i !== noneIndex);
            if (updated.includes(index)) {
                updated = updated.filter(i => i !== index);
            } else {
                updated.push(index);
            }
            setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: updated }));
        }
    };

    const isNextEnabled = () => {
        const ans = selectedAnswers[currentQuestionIndex];
        if (ans === undefined) return false;
        if (Array.isArray(ans)) return ans.length > 0;
        if (typeof ans === "object" && ans !== null) return ans.query || ans.isNotSure;
        return true;
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            setIsComplete(true);
        }
    };

    const handleBack = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const restartQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setIsComplete(false);
    };

    return (
        <div className="app">
            <h1>Your Assessment</h1>
            <div className="quiz">
                {!isComplete ? (
                    <>
                        <h2 id="question">
                            QUESTION {currentQuestionIndex + 1} OF {questions.length}
                            <br />
                            <span style={{ fontSize: "22px", fontWeight: 700 }}>
                                {currentQuestion.questions}
                            </span>
                        </h2>

                        <div id="answer-buttons">
                            {/* TEXT TYPE */}
                            {currentQuestion.type === "text" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <input
                                        type="text"
                                        placeholder="e.g., New York, NY or Paris, France"
                                        className="text-input-field"
                                        value={textInputVal}
                                        onChange={(e) => setTextInputVal(e.target.value)}
                                    />
                                    <div style={{ fontSize: "13px", marginTop: "2px", color: feedbackColor }}>
                                        {feedback}
                                    </div>
                                    <div style={{ textAlign: "center", fontSize: "13px", color: "#7a7265", margin: "8px 0" }}>
                                        &mdash; or &mdash;
                                    </div>
                                    <button
                                        className={`btn ${selectedAnswers[currentQuestionIndex]?.isNotSure ? "selected" : ""}`}
                                        style={{ borderStyle: "dashed", textAlign: "center" }}
                                        onClick={handleNotSureText}
                                    >
                                        Not sure / Open to anything
                                    </button>
                                </div>
                            )}

                            {/* IMAGE CHOICE TYPE */}
                            {currentQuestion.type === "image-choice" && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginTop: "20px" }}>
                                    {currentQuestion.answers.map((answer, index) => (
                                        <div
                                            key={answer.text}
                                            className={`image-card ${selectedAnswers[currentQuestionIndex] === index ? "selected" : ""}`}
                                            onClick={() => handleImageChoice(index)}
                                        >
                                            <img src={answer.image} alt={answer.text} />
                                            <div className="image-card-text">{answer.text}</div>
                                            <div className="image-card-caption">{answer.caption}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* SELECT (MONTHS) TYPE */}
                            {currentQuestion.type === "select" && (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                                    {[
                                        "January", "February", "March",
                                        "April", "May", "June",
                                        "July", "August", "September",
                                        "October", "November", "December",
                                        "Not sure / Any"
                                    ].map(month => {
                                        const currentSel = selectedAnswers[currentQuestionIndex] || [];
                                        const isSelected = currentSel.includes(month);
                                        return (
                                            <button
                                                key={month}
                                                className={`btn ${isSelected ? "selected" : ""}`}
                                                style={{
                                                    margin: 0,
                                                    textAlign: "center",
                                                    ...(month === "Not sure / Any" ? { gridColumn: "span 3", borderStyle: "dashed" } : {})
                                                }}
                                                onClick={() => handleMonthSelect(month)}
                                            >
                                                {month}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* MULTISELECT TYPE */}
                            {currentQuestion.type === "multiselect" && (
                                <div style={{ display: "grid", gap: "12px" }}>
                                    {currentQuestion.answers.map((answer, index) => {
                                        const currentSel = selectedAnswers[currentQuestionIndex] || [];
                                        const isSelected = currentSel.includes(index);
                                        return (
                                            <button
                                                key={answer.text}
                                                className={`btn ${isSelected ? "selected" : ""}`}
                                                style={answer.text === "None / No restrictions" ? { borderStyle: "dashed" } : {}}
                                                onClick={() => handleMultiSelect(index, answer.text)}
                                            >
                                                {answer.text}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* STANDARD SINGLE-SELECT TYPE */}
                            {!currentQuestion.type && (
                                currentQuestion.answers.map((answer, index) => (
                                    <button
                                        key={answer.text}
                                        className={`btn ${selectedAnswers[currentQuestionIndex] === index ? "selected" : ""}`}
                                        onClick={() => handleSelectOption(index)}
                                    >
                                        {answer.text}
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="quiz-nav">
                            {currentQuestionIndex > 0 && (
                                <button id="back-btn" onClick={handleBack}>Back</button>
                            )}
                            {isNextEnabled() && (
                                <button id="next-btn" onClick={handleNext}>Next</button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <h2 id="question">Assessment Complete!</h2>
                        <div id="answer-buttons">
                            <p style={{ fontSize: "16px", color: "#001e4d", marginTop: "10px" }}>
                                Thank you for sharing your preferences! We are building your customized travel plan.
                            </p>
                        </div>
                        <div className="quiz-nav">
                            <button
                                id="next-btn"
                                className="recommendations-btn"
                                style={{ display: "block" }}
                                onClick={restartQuiz}
                            >
                                See my Recommendations!
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default TravelQuiz;