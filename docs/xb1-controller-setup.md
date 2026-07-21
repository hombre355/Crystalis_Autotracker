# Xbox controller bridge — one-time setup

The tracker can start your XB1 Classic Controller bridge automatically when you launch a
game, so the controller drives Mesen without opening a terminal. This runs the tools in
`/Users/mrowe/Personal_Project/xb1 controller`:

```
sudo -n xb1-gip-probe --stream | xb1-keyboard-mapper --config configs/nes-keyboard.conf
```

The probe needs root only to claim the controller's raw USB interface (libusb); the mapper
runs as your normal user so its Accessibility permission belongs to your account. Three
one-time steps are required — the app cannot do these for you because they need root and a
System Settings change.

## 1. Build the tools (only if not already built)

```sh
brew install libusb
cd "/Users/mrowe/Personal_Project/xb1 controller"
make check     # builds build/xb1-gip-probe + build/xb1-keyboard-mapper and self-tests them
```

The tracker's **Settings → Xbox controller** row must point at that project folder (it
auto-detects `~/Personal_Project/xb1 controller`).

## 2. Passwordless sudo for the probe (no password stored anywhere)

Instead of storing your password, add a `sudoers` rule that lets *only* the probe binary run
without a prompt. In the app, click **Show sudoers rule** to copy the exact line for your
username and path, then:

```sh
sudo visudo -f /etc/sudoers.d/xb1-autotracker
```

Paste the line and save. It looks like this (yours is generated from your actual path/user):

```
mrowe ALL=(root) NOPASSWD: /Users/mrowe/Personal_Project/xb1\ controller/build/xb1-gip-probe, /usr/bin/killall xb1-gip-probe
```

Notes:
- The space in the folder name **must** stay backslash-escaped — a mangled path silently
  denies. Use the app's copy button to avoid typos.
- The second command (`killall`) lets the app stop the root probe cleanly when Mesen closes.
- The app runs the probe with `sudo -n` (non-interactive): with this rule it's silent;
  without it, launching fails immediately with a hint instead of hanging on a password prompt.

### Security note

This rule trusts the binary at that path: anyone who can overwrite
`build/xb1-gip-probe` would then run code as root. That file lives in your home directory,
which only you can write, so on a single-user Mac this is low risk. To harden it, copy the
built binary to a root-owned location and point the rule there instead:

```sh
sudo install -o root -m 755 "/Users/mrowe/Personal_Project/xb1 controller/build/xb1-gip-probe" /usr/local/bin/xb1-gip-probe
# then use /usr/local/bin/xb1-gip-probe in the sudoers rule (no space to escape)
```

## 3. Grant the keyboard mapper Accessibility permission

The mapper injects keystrokes, which macOS gates behind Accessibility. In the app, click
**Grant keyboard access** (it runs `xb1-keyboard-mapper --request-access`), then enable the
mapper under **System Settings → Privacy & Security → Accessibility**.

If keys don't reach Mesen after enabling it, run the request once from a normal Terminal —
macOS sometimes attributes the permission to the terminal/parent that first launched it:

```sh
cd "/Users/mrowe/Personal_Project/xb1 controller"
./build/xb1-keyboard-mapper --request-access
```

## Using it

- Turn on **Settings → Auto-start with game**. Now launching a ROM (either flow) starts the
  bridge; quitting Mesen stops it and releases the controller.
- The status line shows **bridge running / stopped**, or an error (e.g. "the sudoers rule is
  not installed") if setup is incomplete.
- Keep Mesen focused while playing — these are ordinary keyboard events, so a different
  focused app would receive them.
- The default mapping (`configs/nes-keyboard.conf`): arrows = D-pad, `X`/`Z` = A/B,
  Return = Start, Tab = Select. Match Mesen's key bindings to these (or edit the config).
