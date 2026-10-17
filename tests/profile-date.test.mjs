import test from 'node:test';
import assert from 'node:assert/strict';
import * as profile from '../profile.js';

test('profile shows localized weekday and full date, including the year',()=>{
 const date=new Date('2026-10-17T12:00:00Z');
 assert.equal(profile.formatProfileDate?.(date,'en'),'Saturday, October 17, 2026');
 assert.equal(profile.formatProfileDate(date,'ru'),'Суббота, 17 октября 2026 г.');
});
