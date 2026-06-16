(function () {
  'use strict';

  function applyStyles(el, styles) {
    Object.keys(styles).forEach(function (key) {
      el.style[key] = styles[key];
    });
    return el;
  }

  function clear(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function messageFromError(err) {
    if (!err) return 'Something went wrong.';
    if (err.message) return String(err.message);
    return String(err);
  }

  function normalizeCommits(commits) {
    if (!Array.isArray(commits)) return [];
    return commits
      .map(function (commit) {
        return {
          hash: commit && commit.hash ? String(commit.hash) : '',
          subject: commit && commit.subject ? String(commit.subject) : ''
        };
      })
      .filter(function (commit) {
        return commit.hash || commit.subject;
      });
  }

  function trim(value) {
    return String(value || '').replace(/^\s+|\s+$/g, '');
  }

  window.ABS.registerFeature({
    id: 'changelog',
    label: 'Changelog',
    mount: function (container, ctx) {
      var state = {
        token: 0,
        projectPath: '',
        tags: [],
        tagsLoading: false,
        tagsError: '',
        sinceRef: '',
        version: '',
        commits: null,
        commitsLoading: false,
        commitsError: '',
        draft: '',
        drafting: false,
        draftError: ''
      };

      function muted(text) {
        return applyStyles(ctx.el('div', { text: text }), {
          color: 'var(--muted)',
          fontSize: '13px',
          lineHeight: '1.45'
        });
      }

      function errorBlock(text) {
        return applyStyles(ctx.el('div', { text: text }), {
          background: 'var(--panel2)',
          border: '1px solid var(--red)',
          borderRadius: '10px',
          color: 'var(--red)',
          fontSize: '13px',
          lineHeight: '1.45',
          padding: '10px 12px'
        });
      }

      function makeButton(label, disabled) {
        var button = ctx.el('button', { type: 'button', text: label });
        button.disabled = !!disabled;
        applyStyles(button, {
          alignSelf: 'end',
          background: disabled ? 'var(--panel2)' : 'var(--accent)',
          border: '1px solid ' + (disabled ? 'var(--border)' : 'var(--accent)'),
          borderRadius: '9px',
          color: 'var(--text)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          minHeight: '38px',
          padding: '8px 12px'
        });
        return button;
      }

      function resetForProject(project) {
        state.token += 1;
        state.projectPath = project && project.path ? project.path : '';
        state.tags = [];
        state.tagsLoading = !!project;
        state.tagsError = '';
        state.sinceRef = '';
        state.version = '';
        state.commits = null;
        state.commitsLoading = false;
        state.commitsError = '';
        state.draft = '';
        state.drafting = false;
        state.draftError = '';
      }

      function renderProjectHint() {
        clear(container);
        container.appendChild(muted('Select a project to build a changelog.'));
      }

      function loadTags(projectPath, token) {
        ctx.bridge.invoke('feature:changelog:tags', projectPath)
          .then(function (tags) {
            if (token !== state.token) return;
            state.tags = Array.isArray(tags) ? tags.map(String) : [];
          })
          .catch(function (err) {
            if (token !== state.token) return;
            state.tags = [];
            state.tagsError = 'Could not load tags: ' + messageFromError(err);
          })
          .then(function () {
            if (token !== state.token) return;
            state.tagsLoading = false;
            render();
          });
      }

      function refreshProject() {
        var project = ctx.activeProject();
        resetForProject(project);
        if (!project) {
          renderProjectHint();
          return;
        }
        render();
        loadTags(project.path, state.token);
      }

      function loadCommits() {
        var project = ctx.activeProject();
        var token = state.token;

        if (!project || !project.path) {
          refreshProject();
          return;
        }

        state.commits = null;
        state.commitsLoading = true;
        state.commitsError = '';
        state.draft = '';
        state.draftError = '';
        render();

        var request = state.sinceRef
          ? ctx.bridge.invoke('feature:changelog:commits', project.path, state.sinceRef)
          : ctx.bridge.invoke('feature:changelog:commits', project.path);

        request
          .then(function (commits) {
            if (token !== state.token) return;
            state.commits = normalizeCommits(commits);
          })
          .catch(function (err) {
            if (token !== state.token) return;
            state.commits = [];
            state.commitsError = 'Could not load commits: ' + messageFromError(err);
          })
          .then(function () {
            if (token !== state.token) return;
            state.commitsLoading = false;
            render();
          });
      }

      function draftReleaseNotes() {
        var project = ctx.activeProject();
        var token = state.token;
        var version = trim(state.version);
        var payload;

        if (!project || !project.path || !state.commits || !state.commits.length) return;

        payload = {
          projectPath: project.path,
          commits: state.commits
        };

        if (version) {
          payload.version = version;
        }

        state.drafting = true;
        state.draft = '';
        state.draftError = '';
        render();

        ctx.bridge.invoke('feature:changelog:draft', payload)
          .then(function (draft) {
            if (token !== state.token) return;
            state.draft = String(draft || '');
            if (!state.draft) {
              state.draftError = 'No draft text was returned.';
            }
          })
          .catch(function (err) {
            if (token !== state.token) return;
            state.draftError = 'Could not draft release notes: ' + messageFromError(err);
          })
          .then(function () {
            if (token !== state.token) return;
            state.drafting = false;
            render();
          });
      }

      function copyDraft() {
        if (!state.draft) return;
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          ctx.toast('Clipboard unavailable');
          return;
        }
        navigator.clipboard.writeText(state.draft)
          .then(function () {
            ctx.toast('Copied');
          })
          .catch(function (err) {
            ctx.toast('Copy failed: ' + messageFromError(err));
          });
      }

      function renderControls(root) {
        var form = applyStyles(ctx.el('div'), {
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'minmax(180px, 1fr) minmax(150px, 1fr) auto auto'
        });
        var sinceWrap = applyStyles(ctx.el('label'), {
          color: 'var(--muted)',
          display: 'grid',
          fontSize: '12px',
          gap: '6px'
        });
        var sinceSelect = applyStyles(ctx.el('select'), {
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: '9px',
          color: 'var(--text)',
          minHeight: '38px',
          padding: '8px 10px'
        });
        var versionWrap = applyStyles(ctx.el('label'), {
          color: 'var(--muted)',
          display: 'grid',
          fontSize: '12px',
          gap: '6px'
        });
        var versionInput = applyStyles(ctx.el('input', {
          placeholder: '2.1.0',
          type: 'text',
          value: state.version
        }), {
          background: 'var(--code-bg)',
          border: '1px solid var(--border)',
          borderRadius: '9px',
          color: 'var(--text)',
          minHeight: '20px',
          padding: '8px 10px'
        });
        var loadDisabled = state.tagsLoading || state.commitsLoading || state.drafting;
        var draftDisabled = state.commitsLoading || state.drafting || !state.commits || !state.commits.length;
        var loadButton = makeButton(state.commitsLoading ? 'Loading…' : 'Load commits', loadDisabled);
        var draftButton = makeButton(state.drafting ? 'Drafting…' : 'Draft release notes', draftDisabled);

        sinceSelect.appendChild(ctx.el('option', { value: '', text: 'All history' }));
        state.tags.forEach(function (tag) {
          sinceSelect.appendChild(ctx.el('option', { value: tag, text: tag }));
        });
        sinceSelect.value = state.sinceRef;
        sinceSelect.disabled = loadDisabled;

        sinceSelect.addEventListener('change', function () {
          state.sinceRef = sinceSelect.value;
          state.commits = null;
          state.commitsError = '';
          state.draft = '';
          state.draftError = '';
          render();
        });

        versionInput.addEventListener('input', function () {
          state.version = versionInput.value;
        });

        loadButton.addEventListener('click', function () {
          if (!loadButton.disabled) loadCommits();
        });

        draftButton.addEventListener('click', function () {
          if (!draftButton.disabled) draftReleaseNotes();
        });

        sinceWrap.appendChild(ctx.el('span', { text: 'Since' }));
        sinceWrap.appendChild(sinceSelect);
        versionWrap.appendChild(ctx.el('span', { text: 'Version' }));
        versionWrap.appendChild(versionInput);
        form.appendChild(sinceWrap);
        form.appendChild(versionWrap);
        form.appendChild(loadButton);
        form.appendChild(draftButton);
        root.appendChild(form);
      }

      function renderCommits(root) {
        var section = applyStyles(ctx.el('section'), {
          display: 'grid',
          gap: '10px'
        });

        section.appendChild(applyStyles(ctx.el('h3', { text: 'Commits' }), {
          color: 'var(--text)',
          fontSize: '15px',
          margin: '0'
        }));

        if (state.commitsLoading) {
          section.appendChild(muted('Loading commits…'));
        } else if (state.commitsError) {
          section.appendChild(errorBlock(state.commitsError));
        } else if (state.commits) {
          section.appendChild(muted(state.commits.length + (state.commits.length === 1 ? ' commit' : ' commits')));
          if (!state.commits.length) {
            section.appendChild(muted('No commits found (is this a git repo?)'));
          } else {
            var list = applyStyles(ctx.el('div'), {
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              display: 'grid',
              maxHeight: '280px',
              overflow: 'auto'
            });
            state.commits.forEach(function (commit) {
              var row = applyStyles(ctx.el('div'), {
                borderBottom: '1px solid var(--border)',
                display: 'grid',
                gap: '10px',
                gridTemplateColumns: '110px 1fr',
                padding: '9px 12px'
              });
              row.appendChild(applyStyles(ctx.el('code', { text: commit.hash }), {
                color: 'var(--text)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }));
              row.appendChild(applyStyles(ctx.el('span', { text: commit.subject }), {
                color: 'var(--text)',
                fontSize: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }));
              list.appendChild(row);
            });
            section.appendChild(list);
          }
        } else {
          section.appendChild(muted('Choose a starting point, then load commits.'));
        }

        root.appendChild(section);
      }

      function renderDraft(root) {
        var section = applyStyles(ctx.el('section'), {
          display: 'grid',
          gap: '10px'
        });
        var headingRow = applyStyles(ctx.el('div'), {
          alignItems: 'center',
          display: 'flex',
          gap: '10px',
          justifyContent: 'space-between'
        });

        headingRow.appendChild(applyStyles(ctx.el('h3', { text: 'Release notes draft' }), {
          color: 'var(--text)',
          fontSize: '15px',
          margin: '0'
        }));

        if (state.draft) {
          var copyButton = makeButton('Copy', false);
          copyButton.addEventListener('click', copyDraft);
          headingRow.appendChild(copyButton);
        }

        section.appendChild(headingRow);

        if (state.drafting) {
          section.appendChild(muted('Drafting… This can take up to a minute.'));
        }

        if (state.draftError) {
          section.appendChild(errorBlock(state.draftError));
        }

        if (state.draft) {
          section.appendChild(applyStyles(ctx.el('pre', { text: state.draft }), {
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '13px',
            lineHeight: '1.55',
            margin: '0',
            overflow: 'auto',
            padding: '14px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }));
        } else if (!state.drafting && !state.draftError) {
          section.appendChild(muted('Load commits, then draft release notes.'));
        }

        root.appendChild(section);
      }

      function render() {
        var project = ctx.activeProject();
        var root;

        if (!project) {
          renderProjectHint();
          return;
        }

        clear(container);
        root = applyStyles(ctx.el('div'), {
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          color: 'var(--text)',
          display: 'grid',
          gap: '16px',
          padding: '18px'
        });

        root.appendChild(applyStyles(ctx.el('h2', { text: 'Changelog' }), {
          color: 'var(--text)',
          fontSize: '20px',
          margin: '0'
        }));
        root.appendChild(muted('Build release notes from ' + (project.name || project.path || 'the active project') + '.'));

        if (state.tagsLoading) {
          root.appendChild(muted('Loading tags…'));
        }

        if (state.tagsError) {
          root.appendChild(errorBlock(state.tagsError));
        }

        renderControls(root);
        renderCommits(root);
        renderDraft(root);
        container.appendChild(root);
      }

      var unsubscribe = ctx.onProjectChange(refreshProject);
      refreshProject();

      return function () {
        state.token += 1;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  });
}());
