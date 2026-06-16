(function () {
  'use strict';

  var featureId = 'roadmap';
  var kinds = [
    { id: 'tasks', label: 'Quick tasks' },
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'security', label: 'Security' },
    { id: 'performance', label: 'Performance' },
    { id: 'improvements', label: 'Code improvements' }
  ];

  function setStyles(el, styles) {
    Object.keys(styles).forEach(function (key) {
      el.style[key] = styles[key];
    });
    return el;
  }

  function makeEl(ctx, tag, props) {
    var children = Array.prototype.slice.call(arguments, 3);
    return ctx.el.apply(ctx, [tag, props || {}].concat(children));
  }

  function getErrorMessage(error) {
    if (error && error.message) return error.message;
    return String(error || 'Unknown error');
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/^\s*[-*]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function titleFromItem(item) {
    var title = cleanText(item);
    if (!title) title = 'Roadmap suggestion';
    if (title.length > 80) title = title.slice(0, 77).trim() + '…';
    return title;
  }

  function parseItems(markdown) {
    var lines = String(markdown || '').split(/\r?\n/);
    var items = [];
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (/^(?:[-*]\s+|\d+[.)]\s+)/.test(trimmed)) {
        var item = cleanText(trimmed);
        if (item) items.push(item);
      }
    });
    return items;
  }

  function register() {
    window.ABS.registerFeature({
      id: featureId,
      label: 'Roadmap',
      mount: function (container, ctx) {
        var running = false;
        var currentKind = null;
        var currentMarkdown = '';
        var errorText = '';
        var buttonMap = {};
        var statusEl = null;
        var resultEl = null;
        var itemsEl = null;
        var generationId = 0;
        var unsubscribe = null;

        function getActiveProject() {
          return ctx.activeProject ? ctx.activeProject() : null;
        }

        function toast(message) {
          if (ctx.toast) ctx.toast(message);
        }

        function renderEmptyHint() {
          container.innerHTML = '';
          setStyles(container, {
            height: '100%',
            minHeight: '320px',
            boxSizing: 'border-box',
            background: 'var(--code-bg)',
            color: 'var(--muted)',
            padding: '24px',
            border: '1px solid var(--border)',
            borderRadius: '12px'
          });
          container.appendChild(makeEl(ctx, 'div', {
            class: 'roadmap-empty-hint',
            text: 'Select a project to generate ideas.'
          }));
        }

        function styleButton(button, isActive) {
          setStyles(button, {
            border: '1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)'),
            borderRadius: '10px',
            background: isActive ? 'var(--accent)' : 'var(--code-bg)',
            color: 'var(--text)',
            padding: '9px 12px',
            font: 'inherit',
            fontWeight: '700',
            cursor: button.disabled ? 'not-allowed' : 'pointer',
            opacity: button.disabled ? '0.55' : '1',
            boxShadow: isActive ? '0 8px 18px var(--accent)' : 'none'
          });
        }

        function updateButtons() {
          kinds.forEach(function (kind) {
            var button = buttonMap[kind.id];
            if (!button) return;
            button.disabled = running;
            styleButton(button, currentKind === kind.id);
          });
        }

        function renderStatus() {
          if (!statusEl) return;
          if (running) {
            statusEl.textContent = 'Generating… (this runs the agent and can take ~10-60s)';
            setStyles(statusEl, { color: 'var(--accent)' });
          } else if (errorText) {
            statusEl.textContent = 'Error: ' + errorText;
            setStyles(statusEl, { color: 'var(--red)' });
          } else if (currentMarkdown) {
            statusEl.textContent = 'Generated suggestions for ' + (currentKind || 'project') + '.';
            setStyles(statusEl, { color: 'var(--muted)' });
          } else {
            statusEl.textContent = 'Choose a category to ask the agent for suggestions.';
            setStyles(statusEl, { color: 'var(--muted)' });
          }
        }

        function renderItems() {
          if (!itemsEl) return;
          itemsEl.innerHTML = '';

          var items = parseItems(currentMarkdown);
          if (!items.length) return;

          var heading = makeEl(ctx, 'div', { text: 'Turn suggestions into tasks' });
          setStyles(heading, {
            margin: '18px 0 10px',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: '800',
            letterSpacing: '0.02em'
          });
          itemsEl.appendChild(heading);

          items.forEach(function (item) {
            var row = makeEl(ctx, 'div', { class: 'roadmap-task-row' });
            setStyles(row, {
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '10px',
              alignItems: 'start',
              padding: '10px',
              marginBottom: '8px',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              background: 'var(--panel)'
            });

            var text = makeEl(ctx, 'div', { text: item });
            setStyles(text, {
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              lineHeight: '1.4',
              fontSize: '13px'
            });

            var addButton = makeEl(ctx, 'button', { type: 'button', text: '+ Add as task' });
            var canCreateTask = typeof ctx.createTaskFromText === 'function';
            addButton.disabled = !canCreateTask;
            if (!canCreateTask) {
              addButton.setAttribute('title', 'Task creation is not available.');
            }
            setStyles(addButton, {
              border: '1px solid var(--accent)',
              borderRadius: '9px',
              background: canCreateTask ? 'var(--accent)' : 'var(--panel2)',
              color: 'var(--text)',
              padding: '8px 10px',
              font: 'inherit',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              cursor: canCreateTask ? 'pointer' : 'not-allowed',
              opacity: canCreateTask ? '1' : '0.55'
            });
            addButton.addEventListener('click', function () {
              if (typeof ctx.createTaskFromText !== 'function') {
                toast('Task creation is not available.');
                return;
              }
              ctx.createTaskFromText({
                title: titleFromItem(item),
                prompt: item
              });
              toast('Added to board');
            });

            row.appendChild(text);
            row.appendChild(addButton);
            itemsEl.appendChild(row);
          });
        }

        function renderResult() {
          if (!resultEl) return;
          resultEl.innerHTML = '';
          if (!currentMarkdown) return;

          var pre = makeEl(ctx, 'pre', { text: currentMarkdown });
          setStyles(pre, {
            margin: '16px 0 0',
            padding: '14px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'var(--code-bg)',
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: '1.5',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: '13px'
          });
          resultEl.appendChild(pre);
        }

        function renderGeneratedSections() {
          renderStatus();
          renderResult();
          renderItems();
          updateButtons();
        }

        function generate(kind) {
          var project = getActiveProject();
          if (!project) {
            renderEmptyHint();
            return;
          }
          if (running) return;

          running = true;
          currentKind = kind;
          currentMarkdown = '';
          errorText = '';
          generationId += 1;
          var requestId = generationId;
          renderGeneratedSections();

          ctx.bridge.invoke('feature:ideate:generate', {
            projectPath: project.path,
            kind: kind
          }).then(function (markdown) {
            if (requestId !== generationId) return;
            currentMarkdown = typeof markdown === 'string' ? markdown : String(markdown || '');
            if (!currentMarkdown) currentMarkdown = '(No suggestions returned.)';
          }).catch(function (error) {
            if (requestId !== generationId) return;
            errorText = getErrorMessage(error);
            currentMarkdown = '';
            toast('Roadmap generation failed: ' + errorText);
          }).finally(function () {
            if (requestId !== generationId) return;
            running = false;
            renderGeneratedSections();
          });
        }

        function renderFeature(project) {
          if (!project) {
            renderEmptyHint();
            return;
          }

          container.innerHTML = '';
          setStyles(container, {
            height: '100%',
            minHeight: '420px',
            boxSizing: 'border-box',
            background: 'var(--code-bg)',
            color: 'var(--text)'
          });

          var root = makeEl(ctx, 'div', { class: 'roadmap-root' });
          setStyles(root, {
            minHeight: '420px',
            boxSizing: 'border-box',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, var(--panel) 0%, var(--code-bg) 100%)',
            overflow: 'hidden'
          });

          var header = makeEl(ctx, 'div', { class: 'roadmap-header' });
          setStyles(header, {
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel)'
          });

          var title = makeEl(ctx, 'div', { text: 'Roadmap' });
          setStyles(title, {
            color: 'var(--text)',
            fontSize: '16px',
            fontWeight: '800'
          });

          var subtitle = makeEl(ctx, 'div', {
            text: 'Generate project ideas for ' + (project.name || project.path || 'the active project') + '.'
          });
          setStyles(subtitle, {
            marginTop: '5px',
            color: 'var(--muted)',
            fontSize: '12px'
          });

          header.appendChild(title);
          header.appendChild(subtitle);

          var body = makeEl(ctx, 'div', { class: 'roadmap-body' });
          setStyles(body, {
            padding: '16px'
          });

          var controls = makeEl(ctx, 'div', { class: 'roadmap-controls' });
          setStyles(controls, {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          });

          buttonMap = {};
          kinds.forEach(function (kind) {
            var button = makeEl(ctx, 'button', { type: 'button', text: kind.label });
            button.addEventListener('click', function () {
              generate(kind.id);
            });
            buttonMap[kind.id] = button;
            controls.appendChild(button);
          });

          statusEl = makeEl(ctx, 'div', { class: 'roadmap-status' });
          setStyles(statusEl, {
            marginTop: '14px',
            minHeight: '20px',
            fontSize: '13px',
            lineHeight: '1.4'
          });

          resultEl = makeEl(ctx, 'div', { class: 'roadmap-result' });
          itemsEl = makeEl(ctx, 'div', { class: 'roadmap-items' });

          body.appendChild(controls);
          body.appendChild(statusEl);
          body.appendChild(resultEl);
          body.appendChild(itemsEl);
          root.appendChild(header);
          root.appendChild(body);
          container.appendChild(root);

          renderGeneratedSections();
        }

        function resetForProjectChange() {
          running = false;
          currentKind = null;
          currentMarkdown = '';
          errorText = '';
          generationId += 1;
          renderFeature(getActiveProject());
        }

        renderFeature(getActiveProject());

        if (ctx.onProjectChange) {
          unsubscribe = ctx.onProjectChange(resetForProjectChange);
        }

        return function cleanup() {
          generationId += 1;
          if (unsubscribe) unsubscribe();
        };
      }
    });
  }

  if (!window.ABS || !window.ABS.registerFeature) {
    throw new Error('Agent Bridge Studio API is not available.');
  }

  register();
}());
