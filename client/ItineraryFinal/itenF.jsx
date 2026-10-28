document.addEventListener("DOMContentLoaded", () => {
    const cover = document.getElementById("journalCover");
    const mainJournal = document.getElementById("journalOpen");

    const pages = {
        morning: document.getElementById("morningJournal"),
        evening: document.getElementById("eveningJournal"),
        dinner: document.getElementById("dinnerJournal"),
        night: document.getElementById("nightJournal")
    };

    const allJournals = [
        mainJournal,
        ...Object.values(pages)
    ];

    function showJournal(selectedJournal) {
        cover.classList.add("hidden");

        allJournals.forEach((journal) => {
            journal.classList.add("hidden");
        });

        selectedJournal.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    cover.classList.remove("hidden");

    allJournals.forEach((journal) => {
        journal.classList.add("hidden");
    });

    cover.addEventListener("click", () => {
        showJournal(mainJournal);
    });

    cover.setAttribute("tabindex", "0");

    cover.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showJournal(mainJournal);
        }
    });

    const polaroidLinks = [
        { selector: ".polaroid-1", page: pages.morning },
        { selector: ".polaroid-2", page: pages.evening },
        { selector: ".polaroid-3", page: pages.dinner },
        { selector: ".polaroid-4", page: pages.night }
    ];

    polaroidLinks.forEach(({ selector, page }) => {
        const polaroid = mainJournal.querySelector(selector);

        if (!polaroid) return;

        const openPage = () => showJournal(page);

        polaroid.addEventListener("click", openPage);

        polaroid.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPage();
            }
        });
    });

    document.querySelectorAll("[data-back]").forEach((button) => {
        button.addEventListener("click", () => {
            showJournal(mainJournal);
        });
    });

    const placeDetails = {
        "Pinang Peranakan Mansion": {
            activity:
                "Step back in time inside a beautifully decorated heritage mansion showcasing Peranakan antiques, intricate woodwork, traditional furnishings, and Straits Chinese culture.",
            rating: "4.5 ★",
            cost: "$10 estimated",
            hours: "9:30 AM – 5:30 PM",
            tip:
                "Arrive near opening time to explore the exhibits before the busier part of the day. Allow time to admire the intricate interior details and take photographs.",
            address:
                "29, Church Street, George Town, Penang, Malaysia"
        },

        "Leong San Tong Khoo Kongsi": {
            activity:
                "Discover one of Penang's most impressive Chinese clan houses, famous for its elaborate roof decorations, ornate carvings, traditional architecture, and cultural history.",
            rating: "4.4 ★",
            cost: "$5 estimated",
            hours: "9:00 AM – 5:00 PM",
            tip:
                "Spend some time in the main courtyard to appreciate the detailed architecture. Bring a camera to capture the decorative roof and stone carvings.",
            address:
                "18, Cannon Square, George Town, Penang, Malaysia"
        }
    };

    const modal = document.getElementById("details-modal");
    const modalTitle = document.getElementById("details-title");
    const detailsContent = document.getElementById("details-content");
    const closeButton = document.getElementById("close-details");
    const doneButton = document.getElementById("modal-done");

    if (!modal || !modalTitle || !detailsContent || !closeButton) {
        console.warn(
            "Details modal elements are missing. Add the modal HTML to itenF.html."
        );
        return;
    }

    let previousButton = null;

    function openModal(placeName, triggerButton) {
        const place = placeDetails[placeName];

        if (!place) {
            console.warn("No details found for:", placeName);
            return;
        }

        previousButton = triggerButton;

        modalTitle.textContent = placeName;
        detailsContent.replaceChildren();

        const description = document.createElement("p");
        description.className = "details-activity";
        description.textContent = place.activity;
        detailsContent.appendChild(description);

        const information = [
            ["Rating", place.rating, "details-rating"],
            ["Estimated cost", place.cost, "details-cost"],
            ["Opening hours", place.hours, "details-hours"],
            ["Travel tip", place.tip, "details-tip"],
            ["Address", place.address, "details-address"]
        ];

        information.forEach(([label, value, className]) => {
            const item = document.createElement("div");
            item.className = `details-item ${className}`;

            const heading = document.createElement("strong");
            heading.textContent = label;

            const text = document.createElement("span");
            text.textContent = value;

            item.append(heading, text);
            detailsContent.appendChild(item);
        });

        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        closeButton.focus();
    }

    function closeModal() {
        if (modal.classList.contains("hidden")) return;

        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");

        if (previousButton && previousButton.isConnected) {
            previousButton.focus();
        }

        previousButton = null;
    }

    document.querySelectorAll(".details-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const placeName = button.dataset.place;
            openModal(placeName, button);
        });
    });

    closeButton.addEventListener("click", closeModal);

    if (doneButton) {
        doneButton.addEventListener("click", closeModal);
    }

    // Clicking outside the pop-up closes it
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Escape key closes the pop-up
    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            !modal.classList.contains("hidden")
        ) {
            closeModal();
        }
    });
});
