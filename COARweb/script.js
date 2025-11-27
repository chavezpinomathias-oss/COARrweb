// === Inicialización y LocalStorage (IndexedDB simulado con LocalStorage para simplicidad) ===
const STORAGE_KEYS = {
    tasks: 'coar_tasks_pro',
    events: 'coar_events_pro',
    pomodoro: 'coar_pomodoro_pro',
    resources: 'coar_resources_pro',
    schedule: 'coar_schedule_pro',
    progress: 'coar_progress_pro',
    darkMode: 'coar_darkmode_pro',
    zenMode: 'coar_zenmode_pro'
};

let state = {
    tasks: JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks)) || [],
    events: JSON.parse(localStorage.getItem(STORAGE_KEYS.events)) || {},
    pomodoroConfig: JSON.parse(localStorage.getItem(STORAGE_KEYS.pomodoro)) || { work: 25, break: 5, goal: 1.5 },
    resources: JSON.parse(localStorage.getItem(STORAGE_KEYS.resources)) || { videos: [], tips: [] },
    schedule: JSON.parse(localStorage.getItem(STORAGE_KEYS.schedule)) || getDefaultCoarSchedule(),
    progress: JSON.parse(localStorage.getItem(STORAGE_KEYS.progress)) || { daily: { date: today(), hours: 0 }, weekly: Array(7).fill(0), streak: 0 },
    timer: { interval: null, timeLeft: 0, isWorking: true, isPaused: true }
};

let currentDate = new Date();
let selectedDay = today();
let currentResourceTab = 'videos';

// Funciones utilitarias
function today() { return currentDate.toISOString().split('T')[0]; }
function saveState(key) { localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(state[key])); }
function updateDate() { document.getElementById('dashboard-date').textContent = currentDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    saveState('darkMode');
}
function toggleZenMode() {
    const zen = document.getElementById('zen-overlay');
    zen.classList.toggle('hidden');
    document.getElementById('zen-btn').classList.toggle('zen-active');
    if (!zen.classList.contains('hidden')) startZenTimer();
    saveState('zenMode');
}
function exitZenMode() { toggleZenMode(); }

// === Navegación ===
function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.target.classList.add('active');
    switch(id) {
        case 'dashboard': updateDashboard(); break;
        case 'tasks': renderTasks(); break;
        case 'calendar': renderCalendar(); break;
        case 'pomodoro': loadPomodoroConfig(); break;
        case 'resources': renderResources(); break;
    }
}

// === Dashboard ===
function updateDashboard() {
    updateDate();
    const dailyHours = state.progress.daily.hours;
    const goal = state.pomodoroConfig.goal;
    const perc = (dailyHours / goal) * 100;
    document.getElementById('daily-progress-path').style.strokeDasharray = `${(perc / 100) * 283} 283`;
    document.getElementById('daily-hours').textContent = dailyHours.toFixed(1) + 'h';
    document.getElementById('daily-goal-text').textContent = goal + 'h';
    document.getElementById('streak-count').textContent = state.progress.streak;

    // Gráfico semanal
    const weekly = state.progress.weekly;
    const totalWeekly = weekly.reduce((a, b) => a + b, 0);
    document.getElementById('weekly-total').textContent = totalWeekly.toFixed(1) + 'h';
    const chart = document.getElementById('weekly-chart');
    chart.innerHTML = '';
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((day, i) => {
        const bar = document.createElement('div');
        bar.style.height = (weekly[i] / Math.max(...weekly, 1) * 40) + 'px';
        bar.title = day + ': ' + weekly[i].toFixed(1) + 'h';
        chart.appendChild(bar);
    });

    const pending = state.tasks.filter(t => !t.completed).length;
    const completed = state.tasks.filter(t => t.completed).length;
    const todayEvents = state.events[today()]?.length || 0;
    document.getElementById('pending-tasks-dash').textContent = pending;
    document.getElementById('today-events-dash').textContent = todayEvents;
    document.getElementById('completed-tasks-dash').textContent = completed;
}

