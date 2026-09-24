// Popup: shows the live shortcut bindings and links to Chrome's shortcut editor.
//
// Chrome deliberately provides no API for an extension to set its own shortcuts
// (chrome.commands.update is Firefox-only), so rebinding has to happen on
// chrome://extensions/shortcuts. The most we can do is surface the current state
// and get the user there in one click.

const LABELS = {
  'toggle-play-pause': 'Play / pause',
  'toggle-pip': 'Picture-in-Picture',
  'backward-10s': 'Back 10 seconds',
  'forward-10s': 'Forward 10 seconds',
  'next-video': 'Next video',
  'previous-video': 'Previous video',
  'toggle-mute': 'Mute / unmute',
  'volume-up': 'Volume up',
  'volume-down': 'Volume down',
  'speed-up': 'Speed up',
  'speed-down': 'Slow down'
};

// Fixed display order; chrome.commands.getAll() does not guarantee one.
// Chrome lets an extension ship default keys for at most four commands, so
// these four have them and the extras start unassigned by design. An unset
// extra is a choice left to the user, not a fault worth a warning.
const CORE = ['toggle-play-pause', 'toggle-pip', 'backward-10s', 'forward-10s'];
const EXTRAS = [
  'next-video',
  'previous-video',
  'toggle-mute',
  'volume-up',
  'volume-down',
  'speed-up',
  'speed-down'
];

function keysFragment(shortcut) {
  const frag = document.createDocumentFragment();
  shortcut.split('+').forEach((key, i) => {
    if (i) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '+';
      frag.append(sep);
    }
    const kbd = document.createElement('kbd');
    kbd.textContent = key;
    frag.append(kbd);
  });
  return frag;
}

function row(label, shortcut, optional) {
  const li = document.createElement('li');

  const name = document.createElement('span');
  name.textContent = label;
  li.append(name);

  if (shortcut) {
    const keys = document.createElement('span');
    keys.className = 'keys';
    keys.append(keysFragment(shortcut));
    li.append(keys);
  } else {
    const unset = document.createElement('span');
    unset.className = optional ? 'unset optional' : 'unset';
    unset.textContent = 'Not set';
    li.append(unset);
  }

  return li;
}

async function render() {
  const commands = await chrome.commands.getAll();
  const byName = new Map(commands.map(c => [c.name, c]));

  // Returns how many of the listed commands have no shortcut.
  const fill = (listId, names, optional) => {
    const list = document.getElementById(listId);
    let unbound = 0;
    for (const name of names) {
      const command = byName.get(name);
      if (!command) continue;
      if (!command.shortcut) unbound++;
      list.append(row(LABELS[name], command.shortcut, optional));
    }
    return unbound;
  };

  const unbound = fill('commands', CORE, false);
  const extrasUnbound = fill('extras', EXTRAS, true);

  const note = document.getElementById('note');
  if (unbound) {
    note.textContent = unbound === 1
      ? '1 shortcut is unassigned.'
      : `${unbound} shortcuts are unassigned.`;
    note.classList.add('warn');
  } else if (extrasUnbound) {
    // Chrome gives a key the user adds the "In Chrome" scope, whatever the
    // manifest says, so the extras need switching to Global by hand.
    note.textContent = 'Give extras a key and set them to "Global".';
  } else {
    note.textContent = 'Set each to "Global" to use them outside Chrome.';
  }
}

document.getElementById('open').addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
});

render();
