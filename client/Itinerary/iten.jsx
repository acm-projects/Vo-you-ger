document.addEventListener("DOMContentLoaded", () => {
    // =========================================================
    // 1. ITINERARY LOGIC
    // =========================================================
    document.querySelectorAll(".day-section").forEach((day) => {
        const dayButton = day.querySelector(".day-dropdown");
        const dayContent = day.querySelector(".day-content");
        const addButton = day.querySelector(".add-spot-toggle");
        const form = day.querySelector(".spot-form");
        const spotsList = day.querySelector(".spots-list");

        // Expand / collapse dates
        dayButton.addEventListener("click", () => {
            const expanded = dayButton.getAttribute("aria-expanded") === "true";
            dayButton.setAttribute("aria-expanded", String(!expanded));
            dayContent.hidden = expanded;
        });

        // Opens the add-spot block
        addButton.addEventListener("click", () => {
            form.hidden = !form.hidden;
            addButton.textContent = form.hidden ? "+ Add a spot" : "- Collapse";
        });

        // Cancel spot creation
        form.querySelector(".cancel-spot").addEventListener("click", () => {
            form.reset();
            form.hidden = true;
            addButton.textContent = "+ Add a spot";
        });

        // Save spot entry
        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const start = form.elements.startTime.value;
            const end = form.elements.endTime.value;
            const location = form.elements.location.value.trim();

            if (!start || !end || !location) return;

            if (end <= start) {
                alert("The end time must be later than the start time.");
                return;
            }

            const card = document.createElement("div");
            card.className = "saved-spot";

            const details = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = location;

            const time = document.createElement("p");
            time.textContent = `${start} - ${end}`;

            details.append(title, time);

            const removeButton = document.createElement("button");
            removeButton.className = "remove-spot";
            removeButton.textContent = "Remove";
            removeButton.type = "button";

            removeButton.addEventListener("click", () => {
                card.remove();
            });

            card.append(details, removeButton);
            spotsList.append(card);

            form.reset();
            form.hidden = true;
            addButton.textContent = "+ Add a spot";
        });
    });

    // =========================================================
    // 2. TO-DO LIST LOGIC
    // =========================================================
    let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

    const todoList = document.getElementById('todo-list');
    const todoSub = document.getElementById('todo-sub');
    const todoEmpty = document.getElementById('todo-empty');
    const todoInput = document.getElementById('todo-input');
    const todoAddBtn = document.getElementById('todo-add-btn');

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    function renderTasks() {
        todoList.innerHTML = '';
        
        tasks.forEach((t, i) => {
            const li = document.createElement('li');
            if (t.done) li.className = 'done';

            const box = document.createElement('div');
            box.className = 'box';
            box.addEventListener('click', () => toggleTask(i));

            const textSpan = document.createElement('span');
            textSpan.className = 'text';
            textSpan.textContent = t.text;

            const delBtn = document.createElement('button');
            delBtn.className = 'del';
            delBtn.innerHTML = '&times;';
            delBtn.addEventListener('click', () => removeTask(i));

            li.appendChild(box);
            li.appendChild(textSpan);
            li.appendChild(delBtn);
            todoList.appendChild(li);
        });

        const doneCount = tasks.filter(t => t.done).length;
        todoSub.textContent = tasks.length 
            ? `${doneCount} of ${tasks.length} done` 
            : 'Add your to-do list tasks below.';

        todoEmpty.style.display = tasks.length ? 'none' : 'block';
        saveTasks();
    }

    function addTask() {
        const val = todoInput.value.trim();
        if (!val) return;
        tasks.unshift({ text: val, done: false });
        todoInput.value = "";
        renderTasks();
    }

    function toggleTask(i) {
        tasks[i].done = !tasks[i].done;
        renderTasks();
    }

    function removeTask(i) {
        tasks.splice(i, 1);
        renderTasks();
    }

    todoAddBtn.addEventListener('click', addTask);
    todoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTask();
    });

    renderTasks();

    document.querySelectorAll(".recommended-add").forEach((button) => {
        button.addEventListener("click", () => {
            const placeCard = button.closest(".recommended-place");
            const placeName = placeCard.querySelector("span").textContent;

            // Use the first itinerary day
            const firstDay = document.querySelector(".day-section");

            if (!firstDay) return;

            const dayButton = firstDay.querySelector(".day-dropdown");
            const dayContent = firstDay.querySelector(".day-content");
            const addButton = firstDay.querySelector(".add-spot-toggle");
            const form = firstDay.querySelector(".spot-form");
            const locationInput = form.elements.location;

            // Expand the first day
            dayButton.setAttribute("aria-expanded", "true");
            dayContent.hidden = false;

            // Open the form
            form.hidden = false;
            addButton.textContent = "- Collapse";

            // Fill in the selected place
            locationInput.value = placeName;

            // Scroll to the form
            form.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            // Focus the start time
            form.elements.startTime.focus();
        });
    });
});