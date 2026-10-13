import devAppIcon from '../assets/app-icon-dev.png';
import releaseAppIcon from '../assets/app-icon.png';

/** The app icon the screens show: green in dev, like the Dock icon (src-tauri/tauri.dev.conf.json). */
export const appIcon = import.meta.env.DEV ? devAppIcon : releaseAppIcon;