// === Tareas (con Drag & Drop) ===
function addTask() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    const task = {
        id: Date.now(),
        title,
        due: document.getElementById('task-due').value,
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value,
        completed: false,
        status: 'pending'
    };
    state.tasks.push(task);
    saveState('tasks');
    renderTasks();
    document.getElementById('task-title').value = '';
}
function renderTasks() {
    const filters = {
        status: document.getElementById('filter-status').value,
        priority: document.getElementById('filter-priority').value,
        category: document.getElementById('filter-category').value
    };
    const filtered = state.tasks.filter(t => 
        (filters.status === 'all' || t.status === filters.status) &&
        (filters.priority === 'all' || t.priority === filters.priority) &&
        (filters.category === 'all' || t.category === filters.category)
    );
    ['pending', 'in-progress', 'completed'].forEach(status => {
        const list = document.getElementById(`${status}-list`);
        list.innerHTML = '';
        filtered.filter(t => t.status === status).forEach(task => {
            const div = document.createElement('div');
            div.className = `task-item priority-${task.priority.toLowerCase()} ${task.category.toLowerCase()}`;
            div.draggable = true;
            div.ondragstart = (e) => e.dataTransfer.setData('text/plain', task.id);
            div.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})">
                <div>
                    <strong>${task.title}</strong>
                    ${task.due ? `<br><small>Vence: ${task.due}</small>` : ''}
                    <small>Categoría: ${task.category}</small>
                </div>
                <button class="danger" onclick="deleteTask(${task.id})">✕</button>
            `;
            if (task.due && new Date(task.due) < new Date() && !task.completed) div.style.borderLeftColor = 'var(--coar-alert)';
            list.appendChild(div);
        });
    });
    document.getElementById('total-tasks').textContent = state.tasks.length;
    document.getElementById('completed-tasks').textContent = state.tasks.filter(t => t.completed).length;
    document.getElementById('pending-tasks').textContent = state.tasks.filter(t => !t.completed).length;
}
function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    task.completed = !task.completed;
    task.status = task.completed ? 'completed' : 'in-progress';
    saveState('tasks');
    renderTasks();
    updateDashboard();
}
function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState('tasks');
    renderTasks();
}
function allowDrop(e) { e.preventDefault(); }
function drop(e) {
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.status = e.target.closest('.board').id.split('-')[0];
        saveState('tasks');
        renderTasks();
    }
}
function addQuickTask() {
    document.getElementById('task-title').value = 'Tarea rápida';
    addTask();
}

// === Calendario ===
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('current-month-year').textContent = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const grid = document.getElementById('calendar-days');
    grid.innerHTML = '<div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>'; // Headers
    const firstDay = new Date(year, month, 1).getDay() || 7; // Ajuste para lunes start
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i < firstDay; i++) grid.appendChild(document.createElement('div'));
    for (let day = 1; day <= daysInMonth; day++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.textContent = day;
        const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (state.events[dayKey]) div.classList.add('has-events');
        if (dayKey === today()) div.classList.add('today');
        div.onclick = () => selectDay(dayKey);
        grid.appendChild(div);
    }
    selectDay(today());
}
function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }
function selectDay(dayKey) {
    selectedDay = dayKey;
    document.getElementById('selected-day-title').textContent = `Eventos en ${new Date(dayKey).toLocaleDateString('es-ES')}`;
    const list = document.getElementById('event-list-day');
    list.innerHTML = '';
    const dayEvents = state.events[dayKey] || [];
    dayEvents.sort((a, b) => a.time.localeCompare(b.time));
    dayEvents.forEach((event, i) => {
        const div = document.createElement('div');
        div.className = 'event-item';
        div.innerHTML = `
            <div>
                <strong>${event.time} - ${event.title}</strong>
                <p>${event.desc}</p>
            </div>
            <button class="danger" onclick="deleteEvent('${dayKey}', ${i})">✕</button>
        `;
        list.appendChild(div);
    });
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
    event.target.classList.add('selected');
}
function addEvent() {
    const time = document.getElementById('event-time').value;
    const title = document.getElementById('event-title').value.trim();
    const desc = document.getElementById('event-desc').value.trim();
    if (time && title) {
        if (!state.events[selectedDay]) state.events[selectedDay] = [];
        state.events[selectedDay].push({ time, title, desc });
        saveState('events');
        renderCalendar();
        document.getElementById('event-title').value = '';
        document.getElementById('event-desc').value = '';
    }
}
function deleteEvent(dayKey, index) {
    state.events[dayKey].splice(index, 1);
    if (state.events[dayKey].length === 0) delete state.events[dayKey];
    saveState('events');
    selectDay(dayKey);
}

// === Pomodoro ===
function loadPomodoroConfig() {
    document.getElementById('work-duration').value = state.pomodoroConfig.work;
    document.getElementById('break-duration').value = state.pomodoroConfig.break;
    document.getElementById('daily-goal').value = state.pomodoroConfig.goal;
    updatePomodoroProgress();
}
function savePomodoroConfig() {
    state.pomodoroConfig.work = parseInt(document.getElementById('work-duration').value);
    state.pomodoroConfig.break = parseInt(document.getElementById('break-duration').value);
    state.pomodoroConfig.goal = parseFloat(document.getElementById('daily-goal').value);
    saveState('pomodoro');
    updatePomodoroProgress();
    updateDashboard();
}
function updatePomodoroProgress() {
    checkDailyReset();
    const hours = state.progress.daily.hours;
    const goal = state.pomodoroConfig.goal;
    const perc = (hours / goal) * 100;
    document.getElementById('pomodoro-progress-path').style.strokeDasharray = `${(perc / 100) * 283} 283`;
    document.getElementById('pomodoro-hours').textContent = hours.toFixed(1) + 'h';
    document.getElementById('pomodoro-goal-text').textContent = goal + 'h';
    document.getElementById('pomodoro-streak').textContent = state.progress.streak;
}
function checkDailyReset() {
    const todayStr = today();
    if (state.progress.daily.date !== todayStr) {
        const metGoal = state.progress.daily.hours >= state.pomodoroConfig.goal;
        state.progress.streak = metGoal ? state.progress.streak + 1 : 0;
        state.progress.daily = { date: todayStr, hours: 0 };
        // Actualizar semanal
        const dayOfWeek = new Date().getDay();
        state.progress.weekly[dayOfWeek - 1] += state.progress.daily.hours; // Ajuste si domingo es 0
        saveState('progress');
    }
}
function startTimer() {
    checkDailyReset();
    state.timer.timeLeft = (state.timer.isWorking ? state.pomodoroConfig.work : state.pomodoroConfig.break) * 60;
    state.timer.isPaused = false;
    document.getElementById('start-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;
    state.timer.interval = setInterval(tickTimer, 1000);
}
function pauseTimer() {
    state.timer.isPaused = true;
    clearInterval(state.timer.interval);
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
}
function resetTimer() {
    pauseTimer();
    state.timer.timeLeft = state.pomodoroConfig.work * 60;
    updateTimerDisplay();
}
function tickTimer() {
    state.timer.timeLeft--;
    updateTimerDisplay();
    if (state.timer.timeLeft <= 0) {
        if (state.timer.isWorking) {
            state.progress.daily.hours += state.pomodoroConfig.work / 60;
            saveState('progress');
            document.getElementById('work-end-sound').play();
            if (Notification.permission === 'granted') new Notification('¡Pomodoro completado!', { body: '¡Gran trabajo! Toma un descanso.' });
        } else {
            document.getElementById('break-end-sound').play();
            if (Notification.permission === 'granted') new Notification('¡Descanso terminado!', { body: '¡Vuelve al trabajo!' });
        }
        state.timer.isWorking = !state.timer.isWorking;
        state.timer.timeLeft = (state.timer.isWorking ? state.pomodoroConfig.work : state.pomodoroConfig.break) * 60;
        document.getElementById('start-btn').textContent = state.timer.isWorking ? '▶ Iniciar Trabajo' : '▶ Iniciar Descanso';
        updatePomodoroProgress();
        updateDashboard();
    }
}
function updateTimerDisplay() {
    const min = Math.floor(state.timer.timeLeft / 60);
    const sec = state.timer.timeLeft % 60;
    document.getElementById('timer-display').textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}
function startPomodoroQuick() { showSection('pomodoro'); startTimer(); }
function startZenTimer() {
    // Timer simplificado para Zen
    let zenTime = 25 * 60;
    const zenInterval = setInterval(() => {
        zenTime--;
        const min = Math.floor(zenTime / 60);
        const sec = zenTime % 60;
        document.getElementById('zen-timer').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        if (zenTime <= 0) {
            clearInterval(zenInterval);
            alert('¡Zen completo! 🌟');
        }
    }, 1000);
}

// === Recursos ===
function showResourceTab(tab) {
    currentResourceTab = tab;
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tab}-tab`).classList.add('active');
    event.target.classList.add('active');
    renderResources();
}
function renderResources() {
    if (currentResourceTab === 'videos') {
        const list = document.getElementById('videos-list');
        list.innerHTML = '';
        state.resources.videos.forEach(url => {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.width = '100%';
            iframe.height = '315';
            iframe.allowFullscreen = true;
            list.appendChild(iframe);
        });
    } else if (currentResourceTab === 'tips') {
        const list = document.getElementById('tips-list');
        list.innerHTML = '';
        state.resources.tips.forEach(tip => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `<p>${tip}</p><button class="danger" onclick="deleteTip(${state.resources.tips.indexOf(tip)})">✕</button>`;
            list.appendChild(div);
        });
    } else if (currentResourceTab === 'schedule') {
        renderSchedule();
    }
}
function addVideo() {
    const url = document.getElementById('video-url').value.trim();
    if (url) {
        state.resources.videos.push(url);
        saveState('resources');
        renderResources();
        document.getElementById('video-url').value = '';
    }
}
function addTip() {
    const text = document.getElementById('tip-text').value.trim();
    if (text) {
        state.resources.tips.push(text);
        saveState('resources');
        renderResources();
        document.getElementById('tip-text').value = '';
    }
}
function deleteTip(index) {
    state.resources.tips.splice(index, 1);
    saveState('resources');
    renderResources();
}
function getDefaultCoarSchedule() {
    // Horario típico COAR (basado en MINEDU: lunes-viernes, clases de 7am-4pm aprox.)
    return {
        lunes: [{ time: '07:00', subject: 'Matemáticas Avanzadas' }, { time: '08:30', subject: 'Física' }, { time: '10:00', subject: 'IB Theory' }, { time: '11:30', subject: 'Inglés' }],
        martes: [{ time: '07:00', subject: 'Historia' }, { time: '08:30', subject: 'Química' }, { time: '10:00', subject: 'Proyecto Personal' }, { time: '11:30', subject: 'Español' }],
        // ... Agrega más días similarmente (miércoles a domingo vacío o actividades extracurriculares)
        miercoles: [{ time: '07:00', subject: 'Biología' }, { time: '08:30', subject: 'Economía' }, { time: '10:00', subject: 'Filosofía' }, { time: '11:30', subject: 'Arte' }],
        jueves: [{ time: '07:00', subject: 'Literatura' }, { time: '08:30', subject: 'Informática' }, { time: '10:00', subject: 'Debate' }, { time: '11:30', subject: 'Educación Física' }],
        viernes: [{ time: '07:00', subject: 'Revisión Semanal' }, { time: '09:00', subject: 'Mentoría' }, { time: '11:00', subject: 'Actividades Extracurriculares' }],
        sabado: [{ time: '09:00', subject: 'Taller Creativo' }],
        domingo: []
    };
}
function renderSchedule() {
    const table = document.getElementById('coar-schedule');
    table.innerHTML = '<tr><th>Día</th><th>Horario</th><th>Materia</th></tr>';
    Object.entries(state.schedule).forEach(([day, classes]) => {
        classes.forEach(cls => {
            const row = table.insertRow();
            row.insertCell(0).textContent = day.charAt(0).toUpperCase() + day.slice(1);
            row.insertCell(1).textContent = cls.time;
            row.insertCell(2).textContent = cls.subject;
        });
    });
}
function editSchedule() {
    // Modal simple para editar (prompt por simplicidad)
    const day = prompt('Día a editar (lunes, etc.):');
    const time = prompt('Hora:');
    const subject = prompt('Materia:');
    if (day && time && subject) {
        if (!state.schedule[day]) state.schedule[day] = [];
        state.schedule[day].push({ time, subject });
        saveState('schedule');
        renderResources();
    }
}

// === Export/Import ===
function exportData() {
    const data = { ...state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coarweb-backup-${today()}.json`;
    a.click();
}
function importData(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            state = JSON.parse(ev.target.result);
            Object.keys(STORAGE_KEYS).forEach(key => saveState(key));
            alert('Datos importados! Recarga la página.');
        };
        reader.readAsText(file);
    }
}

// === Inicialización ===
if (localStorage.getItem(STORAGE_KEYS.darkMode) === 'true') toggleDarkMode();
if (Notification.permission === 'default') Notification.requestPermission();
updateDashboard();
showSection('dashboard');
renderTasks();
renderCalendar();
loadPomodoroConfig();
renderResources();

// Pre-cargar notificación ejemplo
setTimeout(() => {
    if (Notification.permission === 'granted') {
        new Notification('¡Bienvenido a COARweb PRO!', { body: 'Tu racha empieza hoy. ¡A estudiar!' });
    }
}, 2000);