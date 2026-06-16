(function () {
  const featureId = 'context';

  function asText(value) {
    return value == null ? '' : String(value);
  }

  window.ABS.registerFeature({
    id: featureId,
    label: 'Context',
    mount(container, ctx) {
      let requestId = 0;

      function style(el, rules) {
        Object.assign(el.style, rules);
        return el;
      }

      function clear() {
        container.textContent = '';
      }

      function fill(child) {
        clear();
        container.appendChild(child);
      }

      function muted(text) {
        return style(ctx.el('div', { class: 'muted', text: text }), {
          color: 'rgba(255, 255, 255, 0.62)',
          padding: '18px',
        });
      }

      function card() {
        const el = ctx.el('div', { class: 'panel card' });
        style(el, {
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
        });
        return el;
      }

      function makeRefreshButton(disabled) {
        const props = {
          type: 'button',
          class: 'btn',
        };

        if (disabled) {
          props.disabled = true;
        }

        const button = ctx.el('button', props, 'Refresh');

        style(button, {
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? '0.65' : '1',
        });

        button.addEventListener('click', function () {
          loadIndex();
        });

        return button;
      }

      function renderShell(project, content, refreshDisabled) {
        const title = ctx.el('div', {},
          style(ctx.el('div', { text: project.name || 'Untitled project' }), {
            fontSize: '18px',
            fontWeight: '700',
            marginBottom: '4px',
          }),
          style(ctx.el('div', { class: 'muted', text: project.path || '' }), {
            color: 'rgba(255, 255, 255, 0.58)',
            fontSize: '12px',
            wordBreak: 'break-all',
          })
        );

        const header = style(ctx.el('div', {}, title, makeRefreshButton(refreshDisabled)), {
          alignItems: 'flex-start',
          display: 'flex',
          gap: '12px',
          justifyContent: 'space-between',
          marginBottom: '14px',
        });

        fill(style(ctx.el('div', { class: 'context-feature' }, header, content), {
          padding: '16px',
        }));
      }

      function renderNoProject() {
        requestId += 1;
        fill(muted('Select a project to see its index.'));
      }

      function renderLoading(project) {
        renderShell(project, muted('Loading…'), true);
      }

      function renderError(project, error) {
        const message = error && error.message ? error.message : asText(error) || 'Unknown error';
        const errorCard = card();
        errorCard.appendChild(style(ctx.el('div', { text: 'Could not load project context.' }), {
          color: '#ffb4b4',
          fontWeight: '700',
          marginBottom: '8px',
        }));
        errorCard.appendChild(style(ctx.el('div', { text: message }), {
          color: 'rgba(255, 255, 255, 0.78)',
          whiteSpace: 'pre-wrap',
        }));

        renderShell(project, errorCard, false);
      }

      function chip(text) {
        return style(ctx.el('span', { class: 'badge', text: text }), {
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '999px',
          color: 'rgba(255, 255, 255, 0.86)',
          display: 'inline-flex',
          fontSize: '12px',
          lineHeight: '1',
          padding: '6px 9px',
        });
      }

      function renderStack(stack) {
        const section = style(ctx.el('div'), {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        });

        if (Array.isArray(stack) && stack.length) {
          stack.forEach(function (item) {
            section.appendChild(chip(asText(item)));
          });
        } else {
          section.appendChild(style(ctx.el('span', { class: 'muted', text: 'Stack: unknown' }), {
            color: 'rgba(255, 255, 255, 0.62)',
          }));
        }

        return section;
      }

      function renderEntries(entries) {
        const list = style(ctx.el('div'), {
          display: 'grid',
          gap: '8px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        });

        const items = Array.isArray(entries) ? entries.slice() : [];
        items.sort(function (a, b) {
          if (a.type === b.type) {
            return asText(a.name).localeCompare(asText(b.name));
          }
          return a.type === 'dir' ? -1 : 1;
        });

        if (!items.length) {
          list.appendChild(style(ctx.el('div', { class: 'muted', text: 'No top-level entries found.' }), {
            color: 'rgba(255, 255, 255, 0.62)',
          }));
          return list;
        }

        items.forEach(function (entry) {
          const isDir = entry.type === 'dir';
          const icon = isDir ? '📁' : '📄';
          const row = style(ctx.el('div', {},
            style(ctx.el('span', { text: icon + ' ' + asText(entry.name) }), {
              minWidth: '0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }),
            style(ctx.el('span', { class: 'muted', text: asText(entry.type) }), {
              color: 'rgba(255, 255, 255, 0.48)',
              fontSize: '12px',
              textTransform: 'uppercase',
            })
          ), {
            alignItems: 'center',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: '10px',
            display: 'grid',
            gap: '10px',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            padding: '10px 12px',
          });

          list.appendChild(row);
        });

        return list;
      }

      function sectionTitle(text) {
        return style(ctx.el('h3', { text: text }), {
          fontSize: '13px',
          letterSpacing: '0.03em',
          margin: '0 0 10px',
          textTransform: 'uppercase',
        });
      }

      function renderIndex(project, data) {
        const root = data && data.root ? data.root : project.path;
        const name = data && data.name ? data.name : project.name;
        const readmeText = data && data.readme ? 'README: present' : 'README: missing';

        const content = style(ctx.el('div'), {
          display: 'grid',
          gap: '14px',
        });

        const summary = card();
        summary.appendChild(style(ctx.el('div', { text: name || 'Untitled project' }), {
          fontSize: '16px',
          fontWeight: '700',
          marginBottom: '5px',
        }));
        summary.appendChild(style(ctx.el('div', { class: 'muted', text: root || '' }), {
          color: 'rgba(255, 255, 255, 0.58)',
          fontSize: '12px',
          marginBottom: '12px',
          wordBreak: 'break-all',
        }));
        summary.appendChild(renderStack(data && data.stack));
        summary.appendChild(style(ctx.el('div', { text: readmeText }), {
          color: data && data.readme ? '#9ee6a8' : 'rgba(255, 255, 255, 0.62)',
          marginTop: '12px',
        }));

        const entriesCard = card();
        entriesCard.appendChild(sectionTitle('Top-level entries'));
        entriesCard.appendChild(renderEntries(data && data.entries));

        content.appendChild(summary);
        content.appendChild(entriesCard);

        renderShell({ name: name, path: root }, content, false);
      }

      async function loadIndex() {
        const project = ctx.activeProject();

        if (!project) {
          renderNoProject();
          return;
        }

        const currentRequest = requestId + 1;
        requestId = currentRequest;
        renderLoading(project);

        try {
          const data = await ctx.bridge.invoke('feature:context:index', project.path);
          const active = ctx.activeProject();

          if (currentRequest !== requestId || !active || active.path !== project.path) {
            return;
          }

          renderIndex(project, data);
        } catch (error) {
          const active = ctx.activeProject();

          if (currentRequest !== requestId || !active || active.path !== project.path) {
            return;
          }

          renderError(project, error);
        }
      }

      ctx.onProjectChange(function () {
        loadIndex();
      });

      loadIndex();
    },
  });
}());
