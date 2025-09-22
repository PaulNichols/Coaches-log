const API_BASE = '/api';

const defaultState = {
  referenceData: {
    coaches: ['Alex Morgan', 'Priya Patel', 'Jonas Eriksen'],
    coachees: ['Jordan Lee', 'Mina Chen', 'Samuel Ortiz', 'Taylor Brooks'],
    sessionTypes: ['1:1 Coaching', 'Career Planning', 'Onboarding Support', 'Performance Review'],
    focusAreas: ['Leadership', 'Communication', 'Strategy', 'Well-being'],
    statuses: ['Scheduled', 'Completed', 'Rescheduled', 'Cancelled'],
  },
  sessions: [],
};

const categories = {
  coaches: {
    label: 'Coaches',
    singular: 'Coach',
    description: 'People delivering the coaching conversations.',
    addLabel: 'Add coach',
  },
  coachees: {
    label: 'Coachees',
    singular: 'Coachee',
    description: 'Individuals receiving coaching.',
    addLabel: 'Add coachee',
  },
  sessionTypes: {
    label: 'Session types',
    singular: 'Session type',
    description: 'Formats of the coaching conversation.',
    addLabel: 'Add session type',
  },
  focusAreas: {
    label: 'Focus areas',
    singular: 'Focus area',
    description: 'Themes or goals discussed.',
    addLabel: 'Add focus area',
  },
  statuses: {
    label: 'Statuses',
    singular: 'Status',
    description: 'Stage of each session.',
    addLabel: 'Add status',
  },
};

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

let appState = deepClone(defaultState);
let currentFilters = {
  coach: '',
  coachee: '',
  status: '',
  date: '',
};

let initialized = false;
let dataLoaded = false;
let loadErrorMessage = '';

const adminAppRoot = document.getElementById('admin-app');
const adminLoadingNotice = document.getElementById('admin-loading');
const adminErrorNotice = document.getElementById('admin-error');

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav__item');
const appNav = document.getElementById('app-nav');
const menuToggle = document.getElementById('menu-toggle');
const toastEl = document.getElementById('toast');

const sessionForm = document.getElementById('session-form');
const sessionDateInput = document.getElementById('session-date');
const sessionCoachSelect = document.getElementById('session-coach');
const sessionCoacheeSelect = document.getElementById('session-coachee');
const sessionTypeSelect = document.getElementById('session-type');
const sessionFocusSelect = document.getElementById('session-focus');
const sessionStatusSelect = document.getElementById('session-status');

const quickRefreshButton = document.getElementById('quick-refresh');
const todaySessionsList = document.getElementById('today-sessions');
const todayEmptyState = document.getElementById('today-empty');
const defaultTodayEmptyText = todayEmptyState ? todayEmptyState.textContent : '';

const referenceSectionsEl = document.getElementById('reference-sections');

const filterForm = document.getElementById('filter-form');
const filterCoachSelect = document.getElementById('filter-coach');
const filterCoacheeSelect = document.getElementById('filter-coachee');
const filterStatusSelect = document.getElementById('filter-status');
const filterDateInput = document.getElementById('filter-date');
const clearFiltersButton = document.getElementById('clear-filters');
const sessionsList = document.getElementById('sessions-list');
const exportJsonButton = document.getElementById('export-json');

