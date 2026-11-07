function createStore(max) { const results = []; const unparsed = []; return {
  addResult: r => { results.unshift(r); if (results.length > max) results.pop(); },
  addUnparsed: e => { unparsed.unshift(e); if (unparsed.length > max) unparsed.pop(); },
  latest: () => results[0] || null,
  list: (offset = 0, limit = 50) => ({ total: results.length, offset, limit, items: results.slice(offset, offset + limit) }),
  status: () => ({ storedResults: results.length, unparsedEvents: unparsed.length })
}; }
module.exports = { createStore };
