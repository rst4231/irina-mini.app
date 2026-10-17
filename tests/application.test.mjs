import test from 'node:test';
import assert from 'node:assert/strict';
import { getApplicationViewState } from '../application.js';

test('returns four distinct visual states for application lifecycle', () => {
  const incomplete = getApplicationViewState({ completed: false, approved: false, receivedTerms: false });
  const complete = getApplicationViewState({ completed: true, approved: false, receivedTerms: false });
  const approved = getApplicationViewState({ completed: true, approved: true, receivedTerms: false });
  const terms = getApplicationViewState({ completed: true, approved: true, receivedTerms: true });

  assert.equal(incomplete.icon, 'form');
  assert.equal(complete.icon, 'pending');
  assert.equal(approved.icon, 'approved');
  assert.equal(terms.icon, 'terms');
  assert.deepEqual(new Set([incomplete.tone, complete.tone, approved.tone, terms.tone]).size, 4);
});

test('preserves application actions and URLs', () => {
  const incomplete = getApplicationViewState({ completed: false, approved: false, receivedTerms: false });
  const approved = getApplicationViewState({ completed: true, approved: true, receivedTerms: false });
  const terms = getApplicationViewState({ completed: true, approved: true, receivedTerms: true });

  assert.equal(incomplete.action.url, 'https://t.me/rstshelp_bot?start=69de0afdde3f2d88240a95e8');
  assert.equal(approved.action.url, 'https://t.me/rstshelp_bot?start=6a3d21d4694618648d009d8d');
  assert.equal(terms.action.url, 'https://team.arbstart.tech/win-win/');
  assert.equal(terms.action.label, 'Посмотреть условия');
});

test('rejected applications override all other states and hide actions', () => {
  for (const state of [
    { completed: false, approved: false, receivedTerms: false },
    { completed: true, approved: false, receivedTerms: false },
    { completed: true, approved: true, receivedTerms: true },
  ]) {
    const view = getApplicationViewState({ ...state, rejected: true });
    assert.equal(view.status, 'Анкета не одобрена');
    assert.equal(view.tone, 'rejected');
    assert.equal(view.action, null);
  }
});
