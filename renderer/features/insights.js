(function () {
  'use strict';

  var featureId = 'insights';
  var maxContextTurns = 6;

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

  function projectKey(project) {
    if (!project) return '__none__';
    return project.id || project.path || project.name || '__unknown__';
  }

  function buildPrompt(history, latestPrompt) {
    var prior = history.slice(-maxContextTurns);
    if (!prior.length) return latestPrompt;

    var lines = [
      'You are chatting with the user about their local project. Prior conversation context follows.',
      ''
    ];

    prior.forEach(function (turn) {
      var label = turn.role === 'user' ? 'User' : 'Assistant';
      lines.push(label + ': ' + turn.text);
    });

    lines.push('', 'Current user question:', latestPrompt);
    return lines.join('\n');
  }

  function register() {
    window.ABS.registerFeature({
      id: featureId,
      label: 'Insights',
      mount: function (container, ctx) {
        var histories = {};
        var activeKey = null;
        var root = null;
        var header = null;
        var historyArea = null;
        var input = null;
        var sendButton = null;
        var sending = false;
        var unsubscribe = null;

        function getActiveProject() {
          return ctx.activeProject ? ctx.activeProject() : null;
        }

        function getHistory() {
          if (!histories[activeKey]) histories[activeKey] = [];
          return histories[activeKey];
        }

        function scrollToBottom() {
          if (historyArea) historyArea.scrollTop = historyArea.scrollHeight;
        }

        function addBubble(role, text, options) {
          options = options || {};
          var isUser = role === 'user';
          var isError = role === 'error';
          var row = makeEl(ctx, 'div', { class: 'insights-message-row' });
          var bubble = makeEl(ctx, 'div', { class: 'insights-message-bubble' });

          setStyles(row, {
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            margin: '10px 0'
          });

          setStyles(bubble, {
            maxWidth: '82%',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            lineHeight: '1.45',
            padding: '10px 12px',
            borderRadius: '14px',
            border: '1px solid ' + (isError ? 'var(--red)' : (isUser ? 'var(--accent)' : 'var(--border)')),
            background: isError ? 'var(--panel2)' : (isUser ? 'var(--accent)' : 'var(--panel2)'),
            color: isError ? 'var(--red)' : 'var(--text)',
            boxShadow: '0 8px 18px var(--border)'
          });

          bubble.textContent = text;
          row.appendChild(bubble);
          historyArea.appendChild(row);
          scrollToBottom();

          if (!options.skipStore && (role === 'user' || role === 'assistant')) {
            getHistory().push({ role: role, text: text });
          }

          return bubble;
        }

        function renderEmptyHint() {
          container.innerHTML = '';
          setStyles(container, {
            height: '100%',
            minHeight: '320px',
            boxSizing: 'border-box'
          });

          var hint = makeEl(ctx, 'div', { text: 'Select a project to chat about it.' });
          setStyles(hint, {
            color: 'var(--muted)',
            padding: '24px',
            fontSize: '14px'
          });
          container.appendChild(hint);
        }

        function replayHistory() {
          historyArea.innerHTML = '';
          getHistory().forEach(function (turn) {
            addBubble(turn.role, turn.text, { skipStore: true });
          });
        }

        function updateSendState() {
          if (!sendButton || !input) return;
          var hasText = input.value.trim().length > 0;
          sendButton.disabled = sending || !hasText;
          setStyles(sendButton, {
            opacity: sendButton.disabled ? '0.55' : '1',
            cursor: sendButton.disabled ? 'not-allowed' : 'pointer'
          });
        }

        function renderChat(project) {
          container.innerHTML = '';
          activeKey = projectKey(project);
          setStyles(container, {
            height: '100%',
            minHeight: '420px',
            boxSizing: 'border-box'
          });

          root = makeEl(ctx, 'div', { class: 'insights-root' });
          setStyles(root, {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: '420px',
            boxSizing: 'border-box',
            background: 'var(--code-bg)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden'
          });

          header = makeEl(ctx, 'div', { class: 'insights-header' });
          setStyles(header, {
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel)'
          });

          var title = makeEl(ctx, 'div', { text: 'Insights' });
          setStyles(title, {
            fontSize: '16px',
            fontWeight: '700',
            color: 'var(--text)'
          });

          var subtitle = makeEl(ctx, 'div', { text: project.name || project.path || 'Active project' });
          setStyles(subtitle, {
            marginTop: '4px',
            fontSize: '12px',
            color: 'var(--muted)'
          });

          header.appendChild(title);
          header.appendChild(subtitle);

          historyArea = makeEl(ctx, 'div', { class: 'insights-history' });
          setStyles(historyArea, {
            flex: '1 1 auto',
            overflowY: 'auto',
            padding: '16px',
            background: 'linear-gradient(180deg, var(--code-bg) 0%, var(--code-bg) 100%)'
          });

          var composer = makeEl(ctx, 'div', { class: 'insights-composer' });
          setStyles(composer, {
            display: 'flex',
            gap: '10px',
            padding: '14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--panel)',
            alignItems: 'flex-end'
          });

          input = makeEl(ctx, 'textarea', {
            placeholder: 'Ask about this project…',
            rows: '3',
            spellcheck: 'true'
          });
          setStyles(input, {
            flex: '1 1 auto',
            resize: 'vertical',
            minHeight: '68px',
            maxHeight: '180px',
            boxSizing: 'border-box',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            background: 'var(--code-bg)',
            color: 'var(--text)',
            padding: '10px 12px',
            outline: 'none',
            font: 'inherit',
            lineHeight: '1.4'
          });

          sendButton = makeEl(ctx, 'button', { type: 'button', text: 'Send' });
          setStyles(sendButton, {
            flex: '0 0 auto',
            border: '1px solid var(--accent)',
            borderRadius: '10px',
            background: 'var(--accent)',
            color: 'var(--text)',
            padding: '10px 16px',
            fontWeight: '700',
            minHeight: '42px'
          });

          input.addEventListener('input', updateSendState);
          input.addEventListener('keydown', function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              sendCurrentMessage();
            }
          });
          sendButton.addEventListener('click', sendCurrentMessage);

          composer.appendChild(input);
          composer.appendChild(sendButton);
          root.appendChild(header);
          root.appendChild(historyArea);
          root.appendChild(composer);
          container.appendChild(root);

          replayHistory();
          updateSendState();
        }

        function setSending(value) {
          sending = value;
          if (input) input.disabled = value;
          if (input) {
            setStyles(input, {
              opacity: value ? '0.7' : '1'
            });
          }
          updateSendState();
        }

        function sendCurrentMessage() {
          var project = getActiveProject();
          if (!project) {
            renderEmptyHint();
            return;
          }
          if (sending || !input) return;

          var prompt = input.value.trim();
          if (!prompt) {
            updateSendState();
            return;
          }

          var promptWithContext = buildPrompt(getHistory(), prompt);
          var requestKey = activeKey;
          input.value = '';
          addBubble('user', prompt);
          updateSendState();

          var thinkingBubble = addBubble('assistant', 'thinking…', { skipStore: true });
          setSending(true);

          ctx.bridge.invoke('feature:insights:ask', {
            projectPath: project.path,
            prompt: promptWithContext
          }).then(function (answer) {
            if (activeKey !== requestKey) return;
            var text = typeof answer === 'string' ? answer : String(answer || '');
            thinkingBubble.textContent = text || '(No answer returned.)';
            getHistory().push({ role: 'assistant', text: thinkingBubble.textContent });
            scrollToBottom();
          }).catch(function (error) {
            if (activeKey !== requestKey) return;
            var message = error && error.message ? error.message : String(error || 'Unknown error');
            thinkingBubble.textContent = 'Error: ' + message;
            setStyles(thinkingBubble, {
              border: '1px solid var(--red)',
              background: 'var(--panel2)',
              color: 'var(--red)'
            });
            if (ctx.toast) ctx.toast('Insights failed: ' + message);
            scrollToBottom();
          }).finally(function () {
            setSending(false);
            if (input) input.focus();
          });
        }

        function handleProjectChange() {
          var project = getActiveProject();
          sending = false;
          if (!project) {
            activeKey = null;
            renderEmptyHint();
            return;
          }
          activeKey = projectKey(project);
          histories[activeKey] = [];
          renderChat(project);
        }

        var initialProject = getActiveProject();
        if (!initialProject) {
          renderEmptyHint();
        } else {
          renderChat(initialProject);
        }

        if (ctx.onProjectChange) {
          unsubscribe = ctx.onProjectChange(handleProjectChange);
        }

        return function cleanup() {
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
