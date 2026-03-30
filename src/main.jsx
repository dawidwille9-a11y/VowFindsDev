import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('VowFinds crashed:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px 24px', fontFamily: 'monospace', background: '#fff1f0',
          minHeight: '100vh', color: '#c0392b'
        }}>
          <h2 style={{ marginBottom: 16 }}>⚠️ App crashed — error details:</h2>
          <pre style={{
            background: '#fff', border: '1px solid #fcc', borderRadius: 8,
            padding: 20, overflow: 'auto', fontSize: 13, color: '#333',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            {this.state.error.toString()}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <p style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
            Check browser console (F12) for more details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
