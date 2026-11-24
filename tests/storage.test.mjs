import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, loadSessions, saveSessions, STORAGE_KEY } from '../js/storage.js';
const memory = () => { const values = new Map(); return {getItem:key => values.get(key),setItem:(key,value) => values.set(key,value)}; };
test('round-trips independent sessions and complete replies', () => {
  const storage = memory();
  const first = createSession('review');
  first.messages.push({role:'assistant',content:'رد محفوظ\nبسطر جديد'});
  const second = createSession('takeoff');
  assert.notEqual(first.id,second.id);
  assert.equal(saveSessions([first,second],storage),true);
  assert.deepEqual(loadSessions(storage),[first,second]);
});
test('handles blocked storage and quota failures explicitly', () => {
  const storage = {getItem:() => {throw Error('blocked');},setItem:() => {throw Error('quota');}};
  assert.deepEqual(loadSessions(storage),[]);
  assert.equal(saveSessions([createSession('design')],storage),false);
});
test('handles a browser that throws while accessing localStorage itself', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable:true,get:() => {throw Error('denied');}});
  try {
    assert.deepEqual(loadSessions(), []);
    assert.equal(saveSessions([]), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
test('invalid stored structures do not break the interface', () => {
  for (const value of ['{bad','null','{}','[null,1,{}]']) {
    const storage = memory(); storage.setItem(STORAGE_KEY,value);
    assert.deepEqual(loadSessions(storage),[]);
  }
});