export async function initializeLogApp() {
  if (initialized) return;
  initialized = true;

  attachNavigationHandlers();
  attachMenuToggle();
  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  const defaultButton = document.querySelector('.nav__item--active') || navButtons[0];
  if (defaultButton) {
    activateView(defaultButton.dataset.target, defaultButton);
  }

  attachSessionFormHandlers();
  attachQuickViewHandlers();
  attachFilterHandlers();
  attachExportHandler();

  setLoadingState(true);
  try {
    await reloadState();
  } catch (error) {
    console.error('Failed to load dashboard data', error);
    loadErrorMessage = error instanceof Error ? error.message : 'Unable to load data from the server.';
    dataLoaded = false;
    setErrorMessage('Unable to load data from the server. Start the backend and refresh to try again.');
    refreshSelectOptions();
    renderReferenceSections();
    renderSessionList();
    renderTodaySessions();
    throw error;
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  if (adminAppRoot) {
    if (isLoading) {
      adminAppRoot.setAttribute('aria-busy', 'true');
    } else {
      adminAppRoot.removeAttribute('aria-busy');
    }
  }
  if (adminLoadingNotice) {
    adminLoadingNotice.hidden = !isLoading;
  }
}

function setErrorMessage(message) {
  if (!adminErrorNotice) return;
  if (!message) {
    adminErrorNotice.hidden = true;
    adminErrorNotice.textContent = '';
    return;
  }
  adminErrorNotice.hidden = false;
  adminErrorNotice.textContent = message;
}

function activateView(targetId, activeButton) {
  if (!targetId && activeButton) {
    targetId = activeButton.dataset.target;
  }
  if (!targetId) return;

  navButtons.forEach((btn) => {
    const isActive = btn === activeButton || btn.dataset.target === targetId;
    btn.classList.toggle('nav__item--active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  views.forEach((view) => {
    view.classList.toggle('view--active', view.id === targetId);
  });
}

function attachNavigationHandlers() {
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      activateView(targetId, button);
      if (appNav) {
        appNav.classList.remove('open');
      }
      if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

function attachMenuToggle() {
  if (!menuToggle) return;
  menuToggle.addEventListener('click', () => {
    const isOpen = appNav ? appNav.classList.toggle('open') : false;
    menuToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });
}

function attachSessionFormHandlers() {
  if (!sessionForm) return;

  sessionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!dataLoaded) {
      showToast(loadErrorMessage || 'Dashboard data is still loading');
      return;
    }

    const formData = new FormData(sessionForm);
    const payload = {
      date: (formData.get('date') || '').toString(),
      coach: (formData.get('coach') || '').toString(),
      coachee: (formData.get('coachee') || '').toString(),
      sessionType: (formData.get('sessionType') || '').toString(),
      focusArea: (formData.get('focusArea') || '').toString(),
      status: (formData.get('status') || '').toString(),
      duration: parseDurationValue(formData.get('duration')),
      followUp: (formData.get('followUp') || '').toString(),
      highlights: (formData.get('highlights') || '').toString().trim(),
      actions: (formData.get('actions') || '').toString().trim(),
    };

    try {
      setFormBusy(sessionForm, true);
      const savedSession = await createSession(payload);
      appState.sessions = [savedSession, ...appState.sessions];
      renderSessionList();
      renderTodaySessions();
      sessionForm.reset();
      setDefaultFormValues();
      showToast('Session saved');
    } catch (error) {
      console.error('Failed to save session', error);
      const message = error instanceof Error ? error.message : 'Unable to save session';
      showToast(message);
    } finally {
      setFormBusy(sessionForm, false);
    }
  });

  sessionForm.addEventListener('reset', () => {
    window.setTimeout(() => {
      if (dataLoaded) {
        setDefaultFormValues();
      }
    }, 0);
  });
}

function attachQuickViewHandlers() {
  if (!quickRefreshButton) return;
  quickRefreshButton.addEventListener('click', async () => {
    try {
      setButtonBusy(quickRefreshButton, true);
      await reloadState();
      showToast('Dashboard synced');
    } catch (error) {
      console.error('Failed to refresh dashboard data', error);
      const message = error instanceof Error ? error.message : 'Unable to refresh data.';
      if (!dataLoaded) {
        loadErrorMessage = message;
        renderReferenceSections();
        renderSessionList();
        renderTodaySessions();
      }
      setErrorMessage(message);
      showToast(message);
    } finally {
      setButtonBusy(quickRefreshButton, false);
    }
  });
}

function attachFilterHandlers() {
  if (!filterForm) return;

  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!dataLoaded) {
      showToast(loadErrorMessage || 'Dashboard data is still loading');
      return;
    }
    const formData = new FormData(filterForm);
    currentFilters = {
      coach: (formData.get('coach') || '').toString(),
      coachee: (formData.get('coachee') || '').toString(),
      status: (formData.get('status') || '').toString(),
      date: (formData.get('date') || '').toString(),
    };
    renderSessionList();
  });

  if (clearFiltersButton) {
    clearFiltersButton.addEventListener('click', () => {
      currentFilters = {
        coach: '',
        coachee: '',
        status: '',
        date: '',
      };
      filterForm.reset();
      if (dataLoaded) {
        renderSessionList();
      }
    });
  }
}

