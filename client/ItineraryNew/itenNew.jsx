document.addEventListener("DOMContentLoaded", () => {

    // =========================
    // ITINERARY DAY DROPDOWNS
    // =========================

    const days = document.querySelectorAll(".day-section");

    days.forEach((day) => {
        const dayButton = day.querySelector(".day-dropdown");
        const dayContent = day.querySelector(".day-content");

        dayButton.addEventListener("click", () => {
            const isExpanded =
                dayButton.getAttribute("aria-expanded") === "true";

            days.forEach((otherDay) => {
                otherDay.querySelector(".day-dropdown")
                    .setAttribute("aria-expanded", "false");

                otherDay.querySelector(".day-content").hidden = true;
            });

            if (!isExpanded) {
                dayButton.setAttribute("aria-expanded", "true");
                dayContent.hidden = false;
            }
        });
    });


    // =========================
    // MODAL ELEMENTS
    // =========================

    const openButton = document.getElementById("open-details");
    const modalContainer = document.getElementById("details-modal");
    const closeButton = document.getElementById("close-details");
    const modalTitle = document.getElementById("details-title");
    const detailsContent = document.getElementById("details-content");

    if (!modalContainer || !closeButton || !modalTitle || !detailsContent) {
        return;
    }

    let previousButton = null;


    // =========================
    // PLACE INFORMATION
    // =========================

    const placeDetails = {
        // =========================
        // DAY 1
        // =========================

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

        // =========================
        // DAY 2
        // =========================

        "Fort Cornwallis": {
            activity: "Explore Malaysia's largest standing colonial fort with historic ramparts, old bronze cannons, and exhibition displays.",
            rating: "3.5 ★",
            cost: "$5",
            hours: "9:00 AM – 6:00 PM",
            tip: "Walk the outer perimeter walls for a clear view of the adjacent lighthouse and waterfront promenade.",
            address: "4, Jalan Tun Syed Sheh Barakbah, George Town, 10200 George Town, Pulau Pinang, Malaysia"
        },

        "Market Street": {
            activity: "Immerse yourself in the vibrant sights, sounds, and aromatic spices of George Town's historic mercantile district.",
            rating: "4.6 ★",
            cost: "Free",
            hours: "Open 24 hours",
            tip: "Keep your camera ready for candid street portraits and colorful textile storefronts.",
            address: "52, Lebuh Pasar, George Town, 10200 George Town, Pulau Pinang, Malaysia"
        },

        "Penang Hill": {
            activity: "Ascend to Penang's highest peak via funicular railway for cool air, panoramic island views, and heritage bungalows.",
            rating: "4.4 ★",
            cost: "$15",
            hours: "6:30 AM – 11:00 PM",
            tip: "Book a fast-track ticket if available to bypass weekend afternoon queues at the lower station.",
            address: "Penang Hill, Bukit Bendera, 11300 Bukit Bendera, Penang, Malaysia"
        },

        "Gurney Drive Hawker Center": {
            activity: "Savor an expansive selection of iconic Malaysian street dishes right by the breezy coastline.",
            rating: "3.8 ★",
            cost: "$10–$15",
            hours: "3:00 PM – 12:00 AM",
            tip: "Try local pasembur and fresh sugarcane juice while enjoying the open-air hawker atmosphere.",
            address: "172, Solok Gurney 1, Pulau Tikus, 10250 Jelutong, Pulau Pinang, Malaysia"
        },

        "Pasar Malam Batu Feringghi": {
            activity: "Browse the vibrant beachside night market offering handicrafts, souvenirs, and late-night local treats.",
            rating: "3.8 ★",
            cost: "Varies",
            hours: "7:00 PM – 11:00 PM",
            tip: "Haggling is customary and friendly here, so don't be afraid to bargain gently.",
            address: "Jalan Pantai Batu, Taman Pantai Batu, 11200 Tanjong Bungah, Pulau Pinang, Malaysia"
        },

        // =========================
        // DAY 3
        // =========================

        "Georgetown UNESCO Historic Site": {
            activity: "Wander through the protected core zone to discover centuries-old shophouses, temples, and street art murals.",
            rating: "4.4 ★",
            cost: "Free",
            hours: "9:00 AM – 5:00 PM",
            tip: "Pick up a physical heritage trail map at your start point to locate hidden alleyways.",
            address: "159, Lbh Chulia, George Town, 10200 George Town, Pulau Pinang, Malaysia"
        },

        "George Town World Heritage Incorporated": {
            activity: "Dive deeper into conservation efforts and historical exhibitions detailing multicultural architecture preservation.",
            rating: "4.5 ★",
            cost: "Free",
            hours: "9:00 AM – 5:00 PM",
            tip: "An excellent air-conditioned stop to escape the midday tropical heat.",
            address: "116 & 118, Lbh Acheh, George Town, 10200 George Town, Pulau Pinang, Malaysia"
        },

        "Kimberley Street Duck Kway Chap": {
            activity: "Enjoy a comforting bowl of flat rice noodle sheets drenched in rich dark herbal broth with braised duck and pork.",
            rating: "3.9 ★",
            cost: "$5–$8",
            hours: "1:00 PM – 10:00 PM",
            tip: "A legendary stall among locals; be prepared to wait briefly during peak dinner hours.",
            address: "135, Lebuh Kimberley, George Town, 10100 George Town, Pulau Pinang, Malaysia"
        },

        "Kimberley Street Food Night Market": {
            activity: "Sample late-night hawker specialties and traditional desserts under the glow of roadside street lamps.",
            rating: "4.0 ★",
            cost: "$5–$10",
            hours: "5:00 PM – 11:00 PM",
            tip: "Save room for traditional Chinese sweet soups or crispy local pastry snacks.",
            address: "1, Jalan Sungai Ujong, George Town, 10100 George Town, Pulau Pinang, Malaysia"
        },

        // =========================
        // DAY 4
        // =========================

        "Georgetown Heritage Site": {
            activity: "Explore additional historic pockets and cultural clan houses tucked away in the commercial quarters.",
            rating: "4.8 ★",
            cost: "Varies",
            hours: "Open access",
            tip: "Wear comfortable walking shoes as you navigate sidewalks and old five-foot ways.",
            address: "30, Lbh Acheh, George Town, 10300 George Town, Pulau Pinang, Malaysia"
        },

        "Muar Chee (Cecil Street)": {
            activity: "Indulge in freshly made, sticky glutinous rice bites generously coated in crushed peanuts and sugar.",
            rating: "4.1 ★",
            cost: "$3",
            hours: "11:00 AM – 4:30 PM",
            tip: "Watch the vendor skillfully chop and tumble the warm muar chee.",
            address: "Lebuh Cecil, 10300 George Town, Pulau Pinang, Malaysia"
        },

        "Pulau Tikus Hawker Center": {
            activity: "Dine like a local with phenomenal Hokkien mee, laksa, and popiah.",
            rating: "4.0 ★",
            cost: "$8–$12",
            hours: "5:00 PM – 10:00 PM",
            tip: "Arrive around 6:00 PM to secure a table before the evening dinner rush.",
            address: "Jalan Burma, Pulau Tikus, 10350 George Town, Pulau Pinang, Malaysia"
        },

        "New Lane Street Foodstalls": {
            activity: "Wrap up your evening with late-night street snacks and ice-cold drinks in an energetic open-air alley.",
            rating: "3.8 ★",
            cost: "$10–$15",
            hours: "4:00 PM – 11:00 PM",
            tip: "A great spot to try charcoal-grilled chicken wings and local fruit juices.",
            address: "Lorong Baru, 10450 George Town, Pulau Pinang, Malaysia"
        },

        // =========================
        // DAY 5
        // =========================

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


    // =========================
    // MODAL FUNCTIONS
    // =========================

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


    // =========================
    // DISPLAY PLACE DETAILS
    // =========================

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


    // =========================
    // PAGE-LEVEL DETAILS BUTTON
    // =========================

    if (openButton) {
        openButton.addEventListener("click", () => {
            detailsContent.replaceChildren();

            const message = document.createElement("p");
            message.textContent =
                "Select a place's Details button to view its activity, rating, cost, hours, tip, and address.";

            detailsContent.appendChild(message);

            openModal("Trip Details", openButton);
        });
    }


    // =========================
    // INDIVIDUAL PLACE BUTTONS
    // =========================

    document.querySelectorAll(".place-details-button").forEach((button) => {
        button.addEventListener("click", () => {
            showPlaceDetails(button.dataset.place, button);
        });
    });


    // =========================
    // CLOSE MODAL
    // =========================

    closeButton.addEventListener("click", closeModal);

    modalContainer.addEventListener("click", (event) => {
        if (event.target === modalContainer) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            modalContainer.classList.contains("show")
        ) {
            closeModal();
        }
    });

});