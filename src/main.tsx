import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './ui/themes/normal.css';
import './ui/themes/document.css';
import './ui/themes/dashboard.css';
import './ui/themes/code.css';
import './ui/themes/meeting.css';
import './ui/themes/terminal.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