function attachExportHandler() {
  if (!exportJsonButton) return;
  exportJsonButton.addEventListener('click', () => {
    if (!dataLoaded) {
      showToast(loadErrorMessage || 'Dashboard data is still loading');
      return;
    }
    const data = JSON.stringify(appState, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coaching-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Exported data as JSON');
  });
}

async function reloadState() {
  const state = await fetchStateFromServer();
  applyState(state);
  dataLoaded = true;
  loadErrorMessage = '';
  setErrorMessage('');
  renderReferenceSections();
  refreshSelectOptions();
  setDefaultFormValues();
  renderSessionList();
  renderTodaySessions();
}

async function fetchStateFromServer() {
  return requestJson('/state');
}

async function createSession(payload) {
  return requestJson('/sessions', {
    method: 'POST',
    body: payload,
  });
}

async function addReferenceItem(category, value) {
  return requestJson(`/reference/${category}`, {
    method: 'POST',
    body: { value },
  });
}

async function removeReferenceItem(category, value) {
  return requestJson(`/reference/${category}?value=${encodeURIComponent(value)}`, {
    method: 'DELETE',
  });
}

async function requestJson(path, { method = 'GET', body } = {}) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: {
      Accept: 'application/json',
    },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error('Unable to reach the server. Check that it is running and try again.');
  }

  if (!response.ok) {
    const message = await readErrorResponse(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function readErrorResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await response.json();
      if (data && typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message;
      }
    } catch (error) {
      // fall through to text parsing
    }
  }

  try {
    const text = await response.text();
    if (text && text.trim().length > 0) {
      return text.trim();
    }
  } catch (error) {
    // ignore
  }

  return `Request failed with status ${response.status}`;
}

function applyState(nextState) {
  const safeState = nextState && typeof nextState === 'object' ? nextState : {};
  const referenceData = {};

  Object.entries(defaultState.referenceData).forEach(([key, fallback]) => {
    const incoming = Array.isArray(safeState.referenceData?.[key]) ? safeState.referenceData[key] : undefined;
    if (Array.isArray(incoming)) {
      referenceData[key] = incoming
        .map((item) => (typeof item === 'string' ? item : String(item)))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    } else {
      referenceData[key] = deepClone(fallback);
    }
  });

  const sessions = Array.isArray(safeState.sessions)
    ? safeState.sessions.map((session) => normalizeSessionData(session)).filter(Boolean)
    : [];

  appState = {
    referenceData,
    sessions,
  };
}

function normalizeSessionData(session) {
  if (!session || typeof session !== 'object') return null;
  const normalized = {
    id:
      typeof session.id === 'string' && session.id.trim().length > 0
        ? session.id
        : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: typeof session.date === 'string' ? session.date : '',
    coach: typeof session.coach === 'string' ? session.coach : '',
    coachee: typeof session.coachee === 'string' ? session.coachee : '',
    sessionType: typeof session.sessionType === 'string' ? session.sessionType : '',
    focusArea: typeof session.focusArea === 'string' ? session.focusArea : '',
    status: typeof session.status === 'string' ? session.status : '',
    duration: parseDurationValue(session.duration),
    followUp: typeof session.followUp === 'string' ? session.followUp : '',
    highlights: typeof session.highlights === 'string' ? session.highlights : '',
    actions: typeof session.actions === 'string' ? session.actions : '',
    createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString(),
  };

  return normalized;
}

function parseDurationValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function renderReferenceSections() {
  if (!referenceSectionsEl) return;
  referenceSectionsEl.innerHTML = '';

  if (!dataLoaded) {
    const loading = document.createElement('p');
    loading.className = 'quick-view__empty';
    loading.textContent = loadErrorMessage || 'Loading reference data…';
    referenceSectionsEl.appendChild(loading);
    return;
  }

  Object.entries(categories).forEach(([key, config]) => {
    const card = document.createElement('section');
    card.className = 'reference-card';
    card.dataset.category = key;

    const header = document.createElement('div');
    header.className = 'reference-card__header';

    const title = document.createElement('h2');
    title.className = 'reference-card__title';
    title.textContent = config.label;

    const count = document.createElement('span');
    count.className = 'reference-card__count';
    count.textContent = formatCount(appState.referenceData[key].length, config);

    header.append(title, count);

    const description = document.createElement('p');
    description.className = 'view__description';
    description.textContent = config.description;
    card.append(header, description);

    const items = appState.referenceData[key];
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'quick-view__empty';
      empty.textContent = 'No items yet. Add one below.';
      card.append(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'reference-card__list';
      items.forEach((value) => {
        const item = document.createElement('li');
        item.className = 'reference-card__pill';

        const text = document.createElement('span');
        text.textContent = value;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.setAttribute('aria-label', `Remove ${value}`);
        removeButton.innerHTML = '×';
        removeButton.addEventListener('click', async () => {
          if (!dataLoaded) {
            showToast(loadErrorMessage || 'Dashboard data is still loading');
            return;
          }
          if (isValueInUse(key, value)) {
            showToast('Item is used in sessions and cannot be removed');
            return;
          }
          const confirmed = window.confirm(`Remove "${value}" from ${config.label}?`);
          if (!confirmed) return;
          try {
            setButtonBusy(removeButton, true);
            const updatedList = await removeReferenceItem(key, value);
            appState.referenceData[key] = Array.isArray(updatedList) ? updatedList : [];
            renderReferenceSections();
            refreshSelectOptions();
            setDefaultFormValues();
            renderSessionList();
            focusReferenceInput(key);
            showToast(`${config.singular} removed`);
          } catch (error) {
            console.error('Failed to remove reference entry', error);
            const message = error instanceof Error ? error.message : 'Unable to remove item';
            showToast(message);
          } finally {
            setButtonBusy(removeButton, false);
          }
        });

        item.append(text, removeButton);
        list.appendChild(item);
      });
      card.append(list);
    }

    const form = document.createElement('form');
    form.className = 'reference-card__form';
    form.dataset.category = key;
    form.setAttribute('autocomplete', 'off');

    const input = document.createElement('input');
    input.type = 'text';
    input.required = true;
    input.placeholder = config.addLabel;

    const addButton = document.createElement('button');
    addButton.type = 'submit';
    addButton.className = 'button button--primary';
    addButton.textContent = config.addLabel;

    form.append(input, addButton);
    card.append(form);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!dataLoaded) {
        showToast(loadErrorMessage || 'Dashboard data is still loading');
        return;
      }
      const value = input.value.trim();
      if (!value) return;
      if (appState.referenceData[key].some((entry) => entry.toLowerCase() === value.toLowerCase())) {
        showToast('That entry already exists');
        return;
      }
      try {
        setButtonBusy(addButton, true);
        const updatedList = await addReferenceItem(key, value);
        appState.referenceData[key] = Array.isArray(updatedList) ? updatedList : [];
        renderReferenceSections();
        refreshSelectOptions();
        setDefaultFormValues();
        focusReferenceInput(key);
        showToast(`${config.singular} added`);
      } catch (error) {
        console.error('Failed to add reference entry', error);
        const message = error instanceof Error ? error.message : 'Unable to add entry';
        showToast(message);
      } finally {
        setButtonBusy(addButton, false);
      }
    });

    referenceSectionsEl.appendChild(card);
  });
}

function formatCount(count, config) {
  const label = count === 1 ? config.singular.toLowerCase() : config.label.toLowerCase();
  return `${count} ${label}`;
}

function refreshSelectOptions() {
  if (!sessionCoachSelect || !sessionCoacheeSelect || !sessionTypeSelect || !sessionFocusSelect || !sessionStatusSelect) {
    return;
  }

  if (!dataLoaded) {
    [
      sessionCoachSelect,
      sessionCoacheeSelect,
      sessionTypeSelect,
      sessionFocusSelect,
      sessionStatusSelect,
      filterCoachSelect,
      filterCoacheeSelect,
      filterStatusSelect,
    ].forEach((select) => {
      if (!select) return;
      select.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = loadErrorMessage || 'Loading…';
      select.appendChild(option);
      select.disabled = true;
    });
    return;
  }

  fillSelect(sessionCoachSelect, appState.referenceData.coaches, {
    placeholder: 'Select coach',
    allowEmpty: false,
  });
  fillSelect(sessionCoacheeSelect, appState.referenceData.coachees, {
    placeholder: 'Select coachee',
    allowEmpty: false,
  });
  fillSelect(sessionTypeSelect, appState.referenceData.sessionTypes, {
    placeholder: 'Select session type',
    allowEmpty: false,
  });
  fillSelect(sessionFocusSelect, appState.referenceData.focusAreas, {
    placeholder: 'Select focus area',
    allowEmpty: false,
  });
  fillSelect(sessionStatusSelect, appState.referenceData.statuses, {
    placeholder: 'Select status',
    allowEmpty: false,
  });

  fillSelect(filterCoachSelect, appState.referenceData.coaches, {
    placeholder: 'All coaches',
    allowEmpty: true,
    value: currentFilters.coach,
  });
  fillSelect(filterCoacheeSelect, appState.referenceData.coachees, {
    placeholder: 'All coachees',
    allowEmpty: true,
    value: currentFilters.coachee,
  });
  fillSelect(filterStatusSelect, appState.referenceData.statuses, {
    placeholder: 'All statuses',
    allowEmpty: true,
    value: currentFilters.status,
  });

  currentFilters = {
    coach:
      filterCoachSelect && appState.referenceData.coaches.includes(filterCoachSelect.value)
        ? filterCoachSelect.value
        : '',
    coachee:
      filterCoacheeSelect && appState.referenceData.coachees.includes(filterCoacheeSelect.value)
        ? filterCoacheeSelect.value
        : '',
    status:
      filterStatusSelect && appState.referenceData.statuses.includes(filterStatusSelect.value)
        ? filterStatusSelect.value
        : '',
    date: currentFilters.date,
  };

  if (filterCoachSelect) {
    filterCoachSelect.value = currentFilters.coach;
  }
  if (filterCoacheeSelect) {
    filterCoacheeSelect.value = currentFilters.coachee;
  }
  if (filterStatusSelect) {
    filterStatusSelect.value = currentFilters.status;
  }
}

