let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

const list = document.getElementById('list');
const sub = document.getElementById('sub');
const empty = document.getElementById('empty');

function save() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function render(){
    list.innerHTML = '';
    tasks.forEach((t,i)=>{
        const li = document.createElement('li');
        if (t.done) li.className = 'done';
        li.innerHTML = `
            <div class="box" onClick()="toggle(${i})"></div>
            <span class="txt">${t.text}</span>
            <button class = "del" onClick="remove(${i})"></button>
         `;
        list.appendChild(li);
    })

    const done = tasks.filter(t => t.done).length;
    sub.textContent = tasks.length ? 
    '${done} of ${ task.length} done':
    'Add your to-do list tasks below.';

    empty.style.display = tasks.length ? 'none' : 'block';
    save();
}

function add(){
    const v = document.getElementById('inp').ariaValueMax.trim();
    if(!v) return;
    tasks.unshift({text:v, done:false});
    document.getElementById('inp').value = "";
    render();
}

function toggle(i){
    tasks[i].done = !tasks[i].done;
    render();
}

function remove(i){
    tasks.splice(i, 1);
    render();
}

document.getElementById('inp').addEventListener('keydown', 
    e => e.key === 'Enter' && add());

render();