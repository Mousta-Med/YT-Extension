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
  'forward-10s': 'Forward 10 seconds'
};

// Fixed display order; chrome.commands.getAll() does not guarantee one.
const ORDER = ['toggle-play-pause', 'toggle-pip', 'backward-10s', 'forward-10s'];

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

function row(label, shortcut) {
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
    unset.className = 'unset';
    unset.textContent = 'Not set';
    li.append(unset);
  }

  return li;
}

async function render() {
  const commands = await chrome.commands.getAll();
  const byName = new Map(commands.map(c => [c.name, c]));

  const list = document.getElementById('commands');
  let unbound = 0;

  for (const name of ORDER) {
    const command = byName.get(name);
    if (!command) continue;
    if (!command.shortcut) unbound++;
    list.append(row(LABELS[name], command.shortcut));
  }

  const note = document.getElementById('note');
  if (unbound) {
    note.textContent = unbound === 1
      ? '1 shortcut is unassigned.'
      : `${unbound} shortcuts are unassigned.`;
    note.classList.add('warn');
  } else {
    note.textContent = 'Set each to "Global" to use them outside Chrome.';
  }
}

document.getElementById('open').addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
});

render();
