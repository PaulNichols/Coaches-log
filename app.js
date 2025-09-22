const STORAGE_KEY = 'coaching-log-state-v1';

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

let appState = loadState();
let currentFilters = {
  coach: '',
  coachee: '',
  status: '',
  date: '',
};

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

const referenceSectionsEl = document.getElementById('reference-sections');

const filterForm = document.getElementById('filter-form');
const filterCoachSelect = document.getElementById('filter-coach');
const filterCoacheeSelect = document.getElementById('filter-coachee');
const filterStatusSelect = document.getElementById('filter-status');
const filterDateInput = document.getElementById('filter-date');
const clearFiltersButton = document.getElementById('clear-filters');
const sessionsList = document.getElementById('sessions-list');
const exportJsonButton = document.getElementById('export-json');

let initialized = false;

export function initializeLogApp() {
  if (initialized) return;
  initialized = true;
  init();
}

function init() {
  attachNavigationHandlers();
  attachMenuToggle();
  menuToggle.setAttribute('aria-expanded', 'false');
  const defaultButton = document.querySelector('.nav__item--active') || navButtons[0];
  if (defaultButton) {
    activateView(defaultButton.dataset.target, defaultButton);
  }
  attachSessionFormHandlers();
  attachQuickViewHandlers();
  attachFilterHandlers();
  attachExportHandler();
  renderReferenceSections();
  refreshSelectOptions();
  setDefaultFormValues();
  renderSessionList();
  renderTodaySessions();
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const referenceData = {
        ...defaultState.referenceData,
        ...(parsed.referenceData || {}),
      };
      const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      return {
        referenceData: deepClone(referenceData),
        sessions: deepClone(sessions),
      };
    }
  } catch (error) {
    console.warn('Unable to load previous state', error);
  }
  return deepClone(defaultState);
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (error) {
    console.warn('Unable to save state', error);
    showToast('Unable to save changes (storage unavailable)');
  }
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
      appNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function attachMenuToggle() {
  menuToggle.addEventListener('click', () => {
    const isOpen = appNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function attachSessionFormHandlers() {
  sessionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(sessionForm);

    const newSession = {
      id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
      date: formData.get('date'),
      coach: formData.get('coach'),
      coachee: formData.get('coachee'),
      sessionType: formData.get('sessionType'),
      focusArea: formData.get('focusArea'),
      status: formData.get('status'),
      duration: formData.get('duration') ? Number(formData.get('duration')) : null,
      followUp: formData.get('followUp') || '',
      highlights: formData.get('highlights')?.trim() || '',
      actions: formData.get('actions')?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    appState.sessions = [newSession, ...appState.sessions];
    persistState();
    renderSessionList();
    renderTodaySessions();
    sessionForm.reset();
    setDefaultFormValues();
    showToast('Session saved');
  });

  sessionForm.addEventListener('reset', () => {
    window.setTimeout(setDefaultFormValues, 0);
  });
}

function attachQuickViewHandlers() {
  quickRefreshButton.addEventListener('click', () => {
    renderTodaySessions();
    showToast('Today view refreshed');
  });
}

function attachFilterHandlers() {
  filterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(filterForm);
    currentFilters = {
      coach: formData.get('coach') || '',
      coachee: formData.get('coachee') || '',
      status: formData.get('status') || '',
      date: formData.get('date') || '',
    };
    renderSessionList();
  });

  clearFiltersButton.addEventListener('click', () => {
    currentFilters = {
      coach: '',
      coachee: '',
      status: '',
      date: '',
    };
    filterForm.reset();
    renderSessionList();
  });
}

function attachExportHandler() {
  exportJsonButton.addEventListener('click', () => {
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

function setDefaultFormValues() {
  const today = new Date().toISOString().split('T')[0];
  sessionDateInput.value = today;
  if (appState.referenceData.coaches.length > 0) {
    sessionCoachSelect.value = sessionCoachSelect.value || appState.referenceData.coaches[0];
  }
  if (appState.referenceData.coachees.length > 0) {
    sessionCoacheeSelect.value = sessionCoacheeSelect.value || appState.referenceData.coachees[0];
  }
  if (appState.referenceData.sessionTypes.length > 0) {
    sessionTypeSelect.value = sessionTypeSelect.value || appState.referenceData.sessionTypes[0];
  }
  if (appState.referenceData.focusAreas.length > 0) {
    sessionFocusSelect.value = sessionFocusSelect.value || appState.referenceData.focusAreas[0];
  }
  if (appState.referenceData.statuses.length > 0) {
    sessionStatusSelect.value = sessionStatusSelect.value || appState.referenceData.statuses[0];
  }
}

function refreshSelectOptions() {
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
  });
  fillSelect(filterCoacheeSelect, appState.referenceData.coachees, {
    placeholder: 'All coachees',
    allowEmpty: true,
  });
  fillSelect(filterStatusSelect, appState.referenceData.statuses, {
    placeholder: 'All statuses',
    allowEmpty: true,
  });
}

function fillSelect(select, options, { placeholder, allowEmpty }) {
  const previousValue = select.value;
  select.innerHTML = '';
  if (allowEmpty) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }
  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
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

  select.disabled = options.length === 0 && !allowEmpty;
  const hasPrevious = options.includes(previousValue);
  if (hasPrevious) {
    select.value = previousValue;
  } else {
    select.value = allowEmpty ? '' : options[0] || '';
  }
}

function formatCount(count, config) {
  const label = count === 1 ? config.singular.toLowerCase() : config.label.toLowerCase();
  return `${count} ${label}`;
}

function renderReferenceSections() {
  referenceSectionsEl.innerHTML = '';
  Object.entries(categories).forEach(([key, config]) => {
    const card = document.createElement('section');
    card.className = 'reference-card';

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
        removeButton.addEventListener('click', () => {
          if (isValueInUse(key, value)) {
            showToast('Item is used in sessions and cannot be removed');
            return;
          }
          const confirmed = confirm(`Remove "${value}" from ${config.label}?`);
          if (!confirmed) return;
          appState.referenceData[key] = appState.referenceData[key].filter((itemValue) => itemValue !== value);
          persistState();
          refreshSelectOptions();
          renderReferenceSections();
          showToast(`${config.singular} removed`);
        });
        item.append(text, removeButton);
        list.appendChild(item);
      });
      card.append(list);
    }

    const form = document.createElement('form');
    form.className = 'reference-card__form';
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

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      if (appState.referenceData[key].some((entry) => entry.toLowerCase() === value.toLowerCase())) {
        showToast('That entry already exists');
        return;
      }
      appState.referenceData[key] = [...appState.referenceData[key], value];
      persistState();
      input.value = '';
      input.focus();
      refreshSelectOptions();
      renderReferenceSections();
      showToast(`${config.singular} added`);
    });

    referenceSectionsEl.appendChild(card);
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

function renderSessionList() {
  sessionsList.innerHTML = '';
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
  todaySessionsList.innerHTML = '';
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

function showToast(message) {
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
