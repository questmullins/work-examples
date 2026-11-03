"""Upload HTML files in this folder to their Quickbase code pages (API_AddReplaceDBPage).

The page ID comes from the file name: sales_lookup_165.html -> page 165, annotation_jsx_159.js -> page 159.
Test copies such as annotation_jsx_159_a.js have no page ID at the end, so they are never uploaded by accident.

    python upload_pages.py                            # open a window to pick which pages to upload (or double-click this file)
    python upload_pages.py --dry-run                  # show what would be uploaded, change nothing
    python upload_pages.py demo_apps_166.html        # upload one page
    python upload_pages.py --all                      # upload every *_###.html and *_###.js in this folder

Settings come from Windows environment variables first, then .env (QB_REALM, QB_APP_ID, QB_USER_TOKEN,
and QB_APP_TOKEN only if the app requires app tokens). The token is never printed.

Quickbase's page API drops characters outside plain ASCII (for example the en dash in "A–Z"), so each page is
sent with those characters written as escape codes: &#x...; in HTML, \\uXXXX in <script>, \\XXXX in <style>.
Browsers show the same characters, and the files here keep their readable originals. After each upload the page
is read back and compared, so a bad upload is reported rather than silently published.
"""
import argparse
import html
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
PAGE_FILE = re.compile(r"_(\d+)\.(?:html|js)$", re.IGNORECASE)


def load_settings():
    settings = {}
    env_file = HERE / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8-sig").splitlines():
            match = re.match(r"^\s*([A-Z_]+)\s*=\s*(.*?)\s*$", line)
            if match:
                settings[match.group(1)] = match.group(2)
    for key in ("QB_REALM", "QB_APP_ID", "QB_USER_TOKEN", "QB_APP_TOKEN"):
        if os.environ.get(key):
            settings[key] = os.environ[key]
    settings.setdefault("QB_REALM", "demo.quickbase.example")
    settings.setdefault("QB_APP_ID", "bdemoapp0")
    return settings


def ascii_safe(page, whole_script=False):
    """Rewrites non-ASCII characters as escapes that mean the same thing in each part of the page."""
    def js(ch):
        code = ord(ch)
        if code > 0xFFFF:  # outside the Basic Multilingual Plane: write as a surrogate pair
            code -= 0x10000
            return "\\u%04X\\u%04X" % (0xD800 + (code >> 10), 0xDC00 + (code & 0x3FF))
        return "\\u%04X" % code

    def convert(text, kind):
        if kind == "script":
            return "".join(js(ch) if ord(ch) > 127 else ch for ch in text)
        if kind == "style":
            return "".join("\\%X " % ord(ch) if ord(ch) > 127 else ch for ch in text)
        return "".join("&#x%X;" % ord(ch) if ord(ch) > 127 else ch for ch in text)

    if whole_script:  # a .js code page is all script
        return convert(page, "script")
    out, position = [], 0
    for block in re.finditer(r"(<(script|style)\b[^>]*>)(.*?)(</\2\s*>)", page, re.IGNORECASE | re.DOTALL):
        out.append(convert(page[position:block.start()], "html"))
        out.append(block.group(1) + convert(block.group(3), block.group(2).lower()) + block.group(4))
        position = block.end()
    out.append(convert(page[position:], "html"))
    return "".join(out)


def call(settings, action, inner):
    app_token = settings.get("QB_APP_TOKEN", "").strip()
    body = ("<?xml version=\"1.0\" encoding=\"UTF-8\"?><qdbapi>"
            f"<usertoken>{escape(settings['QB_USER_TOKEN'].strip())}</usertoken>"
            + (f"<apptoken>{escape(app_token)}</apptoken>" if app_token else "")
            + inner + "</qdbapi>").encode("utf-8")
    request = urllib.request.Request(
        f"https://{settings['QB_REALM']}/db/{settings['QB_APP_ID']}?a={action}", data=body, method="POST",
        headers={"Content-Type": "application/xml; charset=utf-8", "QUICKBASE-ACTION": action})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8", "replace")
    except urllib.error.URLError as error:
        return "network", f"network error: {error.reason}", ""
    code = re.search(r"<errcode>(\d+)</errcode>", text)
    detail = re.search(r"<errdetail>(.*?)</errdetail>", text) or re.search(r"<errtext>(.*?)</errtext>", text)
    return (code.group(1) if code else "?"), (detail.group(1) if detail else "no detail"), text


def normalized(text):
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n")).strip()


def upload(settings, path, page_id):
    safe = ascii_safe(path.read_text(encoding="utf-8-sig"), whole_script=path.suffix.lower() == ".js")
    if "]]>" in safe:
        return False, "contains ']]>', which can't be sent inside CDATA"
    code, detail, _ = call(settings, "API_AddReplaceDBPage",
                           f"<pageid>{page_id}</pageid><pagetype>1</pagetype><pagebody><![CDATA[{safe}]]></pagebody>")
    if code != "0":
        return False, f"upload failed (error {code}: {detail})"
    # Read the page back and make sure Quickbase stored exactly what was sent.
    code, detail, text = call(settings, "API_GetDBPage", f"<pageID>{page_id}</pageID>")
    if code != "0":
        return True, f"uploaded, but the read-back check failed (error {code}: {detail})"
    body = re.search(r"<pagebody>(.*)</pagebody>", text, re.DOTALL)
    stored = html.unescape(re.sub(r"<BR/>\r?\n?", "\n", body.group(1))) if body else ""
    if normalized(stored) == normalized(safe):
        return True, f"uploaded and verified ({len(safe.encode('utf-8')) / 1024:.1f} KB)"
    return True, "uploaded, but the stored copy differs from what was sent. Open the page and check it."


