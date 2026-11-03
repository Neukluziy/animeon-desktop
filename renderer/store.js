function createStore(initialState = {}, persist = () => {}) {
  const state = initialState && typeof initialState === 'object' && !Array.isArray(initialState) ? initialState : {};

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    state[key] = value;
    persist({ [key]: value });
    return value;
  }

  function patch(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) return;
    Object.assign(state, values);
    persist(values);
  }

  return { get, patch, set, state };
}

export { createStore };
