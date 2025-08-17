import React from 'react';
import './App.css';
import Header from './components/Header';

function App() {
  return (
    <div className="App">
      <Header />
      <main className="main-content">
        <div className="content-container">
          <h1>Welcome to MyApp</h1>
          <p>This is a React web app with a beautiful header navbar that includes a profile icon on the right side.</p>
          <div className="feature-section">
            <h2>Features</h2>
            <ul>
              <li>Responsive navigation bar</li>
              <li>Profile icon with hover effects</li>
              <li>Clean and modern design</li>
              <li>Mobile-friendly layout</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
