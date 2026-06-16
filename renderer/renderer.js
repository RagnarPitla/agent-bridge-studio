/* Agent Bridge Studio — core renderer.
 * Defines window.ABS (the feature API) and the built-in Board (projects +
 * kanban + task drawer). Feature modules in ./features/*.js register tabs via
 * window.ABS.registerFeature. boot.js calls ABS.init() after all load. */
(() => {
  'use strict';
  const bridge = window.bridge;

  // ---- theme (applied immediately to avoid a flash) -----------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('abs-theme', theme);
    } catch (e) {
      /* ignore */
    }
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  }
  let currentTheme = 'dark';
  try {
    currentTheme = localStorage.getItem('abs-theme') || 'dark';
  } catch (e) {
    /* ignore */
  }
  document.documentElement.setAttribute('data-theme', currentTheme);

  // ---- tiny DOM helper -----------------------------------------------------
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'onClick') node.addEventListener('click', v);
        else if (k === 'onInput') node.addEventListener('input', v);
        else if (k === 'onChange') node.addEventListener('change', v);
        else if (k === 'value') node.value = v;
        else if (k === 'checked') node.checked = !!v;
        else if (k === 'disabled') node.disabled = !!v;
        else node.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  const $ = (id) => document.getElementById(id);

  // ---- state ---------------------------------------------------------------
  const COLUMNS = [
    { id: 'backlog', name: 'Backlog' },
    { id: 'in_progress', name: 'In Progress' },
    { id: 'review', name: 'Review' },
    { id: 'done', name: 'Done' },
  ];
  const LOG_CAP = 60000;

  let state = { projects: [], tasks: [], activeProjectId: null };
  let agents = [];
  const features = []; // {id,label,mount,_container,_mounted}
  const projectChangeCbs = new Set();
  const runningTasks = new Set();
  let currentDrawerTaskId = null;
  let activeTabId = 'board';
  let activities = [];
  let saveTimer = null;

  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => bridge.saveState(state).catch(() => {}), 350);
  }
  function uid() {
    return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function activeProject() {
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  }
  function foundAgents() {
    return agents.filter((a) => a.detection && a.detection.found);
  }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  // ---- readable output + result modal -------------------------------------
  function stripAnsi(s) {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '');
  }
  function cleanOutput(raw) {
    let s = stripAnsi(raw || '');
    // Collapse spinner/progress carriage returns: keep the last segment per line.
    s = s
      .split('\n')
      .map((line) => (line.indexOf('\r') >= 0 ? line.split('\r').pop() : line))
      .join('\n');
    const lines = s.split('\n');
    // Drop the leading "$ copilot …" command echo.
    while (lines.length && lines[0].trim().startsWith('$ ')) lines.shift();
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function closeResultModal() {
    const o = $('resultOverlay');
    if (o) o.remove();
  }

  function showResultModal(task) {
    closeResultModal();
    const ok = task.lastExit === 0;
    const agentLabel = (agents.find((a) => a.kind === task.agentKind) || {}).displayName || task.agentKind;
    const body = cleanOutput(task.result || task.log || '');
    const overlay = el('div', { class: 'modal-overlay', id: 'resultOverlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeResultModal();
    });
    const modal = el(
      'div',
      { class: 'modal' },
      el('div', { class: 'modal-head' },
        el('div', { class: 'modal-title', text: (ok ? '✅ ' : '⚠ ') + (task.title || 'Task') + (ok ? ' — complete' : ' — finished with issues') }),
        el('button', { class: 'ghost small', text: 'Close', onClick: closeResultModal }),
      ),
      el('div', { class: 'modal-sub', text: agentLabel + ' · ' + task.mode + (typeof task.lastExit === 'number' ? ' · exit ' + task.lastExit : '') }),
      el('pre', { class: 'modal-body', text: body || '(no output captured)' }),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'ghost', text: 'Open task', onClick: () => { closeResultModal(); openTask(task.id); } }),
        task.column !== 'done'
          ? el('button', { class: 'primary', text: 'Move to Done', onClick: () => { task.column = 'done'; task.updatedAt = new Date().toISOString(); persist(); renderBoard(); closeResultModal(); } })
          : null,
        el('button', { class: 'ghost', text: 'Dismiss', onClick: closeResultModal }),
      ),
    );
    overlay.append(modal);
    document.body.append(overlay);
  }

  // ---- projects sidebar ----------------------------------------------------
  async function addProject() {
    const dir = await bridge.pickDirectory();
    if (!dir) return;
    if (state.projects.some((p) => p.path === dir)) {
      toast('Project already added.');
      return;
    }
    try {
      await bridge.initProject(dir);
    } catch {
      /* non-fatal */
    }
    const name = dir.split('/').filter(Boolean).pop() || dir;
    const project = { id: uid(), name, path: dir, createdAt: new Date().toISOString() };
    state.projects.push(project);
    state.activeProjectId = project.id;
    seedStarterTask(project);
    persist();
    renderProjects();
    fireProjectChange();
    toast('Project added — a starter task is ready in Backlog.');
  }

  // Every new project gets one ready-to-run, read-only task so the board is
  // never empty and the user can start running immediately.
  function seedStarterTask(project) {
    const firstAgent = foundAgents()[0];
    state.tasks.push({
      id: uid(),
      projectId: project.id,
      title: 'Explore & summarize this project',
      prompt:
        'Give me a concise overview of this project: its purpose, tech stack, ' +
        'main entry points, and how to build and run it. Then suggest 3 good ' +
        'first tasks I could pick up.',
      agentKind: firstAgent ? firstAgent.kind : 'copilot-cli',
      model: '',
      effort: '',
      mode: 'plan',
      requireReview: false,
      allowAll: false,
      allowedTools: ['shell(git)'],
      column: 'backlog',
      log: '',
      result: '',
      lastExit: null,
      starter: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  function removeProject(id) {
    state.projects = state.projects.filter((p) => p.id !== id);
    state.tasks = state.tasks.filter((t) => t.projectId !== id);
    if (state.activeProjectId === id) {
      state.activeProjectId = state.projects[0] ? state.projects[0].id : null;
      fireProjectChange();
    }
    persist();
    renderProjects();
  }

  function renderProjects() {
    const list = $('projectList');
    list.innerHTML = '';
    if (!state.projects.length) {
      list.append(el('li', { class: 'muted small', text: 'No projects yet.' }));
      return;
    }
    for (const p of state.projects) {
      const active = p.id === state.activeProjectId;
      const item = el(
        'li',
        { class: 'project-item' + (active ? ' active' : ''), title: p.path },
        el('div', { class: 'project-name', text: p.name }),
        el('div', { class: 'project-path', text: p.path }),
      );
      item.addEventListener('click', () => {
        if (state.activeProjectId !== p.id) {
          state.activeProjectId = p.id;
          persist();
          renderProjects();
          fireProjectChange();
        }
      });
      list.append(item);
    }
  }

  function fireProjectChange() {
    renderBoard();
    for (const cb of projectChangeCbs) {
      try {
        cb();
      } catch (e) {
        /* ignore feature errors */
      }
    }
  }

  // ---- tabs ----------------------------------------------------------------
  function renderTabs() {
    const bar = $('tabbar');
    bar.innerHTML = '';
    for (const f of features) {
      const tab = el('div', { class: 'tab' + (f.id === activeTabId ? ' active' : '') });
      tab.append(el('button', { class: 'tab-label', text: f.label, onClick: () => setActiveTab(f.id) }));
      tab.append(
        el('button', {
          class: 'tab-pop',
          text: '⧉',
          title: 'Open “' + f.label + '” in its own window',
          onClick: () => bridge.openTab(f.id),
        }),
      );
      bar.append(tab);
    }
  }

  function ensureMounted(f) {
    if (f._mounted) return;
    f._container = el('div', { class: 'feature-pane' });
    $('tabhost').append(f._container);
    try {
      f.mount(f._container, ABS);
    } catch (e) {
      f._container.append(el('div', { class: 'error-box', text: 'Feature failed to load: ' + e.message }));
    }
    f._mounted = true;
  }

  function setActiveTab(id) {
    const f = features.find((x) => x.id === id);
    if (!f) return;
    activeTabId = id;
    for (const other of features) if (other._container) other._container.style.display = 'none';
    ensureMounted(f);
    f._container.style.display = 'block';
    renderTabs();
  }

  // ---- activity panel ------------------------------------------------------
  function renderActivity() {
    const strip = $('agentStrip');
    strip.innerHTML = '';
    const detected = el('div', { class: 'agent-pills' });
    for (const a of agents) {
      const ok = a.detection && a.detection.found;
      detected.append(
        el('span', {
          class: 'pill ' + (ok ? 'ok' : 'missing'),
          title: a.detection ? a.detection.command : '',
          text: a.displayName + (ok && a.detection.version ? ' ' + a.detection.version : ''),
        }),
      );
    }
    strip.append(detected);

    const runningCount = activities.filter((x) => x.status === 'running').length;
    const conflicts = activities.some((x) => x.conflictsWith && x.conflictsWith.length);
    const btn = el('button', {
      class: 'activity-btn' + (conflicts ? ' conflict' : ''),
      text: '◐ Agents: ' + runningCount,
      onClick: toggleActivityPanel,
    });
    strip.append(btn);
  }

  function toggleActivityPanel() {
    let panel = $('activityPanel');
    if (panel) {
      panel.remove();
      return;
    }
    panel = el('div', { class: 'activity-panel', id: 'activityPanel' });
    panel.append(el('div', { class: 'activity-head', text: 'Active agents & shared session' }));
    if (!activities.length) {
      panel.append(el('div', { class: 'muted small', text: 'No agents are running right now.' }));
    }
    for (const a of activities) {
      const row = el(
        'div',
        { class: 'activity-row' + (a.conflictsWith && a.conflictsWith.length ? ' conflict' : '') },
        el('span', { class: 'dot ' + a.status }),
        el('div', { class: 'activity-meta' },
          el('div', { class: 'activity-title', text: a.title }),
          el('div', { class: 'activity-sub', text: a.kind + ' · ' + (a.write ? 'writes' : 'read-only') + ' · ' + a.projectPath }),
          a.conflictsWith && a.conflictsWith.length
            ? el('div', { class: 'activity-warn', text: '⚠ overlaps another writing agent in this project' })
            : null,
        ),
      );
      panel.append(row);
    }
    document.body.append(panel);
  }

  function applyActivities(list) {
    activities = Array.isArray(list) ? list : [];
    renderActivity();
    if ($('activityPanel')) {
      $('activityPanel').remove();
      toggleActivityPanel();
    }
  }

  // ---- Board (built-in feature) -------------------------------------------
  let boardContainer = null;

  function newTask() {
    const p = activeProject();
    if (!p) {
      toast('Add or select a project first.');
      return;
    }
    const firstAgent = foundAgents()[0];
    const task = {
      id: uid(),
      projectId: p.id,
      title: 'Untitled task',
      prompt: '',
      agentKind: firstAgent ? firstAgent.kind : 'copilot-cli',
      model: '',
      effort: '',
      mode: 'plan',
      requireReview: false,
      allowAll: false,
      allowedTools: ['shell(git)'],
      column: 'backlog',
      log: '',
      lastExit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.tasks.push(task);
    persist();
    renderBoard();
    openTask(task.id);
  }

  function createTaskFromText({ title, prompt }) {
    const p = activeProject();
    if (!p) {
      toast('Select a project first.');
      return;
    }
    const firstAgent = foundAgents()[0];
    state.tasks.push({
      id: uid(),
      projectId: p.id,
      title: (title || 'Task').slice(0, 90),
      prompt: prompt || '',
      agentKind: firstAgent ? firstAgent.kind : 'copilot-cli',
      model: '',
      effort: '',
      mode: 'plan',
      requireReview: false,
      allowAll: false,
      allowedTools: ['shell(git)'],
      column: 'backlog',
      log: '',
      lastExit: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    persist();
    renderBoard();
    toast('Added to board');
  }

  function tasksFor(projectId) {
    return state.tasks.filter((t) => t.projectId === projectId);
  }

  function renderBoard() {
    if (!boardContainer) return;
    boardContainer.innerHTML = '';
    const p = activeProject();
    const head = el(
      'div',
      { class: 'board-head' },
      el('div', null,
        el('h2', { text: p ? p.name : 'No project' }),
        el('div', { class: 'path', text: p ? p.path : 'Add a project from the sidebar to begin.' }),
      ),
      el('div', { class: 'board-head-actions' },
        el('button', { class: 'primary small', text: '+ New task', disabled: !p, onClick: newTask }),
        p ? el('button', { class: 'ghost small', text: 'Remove project', onClick: () => removeProject(p.id) }) : null,
      ),
    );
    boardContainer.append(head);

    if (!p) {
      boardContainer.append(el('div', { class: 'empty-state', text: 'No project selected.' }));
      return;
    }

    const board = el('div', { class: 'board' });
    const myTasks = tasksFor(p.id);
    for (const col of COLUMNS) {
      const colTasks = myTasks.filter((t) => t.column === col.id);
      const column = el('div', { class: 'column', 'data-col': col.id });
      column.append(
        el('div', { class: 'column-head' },
          el('span', { text: col.name }),
          el('span', { class: 'count', text: String(colTasks.length) }),
        ),
      );
      const cards = el('div', { class: 'cards' });
      for (const t of colTasks) cards.append(renderCard(t));
      column.append(cards);

      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('dragover');
      });
      column.addEventListener('dragleave', () => column.classList.remove('dragover'));
      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('dragover');
        const id = e.dataTransfer.getData('text/plain');
        const task = state.tasks.find((x) => x.id === id);
        if (task && task.column !== col.id) {
          task.column = col.id;
          task.updatedAt = new Date().toISOString();
          persist();
          renderBoard();
        }
      });
      board.append(column);
    }
    boardContainer.append(board);
  }

  function renderCard(t) {
    const running = runningTasks.has(t.id);
    const agentLabel = (agents.find((a) => a.kind === t.agentKind) || {}).displayName || t.agentKind;
    const card = el('div', { class: 'card' + (running ? ' running' : ''), draggable: 'true' });
    card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', t.id));
    card.addEventListener('click', () => openTask(t.id));
    card.append(el('div', { class: 'card-title', text: t.title || 'Untitled task' }));
    const meta = el('div', { class: 'card-meta' },
      el('span', { class: 'tag', text: agentLabel }),
      el('span', { class: 'tag ' + (t.mode === 'autopilot' ? 'warn' : ''), text: t.mode }),
      t.requireReview ? el('span', { class: 'tag', text: 'review-first' }) : null,
      running ? el('span', { class: 'tag run', text: '● running' }) : null,
      t.lastExit === 0 ? el('span', { class: 'tag ok', text: 'exit 0' }) : null,
      typeof t.lastExit === 'number' && t.lastExit !== 0 ? el('span', { class: 'tag err', text: 'exit ' + t.lastExit }) : null,
    );
    card.append(meta);
    return card;
  }

  // ---- task drawer ---------------------------------------------------------
  function openTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    currentDrawerTaskId = id;

    const agentSel = $('t_agent');
    agentSel.innerHTML = '';
    const list = foundAgents();
    if (!list.length) agentSel.append(el('option', { value: '', text: 'No agents detected' }));
    for (const a of list) agentSel.append(el('option', { value: a.kind, text: a.displayName }));
    agentSel.value = t.agentKind;

    $('t_title').value = t.title || '';
    $('t_prompt').value = t.prompt || '';
    $('t_effort').value = t.effort || '';
    $('t_model').value = t.model || '';
    $('t_mode').value = t.mode || 'plan';
    $('t_review').checked = !!t.requireReview;
    $('t_allowAll').checked = !!t.allowAll;
    $('t_tools').value = (t.allowedTools || []).join(', ');
    $('t_output').textContent = t.log || '';
    $('t_status').textContent = '';
    updateRunButtons(runningTasks.has(id));

    $('drawer').classList.remove('hidden');
    $('overlay').classList.remove('hidden');
  }

  function closeDrawer() {
    $('drawer').classList.add('hidden');
    $('overlay').classList.add('hidden');
    currentDrawerTaskId = null;
  }

  function currentTask() {
    return state.tasks.find((x) => x.id === currentDrawerTaskId) || null;
  }

  function bindDrawer() {
    const bindField = (elemId, apply) => {
      $(elemId).addEventListener('input', () => {
        const t = currentTask();
        if (!t) return;
        apply(t);
        t.updatedAt = new Date().toISOString();
        persist();
        renderBoard();
      });
    };
    bindField('t_title', (t) => (t.title = $('t_title').value));
    bindField('t_prompt', (t) => (t.prompt = $('t_prompt').value));
    bindField('t_model', (t) => (t.model = $('t_model').value));
    $('t_effort').addEventListener('change', () => { const t = currentTask(); if (t) { t.effort = $('t_effort').value; persist(); } });
    $('t_mode').addEventListener('change', () => { const t = currentTask(); if (t) { t.mode = $('t_mode').value; persist(); renderBoard(); } });
    $('t_agent').addEventListener('change', () => { const t = currentTask(); if (t) { t.agentKind = $('t_agent').value; persist(); renderBoard(); } });
    $('t_review').addEventListener('change', () => { const t = currentTask(); if (t) { t.requireReview = $('t_review').checked; persist(); renderBoard(); } });
    $('t_allowAll').addEventListener('change', () => { const t = currentTask(); if (t) { t.allowAll = $('t_allowAll').checked; persist(); } });
    $('t_tools').addEventListener('input', () => { const t = currentTask(); if (t) { t.allowedTools = $('t_tools').value.split(',').map((s) => s.trim()).filter(Boolean); persist(); } });

    $('closeDrawer').addEventListener('click', closeDrawer);
    $('overlay').addEventListener('click', closeDrawer);
    $('runTask').addEventListener('click', runCurrentTask);
    $('cancelTask').addEventListener('click', cancelCurrentTask);
    $('deleteTask').addEventListener('click', deleteCurrentTask);
    $('viewResult').addEventListener('click', () => {
      const t = currentTask();
      if (!t) return;
      if (!(t.result || t.log)) {
        toast('No result yet — run the task first.');
        return;
      }
      showResultModal(t);
    });
  }

  function updateRunButtons(isRunning) {
    $('runTask').disabled = isRunning;
    $('cancelTask').disabled = !isRunning;
  }

  async function runCurrentTask() {
    const t = currentTask();
    if (!t) return;
    const p = state.projects.find((x) => x.id === t.projectId);
    if (!p) return toast('Project missing.');
    if (!t.prompt.trim()) return toast('Enter a prompt first.');

    const reviewFirst = t.requireReview && t.mode === 'autopilot';
    const effectiveMode = reviewFirst ? 'plan' : t.mode;
    const allowAll = t.allowAll || effectiveMode === 'autopilot';

    t.column = 'in_progress';
    t.log = '';
    t.lastExit = null;
    runningTasks.add(t.id);
    persist();
    renderBoard();
    $('t_output').textContent = '';
    $('t_status').textContent = reviewFirst ? 'Planning (review required before coding)…' : 'Running…';
    updateRunButtons(true);

    try {
      const res = await bridge.runTask({
        taskId: t.id,
        title: t.title || t.prompt.slice(0, 80),
        kind: t.agentKind,
        projectPath: p.path,
        prompt: t.prompt,
        mode: effectiveMode,
        model: t.model || undefined,
        reasoningEffort: t.effort || undefined,
        allowAll,
        allowedTools: t.allowedTools || [],
        allowedUrls: ['github.com'],
      });
      if (res && res.conflicts && res.conflicts.length) {
        toast('⚠ ' + res.conflicts.length + ' other agent(s) already working in this project');
      }
    } catch (err) {
      runningTasks.delete(t.id);
      updateRunButtons(false);
      $('t_status').textContent = 'Failed: ' + err.message;
      renderBoard();
    }
  }

  async function cancelCurrentTask() {
    const t = currentTask();
    if (!t) return;
    await bridge.cancelTask(t.id);
    $('t_status').textContent = 'Cancelling…';
  }

  function deleteCurrentTask() {
    const t = currentTask();
    if (!t) return;
    state.tasks = state.tasks.filter((x) => x.id !== t.id);
    runningTasks.delete(t.id);
    persist();
    closeDrawer();
    renderBoard();
  }

  function handleTaskEvent(ev) {
    const t = state.tasks.find((x) => x.id === ev.taskId);
    if (!t) return;
    if (ev.type === 'log' || ev.type === 'error') {
      t.log = (t.log + (ev.type === 'error' ? '\n[error] ' : '') + ev.message).slice(-LOG_CAP);
      if (currentDrawerTaskId === t.id) {
        const out = $('t_output');
        out.textContent = t.log;
        out.scrollTop = out.scrollHeight;
      }
    } else if (ev.type === 'done') {
      runningTasks.delete(t.id);
      const m = /code (\-?\d+)/.exec(ev.message);
      t.lastExit = m ? parseInt(m[1], 10) : 0;
      t.result = t.log;
      if (t.lastExit === 0 && t.column === 'in_progress') t.column = 'review';
      t.updatedAt = new Date().toISOString();
      if (currentDrawerTaskId === t.id) {
        $('t_status').textContent = ev.message;
        updateRunButtons(false);
      }
      persist();
      renderBoard();
      // Surface a human-readable result so a finished task is never just a card
      // with nothing obvious to do.
      showResultModal(t);
    }
  }

  // ---- public API (window.ABS) --------------------------------------------
  const ABS = {
    bridge,
    el,
    toast,
    activeProject,
    createTaskFromText,
    onProjectChange(cb) {
      projectChangeCbs.add(cb);
      return () => projectChangeCbs.delete(cb);
    },
    registerFeature(def) {
      if (!def || !def.id || typeof def.mount !== 'function') return;
      if (features.some((f) => f.id === def.id)) return;
      features.push({ id: def.id, label: def.label || def.id, mount: def.mount });
    },
    __featureIds: () => features.map((f) => f.id),
    async init(opts) {
      opts = opts || {};
      // Register the built-in Board first so it is the leftmost tab.
      const board = {
        id: 'board',
        label: 'Board',
        mount(container) {
          boardContainer = container;
          renderBoard();
        },
      };
      features.unshift({ ...board });

      $('addProject').addEventListener('click', addProject);
      applyTheme(currentTheme);
      $('themeToggle').addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(currentTheme);
      });
      bindDrawer();

      try {
        agents = await bridge.detectAgents();
      } catch {
        agents = [];
      }
      try {
        const loaded = await bridge.loadState();
        state.projects = loaded.projects || [];
        state.tasks = loaded.tasks || [];
        state.activeProjectId = loaded.activeProjectId || (state.projects[0] ? state.projects[0].id : null);
      } catch {
        /* defaults */
      }
      // Tasks left "running" from a previous session are no longer running.
      runningTasks.clear();

      bridge.onTaskEvent(handleTaskEvent);
      bridge.onActivityChange(applyActivities);
      try {
        applyActivities(await bridge.listActivities());
      } catch {
        applyActivities([]);
      }

      renderProjects();
      renderActivity();
      renderTabs();

      const startTab = opts.tab && features.some((f) => f.id === opts.tab) ? opts.tab : 'board';
      setActiveTab(startTab);
    },
  };

  window.ABS = ABS;
})();