def page_files():
    return sorted(p for p in HERE.iterdir() if p.is_file() and PAGE_FILE.search(p.name))


def pick_dialog():
    """A small window to tick the pages to upload; results show under the list."""
    import threading
    import tkinter as tk
    from datetime import datetime
    from tkinter import ttk

    settings = load_settings()
    files = page_files()
    root = tk.Tk()
    root.title("Upload to Quickbase")
    root.minsize(560, 420)
    frame = ttk.Frame(root, padding=14)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text=f"Choose pages to upload to {settings['QB_REALM']} (app {settings['QB_APP_ID']})",
              font=("Segoe UI", 10, "bold")).pack(anchor="w")
    ttk.Label(frame, text="Listed by page ID. Each page is read back after upload to confirm it saved.",
              foreground="#62757c").pack(anchor="w", pady=(2, 10))

    tree = ttk.Treeview(frame, columns=("page", "edited"), height=min(len(files), 14), selectmode="extended")
    tree.heading("#0", text="File")
    tree.heading("page", text="Page")
    tree.heading("edited", text="Last edited")
    tree.column("#0", width=300)
    tree.column("page", width=60, anchor="center")
    tree.column("edited", width=150)
    for path in sorted(files, key=lambda p: int(PAGE_FILE.search(p.name).group(1))):
        edited = datetime.fromtimestamp(path.stat().st_mtime).strftime("%b %d, %I:%M %p")
        tree.insert("", "end", iid=path.name, text=path.name, values=(PAGE_FILE.search(path.name).group(1), edited))
    tree.pack(fill="both", expand=True)

    buttons = ttk.Frame(frame)
    buttons.pack(fill="x", pady=10)
    ttk.Button(buttons, text="Select all", command=lambda: tree.selection_set(tree.get_children())).pack(side="left")
    ttk.Button(buttons, text="Clear", command=lambda: tree.selection_set(())).pack(side="left", padx=6)
    upload_button = ttk.Button(buttons, text="Upload selected")
    upload_button.pack(side="right")
    count = ttk.Label(buttons, text="Click to select; Ctrl or Shift for several.", foreground="#62757c")
    count.pack(side="right", padx=10)

    log = tk.Text(frame, height=7, wrap="word", state="disabled", font=("Consolas", 9))
    log.pack(fill="both")

    def write(line):
        log.configure(state="normal")
        log.insert("end", line + "\n")
        log.see("end")
        log.configure(state="disabled")

    busy = [False]

    def on_select(_event=None):
        chosen = len(tree.selection())
        count.configure(text=f"{chosen} selected" if chosen else "Click to select; Ctrl or Shift for several.")
        upload_button.state(["!disabled"] if chosen and not busy[0] else ["disabled"])

    def finish():
        busy[0] = False
        on_select()

    def run(names):
        for name in names:
            root.after(0, write, f"Uploading {name}...")
            try:
                ok, message = upload(settings, HERE / name, PAGE_FILE.search(name).group(1))
            except Exception as error:  # keep the window usable if one upload hits something unexpected
                ok, message = False, f"unexpected error: {error}"
            root.after(0, write, f"  {'OK' if ok else 'FAILED'}: {message}")
        root.after(0, write, "Done.\n")
        root.after(0, finish)

    def start():
        names = list(tree.selection())
        if not settings.get("QB_USER_TOKEN"):
            write("No QB_USER_TOKEN found in environment variables or .env.")
            return
        busy[0] = True
        on_select()
        threading.Thread(target=run, args=(names,), daemon=True).start()

    upload_button.configure(command=start)
    tree.bind("<<TreeviewSelect>>", on_select)
    on_select()
    root.mainloop()
    return 0


def main():
    if len(sys.argv) == 1:
        return pick_dialog()
    parser = argparse.ArgumentParser(description="Upload *_###.html files to their Quickbase code pages.")
    parser.add_argument("files", nargs="*", help="files to upload, e.g. demo_apps_166.html")
    parser.add_argument("--all", action="store_true", help="upload every *_###.html file in this folder")
    parser.add_argument("--dry-run", action="store_true", help="list the uploads without sending anything")
    args = parser.parse_args()

    paths = page_files() if args.all or (args.dry_run and not args.files) \
        else [HERE / name for name in args.files]
    if not paths:
        parser.print_help()
        return 1
    settings = load_settings()
    if not args.dry_run and not settings.get("QB_USER_TOKEN"):
        print("No QB_USER_TOKEN found in environment variables or .env.")
        return 1

    failures = 0
    for path in paths:
        match = PAGE_FILE.search(path.name)
        if not path.exists():
            print(f"  SKIP  {path.name}: file not found"); failures += 1; continue
        if not match:
            print(f"  SKIP  {path.name}: no _### page ID in the file name"); continue
        page_id = match.group(1)
        if args.dry_run:
            extra = sum(1 for ch in path.read_text(encoding="utf-8-sig") if ord(ch) > 127)
            print(f"  WOULD UPLOAD  {path.name:45} -> page {page_id}  ({extra} non-ASCII characters to escape)")
            continue
        ok, message = upload(settings, path, page_id)
        failures += 0 if ok else 1
        print(f"  {'OK  ' if ok else 'FAIL'}  {path.name:45} -> page {page_id}: {message}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