function fillSelect(select, options, { placeholder, allowEmpty, value }) {
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = '';

  if (allowEmpty) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }

  options.forEach((item) => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });

  if (!allowEmpty && options.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Add items from reference data';
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = !allowEmpty && options.length === 0;

  const targetValue = value !== undefined ? value : previousValue;

  if (allowEmpty && targetValue === '') {
    select.value = '';
    return;
  }

  if (options.includes(targetValue)) {
    select.value = targetValue;
  } else {
    select.value = allowEmpty ? '' : options[0] || '';
  }
}

function setDefaultFormValues() {
  if (!dataLoaded || !sessionDateInput) return;
  const today = new Date().toISOString().split('T')[0];
  sessionDateInput.value = today;

  if (appState.referenceData.coaches.length > 0 && sessionCoachSelect) {
    sessionCoachSelect.value = sessionCoachSelect.value || appState.referenceData.coaches[0];
  }
  if (appState.referenceData.coachees.length > 0 && sessionCoacheeSelect) {
    sessionCoacheeSelect.value = sessionCoacheeSelect.value || appState.referenceData.coachees[0];
  }
  if (appState.referenceData.sessionTypes.length > 0 && sessionTypeSelect) {
    sessionTypeSelect.value = sessionTypeSelect.value || appState.referenceData.sessionTypes[0];
  }
  if (appState.referenceData.focusAreas.length > 0 && sessionFocusSelect) {
    sessionFocusSelect.value = sessionFocusSelect.value || appState.referenceData.focusAreas[0];
  }
  if (appState.referenceData.statuses.length > 0 && sessionStatusSelect) {
    sessionStatusSelect.value = sessionStatusSelect.value || appState.referenceData.statuses[0];
  }
}

