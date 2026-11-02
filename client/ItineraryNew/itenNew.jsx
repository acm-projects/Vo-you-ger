/**
 * client/ItineraryNew/itenNew.jsx
 *
 * Dynamic Itinerary Controller and View Renderer.
 *
 * Capabilities:
 * 1. Checks sessionStorage for "voyager_itinerary" generated via POST /api/itinerary/generate.
 * 2. If present, dynamically renders the personalized multi-day itinerary:
 *    - Updates page header and document title to match the destination trip title.
 *    - Renders day sections, accordion dropdowns, and time slot groupings (Morning, Afternoon, Evening, Late Night).
 *    - Populates activity cards with venue titles, operating hours, price tiers, ratings, and imagery.
 *    - Populates the right-hand scrapbook panel with destination-specific practical travel guidance
 *      (languages, currency, cultural tips, transit tips, and payment methods).
 *    - Builds dynamic venue details for modal inspection (rating, cost, hours, travel tips, and address).
 * 3. Graceful Fallback: If no generated itinerary is in sessionStorage, falls back to the static Penang
 *    guide so standalone navigation, previews, and manual testing continue to function seamlessly.
 */

document.addEventListener("DOMContentLoaded", () => {

    // =========================================================================
    // Chunk 1: Modal DOM References & State
    // Cached elements for displaying detailed venue insights in an accessible modal dialog.
    // =========================================================================

    const openButton = document.getElementById("open-details");
    const modalContainer = document.getElementById("details-modal");
    const closeButton = document.getElementById("close-details");
    const modalTitle = document.getElementById("details-title");
    const detailsContent = document.getElementById("details-content");

    if (!modalContainer || !closeButton || !modalTitle || !detailsContent) {
        console.warn("Modal elements missing from DOM; aborting itinerary setup.");
        return;
    }

    let previousButton = null;


    // =========================================================================
    // Chunk 2: Fallback Penang Place Details Map
    // Retained for graceful degradation if the user opens the page without taking the quiz.
    // =========================================================================

    const fallbackPlaceDetails = {
        "Pinang Peranakan Mansion": {
            activity: "Step back in time inside this lavishly restored 19th-century mansion featuring Peranakan antiques, intricate woodwork, and Straits Chinese history.",
            rating: "4.5 ★",
            cost: "$10",
            hours: "9:30 AM – 5:30 PM",
            tip: "Arrive right at 9:30 AM to beat mid-morning tour groups and enjoy peaceful photo opportunities.",
            address: "29, Church St, Georgetown, 10200 George Town, Penang, Malaysia"
        },
        "Leong San Tong Khoo Kongsi": {
            activity: "Marvel at one of Southeast Asia's most magnificent Chinese clan clubhouses featuring breathtaking dragons and intricate stone carvings.",
            rating: "4.4 ★",
            cost: "$5",
            hours: "9:00 AM – 5:00 PM",
            tip: "Take your time in the main courtyard to admire the ornate roof decorations and historical exhibition halls.",
            address: "18, Cannon Square, George Town, 10450 George Town, Pulau Pinang, Malaysia"
        },
        "Clan Jetties of Penang": {
            activity: "Stroll down historical wooden piers over the water where traditional Chinese waterfront communities live and trade.",
            rating: "4.2 ★",
            cost: "Free",
            hours: "9:00 AM – 9:00 PM",
            tip: "Chew Jetty is the most famous and bustling, offering local snacks and harbor views.",
            address: "Pengkalan Weld, George Town, 10300 George Town, Pulau Pinang, Malaysia"
        },
        "Queen Victoria Memorial Clock Tower": {
            activity: "Admire this striking 60-foot Moorish-influenced clock tower built in 1897, standing as a proud colonial landmark.",
            rating: "4.2 ★",
            cost: "Free",
            hours: "Open 24 hours",
            tip: "A great spot for photos against the backdrop of the modern harbor and historic Esplanade.",
            address: "Lebuh Light, George Town, 10450 George Town, Pulau Pinang, Malaysia"
        },
        "Chulia Street Hawker Food": {
            activity: "Dive into Penang's street food scene tasting favorites like char koay teow, wonton mee, and duck rice.",
            rating: "4.1 ★",
            cost: "$5–$10",
            hours: "4:00 PM – 12:00 AM",
            tip: "Seating is informal and shared; grab a table first before ordering from curbside carts.",
            address: "Lbh Chulia, George Town, 10450 George Town, Pulau Pinang, Malaysia"
        },
        "Love Lane": {
            activity: "Experience George Town's nightlife hub by hopping between vibrant bars, atmospheric cafes, and live music spots.",
            rating: "4.2 ★",
            cost: "$15–$25",
            hours: "Best visited after 10:00 PM",
            tip: "The lane comes alive after 10:00 PM with locals and travelers mingling under glowing fairy lights.",
            address: "74, Love Ln, Georgetown, 10200 George Town, Penang, Malaysia"
        },
        "Fort Cornwallis": {
            activity: "Explore Malaysia's largest standing colonial fort with historic ramparts, old bronze cannons, and exhibition displays.",
            rating: "3.5 ★",
            cost: "$5",
            hours: "9:00 AM – 6:00 PM",
            tip: "Visit late afternoon to catch breezes coming off the Malacca Strait.",
            address: "Jalan Tun Syed Sheh Barakbah, 10200 George Town, Pulau Pinang, Malaysia"
        },
        "Chew Jetty": {
            activity: "Take a final morning walk along picturesque wooden walkways to soak in tranquil harbor views.",
            rating: "4.1 ★",
            cost: "Free",
            hours: "9:00 AM – 9:00 PM",
            tip: "Morning is the quietest time to photograph rustic water-village houses before crowds arrive.",
            address: "George Town, 10300 George Town, Penang, Malaysia"
        },
        "Kompleks Makanan Padang Brown": {
            activity: "Sample a diverse variety of classic local delicacies and comforting hawker dishes for a midday feast.",
            rating: "4.0 ★",
            cost: "$5–$10",
            hours: "12:00 PM – 11:00 PM",
            tip: "Try local favorites like sotong kangkung or fresh popiah.",
            address: "Jln Perak, 10400 George Town, Pulau Pinang, Malaysia"
        },
        "Presgrave Street Hawker Centre": {
            activity: "Enjoy a stellar final dinner featuring famed Penang fried oyster omelets, char koay kak, and savory broths.",
            rating: "4.2 ★",
            cost: "$10–$15",
            hours: "4:00 PM – 10:00 PM",
            tip: "Look for the busiest stalls inside; lines here are a reliable indicator of exceptional taste.",
            address: "67D, Lebuh Presgrave, 10300 George Town, Pulau Pinang, Malaysia"
        },
        "Farlim Wednesday Night Market": {
            activity: "Explore one of Penang's largest night markets filled with street snacks, clothes, and community chatter.",
            rating: "4.0 ★",
            cost: "$5–$15",
            hours: "4:00 PM – 11:00 PM (Wednesdays only)",
            tip: "A fantastic, authentic spot away from tourist hubs to enjoy final street food bites.",
            address: "49, Medan Angsana, Bandar Baru Air Itam, 11500 Ayer Itam, Pulau Pinang, Malaysia"
        }
    };

    // Mutable place details registry populated dynamically with venue details
    const placeDetails = { ...fallbackPlaceDetails };


    // =========================================================================
    // Chunk 3: Modal Control Functions
    // Accessible dialog lifecycle handlers for opening, closing, and keyboard trapping.
    // =========================================================================

    function openModal(title, triggerButton) {
        previousButton = triggerButton || openButton;
        modalTitle.textContent = title;
        modalContainer.classList.add("show");
        modalContainer.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        closeButton.focus();
    }

    function closeModal() {
        modalContainer.classList.remove("show");
        modalContainer.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        if (previousButton) {
            previousButton.focus();
        }
    }

    function showPlaceDetails(placeName, button) {
        const place = placeDetails[placeName];
        detailsContent.replaceChildren();

        if (!place) {
            const message = document.createElement("p");
            message.textContent = "Details have not been added for this location yet.";
            detailsContent.appendChild(message);
        } else {
            const activity = document.createElement("p");
            activity.className = "details-activity";
            activity.textContent = place.activity;
            detailsContent.appendChild(activity);

            const information = [
                ["Rating", place.rating],
                ["Cost", place.cost],
                ["Hours", place.hours],
                ["Tip", place.tip],
                ["Address", place.address]
            ];

            information.forEach(([label, value]) => {
                const item = document.createElement("p");
                item.className = "details-item";

                const heading = document.createElement("strong");
                heading.textContent = label + ": ";

                const text = document.createElement("span");
                text.textContent = value;

                item.append(heading, text);
                detailsContent.appendChild(item);
            });
        }

        openModal(placeName, button);
    }


    // =========================================================================
    // Chunk 4: Helper Functions for Dynamic Rendering
    // Formatting operating hours, activity images, and slot iconography.
    // =========================================================================

    // Time slot icon and title configuration
    const SLOT_CONFIG = {
        morning: { icon: "☀️", label: "Morning" },
        afternoon: { icon: "🌤️", label: "Afternoon" },
        evening: { icon: "🍽️", label: "Evening · Dinner" },
        lateNight: { icon: "🌃", label: "Late Night" }
    };

    /**
     * Resolves the best available image URL for an activity card thumbnail.
     * Hierarchy: direct activity photo -> selected destination hero image -> themed Unsplash stock image.
     */
    function resolveActivityImage(activity, destinationImage, slot) {
        if (activity.photoUrl) return activity.photoUrl;
        if (activity.imageUrl) return activity.imageUrl;
        if (activity.photo?.url) return activity.photo.url;
        if (destinationImage) return destinationImage;

        const category = (activity.category || "").toLowerCase();
        if (category.includes("food") || category.includes("restaurant") || slot === "evening") {
            return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80";
        }
        if (category.includes("culture") || category.includes("museum") || category.includes("historic") || category.includes("temple")) {
            return "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=400&q=80";
        }
        if (category.includes("nature") || category.includes("park") || category.includes("outdoor")) {
            return "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80";
        }
        if (slot === "lateNight") {
            return "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80";
        }
        return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=400&q=80";
    }

    /**
     * Formats operating hours string from Google Places data.
     */
    function formatHours(activity) {
        if (activity.openingHours) {
            if (Array.isArray(activity.openingHours)) return activity.openingHours[0] || "Open daily";
            return String(activity.openingHours);
        }
        if (activity.hours) return String(activity.hours);
        if (activity.openNow != null) return activity.openNow ? "Open Now" : "Hours vary";
        return "Check operating hours";
    }


    // =========================================================================
    // Chunk 5: Dynamic Itinerary Population from SessionStorage
    // Reads JSON returned from POST /api/itinerary/generate and builds the DOM.
    // =========================================================================

    let activeItinerary = null;
    let selectedDestData = null;

    try {
        const cachedItinerary = sessionStorage.getItem("voyager_itinerary");
        if (cachedItinerary) {
            activeItinerary = JSON.parse(cachedItinerary);
        }
        const cachedDest = sessionStorage.getItem("selectedDestination");
        if (cachedDest) {
            selectedDestData = JSON.parse(cachedDest);
        }
    } catch (err) {
        console.warn("Could not parse cached itinerary or destination from sessionStorage:", err);
    }

    if (activeItinerary && Array.isArray(activeItinerary.days) && activeItinerary.days.length > 0) {
        // Step A: Update Page Title and Document Title
        const pageTitle = document.querySelector(".page-title");
        const displayTitle = activeItinerary.tripTitle || `${activeItinerary.destination || "Personalized"} Itinerary`;
        if (pageTitle) {
            pageTitle.textContent = displayTitle;
        }
        document.title = `${displayTitle} - Voyager`;

        // Step B: Update Practical Information Sidebar (Right Boxes)
        if (activeItinerary.practicalInfo) {
            const travelInfoText = document.querySelector(".travel-info-text");
            if (travelInfoText) {
                travelInfoText.replaceChildren();
                const pInfo = activeItinerary.practicalInfo;

                // Languages Spoken
                if (pInfo.languages) {
                    const h4 = document.createElement("h4");
                    h4.textContent = "Languages Spoken";
                    const p = document.createElement("p");
                    p.textContent = Array.isArray(pInfo.languages) ? pInfo.languages.join(" | ") : String(pInfo.languages);
                    travelInfoText.append(h4, p);
                }

                // Currency
                if (pInfo.currency) {
                    const h4 = document.createElement("h4");
                    h4.textContent = "Currency";
                    const p = document.createElement("p");
                    if (typeof pInfo.currency === "object") {
                        p.textContent = `${pInfo.currency.name || ""} (${pInfo.currency.code || ""}${pInfo.currency.symbol ? " / " + pInfo.currency.symbol : ""})`;
                    } else {
                        p.textContent = String(pInfo.currency);
                    }
                    travelInfoText.append(h4, p);
                }

                // Cultural Tips
                if (Array.isArray(pInfo.culturalTips) && pInfo.culturalTips.length > 0) {
                    const h4 = document.createElement("h4");
                    h4.textContent = "Cultural Tips";
                    const ul = document.createElement("ul");
                    pInfo.culturalTips.forEach((tip) => {
                        const li = document.createElement("li");
                        li.textContent = tip;
                        ul.appendChild(li);
                    });
                    travelInfoText.append(h4, ul);
                }

                // Transit Tips
                if (Array.isArray(pInfo.transitTips) && pInfo.transitTips.length > 0) {
                    const h4 = document.createElement("h4");
                    h4.textContent = "Transit Tips";
                    const ul = document.createElement("ul");
                    pInfo.transitTips.forEach((tip) => {
                        const li = document.createElement("li");
                        li.textContent = tip;
                        ul.appendChild(li);
                    });
                    travelInfoText.append(h4, ul);
                }

                // Payment Advice
                if (Array.isArray(pInfo.paymentMethods) && pInfo.paymentMethods.length > 0) {
                    const h4 = document.createElement("h4");
                    h4.textContent = "Payment | Cash Advice";
                    const ul = document.createElement("ul");
                    pInfo.paymentMethods.forEach((item) => {
                        const li = document.createElement("li");
                        li.textContent = item;
                        ul.appendChild(li);
                    });
                    travelInfoText.append(h4, ul);
                }
            }
        }

        // Step C: Build Dynamic Itinerary Days DOM inside .itinerary-inner
        const itineraryInner = document.querySelector(".itinerary-inner");
        if (itineraryInner) {
            // Remove existing static day sections while preserving or re-adding header
            itineraryInner.replaceChildren();

            const heading = document.createElement("h2");
            heading.textContent = "Itinerary:";
            itineraryInner.appendChild(heading);

            // Populate each day accordion
            activeItinerary.days.forEach((dayData, dayIndex) => {
                const isFirstDay = dayIndex === 0;

                const daySection = document.createElement("section");
                daySection.className = "day-section";

                // Day dropdown accordion trigger
                const dayButton = document.createElement("button");
                dayButton.className = "day-dropdown";
                dayButton.type = "button";
                dayButton.setAttribute("aria-expanded", isFirstDay ? "true" : "false");

                const arrowSpan = document.createElement("span");
                arrowSpan.className = "arrow";
                arrowSpan.textContent = "⌄";

                const dayLabelSpan = document.createElement("span");
                const dayDateLabel = dayData.dayOfWeek && dayData.date
                    ? `Day ${dayData.day} · ${dayData.dayOfWeek}, ${dayData.date}`
                    : `Day ${dayData.day}`;
                dayLabelSpan.textContent = dayDateLabel;

                dayButton.append(arrowSpan, dayLabelSpan);
                daySection.appendChild(dayButton);

                // Day content container
                const dayContent = document.createElement("div");
                dayContent.className = "day-content";
                dayContent.hidden = !isFirstDay;

                // Day Theme summary
                const dayTheme = document.createElement("p");
                dayTheme.className = "day-theme";
                dayTheme.textContent = dayData.theme || dayData.locationName || `Day ${dayData.day} Exploration`;
                dayContent.appendChild(dayTheme);

                // Iterate through slots: morning, afternoon, evening, lateNight
                ["morning", "afternoon", "evening", "lateNight"].forEach((slotKey) => {
                    const activities = dayData[slotKey];
                    if (!Array.isArray(activities) || activities.length === 0) return;

                    const slotMeta = SLOT_CONFIG[slotKey] || { icon: "📍", label: slotKey };

                    const timeSection = document.createElement("section");
                    timeSection.className = "time-section";

                    const timeHeading = document.createElement("div");
                    timeHeading.className = "time-heading";

                    const timeIcon = document.createElement("span");
                    timeIcon.className = "time-icon";
                    timeIcon.textContent = slotMeta.icon;

                    const timeLabel = document.createElement("span");
                    timeLabel.className = "time-label";
                    timeLabel.textContent = slotMeta.label;

                    const timeLine = document.createElement("span");
                    timeLine.className = "time-line";

                    timeHeading.append(timeIcon, timeLabel, timeLine);
                    timeSection.appendChild(timeHeading);

                    // Activity card grid
                    const activityGrid = document.createElement("div");
                    activityGrid.className = "activity-grid";

                    activities.forEach((act) => {
                        const venueName = act.placeName || act.name || "Featured Attraction";

                        // Register place details in the map for modal popups
                        placeDetails[venueName] = {
                            activity: act.activityDescription || act.description || "Explore this highlight tailored to your trip style.",
                            rating: act.rating ? `${act.rating} ★` : "4.5 ★",
                            cost: act.estimatedCost || act.cost || "Varies",
                            hours: formatHours(act),
                            tip: act.travelTip || act.tip || "Arrive early to make the most of your visit.",
                            address: act.address || (act.category ? `Category: ${act.category}` : "Destination base area")
                        };

                        const card = document.createElement("article");
                        card.className = "activity-card";

                        const img = document.createElement("img");
                        img.src = resolveActivityImage(act, selectedDestData?.imageUrl, slotKey);
                        img.alt = venueName;

                        const info = document.createElement("div");
                        info.className = "activity-info";

                        const h3 = document.createElement("h3");
                        h3.textContent = venueName;

                        const metaP = document.createElement("p");
                        const hoursSnippet = formatHours(act);
                        const costSnippet = act.estimatedCost || act.cost || "$10";
                        metaP.textContent = `${hoursSnippet} · ${costSnippet}`;

                        const ratingP = document.createElement("p");
                        ratingP.textContent = `Rating: ${act.rating ? act.rating + " ★" : "4.5 ★"}`;

                        info.append(h3, metaP, ratingP);

                        const detailsBtn = document.createElement("button");
                        detailsBtn.type = "button";
                        detailsBtn.className = "place-details-button";
                        detailsBtn.dataset.place = venueName;
                        detailsBtn.textContent = "Details";

                        card.append(img, info, detailsBtn);
                        activityGrid.appendChild(card);
                    });

                    timeSection.appendChild(activityGrid);
                    dayContent.appendChild(timeSection);
                });

                daySection.appendChild(dayContent);
                itineraryInner.appendChild(daySection);
            });
        }
    }


    // =========================================================================
    // Chunk 6: Event Listeners Binding
    // Wires interactive accordion collapses and modal detail triggers.
    // Works uniformly for both dynamically rendered itineraries and fallback mock data.
    // =========================================================================

    // A: Bind Accordion Day Dropdown Toggles
    const days = document.querySelectorAll(".day-section");
    days.forEach((day) => {
        const dayButton = day.querySelector(".day-dropdown");
        const dayContent = day.querySelector(".day-content");

        if (dayButton && dayContent) {
            dayButton.addEventListener("click", () => {
                const isExpanded = dayButton.getAttribute("aria-expanded") === "true";

                // Collapse all other days for clean accordion single-view behavior
                days.forEach((otherDay) => {
                    const otherBtn = otherDay.querySelector(".day-dropdown");
                    const otherContent = otherDay.querySelector(".day-content");
                    if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                    if (otherContent) otherContent.hidden = true;
                });

                if (!isExpanded) {
                    dayButton.setAttribute("aria-expanded", "true");
                    dayContent.hidden = false;
                }
            });
        }
    });

    // B: Bind Place Details Buttons
    document.querySelectorAll(".place-details-button").forEach((button) => {
        button.addEventListener("click", () => {
            showPlaceDetails(button.dataset.place, button);
        });
    });

    // C: Page-level Details Button (if present in header)
    if (openButton) {
        openButton.addEventListener("click", () => {
            detailsContent.replaceChildren();
            const message = document.createElement("p");
            message.textContent = "Select a place's Details button to view its activity, rating, cost, hours, tip, and address.";
            detailsContent.appendChild(message);
            openModal("Trip Details", openButton);
        });
    }

    // D: Modal Dismissal Handlers
    closeButton.addEventListener("click", closeModal);

    modalContainer.addEventListener("click", (event) => {
        if (event.target === modalContainer) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modalContainer.classList.contains("show")) {
            closeModal();
        }
    });

});