import React from 'react';
import ReactDOM from 'react-dom/client';

// Fonts are bundled with the app rather than fetched from Google at page load.
// A blocked or slow request meant the browser quietly fell back to a system
// font, so the same build could look different from one machine to the next —
// and a kiosk without internet never got the real typeface at all. These are the
// weights the interface uses.
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