function renderSessionList() {
  if (!sessionsList) return;
  sessionsList.innerHTML = '';

  if (!dataLoaded) {
    const loading = document.createElement('p');
    loading.className = 'quick-view__empty';
    loading.textContent = loadErrorMessage || 'Loading sessions…';
    sessionsList.appendChild(loading);
    return;
  }

  const filteredSessions = appState.sessions.filter((session) => {
    if (currentFilters.coach && session.coach !== currentFilters.coach) return false;
    if (currentFilters.coachee && session.coachee !== currentFilters.coachee) return false;
    if (currentFilters.status && session.status !== currentFilters.status) return false;
    if (currentFilters.date && session.date !== currentFilters.date) return false;
    return true;
  });

  if (filteredSessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'quick-view__empty';
    empty.textContent = 'No sessions match the filters yet.';
    sessionsList.appendChild(empty);
    return;
  }

  filteredSessions
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .forEach((session) => {
      const item = document.createElement('article');
      item.className = 'timeline__item';

      const title = document.createElement('h2');
      title.textContent = `${session.coachee} with ${session.coach}`;
      title.className = 'view__title';
      title.style.fontSize = '1.1rem';

      const meta = document.createElement('div');
      meta.className = 'timeline__meta';
      const dateSpan = document.createElement('span');
      dateSpan.textContent = formatDisplayDate(session.date);
      const durationSpan = document.createElement('span');
      if (session.duration) {
        durationSpan.textContent = `${session.duration} min`;
      }
      const followUpSpan = document.createElement('span');
      if (session.followUp) {
        followUpSpan.textContent = `Follow-up: ${formatDisplayDate(session.followUp)}`;
      }
      meta.append(dateSpan);
      if (durationSpan.textContent) meta.append(durationSpan);
      if (followUpSpan.textContent) meta.append(followUpSpan);

      const tags = document.createElement('div');
      tags.className = 'timeline__tags';
      [session.sessionType, session.focusArea, session.status]
        .filter(Boolean)
        .forEach((tagText) => {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = tagText;
          tags.appendChild(tag);
        });

      item.append(title);
      item.append(meta);
      if (tags.children.length > 0) {
        item.append(tags);
      }

      if (session.highlights) {
        const highlightsHeading = document.createElement('strong');
        highlightsHeading.textContent = 'Highlights';
        const highlights = document.createElement('p');
        highlights.className = 'timeline__note';
        highlights.textContent = session.highlights;
        item.append(highlightsHeading, highlights);
      }

      if (session.actions) {
        const actionsHeading = document.createElement('strong');
        actionsHeading.textContent = 'Next actions';
        const actions = document.createElement('p');
        actions.className = 'timeline__note';
        actions.textContent = session.actions;
        item.append(actionsHeading, actions);
      }

      sessionsList.appendChild(item);
    });
}

function renderTodaySessions() {
  if (!todaySessionsList || !todayEmptyState) return;
  todaySessionsList.innerHTML = '';

  if (!dataLoaded) {
    todayEmptyState.hidden = false;
    todayEmptyState.textContent = loadErrorMessage || "Loading today's sessions…";
    return;
  }

  todayEmptyState.textContent = defaultTodayEmptyText;
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = appState.sessions.filter((session) => session.date === today);

  if (todaySessions.length === 0) {
    todayEmptyState.hidden = false;
    return;
  }

  todayEmptyState.hidden = true;
  todaySessions.slice(0, 5).forEach((session) => {
    const item = document.createElement('li');
    item.className = 'quick-view__item';
    const primary = document.createElement('div');
    primary.className = 'quick-view__primary';
    const name = document.createElement('strong');
    name.textContent = session.coachee;
    const detail = document.createElement('span');
    detail.className = 'quick-view__detail';
    detail.textContent = session.sessionType;
    primary.append(name, detail);

    const secondary = document.createElement('span');
    secondary.className = 'quick-view__status';
    secondary.textContent = session.status;

    item.append(primary, secondary);
    todaySessionsList.appendChild(item);
  });
}

function isValueInUse(categoryKey, value) {
  return appState.sessions.some((session) => {
    switch (categoryKey) {
      case 'coaches':
        return session.coach === value;
      case 'coachees':
        return session.coachee === value;
      case 'sessionTypes':
        return session.sessionType === value;
      case 'focusAreas':
        return session.focusArea === value;
      case 'statuses':
        return session.status === value;
      default:
        return false;
    }
  });
}

function setFormBusy(form, isBusy) {
  if (!form) return;
  const controls = form.querySelectorAll('input, select, textarea, button');
  controls.forEach((control) => {
    if (isBusy) {
      control.dataset.prevDisabled = control.disabled ? 'true' : 'false';
      control.disabled = true;
    } else {
      const wasDisabled = control.dataset.prevDisabled === 'true';
      delete control.dataset.prevDisabled;
      control.disabled = wasDisabled;
    }
  });
  if (isBusy) {
    form.setAttribute('aria-busy', 'true');
  } else {
    form.removeAttribute('aria-busy');
  }
}

function setButtonBusy(button, isBusy) {
  if (!button) return;
  if (isBusy) {
    button.dataset.prevDisabled = button.disabled ? 'true' : 'false';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    const wasDisabled = button.dataset.prevDisabled === 'true';
    delete button.dataset.prevDisabled;
    button.disabled = wasDisabled;
    button.removeAttribute('aria-busy');
  }
}

function focusReferenceInput(category) {
  if (!referenceSectionsEl) return;
  window.requestAnimationFrame(() => {
    const nextForm = referenceSectionsEl.querySelector(`form[data-category="${category}"] input`);
    if (nextForm) {
      nextForm.focus();
    }
  });
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2400);
}

function formatDisplayDate(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  } catch (error) {
    return date;
  }
}
