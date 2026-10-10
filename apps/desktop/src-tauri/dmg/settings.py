# dmgbuild settings for the release installer (scripts/release-mac.sh):
#
#   dmgbuild -s apps/desktop/src-tauri/dmg/settings.py \
#     -D app=path/to/Angaria.app -D dir=apps/desktop/src-tauri/dmg Angaria out.dmg
#
# `dir` is this folder: dmgbuild runs the file without telling it its path.
# The window size and the two icon positions come from bundle.macOS.dmg in
# tauri.conf.json, which background.html draws its arrow against, so the
# layout lives in one place. dmgbuild writes the .DS_Store itself, so no
# Finder window opens and no Automation permission is needed.
import json
import os

here = defines["dir"]  # noqa: F821 (dmgbuild's -D values)
with open(os.path.join(here, "..", "tauri.conf.json")) as conf:
    dmg = json.load(conf)["bundle"]["macOS"]["dmg"]

app = defines["app"]  # noqa: F821
appname = os.path.basename(app)

files = [app]
symlinks = {"Applications": "/Applications"}

# The volume's own bookkeeping files go far off the canvas, so a Mac that
# shows hidden files does not show them in the install window.
icon_locations = {
    appname: (dmg["appPosition"]["x"], dmg["appPosition"]["y"]),
    "Applications": (dmg["applicationFolderPosition"]["x"], dmg["applicationFolderPosition"]["y"]),
    ".background.tiff": (5000, 5000),
    ".DS_Store": (5000, 5000),
    ".fseventsd": (5000, 5000),
    ".Trashes": (5000, 5000),
    ".VolumeIcon.icns": (5000, 5000),
}

format = "UDZO"
filesystem = "HFS+"
size = None

# dmgbuild joins background@2x.png beside it into one .background.tiff.
background = os.path.join(here, "background.png")
window_rect = ((200, 120), (dmg["windowSize"]["width"], dmg["windowSize"]["height"]))
# The size the arrow in background.html leaves room for.
icon_size = 128
text_size = 12
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
show_icon_preview = False
include_icon_view_settings = "auto"
include_list_view_settings = "auto"
arrange_by = None
grid_offset = (0, 0)
grid_spacing = 100
scroll_position = (0, 0)
label_pos = "bottom"
default_view = "icon-view"
