import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../package/web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../package/web/compact.css',import.meta.url),'utf8');
// The old 1.5-second Cloud polling repainted every open actor picker,
// detaching its DOM during a selection or scrollbar drag.
assert.match(app,/renderPage&&\(changed\|\|appliedReviews\)&&!modal\.open&&!isActorPickerOpen\(\)/);
assert.match(app,/if\(!modal\.open&&!isActorPickerOpen\(\)\)render\(\)/);
assert.match(app,/function positionActorPickerMenu\(picker\)/);
assert.match(app,/document\.addEventListener\('scroll',event=>\{/);
assert.match(app,/positionActorPickerMenu\(document\.querySelector/);
assert.match(app,/if\(isActorPickerOpen\(\)&&!event\.target\.closest\('\.actor-picker'\)\)closeActorPickers\(\)/);
assert.ok(!app.includes("if(!event.target.closest('.actor-picker'))closeActorPickers();"),
  'mouse up/click must not dismiss the dropdown after scrollbar drag');
assert.match(css,/\.actor-picker-menu:not\(\[hidden\]\)\{overscroll-behavior:contain/);
console.log('PASS: actor casting dropdown preserves open state while scrolling and Cloud polls');
